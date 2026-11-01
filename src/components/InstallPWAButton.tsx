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
  Loader2,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Compass
} from 'lucide-react';
import { cn } from '../lib/utils';

// Déclaration de l'événement BeforeInstallPromptEvent W3C standard
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

export type DetectedBrowser =
  | 'chrome'
  | 'samsung'
  | 'safari'
  | 'opera'
  | 'firefox'
  | 'edge'
  | 'other';

export interface BrowserDetails {
  name: DetectedBrowser;
  label: string;
  isIOS: boolean;
  isAndroid: boolean;
  isDesktop: boolean;
  isSafariIOS: boolean;
  isNonSafariIOS: boolean;
}

export interface InstallPWAButtonProps {
  /** Variante visuelle du bouton */
  variant?: 'hero' | 'compact' | 'pill' | 'banner';
  /** Classes CSS supplémentaires */
  className?: string;
  /** Afficher le bouton même si l'application est déjà installée */
  showIfInstalled?: boolean;
}

/**
 * Détecte avec précision l'OS et le navigateur courant pour adapter
 * les consignes d'installation WebAPK / Standalone.
 */
function getBrowserDetails(): BrowserDetails {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      name: 'other',
      label: 'Navigateur',
      isIOS: false,
      isAndroid: false,
      isDesktop: true,
      isSafariIOS: false,
      isNonSafariIOS: false
    };
  }

  const ua = navigator.userAgent.toLowerCase();
  const isIOS =
    /iphone|ipad|ipod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /android/.test(ua);
  const isDesktop = !isIOS && !isAndroid;

  const isSamsung = /samsungbrowser/i.test(ua);
  const isOpera = /opr\/|opera/i.test(ua);
  const isEdge = /edg\/|edga\/|edgios/i.test(ua);
  const isFirefox = /firefox|fxios/i.test(ua);
  const isChromeIOS = isIOS && /crios/i.test(ua);
  const isSafariIOS = isIOS && /safari/i.test(ua) && !isChromeIOS && !isFirefox && !isOpera && !isEdge;
  const isNonSafariIOS = isIOS && !isSafariIOS;
  const isChrome =
    (/chrome|chromium/i.test(ua) || (isIOS && isChromeIOS)) &&
    !isSamsung &&
    !isOpera &&
    !isEdge;

  let name: DetectedBrowser = 'other';
  let label = 'Votre navigateur';

  if (isSamsung) {
    name = 'samsung';
    label = 'Samsung Internet';
  } else if (isSafariIOS) {
    name = 'safari';
    label = 'Safari (iPhone)';
  } else if (isOpera) {
    name = 'opera';
    label = 'Opera';
  } else if (isFirefox) {
    name = 'firefox';
    label = 'Firefox';
  } else if (isEdge) {
    name = 'edge';
    label = 'Microsoft Edge';
  } else if (isChrome) {
    name = 'chrome';
    label = 'Google Chrome';
  }

  return {
    name,
    label,
    isIOS,
    isAndroid,
    isDesktop,
    isSafariIOS,
    isNonSafariIOS
  };
}

