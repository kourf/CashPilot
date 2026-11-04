import React, { useState, useCallback } from 'react';
import { CreditCard, CheckCircle2, ShieldCheck, ArrowDown, Sparkles, Zap, ArrowUp } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Atm3DTerminalProps {
  isCardInserted: boolean;
  onToggleCard: (inserted: boolean) => void;
  onTriggerRain?: () => void;
  className?: string;
  disabled?: boolean;
}

/**
 * Synthétise le bruit d'entraînement mécanique de la carte bancaire dans le DAB
 * suivi d'un double bip électronique de validation du code PIN.
 */
function playCardInsertSound() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // 1. Son du moteur d'avalement de la carte (bruit de rouleaux mécaniques)
    const bufferSize = ctx.sampleRate * 0.18;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin(i * 0.05);
    }
    const motor = ctx.createBufferSource();
    motor.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 680;
    filter.Q.value = 2.5;
    const motorGain = ctx.createGain();
    motorGain.gain.setValueAtTime(0.18, ctx.currentTime);
    motorGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    motor.connect(filter);
    filter.connect(motorGain);
    motorGain.connect(ctx.destination);
    motor.start();

    // 2. Double bip aigu de validation de carte bancaire (ATM Beep)
    setTimeout(() => {
      try {
        const beep1 = ctx.createOscillator();
        const beepGain1 = ctx.createGain();
        beep1.type = 'sine';
        beep1.frequency.setValueAtTime(1480, ctx.currentTime);
        beepGain1.gain.setValueAtTime(0.15, ctx.currentTime);
        beepGain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        beep1.connect(beepGain1);
        beepGain1.connect(ctx.destination);
        beep1.start();
        beep1.stop(ctx.currentTime + 0.08);

        setTimeout(() => {
          try {
            const beep2 = ctx.createOscillator();
            const beepGain2 = ctx.createGain();
            beep2.type = 'sine';
            beep2.frequency.setValueAtTime(1960, ctx.currentTime);
            beepGain2.gain.setValueAtTime(0.2, ctx.currentTime);
            beepGain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
            beep2.connect(beepGain2);
            beepGain2.connect(ctx.destination);
            beep2.start();
            beep2.stop(ctx.currentTime + 0.12);
          } catch {}
        }, 80);
      } catch {}
    }, 180);
  } catch {}
}

/**
 * Son d'éjection mécanique de la carte
 */
function playCardEjectSound() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(250, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch {}
}

