import React from 'react';
import { cn } from '../../lib/utils';

export type CurrencyType = 'EUR' | 'CHF';
export type BanknoteValue = 50 | 100 | 200;

interface BanknoteSvgProps {
  currency?: CurrencyType;
  value?: BanknoteValue;
  className?: string;
  width?: number | string;
  height?: number | string;
  isGlowing?: boolean;
}

/**
 * Palettes réalistes des billets officiels en circulation
 */
const EUR_PALETTES: Record<BanknoteValue, {
  bgGradient: [string, string, string];
  border: string;
  accent: string;
  text: string;
  subtext: string;
  era: string;
}> = {
  50: {
    bgGradient: ['#b45309', '#d97706', '#92400e'],
    border: '#f59e0b',
    accent: '#fef3c7',
    text: '#ffffff',
    subtext: '#fde68a',
    era: 'Renaissance',
  },
  100: {
    bgGradient: ['#047857', '#059669', '#065f46'],
    border: '#10b981',
    accent: '#d1fae5',
    text: '#ffffff',
    subtext: '#a7f3d0',
    era: 'Baroque & Rococo',
  },
  200: {
    bgGradient: ['#a16207', '#ca8a04', '#854d0e'],
    border: '#eab308',
    accent: '#fef9c3',
    text: '#ffffff',
    subtext: '#fef08a',
    era: 'Art Nouveau - Fer & Verre',
  },
};

const CHF_PALETTES: Record<BanknoteValue, {
  bgGradient: [string, string, string];
  border: string;
  accent: string;
  text: string;
  theme: string;
}> = {
  50: {
    bgGradient: ['#15803d', '#22c55e', '#166534'], // Vert suisse pissenlit & vent
    border: '#4ade80',
    accent: '#bbf7d0',
    text: '#ffffff',
    theme: 'Le Vent & Le Mouvement',
  },
  100: {
    bgGradient: ['#1d4ed8', '#3b82f6', '#1e40af'], // Bleu valais eau des glaciers
    border: '#60a5fa',
    accent: '#dbeafe',
    text: '#ffffff',
    theme: 'L’Eau & Les Glaciers',
  },
  200: {
    bgGradient: ['#78350f', '#92400e', '#571c08'], // Brun matière & physique CERN
    border: '#b45309',
    accent: '#fed7aa',
    text: '#ffffff',
    theme: 'La Matière & Le CERN',
  },
};

