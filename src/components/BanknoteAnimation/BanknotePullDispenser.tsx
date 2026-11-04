import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Sparkles, ArrowDown, Lock, Unlock, ShieldCheck, Zap } from 'lucide-react';
import { BanknoteSvg } from './BanknoteSvg';
import { cn } from '../../lib/utils';

interface BanknotePullDispenserProps {
  isUnlocked: boolean;
  onToggleUnlock: (newState: boolean) => void;
  onTriggerRain?: () => void;
  className?: string;
  disabled?: boolean;
}

/**
 * Son mécanique de friction de billet qui glisse
 */
function playSlideSound() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(420, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.14);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {}
}

/**
 * Son de validation biométrique d'ouverture de coffre
 */
function playUnlockChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
    osc1.frequency.setValueAtTime(987.77, ctx.currentTime + 0.08); // B5
    gain1.gain.setValueAtTime(0.25, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start();
    osc1.stop(ctx.currentTime + 0.5);
  } catch {}
}

export const BanknotePullDispenser: React.FC<BanknotePullDispenserProps> = ({
  isUnlocked,
  onToggleUnlock,
  onTriggerRain,
  className,
  disabled = false,
}) => {
  const [pullOffset, setPullOffset] = useState<number>(0);
  const [isPulling, setIsPulling] = useState<boolean>(false);
  const dragStartYRef = useRef<number | null>(null);
  const currentPullRef = useRef<number>(0);

  const MAX_PULL = 65; // Déplacement max en pixels
  const TRIGGER_THRESHOLD = 26; // Seuil de déclenchement

  const triggerUnlock = useCallback(() => {
    if (disabled) return;
    const nextState = !isUnlocked;
    if (nextState) {
      playSlideSound();
      setTimeout(playUnlockChime, 100);
      if (onTriggerRain) onTriggerRain();
    } else {
      playSlideSound();
    }

    onToggleUnlock(nextState);

    // Animation de rebond
    setPullOffset(35);
    setTimeout(() => {
      setPullOffset(-10);
      setTimeout(() => {
        setPullOffset(4);
        setTimeout(() => setPullOffset(0), 100);
      }, 100);
    }, 100);
  }, [disabled, isUnlocked, onToggleUnlock, onTriggerRain]);

  // Événements tactiles (Smartphone)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    setIsPulling(true);
    dragStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling || dragStartYRef.current === null) return;
    const deltaY = e.touches[0].clientY - dragStartYRef.current;
    if (deltaY > 0) {
      const damped = Math.min(MAX_PULL, deltaY * 0.75);
      currentPullRef.current = damped;
      setPullOffset(damped);
    }
  };

  const handleTouchEnd = () => {
    if (!isPulling) return;
    setIsPulling(false);
    if (currentPullRef.current >= TRIGGER_THRESHOLD) {
      triggerUnlock();
    } else {
      setPullOffset(0);
    }
    dragStartYRef.current = null;
    currentPullRef.current = 0;
  };

  // Événements souris (Desktop)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled || e.button !== 0) return;
    setIsPulling(true);
    dragStartYRef.current = e.clientY;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (dragStartYRef.current === null) return;
      const deltaY = moveEvent.clientY - dragStartYRef.current;
      if (deltaY > 0) {
        const damped = Math.min(MAX_PULL, deltaY * 0.7);
        currentPullRef.current = damped;
        setPullOffset(damped);
      }
    };

    const handleMouseUp = () => {
      setIsPulling(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (currentPullRef.current >= TRIGGER_THRESHOLD) {
        triggerUnlock();
      } else if (currentPullRef.current < 4) {
        // Clic direct
        triggerUnlock();
      } else {
        setPullOffset(0);
      }
      dragStartYRef.current = null;
      currentPullRef.current = 0;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className={cn('relative flex flex-col items-center select-none z-30', className)}>
      {/* 1. DISTRIBUTEUR DE BILLETS HAUTE SÉCURITÉ (Fente métallique brossée & LED néon) */}
      <div className="relative flex flex-col items-center">
        {/* Boîtier supérieur titane brossé */}
        <div className="w-56 sm:w-64 h-7 rounded-t-2xl bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 border-t border-x border-slate-600/60 shadow-lg flex items-center justify-between px-4">
          <div className="flex items-center gap-1.5">
            <span className={cn('w-2 h-2 rounded-full transition-colors', isUnlocked ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' : 'bg-amber-400 animate-pulse')} />
            <span className="text-[10px] font-mono font-bold tracking-wider text-slate-300 uppercase">
              {isUnlocked ? 'COFFRE OUVERT' : 'CASHPILOT ATM-2026'}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[9px] font-mono text-cyan-400">
            <ShieldCheck size={11} />
            <span>AES-256</span>
          </div>
        </div>

        {/* Fente de sortie du billet (Slot avec lèvres lumineuses) */}
        <div className="relative w-52 sm:w-60 h-3 bg-slate-950 rounded-b-md border-b border-x border-slate-700/80 shadow-inner flex items-center justify-center overflow-hidden">
          <div
            className={cn(
              'w-full h-1 transition-all duration-500 blur-[1px]',
              isUnlocked ? 'bg-emerald-500/80 shadow-[0_0_12px_#10b981]' : 'bg-cyan-500/70 shadow-[0_0_8px_#06b6d4]'
            )}
          />
        </div>
      </div>

      {/* 2. LE BILLET DE BANQUE INTERACTIF EXTRACTIBLE (Tirette financière) */}
      <div
        className="relative -mt-1 cursor-grab active:cursor-grabbing transition-transform"
        style={{
          transform: `translate3d(0, ${pullOffset}px, 0)`,
          transition: isPulling ? 'none' : 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          touchAction: 'none',
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Carte du billet en position semi-insérée ou entièrement déployée */}
        <div
          className={cn(
            'relative w-44 sm:w-52 h-24 sm:h-28 transition-all duration-300 filter drop-shadow-2xl',
            isPulling ? 'scale-105' : 'hover:scale-102 active:scale-98',
            isUnlocked && 'opacity-90'
          )}
        >
          {/* SVG du billet de 500 € ou 100 € CashPilot */}
          <BanknoteSvg
            value={isUnlocked ? 100 : 500}
            className="w-full h-full"
            isGlowing={!isUnlocked}
          />

          {/* Onglet tactile de préhension en bas du billet */}
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/90 border border-amber-400/60 shadow-lg text-amber-300 text-[10px] font-bold backdrop-blur-md whitespace-nowrap cursor-pointer">
            {isUnlocked ? (
              <>
                <Unlock size={11} className="text-emerald-400" />
                <span>Verrouillé ? Cliquez pour refermer</span>
              </>
            ) : (
              <>
                <Zap size={11} className="text-amber-400 animate-bounce" />
                <span>Tirez le billet pour ouvrir</span>
                <ArrowDown size={11} className="text-amber-400 animate-bounce" />
              </>
            )}
          </div>
        </div>

        {/* Halo de rappel sous le billet quand verrouillé */}
        {!isUnlocked && (
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-cyan-500/15 border border-cyan-400/40 text-cyan-300 text-xs font-bold shadow-lg shadow-cyan-500/20 backdrop-blur-md animate-bounce pointer-events-none whitespace-nowrap">
            <Sparkles size={13} className="text-cyan-400 animate-spin" />
            <span>Glissez le billet vers le bas</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default BanknotePullDispenser;
