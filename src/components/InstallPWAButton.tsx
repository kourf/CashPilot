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
  Laptop,
  Loader2
} from 'lucide-react';
import { cn } from '../lib/utils';

// Déclaration de l'événement BeforeInstallPromptEvent W3C
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface Window {
    __pwaInstallPrompt?: BeforeInstallPromptEvent | null;
  }
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
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => {
    return (typeof window !== 'undefined' && window.__pwaInstallPrompt) ? window.__pwaInstallPrompt : null;
  });
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showIOSModal, setShowIOSModal] = useState<boolean>(false);
  const [showAndroidDirectTip, setShowAndroidDirectTip] = useState<boolean>(false);
  const [showSuccessToast, setShowSuccessToast] = useState<boolean>(false);

  useEffect(() => {
    // 1. Détection du mode Standalone (PWA lancée comme application native)
    const checkStandalone = async () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsStandalone(Boolean(isStandaloneMode));
      if (isStandaloneMode) {
        setIsInstalled(true);
        return;
      }

      // Vérification native Chrome des applications déjà installées sur l'appareil
      if (typeof navigator !== 'undefined' && 'getInstalledRelatedApps' in navigator) {
        try {
          const apps = await (navigator as any).getInstalledRelatedApps();
          if (apps && apps.length > 0) {
            setIsInstalled(true);
          }
        } catch {}
      }
    };
    checkStandalone();

    // 2. Détection de la plateforme iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice =
      /iphone|ipad|ipod/.test(userAgent) ||
      (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
    setIsIOS(isIOSDevice);

    // 3. Récupération immédiate du prompt global pré-capturé dès le <head>
    if (window.__pwaInstallPrompt && !deferredPrompt) {
      setDeferredPrompt(window.__pwaInstallPrompt);
    }

    const handlePromptReady = () => {
      if (window.__pwaInstallPrompt) {
        setDeferredPrompt(window.__pwaInstallPrompt);
      }
    };

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      window.__pwaInstallPrompt = promptEvent;
      setDeferredPrompt(promptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      window.__pwaInstallPrompt = null;
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 5000);
    };

    window.addEventListener('pwa-prompt-ready', handlePromptReady);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('pwa-prompt-ready', handlePromptReady);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [deferredPrompt]);

  // Clic 1-clic direct : déclenche directement l'installation sans manipulation
  const handleDownloadClick = async () => {
    // Si l'application est déjà installée sur l'appareil
    if (isInstalled || isStandalone) {
      alert("CashPilot est déjà installée sur votre smartphone ! Retrouvez l'icône sur votre écran d'accueil.");
      return;
    }

    // Cas iOS (Safari n'a pas d'API native de prompt, guidage simple en 1 tap)
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    setIsLoading(true);

    // 1. Si le prompt natif est déjà disponible -> déclenchement DIRECT 1-clic
    const activePrompt = deferredPrompt || window.__pwaInstallPrompt;
    if (activePrompt) {
      try {
        await activePrompt.prompt();
        const choice = await activePrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setIsInstalled(true);
          setShowSuccessToast(true);
          setTimeout(() => setShowSuccessToast(false), 5000);
        }
        setDeferredPrompt(null);
        window.__pwaInstallPrompt = null;
      } catch (err) {
        console.warn('Erreur lors du prompt PWA:', err);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // 2. Si le prompt n'a pas encore fini de s'initialiser, attendre jusqu'à 2 secondes
    const waitForPrompt = new Promise<BeforeInstallPromptEvent | null>((resolve) => {
      let resolved = false;
      const onReady = () => {
        if (window.__pwaInstallPrompt && !resolved) {
          resolved = true;
          resolve(window.__pwaInstallPrompt);
        }
      };
      window.addEventListener('pwa-prompt-ready', onReady, { once: true });
      window.addEventListener(
        'beforeinstallprompt',
        (e) => {
          e.preventDefault();
          if (!resolved) {
            resolved = true;
            resolve(e as BeforeInstallPromptEvent);
          }
        },
        { once: true }
      );

      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(null);
        }
      }, 2000);
    });

    const captured = await waitForPrompt;
    if (captured) {
      try {
        await captured.prompt();
        const choice = await captured.userChoice;
        if (choice.outcome === 'accepted') {
          setIsInstalled(true);
          setShowSuccessToast(true);
          setTimeout(() => setShowSuccessToast(false), 5000);
        }
        setDeferredPrompt(null);
        window.__pwaInstallPrompt = null;
      } catch (err) {
        console.warn('Erreur prompt:', err);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    setIsLoading(false);

    // 3. Fallback immédiat et direct si Chrome a déjà l'application en mémoire
    setShowAndroidDirectTip(true);
  };

  // Si l'application est déjà lancée en mode standalone et qu'on ne force pas l'affichage
  if (isStandalone && !showIfInstalled) {
    return null;
  }

  return (
    <>
      {/* =========================================================================
          BOUTON PRINCIPAL 1-CLIC « TÉLÉCHARGER CASHPILOT »
         ========================================================================= */}
      {variant === 'hero' && (
        <div className={cn('relative group inline-block', className)}>
          {/* Halo néon animé */}
          <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 via-primary to-indigo-600 rounded-3xl blur-xl opacity-45 group-hover:opacity-80 transition-all duration-500 animate-pulse" />

          <button
            onClick={handleDownloadClick}
            disabled={isLoading}
            type="button"
            className="relative px-8 py-4.5 rounded-2xl bg-gradient-to-r from-slate-900/95 via-slate-950/98 to-slate-900/95 hover:from-slate-800/95 hover:to-slate-900/95 border-2 border-cyan-400/50 hover:border-cyan-300 text-white shadow-[0_12px_40px_rgba(6,182,212,0.35)] hover:shadow-[0_16px_50px_rgba(6,182,212,0.5)] backdrop-blur-2xl transition-all duration-300 flex items-center gap-4 cursor-pointer active:scale-95 group/btn disabled:opacity-75"
          >
            {/* Icône animée */}
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-500 via-primary to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/40 border border-white/30 group-hover/btn:scale-110 transition-transform shrink-0">
              {isLoading ? (
                <Loader2 size={24} className="animate-spin text-white" />
              ) : isInstalled ? (
                <CheckCircle2 size={24} className="text-emerald-300 stroke-[2.5]" />
              ) : (
                <Download size={24} className="stroke-[2.5] animate-bounce" />
              )}
            </div>

            {/* Texte & Titre */}
            <div className="text-left">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base sm:text-lg font-black tracking-tight text-white group-hover/btn:text-cyan-300 transition-colors">
                  {isLoading
                    ? 'Téléchargement en cours...'
                    : isInstalled
                    ? 'Application CashPilot installée'
                    : 'Télécharger CashPilot'}
                </span>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-cyan-500/25 text-cyan-300 border border-cyan-400/40 flex items-center gap-1 shadow-sm">
                  <Sparkles size={10} />
                  <span>100% GRATUIT</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium flex items-center gap-2 mt-0.5">
                <span className="flex items-center gap-1 text-slate-200">
                  <Smartphone size={13} className="text-cyan-400" /> Mobile
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-slate-200">
                  <Laptop size={13} className="text-indigo-400" /> PC
                </span>
                <span>•</span>
                <span className="text-emerald-400 font-bold">1-Clic direct</span>
              </p>
            </div>

            {/* Pastille Éclair */}
            <div className="hidden sm:flex items-center justify-center w-8 h-8 rounded-full bg-white/[0.1] group-hover/btn:bg-cyan-500/30 text-cyan-300 transition-colors ml-2 shrink-0">
              <Zap size={16} />
            </div>
          </button>
        </div>
      )}

      {variant === 'compact' && (
        <button
          onClick={handleDownloadClick}
          disabled={isLoading}
          type="button"
          className={cn(
            'px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/25 to-indigo-500/25 hover:from-cyan-500/40 hover:to-indigo-500/40 border border-cyan-400/50 text-cyan-200 hover:text-white text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50',
            className
          )}
        >
          {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} className="stroke-[2.5]" />}
          <span>Télécharger l'App</span>
        </button>
      )}

      {variant === 'pill' && (
        <button
          onClick={handleDownloadClick}
          disabled={isLoading}
          type="button"
          className={cn(
            'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.1] hover:bg-white/[0.18] border border-white/25 text-white text-xs font-bold backdrop-blur-xl transition-all cursor-pointer active:scale-95 disabled:opacity-50',
            className
          )}
        >
          {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Smartphone size={15} className="text-cyan-400" />}
          <span>Télécharger sur mon téléphone</span>
        </button>
      )}

      {variant === 'banner' && (
        <div
          className={cn(
            'fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 rounded-2xl bg-slate-950/95 backdrop-blur-2xl border border-cyan-400/40 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.7)] flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300',
            className
          )}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <Download size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Télécharger CashPilot</p>
              <p className="text-[11px] text-slate-400">Plein écran & sans barre d'URL</p>
            </div>
          </div>
          <button
            onClick={handleDownloadClick}
            type="button"
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-white text-xs font-bold shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            Télécharger
          </button>
        </div>
      )}

      {/* =========================================================================
          NOTIFICATIONS DIRECTES (Sans manipulation complexe)
         ========================================================================= */}

      {/* Toast Android direct si le prompt a déjà été utilisé */}
      {showAndroidDirectTip && (
        <div className="fixed inset-x-4 bottom-6 sm:left-auto sm:right-6 sm:w-96 z-50 rounded-2xl bg-slate-900/98 border border-cyan-400/50 p-4.5 shadow-[0_20px_50px_rgba(0,0,0,0.85)] text-slate-100 space-y-2.5 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold text-xs">
                <Download size={15} />
              </div>
              <p className="font-bold text-xs text-white">Installation prête dans Chrome</p>
            </div>
            <button
              onClick={() => setShowAndroidDirectTip(false)}
              className="text-slate-400 hover:text-white p-1"
            >
              <X size={16} />
            </button>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Touchez l'icône de téléchargement dans la barre d'adresse de Chrome en haut (ou les 3 points <strong className="text-cyan-300">⋮</strong> puis <strong className="text-cyan-300">"Installer l'application"</strong>). L'icône se place immédiatement sur votre téléphone.
          </p>
          <button
            onClick={() => setShowAndroidDirectTip(false)}
            className="w-full py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-400/30 text-xs font-bold transition-colors cursor-pointer"
          >
            D'accord
          </button>
        </div>
      )}

      {/* Modale ultra-simple pour iOS Safari */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-3xl bg-slate-900/98 border border-white/20 p-6 shadow-2xl text-slate-100 space-y-4">
            <button
              onClick={() => setShowIOSModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/[0.06] text-slate-400 hover:text-white cursor-pointer"
            >
              <X size={18} />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
                <Smartphone size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Télécharger sur iPhone</h3>
                <p className="text-xs text-cyan-300">Sur Safari</p>
              </div>
            </div>
            <div className="space-y-2 text-xs text-slate-300">
              <p className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.04]">
                1. Touchez Partager <Share size={14} className="text-cyan-400 ml-auto" />
              </p>
              <p className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.04]">
                2. Choisissez "Sur l'écran d'accueil" <PlusSquare size={14} className="text-indigo-400 ml-auto" />
              </p>
              <p className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.04]">
                3. Touchez "Ajouter"
              </p>
            </div>
            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-bold text-xs cursor-pointer"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Toast de confirmation de téléchargement réussi */}
      {showSuccessToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-emerald-950/90 border border-emerald-500/40 text-emerald-200 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle2 size={20} className="text-emerald-400" />
          <span className="text-xs font-bold">
            CashPilot a été installée avec succès sur votre téléphone !
          </span>
        </div>
      )}
    </>
  );
};

export default InstallPWAButton;
