import React, { useState, useEffect } from 'react';
import {
  Download,
  Smartphone,
  CheckCircle2,
  Share,
  PlusSquare,
  X,
  Sparkles,
  Zap,
  Laptop
} from 'lucide-react';
import { cn } from '../lib/utils';

// Déclaration de l'événement BeforeInstallPromptEvent W3C pour TypeScript
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export interface InstallPWAButtonProps {
  /** Variante visuelle du bouton */
  variant?: 'hero' | 'compact' | 'pill' | 'banner';
  /** Classes CSS supplémentaires */
  className?: string;
  /** Afficher le bouton même si l'application est déjà installée */
  showIfInstalled?: boolean;
}

export const InstallPWAButton: React.FC<InstallPWAButtonProps> = ({
  variant = 'hero',
  className,
  showIfInstalled = false
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [showIOSModal, setShowIOSModal] = useState<boolean>(false);
  const [showSuccessToast, setShowSuccessToast] = useState<boolean>(false);

  useEffect(() => {
    // 1. Détection du mode Standalone (PWA déjà ouverte comme une app installée)
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsStandalone(Boolean(isStandaloneMode));
      if (isStandaloneMode) {
        setIsInstalled(true);
      }
    };
    checkStandalone();

    // 2. Détection d'iOS (iPhone, iPad, iPod)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice =
      /iphone|ipad|ipod/.test(userAgent) ||
      (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
    setIsIOS(isIOSDevice);

    // 3. Écoute de l'événement natif avant installation (Android, Chrome, Edge)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // 4. Écoute de la fin d'installation réussie
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 5000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Déclencheur du clic d'installation
  const handleInstallClick = async () => {
    // Cas A : L'événement natif Chrome/Android est disponible
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setIsInstalled(true);
          setShowSuccessToast(true);
          setTimeout(() => setShowSuccessToast(false), 5000);
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.error('Erreur lors du prompt PWA:', err);
      }
      return;
    }

    // Cas B : Appareil iOS (Safari ne gère pas beforeinstallprompt, on guide l'utilisateur)
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    // Cas C : Navigateur Desktop ou déjà prêt
    if (!isStandalone) {
      // Afficher la modale d'aide ou l'indication d'installation
      setShowIOSModal(true);
    }
  };

  // Si l'application est déjà lancée en mode standalone et qu'on ne force pas l'affichage
  if (isStandalone && !showIfInstalled) {
    return null;
  }

  return (
    <>
      {/* =========================================================================
          BOUTON D'INSTALLATION SELON LA VARIANTE
         ========================================================================= */}
      {variant === 'hero' && (
        <div className={cn('relative group inline-block', className)}>
          {/* Halo néon animé en arrière-plan */}
          <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 via-indigo-500 to-violet-500 rounded-3xl blur-xl opacity-40 group-hover:opacity-75 transition-all duration-500 animate-pulse" />

          {/* Bouton Principal Grand Format Hero */}
          <button
            onClick={handleInstallClick}
            type="button"
            className="relative px-7 py-4 rounded-2xl bg-gradient-to-r from-slate-900/90 via-slate-950/95 to-slate-900/90 hover:from-slate-800/95 hover:to-slate-900/95 border border-cyan-400/40 hover:border-cyan-400 text-white shadow-[0_12px_36px_rgba(6,182,212,0.25)] hover:shadow-[0_16px_48px_rgba(6,182,212,0.4)] backdrop-blur-2xl transition-all duration-300 flex items-center gap-4 cursor-pointer active:scale-95 group/btn"
          >
            {/* Icône animée */}
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-500 via-primary to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/30 border border-white/25 group-hover/btn:scale-110 transition-transform">
              {isInstalled ? (
                <CheckCircle2 size={24} className="text-emerald-300 stroke-[2.5]" />
              ) : (
                <Download size={22} className="stroke-[2.5] animate-bounce" />
              )}
            </div>

            {/* Texte & Badges */}
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base font-black tracking-tight text-white group-hover/btn:text-cyan-300 transition-colors">
                  {isInstalled ? 'CashPilot est installé' : 'Installer l\'application CashPilot'}
                </span>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 flex items-center gap-1">
                  <Sparkles size={10} />
                  <span>100% GRATUIT</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium flex items-center gap-2 mt-0.5">
                <span className="flex items-center gap-1 text-slate-300">
                  <Smartphone size={13} className="text-cyan-400" /> Mobile
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-slate-300">
                  <Laptop size={13} className="text-indigo-400" /> PC / Mac
                </span>
                <span>•</span>
                <span className="text-emerald-400 font-semibold">Sans App Store</span>
              </p>
            </div>

            {/* Flèche d'action */}
            <div className="hidden sm:flex items-center justify-center w-8 h-8 rounded-full bg-white/[0.08] group-hover/btn:bg-cyan-500/20 text-slate-300 group-hover/btn:text-cyan-300 transition-colors ml-2">
              <Zap size={16} />
            </div>
          </button>
        </div>
      )}

      {variant === 'compact' && (
        <button
          onClick={handleInstallClick}
          type="button"
          className={cn(
            'px-3.5 py-1.5 rounded-full bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 hover:from-cyan-500/30 hover:to-indigo-500/30 border border-cyan-400/40 text-cyan-300 hover:text-white text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95',
            className
          )}
        >
          <Download size={14} className="stroke-[2.5]" />
          <span>Installer l'App</span>
        </button>
      )}

      {variant === 'pill' && (
        <button
          onClick={handleInstallClick}
          type="button"
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/20 text-white text-xs font-semibold backdrop-blur-xl transition-all cursor-pointer active:scale-95',
            className
          )}
        >
          <Smartphone size={15} className="text-cyan-400" />
          <span>Installer sur smartphone</span>
        </button>
      )}

      {variant === 'banner' && (
        <div
          className={cn(
            'fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 rounded-2xl bg-slate-950/90 backdrop-blur-2xl border border-cyan-400/30 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.6)] flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300',
            className
          )}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <Download size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Installer CashPilot</p>
              <p className="text-[11px] text-slate-400">Accès plein écran & hors-ligne</p>
            </div>
          </div>
          <button
            onClick={handleInstallClick}
            type="button"
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-white text-xs font-bold shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            Installer
          </button>
        </div>
      )}

      {/* =========================================================================
          MODALE / FEUILLE D'INSTRUCTION (iOS Safari & Desktop)
         ========================================================================= */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl bg-slate-900/95 border border-white/20 p-6 sm:p-7 shadow-[0_25px_60px_rgba(0,0,0,0.8)] text-slate-100 space-y-5">
            {/* Bouton Fermer */}
            <button
              onClick={() => setShowIOSModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>

            {/* Header Modale */}
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 via-primary to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/30 border border-white/25">
                <Smartphone size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white tracking-tight">
                  Installer CashPilot
                </h3>
                <p className="text-xs text-cyan-300 font-medium">
                  {isIOS ? 'Procédure directe pour iPhone & iPad' : 'Installation en 2 étapes'}
                </p>
              </div>
            </div>

            {/* Instructions Pas-à-Pas */}
            <div className="space-y-3 pt-1">
              {isIOS ? (
                <>
                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/[0.04] border border-white/10">
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center shrink-0 font-bold text-sm">
                      1
                    </div>
                    <div className="text-xs text-slate-300 space-y-0.5">
                      <p className="font-semibold text-white flex items-center gap-1.5">
                        Touchez le bouton Partager
                        <Share size={14} className="text-cyan-400" />
                      </p>
                      <p className="text-slate-400">
                        En bas de votre écran sur Safari (icône carrée avec une flèche vers le haut).
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/[0.04] border border-white/10">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center shrink-0 font-bold text-sm">
                      2
                    </div>
                    <div className="text-xs text-slate-300 space-y-0.5">
                      <p className="font-semibold text-white flex items-center gap-1.5">
                        Sélectionnez "Sur l'écran d'accueil"
                        <PlusSquare size={14} className="text-indigo-400" />
                      </p>
                      <p className="text-slate-400">
                        Faites défiler le menu d'action vers le bas et touchez cette option.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/[0.04] border border-white/10">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0 font-bold text-sm">
                      3
                    </div>
                    <div className="text-xs text-slate-300 space-y-0.5">
                      <p className="font-semibold text-white">Appuyez sur "Ajouter"</p>
                      <p className="text-slate-400">
                        L'icône CashPilot s'installe instantanément sur votre écran d'accueil sans passer par l'App Store.
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-2.5 text-xs text-slate-300">
                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/[0.04] border border-white/10">
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center shrink-0 font-bold text-sm">
                      1
                    </div>
                    <div className="space-y-0.5">
                      <p className="font-semibold text-white">Installation directe</p>
                      <p className="text-slate-400">
                        Sur Chrome, Edge ou Android, cliquez sur l'icône d'installation dans la barre d'adresse ou le menu ⋮ puis "Installer CashPilot".
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/[0.04] border border-white/10">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0 font-bold text-sm">
                      ✓
                    </div>
                    <div className="space-y-0.5">
                      <p className="font-semibold text-white">Plein écran & Gratuit</p>
                      <p className="text-slate-400">
                        L'application fonctionne comme une application native sans barre d'adresse et sans abonnement.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bouton de confirmation */}
            <button
              onClick={() => setShowIOSModal(false)}
              type="button"
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 via-primary to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/25 border border-white/20 transition-all cursor-pointer active:scale-95"
            >
              J'ai compris
            </button>
          </div>
        </div>
      )}

      {/* Toast de succès d'installation */}
      {showSuccessToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-emerald-950/90 border border-emerald-500/40 text-emerald-200 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle2 size={20} className="text-emerald-400" />
          <span className="text-xs font-bold">
            CashPilot a été installé avec succès sur votre appareil !
          </span>
        </div>
      )}
    </>
  );
};

export default InstallPWAButton;
