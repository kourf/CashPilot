import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { 
  Sparkles, 
  Target, 
  ShieldCheck, 
  TrendingDown, 
  CheckCircle2, 
  ShoppingBag, 
  Info
} from 'lucide-react';

export default function Coach() {
  const [activeTab, setActiveTab] = useState<'conseils' | 'objectifs' | 'benchmarks'>('conseils');

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-28 md:pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Intelligence Artificielle & Finance
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mt-1 text-foreground flex items-center gap-2.5">
            Coach Financier CashPilot
            <span className="badge-cyan text-xs font-bold px-2.5 py-0.5 rounded-full">
              Gemini 2.0 Pro
            </span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Optimisation continue de votre pouvoir d'achat, détection des surcoûts et simulation de panier.
          </p>
        </div>

        {/* Tab Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-secondary/60 dark:bg-white/[0.04] border border-border/80 dark:border-white/[0.06]">
          <button
            onClick={() => setActiveTab('conseils')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'conseils' 
                ? 'bg-card text-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Conseils Clés
          </button>
          <button
            onClick={() => setActiveTab('objectifs')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'objectifs' 
                ? 'bg-card text-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Objectifs
          </button>
          <button
            onClick={() => setActiveTab('benchmarks')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'benchmarks' 
                ? 'bg-card text-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Repères France
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid md:grid-cols-3 gap-6">
        
        {/* Left 2 Columns */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Main AI Advice Spotlight Card */}
          <Card className="glass-card border-primary/40 bg-gradient-to-br from-primary/[0.06] via-transparent to-cyan-500/[0.06] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
            
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">Opportunité détectée</span>
                    <CardTitle className="text-base font-bold">Arbitrage Courses & Alimentation</CardTitle>
                  </div>
                </div>
                <span className="badge-jade text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <TrendingDown size={14} /> -45 € / mois
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs md:text-sm text-foreground/90 leading-relaxed">
                Ce mois-ci, vos dépenses d'épicerie et supermarché représentent <strong>28% de vos sorties totales</strong>. 
                Une analyse comparative des tickets de caisse montre que vos achats de produits de base chez <strong>Monoprix et Carrefour</strong> présentent un surcoût moyen de <strong>22%</strong> par rapport aux mêmes références chez <strong>Lidl et Leclerc</strong>.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-background/60 border border-border/60">
                  <span className="text-[10px] text-muted-foreground block">Panier Actuel</span>
                  <span className="text-sm font-bold text-foreground">385,00 € / mois</span>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block">Panier Optimisé</span>
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">340,00 € / mois</span>
                </div>
                <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-primary block">Gain Annuel</span>
                  <span className="text-sm font-bold text-primary">+540,00 €</span>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap gap-2.5">
                <Button size="sm" className="text-xs font-semibold shadow-sm">
                  <ShoppingBag size={14} className="mr-1.5" /> Comparer les articles
                </Button>
                <Button size="sm" variant="outline" className="text-xs font-semibold">
                  Simuler sur mon budget
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Objectives Card */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center">
                    <Target size={16} />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold">Objectifs de Trésorerie</CardTitle>
                    <CardDescription>Progression mensuelle basée sur vos règles de gestion</CardDescription>
                  </div>
                </div>
                <span className="text-xs font-semibold text-muted-foreground">Effort : Équilibré</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              
              <div className="p-3.5 rounded-xl bg-secondary/30 dark:bg-white/[0.02] border border-border/60 dark:border-white/[0.04] space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-foreground flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Rationalisation des abonnements
                  </span>
                  <span className="text-muted-foreground font-medium">2 / 3 résiliés</span>
                </div>
                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: '66%' }} />
                </div>
                <div className="flex justify-between text-[11px] text-muted-foreground pt-0.5">
                  <span>Économie actuelle : 24,00 € / mois</span>
                  <span className="text-amber-500 font-bold">66%</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-secondary/30 dark:bg-white/[0.02] border border-border/60 dark:border-white/[0.04] space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-foreground flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Coussin de sécurité (3 mois de charges)
                  </span>
                  <span className="text-emerald-500 font-bold flex items-center gap-1">
                    <CheckCircle2 size={13} /> Atteint
                  </span>
                </div>
                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: '100%' }} />
                </div>
                <div className="flex justify-between text-[11px] text-muted-foreground pt-0.5">
                  <span>Montant sécurisé : 3 500,00 €</span>
                  <span className="text-emerald-500 font-bold">100%</span>
                </div>
              </div>

            </CardContent>
          </Card>

        </div>

        {/* Right 1 Column (Benchmarks France) */}
        <div className="space-y-6">
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-emerald-500">
                <ShieldCheck size={18} />
                <CardTitle className="text-sm font-bold">Repères France</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Moyennes nationales de référence (INSEE & Banque de France 2025/2026)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3.5">
              
              <div className="p-3 rounded-xl bg-secondary/30 dark:bg-white/[0.02] border border-border/50 dark:border-white/[0.04] space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Alimentation & Courses</span>
                  <span className="font-bold text-foreground">385 € / mois</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-muted-foreground">Votre situation</span>
                  <span className="text-emerald-500 font-bold">Conforme</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-secondary/30 dark:bg-white/[0.02] border border-border/50 dark:border-white/[0.04] space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Logement & Charges</span>
                  <span className="font-bold text-foreground">650 € / mois</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-muted-foreground">Taux d'effort max</span>
                  <span className="text-foreground font-semibold">33% des revenus</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-secondary/30 dark:bg-white/[0.02] border border-border/50 dark:border-white/[0.04] space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Taux d'épargne moyen</span>
                  <span className="font-bold text-primary">15% à 18%</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-muted-foreground">Recommandation</span>
                  <span className="text-primary font-bold">Épargne automatique</span>
                </div>
              </div>

              <div className="pt-2 text-[10px] text-muted-foreground leading-relaxed flex items-start gap-1.5">
                <Info size={12} className="shrink-0 mt-0.5 text-muted-foreground/80" />
                <span>Ces repères vous permettent de vous situer objectivement et d'éviter les dérives budgétaires silencieuses.</span>
              </div>

            </CardContent>
          </Card>
        </div>

      </div>

    </div>
  );
}
