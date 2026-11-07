import React from 'react';

/**
 * Arrière-plan atmosphérique Aurora conforme à la Direction Artistique Ron Design :
 * - Tiers supérieur : Blanc pur nacré (#FFFFFF vers #F8FAFC) avec micro-points matriciels
 * - Sphère 1 : Lavande & lilas poudré (#E9D5FF / #DDD6FE) sous la carte porcelaine
 * - Sphère 2 : Pêche ambré & doré doux (#FED7AA / #FDE68A) derrière la grille 2x2
 * - Sphère 3 : Vert émeraude profond (#042F24 / #064E3B) enveloppant la zone basse et le dock
 */
export const AuroraBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none bg-[#090D16]">
      
      {/* =========================================================================
          TIERS SUPÉRIEUR : SURFACE BLANCHE NACRÉE (#FFFFFF vers #F8FAFC)
          Crée la base lumineuse du solde géant et du header
         ========================================================================= */}
      <div className="absolute top-0 inset-x-0 h-[480px] bg-gradient-to-b from-[#FFFFFF] via-[#F8FAFC] to-transparent z-[1]" />
      
      {/* Matrice de micro-points ultra-discrète sur le blanc supérieur */}
      <div 
        className="absolute top-0 inset-x-0 h-[460px] opacity-40 z-[2]"
        style={{
          backgroundImage: 'radial-gradient(rgba(15, 23, 42, 0.12) 1.1px, transparent 1.1px)',
          backgroundSize: '20px 20px',
          maskImage: 'linear-gradient(to bottom, black 70%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 70%, transparent 100%)'
        }}
      />

      {/* =========================================================================
          SPHÈRE 1 : HALO LAVANDE & LILAS POUDRÉ (Derrière la carte porcelaine)
         ========================================================================= */}
      <div 
        className="absolute top-[280px] left-1/2 -translate-x-1/2 w-[720px] max-w-[95vw] h-[360px] rounded-full bg-gradient-to-tr from-[#E9D5FF] via-[#DDD6FE] to-transparent blur-[110px] opacity-85 z-[3]"
      />

      {/* =========================================================================
          SPHÈRE 2 : HALO PÊCHE AMBRÉ & DORÉ DOUX (Derrière la grille 2x2)
         ========================================================================= */}
      <div 
        className="absolute top-[480px] left-1/2 -translate-x-1/2 w-[680px] max-w-[95vw] h-[400px] rounded-full bg-gradient-to-r from-[#FED7AA]/80 via-[#FDE68A]/60 to-[#FBBF24]/30 blur-[120px] opacity-75 z-[3]"
      />

      {/* =========================================================================
          SPHÈRE 3 : VERT ÉMERAUDE PROFOND & FORÊT (Enveloppe basse & dock)
         ========================================================================= */}
      <div 
        className="absolute bottom-[-100px] inset-x-0 h-[700px] bg-gradient-to-t from-[#042F24] via-[#064E3B]/85 to-transparent blur-[100px] opacity-95 z-[3]"
      />

      {/* Matrice de points émeraude en bas d'écran */}
      <div 
        className="absolute bottom-0 inset-x-0 h-[400px] opacity-25 z-[4]"
        style={{
          backgroundImage: 'radial-gradient(rgba(52, 211, 153, 0.3) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          maskImage: 'linear-gradient(to top, black 40%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to top, black 40%, transparent 100%)'
        }}
      />

    </div>
  );
};
