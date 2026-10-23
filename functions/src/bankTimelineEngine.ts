import * as crypto from 'crypto';

export type SourceReleveType = 'CSV' | 'PDF';
export type FriseSegmentType = 'verifie' | 'derive' | 'trou';

export interface CompteBancaire {
  id: string;
  nom: string;
  numero: string;
  devise: 'EUR' | 'CHF';
  actif: boolean;
  userId?: string;
  soldeActuel?: number | null;
  typeSoldeActuel?: FriseSegmentType;
  derniereMaj?: string;
}

export interface ReleveImporte {
  id: string;
  source_type: SourceReleveType;
  nom_fichier: string;
  date_debut: string; // YYYY-MM-DD
  date_fin: string; // YYYY-MM-DD
  solde_initial: number | null;
  solde_final: number | null;
  total_mouvements: number;
  nb_transactions: number;
  statut?: 'valide' | 'rapprochement_erreur' | 'avertissement';
  message?: string;
  createdAt: string;
}

export interface TransactionDocument {
  hash_deduplication: string; // Unique document ID
  date: string; // YYYY-MM-DD
  libelle: string;
  montant: number;
  categorie?: string;
  flowType?: 'INCOME' | 'FIXED_EXPENSE' | 'VARIABLE_EXPENSE' | 'SAVINGS_TRANSFER';
  releveId?: string;
  compteId: string;
  createdAt: string;
}

export interface FriseChronologiqueSegment {
  id: string;
  date_debut: string; // YYYY-MM-DD
  date_fin: string; // YYYY-MM-DD
  type: FriseSegmentType; // 'verifie' | 'derive' | 'trou'
  ancre_id: string | null;
  ancre_date: string | null;
  solde: number | null; // Solde de fin du segment
  solde_initial: number | null;
  solde_final: number | null;
  total_mouvements: number;
  nb_transactions: number;
  ecart_rapprochement: number | null; // Discrépance > 0.01 €
  alerte_message: string | null;
  variation_inexpliquee: number | null; // Montant inexpliqué pour un trou
  ordre_chronologique: number;
  source_type: SourceReleveType | 'TROU' | 'MIXTE';
  nom_releve?: string;
  releve_id?: string;
}

export interface FriseRecalculResult {
  compteId: string;
  segments: FriseChronologiqueSegment[];
  soldeActuel: number | null;
  typeSoldeActuel: FriseSegmentType;
  alertesRapprochement: Array<{
    segmentId: string;
    releveId?: string;
    date_debut: string;
    date_fin: string;
    ecart: number;
    message: string;
  }>;
  trousDetectes: Array<{
    segmentId: string;
    date_debut: string;
    date_fin: string;
    variationInexpliquee: number | null;
    message: string;
  }>;
}

/**
 * RÈGLE STRICTE ANTI-DOUBLON :
 * Génère un identifiant déterministe unique (hash_deduplication) basé sur les données
 * intrinsèques de l'opération (date + montant normalisé + libellé nettoyé).
 * Utilisé directement comme ID de document Firestore pour écraser automatiquement les doublons à coût zéro.
 */
export function generateTransactionHash(tx: {
  date: string;
  libelle: string;
  montant: number;
  compteId?: string;
}): string {
  const cleanDate = (tx.date || '').trim().substring(0, 10);
  const cleanLibelle = (tx.libelle || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const cleanAmount = (Number(tx.montant) || 0).toFixed(2);
  const rawKey = `${cleanDate}|${cleanAmount}|${cleanLibelle}`;
  
  const hash = crypto.createHash('sha256').update(rawKey).digest('hex').substring(0, 24);
  return `tx_${cleanDate}_${hash}`;
}

/**
 * Ajoute un nombre de jours à une date au format YYYY-MM-DD
 */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().substring(0, 10);
}

/**
 * Calcule l'écart en jours entre deux dates YYYY-MM-DD (dateB - dateA)
 */
