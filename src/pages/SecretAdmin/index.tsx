import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, 
  KeyRound, 
  FolderLock, 
  ArrowRight, 
  Loader2, 
  CheckCircle2, 
  Copy, 
  Check, 
  AlertCircle,
  Sparkles,
  Lock,
  Database,
  ArrowLeft
} from 'lucide-react';
import { useAuth, DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASS, DEFAULT_ADMIN_WORKSPACE } from '../../context/AuthContext';
import { ThemeToggle } from '../../components/ThemeToggle';

export const SecretAdminGate: React.FC = () => {
  const navigate = useNavigate();
  const { loginAsAdmin, error, clearError } = useAuth();

  const [workspaceId, setWorkspaceId] = useState<string>(() => {
    return localStorage.getItem('cashpilot_admin_workspace') || DEFAULT_ADMIN_WORKSPACE;
  });
  const [adminKey, setAdminKey] = useState<string>(DEFAULT_ADMIN_PASS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleQuickLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    clearError();
    setIsSubmitting(true);

    try {
      const targetWorkspace = workspaceId.trim() || DEFAULT_ADMIN_WORKSPACE;
      await loginAsAdmin(targetWorkspace);
      navigate('/', { replace: true });
    } catch (err) {
      console.error('Erreur accès express admin:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-white flex flex-col justify-between p-4 sm:p-8 relative overflow-hidden selection:bg-cyan-500/20 selection:text-cyan-400 font-sans">
      {/* Halo de sécurité cybernétique en arrière-plan */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-tr from-cyan-500/10 via-primary/15 to-emerald-500/10 blur-[140px] rounded-full opacity-70" />
      </div>

      {/* Barre supérieure discrète */}
      <header className="relative z-10 max-w-4xl w-full mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500/20 to-primary/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Lock size={15} />
          </div>
          <span className="text-xs uppercase font-mono tracking-widest text-cyan-400 font-bold">
            Passerelle Confidentielle • Port 2026
          </span>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle variant="compact" />
          <button
            onClick={() => navigate('/bienvenue')}
            className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft size={13} />
            <span>Retour Landing</span>
          </button>
        </div>
      </header>

      {/* Contenu Central de la Passerelle */}
      <main className="relative z-10 max-w-lg w-full mx-auto my-auto py-8 space-y-6">
        
        {/* En-tête de la passerelle */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-cyan-500/20 mx-auto animate-pulse">
            <ShieldCheck size={28} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Accès Direct Administrateur
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
            Ce chemin secret vous permet d'accéder instantanément à vos <strong className="text-white">relevés bancaires (RB)</strong> et <strong className="text-white">tickets de caisse</strong> sous votre identifiant.
          </p>
        </div>

        {/* Message d'erreur éventuel */}
        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2.5">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Carte de connexion Express */}
        <div className="rounded-3xl bg-[#0f1422]/90 border border-cyan-500/25 p-6 sm:p-7 shadow-2xl backdrop-blur-xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-cyan-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                Connexion 1-Clic par Identifiant
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
              Prêt
            </span>
          </div>

          <form onSubmit={handleQuickLogin} className="space-y-4">
            {/* Champ Identifiant d'espace */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <FolderLock size={14} className="text-cyan-400" />
                  Identifiant de votre espace de données :
                </label>
                <span className="text-[10px] font-mono text-cyan-400">Par défaut : {DEFAULT_ADMIN_WORKSPACE}</span>
              </div>
              <input
                type="text"
                required
                value={workspaceId}
                onChange={(e) => setWorkspaceId(e.target.value)}
                placeholder="Ex: cashpilot_main_user"
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-cyan-500/30 text-white font-mono text-sm focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40"
              />
              <p className="text-[11px] text-slate-400">
                Tous vos relevés bancaires et tickets de caisse déjà déposés sont rattachés à <code className="text-cyan-300 font-mono">cashpilot_main_user</code>.
              </p>
            </div>

            {/* Champ Clé Admin */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <KeyRound size={14} className="text-cyan-400" />
                Clé secrète d’authentification :
              </label>
              <input
                type="password"
                required
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* Bouton Principal de Connexion Express */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-primary to-indigo-600 hover:opacity-95 active:scale-[0.99] text-white font-bold text-sm shadow-xl shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin text-white" />
                  <span>Accès sécurisé en cours...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>⚡ Accéder immédiatement à mon espace</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Rappel des identifiants classiques */}
          <div className="pt-4 border-t border-white/[0.08] space-y-2.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Identifiants pour connexion standard (Landing Page) :
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-[9px] uppercase text-slate-500 block">E-mail</span>
                  <span className="text-cyan-300">{DEFAULT_ADMIN_EMAIL}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(DEFAULT_ADMIN_EMAIL, 'email')}
                  className="p-1 text-slate-400 hover:text-white"
                  title="Copier"
                >
                  {copiedField === 'email' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </button>
              </div>

              <div className="p-2 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-[9px] uppercase text-slate-500 block">Mot de passe</span>
                  <span className="text-cyan-300">{DEFAULT_ADMIN_PASS}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(DEFAULT_ADMIN_PASS, 'pass')}
                  className="p-1 text-slate-400 hover:text-white"
                  title="Copier"
                >
                  {copiedField === 'pass' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Note de traçabilité */}
        <div className="text-center text-[11px] text-slate-500 flex items-center justify-center gap-2">
          <Database size={13} className="text-emerald-500" />
          <span>Espace persistant Firestore lié à <strong className="text-slate-400">cashpilot_main_user</strong></span>
        </div>
      </main>

      {/* Pied de page */}
      <footer className="relative z-10 max-w-4xl w-full mx-auto text-center text-xs text-slate-500">
        Chemin confidentiel réservé à l'administrateur de CashPilot
      </footer>
    </div>
  );
};

export default SecretAdminGate;
