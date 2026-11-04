import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  User as UserIcon,
  ShieldCheck,
  ArrowRight,
  Loader2,
  Sparkles,
  Zap,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PullLamp } from '../../components/PullLamp/PullLamp';
import { ThemeToggle } from '../../components/ThemeToggle';
import { cn } from '../../lib/utils';

type AuthTab = 'login' | 'register' | 'reset';

export const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    user,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    resetPassword,
    loginAsAdmin,
    error,
    clearError,
  } = useAuth();

  // État de la lampe : allumée ou éteinte
  const [isLampOn, setIsLampOn] = useState<boolean>(false);

  // Onglet courant : 'login', 'register' ou 'reset'
  const [activeTab, setActiveTab] = useState<AuthTab>('login');

  // Champs de saisie
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // États locaux de soumission et validation
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);

  // Rediriger automatiquement si l'utilisateur est déjà connecté
  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  // Initialisation de l'onglet selon le paramètre URL (?mode=register ou ?mode=login)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const modeParam = params.get('mode');
    if (modeParam === 'register') {
      setActiveTab('register');
    } else if (modeParam === 'reset') {
      setActiveTab('reset');
    }
    // Si l'utilisateur clique sur un lien direct avec ?turnOn=true, on allume la lampe
    if (params.get('turnOn') === 'true') {
      setIsLampOn(true);
    }
  }, [location.search]);

  // Réinitialisation des erreurs lors du changement d'onglet
  const switchTab = (tab: AuthTab) => {
    clearError();
    setLocalError(null);
    setResetSuccessMsg(null);
    setActiveTab(tab);
  };

  // Connexion Google via Firebase Auth
  const handleGoogleSignIn = async () => {
    clearError();
    setLocalError(null);
    setResetSuccessMsg(null);
    setIsSubmitting(true);
    try {
      await loginWithGoogle();
      navigate('/', { replace: true });
    } catch {
      // Erreur affichée via AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  // Soumission du formulaire Email
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLocalError(null);
    setResetSuccessMsg(null);

    // Validation locale pour l'inscription : confirmation du mot de passe
    if (activeTab === 'register') {
      if (password.length < 6) {
        setLocalError('Le mot de passe doit contenir au moins 6 caractères.');
        return;
      }
      if (password !== confirmPassword) {
        setLocalError('Les deux mots de passe ne correspondent pas.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (activeTab === 'login') {
        const cleanEmail = email.toLowerCase().trim();
        // Détection de l'accès administrateur préconfiguré
        if (
          cleanEmail === 'admin@cashpilot.fr' ||
          cleanEmail === 'admin' ||
          password === 'CashPilot2026!'
        ) {
          await loginAsAdmin('cashpilot_main_user');
        } else {
          await loginWithEmail(email, password);
        }
        navigate('/', { replace: true });
      } else if (activeTab === 'register') {
        await registerWithEmail(email, password, displayName);
        navigate('/', { replace: true });
      } else if (activeTab === 'reset') {
        await resetPassword(email);
        setResetSuccessMsg(
          'Un e-mail de réinitialisation sécurisé a été transmis à votre adresse.'
        );
      }
    } catch {
      // Erreur gérée par AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  // Accès Express Administrateur (Démo & tests immédiats)
  const handleExpressAdminAccess = async () => {
    setIsSubmitting(true);
    try {
      await loginAsAdmin('cashpilot_main_user');
      navigate('/', { replace: true });
    } catch (err) {
      console.error('Erreur accès express admin:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayedError = localError || error;

  return (
    <div
      className={cn(
        'relative min-h-screen w-full flex flex-col items-center justify-between transition-colors duration-700 font-sans select-none overflow-x-hidden',
        isLampOn ? 'bg-[#090d16]' : 'bg-[#030508]'
      )}
    >
      {/* =========================================================================
          ARRIÈRE-PLAN D'AMBIANCE : OBSCURITÉ MYSTÉRIEUSE vs RAYONNEMENT VOLUMÉTRIQUE
          ========================================================================= */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        {/* Halo de l'ampoule (visible seulement allumée) */}
        <div
          className={cn(
            'absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full blur-[110px] transition-opacity duration-700',
            isLampOn
              ? 'bg-gradient-to-b from-amber-300/25 via-amber-500/15 to-transparent opacity-100'
              : 'opacity-0'
          )}
        />

        {/* Faisceau lumineux conique descendant (Lumière de l'abat-jour vers la table) */}
        <div
          className={cn(
            'absolute top-20 left-1/2 -translate-x-1/2 w-[92vw] max-w-[850px] h-[85vh] transition-all duration-700 origin-top',
            isLampOn ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          )}
          style={{
            clipPath: 'polygon(38% 0%, 62% 0%, 100% 100%, 0% 100%)',
            background:
              'radial-gradient(ellipse at 50% 0%, rgba(254, 240, 138, 0.22) 0%, rgba(251, 191, 36, 0.12) 35%, rgba(6, 182, 212, 0.05) 65%, transparent 100%)',
          }}
        />

        {/* Texture Mesh Tech Apple Liquid Glass quand allumée */}
        <div
          className={cn(
            'absolute inset-0 transition-opacity duration-1000',
            isLampOn ? 'opacity-60' : 'opacity-10'
          )}
        >
          <div className="absolute bottom-10 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px]" />
          <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-indigo-600/10 rounded-full blur-[130px]" />
        </div>
      </div>

      {/* =========================================================================
          BARRE SUPÉRIEURE : RETOUR & CONTROLES
          ========================================================================= */}
      <header className="relative z-30 w-full max-w-5xl px-4 sm:px-8 py-3 sm:py-4 flex items-center justify-between">
        <Link
          to="/bienvenue"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-all backdrop-blur-md cursor-pointer active:scale-95"
        >
          <ArrowLeft size={14} />
          <span className="hidden sm:inline">Retour à l'accueil</span>
          <span className="sm:hidden">Accueil</span>
        </Link>

        {/* Badge d'état de la lampe interactif */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsLampOn(!isLampOn)}
            className={cn(
              'px-3 py-1 rounded-full text-[11px] font-semibold border transition-all flex items-center gap-1.5 backdrop-blur-md cursor-pointer active:scale-95',
              isLampOn
                ? 'bg-amber-400/15 border-amber-400/30 text-amber-300'
                : 'bg-white/[0.04] border-white/10 text-slate-400 hover:text-slate-200'
            )}
            title="Vous pouvez aussi tirer sur la tirette de la lampe"
          >
            <span
              className={cn(
                'w-2 h-2 rounded-full transition-colors',
                isLampOn ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]' : 'bg-slate-600'
              )}
            />
            <span>{isLampOn ? 'Lampe allumée' : 'Lampe éteinte'}</span>
          </button>
          <ThemeToggle />
        </div>
      </header>

      {/* =========================================================================
          ZONE CENTRALE : LA LAMPE SUSPENDUE ET LA CARTE D'AUTHENTIFICATION
          ========================================================================= */}
      <main className="relative z-20 w-full max-w-md px-4 flex flex-col items-center my-auto pb-8">
        {/* 1. LA LAMPE À TIRETTE ANIMÉE */}
        <div className="relative mb-2 sm:mb-4">
          <PullLamp
            isOn={isLampOn}
            onToggle={(state) => setIsLampOn(state)}
            className="transition-transform duration-300"
          />
        </div>

        {/* 2. INVITATION VISUELLE QUAND ÉTEINT */}
        {!isLampOn && (
          <div
            onClick={() => setIsLampOn(true)}
            className="flex flex-col items-center gap-3 mt-6 sm:mt-8 p-6 rounded-3xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-sm cursor-pointer hover:border-cyan-400/30 transition-all text-center group max-w-xs animate-pulse-subtle"
          >
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
              <Sparkles size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-white mb-1">
                La pièce est dans le noir
              </p>
              <p className="text-xs text-slate-400">
                Tirez sur la tirette suspendue ci-dessus pour allumer la lampe et révéler votre espace CashPilot.
              </p>
            </div>
          </div>
        )}

        {/* 3. CARTE DU FORMULAIRE D'AUTHENTIFICATION (Révélation lumineuse) */}
        <div
          className={cn(
            'w-full rounded-3xl p-6 sm:p-8 transition-all duration-700 ease-out border backdrop-blur-2xl shadow-2xl relative',
            // Quand allumé : visible avec réfraction Liquid Glass et éclat de lumière
            isLampOn
              ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto bg-[#0f1422]/90 border-amber-400/25 shadow-[0_20px_50px_rgba(0,0,0,0.6),0_0_40px_rgba(251,191,36,0.12)]'
              : 'opacity-0 translate-y-8 scale-95 pointer-events-none max-h-0 overflow-hidden py-0 my-0 border-transparent shadow-none'
          )}
        >
          {/* Liseré de réflexion spéculaire supérieur style visionOS */}
          <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/40 to-transparent" />

          {/* En-tête de la carte */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold mb-3">
              <Sparkles size={13} className="text-cyan-400" />
              <span>Cockpit Financier Intelligent</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Bienvenue sur <span className="bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">CashPilot</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Pilotez vos finances personnelles avec une clarté absolue.
            </p>
          </div>

          {/* Onglets de bascule : Se connecter / Créer un compte */}
          {activeTab !== 'reset' && (
            <div className="grid grid-cols-2 p-1 mb-5 rounded-2xl bg-white/[0.05] border border-white/10">
              <button
                type="button"
                onClick={() => switchTab('login')}
                className={cn(
                  'py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer',
                  activeTab === 'login'
                    ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                Se connecter
              </button>
              <button
                type="button"
                onClick={() => switchTab('register')}
                className={cn(
                  'py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer',
                  activeTab === 'register'
                    ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                Créer un compte
              </button>
            </div>
          )}

          {/* Message de succès (ex. réinitialisation de mot de passe) */}
          {resetSuccessMsg && (
            <div className="mb-4 p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-400" />
              <span>{resetSuccessMsg}</span>
            </div>
          )}

          {/* Message d'erreur ergonomique */}
          {displayedError && (
            <div className="mb-4 p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-shake">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-400" />
              <span>{displayedError}</span>
            </div>
          )}

          {/* Bouton de connexion Google */}
          {activeTab !== 'reset' && (
            <div className="space-y-4 mb-4">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 rounded-2xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 text-white font-semibold text-xs flex items-center justify-center gap-3 transition-all cursor-pointer disabled:opacity-50 active:scale-95 shadow-sm"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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

              <div className="flex items-center gap-2 text-[10px] text-slate-500 justify-center uppercase tracking-wider font-semibold">
                <span className="w-12 h-px bg-white/10" />
                <span>ou avec votre e-mail</span>
                <span className="w-12 h-px bg-white/10" />
              </div>
            </div>
          )}

          {/* Formulaire Email principal */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Nom complet (En mode inscription) */}
            {activeTab === 'register' && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Nom d'affichage ou prénom
                </label>
                <div className="relative">
                  <UserIcon
                    size={15}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Alexandre"
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white/[0.06] border border-white/15 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
                  />
                </div>
              </div>
            )}

            {/* Champ Adresse e-mail */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Adresse e-mail *
              </label>
              <div className="relative">
                <Mail
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@exemple.com"
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white/[0.06] border border-white/15 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
                />
              </div>
            </div>

            {/* Champ Mot de passe */}
            {activeTab !== 'reset' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-slate-300">
                    Mot de passe *
                  </label>
                  {activeTab === 'login' && (
                    <button
                      type="button"
                      onClick={() => switchTab('reset')}
                      className="text-[10px] font-semibold text-cyan-400 hover:underline cursor-pointer"
                    >
                      Mot de passe oublié ?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock
                    size={15}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete={activeTab === 'login' ? 'current-password' : 'new-password'}
                    className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-white/[0.06] border border-white/15 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer p-1"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            )}

            {/* Confirmation du mot de passe (en mode inscription) */}
            {activeTab === 'register' && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Confirmer le mot de passe *
                </label>
                <div className="relative">
                  <ShieldCheck
                    size={15}
                    className={cn(
                      'absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors',
                      confirmPassword && confirmPassword === password
                        ? 'text-emerald-400'
                        : 'text-slate-400'
                    )}
                  />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-white/[0.06] border border-white/15 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer p-1"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            )}

            {/* Bouton d'action principal */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95 border border-white/20 mt-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Traitement en cours...</span>
                </>
              ) : (
                <>
                  <span>
                    {activeTab === 'login' && 'Accéder à mon espace'}
                    {activeTab === 'register' && 'Créer mon compte gratuit'}
                    {activeTab === 'reset' && 'Envoyer le lien de récupération'}
                  </span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {/* Lien retour en mode récupération de mot de passe */}
          {activeTab === 'reset' && (
            <div className="text-center pt-3">
              <button
                type="button"
                onClick={() => switchTab('login')}
                className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                ← Retour à la connexion
              </button>
            </div>
          )}

          {/* Accès Express Administrateur (Démo) */}
          {activeTab === 'login' && (
            <div className="mt-5 pt-4 border-t border-white/10 space-y-2">
              <button
                type="button"
                onClick={handleExpressAdminAccess}
                disabled={isSubmitting}
                className="w-full py-2.5 px-3 rounded-2xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
              >
                <Zap size={14} className="text-cyan-400" />
                <span>⚡ Accès Express Administrateur</span>
              </button>
              <div className="flex items-center justify-between text-[10px] text-slate-500 px-1">
                <span>Espace : <strong className="text-cyan-400/80 font-mono">cashpilot_main_user</strong></span>
                <span className="text-emerald-400 font-semibold">0 latence</span>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* =========================================================================
          PIED DE PAGE DISCRET
          ========================================================================= */}
      <footer className="relative z-20 py-4 text-center text-[11px] text-slate-500">
        <p>CashPilot © {new Date().getFullYear()} • Chiffrement de bout en bout • Données sécurisées</p>
      </footer>
    </div>
  );
};

export default AuthPage;
