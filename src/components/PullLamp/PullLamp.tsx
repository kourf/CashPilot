import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, ArrowDown } from 'lucide-react';
import { cn } from '../../lib/utils';

interface PullLampProps {
  isOn: boolean;
  onToggle: (newState: boolean) => void;
  className?: string;
  disabled?: boolean;
}

/**
 * Synthétise un déclic mécanique réaliste et subtil de commutateur à chaîne
 * via l'API Web Audio native (0 dépendance externe, 0 latence, 100% gratuit).
 */
function playSwitchSound(isTurningOn: boolean) {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    // Premier micro-clic (tension du ressort)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(isTurningOn ? 1800 : 1400, ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.025);
    gain1.gain.setValueAtTime(0.22, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.025);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start();
    osc1.stop(ctx.currentTime + 0.03);

    // Deuxième micro-clic métallique (verrouillage de la bascule)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(isTurningOn ? 950 : 800, ctx.currentTime + 0.012);
    osc2.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.045);
    gain2.gain.setValueAtTime(0.18, ctx.currentTime + 0.012);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.045);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.012);
    osc2.stop(ctx.currentTime + 0.05);
  } catch {
    // Silencieux si l'audio n'est pas autorisé par la stratégie du navigateur
  }
}

/**
 * Retour haptique doux pour smartphones tactiles
 */
function triggerHapticFeedback() {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(28);
    }
  } catch {}
}