export const Atm3DTerminal: React.FC<Atm3DTerminalProps> = ({
  isCardInserted,
  onToggleCard,
  onTriggerRain,
  className,
  disabled = false,
}) => {
  const [isInserting, setIsInserting] = useState<boolean>(false);

  const handleToggle = useCallback(() => {
    if (disabled || isInserting) return;

    if (!isCardInserted) {
      // Démarrage de l'animation d'insertion
      setIsInserting(true);
      playCardInsertSound();

      setTimeout(() => {
        setIsInserting(false);
        onToggleCard(true);
        if (onTriggerRain) onTriggerRain();
      }, 450);
    } else {
      // Éjection de la carte
      playCardEjectSound();
      onToggleCard(false);
    }
  }, [disabled, isInserting, isCardInserted, onToggleCard, onTriggerRain]);

  return (
    <div className={cn('relative flex flex-col items-center select-none z-30 w-full max-w-sm', className)}>
      {/* =========================================================================
          1. LE DISTRIBUTEUR AUTOMATIQUE DE BILLETS (DAB 3D APPLE LIQUID GLASS)
          ========================================================================= */}
      <div
        className={cn(
          'relative w-full rounded-3xl p-4 sm:p-5 border transition-all duration-500 shadow-2xl backdrop-blur-2xl',
          'bg-gradient-to-b from-[#141b2d]/95 via-[#0c111e]/95 to-[#070a14]/95',
          isCardInserted
            ? 'border-emerald-500/40 shadow-[0_15px_40px_rgba(16,185,129,0.2),inset_0_1px_1px_rgba(255,255,255,0.2)]'
            : 'border-slate-700/60 shadow-[0_15px_35px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.12)]'
        )}
        style={{
          transform: 'perspective(1000px) rotateX(2deg)',
        }}
      >
        {/* Bandeau supérieur de l'automate */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] mb-3">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'w-2.5 h-2.5 rounded-full transition-all duration-300',
                isCardInserted
                  ? 'bg-emerald-400 shadow-[0_0_10px_#10b981]'
                  : 'bg-cyan-400 animate-pulse shadow-[0_0_8px_#06b6d4]'
              )}
            />
            <span className="text-[11px] font-mono font-bold tracking-wider text-slate-200 uppercase">
              CASHPILOT DAB-2026
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/10 text-[9px] font-mono text-cyan-300">
            <ShieldCheck size={11} className="text-cyan-400" />
            <span>EMV 3D-SECURE</span>
          </div>
        </div>

        {/* Écran digital LCD de l'automate */}
        <div className="relative rounded-2xl bg-[#03060c] border border-slate-800 p-3 mb-4 shadow-inner overflow-hidden">
          {/* Lignes de balayage CRT légères */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/[0.02] to-transparent bg-[length:100%_4px]" />

          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-[9px] font-mono uppercase text-slate-500 tracking-wider">État Automate</p>
              <p
                className={cn(
                  'text-xs font-mono font-bold transition-colors mt-0.5',
                  isCardInserted ? 'text-emerald-400' : 'text-cyan-300'
                )}
              >
                {isCardInserted ? 'SESSION ACTIVE • PIN VALIDÉ ✅' : 'EN ATTENTE DE CARTE...'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-mono uppercase text-slate-500">Devises</p>
              <p className="text-xs font-mono font-bold text-amber-400">EUR € • CHF 🇨🇭</p>
            </div>
          </div>

          {/* Message de consigne sur l'écran LCD */}
          <div className="mt-2 pt-2 border-t border-slate-900 flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>{isCardInserted ? 'Distribution de devises active' : 'Cliquez sur le bouton pour insérer votre CB'}</span>
            <span className={cn('w-1.5 h-1.5 rounded-full', isCardInserted ? 'bg-emerald-400' : 'bg-amber-400 animate-ping')} />
          </div>
        </div>

        {/* =========================================================================
            2. LA FENTE DU DISTRIBUTEUR & L'ANIMATION DE LA CARTE BANCAIRE (CB)
            ========================================================================= */}
        <div className="relative flex flex-col items-center">
          {/* Fente métallique lumineuse pour insérer la carte */}
          <div className="relative w-56 sm:w-64 h-3 rounded-full bg-slate-950 border border-slate-700/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.9)] flex items-center justify-center overflow-hidden z-20">
            {/* Guide LED lumineux vert/cyan au-dessus de la fente */}
            <div
              className={cn(
                'w-44 h-1 rounded-full transition-all duration-300 blur-[0.5px]',
                isCardInserted
                  ? 'bg-emerald-400 shadow-[0_0_12px_#10b981]'
                  : 'bg-cyan-400 shadow-[0_0_10px_#06b6d4] animate-pulse'
              )}
            />
          </div>

          {/* Indication fléchée vers la fente quand non-insérée */}
          {!isCardInserted && !isInserting && (
            <div className="flex items-center gap-1 text-[10px] font-bold text-cyan-300 mt-1 mb-1 animate-bounce">
              <ArrowDown size={11} />
              <span>Fente d'insertion carte</span>
              <ArrowDown size={11} />
            </div>
          )}

          {/* CARTE BANCAIRE VIP CASHPILOT EN 3D */}
          <div
            className={cn(
              'relative w-48 sm:w-56 h-28 sm:h-32 rounded-2xl transition-all duration-500 shadow-2xl p-3 flex flex-col justify-between overflow-hidden',
              'bg-gradient-to-tr from-[#0a0d14] via-[#161c2c] to-[#0a0d14] border border-amber-400/40 text-white',
              // Animation physique d'insertion dans la fente
              (isCardInserted || isInserting)
                ? '-translate-y-20 scale-75 opacity-20 pointer-events-none'
                : 'translate-y-0 scale-100 opacity-100 hover:scale-102 cursor-pointer'
            )}
            onClick={handleToggle}
            title="Cliquez pour insérer la carte bancaire"
          >
            {/* Liseré de réflexion dorée */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/80 to-transparent" />

            {/* En-tête de la carte : Logo CashPilot & Monogramme */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-amber-400 to-amber-600 flex items-center justify-center font-black text-[10px] text-slate-950 shadow-md">
                  CP
                </div>
                <span className="text-[11px] font-black tracking-wider text-slate-200">CASHPILOT VIP</span>
              </div>
              <span className="text-[10px] font-mono font-bold text-amber-400">PREMIUM</span>
            </div>

            {/* Puce EMV dorée & Logo Sans-Contact NFC */}
            <div className="flex items-center gap-3 my-1">
              {/* Puce dorée vectorielle avec pistes */}
              <div className="w-8 h-6 rounded-md bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 border border-amber-600/80 shadow-inner flex items-center justify-center relative overflow-hidden">
                <div className="w-full h-px bg-amber-700/60" />
                <div className="absolute inset-y-0 left-1/3 w-px bg-amber-700/60" />
                <div className="absolute inset-y-0 right-1/3 w-px bg-amber-700/60" />
              </div>

              {/* Ondes sans contact NFC */}
              <div className="flex items-center text-slate-400">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 8.5a7 7 0 0 1 0 7" />
                  <path d="M8.5 6a10.5 10.5 0 0 1 0 12" />
                  <path d="M12 3.5a14 14 0 0 1 0 17" />
                </svg>
              </div>
            </div>

            {/* Numéro embossé & Titulaire */}
            <div className="flex items-end justify-between font-mono">
              <div>
                <p className="text-[10px] tracking-widest text-slate-300 font-bold">•••• 4508 2026</p>
                <p className="text-[8px] uppercase text-slate-400">MEMBRE PRIVILÈGE</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-bold text-amber-300">EUR / CHF</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bouche d'éjection des billets en bas de l'automate */}
        <div className="mt-3 pt-3 border-t border-white/[0.08] flex items-center justify-between text-[10px] text-slate-400 font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Distribution automatique</span>
          </div>
          <span className="text-emerald-400 font-bold">Billets réels EUR & CHF</span>
        </div>
      </div>

      {/* =========================================================================
          3. LE BOUTON SIMPLE & EXPLICITE DEMANDÉ PAR L'UTILISATEUR
          ========================================================================= */}
      <div className="w-full mt-3 sm:mt-4">
        <button
          type="button"
          onClick={handleToggle}
          disabled={disabled || isInserting}
          className={cn(
            'w-full py-3.5 px-5 rounded-2xl font-bold text-xs sm:text-sm shadow-xl transition-all flex items-center justify-center gap-2.5 cursor-pointer active:scale-95 disabled:opacity-50 border',
            isCardInserted
              ? 'bg-gradient-to-r from-amber-600/30 via-slate-800 to-slate-900 hover:from-amber-600/40 text-amber-300 border-amber-500/35 shadow-amber-500/10'
              : 'bg-gradient-to-r from-emerald-500 via-cyan-500 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 text-white border-white/25 shadow-emerald-500/25 animate-pulse-subtle'
          )}
        >
          {isInserting ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              <span>Insertion de la carte en cours...</span>
            </>
          ) : isCardInserted ? (
            <>
              <CreditCard size={17} className="text-amber-400" />
              <span>⏏️ Éjecter la carte CashPilot (Reverrouiller)</span>
            </>
          ) : (
            <>
              <CreditCard size={18} className="text-white" />
              <span>💳 Insérer ma Carte CashPilot</span>
              <Sparkles size={16} className="text-amber-300 animate-spin" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default Atm3DTerminal;