export const BanknoteSvg: React.FC<BanknoteSvgProps> = ({
  currency = 'EUR',
  value = 100,
  className,
  width = '100%',
  height = '100%',
  isGlowing = false,
}) => {
  const uniqueId = `note-${currency}-${value}-${Math.random().toString(36).substring(2, 6)}`;

  // =========================================================================
  // 1. BILLET VERTICAL SUISSE (CHF - 9e série de la Banque Nationale Suisse)
  // =========================================================================
  if (currency === 'CHF') {
    const p = CHF_PALETTES[value] || CHF_PALETTES[50];
    return (
      <svg
        viewBox="0 0 140 250"
        width={width}
        height={height}
        className={cn('select-none overflow-hidden rounded-xl filter drop-shadow-xl transition-all', className)}
        style={{
          boxShadow: isGlowing ? `0 0 25px ${p.border}66` : undefined,
        }}
      >
        <defs>
          <linearGradient id={`${uniqueId}-chf-bg`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={p.bgGradient[0]} />
            <stop offset="50%" stopColor={p.bgGradient[1]} />
            <stop offset="100%" stopColor={p.bgGradient[2]} />
          </linearGradient>

          {/* Bande de sécurité suisse brillante */}
          <linearGradient id={`${uniqueId}-chf-holo`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
            <stop offset="35%" stopColor="#fbbf24" stopOpacity="0.75" />
            <stop offset="70%" stopColor="#38bdf8" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.85" />
          </linearGradient>

          {/* Micro-lignes de sécurité suisses */}
          <pattern id={`${uniqueId}-chf-lines`} width="8" height="8" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="8" y2="8" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" />
          </pattern>
        </defs>

        {/* Fond du billet vertical suisse */}
        <rect x="2" y="2" width="136" height="246" rx="8" fill={`url(#${uniqueId}-chf-bg)`} stroke={p.border} strokeWidth="2" />
        <rect x="4" y="4" width="132" height="242" rx="6" fill={`url(#${uniqueId}-chf-lines)`} />

        {/* Croix Suisse emblématique en haut à droite */}
        <g transform="translate(108, 14)">
          <rect x="0" y="0" width="18" height="18" rx="3.5" fill="#dc2626" />
          {/* Bras de la croix blanche */}
          <rect x="7" y="3" width="4" height="12" fill="#ffffff" />
          <rect x="3" y="7" width="12" height="4" fill="#ffffff" />
        </g>

        {/* Mentions officielles de la Banque Nationale Suisse en 4 langues nationales */}
        <text x="12" y="20" fontSize="6" fontWeight="bold" fill={p.accent} fontFamily="system-ui, sans-serif" letterSpacing="0.8">
          BANQUE NATIONALE SUISSE
        </text>
        <text x="12" y="28" fontSize="4.8" fill="rgba(255,255,255,0.8)" fontFamily="system-ui, sans-serif">
          BANCA NAZIUNALA SVIZRA • BNS
        </text>

        {/* Bande de sécurité holographique verticale suisse */}
        <rect x="18" y="36" width="14" height="185" fill={`url(#${uniqueId}-chf-holo)`} opacity="0.85" rx="2" />
        <g fill="#ffffff" opacity="0.9" textAnchor="middle" fontSize="8" fontWeight="900">
          <text x="25" y="60">CHF</text>
          <text x="25" y="100">{value}</text>
          <text x="25" y="140">🇨🇭</text>
          <text x="25" y="180">CP</text>
        </g>

        {/* Motif central suisse : main tendue tenant l'élément (Vent/Eau/Matière) */}
        <g transform="translate(68, 90)" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" fill="none">
          {/* Rayons de globe terrestre suisse */}
          <circle cx="15" cy="15" r="32" stroke="rgba(255,255,255,0.25)" strokeDasharray="3 3" />
          <circle cx="15" cy="15" r="22" stroke="rgba(255,255,255,0.2)" />
          {/* Dessin géométrique */}
          <path d="M 0 35 Q 25 10 40 30 T 70 20" strokeWidth="1.8" stroke="rgba(255,255,255,0.6)" />
          <path d="M 10 45 Q 35 25 50 40 T 80 30" strokeWidth="1.2" stroke="rgba(255,255,255,0.4)" />
        </g>

        {/* Valeur faciale imposante au centre vertical */}
        <text
          x="126"
          y="180"
          textAnchor="end"
          fontSize="48"
          fontWeight="900"
          fill="#ffffff"
          fontFamily="system-ui, -apple-system, sans-serif"
          filter="drop-shadow(0px 2px 5px rgba(0,0,0,0.4))"
        >
          {value}
        </text>

        {/* Libellé "Francs / Franchi" */}
        <text x="126" y="196" textAnchor="end" fontSize="11" fontWeight="bold" fill={p.accent}>
          FRANCS SUISSES
        </text>

        {/* Numéro de série suisse vertical */}
        <g transform="translate(12, 238)">
          <text fontSize="6.5" fontWeight="bold" fontFamily="monospace" fill="rgba(255,255,255,0.85)" letterSpacing="1">
            SN 19H0889241-BNS
          </text>
        </g>

        {/* Thème du billet */}
        <text x="126" y="238" textAnchor="end" fontSize="5.5" fill="rgba(255,255,255,0.65)" fontFamily="system-ui, sans-serif">
          {p.theme}
        </text>
      </svg>
    );
  }

  // =========================================================================
  // 2. BILLET HORIZONTAL EURO (€ - Banque Centrale Européenne)
  // =========================================================================
  const p = EUR_PALETTES[value] || EUR_PALETTES[100];
  return (
    <svg
      viewBox="0 0 280 148"
      width={width}
      height={height}
      className={cn('select-none overflow-hidden rounded-xl filter drop-shadow-xl transition-all', className)}
      style={{
        boxShadow: isGlowing ? `0 0 30px ${p.border}77` : undefined,
      }}
    >
      <defs>
        <linearGradient id={`${uniqueId}-eur-bg`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={p.bgGradient[0]} />
          <stop offset="50%" stopColor={p.bgGradient[1]} />
          <stop offset="100%" stopColor={p.bgGradient[2]} />
        </linearGradient>

        {/* Bande holographique Euro */}
        <linearGradient id={`${uniqueId}-eur-holo`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
          <stop offset="25%" stopColor="#f472b6" stopOpacity="0.85" />
          <stop offset="50%" stopColor="#fbbf24" stopOpacity="0.9" />
          <stop offset="75%" stopColor="#34d399" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#818cf8" stopOpacity="0.8" />
        </linearGradient>

        <pattern id={`${uniqueId}-eur-guilloche`} width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="8" cy="8" r="7" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" />
          <path d="M 0,8 Q 8,0 16,8 Q 8,16 0,8" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.6" />
        </pattern>
      </defs>

      {/* Fond du billet avec bordure soignée */}
      <rect x="2" y="2" width="276" height="144" rx="10" fill={`url(#${uniqueId}-eur-bg)`} stroke={p.border} strokeWidth="2.5" />
      <rect x="4" y="4" width="272" height="140" rx="8" fill={`url(#${uniqueId}-eur-guilloche)`} />

      {/* Filigrane central et logo CashPilot */}
      <g opacity="0.18">
        <circle cx="140" cy="74" r="42" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M 125 60 L 155 60 L 148 88 L 132 88 Z" fill="#ffffff" />
        <text x="140" y="80" textAnchor="middle" fontSize="24" fontWeight="900" fill="#ffffff" fontFamily="system-ui, sans-serif">
          CP
        </text>
      </g>

      {/* Bande de sécurité holographique verticale à droite */}
      <rect x="215" y="4" width="24" height="140" fill={`url(#${uniqueId}-eur-holo)`} opacity="0.85" />
      <g fill="#ffffff" opacity="0.9" textAnchor="middle" fontSize="9" fontWeight="bold">
        <text x="227" y="32">€</text>
        <text x="227" y="60">{value}</text>
        <text x="227" y="90">BCE</text>
        <text x="227" y="120">★</text>
      </g>

      {/* Arche d'architecture européenne selon l'époque */}
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

      {/* En-tête : Banque Centrale Européenne */}
      <text x="24" y="24" fontSize="9.5" fontWeight="800" letterSpacing="1.2" fill={p.subtext} fontFamily="system-ui, sans-serif">
        BANQUE CENTRALE EUROPÉENNE
      </text>
      <text x="24" y="35" fontSize="7" fontWeight="600" letterSpacing="0.8" fill="rgba(255,255,255,0.7)" fontFamily="monospace">
        BCE ECB EZB EKP 2026
      </text>

      {/* Grande valeur faciale */}
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
      <text x="142" y="108" fontSize="22" fontWeight="bold" fill={p.accent} fontFamily="system-ui, sans-serif">
        €
      </text>

      {/* Valeur faciale en haut à droite */}
      <text x="264" y="28" textAnchor="end" fontSize="20" fontWeight="900" fill={p.text} fontFamily="system-ui, sans-serif">
        {value}
      </text>

      {/* Numéro de série officiel Euro */}
      <text x="24" y="136" fontSize="7.5" fontWeight="bold" fontFamily="Courier, monospace" letterSpacing="1.8" fill="rgba(255,255,255,0.85)">
        VA 2026 889274-EUR
      </text>

      {/* Style architectural */}
      <text x="152" y="138" fontSize="6.5" fill="rgba(255,255,255,0.7)" fontFamily="system-ui, sans-serif">
        {p.era}
      </text>
    </svg>
  );
};

export default BanknoteSvg;