export function daysBetween(dateA: string, dateB: string): number {
  const dA = new Date(dateA + 'T00:00:00Z').getTime();
  const dB = new Date(dateB + 'T00:00:00Z').getTime();
  return Math.round((dB - dA) / (1000 * 60 * 60 * 24));
}

/**
 * Arrondit un nombre à 2 décimales pour éviter les imprécisions flottantes IEEE-754
 */
export function roundCurrency(num: number | null | undefined): number | null {
  if (num === null || num === undefined || isNaN(num)) return null;
  return Math.round(num * 100) / 100;
}

/**
 * ALGORITHME DE RE-CALCUL RÉTROACTIF DE LA FRISE CHRONOLOGIQUE
 * Conforme rigoureusement aux 4 règles métier fondamentales :
 * 1. Un CSV sans solde ne produit JAMAIS de solde officiel. Solde dérivé calculé UNIQUEMENT si ancre PDF continue.
 * 2. Un PDF crée une ancre de solde vérifiée (source de vérité absolue).
 * 3. Gestion des bornes (PDF), segments (CSV) et détection des trous avec variation non expliquée.
 * 4. Chevauchement : PDF = vérité solde, CSV = détail. Déclenchement d'alerte de rapprochement si écart > 0,01 €.
 */
export function recalculerFriseChronologique(
  compteId: string,
  releves: ReleveImporte[],
  transactions: TransactionDocument[]
): FriseRecalculResult {
  if (!releves || releves.length === 0) {
    return {
      compteId,
      segments: [],
      soldeActuel: null,
      typeSoldeActuel: 'trou',
      alertesRapprochement: [],
      trousDetectes: []
    };
  }

  // 1. Tri chronologique strict de tous les relevés importés par date de début
  const sortedReleves = [...releves].sort((a, b) => {
    const cmpDebut = a.date_debut.localeCompare(b.date_debut);
    if (cmpDebut !== 0) return cmpDebut;
    return a.date_fin.localeCompare(b.date_fin);
  });

  // Indexation rapide des transactions par date pour calculs de plages
  const txList = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

  const segments: FriseChronologiqueSegment[] = [];
  const alertesRapprochement: FriseRecalculResult['alertesRapprochement'] = [];
  const trousDetectes: FriseRecalculResult['trousDetectes'] = [];

  let derniereAncreVerifiee: { id: string; date: string; solde: number } | null = null;
  let soldeCourantDerive: number | null = null;
  let derniereDateFin: string | null = null;
  let ordreSeq = 0;

  for (let i = 0; i < sortedReleves.length; i++) {
    const currentReleve = sortedReleves[i];

    // Vérifier si un trou (gap) existe entre la fin du relevé précédent et le début de l'actuel
    if (derniereDateFin !== null) {
      const gapDays = daysBetween(derniereDateFin, currentReleve.date_debut);

      // Si plus d'1 jour sépare la fin du relevé précédent du début du relevé actuel -> TROU DE RELEVÉ
      if (gapDays > 1) {
        const gapDebut = addDays(derniereDateFin, 1);
        const gapFin = addDays(currentReleve.date_debut, -1);

        // Transactions isolées éventuellement présentes dans le trou
        const txsInGap = txList.filter(t => t.date >= gapDebut && t.date <= gapFin);
        const sumTxGap = roundCurrency(txsInGap.reduce((acc, t) => acc + (Number(t.montant) || 0), 0)) || 0;

        // Calcul de la variation non expliquée si des ancres vérifiées encadrent le trou
        let variationInexpliquee: number | null = null;
        if (
          derniereAncreVerifiee !== null &&
          currentReleve.source_type === 'PDF' &&
          currentReleve.solde_initial !== null
        ) {
          const deltaGlobal = currentReleve.solde_initial - derniereAncreVerifiee.solde;
          variationInexpliquee = roundCurrency(deltaGlobal - sumTxGap);
        }

        const segmentTrouId = `trou_${gapDebut}_${gapFin}`;
        let alerteMsg = `Trou de relevé détecté du ${gapDebut} au ${gapFin}. Aucun relevé disponible pour cette période.`;
        if (variationInexpliquee !== null) {
          alerteMsg += ` Variation non expliquée entre ancres : ${variationInexpliquee.toFixed(2)} €.`;
        }

        const segmentTrou: FriseChronologiqueSegment = {
          id: segmentTrouId,
          date_debut: gapDebut,
          date_fin: gapFin,
          type: 'trou',
          ancre_id: null,
          ancre_date: null,
          solde: null,
          solde_initial: null,
          solde_final: null,
          total_mouvements: sumTxGap,
          nb_transactions: txsInGap.length,
          ecart_rapprochement: null,
          alerte_message: alerteMsg,
          variation_inexpliquee: variationInexpliquee,
          ordre_chronologique: ordreSeq++,
          source_type: 'TROU',
          nom_releve: 'Période manquante'
        };

        segments.push(segmentTrou);
        trousDetectes.push({
          segmentId: segmentTrouId,
          date_debut: gapDebut,
          date_fin: gapFin,
          variationInexpliquee,
          message: alerteMsg
        });

        // RÈGLE 3 : Un trou rompt la continuité temporelle. Tout calcul de solde dérivé futur est suspendu jusqu'à une nouvelle ancre PDF
        soldeCourantDerive = null;
      }
    }

    // Transactions de la période couverte par le relevé actuel
    const txsInReleve = txList.filter(t => t.date >= currentReleve.date_debut && t.date <= currentReleve.date_fin);
    const sumMouvements = roundCurrency(txsInReleve.reduce((acc, t) => acc + (Number(t.montant) || 0), 0)) || 0;
    const nbTxs = txsInReleve.length;

    // ==========================================
    // CAS 1 : RELEVÉ PDF (ANCRE DE SOLDE VÉRIFIÉE)
    // ==========================================
    if (currentReleve.source_type === 'PDF') {
      const soldeFinalCertifie = currentReleve.solde_final !== null ? roundCurrency(currentReleve.solde_final) : null;
      const soldeInitialCertifie = currentReleve.solde_initial !== null ? roundCurrency(currentReleve.solde_initial) : null;

      let ecartRapprochement: number | null = null;
      let alerteMessage: string | null = null;

      // RÈGLE 4 : Si un PDF et un CSV se chevauchent ou si les transactions sont présentes,
      // vérifier l'écart entre le total des transactions et la variation certifiée du PDF
      if (soldeInitialCertifie !== null && soldeFinalCertifie !== null) {
        const deltaCertifie = roundCurrency(soldeFinalCertifie - soldeInitialCertifie) || 0;
        const ecart = Math.abs((roundCurrency(deltaCertifie - sumMouvements)) || 0);

        if (ecart > 0.01) {
          ecartRapprochement = roundCurrency(ecart);
          alerteMessage = `Écart de rapprochement de ${ecartRapprochement?.toFixed(2)} € détecté entre le détail des mouvements (${sumMouvements.toFixed(2)} €) et la variation certifiée du relevé PDF (${deltaCertifie.toFixed(2)} €).`;
          
          alertesRapprochement.push({
            segmentId: `seg_${currentReleve.id}`,
            releveId: currentReleve.id,
            date_debut: currentReleve.date_debut,
            date_fin: currentReleve.date_fin,
            ecart: ecartRapprochement!,
            message: alerteMessage
          });
        }
      }

      const segmentPdf: FriseChronologiqueSegment = {
        id: `seg_${currentReleve.id}`,
        releve_id: currentReleve.id,
        nom_releve: currentReleve.nom_fichier,
        date_debut: currentReleve.date_debut,
        date_fin: currentReleve.date_fin,
        type: 'verifie',
        ancre_id: currentReleve.id,
        ancre_date: currentReleve.date_fin,
        solde: soldeFinalCertifie, // Le solde du PDF est toujours la priorité absolue
        solde_initial: soldeInitialCertifie,
        solde_final: soldeFinalCertifie,
        total_mouvements: sumMouvements,
        nb_transactions: nbTxs,
        ecart_rapprochement: ecartRapprochement,
        alerte_message: alerteMessage,
        variation_inexpliquee: null,
        ordre_chronologique: ordreSeq++,
        source_type: 'PDF'
      };

      segments.push(segmentPdf);

      // Mise à jour de l'ancre vérifiée pour les futurs segments CSV
      if (soldeFinalCertifie !== null) {
        derniereAncreVerifiee = {
          id: currentReleve.id,
          date: currentReleve.date_fin,
          solde: soldeFinalCertifie
        };
        soldeCourantDerive = soldeFinalCertifie;
      }
    }

    // ==========================================
    // CAS 2 : FICHIER CSV (SANS SOLDE OFFICIEL)
    // ==========================================
    else if (currentReleve.source_type === 'CSV') {
      // RÈGLE 1 : Un CSV sans solde ne produit JAMAIS de solde officiel par lui-même.
      // Un solde dérivé est calculé UNIQUEMENT si une ancre PDF existe avant la période et si la continuité est assurée.
      if (soldeCourantDerive !== null && derniereAncreVerifiee !== null) {
        const soldeInitialDerive = soldeCourantDerive;
        const soldeFinalDerive = roundCurrency(soldeCourantDerive + sumMouvements);

        const segmentCsvDerive: FriseChronologiqueSegment = {
          id: `seg_${currentReleve.id}`,
          releve_id: currentReleve.id,
          nom_releve: currentReleve.nom_fichier,
          date_debut: currentReleve.date_debut,
          date_fin: currentReleve.date_fin,
          type: 'derive',
          ancre_id: derniereAncreVerifiee.id,
          ancre_date: derniereAncreVerifiee.date,
          solde: soldeFinalDerive,
          solde_initial: soldeInitialDerive,
          solde_final: soldeFinalDerive,
          total_mouvements: sumMouvements,
          nb_transactions: nbTxs,
          ecart_rapprochement: null,
          alerte_message: null,
          variation_inexpliquee: null,
          ordre_chronologique: ordreSeq++,
          source_type: 'CSV'
        };

        segments.push(segmentCsvDerive);
        soldeCourantDerive = soldeFinalDerive;
      } else {
        // RÈGLE 1 : Pas d'ancre antérieure ou continuité rompue -> « Solde non disponible »
        const segmentCsvNonDispo: FriseChronologiqueSegment = {
          id: `seg_${currentReleve.id}`,
          releve_id: currentReleve.id,
          nom_releve: currentReleve.nom_fichier,
          date_debut: currentReleve.date_debut,
          date_fin: currentReleve.date_fin,
          type: 'trou',
          ancre_id: null,
          ancre_date: null,
          solde: null,
          solde_initial: null,
          solde_final: null,
          total_mouvements: sumMouvements,
          nb_transactions: nbTxs,
          ecart_rapprochement: null,
          alerte_message: 'Solde non disponible : relevé de mouvements CSV sans relevé PDF certifié antérieur pour ancrer le solde.',
          variation_inexpliquee: null,
          ordre_chronologique: ordreSeq++,
          source_type: 'CSV'
        };

        segments.push(segmentCsvNonDispo);
        soldeCourantDerive = null;
      }
    }

    derniereDateFin = currentReleve.date_fin;
  }

  // Détermination du solde actuel et de son statut à partir du dernier segment chronologique
  const dernierSegment = segments.length > 0 ? segments[segments.length - 1] : null;
  const soldeActuel = dernierSegment ? dernierSegment.solde : null;
  const typeSoldeActuel: FriseSegmentType = dernierSegment ? dernierSegment.type : 'trou';

  return {
    compteId,
    segments,
    soldeActuel,
    typeSoldeActuel,
    alertesRapprochement,
    trousDetectes
  };
}
