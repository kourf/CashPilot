import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Info, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Sparkles, X } from 'lucide-react';
import { formatCurrency } from '../lib/bankUtils';

export type KpiType = 'income' | 'expenses' | 'savings' | 'resteAVivre';

interface KpiInfoTooltipProps {
  type: KpiType;
  amount: number;
  fixedAmount?: number;
  variableAmount?: number;
  accountName?: string;
}

export const KpiInfoTooltip: React.FC<KpiInfoTooltipProps> = ({
  type,
  amount,
  fixedAmount = 0,
  variableAmount = 0
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; isFlipped: boolean }>({ top: 0, left: 0, isFlipped: false });
  const [isMobile, setIsMobile] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Détection mobile vs desktop et calcul des coordonnées
  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const mobile = window.innerWidth < 640;
    setIsMobile(mobile);

    if (!mobile) {
      const tooltipWidth = 320;
      const tooltipHeight = 260;
      let left = rect.left - 10;
      if (left + tooltipWidth > window.innerWidth - 16) {
        left = window.innerWidth - tooltipWidth - 16;
      }
      if (left < 16) left = 16;

      const spaceBelow = window.innerHeight - rect.bottom;
      const shouldFlip = spaceBelow < tooltipHeight && rect.top > tooltipHeight;

      const top = shouldFlip ? rect.top - tooltipHeight - 8 : rect.bottom + 8;
      setCoords({ top, left, isFlipped: shouldFlip });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      const handleScrollOrResize = () => {
        if (!isMobile) updatePosition();
      };
      const handleClickOutside = (e: MouseEvent) => {
        if (
          triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
          tooltipRef.current && !tooltipRef.current.contains(e.target as Node)
        ) {
          setIsOpen(false);
        }
      };
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setIsOpen(false);
      };

      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);

      return () => {
        window.removeEventListener('scroll', handleScrollOrResize, true);
        window.removeEventListener('resize', handleScrollOrResize);
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen, isMobile]);

  // Contenu ultra-simpliste selon le type d'indicateur
  const getContent = () => {
    switch (type) {
      case 'income':
        return {
          title: 'Revenus Réels',
          subtitle: "L'argent qui entre",
          icon: ArrowDownLeft,
          colorClass: 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10',
          badgeText: 'Entrées',
          badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
          whatIsIt: "C'est la somme de tout l'argent qui est arrivé sur vos comptes ce mois-ci : salaires, primes, aides (CAF...) ou virements reçus.",
          howToRead: amount > 0
            ? 'Vous avez reçu un total de ' + formatCurrency(amount, { showSign: true }) + ". C'est votre carburant pour payer vos dépenses et épargner."
            : "Aucun revenu n'a été détecté pour l'instant sur cette période.",
          tip: "Les virements entre vos propres comptes ne sont pas comptés comme un revenu pour ne pas fausser vos chiffres."
        };

      case 'expenses':
        return {
          title: 'Dépenses Réelles',
          subtitle: "L'argent qui sort",
          icon: ArrowUpRight,
          colorClass: 'text-rose-500 border-rose-500/30 bg-rose-500/10',
          badgeText: 'Sorties',
          badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
          whatIsIt: "C'est tout l'argent que vous avez réellement dépensé pour vivre ce mois-ci, réparti en deux parties :",
          details: [
            'Charges fixes : ' + formatCurrency(fixedAmount) + ' (Loyer, factures, abonnements, assurances)',
            'Dépenses courantes : ' + formatCurrency(variableAmount) + ' (Alimentation, loisirs, restos, shopping)'
          ],
          howToRead: 'Vous avez dépensé ' + formatCurrency(Math.abs(amount)) + ' au total ce mois-ci.',
          tip: "Important : Vos transferts vers votre propre épargne ne sont pas des dépenses, cet argent reste à vous."
        };

      case 'savings':
        return {
          title: 'Épargne & Placements',
          subtitle: "L'argent placé sur livrets dédiés",
          icon: ArrowLeftRight,
          colorClass: 'text-purple-500 border-purple-500/30 bg-purple-500/10',
          badgeText: 'Placements',
          badgeClass: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
          whatIsIt: "C'est l'argent que vous avez réellement déposé sur vos livrets d'épargne ou comptes de placement dédiés (Livret A, LDDS, LEP, Assurance-Vie, PEA...).",
          howToRead: amount > 0
            ? 'Vous avez placé ' + formatCurrency(amount) + " sur vos livrets d'épargne sur cette période."
            : "Vous n'avez pas encore placé d'argent sur un livret d'épargne dédié sur cette période (0,00 €). L'argent restant après vos dépenses constitue votre trésorerie disponible sur vos comptes courants.",
          tip: "Règle Option 1 : Les virements internes de gestion entre vos comptes courants propres (ex: Société Générale vers Fortuneo) ne sont pas de l'épargne, ce sont de simples transferts de trésorerie neutralisés."
        };

      case 'resteAVivre':
      default: {
        const isPositive = amount >= 0;
        return {
          title: 'Solde & Reste à Vivre',
          subtitle: 'Trésorerie réelle disponible',
          icon: Sparkles,
          colorClass: isPositive
            ? 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10'
            : 'text-rose-500 border-rose-500/30 bg-rose-500/10',
          badgeText: isPositive ? 'Solde Positif' : 'Déficit',
          badgeClass: isPositive
            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
            : 'bg-rose-500/15 text-rose-400 border-rose-500/30',
          whatIsIt: "Il y a deux indicateurs essentiels sur votre compte :",
          details: [
            "Solde Réel Bancaire : L'argent physique disponible sur votre compte après toutes vos opérations (Solde initial + flux net de la période).",
            "Flux net de la période : Revenus perçus MOINS Dépenses réelles de la période."
          ],
          howToRead: amount === 0
            ? "Aucune opération n'est enregistrée pour cette période."
            : isPositive
              ? 'Votre compte bancaire est créditeur de ' + formatCurrency(amount, { showSign: false }) + '. Vous disposez de cet argent en trésorerie réelle.'
              : 'Vos dépenses du mois ont excédé vos rentrées de ' + formatCurrency(Math.abs(amount), { showSign: false }) + '.',
          tip: "Explication de gestion : Le reste à vivre ou solde disponible correspond aux rentrées moins les sorties réelles, cumulé au solde de départ lorsque celui-ci est renseigné."
        };
      }
    }
  };

  const content = getContent();
  const Icon = content.icon;

  const tooltipBody = (
    <div className="text-left font-sans normal-case tracking-normal">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-border/60 dark:border-white/[0.08]">
        <div className="flex items-center gap-2">
          <div className={'p-1.5 rounded-xl border ' + content.colorClass}>
            <Icon className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground leading-tight">
              {content.title}
            </h4>
            <p className="text-[10px] text-muted-foreground font-normal">
              {content.subtitle}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={'text-[10px] font-bold px-2 py-0.5 rounded-full border ' + content.badgeClass}>
            {content.badgeText}
          </span>
          {isMobile && (
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* C'est quoi ? */}
      <div className="space-y-1 mb-2.5">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          En clair, c'est quoi ?
        </p>
        <p className="text-xs text-foreground/90 leading-relaxed font-normal">
          {content.whatIsIt}
        </p>
        {content.details && (
          <ul className="text-[11px] text-muted-foreground space-y-1 pl-2 border-l-2 border-primary/30 mt-1.5 font-normal">
            {content.details.map((d, i) => (
              <li key={i} className="leading-snug">{d}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Comment lire votre montant ? */}
      <div className="p-2.5 rounded-xl bg-secondary/50 dark:bg-white/[0.03] border border-border/60 mb-2">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
          Votre situation actuelle :
        </p>
        <p className="text-xs font-semibold text-foreground leading-relaxed">
          {content.howToRead}
        </p>
      </div>

      {/* Conseil */}
      <p className="text-[11px] text-muted-foreground/90 italic leading-snug font-normal">
        💡 {content.tip}
      </p>
    </div>
  );

  return (
    <>
      {/* Bouton icône (i) discret */}
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        onMouseEnter={() => {
          if (window.innerWidth >= 640) {
            updatePosition();
            setIsOpen(true);
          }
        }}
        className="p-1 rounded-lg text-muted-foreground/80 hover:text-foreground hover:bg-secondary/80 dark:hover:bg-white/[0.08] transition-all cursor-pointer inline-flex items-center justify-center focus:outline-none focus:ring-1 focus:ring-primary/40"
        title={'Comprendre ' + content.title}
        aria-label={'Comprendre ' + content.title}
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      {/* Rendu par React Portal directement dans document.body pour échapper à TOUT contexte d'empilement / débordement */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        isMobile ? (
          // Rendu Mobile : Centré avec backdrop élégant
          <div
            className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={() => setIsOpen(false)}
          >
            <div
              ref={tooltipRef}
              className="w-full max-w-sm p-4 rounded-2xl shadow-2xl bg-card dark:bg-[#10141e] border border-border/80 dark:border-white/10 text-foreground animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              {tooltipBody}
            </div>
          </div>
        ) : (
          // Rendu Desktop : Flottant précis ancré au bouton sans aucun chevauchement
          <div
            ref={tooltipRef}
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              zIndex: 999999,
              width: 330
            }}
            className="p-4 rounded-2xl shadow-2xl backdrop-blur-2xl bg-card/95 dark:bg-[#10141e]/95 border border-border/80 dark:border-white/15 text-foreground animate-in fade-in zoom-in-95 duration-150 select-text"
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
          >
            {tooltipBody}
          </div>
        ),
        document.body
      )}
    </>
  );
};
