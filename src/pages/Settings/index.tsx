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
  HardDrive,
  Share2,
  Laptop,
  ArrowRightLeft
} from 'lucide-react';
import { ThemeToggle } from '../../components/ThemeToggle';
import { getActiveAccountId, SHARED_ACCOUNT_ID, migrateLegacyDeviceDataIfNeeded } from '../../lib/userUtils';

export default function Settings() {
  const [accountId, setAccountId] = useState('');
  const [customInputId, setCustomInputId] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>('dark');
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<string | null>(null);

  useEffect(() => {
    const id = getActiveAccountId();
    setAccountId(id);
    setCustomInputId(id);

    const savedTheme = (localStorage.getItem('cashpilot-theme') as 'light' | 'dark') || 
      (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    setCurrentTheme(savedTheme);
  }, []);

  const copySyncLink = () => {
    const syncUrl = `${window.location.origin}/?sync=${accountId}`;
    navigator.clipboard.writeText(syncUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const copyAccountId = () => {
    navigator.clipboard.writeText(accountId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleApplyCustomAccount = () => {
    const clean = customInputId.trim();
    if (!clean) return;

    if (confirm(`Voulez-vous connecter cet appareil à l'espace de trésorerie "${clean}" ? Toutes vos données seront synchronisées avec cet espace.`)) {
      localStorage.setItem('cashpilot_account_id', clean);
      localStorage.setItem('deviceId', clean);
      localStorage.removeItem('cashpilot_tx_cache');
      window.location.href = '/';
    }
  };

  const handleForceMigration = async () => {
    setIsMigrating(true);
    setMigrationStatus("Recherche et fusion des données locales...");
    try {
      const count = await migrateLegacyDeviceDataIfNeeded();
      if (count > 0) {
        setMigrationStatus(`Succès : ${count} transactions ont été fusionnées dans l'espace partagé !`);
      } else {
        setMigrationStatus("Toutes vos données sont déjà parfaitement synchronisées.");
      }
    } catch (err: any) {
      setMigrationStatus("Erreur lors de la synchronisation : " + (err.message || 'Inconnue'));
    } finally {
      setIsMigrating(false);
    }
  };

  const handleResetCache = () => {
    if (confirm("Voulez-vous réinitialiser le cache local de l'application ? Vos données Firestore distantes ne seront pas supprimées.")) {
      localStorage.removeItem('cashpilot_tx_cache');
      window.location.reload();
    }
  };

  const handleDeleteAll = () => {
    if (confirm("ATTENTION : Cette action supprimera définitivement vos paramètres locaux et videra le cache de cet appareil. Vos données en ligne ne sont pas affectées. Continuer ?")) {
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
          Synchronisation multi-appareils (PC, Téléphone, Tablette), personnalisation et maintenance.
        </p>
      </div>

      <div className="grid gap-6">
        
        {/* CROSS-DEVICE SYNCHRONIZATION CARD */}
        <Card className="glass-card border-primary/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Laptop size={20} className="text-primary" />
                <span className="text-muted-foreground">/</span>
                <Smartphone size={20} className="text-primary" />
                Synchronisation Multi-Appareils (PC & Mobile)
              </CardTitle>
              <span className="badge-jade text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                <ShieldCheck size={13} /> Synchronisé en direct
              </span>
            </div>
            <CardDescription>
              Vos relevés bancaires, tickets et analyses sont synchronisés en temps réel via Firestore. Tout document déposé sur votre téléphone apparaît immédiatement sur votre PC, et inversement.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Active Workspace ID */}
            <div className="p-4 rounded-2xl bg-secondary/40 dark:bg-white/[0.03] border border-border/70 dark:border-white/[0.06] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase">
                  Identifiant de Trésorerie Partagé
                </span>
                <span className="text-xs text-primary font-mono font-bold">
                  {accountId === SHARED_ACCOUNT_ID ? 'Espace Principal Unifié' : 'Espace Personnalisé'}
                </span>
              </div>
              
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input 
                  type="text" 
                  value={customInputId}
                  onChange={e => setCustomInputId(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-background/80 border border-border/80 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Nom de votre espace partagé..."
                />
                <div className="flex items-center gap-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={copyAccountId}
                    className="flex-1 sm:flex-none shrink-0 h-10 px-3.5 gap-1.5"
                  >
                    {copiedId ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    <span className="text-xs font-semibold">{copiedId ? 'Copié !' : 'Copier ID'}</span>
                  </Button>
                  {customInputId.trim() !== accountId && (
                    <Button 
                      size="sm" 
                      onClick={handleApplyCustomAccount}
                      className="shrink-0 h-10 px-3.5 text-xs font-bold"
                    >
                      Rejoindre
                    </Button>
                  )}
                </div>
              </div>

              {/* Instant Link Copy for Mobile */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-border/40">
                <p className="text-[11px] text-muted-foreground">
                  Ouvrez ce lien sur votre téléphone pour synchroniser immédiatement vos appareils.
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={copySyncLink}
                  className="h-9 px-3 gap-1.5 font-semibold text-xs border border-border/60"
                >
                  <Share2 size={13} className="text-primary" />
                  <span>{copiedLink ? 'Lien copié dans le presse-papier !' : 'Copier le lien pour téléphone'}</span>
                </Button>
              </div>
            </div>

            {/* Merge / Migration Helper */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 rounded-2xl bg-secondary/20 dark:bg-white/[0.02] border border-border/60 dark:border-white/[0.04] gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <ArrowRightLeft size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground">Fusion des données d'appareils</h4>
                  <p className="text-[11px] text-muted-foreground">
                    {migrationStatus || "Rapatrie automatiquement les relevés déposés sous un ancien identifiant d'appareil"}
                  </p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                disabled={isMigrating}
                onClick={handleForceMigration}
                className="shrink-0 text-xs h-9"
              >
                <RefreshCw size={13} className={`mr-1.5 ${isMigrating ? 'animate-spin' : ''}`} />
                Vérifier & Fusionner
              </Button>
            </div>
          </CardContent>
        </Card>

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

        {/* CACHE & SYSTEM MAINTENANCE */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <HardDrive size={18} className="text-primary" />
              Stockage Local & Performance
            </CardTitle>
            <CardDescription>
              CashPilot préchauffe les données localement pour garantir 0 ms de latence lors du changement d'onglet.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 rounded-2xl bg-secondary/20 dark:bg-white/[0.02] border border-border/60 dark:border-white/[0.04]">
              <div>
                <h4 className="text-xs font-bold text-foreground">Cache Instantané (0 ms)</h4>
                <p className="text-[11px] text-muted-foreground">
                  Vide le cache mémoire et recharge vos données fraîches depuis Firestore.
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleResetCache}
                className="mt-3 sm:mt-0 text-xs h-9"
              >
                <RefreshCw size={13} className="mr-1.5" /> Recharger le cache
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
              Actions de réinitialisation de vos réglages locaux sur cet appareil.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 rounded-2xl border border-destructive/20 bg-destructive/10 gap-4">
              <div>
                <h4 className="text-xs font-bold text-destructive">Réinitialiser les préférences locales</h4>
                <p className="text-[11px] text-destructive/80 mt-0.5">
                  Efface les cookies locaux et le cache de ce navigateur sans affecter vos données distantes.
                </p>
              </div>
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={handleDeleteAll}
                className="shrink-0 text-xs h-9 font-semibold"
              >
                Réinitialiser cet appareil
              </Button>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
