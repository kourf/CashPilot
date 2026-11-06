import React, { useEffect, useState } from 'react';

export const AuroraBackground: React.FC = () => {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScroll = window.scrollY || document.documentElement.scrollTop || 0;
      setScrollY(currentScroll);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollOffset = Math.min(scrollY * 0.35, 250);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none bg-[#090D16] transition-colors duration-700">
      
      {/* =========================================================================
          ZONE HAUTE : Matrice Micro-Points Ron Design sur fond sombre luxueux
         ========================================================================= */}
      <div 
        className="absolute top-0 inset-x-0 h-[450px] opacity-35"
        style={{
          backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.22) 1.2px, transparent 1.2px)',
          backgroundSize: '22px 22px',
          maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)'
        }}
      />

      {/* Halo Lilas / Lavande poudré sous le solde et la carte IA */}
      <div 
        className="absolute top-[80px] left-1/2 -translate-x-1/2 w-[720px] max-w-[90vw] h-[360px] rounded-full bg-gradient-to-tr from-[#C084FC]/35 via-[#DDD6FE]/40 to-transparent blur-[120px] transition-transform duration-300"
        style={{
          transform: `translate(-50%, ${-scrollOffset * 0.2}px)`
        }}
      />

      {/* =========================================================================
          ZONE CENTRALE : Les 4 Halos Volumétriques Ron Design
          Placés stratégiquement derrière les 4 cartes KPI & graphiques
         ========================================================================= */}
      
      {/* 1. Halo Doré / Ambre Chaud (Revenus - REV) */}
      <div 
        className="absolute top-[320px] left-[15%] lg:left-[35%] w-[420px] h-[380px] rounded-full bg-gradient-to-br from-[#F59E0B]/30 via-[#D97706]/20 to-transparent blur-[110px] animate-pulse-subtle"
        style={{
          transform: `translateY(${scrollOffset * 0.15}px)`
        }}
      />

      {/* 2. Halo Améthyste / Violet Profond (Charges fixes - FIX) */}
      <div 
        className="absolute top-[340px] right-[10%] lg:right-[15%] w-[440px] h-[380px] rounded-full bg-gradient-to-bl from-[#8B5CF6]/35 via-[#6D28D9]/25 to-transparent blur-[115px]"
        style={{
          transform: `translateY(${scrollOffset * 0.1}px)`
        }}
      />

      {/* 3. Halo Vert Émeraude / Forêt Luminous (Dépenses Variables - VAR) */}
      <div 
        className="absolute top-[580px] left-[10%] lg:left-[25%] w-[480px] h-[440px] rounded-full bg-gradient-to-tr from-[#10B981]/35 via-[#059669]/25 to-transparent blur-[125px]"
        style={{
          transform: `translateY(${-scrollOffset * 0.1}px)`
        }}
      />

      {/* 4. Halo Glace / Cyan Océanique (Épargne Nette - EPA) */}
      <div 
        className="absolute top-[600px] right-[12%] lg:right-[20%] w-[450px] h-[400px] rounded-full bg-gradient-to-tl from-[#06B6D4]/30 via-[#0D9488]/20 to-transparent blur-[120px]"
        style={{
          transform: `translateY(${-scrollOffset * 0.15}px)`
        }}
      />

      {/* =========================================================================
          ZONE INFÉRIEURE : Velouté Vert Émeraude & Sauge Profond
          Enveloppe les graphiques analytiques et le dock flottant
         ========================================================================= */}
      <div 
        className="absolute bottom-[-100px] inset-x-0 h-[650px] bg-gradient-to-t from-[#042F24] via-[#064E3B]/60 to-transparent blur-[100px] opacity-90"
      />

      {/* Matrice subtile en bas d'écran */}
      <div 
        className="absolute bottom-0 inset-x-0 h-[500px] opacity-25"
        style={{
          backgroundImage: 'radial-gradient(rgba(52, 211, 153, 0.3) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          maskImage: 'linear-gradient(to top, black 30%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to top, black 30%, transparent 100%)'
        }}
      />

    </div>
  );
};
