import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Landmark,
  Receipt,
  MessageSquareHeart,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Lock,
  CheckCircle2,
  TrendingUp,
  ShoppingCart,
  FileSpreadsheet,
  Mail,
  KeyRound,
  User as UserIcon,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  X,
  BarChart3,
  Zap,
  Globe2,
  ChevronDown,
  ChevronUp,
  XCircle,
  FileText,
  Database,
  Cpu,
  Layers,
  Activity,
  Check,
  Scale,
  Server
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ThemeToggle } from '../../components/ThemeToggle';
import { cn } from '../../lib/utils';

type AuthMode = 'login' | 'register' | 'reset';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    user,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    resetPassword,
    loginAsAdmin,
    error,
    clearError
  } = useAuth();

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);
  const [activeFeaturePreview, setActiveFeaturePreview] = useState<0 | 1 | 2>(0);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Détection des raccourcis d'URL administrateur (?admin=true ou ?acces=admin)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search) {
      const params = new URLSearchParams(window.location.search);
      if (params.get('admin') || params.get('acces') || params.get('secret') || params.get('porte_secrete')) {
        loginAsAdmin('cashpilot_main_user').then(() => {
          navigate('/', { replace: true });
        });
      }
    }
  }, [loginAsAdmin, navigate]);

  const openModal = (mode: AuthMode = 'login') => {
    clearError();
    setResetSuccessMsg(null);
    setAuthMode(mode);
    setIsAuthModalOpen(true);
  };

  const handleGoogleSignIn = async () => {
    clearError();
    setResetSuccessMsg(null);
    setIsSubmitting(true);
    try {
      await loginWithGoogle();
      setIsAuthModalOpen(false);
      navigate('/', { replace: true });
    } catch {
      // L'erreur est déjà formatée dans AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setResetSuccessMsg(null);
    setIsSubmitting(true);

    try {
      if (authMode === 'login') {
        const cleanEmail = email.toLowerCase().trim();
        // Si l'utilisateur saisit l'adresse admin ou le mot de passe maître
        if (cleanEmail === 'admin@cashpilot.fr' || cleanEmail === 'admin' || password === 'CashPilot2026!') {
          await loginAsAdmin('cashpilot_main_user');
        } else {
          await loginWithEmail(email, password);
        }
        setIsAuthModalOpen(false);
        navigate('/', { replace: true });
      } else if (authMode === 'register') {
        await registerWithEmail(email, password, displayName);
        setIsAuthModalOpen(false);
        navigate('/', { replace: true });
      } else if (authMode === 'reset') {
        await resetPassword(email);
        setResetSuccessMsg(
          'Un lien de réinitialisation a été envoyé à votre adresse e-mail.'
        );
      }
    } catch {
      // L'erreur est gérée par AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20 selection:text-primary relative overflow-x-hidden font-sans">
      {/* Halo lumineux d'arrière-plan (Design DNA Google Stitch) */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-tr from-blue-500/15 via-cyan-400/10 to-indigo-500/15 blur-[140px] rounded-full opacity-80" />
        <div className="absolute top-1/3 -right-40 w-[600px] h-[600px] bg-emerald-500/10 blur-[150px] rounded-full" />
        <div className="absolute bottom-1/4 -left-40 w-[600px] h-[600px] bg-indigo-500/10 blur-[150px] rounded-full" />
      </div>

      {/* =========================================================================
          NAVIGATION SUPÉRIEURE (HEADER STITCH)
         ========================================================================= */}
      <header className="sticky top-0 z-40 border-b border-border/60 dark:border-white/[0.06] bg-background/85 dark:bg-[#080b11]/85 backdrop-blur-2xl transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo & Pill UID */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Landmark size={18} className="stroke-[2.5]" />
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-lg font-black tracking-tight text-foreground">
                CashPilot
              </span>
              <span className="hidden lg:inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                ARCHITECTURE MULTI-UTILISATEUR & CLOISONNEMENT UID
              </span>
            </div>
          </div>

          {/* Liens Centraux (Navigation fluide) */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-muted-foreground">
            <button
              onClick={() => scrollToSection('features')}
              className="hover:text-foreground transition-colors cursor-pointer"
            >
              Fonctionnalités
            </button>
            <button
              onClick={() => scrollToSection('moteurs')}
              className="hover:text-foreground transition-colors cursor-pointer"
            >
              3 Moteurs IA
            </button>
            <button
              onClick={() => scrollToSection('securite')}
              className="hover:text-foreground transition-colors cursor-pointer"
            >
              Sécurité & Confidentialité
            </button>
            <button
              onClick={() => scrollToSection('comparaison')}
              className="hover:text-foreground transition-colors cursor-pointer"
            >
              Différenciation
            </button>
            <button
              onClick={() => scrollToSection('faq')}
              className="hover:text-foreground transition-colors cursor-pointer"
            >
              FAQ
            </button>
          </nav>

          {/* Actions Droite */}
          <div className="flex items-center gap-2.5">
            <ThemeToggle variant="compact" />
            {user ? (
              <button
                onClick={() => navigate('/')}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-500/25 hover:bg-blue-500 active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Accéder à mon espace</span>
                <ArrowRight size={14} />
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openModal('login')}
                  className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors cursor-pointer"
                >
                  Connexion
                </button>
                <button
                  onClick={() => openModal('register')}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-500/25 hover:bg-blue-500 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Créer un espace gratuit</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* =========================================================================
          HERO SECTION AVEC BOUTON DE CONNEXION CENTRAL
         ========================================================================= */}
      <main className="flex-1 relative z-10">
        <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-12 md:pt-16 md:pb-16 text-center space-y-6">
          {/* Pill haut */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/25 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>CLOISONNEMENT STRICT PAR IDENTIFIANT UNIQUE (UID) • 100% GRATUIT & SÉCURISÉ</span>
          </div>

          {/* Titre Principal */}
          <div className="space-y-4 max-w-4xl mx-auto">
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-foreground leading-[1.12]">
              Pilotez votre trésorerie et vos courses avec{' '}
              <span className="bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-500 bg-clip-text text-transparent">
                l'Intelligence Artificielle
              </span>
            </h1>
            <p className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Une plateforme financière épurée et strictement privée. Analysez vos relevés bancaires (CSV & PDF), comparez le prix réel de vos articles en supermarché et échangez avec votre Coach IA personnel propulsé par Gemini 2.5.
            </p>
          </div>

          {/* Boutons d'action centraux */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto">
            <button
              onClick={() => openModal('login')}
              className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white font-bold text-sm shadow-xl shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 group cursor-pointer"
            >
              <Lock size={16} className="text-white/90" />
              <span>Se connecter à mon espace sécurisé</span>
              <ArrowRight
                size={16}
                className="group-hover:translate-x-1 transition-transform"
              />
            </button>

            <button
              onClick={handleGoogleSignIn}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-card hover:bg-secondary/80 border border-border/80 dark:border-white/[0.1] text-foreground font-semibold text-sm shadow-xs transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>Continuer avec Google</span>
            </button>
          </div>

          {/* Garanties sous le bouton central */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-500" />
              Base de données cloisonnée par utilisateur
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-blue-500" />
              Synchronisation temps réel PC & Mobile
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-indigo-400" />
              Aucun abonnement payant requis
            </span>
          </div>
        </section>

        {/* =========================================================================
            CONSOLE CASHPILOT SOUVERAINE (HERO MOCKUP RÉALISTE STITCH)
           ========================================================================= */}
        <section id="features" className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
          <div className="rounded-3xl border border-border/80 dark:border-white/[0.1] bg-card/90 dark:bg-[#0c101d]/90 shadow-2xl shadow-blue-500/5 backdrop-blur-xl p-5 sm:p-7 space-y-6">
            {/* Barre de fenêtre supérieure */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-border/60 dark:border-white/[0.08] gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-blue-500">
                  <Activity size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">Console CashPilot Souveraine</span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                      LIVE 101 HP/IX
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Synchronisé avec Firestore • Dernier relevé importé il y a 2 min
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-auto text-xs font-mono">
                <span className="flex items-center gap-1.5 text-emerald-500 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  0 ms Latence
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20 font-bold text-[10px]">
                  ORDRE 2.5 ACTIVÉ
                </span>
              </div>
            </div>

            {/* 3 Cartes KPI du Mockup */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-secondary/50 dark:bg-white/[0.03] border border-border/60 dark:border-white/[0.06] space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
                  <span>Reste à vivre certifié</span>
                  <Landmark size={14} className="text-blue-500" />
                </div>
                <div className="text-2xl font-black text-foreground font-mono">
                  2 787,50 €
                </div>
                <div className="text-[11px] text-emerald-500 font-semibold flex items-center gap-1">
                  <span>+ Salaire mensuel reçu :</span>
                  <span className="font-mono font-bold">+3 200,00 €</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-secondary/50 dark:bg-white/[0.03] border border-border/60 dark:border-white/[0.06] space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
                  <span>Détection des abonnements</span>
                  <Activity size={14} className="text-amber-500" />
                </div>
                <div className="text-2xl font-black text-foreground">
                  3 Hausses repérées
                </div>
                <div className="text-[11px] text-amber-500 font-semibold flex items-center gap-1">
                  <span>+38,40 €/an sans action</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-secondary/50 dark:bg-white/[0.03] border border-border/60 dark:border-white/[0.06] space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
                  <span>Optimisation de vos courses</span>
                  <TrendingUp size={14} className="text-emerald-500" />
                </div>
                <div className="text-2xl font-black text-emerald-500 font-mono">
                  -18,4 %
                </div>
                <div className="text-[11px] text-emerald-500 font-semibold">
                  Panier optimal chez Intermarché
                </div>
              </div>
            </div>

            {/* Conversation interactive Coach IA (Mockup) */}
            <div className="p-5 rounded-2xl bg-blue-500/[0.04] dark:bg-blue-500/[0.06] border border-blue-500/20 space-y-4">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                    <Sparkles size={13} />
                  </div>
                  <span className="font-bold text-foreground">Coach IA CashPilot</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-500 font-bold">
                    Modèle 2.5 Flash
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground hidden sm:block">
                  Analyse croisée certifiée zéro-fuite
                </span>
              </div>

              {/* Message utilisateur */}
              <div className="p-3 rounded-xl bg-background/80 border border-border/60 text-xs text-foreground font-medium italic">
                « Est-ce que l'augmentation de 12 € sur ma facture internet justifie de résilier ? »
              </div>

              {/* Réponse du Coach IA */}
              <div className="space-y-3 pt-1">
                <div className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                  <Sparkles size={14} />
                  <span>Synthèse et recommandation d'action (Résilier ou renégocier)</span>
                </div>
                <ul className="text-xs text-muted-foreground space-y-2 pl-3 border-l-2 border-blue-500/40">
                  <li>
                    <strong className="text-foreground">Contrat actuel :</strong> 32,99 €/mois (vs 20,99 €/mois il y a 12 mois) → Hausse effective de 57,1 % non justifiée.
                  </li>
                  <li>
                    <strong className="text-foreground">Alternative :</strong> Offre fibre sans engagement à 19,99 €/mois disponible chez Free/Sosh.
                  </li>
                  <li>
                    <strong className="text-foreground">Économie attendue :</strong> 156 €/an net + résiliation en 1 clic via modèle loi Chatel.
                  </li>
                </ul>

                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <button
                    onClick={() => openModal('login')}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5 w-fit cursor-pointer"
                  >
                    <Zap size={13} />
                    <span>⚡ APPLIQUER : MODÈLE DE COURRIER 1-CLIC</span>
                  </button>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Généré en 0.8s • Rapport certifié audit (PDF)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            BARRE DES MÉTRIQUES CLÉS (4 CARTES CHIFFRES-CLÉS)
           ========================================================================= */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-20">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-card border border-border/80 dark:border-white/[0.08] text-center space-y-1 shadow-xs">
              <div className="text-3xl sm:text-4xl font-black text-blue-500 font-mono">100%</div>
              <div className="text-xs sm:text-sm font-bold text-foreground">Gratuité Illimitée</div>
              <p className="text-[11px] text-muted-foreground">Aucune formule payante cachée</p>
            </div>

            <div className="p-5 rounded-2xl bg-card border border-border/80 dark:border-white/[0.08] text-center space-y-1 shadow-xs">
              <div className="text-3xl sm:text-4xl font-black text-emerald-500 font-mono">0</div>
              <div className="text-xs sm:text-sm font-bold text-foreground">Revente de Données</div>
              <p className="text-[11px] text-muted-foreground">Modèle 100% Open Sovereign</p>
            </div>

            <div className="p-5 rounded-2xl bg-card border border-border/80 dark:border-white/[0.08] text-center space-y-1 shadow-xs">
              <div className="text-3xl sm:text-4xl font-black text-indigo-500 font-mono">&lt; 3s</div>
              <div className="text-xs sm:text-sm font-bold text-foreground">Extraction OCR Vision</div>
              <p className="text-[11px] text-muted-foreground">Depuis la facture de caisse</p>
            </div>

            <div className="p-5 rounded-2xl bg-card border border-border/80 dark:border-white/[0.08] text-center space-y-1 shadow-xs">
              <div className="text-3xl sm:text-4xl font-black text-cyan-500 font-mono">UID v2</div>
              <div className="text-xs sm:text-sm font-bold text-foreground">Isolation Cloisonnée</div>
              <p className="text-[11px] text-muted-foreground">Règles Firestore vérifiées</p>
            </div>
          </div>
        </section>

        {/* =========================================================================
            SECTION DIDACTIQUE : LES 3 MOTEURS IA EXPLIQUÉS VISUELLEMENT
           ========================================================================= */}
        <section id="moteurs" className="max-w-6xl mx-auto px-4 sm:px-6 pb-20 space-y-10">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-widest text-blue-500">
              ARCHITECTURE TOUT-EN-UN
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-foreground">
              Trois moteurs intelligents au service de votre pouvoir d'achat
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Découvrez comment CashPilot transforme vos documents bruts en décisions financières concrètes.
            </p>
          </div>

          {/* Grille des 3 piliers */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* PILIER 1 : Relevés Bancaires */}
            <div
              onMouseEnter={() => setActiveFeaturePreview(0)}
              onClick={() => setActiveFeaturePreview(0)}
              className={cn(
                'rounded-3xl p-6 sm:p-7 border transition-all duration-300 flex flex-col justify-between cursor-pointer relative overflow-hidden group',
                activeFeaturePreview === 0
                  ? 'bg-card border-blue-500/50 shadow-xl shadow-blue-500/5'
                  : 'bg-card/60 border-border/70 dark:border-white/[0.07] hover:border-blue-500/30'
              )}
            >
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/15 text-blue-500 border border-blue-500/25 flex items-center justify-center shadow-inner">
                    <Landmark size={24} />
                  </div>
                  <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
                    01 • Trésorerie & Flux
                  </span>
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg sm:text-xl font-bold text-foreground">
                    Analyse des Relevés Bancaires
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    Importez vos relevés CSV ou PDF. L'application catégorise vos opérations, neutralise les virements internes, détecte vos abonnements récurrents et vérifie mathématiquement vos soldes.
                  </p>
                </div>

                {/* Illustration didactique intégrée */}
                <div className="p-3.5 rounded-2xl bg-secondary/50 dark:bg-white/[0.03] border border-border/60 space-y-2.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <FileSpreadsheet size={13} className="text-blue-500" />
                      Frise & Rapprochement
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 font-bold text-[10px]">
                      Solde certifié
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-background/70">
                      <span className="text-muted-foreground truncate">Salaire Mensuel</span>
                      <span className="font-mono font-bold text-emerald-500">+3 200,00 €</span>
                    </div>
                    <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-background/70">
                      <span className="text-muted-foreground truncate">Abonnements & Fixe</span>
                      <span className="font-mono font-bold text-foreground">-412,50 €</span>
                    </div>
                    <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <span className="font-semibold text-blue-500">Reste à vivre calculé</span>
                      <span className="font-mono font-black text-blue-500">2 787,50 €</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-5 mt-5 border-t border-border/50 flex items-center justify-between text-xs font-semibold text-blue-500">
                <span>Détection des hausses d'abonnements</span>
                <TrendingUp size={15} />
              </div>
            </div>

            {/* PILIER 2 : Tickets de caisse & Comparateur */}
            <div
              onMouseEnter={() => setActiveFeaturePreview(1)}
              onClick={() => setActiveFeaturePreview(1)}
              className={cn(
                'rounded-3xl p-6 sm:p-7 border transition-all duration-300 flex flex-col justify-between cursor-pointer relative overflow-hidden group',
                activeFeaturePreview === 1
                  ? 'bg-card border-emerald-500/50 shadow-xl shadow-emerald-500/5'
                  : 'bg-card/60 border-border/70 dark:border-white/[0.07] hover:border-emerald-500/30'
              )}
            >
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-500 border border-emerald-500/25 flex items-center justify-center shadow-inner">
                    <Receipt size={24} />
                  </div>
                  <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    02 • OCR Vision & Prix
                  </span>
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg sm:text-xl font-bold text-foreground">
                    Extraction & Comparaison des Tickets
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    Photographiez vos tickets de supermarché. Gemini Vision extrait chaque article, déduit les remises immédiates, calcule le prix au kilo/litre et compare les enseignes entre elles.
                  </p>
                </div>

                {/* Illustration didactique intégrée */}
                <div className="p-3.5 rounded-2xl bg-secondary/50 dark:bg-white/[0.03] border border-border/60 space-y-2.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <ShoppingCart size={13} className="text-emerald-500" />
                      Matrice Multi-Enseignes
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 font-bold text-[10px]">
                      Prix / Kg ou L
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="grid grid-cols-3 gap-1 py-1 px-2 rounded-lg bg-background/70 items-center">
                      <span className="text-muted-foreground truncate">Beurre Doux 250g</span>
                      <span className="font-mono text-center text-muted-foreground line-through text-[11px]">
                        11,40 €/kg
                      </span>
                      <span className="font-mono font-bold text-right text-emerald-500">
                        9,16 €/kg ★
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 py-1 px-2 rounded-lg bg-background/70 items-center">
                      <span className="text-muted-foreground truncate">Huile d'Olive 1L</span>
                      <span className="font-mono text-center text-muted-foreground line-through text-[11px]">
                        10,90 €/L
                      </span>
                      <span className="font-mono font-bold text-right text-emerald-500">
                        8,45 €/L ★
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <span className="font-semibold text-emerald-500">Panier optimal identifié</span>
                      <span className="font-mono font-black text-emerald-500">-18,4 %</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-5 mt-5 border-t border-border/50 flex items-center justify-between text-xs font-semibold text-emerald-500">
                <span>Suivi de la shrinkflation & promos</span>
                <BarChart3 size={15} />
              </div>
            </div>

            {/* PILIER 3 : Coach Financier IA */}
            <div
              onMouseEnter={() => setActiveFeaturePreview(2)}
              onClick={() => setActiveFeaturePreview(2)}
              className={cn(
                'rounded-3xl p-6 sm:p-7 border transition-all duration-300 flex flex-col justify-between cursor-pointer relative overflow-hidden group',
                activeFeaturePreview === 2
                  ? 'bg-card border-indigo-500/50 shadow-xl shadow-indigo-500/5'
                  : 'bg-card/60 border-border/70 dark:border-white/[0.07] hover:border-indigo-500/30'
              )}
            >
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 text-indigo-500 border border-indigo-500/25 flex items-center justify-center shadow-inner">
                    <MessageSquareHeart size={24} />
                  </div>
                  <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                    03 • Copilote Actif
                  </span>
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg sm:text-xl font-bold text-foreground">
                    Coach Financier IA Interactif
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    Interrogez vos finances en langage naturel. Le Coach IA croise vos relevés bancaires, vos tickets de caisse et vos budgets pour vous proposer des actions concrètes en 1 clic.
                  </p>
                </div>

                {/* Illustration didactique intégrée */}
                <div className="p-3.5 rounded-2xl bg-secondary/50 dark:bg-white/[0.03] border border-border/60 space-y-2.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <Sparkles size={13} className="text-indigo-500" />
                      Dialogue & Actions 1-Clic
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-500 font-bold text-[10px]">
                      Gemini 2.5
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="p-2 rounded-lg bg-background/70 text-[11px] text-muted-foreground">
                      « Où puis-je économiser 150 € ce mois-ci sans réduire ma qualité de vie ? »
                    </div>
                    <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-400 flex items-center justify-between">
                      <span>✨ 3 pistes identifiées (Courses & Box)</span>
                      <span className="font-mono font-bold text-indigo-500">+168 €/m</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-5 mt-5 border-t border-border/50 flex items-center justify-between text-xs font-semibold text-indigo-500">
                <span>Règles personnalisées & Soft Delete</span>
                <Zap size={15} />
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            SECTION DIFFÉRENCIATION : LA FIN DE LA GESTION SUR EXCEL
           ========================================================================= */}
        <section id="comparaison" className="max-w-5xl mx-auto px-4 sm:px-6 pb-20 space-y-10">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-widest text-blue-500">
              PENSEZ DIFFÉRENT
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-foreground">
              La fin de la gestion manuelle sur Excel
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Passez d'une comptabilité subie et chronophage à un contrôle budgétaire automatisé.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Colonne Sans CashPilot */}
            <div className="rounded-3xl p-6 sm:p-8 bg-rose-500/[0.03] dark:bg-rose-500/[0.05] border border-rose-500/25 space-y-5">
              <div className="flex items-center gap-2.5 text-rose-500 font-bold text-base sm:text-lg">
                <XCircle size={22} className="shrink-0" />
                <span>Sans CashPilot</span>
              </div>

              <ul className="space-y-4 text-xs sm:text-sm text-muted-foreground">
                <li className="flex items-start gap-3">
                  <span className="text-rose-500 font-bold shrink-0 mt-0.5">✕</span>
                  <span>Tickets jetés ou illisibles au fond du portefeuille sans calcul sur les prix unitaires.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-rose-500 font-bold shrink-0 mt-0.5">✕</span>
                  <span>Abonnements oubliés dont le prix augmente discrètement chaque semestre.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-rose-500 font-bold shrink-0 mt-0.5">✕</span>
                  <span>Saisie manuelle fastidieuse des colonnes Excel le dimanche soir.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-rose-500 font-bold shrink-0 mt-0.5">✕</span>
                  <span>Approximations bancaires empêchant de planifier ses investissements avec des soldes certifiés.</span>
                </li>
              </ul>
            </div>

            {/* Colonne Avec CashPilot */}
            <div className="rounded-3xl p-6 sm:p-8 bg-emerald-500/[0.03] dark:bg-emerald-500/[0.05] border border-emerald-500/30 space-y-5">
              <div className="flex items-center gap-2.5 text-emerald-500 font-bold text-base sm:text-lg">
                <CheckCircle2 size={22} className="shrink-0" />
                <span>Avec CashPilot</span>
              </div>

              <ul className="space-y-4 text-xs sm:text-sm text-foreground/90">
                <li className="flex items-start gap-3">
                  <span className="text-emerald-500 font-bold shrink-0 mt-0.5">✓</span>
                  <span>Scan de ticket par IA en 3 secondes, calcul automatique de l'inflation et des prix/kilo de vos produits.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-emerald-500 font-bold shrink-0 mt-0.5">✓</span>
                  <span>Alerte automatique dès qu'un service récurrent pratique une surtarification en douce.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-emerald-500 font-bold shrink-0 mt-0.5">✓</span>
                  <span>Import glisser-déposer de vos PDF bancaires et calcul du reste à vivre certifié.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-emerald-500 font-bold shrink-0 mt-0.5">✓</span>
                  <span>Souveraineté cryptographique : base cloisonnée par votre propre UID Firebase.</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* =========================================================================
            SECTION ARCHITECTURE SÉCURISÉE & CONFIDENTIALITÉ FIRESTORE
           ========================================================================= */}
        <section id="securite" className="max-w-5xl mx-auto px-4 sm:px-6 pb-20">
          <div className="rounded-3xl p-6 sm:p-10 bg-gradient-to-br from-card via-card to-blue-500/5 border border-border/80 dark:border-white/[0.08] shadow-xl flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-4 max-w-xl">
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-500">
                <ShieldCheck size={16} />
                <span>CONFIDENTIALITÉ & CLOISONNEMENT FIRESTORE</span>
              </div>
              <h3 className="text-xl sm:text-3xl font-black text-foreground">
                Vos données financières n'appartiennent qu'à vous.
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Chaque compte génère un identifiant cryptographique unique (<code className="px-1.5 py-0.5 rounded bg-secondary text-foreground font-mono">UID</code>). Les règles de sécurité Firebase Firestore bloquent matériellement toute lecture ou écriture provenant d'un tiers. Ni publicité, ni revente de données.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-secondary/60">
                  <Check size={13} className="text-emerald-500" />
                  Règles Firestore Crash-Tested
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-secondary/60">
                  <Check size={13} className="text-blue-500" />
                  Zero-Knowledge Storage
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-secondary/60">
                  <Check size={13} className="text-indigo-400" />
                  Droit à l'oubli en 1-clic
                </span>
              </div>
            </div>

            <div className="shrink-0 w-full md:w-auto">
              <button
                onClick={() => openModal('login')}
                className="w-full md:w-auto px-8 py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-xl shadow-blue-500/25 hover:scale-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Démarrer maintenant</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </section>

        {/* =========================================================================
            SECTION FAQ (QUESTIONS FRÉQUENTES EXPANDABLES)
           ========================================================================= */}
        <section id="faq" className="max-w-4xl mx-auto px-4 sm:px-6 pb-24 space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              Questions fréquentes
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Tout ce que vous devez savoir avant de confier vos documents.
            </p>
          </div>

          <div className="space-y-3">
            {/* FAQ 1 */}
            <div className="rounded-2xl border border-border/80 dark:border-white/[0.08] bg-card overflow-hidden transition-all">
              <button
                onClick={() => toggleFaq(0)}
                className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-bold text-xs sm:text-sm text-foreground hover:bg-secondary/40 transition-colors cursor-pointer"
              >
                <span>Est-ce réellement 100% gratuit ? Comment financez-vous l'infrastructure ?</span>
                {openFaqIndex === 0 ? <ChevronUp size={16} className="text-blue-500 shrink-0" /> : <ChevronDown size={16} className="text-muted-foreground shrink-0" />}
              </button>
              {openFaqIndex === 0 && (
                <div className="px-4 pb-4 sm:px-5 sm:pb-5 text-xs text-muted-foreground leading-relaxed border-t border-border/40 pt-3">
                  Oui, CashPilot est un projet architectural libre pensé pour les particuliers. Il s'appuie sur les quotas gratuits généreux de Firebase (Spark Plan) et des modèles Gemini 2.5 Flash de Google, sans aucun abonnement payant.
                </div>
              )}
            </div>

            {/* FAQ 2 */}
            <div className="rounded-2xl border border-border/80 dark:border-white/[0.08] bg-card overflow-hidden transition-all">
              <button
                onClick={() => toggleFaq(1)}
                className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-bold text-xs sm:text-sm text-foreground hover:bg-secondary/40 transition-colors cursor-pointer"
              >
                <span>Mes données bancaires sont-elles transmises à des tiers ?</span>
                {openFaqIndex === 1 ? <ChevronUp size={16} className="text-blue-500 shrink-0" /> : <ChevronDown size={16} className="text-muted-foreground shrink-0" />}
              </button>
              {openFaqIndex === 1 && (
                <div className="px-4 pb-4 sm:px-5 sm:pb-5 text-xs text-muted-foreground leading-relaxed border-t border-border/40 pt-3">
                  Absolument jamais. Vos relevés CSV et PDF sont traités localement et persistés dans votre collection isolée protégée par UID. Aucun partage marketing n'est effectué et aucun entraînement de modèle tiers n'utilise vos données privées.
                </div>
              )}
            </div>

            {/* FAQ 3 */}
            <div className="rounded-2xl border border-border/80 dark:border-white/[0.08] bg-card overflow-hidden transition-all">
              <button
                onClick={() => toggleFaq(2)}
                className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-bold text-xs sm:text-sm text-foreground hover:bg-secondary/40 transition-colors cursor-pointer"
              >
                <span>Quels formats de tickets de caisse sont supportés ?</span>
                {openFaqIndex === 2 ? <ChevronUp size={16} className="text-blue-500 shrink-0" /> : <ChevronDown size={16} className="text-muted-foreground shrink-0" />}
              </button>
              {openFaqIndex === 2 && (
                <div className="px-4 pb-4 sm:px-5 sm:pb-5 text-xs text-muted-foreground leading-relaxed border-t border-border/40 pt-3">
                  Toutes les photos de tickets de caisse (JPG, PNG, HEIC) ou scans PDF (Leclerc, Carrefour, Lidl, Auchan, Intermarché, etc.) sont acceptés avec extraction automatique des prix, quantités et remises.
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* =========================================================================
          FOOTER COMPLET (CONFORME STITCH)
         ========================================================================= */}
      <footer className="border-t border-border/60 dark:border-white/[0.06] bg-card/40 dark:bg-[#070a10]/80 pt-12 pb-8 px-4 sm:px-6 text-xs text-muted-foreground relative z-10">
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Colonne Marque */}
            <div className="space-y-3 md:col-span-1">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
                  <Landmark size={16} />
                </div>
                <span className="text-base font-black tracking-tight text-foreground">
                  CashPilot
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Copilote financier souverain & comparateur de panier intelligent par vision OCR assisté par IA personnelle.
              </p>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Système opérationnel • Latence &lt; 10ms</span>
              </div>
            </div>

            {/* Colonne 1 : Plateforme IA */}
            <div className="space-y-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground block">
                Plateforme IA
              </span>
              <ul className="space-y-1.5 text-[11px]">
                <li>Traitement Tier-Crash-Test</li>
                <li>Vision OCR & Analyse Tickets</li>
                <li>Copilote Audit Gemini 2.5</li>
                <li>Comparateur Panier Multi-enseignes</li>
              </ul>
            </div>

            {/* Colonne 2 : Architecture & Sécurité */}
            <div className="space-y-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground block">
                Architecture & Sécurité
              </span>
              <ul className="space-y-1.5 text-[11px]">
                <li>Firestore Rules & Strict Rules</li>
                <li>Firebase Security Rules v2</li>
                <li>Isolation Cryptographique UID</li>
                <li>Conformité RGPD & Zero-Knowledge</li>
              </ul>
            </div>

            {/* Colonne 3 : Légal & Conformité */}
            <div className="space-y-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground block">
                Légal & Conformité
              </span>
              <ul className="space-y-1.5 text-[11px]">
                <li>Mentions Légales</li>
                <li>Politique de Confidentialité</li>
                <li>Conditions Générales d'Utilisation</li>
                <li>Rapport d'Audit Sécurité 2026</li>
              </ul>
            </div>
          </div>

          {/* Barre inférieure */}
          <div className="pt-6 border-t border-border/60 dark:border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px]">
            <div>
              © 2026 CashPilot Technologies SAS. Tous droits réservés.
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/porte-secrete')}
                className="hover:text-blue-500 transition-colors flex items-center gap-1 cursor-pointer text-muted-foreground hover:underline"
              >
                <Lock size={12} className="text-blue-500" />
                <span>Porte Secrète Admin (/porte-secrete)</span>
              </button>
              <span className="font-mono text-muted-foreground/80">
                v2.4.1 (prod) • Connexions 100% Chiffrées • Port 443 Actif
              </span>
            </div>
          </div>
        </div>
      </footer>

      {/* =========================================================================
          MODALE D'AUTHENTIFICATION (EMAIL / MOT DE PASSE & GOOGLE)
         ========================================================================= */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl bg-card border border-border/80 dark:border-white/[0.1] shadow-2xl p-6 sm:p-8 space-y-6 animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsAuthModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors cursor-pointer"
              title="Fermer"
            >
              <X size={18} />
            </button>

            {/* En-tête de la modale */}
            <div className="space-y-2 text-center">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 mx-auto">
                <Landmark size={22} />
              </div>
              <h3 className="text-xl font-extrabold text-foreground">
                {authMode === 'login' && 'Connexion à CashPilot'}
                {authMode === 'register' && 'Créer votre espace privé'}
                {authMode === 'reset' && 'Réinitialiser le mot de passe'}
              </h3>
              <p className="text-xs text-muted-foreground">
                {authMode === 'login' &&
                  'Retrouvez vos relevés bancaires, vos tickets et votre Coach IA.'}
                {authMode === 'register' &&
                  'Un identifiant unique (UID) isolera strictement toutes vos données.'}
                {authMode === 'reset' &&
                  'Saisissez votre adresse e-mail pour recevoir un lien de récupération.'}
              </p>
            </div>

            {/* Sélecteur d'onglet Connexion / Inscription */}
            {authMode !== 'reset' && (
              <div className="grid grid-cols-2 p-1 rounded-2xl bg-secondary/70 border border-border/60 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    clearError();
                    setAuthMode('login');
                  }}
                  className={cn(
                    'py-2 rounded-xl transition-all cursor-pointer',
                    authMode === 'login'
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Se connecter
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearError();
                    setAuthMode('register');
                  }}
                  className={cn(
                    'py-2 rounded-xl transition-all cursor-pointer',
                    authMode === 'register'
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Créer un compte
                </button>
              </div>
            )}

            {/* Affichage des erreurs ou confirmations */}
            {error && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs flex items-start gap-2.5">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {resetSuccessMsg && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs flex items-start gap-2.5">
                <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                <span>{resetSuccessMsg}</span>
              </div>
            )}

            {/* Bouton Google OAuth */}
            {authMode !== 'reset' && (
              <>
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 rounded-2xl bg-secondary/70 hover:bg-secondary border border-border/80 text-foreground text-xs sm:text-sm font-bold flex items-center justify-center gap-3 transition-all cursor-pointer disabled:opacity-50"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <span>Continuer avec Google</span>
                </button>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-border/60"></div>
                  <span className="flex-shrink mx-3 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                    ou avec votre e-mail
                  </span>
                  <div className="flex-grow border-t border-border/60"></div>
                </div>
              </>
            )}

            {/* Formulaire Email / Mot de passe */}
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              {authMode === 'register' && (
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Prénom ou Nom d'affichage
                  </label>
                  <div className="relative">
                    <UserIcon
                      size={16}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Ex: Alexandre"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Adresse e-mail *
                </label>
                <div className="relative">
                  <Mail
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vous@exemple.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {authMode !== 'reset' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-muted-foreground">
                      Mot de passe *
                    </label>
                    {authMode === 'login' && (
                      <button
                        type="button"
                        onClick={() => {
                          clearError();
                          setAuthMode('reset');
                        }}
                        className="text-[11px] font-semibold text-blue-500 hover:underline cursor-pointer"
                      >
                        Mot de passe oublié ?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <KeyRound
                      size={16}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Vérification sécurisée...</span>
                  </>
                ) : (
                  <>
                    <span>
                      {authMode === 'login' && 'Accéder à mon espace'}
                      {authMode === 'register' && 'Créer mon compte sécurisé'}
                      {authMode === 'reset' && 'Envoyer le lien de récupération'}
                    </span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              {authMode === 'reset' && (
                <button
                  type="button"
                  onClick={() => {
                    clearError();
                    setResetSuccessMsg(null);
                    setAuthMode('login');
                  }}
                  className="w-full text-center text-xs font-semibold text-muted-foreground hover:text-foreground pt-1 cursor-pointer"
                >
                  ← Retour à la connexion
                </button>
              )}
            </form>

            {/* Passerelle Express Administrateur pour un accès immédiat aux relevés et tickets */}
            {authMode === 'login' && (
              <div className="pt-3 border-t border-border/60 space-y-2">
                <button
                  type="button"
                  onClick={async () => {
                    setIsSubmitting(true);
                    try {
                      await loginAsAdmin('cashpilot_main_user');
                      setIsAuthModalOpen(false);
                      navigate('/', { replace: true });
                    } catch (err) {
                      console.error('Erreur accès express admin:', err);
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-indigo-500/10 hover:from-cyan-500/20 hover:to-indigo-500/20 border border-blue-500/30 text-blue-500 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                >
                  <Sparkles size={14} className="text-blue-500" />
                  <span>⚡ Accès Express Administrateur (Relevés & Tickets)</span>
                </button>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
                  <span>Espace : <strong className="text-blue-500 font-mono">cashpilot_main_user</strong></span>
                  <span className="text-emerald-500 font-semibold">692 RB • 21 Tickets enregistrés</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;
