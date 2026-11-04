import React, { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';

export interface BanknoteCanvasRef {
  makeItRain: (count?: number) => void;
  explodeAt: (x: number, y: number) => void;
}

interface BanknoteCanvasProps {
  className?: string;
  intensity?: 'subtle' | 'normal' | 'rich';
  interactive?: boolean;
  soundEnabled?: boolean;
  onCollectCash?: (amount: number, currency: 'EUR' | 'CHF', label: string) => void;
}

interface FloatingBill {
  id: number;
  currency: 'EUR' | 'CHF';
  value: 50 | 100 | 200;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  rotation: number;
  vRot: number;
  flipAngle: number;
  vFlip: number;
  scale: number;
  opacity: number;
  depth: number;
  colorBg: string;
  colorBorder: string;
  colorAccent: string;
  flutterPhase: number;
  flutterSpeed: number;
}

interface SparkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

interface FloatingLabel {
  id: number;
  x: number;
  y: number;
  text: string;
  alpha: number;
  color: string;
}

const CURRENCY_CONFIGS = {
  EUR: {
    50: { bg: '#b45309', border: '#f59e0b', text: '#fef3c7', label: '50 € Épargné !' },
    100: { bg: '#047857', border: '#10b981', text: '#a7f3d0', label: '100 € Cash Flow !' },
    200: { bg: '#a16207', border: '#eab308', text: '#fef08a', label: '200 € Investi !' },
  },
  CHF: {
    50: { bg: '#15803d', border: '#4ade80', text: '#bbf7d0', label: '50 CHF Épargne Suisse !' },
    100: { bg: '#1d4ed8', border: '#60a5fa', text: '#dbeafe', label: '100 CHF Rendement Valais !' },
    200: { bg: '#78350f', border: '#b45309', text: '#fed7aa', label: '200 CHF Patrimoine CERN !' },
  },
};

export const BanknoteCanvas = forwardRef<BanknoteCanvasRef, BanknoteCanvasProps>(({
  className,
  intensity = 'normal',
  interactive = true,
  soundEnabled = true,
  onCollectCash,
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const billsRef = useRef<FloatingBill[]>([]);
  const sparksRef = useRef<SparkParticle[]>([]);
  const labelsRef = useRef<FloatingLabel[]>([]);
  const mousePosRef = useRef<{ x: number; y: number; vx: number; vy: number; lastX: number; lastY: number }>({
    x: -1000,
    y: -1000,
    vx: 0,
    vy: 0,
    lastX: -1000,
    lastY: -1000,
  });
  const animFrameRef = useRef<number | null>(null);

  // Synthèse audio d'un carillon de monnaie
  const playCashSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(1046.5, ctx.currentTime); // C6
      osc1.frequency.setValueAtTime(1318.5, ctx.currentTime + 0.07); // E6
      gain1.gain.setValueAtTime(0.2, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.35);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(2093.0, ctx.currentTime + 0.07); // C7
      gain2.gain.setValueAtTime(0.12, ctx.currentTime + 0.07);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(ctx.currentTime + 0.07);
      osc2.stop(ctx.currentTime + 0.4);
    } catch {}
  }, [soundEnabled]);

  // Génération d'un billet EUR (horizontal) ou CHF (vertical)
  const createBill = useCallback((canvasWidth: number, canvasHeight: number, startFromTop = false): FloatingBill => {
    const isChf = Math.random() < 0.5;
    const currency: 'EUR' | 'CHF' = isChf ? 'CHF' : 'EUR';
    const values: (50 | 100 | 200)[] = [50, 100, 200];
    const val = values[Math.floor(Math.random() * values.length)];
    const p = CURRENCY_CONFIGS[currency][val];
    const depth = Math.random() * 0.7 + 0.3; // 0.3 (fond) à 1.0 (premier plan)

    // Dimensions : Euro horizontal (105x56), Franc suisse vertical (54x98)
    const baseW = isChf ? 54 * depth : 105 * depth;
    const baseH = isChf ? 98 * depth : 56 * depth;

    return {
      id: Math.random(),
      currency,
      value: val,
      x: Math.random() * canvasWidth,
      y: startFromTop ? -baseH - Math.random() * 120 : Math.random() * canvasHeight,
      vx: (Math.random() - 0.5) * 1.3,
      vy: Math.random() * 0.8 + 0.65 * depth,
      width: baseW,
      height: baseH,
      rotation: (Math.random() - 0.5) * 0.8,
      vRot: (Math.random() - 0.5) * 0.015,
      flipAngle: Math.random() * Math.PI * 2,
      vFlip: Math.random() * 0.025 + 0.015,
      scale: depth,
      opacity: Math.min(1, depth * 0.85 + 0.15),
      depth,
      colorBg: p.bg,
      colorBorder: p.border,
      colorAccent: p.text,
      flutterPhase: Math.random() * Math.PI * 2,
      flutterSpeed: Math.random() * 0.03 + 0.02,
    };
  }, []);

  const makeItRain = useCallback((count = 32) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    playCashSound();
    for (let i = 0; i < count; i++) {
      const bill = createBill(canvas.width, canvas.height, true);
      bill.vy += Math.random() * 2.2 + 1.6;
      bill.vx += (Math.random() - 0.5) * 3;
      billsRef.current.push(bill);
    }
  }, [createBill, playCashSound]);

  const explodeAt = useCallback((x: number, y: number) => {
    for (let i = 0; i < 24; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 1.5;
      sparksRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.2,
        size: Math.random() * 3 + 1.5,
        color: ['#fbbf24', '#4ade80', '#60a5fa', '#f59e0b', '#ffffff', '#dc2626'][Math.floor(Math.random() * 6)],
        alpha: 1,
        life: 0,
        maxLife: Math.random() * 30 + 20,
      });
    }
  }, []);

  useImperativeHandle(ref, () => ({
    makeItRain,
    explodeAt,
  }), [makeItRain, explodeAt]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const initialCounts = { subtle: 10, normal: 18, rich: 28 };
    const count = initialCounts[intensity] || 18;
    billsRef.current = Array.from({ length: count }).map(() => createBill(width, height, false));

    const drawBill = (bill: FloatingBill) => {
      ctx.save();
      ctx.translate(bill.x, bill.y);
      ctx.rotate(bill.rotation);

      const cosFlip = Math.cos(bill.flipAngle);
      const flipScale = Math.abs(cosFlip);

      // Simulation du retournement 3D
      if (bill.currency === 'CHF') {
        ctx.scale(Math.max(0.08, flipScale), 1);
      } else {
        ctx.scale(1, Math.max(0.08, flipScale));
      }

      ctx.globalAlpha = bill.opacity;

      const w = bill.width;
      const h = bill.height;
      const r = 4;

      // Ombre portée
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 10 * bill.depth;
      ctx.shadowOffsetY = 4 * bill.depth;

      // Corps du billet
      ctx.fillStyle = bill.colorBg;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, r);
      ctx.fill();

      // Bordure
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = bill.colorBorder;
      ctx.lineWidth = 1.2 * bill.depth;
      ctx.stroke();

      if (bill.currency === 'CHF') {
        // ==================== DESIGN BILLET SUISSE (CHF) ====================
        // Bande holographique suisse verticale
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.fillRect(-w * 0.3, -h / 2 + 2, w * 0.22, h - 4);

        // Croix Suisse miniature en haut à droite
        const crossSize = 10 * bill.depth;
        const crossX = w / 2 - crossSize - 3;
        const crossY = -h / 2 + 4;
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.roundRect(crossX, crossY, crossSize, crossSize, 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(crossX + crossSize * 0.35, crossY + 1.5, crossSize * 0.3, crossSize - 3);
        ctx.fillRect(crossX + 1.5, crossY + crossSize * 0.35, crossSize - 3, crossSize * 0.3);

        // Valeur faciale verticale
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.round(18 * bill.depth)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${bill.value}`, 0, h * 0.18);

        ctx.fillStyle = bill.colorAccent;
        ctx.font = `bold ${Math.round(7 * bill.depth)}px system-ui, sans-serif`;
        ctx.fillText('CHF', 0, h * 0.35);

        ctx.font = `bold ${Math.round(5.5 * bill.depth)}px system-ui, sans-serif`;
        ctx.fillText('BNS • SNB', 0, -h * 0.38);
      } else {
        // ==================== DESIGN BILLET EURO (EUR) ====================
        // Bande holographique verticale
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.fillRect(w * 0.22, -h / 2 + 1, w * 0.14, h - 2);

        // Filigrane circulaire
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(0, 0, h * 0.32, 0, Math.PI * 2);
        ctx.stroke();

        // Valeur faciale
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.round(18 * bill.depth)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${bill.value} €`, -w * 0.16, 0);

        // Mention BCE
        ctx.fillStyle = bill.colorAccent;
        ctx.font = `bold ${Math.round(6.5 * bill.depth)}px system-ui, sans-serif`;
        ctx.fillText('BCE ECB 2026', 0, -h * 0.34);
      }

      ctx.restore();
    };

    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      lastTime = currentTime;

      ctx.clearRect(0, 0, width, height);

      const mouse = mousePosRef.current;
      mouse.vx = mouse.x - mouse.lastX;
      mouse.vy = mouse.y - mouse.lastY;
      mouse.lastX = mouse.x;
      mouse.lastY = mouse.y;

      const bills = billsRef.current;
      for (let i = bills.length - 1; i >= 0; i--) {
        const b = bills[i];

        b.flutterPhase += b.flutterSpeed;
        const flutterX = Math.sin(b.flutterPhase) * 0.65;
        b.x += b.vx + flutterX;
        b.y += b.vy;
        b.rotation += b.vRot;
        b.flipAngle += b.vFlip;

        // Interaction avec le curseur
        if (interactive && mouse.x > 0 && mouse.y > 0) {
          const dx = b.x - mouse.x;
          const dy = b.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = 140;

          if (dist < maxDist && dist > 1) {
            const force = (1 - dist / maxDist) * 1.5;
            b.x += (dx / dist) * force * 5;
            b.y += (dy / dist) * force * 5;
            b.vRot += (Math.random() - 0.5) * 0.04;
            b.flipAngle += force * 0.1;
          }
        }

        if (b.y > height + 90) {
          b.y = -90;
          b.x = Math.random() * width;
        }
        if (b.x < -90) b.x = width + 70;
        if (b.x > width + 90) b.x = -70;

        drawBill(b);
      }

      // Particules d'étincelles
      const sparks = sparksRef.current;
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.08;
        s.life++;
        s.alpha = Math.max(0, 1 - s.life / s.maxLife);

        ctx.save();
        ctx.globalAlpha = s.alpha;
        ctx.fillStyle = s.color;
        ctx.shadowColor = s.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (s.life >= s.maxLife) {
          sparks.splice(i, 1);
        }
      }

      // Libellés flottants
      const labels = labelsRef.current;
      for (let i = labels.length - 1; i >= 0; i--) {
        const l = labels[i];
        l.y -= 1.2;
        l.alpha -= 0.02;

        ctx.save();
        ctx.globalAlpha = Math.max(0, l.alpha);
        ctx.fillStyle = l.color;
        ctx.shadowColor = l.color;
        ctx.shadowBlur = 10;
        ctx.font = 'bold 15px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(l.text, l.x, l.y);
        ctx.restore();

        if (l.alpha <= 0) {
          labels.splice(i, 1);
        }
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [createBill, intensity, interactive]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    mousePosRef.current.x = e.clientX;
    mousePosRef.current.y = e.clientY;
  };

  const handleMouseLeave = () => {
    mousePosRef.current.x = -1000;
    mousePosRef.current.y = -1000;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches[0]) {
      mousePosRef.current.x = e.touches[0].clientX;
      mousePosRef.current.y = e.touches[0].clientY;
    }
  };

  const handleTouchEnd = () => {
    mousePosRef.current.x = -1000;
    mousePosRef.current.y = -1000;
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const bills = billsRef.current;
    let hitBill: FloatingBill | null = null;

    for (let i = bills.length - 1; i >= 0; i--) {
      const b = bills[i];
      const dx = Math.abs(b.x - clickX);
      const dy = Math.abs(b.y - clickY);
      if (dx < b.width * 0.6 && dy < b.height * 0.6) {
        hitBill = b;
        break;
      }
    }

    if (hitBill) {
      hitBill.vFlip += 0.25;
      hitBill.vRot += (Math.random() - 0.5) * 0.2;
      hitBill.vy -= 4.5;

      explodeAt(clickX, clickY);
      playCashSound();

      const p = CURRENCY_CONFIGS[hitBill.currency][hitBill.value];
      labelsRef.current.push({
        id: Math.random(),
        x: clickX,
        y: clickY - 15,
        text: p.label,
        alpha: 1,
        color: p.border,
      });

      if (onCollectCash) {
        onCollectCash(hitBill.value, hitBill.currency, p.label);
      }
    } else {
      explodeAt(clickX, clickY);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}
      style={{
        touchAction: 'none',
      }}
    />
  );
});

BanknoteCanvas.displayName = 'BanknoteCanvas';
export default BanknoteCanvas;
