import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { cn } from '../lib/utils';

interface ThemeToggleProps {
  className?: string;
  variant?: 'compact' | 'expanded';
}

export function ThemeToggle({ className, variant = 'compact' }: ThemeToggleProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Check localStorage or system preference
    const savedTheme = localStorage.getItem('cashpilot-theme') as 'light' | 'dark' | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');

    setTheme(initialTheme);
    applyTheme(initialTheme);
    setMounted(true);
  }, []);

  const applyTheme = (newTheme: 'light' | 'dark') => {
    const root = document.documentElement;
    if (newTheme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('cashpilot-theme', nextTheme);
    applyTheme(nextTheme);
  };

  if (!mounted) {
    return (
      <div className={cn("w-9 h-9 rounded-xl bg-muted/50 animate-pulse", className)} />
    );
  }

  if (variant === 'expanded') {
    return (
      <button
        onClick={toggleTheme}
        type="button"
        aria-label="Basculer le mode sombre ou clair"
        className={cn(
          "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium",
          "bg-secondary/60 hover:bg-secondary/90 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]",
          "border border-border/60 dark:border-white/[0.06] transition-all duration-300 group",
          className
        )}
      >
        <span className="flex items-center gap-2.5 text-foreground/80 group-hover:text-foreground">
          {theme === 'dark' ? (
            <Moon className="w-4 h-4 text-cyan-400 transition-transform duration-300 group-hover:-rotate-12" />
          ) : (
            <Sun className="w-4 h-4 text-amber-500 transition-transform duration-300 group-hover:rotate-45" />
          )}
          <span>{theme === 'dark' ? 'Mode Sombre' : 'Mode Clair'}</span>
        </span>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-muted dark:bg-white/[0.08] text-muted-foreground">
          {theme === 'dark' ? 'ON' : 'OFF'}
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      type="button"
      aria-label="Basculer le thème"
      className={cn(
        "relative p-2 rounded-xl border transition-all duration-300 active:scale-95",
        "bg-secondary/70 hover:bg-secondary border-border/70 text-foreground/80 hover:text-foreground",
        "dark:bg-white/[0.05] dark:hover:bg-white/[0.1] dark:border-white/[0.08]",
        className
      )}
      title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
    >
      <div className="relative w-4 h-4">
        <Sun
          className={cn(
            "w-4 h-4 text-amber-500 transition-all duration-300 absolute inset-0",
            theme === 'dark' ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"
          )}
        />
        <Moon
          className={cn(
            "w-4 h-4 text-cyan-400 transition-all duration-300 absolute inset-0",
            theme === 'dark' ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"
          )}
        />
      </div>
    </button>
  );
}
