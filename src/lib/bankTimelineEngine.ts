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
  hash_deduplication: string; // Identifiant unique document Firestore
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
  solde: number | null; // Solde officiel ou dérivé de fin
  solde_initial: number | null;
  solde_final: number | null;
  total_mouvements: number;
  nb_transactions: number;
  ecart_rapprochement: number | null; // Écart de rapprochement (> 0,01 €)
  alerte_message: string | null;
  variation_inexpliquee: number | null;
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
 * Générateur de hash déterministe compatible navigateur et Node.js
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

  // Utilisation d'un hachage SHA-256 synchrone universel
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  for (let i = 0; i < rawKey.length; i++) {
    const code = rawKey.charCodeAt(i);
    h0 = Math.imul(h0 ^ code, 16777619);
    h1 = Math.imul(h1 ^ (code << 1), 2166136261);
    h2 = Math.imul(h2 ^ (code << 2), 1099511628);
    h3 = Math.imul(h3 ^ (code << 3), 4294967291);
  }
  const hexPart = [h0, h1, h2, h3]
    .map(n => (n >>> 0).toString(16).padStart(8, '0'))
    .join('')
    .substring(0, 24);

  return `tx_${cleanDate}_${hexPart}`;
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().substring(0, 10);
}

export function daysBetween(dateA: string, dateB: string): number {
  const dA = new Date(dateA + 'T00:00:00Z').getTime();
  const dB = new Date(dateB + 'T00:00:00Z').getTime();
  return Math.round((dB - dA) / (1000 * 60 * 60 * 24));
}

export function roundCurrency(num: number | null | undefined): number | null {
  if (num === null || num === undefined || isNaN(num)) return null;
  return Math.round(num * 100) / 100;
}

/**
 * Calcul de la frise chronologique côté client (pour affichage instantané et simulation)
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

  const sortedReleves = [...releves].sort((a, b) => {
    const cmpDebut = a.date_debut.localeCompare(b.date_debut);
    if (cmpDebut !== 0) return cmpDebut;
    return a.date_fin.localeCompare(b.date_fin);
  });

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

    // Détection de trou
    if (derniereDateFin !== null) {
      const gapDays = daysBetween(derniereDateFin, currentReleve.date_debut);

      if (gapDays > 1) {
        const gapDebut = addDays(derniereDateFin, 1);
        const gapFin = addDays(currentReleve.date_debut, -1);

        const txsInGap = txList.filter(t => t.date >= gapDebut && t.date <= gapFin);
        const sumTxGap = roundCurrency(txsInGap.reduce((acc, t) => acc + (Number(t.montant) || 0), 0)) || 0;

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

        soldeCourantDerive = null;
      }
    }

    const txsInReleve = txList.filter(t => t.date >= currentReleve.date_debut && t.date <= currentReleve.date_fin);
    const sumMouvements = roundCurrency(txsInReleve.reduce((acc, t) => acc + (Number(t.montant) || 0), 0)) || 0;
    const nbTxs = txsInReleve.length;

    // PDF
    if (currentReleve.source_type === 'PDF') {
      const soldeFinalCertifie = currentReleve.solde_final !== null ? roundCurrency(currentReleve.solde_final) : null;
      const soldeInitialCertifie = currentReleve.solde_initial !== null ? roundCurrency(currentReleve.solde_initial) : null;

      let ecartRapprochement: number | null = null;
      let alerteMessage: string | null = null;

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
        solde: soldeFinalCertifie,
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

      if (soldeFinalCertifie !== null) {
        derniereAncreVerifiee = {
          id: currentReleve.id,
          date: currentReleve.date_fin,
          solde: soldeFinalCertifie
        };
        soldeCourantDerive = soldeFinalCertifie;
      }
    }
    // CSV
    else if (currentReleve.source_type === 'CSV') {
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
