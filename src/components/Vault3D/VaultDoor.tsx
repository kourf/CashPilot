import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Lock, Unlock, Sparkles, Shield, RotateCw } from 'lucide-react';
import { cn } from '../../lib/utils';

interface VaultDoorProps {
  isOpen: boolean;
  onToggleOpen: (open: boolean) => void;
  className?: string;
  disabled?: boolean;
}

/**
 * Synthétise les bruits d'engrenages et cliquetis de combinaison d'un coffre de banque suisse
 */
function playTumblerSounds() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // Série de 5 micro-clics rapides de combinaison mécanique
    for (let i = 0; i < 5; i++) {
      const delay = i * 0.07;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1200 + i * 140, ctx.currentTime + delay);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + delay + 0.025);
      gain.gain.setValueAtTime(0.12, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.025);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.03);
    }
  } catch {}
}

/**
 * Bruit lourd de rétraction des pênes métalliques massifs (Clank!)
 */
function playBoltsRetractSound() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // Impact métallique sourd
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(140, ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + 0.22);
    gain1.gain.setValueAtTime(0.35, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start();
    osc1.stop(ctx.currentTime + 0.25);

    // Résonance métallique aiguë
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(840, ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.18);
    gain2.gain.setValueAtTime(0.18, ctx.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start();
    osc2.stop(ctx.currentTime + 0.2);
  } catch {}
}

/**
 * Grésillement hydraulique d'ouverture de porte lourde
 */
function playDoorHydraulicSound() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(65, ctx.currentTime + 0.45);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch {}
}

