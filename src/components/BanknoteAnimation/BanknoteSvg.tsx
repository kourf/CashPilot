import React from 'react';
import { cn } from '../../lib/utils';

export type BanknoteValue = 50 | 100 | 200 | 500;

interface BanknoteSvgProps {
  value?: BanknoteValue;
  className?: string;
  width?: number | string;
  height?: number | string;
  isGlowing?: boolean;
}

const PALETTES: Record<BanknoteValue, {
  bgGradient: [string, string, string];
  border: string;
  accent: string;
  text: string;
  subtext: string;
  hologram: string;
  glow: string;
}> = {
  50: {
    bgGradient: ['#b45309', '#d97706', '#78350f'],
    border: '#f59e0b',
    accent: '#fef3c7',
    text: '#ffffff',
    subtext: '#fde68a',
    hologram: 'linear-gradient(135deg, rgba(254,240,138,0.8), rgba(245,158,11,0.6), rgba(6,182,212,0.7), rgba(254,240,138,0.8))',
    glow: 'rgba(245, 158, 11, 0.45)',
  },
  100: {
    bgGradient: ['#047857', '#059669', '#064e3b'],
    border: '#10b981',
    accent: '#d1fae5',
    text: '#ffffff',
    subtext: '#a7f3d0',
    hologram: 'linear-gradient(135deg, rgba(52,211,153,0.8), rgba(6,182,212,0.8), rgba(251,191,36,0.7), rgba(16,185,129,0.8))',
    glow: 'rgba(16, 185, 129, 0.45)',
  },
  200: {
    bgGradient: ['#a16207', '#ca8a04', '#713f12'],
    border: '#eab308',
    accent: '#fef9c3',
    text: '#ffffff',
    subtext: '#fef08a',
    hologram: 'linear-gradient(135deg, rgba(253,224,71,0.9), rgba(234,179,8,0.7), rgba(168,85,247,0.7), rgba(250,204,21,0.9))',
    glow: 'rgba(234, 179, 8, 0.45)',
  },
  500: {
    bgGradient: ['#4338ca', '#6366f1', '#312e81'],
    border: '#818cf8',
    accent: '#e0e7ff',
    text: '#ffffff',
    subtext: '#c7d2fe',
    hologram: 'linear-gradient(135deg, rgba(167,139,250,0.85), rgba(56,189,248,0.8), rgba(244,114,182,0.7), rgba(129,140,248,0.85))',
    glow: 'rgba(99, 102, 241, 0.45)',
  },
};

