import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import {
  ShieldCheck,
  Calculator,
  AlertTriangle,
  AlertCircle,
  FileText,
  Table,
  ArrowRight,
  RefreshCw,
  Calendar,
  Layers,
  ChevronRight,
  Info,
  Clock,
  Sparkles
} from 'lucide-react';
import { db, functions } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, doc, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { formatCurrency, formatDateFR } from '../lib/bankUtils';
import { getActiveAccountId } from '../lib/userUtils';
import { cn } from '../lib/utils';
import {
  type FriseChronologiqueSegment,
  type CompteBancaire,
  type ReleveImporte,
  type TransactionDocument,
  recalculerFriseChronologique
} from '../lib/bankTimelineEngine';

interface FriseChronologiqueViewProps {
  compteId?: string;
  currency?: 'EUR' | 'CHF';
  onRefreshRequested?: () => void;
}

export const FriseChronologiqueView: React.FC<FriseChronologiqueViewProps> = ({
  compteId,
  currency = 'EUR',
  onRefreshRequested
}) => {
  const defaultAccountId = compteId || getActiveAccountId() || 'compte_principal';
  const [segments, setSegments] = useState<FriseChronologiqueSegment[]>([]);
  const [compte, setCompte] = useState<CompteBancaire | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRecalculating, setIsRecalculating] = useState<boolean>(false);
  const [availableAccounts, setAvailableAccounts] = useState<CompteBancaire[]>([]);
  const [selectedCompteId, setSelectedCompteId] = useState<string>(defaultAccountId);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);

  // 1. Chargement du compte bancaire de l'utilisateur connecté (isolation stricte par UID)
  useEffect(() => {
    const uid = getActiveAccountId();
    if (!uid || uid === 'unauthenticated') return;

    const userCompteRef = doc(db, 'ComptesBancaires', uid);
    const unsubAccount = onSnapshot(userCompteRef, (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        const acc: CompteBancaire = {
          id: snap.id,
          nom: d.nom || 'Compte Principal',
          numero: d.numero || '',
          devise: d.devise || 'EUR',
          actif: d.actif !== false,
          soldeActuel: d.soldeActuel,
          typeSoldeActuel: d.typeSoldeActuel,
          derniereMaj: d.derniereMaj
        };
        setAvailableAccounts([acc]);
        setSelectedCompteId(uid);
      } else {
        setAvailableAccounts([]);
        setSelectedCompteId(uid);
      }
    }, () => {
      // Silencieux si le document ComptesBancaires/{uid} n'est pas encore initialisé
    });

    return () => unsubAccount();
  }, []);

  // 2. Écouteur en temps réel de la frise chronologique pour le compte sélectionné
  useEffect(() => {
    setLoading(true);

    // Écoute des détails du compte
    const compteDocRef = doc(db, 'ComptesBancaires', selectedCompteId);
    const unsubCompte = onSnapshot(compteDocRef, (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setCompte({
          id: snap.id,
          nom: d.nom || 'Compte Principal',
          numero: d.numero || '',
          devise: d.devise || 'EUR',
          actif: d.actif !== false,
          soldeActuel: d.soldeActuel,
          typeSoldeActuel: d.typeSoldeActuel,
          derniereMaj: d.derniereMaj
        });
      } else {
        setCompte({
          id: selectedCompteId,
          nom: 'Compte Principal',
          numero: '',
          devise: 'EUR',
          actif: true,
          soldeActuel: null,
          typeSoldeActuel: 'trou'
        });
      }
    });

    // Écoute des segments de la sous-collection FriseChronologique
    const friseQuery = query(
      collection(db, `ComptesBancaires/${selectedCompteId}/FriseChronologique`),
      orderBy('ordre_chronologique', 'asc')
    );

    const unsubFrise = onSnapshot(friseQuery, (snap) => {
      const loadedSegments: FriseChronologiqueSegment[] = snap.docs.map(d => d.data() as FriseChronologiqueSegment);
      setSegments(loadedSegments);
      setLoading(false);
    }, async (err) => {
      console.warn("Écouteur FriseChronologique Firestore distant non initialisé, tentative de calcul local :", err);
      // Fallback local instantané en lisant RelevesImportes et Transactions
      try {
        const [relSnap, txSnap] = await Promise.all([
          getDocs(collection(db, `ComptesBancaires/${selectedCompteId}/RelevesImportes`)),
          getDocs(collection(db, `ComptesBancaires/${selectedCompteId}/Transactions`))
        ]);
        const rels = relSnap.docs.map(d => d.data() as ReleveImporte);
        const txs = txSnap.docs.map(d => d.data() as TransactionDocument);
        const localRes = recalculerFriseChronologique(selectedCompteId, rels, txs);
        setSegments(localRes.segments);
      } catch (e) {
        console.error("Erreur calcul local fallback :", e);
      }
      setLoading(false);
    });

    return () => {
      unsubCompte();
      unsubFrise();
    };
  }, [selectedCompteId]);

  // Déclenchement du recalcul via Cloud Function
  const handleTriggerRecalcul = async () => {
    try {
      setIsRecalculating(true);
      const recalculer = httpsCallable(functions, 'recalculerFriseBancaire');
      await recalculer({ compteId: selectedCompteId });
      if (onRefreshRequested) onRefreshRequested();
    } catch (e: any) {
      console.warn("Échec appel Cloud Function, calcul direct côté client :", e?.message || e);
      // Calcul direct côté client avec écriture Firestore si accessible
      try {
        const [relSnap, txSnap] = await Promise.all([
          getDocs(collection(db, `ComptesBancaires/${selectedCompteId}/RelevesImportes`)),
          getDocs(collection(db, `ComptesBancaires/${selectedCompteId}/Transactions`))
        ]);
        const rels = relSnap.docs.map(d => d.data() as ReleveImporte);
        const txs = txSnap.docs.map(d => d.data() as TransactionDocument);
        const res = recalculerFriseChronologique(selectedCompteId, rels, txs);
        setSegments(res.segments);
      } catch (err) {
        console.error(err);
      }
    } finally {
      setIsRecalculating(false);
    }
  };

  // Statistiques synthétiques
  const verifiedCount = segments.filter(s => s.type === 'verifie').length;
  const derivedCount = segments.filter(s => s.type === 'derive').length;
  const trouCount = segments.filter(s => s.type === 'trou').length;
  const ecartCount = segments.filter(s => (s.ecart_rapprochement ?? 0) > 0.01).length;

  const currentSegment = segments.length > 0 ? segments[segments.length - 1] : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* 1. CARTE BANDEAU : ÉTAT DU SOLDE OFFICIEL & RÉCONCILIATION */}
      <Card className="glass-card overflow-hidden border-border/80 dark:border-white/[0.08] shadow-md">
        <div className="p-5 md:p-6 bg-gradient-to-r from-card to-secondary/30 border-b border-border/60">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            {/* Titre & Sélecteur de compte */}
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Architecture Certifiée NoSQL & Rapprochement
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <h2 className="text-xl md:text-2xl font-black tracking-tight text-foreground">
                  Frise Chronologique des Relevés
                </h2>
                {availableAccounts.length > 1 && (
                  <select
                    value={selectedCompteId}
                    onChange={(e) => setSelectedCompteId(e.target.value)}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-card border border-border/80 text-foreground shadow-xs cursor-pointer"
                  >
                    {availableAccounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.nom} {a.numero ? `(${a.numero})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                Distinction mathématique absolue entre soldes officiels certifiés (PDF), soldes dérivés continus (CSV) et périodes manquantes.
              </p>
            </div>

            {/* Actions : Bouton Recalculer */}
            <div className="flex items-center gap-2 self-start md:self-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTriggerRecalcul}
                disabled={isRecalculating}
                className="h-9 text-xs font-semibold gap-1.5 shadow-xs border-border/80 hover:border-primary/50"
              >
                <RefreshCw size={13} className={cn(isRecalculating && "animate-spin text-primary")} />
                {isRecalculating ? "Recalcul rétroactif..." : "Recalculer la frise"}
              </Button>
            </div>
          </div>
        </div>

        {/* INDICATEUR MAJEUR DU SOLDE ACTUEL */}
        <div className="p-5 md:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-card/60">
          
          {/* Tuile 1 : Solde Actuel du Compte */}
          <div className="p-4 rounded-xl border border-border/70 dark:border-white/[0.06] bg-secondary/40 flex flex-col justify-between">
            <span className="text-xs font-medium text-muted-foreground">Solde actuel du compte</span>
            <div className="my-1.5">
              {currentSegment && currentSegment.solde !== null ? (
                <div className="text-2xl font-black font-mono tracking-tight text-foreground">
                  {formatCurrency(currentSegment.solde, { currency })}
                </div>
              ) : (
                <div className="text-lg font-bold font-mono text-amber-500 flex items-center gap-1.5">
                  <AlertTriangle size={16} />
                  Solde non disponible
                </div>
              )}
            </div>
            
            {/* BADGE OFFICIEL MAJEUR */}
            <div className="mt-1">
              {currentSegment?.type === 'verifie' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  <ShieldCheck size={13} />
                  Solde vérifié (PDF)
                </span>
              )}
              {currentSegment?.type === 'derive' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
                  <Calculator size={13} />
                  Solde dérivé (CSV + ancre)
                </span>
              )}
              {(!currentSegment || currentSegment.type === 'trou') && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  <AlertTriangle size={13} />
                  Solde non disponible (trou de relevé)
                </span>
              )}
            </div>
          </div>

          {/* Tuile 2 : Relevés Certifiés (Ancres PDF) */}
          <div className="p-4 rounded-xl border border-border/70 dark:border-white/[0.06] bg-secondary/40 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Ancres certifiées (PDF)</span>
              <FileText size={16} className="text-emerald-500" />
            </div>
            <div className="text-2xl font-black font-mono text-foreground my-1.5">
              {verifiedCount} <span className="text-xs font-normal text-muted-foreground font-sans">relevé{verifiedCount > 1 ? 's' : ''}</span>
            </div>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
              <ShieldCheck size={12} />
              Sources de vérité absolues
            </span>
          </div>

          {/* Tuile 3 : Segments Dérivés (CSV) */}
          <div className="p-4 rounded-xl border border-border/70 dark:border-white/[0.06] bg-secondary/40 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Segments dérivés (CSV)</span>
              <Table size={16} className="text-cyan-500" />
            </div>
            <div className="text-2xl font-black font-mono text-foreground my-1.5">
              {derivedCount} <span className="text-xs font-normal text-muted-foreground font-sans">segment{derivedCount > 1 ? 's' : ''}</span>
            </div>
            <span className="text-[11px] text-cyan-600 dark:text-cyan-400 font-semibold flex items-center gap-1">
              <Calculator size={12} />
              Mouvements chaînés à une ancre
            </span>
          </div>

          {/* Tuile 4 : Alertes & Trous Détectés */}
          <div className="p-4 rounded-xl border border-border/70 dark:border-white/[0.06] bg-secondary/40 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Alertes & Trous</span>
              <AlertCircle size={16} className={ecartCount > 0 ? "text-red-500" : "text-muted-foreground"} />
            </div>
            <div className="text-2xl font-black font-mono my-1.5">
              {ecartCount > 0 ? (
                <span className="text-red-500 font-bold">{ecartCount} écart{ecartCount > 1 ? 's' : ''}</span>
              ) : trouCount > 0 ? (
                <span className="text-amber-500 font-bold">{trouCount} trou{trouCount > 1 ? 's' : ''}</span>
              ) : (
                <span className="text-emerald-500 text-lg font-bold flex items-center gap-1">
                  <ShieldCheck size={18} /> Frise continue
                </span>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground">
              {trouCount} période{trouCount > 1 ? 's' : ''} manquante{trouCount > 1 ? 's' : ''} détectée{trouCount > 1 ? 's' : ''}
            </span>
          </div>

        </div>
      </Card>

      {/* 2. BANNIÈRE D'ALERTE DE RAPPROCHEMENT SI PRÉSENTE (RÈGLE 4) */}
      {ecartCount > 0 && (
        <div className="p-4 rounded-2xl bg-red-500/10 border-2 border-red-500/30 flex items-start gap-3 text-red-700 dark:text-red-400 animate-in shake">
          <AlertCircle size={20} className="shrink-0 text-red-500 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-extrabold text-sm flex items-center gap-2">
              <span>Écart de rapprochement détecté</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-500 text-white font-mono">
                {ecartCount} incohérence{ecartCount > 1 ? 's' : ''}
              </span>
            </h4>
            <p className="text-xs text-red-600 dark:text-red-300 leading-relaxed">
              Une discordance supérieure à 0,01 € a été détectée entre le total des transactions détaillées et la variation certifiée sur le relevé officiel PDF. Conformément aux règles comptables, <strong>le solde du PDF est conservé comme source de vérité</strong>.
            </p>
          </div>
        </div>
      )}

      {/* 3. VISUALISATION CHRONOLOGIQUE DE LA FRISE (TIMELINE) */}
      <Card className="glass-card overflow-hidden border-border/80 dark:border-white/[0.08]">
        <CardHeader className="border-b border-border/60 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers size={18} className="text-primary" />
              <CardTitle className="text-base font-bold text-foreground">
                Déroulement Chronologique des Périodes
              </CardTitle>
            </div>
            <span className="text-xs font-mono font-bold text-muted-foreground">
              {segments.length} segment{segments.length > 1 ? 's' : ''} au total
            </span>
          </div>
          <CardDescription className="text-xs">
            Parcourez chaque segment pour voir l'ancre d'origine, le solde officiel ou dérivé, et les contrôles d'écart.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-4 md:p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <RefreshCw size={24} className="animate-spin text-primary" />
              <span className="text-xs font-semibold">Chargement de la frise chronologique...</span>
            </div>
          ) : segments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground max-w-md mx-auto space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center text-primary">
                <Clock size={24} />
              </div>
              <h3 className="font-bold text-foreground text-sm">Aucun relevé dans la frise</h3>
              <p className="text-xs leading-relaxed">
                Importez votre premier relevé bancaire (fichier CSV ou PDF) pour initialiser la frise chronologique, dédupliquer les opérations et certifier les soldes.
              </p>
            </div>
          ) : (
            <div className="relative pl-6 md:pl-8 space-y-6 before:content-[''] before:absolute before:left-2.5 md:before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-border/80 dark:before:bg-white/[0.08]">
              
              {segments.map((seg, idx) => {
                const isSelected = selectedSegmentId === seg.id;
                const isEcart = (seg.ecart_rapprochement ?? 0) > 0.01;

                return (
                  <div
                    key={seg.id || idx}
                    className="relative group transition-all duration-200"
                    onClick={() => setSelectedSegmentId(isSelected ? null : seg.id)}
                  >
                    {/* PASTILLE INDICATRICE CHRONOLOGIQUE */}
                    <div className={cn(
                      "absolute -left-[27px] md:-left-[31px] top-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-transform group-hover:scale-110 shadow-xs",
                      seg.type === 'verifie' && "bg-emerald-500 border-background text-white",
                      seg.type === 'derive' && "bg-cyan-500 border-background text-white",
                      seg.type === 'trou' && "bg-amber-500 border-background text-white",
                      isEcart && "bg-red-500 border-background text-white animate-pulse"
                    )}>
                      {seg.type === 'verifie' && <ShieldCheck size={11} />}
                      {seg.type === 'derive' && <Calculator size={11} />}
                      {seg.type === 'trou' && <AlertTriangle size={11} />}
                    </div>

                    {/* CARTE DU SEGMENT */}
                    <div className={cn(
                      "p-4 md:p-5 rounded-2xl border transition-all cursor-pointer shadow-xs",
                      isSelected
                        ? "bg-secondary/70 border-primary shadow-sm"
                        : "bg-card/70 border-border/70 hover:border-primary/40 hover:bg-secondary/30",
                      isEcart && "border-red-500/50 bg-red-500/5"
                    )}>
                      
                      {/* EN-TÊTE DU SEGMENT */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-border/50 pb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* BADGES OFFICIELS REQUIS PAR LE CAHIER DES CHARGES */}
                          {seg.type === 'verifie' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                              <ShieldCheck size={12} />
                              Solde vérifié (PDF)
                            </span>
                          )}

                          {seg.type === 'derive' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 flex items-center gap-1">
                              <Calculator size={12} />
                              Solde dérivé (CSV + ancre)
                            </span>
                          )}

                          {seg.type === 'trou' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                              <AlertTriangle size={12} />
                              Solde non disponible (trou de relevé)
                            </span>
                          )}

                          {isEcart && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 flex items-center gap-1">
                              <AlertCircle size={12} />
                              Écart de rapprochement
                            </span>
                          )}

                          {/* NOM DU FICHIER SOURCE */}
                          {seg.nom_releve && (
                            <span className="text-[11px] font-medium text-muted-foreground truncate max-w-[220px]">
                              {seg.nom_releve}
                            </span>
                          )}
                        </div>

                        {/* PLAGE DE DATES */}
                        <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-foreground">
                          <Calendar size={13} className="text-muted-foreground" />
                          <span>{formatDateFR(seg.date_debut)}</span>
                          <ArrowRight size={11} className="text-muted-foreground" />
                          <span>{formatDateFR(seg.date_fin)}</span>
                        </div>
                      </div>

                      {/* CORPS FINANCIER DU SEGMENT */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3.5 items-center">
                        
                        {/* Solde Initial */}
                        <div>
                          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                            Solde initial
                          </span>
                          <span className="text-xs font-mono font-semibold text-foreground">
                            {seg.solde_initial !== null
                              ? formatCurrency(seg.solde_initial, { currency })
                              : <span className="text-muted-foreground italic">Non défini</span>}
                          </span>
                        </div>

                        {/* Total Mouvements */}
                        <div>
                          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                            Total mouvements
                          </span>
                          <span className={cn(
                            "text-xs font-mono font-bold",
                            seg.total_mouvements > 0 ? "text-emerald-500" : (seg.total_mouvements < 0 ? "text-foreground" : "text-muted-foreground")
                          )}>
                            {formatCurrency(seg.total_mouvements, { currency, showSign: true })}
                          </span>
                          <span className="text-[10px] text-muted-foreground block">
                            {seg.nb_transactions} opération{seg.nb_transactions > 1 ? 's' : ''}
                          </span>
                        </div>

                        {/* Solde de Clôture */}
                        <div>
                          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                            Solde final
                          </span>
                          <span className="text-sm font-mono font-black text-foreground">
                            {seg.solde !== null ? (
                              formatCurrency(seg.solde, { currency })
                            ) : (
                              <span className="text-amber-500 text-xs font-bold">Non disponible</span>
                            )}
                          </span>
                        </div>

                        {/* Rapprochement ou Ancre */}
                        <div className="text-right">
                          {isEcart ? (
                            <div className="text-red-500 font-bold text-xs font-mono">
                              Écart : {formatCurrency(seg.ecart_rapprochement!, { currency })}
                            </div>
                          ) : seg.variation_inexpliquee !== null ? (
                            <div className="text-amber-500 font-semibold text-xs font-mono">
                              Δ Inexpliqué : {formatCurrency(seg.variation_inexpliquee, { currency })}
                            </div>
                          ) : seg.ancre_date ? (
                            <div className="text-[10px] text-muted-foreground font-mono">
                              Ancré au {formatDateFR(seg.ancre_date)}
                            </div>
                          ) : (
                            <div className="text-[10px] text-muted-foreground">
                              {seg.source_type}
                            </div>
                          )}
                        </div>

                      </div>

                      {/* MESSAGE D'ALERTE DÉTAILLÉ S'IL EXISTE */}
                      {seg.alerte_message && (
                        <div className={cn(
                          "mt-3 p-2.5 rounded-xl text-xs flex items-start gap-2",
                          isEcart && "bg-red-500/10 text-red-600 dark:text-red-300 border border-red-500/20",
                          seg.type === 'trou' && !isEcart && "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"
                        )}>
                          <Info size={14} className="shrink-0 mt-0.5" />
                          <span className="leading-snug">{seg.alerte_message}</span>
                        </div>
                      )}

                    </div>
                  </div>
                );
              })}

            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
};
