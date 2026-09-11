import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { 
  Trash2, 
  ShieldCheck, 
  Copy, 
  Check, 
  RefreshCw, 
  Moon, 
  Sun, 
  Smartphone,
  HardDrive
} from 'lucide-react';
import { ThemeToggle } from '../../components/ThemeToggle';

export default function Settings() {
  const [deviceId, setDeviceId] = useState('');
  const [copied, setCopied] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const id = localStorage.getItem('deviceId') || 'default-user';
    setDeviceId(id);

    const savedTheme = (localStorage.getItem('cashpilot-theme') as 'light' | 'dark') || 
      (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    setCurrentTheme(savedTheme);
  }, []);

  const copyDeviceId = () => {
    if (deviceId) {
      navigator.clipboard.writeText(deviceId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleResetCache = () => {
    if (confirm("Voulez-vous réinitialiser le cache local de l'application ? Vos données Firestore distantes ne seront pas supprimées.")) {
      localStorage.removeItem('cached_transactions');
      window.location.reload();
    }
  };

  const handleDeleteAll = () => {
    if (confirm("ATTENTION : Cette action supprimera définitivement toutes vos données locales et réinitialisera votre identifiant d'appareil. Continuer ?")) {
      localStorage.clear();
      window.location.href = '/';
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-28 md:pb-12">
      <div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Configuration</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mt-1 text-foreground">
          Paramètres & Système
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Personnalisez votre interface, gérez votre identifiant sécurisé et vos données chiffrées.
        </p>
      </div>

      <div className="grid gap-6">
        
        {/* THEME & APPEARANCE */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {currentTheme === 'dark' ? <Moon className="w-5 h-5 text-cyan-400" /> : <Sun className="w-5 h-5 text-amber-500" />}
              Apparence & Thème
            </CardTitle>
            <CardDescription>
              Basculez entre le Mode Sombre Titanium et le Mode Clair Porcelaine. Vos préférences sont sauvegardées automatiquement.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-2xl bg-secondary/40 dark:bg-white/[0.03] border border-border/70 dark:border-white/[0.06] gap-4">
              <div>
                <span className="text-sm font-semibold text-foreground block">
                  Sélecteur de Thème Visuel
                </span>
                <span className="text-xs text-muted-foreground">
                  Optimisé pour réduire la fatigue oculaire et maximiser le contraste financier
                </span>
              </div>
              <div className="w-full sm:w-auto">
                <ThemeToggle variant="expanded" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* DEVICE & DATA PERSISTENCE */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Smartphone size={20} className="text-primary" />
              Identifiant d'appareil sécurisé
            </CardTitle>
            <CardDescription>
              CashPilot associe vos relevés et analyses à un identifiant anonyme chiffré stocké sur cet appareil.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-2xl bg-secondary/40 dark:bg-white/[0.03] border border-border/70 dark:border-white/[0.06] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase">Votre Device ID (Clé de partition)</span>
                <span className="badge-jade text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <ShieldCheck size={12} /> Actif & Synchronisé
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  readOnly 
                  value={deviceId} 
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-background/80 border border-border/80 font-mono text-xs text-foreground select-all outline-none"
                />
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={copyDeviceId}
                  className="shrink-0 h-10 px-3.5 gap-1.5"
                >
                  {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  <span className="text-xs font-semibold">{copied ? 'Copié !' : 'Copier'}</span>
                </Button>
              </div>

              <p className="text-[11px] text-muted-foreground">
                Conservez cet identifiant si vous souhaitez synchroniser vos données sur un autre navigateur.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 rounded-2xl bg-secondary/20 dark:bg-white/[0.02] border border-border/60 dark:border-white/[0.04]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <HardDrive size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground">Stockage Local & Cache</h4>
                  <p className="text-[11px] text-muted-foreground">Améliore la vitesse d'affichage des graphiques</p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleResetCache}
                className="mt-3 sm:mt-0 text-xs h-9"
              >
                <RefreshCw size={13} className="mr-1.5" /> Vider le cache local
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* DANGER ZONE */}
        <Card className="glass-card border-destructive/30 bg-destructive/[0.02] dark:bg-destructive/[0.04]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <Trash2 size={20} />
              Zone Critique
            </CardTitle>
            <CardDescription>
              Actions irréversibles de réinitialisation complète de vos flux.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 rounded-2xl border border-destructive/20 bg-destructive/10 gap-4">
              <div>
                <h4 className="text-xs font-bold text-destructive">Réinitialiser l'appareil et les données</h4>
                <p className="text-[11px] text-destructive/80 mt-0.5">
                  Efface vos identifiants, vos relevés locaux et réinitialise l'application à zéro.
                </p>
              </div>
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={handleDeleteAll}
                className="shrink-0 text-xs h-9 font-semibold"
              >
                Réinitialiser à zéro
              </Button>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