export const PullLamp: React.FC<PullLampProps> = ({
  isOn,
  onToggle,
  className,
  disabled = false,
}) => {
  const [pullOffset, setPullOffset] = useState<number>(0);
  const [isPulling, setIsPulling] = useState<boolean>(false);
  const [isRebounding, setIsRebounding] = useState<boolean>(false);
  const dragStartYRef = useRef<number | null>(null);
  const currentPullRef = useRef<number>(0);

  const MAX_PULL = 44; // pixels max d'étirement élastique
  const TRIGGER_THRESHOLD = 18; // seuil de bascule en pixels

  const handleTrigger = useCallback(() => {
    if (disabled) return;
    const nextState = !isOn;
    playSwitchSound(nextState);
    triggerHapticFeedback();
    onToggle(nextState);

    // Animation de rebond dynamique
    setIsRebounding(true);
    setPullOffset(24);
    setTimeout(() => {
      setPullOffset(-6);
      setTimeout(() => {
        setPullOffset(2);
        setTimeout(() => {
          setPullOffset(0);
          setIsRebounding(false);
        }, 120);
      }, 100);
    }, 90);
  }, [disabled, isOn, onToggle]);

  // Gestion tactile (Smartphone)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    setIsPulling(true);
    dragStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling || dragStartYRef.current === null) return;
    const deltaY = e.touches[0].clientY - dragStartYRef.current;
    if (deltaY > 0) {
      // Effet ressort logarithmique avec résistance
      const damped = Math.min(MAX_PULL, deltaY * 0.7);
      currentPullRef.current = damped;
      setPullOffset(damped);
    }
  };

  const handleTouchEnd = () => {
    if (!isPulling) return;
    setIsPulling(false);
    if (currentPullRef.current >= TRIGGER_THRESHOLD) {
      handleTrigger();
    } else {
      setPullOffset(0);
    }
    dragStartYRef.current = null;
    currentPullRef.current = 0;
  };

  // Gestion souris (Desktop)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled || e.button !== 0) return;
    setIsPulling(true);
    dragStartYRef.current = e.clientY;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (dragStartYRef.current === null) return;
      const deltaY = moveEvent.clientY - dragStartYRef.current;
      if (deltaY > 0) {
        const damped = Math.min(MAX_PULL, deltaY * 0.65);
        currentPullRef.current = damped;
        setPullOffset(damped);
      }
    };

    const handleMouseUp = () => {
      setIsPulling(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (currentPullRef.current >= TRIGGER_THRESHOLD) {
        handleTrigger();
      } else if (currentPullRef.current < 4) {
        // Clic direct sans glissement
        handleTrigger();
      } else {
        setPullOffset(0);
      }
      dragStartYRef.current = null;
      currentPullRef.current = 0;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Nettoyage au démontage
  useEffect(() => {
    return () => {
      currentPullRef.current = 0;
    };
  }, []);

  // Longueur dynamique de la cordelette
  const cordBaseLength = 54;
  const currentCordLength = cordBaseLength + pullOffset;

  return (
    <div
      className={cn(
        'relative flex flex-col items-center select-none pointer-events-auto',
        className
      )}
    >
      {/* 1. Attache au plafond / Rosace métallique industrielle */}
      <div className="relative z-30 flex flex-col items-center">
        <div className="w-8 h-2 rounded-t-sm bg-gradient-to-r from-slate-700 via-slate-500 to-slate-800 shadow-md" />
        <div className="w-4 h-1 bg-gradient-to-r from-amber-600 via-amber-400 to-amber-700" />
      </div>

      {/* 2. Câble électrique tressé noir descendant du plafond */}
      <div className="w-0.5 h-6 sm:h-8 bg-gradient-to-b from-slate-800 via-slate-700 to-slate-900 shadow-sm" />

      {/* 3. L'Abat-jour design & Douille métallique (Obsidienne + Bague Laiton) */}
      <div className="relative z-20 flex flex-col items-center -mt-0.5">
        {/* Bague supérieure en laiton */}
        <div className="w-5 h-2 rounded-sm bg-gradient-to-r from-amber-600 via-amber-300 to-amber-700 shadow-inner" />

        {/* Abat-jour suspendu (SVG conique stylisé) */}
        <svg
          viewBox="0 0 160 70"
          className="w-36 sm:w-44 h-14 sm:h-16 overflow-visible filter drop-shadow-xl"
        >
          <defs>
            <linearGradient id="lampShadeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="25%" stopColor="#334155" />
              <stop offset="50%" stopColor="#475569" />
              <stop offset="75%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
            <linearGradient id="lampRimGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#b45309" />
              <stop offset="35%" stopColor="#fef08a" />
              <stop offset="70%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#78350f" />
            </linearGradient>
          </defs>

          {/* Dôme de l'abat-jour */}
          <path
            d="M 50 6 Q 80 0 110 6 L 152 56 Q 80 66 8 56 Z"
            fill="url(#lampShadeGrad)"
            stroke="#64748b"
            strokeWidth="1"
          />

          {/* Liseré inférieur doré */}
          <ellipse
            cx="80"
            cy="56"
            rx="72"
            ry="7"
            fill="none"
            stroke="url(#lampRimGrad)"
            strokeWidth="2.5"
          />

          {/* Intérieur de la cloche (s'illumine quand allumée) */}
          <ellipse
            cx="80"
            cy="57"
            rx="69"
            ry="6"
            className={cn(
              'transition-all duration-500',
              isOn
                ? 'fill-amber-300/40 filter drop-shadow-[0_2px_8px_rgba(251,191,36,0.8)]'
                : 'fill-slate-950/80'
            )}
          />
        </svg>

        {/* 4. Ampoule à filament apparente */}
        <div className="relative -mt-2 z-10 flex flex-col items-center">
          {/* Bulbe en verre */}
          <div
            className={cn(
              'w-7 h-9 rounded-b-full rounded-t-lg transition-all duration-300 relative flex items-center justify-center',
              isOn
                ? 'bg-gradient-to-b from-amber-100 via-amber-300 to-amber-400 shadow-[0_0_35px_12px_rgba(251,191,36,0.65),0_0_70px_25px_rgba(245,158,11,0.35)] ring-2 ring-amber-200'
                : 'bg-slate-800/80 border border-slate-700/60 shadow-inner'
            )}
          >
            {/* Filament lumineux intérieur */}
            <div
              className={cn(
                'w-1.5 h-3 rounded-full transition-all duration-300',
                isOn
                  ? 'bg-white shadow-[0_0_12px_#ffffff] animate-pulse'
                  : 'bg-slate-600/40'
              )}
            />
          </div>

          {/* Halo lumineux d'auréole quand allumée */}
          {isOn && (
            <div className="absolute -top-3 w-32 h-32 rounded-full bg-amber-400/20 blur-2xl pointer-events-none animate-pulse-subtle" />
          )}
        </div>
      </div>

      {/* 5. Cordon à tirette avec chaînette à billes et poire de préhension (Tirette) */}
      <div
        className="relative z-40 flex flex-col items-center cursor-grab active:cursor-grabbing"
        style={{
          transform: `translate3d(0, 0, 0)`,
          marginTop: '-6px',
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* SVG de la chaînette à billes étirable */}
        <svg
          width="24"
          height={currentCordLength}
          className="overflow-visible"
          style={{
            transition: isPulling ? 'none' : 'height 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          <defs>
            <radialGradient id="beadGrad" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="45%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#854d0e" />
            </radialGradient>
          </defs>

          {/* Fil guide */}
          <line
            x1="12"
            y1="0"
            x2="12"
            y2={currentCordLength - 14}
            stroke="#94a3b8"
            strokeWidth="1.2"
            strokeDasharray="1.5 2.5"
          />

          {/* Perles de la chaînette (espacées proportionnellement) */}
          {Array.from({ length: Math.max(3, Math.floor(currentCordLength / 9)) }).map((_, idx) => {
            const cy = idx * 8.5 + 4;
            if (cy > currentCordLength - 16) return null;
            return (
              <circle
                key={idx}
                cx="12"
                cy={cy}
                r="1.7"
                fill="url(#beadGrad)"
                stroke="#713f12"
                strokeWidth="0.4"
              />
            );
          })}
        </svg>

        {/* Poire / Gland de tirette ergonomique (Hit target élargi pour doigt mobile) */}
        <div
          className={cn(
            'relative -mt-2 group flex flex-col items-center p-2 rounded-full cursor-pointer transition-transform duration-150',
            isPulling ? 'scale-110' : 'hover:scale-105 active:scale-95'
          )}
          style={{
            touchAction: 'none',
          }}
        >
          {/* Poire en laiton usiné (SVG premium) */}
          <svg width="20" height="26" viewBox="0 0 20 26" className="filter drop-shadow-md">
            <defs>
              <linearGradient id="handleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ca8a04" />
                <stop offset="30%" stopColor="#fef08a" />
                <stop offset="60%" stopColor="#eab308" />
                <stop offset="100%" stopColor="#713f12" />
              </linearGradient>
            </defs>
            {/* Anneau supérieur */}
            <circle cx="10" cy="3" r="2.5" fill="url(#handleGrad)" stroke="#78350f" strokeWidth="0.5" />
            {/* Corps fuselé du pommeau */}
            <path
              d="M 8 5 L 12 5 Q 16 14 13 22 Q 10 25 7 22 Q 4 14 8 5 Z"
              fill="url(#handleGrad)"
              stroke="#78350f"
              strokeWidth="0.6"
            />
            {/* Reflet brillant de surface */}
            <path
              d="M 9 7 Q 11 13 10 20"
              stroke="#ffffff"
              strokeWidth="0.8"
              strokeLinecap="round"
              opacity="0.7"
            />
          </svg>

          {/* Halo d'indice quand éteint pour guider l'utilisateur */}
          {!isOn && (
            <span className="absolute -inset-1 rounded-full bg-cyan-400/25 blur-sm animate-ping pointer-events-none" />
          )}
        </div>

        {/* 6. Bulle d'indication didactique animée (visible quand éteinte) */}
        {!isOn && (
          <div
            className={cn(
              'absolute top-full mt-1.5 flex flex-col items-center transition-all duration-300 pointer-events-none whitespace-nowrap',
              isPulling ? 'opacity-30 scale-90' : 'opacity-100 animate-bounce'
            )}
          >
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/90 border border-cyan-400/50 text-cyan-300 text-[11px] font-bold shadow-lg shadow-cyan-500/20 backdrop-blur-md">
              <Sparkles size={12} className="text-cyan-400 animate-spin" />
              <span>Tirez pour allumer</span>
              <ArrowDown size={12} className="text-cyan-400" />
            </div>
            {/* Petite flèche indicatrice */}
            <div className="w-2 h-2 bg-slate-900 border-l border-t border-cyan-400/50 rotate-45 -mt-3.5" />
          </div>
        )}
      </div>
    </div>
  );
};

export default PullLamp;