export const BanknoteSvg: React.FC<BanknoteSvgProps> = ({
  value = 100,
  className,
  width = '100%',
  height = '100%',
  isGlowing = false,
}) => {
  const p = PALETTES[value] || PALETTES[100];
  const uniqueId = `banknote-${value}-${Math.random().toString(36).substring(2, 7)}`;

  return (
    <svg
      viewBox="0 0 280 148"
      width={width}
      height={height}
      className={cn('select-none overflow-hidden rounded-xl filter drop-shadow-xl transition-all', className)}
      style={{
        boxShadow: isGlowing ? `0 0 30px ${p.glow}` : undefined,
      }}
    >
      <defs>
        {/* Dégradé de fond du billet */}
        <linearGradient id={`${uniqueId}-bg`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={p.bgGradient[0]} />
          <stop offset="50%" stopColor={p.bgGradient[1]} />
          <stop offset="100%" stopColor={p.bgGradient[2]} />
        </linearGradient>

        {/* Bande holographique iridescente de sécurité */}
        <linearGradient id={`${uniqueId}-holo`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
          <stop offset="25%" stopColor="#f472b6" stopOpacity="0.85" />
          <stop offset="50%" stopColor="#fbbf24" stopOpacity="0.9" />
          <stop offset="75%" stopColor="#34d399" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#818cf8" stopOpacity="0.8" />
        </linearGradient>

        {/* Guilloche / Motifs de sécurité anti-contrefaçon */}
        <pattern id={`${uniqueId}-guilloche`} width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="8" cy="8" r="7" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" />
          <path d="M 0,8 Q 8,0 16,8 Q 8,16 0,8" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.6" />
        </pattern>
      </defs>

      {/* Fond du billet avec bordure soignée */}
      <rect
        x="2"
        y="2"
        width="276"
        height="144"
        rx="10"
        fill={`url(#${uniqueId}-bg)`}
        stroke={p.border}
        strokeWidth="2.5"
      />

      {/* Texture guilloche en surimpression */}
      <rect
        x="4"
        y="4"
        width="272"
        height="140"
        rx="8"
        fill={`url(#${uniqueId}-guilloche)`}
      />

      {/* Filigrane central : Logo CashPilot discret & Rayons */}
      <g opacity="0.18">
        <circle cx="140" cy="74" r="42" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeDasharray="3 3" />
        <path
          d="M 125 60 L 155 60 L 148 88 L 132 88 Z"
          fill="#ffffff"
        />
        <text
          x="140"
          y="80"
          textAnchor="middle"
          fontSize="24"
          fontWeight="900"
          fill="#ffffff"
          fontFamily="system-ui, sans-serif"
        >
          CP
        </text>
      </g>

      {/* Bande de sécurité holographique verticale à droite */}
      <rect
        x="215"
        y="4"
        width="24"
        height="140"
        fill={`url(#${uniqueId}-holo)`}
        opacity="0.85"
      />
      {/* Symboles sur l'hologramme */}
      <g fill="#ffffff" opacity="0.9" textAnchor="middle" fontSize="9" fontWeight="bold">
        <text x="227" y="32">€</text>
        <text x="227" y="60">{value}</text>
        <text x="227" y="90">CP</text>
        <text x="227" y="120">★</text>
      </g>

      {/* Arche d'architecture européenne stylisée à gauche */}
      <g stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" fill="rgba(0,0,0,0.12)">
        <path d="M 28 120 L 28 65 Q 60 30 92 65 L 92 120 Z" />
        <path d="M 38 120 L 38 72 Q 60 48 82 72 L 82 120 Z" fill="rgba(255,255,255,0.06)" />
        <line x1="24" y1="120" x2="96" y2="120" strokeWidth="2.5" />
      </g>

      {/* Constellation des 12 étoiles européennes */}
      <g transform="translate(60, 80) scale(0.65)" fill={p.accent} opacity="0.85">
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i * 30 * Math.PI) / 180;
          const cx = 35 * Math.cos(angle);
          const cy = 35 * Math.sin(angle);
          return (
            <polygon
              key={i}
              points="0,-3.5 1,-1 3.5,-1 1.5,0.5 2.5,3 0,1.5 -2.5,3 -1.5,0.5 -3.5,-1 -1,-1"
              transform={`translate(${cx}, ${cy})`}
            />
          );
        })}
      </g>

      {/* En-tête : Banque Centrale CashPilot */}
      <text
        x="24"
        y="24"
        fontSize="9.5"
        fontWeight="800"
        letterSpacing="1.2"
        fill={p.subtext}
        fontFamily="system-ui, sans-serif"
      >
        CASHPILOT BANQUE EUROPÉENNE
      </text>

      {/* Sigle BCE / ECB / EZB multilingue */}
      <text
        x="24"
        y="35"
        fontSize="7"
        fontWeight="600"
        letterSpacing="0.8"
        fill="rgba(255,255,255,0.7)"
        fontFamily="monospace"
      >
        BCE ECB ЕЦБ 2026
      </text>

      {/* Grande valeur faciale (En bas à gauche) */}
      <text
        x="135"
        y="124"
        textAnchor="end"
        fontSize="46"
        fontWeight="900"
        fill={p.text}
        fontFamily="system-ui, -apple-system, sans-serif"
        filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.4))"
      >
        {value}
      </text>

      {/* Symbole Euro */}
      <text
        x="142"
        y="108"
        fontSize="22"
        fontWeight="bold"
        fill={p.accent}
        fontFamily="system-ui, sans-serif"
      >
        €
      </text>

      {/* Valeur faciale en haut à droite */}
      <text
        x="264"
        y="28"
        textAnchor="end"
        fontSize="20"
        fontWeight="900"
        fill={p.text}
        fontFamily="system-ui, sans-serif"
      >
        {value}
      </text>

      {/* Numéro de série de haute sécurité */}
      <text
        x="24"
        y="136"
        fontSize="7.5"
        fontWeight="bold"
        fontFamily="Courier, monospace"
        letterSpacing="1.8"
        fill="rgba(255,255,255,0.85)"
      >
        CP 2026 FR 88927-A
      </text>

      {/* Signature du Gouverneur CashPilot */}
      <g stroke="rgba(255,255,255,0.7)" strokeWidth="1" fill="none" opacity="0.8">
        <path d="M 152 132 Q 160 124 168 132 T 180 128" />
        <text x="152" y="140" fontSize="5" fill="rgba(255,255,255,0.6)" stroke="none">
          Le Gouverneur
        </text>
      </g>
    </svg>
  );
};

export default BanknoteSvg;