export const VaultDoor: React.FC<VaultDoorProps> = ({
  isOpen,
  onToggleOpen,
  className,
  disabled = false,
}) => {
  const [wheelRotation, setWheelRotation] = useState<number>(0);
  const [boltsRetracted, setBoltsRetracted] = useState<boolean>(isOpen);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);

  useEffect(() => {
    setBoltsRetracted(isOpen);
    setWheelRotation(isOpen ? 360 : 0);
  }, [isOpen]);

  const handleActivate = useCallback(() => {
    if (disabled || isAnimating) return;

    if (!isOpen) {
      // SÉQUENCE D'OUVERTURE DU COFFRE
      setIsAnimating(true);
      playTumblerSounds();

      // 1. Rotation du volant de manœuvre à 3 branches (0 -> 360°)
      setWheelRotation((prev) => prev + 360);

      // 2. Rétraction des 8 pênes métalliques
      setTimeout(() => {
        playBoltsRetractSound();
        setBoltsRetracted(true);

        // 3. Pivotement 3D de la lourde porte
        setTimeout(() => {
          playDoorHydraulicSound();
          setIsAnimating(false);
          onToggleOpen(true);
        }, 320);
      }, 420);
    } else {
      // SÉQUENCE DE FERMETURE DU COFFRE
      setIsAnimating(true);
      playDoorHydraulicSound();
      onToggleOpen(false);

      setTimeout(() => {
        playBoltsRetractSound();
        setBoltsRetracted(false);
        setWheelRotation((prev) => prev - 360);
        setTimeout(() => {
          setIsAnimating(false);
        }, 350);
      }, 350);
    }
  }, [disabled, isAnimating, isOpen, onToggleOpen]);

  // Positions des 8 pênes de verrouillage cylindriques disposés à 45°
  const boltAngles = [0, 45, 90, 135, 180, 225, 270, 315];

  return (
    <div className={cn('relative flex flex-col items-center select-none z-30', className)}>
      {/* =========================================================================
          CONTENEUR 3D AVEC PERSPECTIVE SPATIALE APPLE VISIONOS
          ========================================================================= */}
      <div
        className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center cursor-pointer group"
        style={{
          perspective: '1200px',
        }}
        onClick={handleActivate}
      >
        {/* Halo d'ambiance doré / émeraude derrière le coffre */}
        <div
          className={cn(
            'absolute inset-0 rounded-full blur-2xl transition-all duration-700 pointer-events-none',
            isOpen
              ? 'bg-gradient-to-tr from-amber-400/30 via-emerald-400/25 to-cyan-400/20 opacity-100 scale-110'
              : 'bg-slate-700/20 opacity-40 group-hover:opacity-70'
          )}
        />

        {/* 1. CHÂSSIS EXTÉRIEUR FIXE DU COFFRE (Cadre blindé riveté) */}
        <svg
          viewBox="0 0 280 280"
          className="absolute inset-0 w-full h-full overflow-visible pointer-events-none filter drop-shadow-[0_20px_40px_rgba(0,0,0,0.8)]"
        >
          <defs>
            {/* Dégradé acier titane pour le cadre extérieur */}
            <radialGradient id="vaultOuterRimGrad" cx="50%" cy="50%" r="50%">
              <stop offset="70%" stopColor="#0f172a" />
              <stop offset="85%" stopColor="#334155" />
              <stop offset="95%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#020617" />
            </radialGradient>

            <linearGradient id="vaultGoldRing" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ca8a04" />
              <stop offset="35%" stopColor="#fef08a" />
              <stop offset="70%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#854d0e" />
            </linearGradient>

            <linearGradient id="vaultBoltSteel" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#94a3b8" />
              <stop offset="40%" stopColor="#f8fafc" />
              <stop offset="70%" stopColor="#64748b" />
              <stop offset="100%" stopColor="#334155" />
            </linearGradient>
          </defs>

          {/* Anneau extérieur massif */}
          <circle cx="140" cy="140" r="134" fill="url(#vaultOuterRimGrad)" stroke="#475569" strokeWidth="2.5" />
          <circle cx="140" cy="140" r="126" fill="none" stroke="url(#vaultGoldRing)" strokeWidth="1.5" />

          {/* Rivets d'acier brossé sur le périmètre (16 rivets) */}
          {Array.from({ length: 16 }).map((_, i) => {
            const angle = (i * 22.5 * Math.PI) / 180;
            const rx = 140 + 130 * Math.cos(angle);
            const ry = 140 + 130 * Math.sin(angle);
            return (
              <g key={i} transform={`translate(${rx}, ${ry})`}>
                <circle cx="0" cy="0" r="3.5" fill="#64748b" stroke="#0f172a" strokeWidth="0.8" />
                <circle cx="-1" cy="-1" r="1.2" fill="#e2e8f0" />
              </g>
            );
          })}

          {/* Charnières massives sur le côté gauche */}
          <g transform="translate(4, 90)">
            <rect x="0" y="0" width="12" height="32" rx="3" fill="#1e293b" stroke="#475569" strokeWidth="1" />
            <rect x="2" y="4" width="8" height="24" rx="2" fill="url(#vaultGoldRing)" />
            <circle cx="6" cy="16" r="2.5" fill="#0f172a" />
          </g>
          <g transform="translate(4, 158)">
            <rect x="0" y="0" width="12" height="32" rx="3" fill="#1e293b" stroke="#475569" strokeWidth="1" />
            <rect x="2" y="4" width="8" height="24" rx="2" fill="url(#vaultGoldRing)" />
            <circle cx="6" cy="16" r="2.5" fill="#0f172a" />
          </g>
        </svg>

        {/* 2. LA PORTE CIRCULAIRE MOBILE (S'ouvre en rotation 3D sur l'axe Y) */}
        <div
          className="relative w-[236px] h-[236px] sm:w-[256px] sm:h-[256px] rounded-full transition-transform duration-700 ease-out"
          style={{
            transformStyle: 'preserve-3d',
            transformOrigin: 'left center',
            transform: isOpen ? 'rotateY(-78deg) scale(0.96)' : 'rotateY(0deg) scale(1)',
          }}
        >
          {/* Surface de la porte en acier brossé isotrope */}
          <svg viewBox="0 0 240 240" className="w-full h-full overflow-visible">
            <defs>
              <radialGradient id="doorPlateGrad" cx="38%" cy="32%" r="65%">
                <stop offset="0%" stopColor="#475569" />
                <stop offset="35%" stopColor="#334155" />
                <stop offset="70%" stopColor="#1e293b" />
                <stop offset="100%" stopColor="#0f172a" />
              </radialGradient>
            </defs>

            {/* Disque principal de la porte */}
            <circle cx="120" cy="120" r="114" fill="url(#doorPlateGrad)" stroke="#64748b" strokeWidth="2" />

            {/* Cannelures concentriques de blindage */}
            <circle cx="120" cy="120" r="102" fill="none" stroke="#475569" strokeWidth="1.2" strokeDasharray="4 2" />
            <circle cx="120" cy="120" r="88" fill="none" stroke="url(#vaultGoldRing)" strokeWidth="1.5" />
            <circle cx="120" cy="120" r="74" fill="none" stroke="#1e293b" strokeWidth="3" />

            {/* 3. LES 8 PÊNES METALLIQUES RADIAUX (Sortis ou rétractés) */}
            {boltAngles.map((deg, idx) => {
              const rad = (deg * Math.PI) / 180;
              const boltDist = boltsRetracted ? 88 : 106;
              const bx = 120 + boltDist * Math.cos(rad);
              const by = 120 + boltDist * Math.sin(rad);
              return (
                <g
                  key={idx}
                  transform={`translate(${bx}, ${by}) rotate(${deg})`}
                  style={{
                    transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  }}
                >
                  {/* Pêne cylindrique massif */}
                  <rect
                    x="-6"
                    y="-9"
                    width="12"
                    height="18"
                    rx="3"
                    fill="url(#vaultBoltSteel)"
                    stroke="#1e293b"
                    strokeWidth="0.8"
                  />
                  {/* Chanfrein biseauté */}
                  <rect x="-4" y="-7" width="8" height="3" rx="1" fill="#ffffff" opacity="0.7" />
                </g>
              );
            })}

            {/* Inscription de sécurité en arche supérieure */}
            <path id="vaultTextPath" d="M 45 120 A 75 75 0 0 1 195 120" fill="none" />
            <text fill="#94a3b8" fontSize="7" fontWeight="bold" letterSpacing="1.8">
              <textPath href="#vaultTextPath" startOffset="50%" textAnchor="middle">
                CASHPILOT PRIVATE SWISS VAULT
              </textPath>
            </text>

            {/* Mentions de certification inférieure */}
            <text
              x="120"
              y="166"
              textAnchor="middle"
              fontSize="6"
              fontWeight="bold"
              fill="#64748b"
              fontFamily="monospace"
              letterSpacing="1.2"
            >
              GENÈVE • ZÜRICH • CLASSE VII
            </text>
          </svg>

          {/* =========================================================================
              4. LE VOLANT DE MANŒUVRE À 3 BRANCHES EN LAITON POLI (Tourne en 3D)
              ========================================================================= */}
          <div
            className="absolute inset-0 flex items-center justify-center transition-transform duration-500"
            style={{
              transform: `rotate(${wheelRotation}deg)`,
              transitionTimingFunction: 'cubic-bezier(0.2, 0.9, 0.3, 1.2)',
            }}
          >
            <svg viewBox="0 0 140 140" className="w-32 h-32 sm:w-36 sm:h-36 overflow-visible filter drop-shadow-xl">
              <defs>
                <linearGradient id="vaultSpokeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ca8a04" />
                  <stop offset="30%" stopColor="#fef08a" />
                  <stop offset="60%" stopColor="#eab308" />
                  <stop offset="100%" stopColor="#713f12" />
                </linearGradient>
              </defs>

              {/* Les 3 branches maîtresses du volant (120° d'écart) */}
              {[0, 120, 240].map((angle, i) => (
                <g key={i} transform={`rotate(${angle} 70 70)`}>
                  {/* Branche fuselée en laiton */}
                  <rect x="67" y="16" width="6" height="54" rx="2.5" fill="url(#vaultSpokeGrad)" stroke="#78350f" strokeWidth="0.8" />
                  <line x1="70" y1="20" x2="70" y2="65" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" opacity="0.8" />

                  {/* Poignée sphérique extérieure (Boule de préhension ergonomique) */}
                  <circle cx="70" cy="14" r="8" fill="url(#vaultSpokeGrad)" stroke="#78350f" strokeWidth="1" />
                  <circle cx="68" cy="12" r="3" fill="#ffffff" opacity="0.6" />
                </g>
              ))}

              {/* Moyeu central du volant avec cadran à combinaison */}
              <circle cx="70" cy="70" r="24" fill="#0f172a" stroke="#ca8a04" strokeWidth="2.5" />
              <circle cx="70" cy="70" r="20" fill="#1e293b" />

              {/* Graduations du cadran à combinaison */}
              {Array.from({ length: 12 }).map((_, idx) => {
                const a = (idx * 30 * Math.PI) / 180;
                const x1 = 70 + 16 * Math.cos(a);
                const y1 = 70 + 16 * Math.sin(a);
                const x2 = 70 + 19 * Math.cos(a);
                const y2 = 70 + 19 * Math.sin(a);
                return <line key={idx} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fef08a" strokeWidth="1" />;
              })}

              {/* Cœur central : Monogramme CashPilot */}
              <circle cx="70" cy="70" r="10" fill="url(#vaultSpokeGrad)" />
              <text
                x="70"
                y="73.5"
                textAnchor="middle"
                fontSize="8"
                fontWeight="900"
                fill="#0f172a"
                fontFamily="system-ui, sans-serif"
              >
                CP
              </text>
            </svg>
          </div>

          {/* LED de statut du coffre */}
          <div className="absolute top-8 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-950/80 border border-slate-700/80 shadow-md">
            <span
              className={cn(
                'w-2 h-2 rounded-full transition-colors duration-300',
                isOpen ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' : 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'
              )}
            />
            <span className="text-[9px] font-mono font-bold text-slate-300 uppercase">
              {isOpen ? 'DÉVERROUILLÉ' : 'VERROUILLÉ'}
            </span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          5. BOUTON CLAIR & ACTIONNABLE SOUS LE COFFRE
          ========================================================================= */}
      <div className="mt-4 flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={handleActivate}
          disabled={disabled || isAnimating}
          className={cn(
            'py-3 px-6 rounded-2xl font-bold text-xs sm:text-sm shadow-xl transition-all flex items-center justify-center gap-2.5 cursor-pointer active:scale-95 disabled:opacity-50 border backdrop-blur-md',
            isOpen
              ? 'bg-slate-900/85 hover:bg-slate-800 text-amber-300 border-amber-500/40 shadow-amber-500/10'
              : 'bg-gradient-to-r from-amber-500 via-emerald-500 to-cyan-500 hover:from-amber-400 hover:to-cyan-400 text-slate-950 font-black border-amber-300/60 shadow-amber-500/25 animate-pulse-subtle'
          )}
        >
          {isAnimating ? (
            <>
              <RotateCw size={16} className="animate-spin text-slate-950" />
              <span>Rotation des pênes de sécurité...</span>
            </>
          ) : isOpen ? (
            <>
              <Lock size={16} className="text-amber-400" />
              <span>🔒 Refermer le Coffre-Fort</span>
            </>
          ) : (
            <>
              <Unlock size={17} className="text-slate-950" />
              <span>🔓 Tourner le volant & Ouvrir le Coffre</span>
              <Sparkles size={15} className="text-slate-950 animate-bounce" />
            </>
          )}
        </button>

        {!isOpen && (
          <p className="text-[11px] text-slate-400 flex items-center gap-1.5 font-medium">
            <span>Vous pouvez aussi cliquer directement sur le volant doré</span>
          </p>
        )}
      </div>
    </div>
  );
};

export default VaultDoor;