export const InstallPWAButton: React.FC<InstallPWAButtonProps> = ({
  variant = 'hero',
  className,
  showIfInstalled = false
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => {
    return typeof window !== 'undefined' && window.__pwaInstallPrompt
      ? window.__pwaInstallPrompt
      : null;
  });
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [browserInfo, setBrowserInfo] = useState<BrowserDetails>(() => getBrowserDetails());
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);
  const [showSuccessToast, setShowSuccessToast] = useState<boolean>(false);
  const [hasCopiedLink, setHasCopiedLink] = useState<boolean>(false);

  useEffect(() => {
    setBrowserInfo(getBrowserDetails());

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

      // Vérification native des applications déjà installées sur l'appareil
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

    // 2. Récupération immédiate du prompt global pré-capturé dès le <head>
    if (window.__pwaInstallPrompt && !deferredPrompt) {
      setDeferredPrompt(window.__pwaInstallPrompt);
    }

    const handlePromptReady = () => {
      if (window.__pwaInstallPrompt) {
        setDeferredPrompt(window.__pwaInstallPrompt);
      }
    };

    const handleBeforeInstallPrompt = (e: Event) => {
      // Bloque l'infobar par défaut pour permettre le déclenchement contrôlé au clic
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      window.__pwaInstallPrompt = promptEvent;
      setDeferredPrompt(promptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      window.__pwaInstallPrompt = null;
      setShowGuideModal(false);
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

  // Clic sur Télécharger : Déclenche l'installation native ou ouvre le guide adapté au navigateur
  const handleDownloadClick = async () => {
    // Si l'application est déjà lancée en mode autonome
    if (isInstalled || isStandalone) {
      alert("CashPilot est déjà installée sur votre smartphone ! Retrouvez l'icône dans la liste de vos applications.");
      return;
    }

    // Cas iOS (Safari WebClip ou navigateur tiers)
    if (browserInfo.isIOS) {
      setShowGuideModal(true);
      return;
    }

    // Cas Samsung Internet : Sur Android 14/15, le serveur de packaging WebAPK de Samsung est systématiquement
    // bloqué et rejeté silencieusement par Google Play Protect. On ouvre directement le guide avec bascule Chrome !
    if (browserInfo.name === 'samsung') {
      setShowGuideModal(true);
      return;
    }

    setIsLoading(true);

    // 1. Déclenchement direct si le prompt natif W3C est prêt (Chrome, Samsung Internet, Edge, Opera)
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

    // 2. Attente rapide de 1.5s pour laisser le navigateur finaliser son hook PWA
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
      }, 1500);
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

    // 3. Si aucun prompt natif disponible (Firefox mobile, Samsung Internet sans hook, Safari),
    // ouvrir le guide interactif adapté au navigateur exact détecté
    setShowGuideModal(true);
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setHasCopiedLink(true);
      setTimeout(() => setHasCopiedLink(false), 3000);
    } catch {
      // Fallback
    }
  };

  const handleOpenInChrome = () => {
    try {
      const rawUrl = window.location.href.replace(/^https?:\/\//, '');
      const intentUrl = `intent://${rawUrl}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(
        window.location.href
      )};end;`;
      window.location.href = intentUrl;
    } catch {
      window.open(window.location.href, '_blank');
    }
  };

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
                <span className="text-emerald-400 font-bold">Vraie Application</span>
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
          MODALE D'INSTALLATION INTELLIGENTE MULTI-NAVIGATEURS
          S'adapte à Samsung Internet, Safari iOS, Opera, Firefox, Edge et Chrome
         ========================================================================= */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl bg-slate-900/98 border border-cyan-400/30 p-6 shadow-2xl text-slate-100 space-y-4 max-h-[92vh] overflow-y-auto">
            {/* Bouton de fermeture */}
            <button
              onClick={() => setShowGuideModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/[0.06] text-slate-400 hover:text-white cursor-pointer transition-colors"
            >
              <X size={18} />
            </button>

            {/* En-tête avec badge navigateur */}
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/30 border border-white/20 shrink-0">
                <Smartphone size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">Installer CashPilot</h3>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                    {browserInfo.label}
                  </span>
                </div>
                <p className="text-xs text-slate-400">Véritable application plein écran sans barre d'adresse</p>
              </div>
            </div>

            {/* Alerte explicative : Vraie application vs Raccourci */}
            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-cyan-950/30 border border-cyan-400/20 text-xs text-cyan-200">
              <ShieldCheck size={18} className="text-cyan-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                CashPilot n'est pas un simple favori internet : elle s'installe comme une <strong>vraie application autonome</strong> (WebAPK / Standalone) sur votre téléphone.
              </p>
            </div>

            {/* =========================================================================
                CAS 1 : SAMSUNG INTERNET BROWSER (Android 14+ / One UI)
               ========================================================================= */}
            {browserInfo.name === 'samsung' && (
              <div className="space-y-3.5">
                {/* Alerte Explicative Bug Samsung / Google Play Protect */}
                <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs space-y-2">
                  <p className="font-bold flex items-center gap-2 text-amber-300">
                    <ShieldCheck size={16} className="text-amber-400 shrink-0" />
                    Blocage Play Protect sur Samsung Internet
                  </p>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    Sur Android 14+, le générateur interne de Samsung utilise une version cible obsolète. <strong>Google Play Protect bloque et supprime l'application</strong>, même en appuyant sur <em>« Installer quand même »</em>.
                  </p>
                </div>

                {/* Solution Recommandée N°1 : Ouvrir dans Google Chrome (100% Fonctionnel) */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-950/60 to-indigo-950/60 border-2 border-cyan-400/50 space-y-2.5 shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-cyan-500/25 text-cyan-300 border border-cyan-400/30">
                      Solution Recommandée
                    </span>
                    <span className="text-emerald-400 font-bold text-[11px]">100% Garanti</span>
                  </div>
                  <p className="text-xs text-white font-bold">
                    Installer via Google Chrome (WebAPK Officiel Google)
                  </p>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Sur Chrome, l'installation est signée par Google Play Services : aucun blocage Play Protect, et l'application CashPilot apparaît immédiatement dans vos applications.
                  </p>
                  <button
                    onClick={handleOpenInChrome}
                    type="button"
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 via-primary to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-black text-xs shadow-md shadow-cyan-500/30 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
                  >
                    <ExternalLink size={15} />
                    <span>Basculer sur Google Chrome &amp; Installer</span>
                  </button>
                </div>

                {/* Solution Alternative N°2 : Raccourci Direct Samsung */}
                <div className="space-y-2 text-xs">
                  <p className="text-slate-300 font-medium text-[11px]">
                    Ou si vous souhaitez rester sur Samsung Internet :
                  </p>
                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 space-y-1">
                    <p className="font-bold text-white flex items-center gap-2 text-xs">
                      <span className="w-5 h-5 rounded-full bg-white/10 text-slate-300 flex items-center justify-center text-[10px]">2</span>
                      Ajouter un raccourci direct
                    </p>
                    <p className="text-slate-400 text-[11px] pl-7">
                      Touchez les 3 traits <strong className="text-white">≡</strong> en bas à droite &gt; touchez <strong className="text-cyan-300">« Ajouter la page à »</strong> &gt; <strong className="text-cyan-300">« Écran d'accueil »</strong> (évite le bug du paquet APK de Samsung).
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* =========================================================================
                CAS 2 : SAFARI SUR IPHONE (iOS)
               ========================================================================= */}
            {browserInfo.isSafariIOS && (
              <div className="space-y-3">
                <p className="text-xs text-slate-300 font-medium">
                  Sur iPhone, Safari transforme CashPilot en véritable application native :
                </p>
                <div className="space-y-2.5 text-xs text-slate-300">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/10">
                    <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-[11px] shrink-0 font-bold">1</span>
                    <span className="flex-1">En bas de l'écran, touchez <strong>Partager</strong></span>
                    <Share size={18} className="text-cyan-400 shrink-0" />
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/10">
                    <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-[11px] shrink-0 font-bold">2</span>
                    <span className="flex-1">Faites défiler et touchez <strong>« Sur l'écran d'accueil »</strong></span>
                    <PlusSquare size={18} className="text-indigo-400 shrink-0" />
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/10">
                    <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-[11px] shrink-0 font-bold">3</span>
                    <span className="flex-1">En haut à droite, touchez <strong>« Ajouter »</strong></span>
                    <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-200">
                    <p className="flex items-center gap-2">
                      <Sparkles size={16} className="text-emerald-400 shrink-0" />
                      <span>L'icône s'ouvre sans barre d'URL ni commandes Safari, exactement comme une appli de l'App Store !</span>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* =========================================================================
                CAS 3 : IPHONE AVEC UN AUTRE NAVIGATEUR (Chrome iOS, Opera iOS, etc.)
               ========================================================================= */}
            {browserInfo.isNonSafariIOS && (
              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/30 text-amber-200 text-xs space-y-2">
                  <p className="font-bold flex items-center gap-2">
                    <Compass size={16} className="text-amber-400" />
                    Ouvrir dans Safari sur iPhone
                  </p>
                  <p className="text-slate-300 leading-relaxed">
                    Sur iPhone, Apple réserve l'installation en véritable application plein écran au navigateur <strong>Safari</strong>. Dans Chrome ou Opera sur iOS, un simple lien est créé.
                  </p>
                </div>

                <div className="space-y-2 text-xs">
                  <p className="text-slate-300 font-medium">Pour installer l'application plein écran :</p>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-slate-300">
                    <span className="font-mono text-cyan-300 select-all truncate flex-1">
                      {typeof window !== 'undefined' ? window.location.origin : 'cashpilot-app-2026.web.app'}
                    </span>
                    <button
                      onClick={handleCopyUrl}
                      type="button"
                      className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-400/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      {hasCopiedLink ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      <span>{hasCopiedLink ? 'Copié !' : 'Copier'}</span>
                    </button>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    1. Copiez le lien ci-dessus &gt; 2. Ouvrez <strong>Safari</strong> &gt; 3. Collez l'adresse &gt; 4. Touchez Partager &gt; « Sur l'écran d'accueil ».
                  </p>
                </div>
              </div>
            )}

            {/* =========================================================================
                CAS 4 : FIREFOX MOBILE
               ========================================================================= */}
            {browserInfo.name === 'firefox' && !browserInfo.isIOS && (
              <div className="space-y-3">
                <p className="text-xs text-slate-300 font-medium">
                  Pour installer CashPilot sur Firefox Android :
                </p>
                <div className="space-y-2.5 text-xs text-slate-300">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/10">
                    <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-[11px] shrink-0 font-bold">1</span>
                    <span className="flex-1">Touchez l'icône <strong>Installer (icône maison avec un +)</strong> dans la barre d'adresse en haut à droite.</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/10">
                    <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-[11px] shrink-0 font-bold">2</span>
                    <span className="flex-1">Ou touchez les <strong>3 points ⋮</strong> puis <strong>« Installer »</strong>.</span>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-200">
                    <p className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                      <span>L'application se lance en plein écran avec son propre processus Android dédié.</span>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* =========================================================================
                CAS 5 : OPERA MOBILE
               ========================================================================= */}
            {browserInfo.name === 'opera' && !browserInfo.isIOS && (
              <div className="space-y-3">
                <p className="text-xs text-slate-300 font-medium">
                  Pour installer CashPilot sur Opera :
                </p>
                <div className="space-y-2.5 text-xs text-slate-300">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/10">
                    <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-[11px] shrink-0 font-bold">1</span>
                    <span className="flex-1">Touchez le bouton de menu <strong>Opera (ou ⋮)</strong>.</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/10">
                    <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-[11px] shrink-0 font-bold">2</span>
                    <span className="flex-1">Sélectionnez <strong>« Installer l'application »</strong>.</span>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-200">
                    <p className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                      <span>L'application s'ajoute à vos applications en mode autonome.</span>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* =========================================================================
                CAS 6 : CHROME, EDGE OU PC / MAC
               ========================================================================= */}
            {(browserInfo.name === 'chrome' || browserInfo.name === 'edge' || browserInfo.name === 'other') && !browserInfo.isIOS && (
              <div className="space-y-3">
                <p className="text-xs text-slate-300 font-medium">
                  Pour installer CashPilot sur {browserInfo.label} :
                </p>
                <div className="space-y-2.5 text-xs text-slate-300">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/10">
                    <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-[11px] shrink-0 font-bold">1</span>
                    <span className="flex-1">
                      {browserInfo.isDesktop
                        ? 'Cliquez sur l\'icône d\'installation 💻 dans la barre d\'adresse en haut à droite.'
                        : 'Touchez les 3 points ⋮ en haut à droite.'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/10">
                    <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-[11px] shrink-0 font-bold">2</span>
                    <span className="flex-1">
                      Choisissez <strong className="text-cyan-300">« Installer l'application »</strong>.
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-200">
                    <p className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                      <span>L'application s'installe directement sur votre système et se lance sans barre de navigation.</span>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Bouton de validation */}
            <button
              onClick={() => setShowGuideModal(false)}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-bold text-xs shadow-lg shadow-cyan-500/30 hover:brightness-110 active:scale-98 transition-all cursor-pointer"
            >
              J'ai compris
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
