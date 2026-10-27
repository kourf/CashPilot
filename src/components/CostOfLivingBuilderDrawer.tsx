import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, Plus, Trash2, Home, HeartPulse, ShoppingCart, Car, Tv, Edit2, Save, 
  Calculator, RefreshCw, Eye, ArrowLeft, RotateCcw, UtensilsCrossed, Smartphone, 
  Ticket, ShoppingBag, Building2 
} from 'lucide-react';
import { formatCurrency, formatDateFR, type BankTransaction } from '../lib/bankUtils';
import { calculateCategoryMedians } from '../lib/kpiUtils';

export interface CostOfLivingBuilderDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  bankTransactions: BankTransaction[];
}

interface ExpenseItem {
  id: string;
  name: string;
  amount: number;
  categoryGroup: string;
  isAutoCalculated?: boolean;
}

const CATEGORY_GROUPS = [
  { id: 'logement', label: 'Logement & Énergie', icon: Home, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { id: 'sante', label: 'Assurances & Santé', icon: HeartPulse, color: 'text-rose-400', bg: 'bg-rose-500/10' },
  { id: 'alimentation', label: 'Alimentation & Courses', icon: ShoppingCart, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { id: 'restaurants', label: 'Restaurants & Sorties', icon: UtensilsCrossed, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  { id: 'transport', label: 'Transports & Mobilité', icon: Car, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  { id: 'abonnements', label: 'Abonnements & Numérique', icon: Smartphone, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  { id: 'loisirs', label: 'Loisirs, Sport & Culture', icon: Ticket, color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/10' },
  { id: 'shopping', label: 'Shopping & Vie Quotidienne', icon: ShoppingBag, color: 'text-teal-400', bg: 'bg-teal-500/10' },
  { id: 'bancaire', label: 'Frais & Services bancaires', icon: Building2, color: 'text-slate-400', bg: 'bg-slate-500/10' }
];

const DEFAULT_ITEMS: ExpenseItem[] = [
  { id: 'loyer', name: 'Loyer / Crédit Immobilier', amount: 0, categoryGroup: 'logement', isAutoCalculated: true },
  { id: 'elec', name: 'Électricité / Gaz', amount: 0, categoryGroup: 'logement', isAutoCalculated: true },
  { id: 'eau', name: 'Eau & Charges', amount: 0, categoryGroup: 'logement', isAutoCalculated: true },
  { id: 'assurance', name: 'Assurances', amount: 0, categoryGroup: 'sante', isAutoCalculated: true },
  { id: 'sante', name: 'Santé & Mutuelle', amount: 0, categoryGroup: 'sante', isAutoCalculated: true },
  { id: 'courses', name: 'Courses Alimentaires', amount: 0, categoryGroup: 'alimentation', isAutoCalculated: true },
  { id: 'restaurants', name: 'Restaurants & Restauration', amount: 0, categoryGroup: 'restaurants', isAutoCalculated: true },
  { id: 'cafes', name: 'Cafés, Bars & Sorties', amount: 0, categoryGroup: 'restaurants', isAutoCalculated: true },
  { id: 'carburant', name: 'Carburant & Péages', amount: 0, categoryGroup: 'transport', isAutoCalculated: true },
  { id: 'transports', name: 'Transports en commun', amount: 0, categoryGroup: 'transport', isAutoCalculated: true },
  { id: 'telecom', name: 'Box Internet & Mobiles', amount: 0, categoryGroup: 'abonnements', isAutoCalculated: true },
  { id: 'streaming', name: 'Streaming, Cloud & Services', amount: 0, categoryGroup: 'abonnements', isAutoCalculated: true },
  { id: 'loisirs', name: 'Loisirs, Sorties & Culture', amount: 0, categoryGroup: 'loisirs', isAutoCalculated: true },
  { id: 'sport', name: 'Sport & Bien-être', amount: 0, categoryGroup: 'loisirs', isAutoCalculated: true },
  { id: 'shopping', name: 'Shopping & Équipement', amount: 0, categoryGroup: 'shopping', isAutoCalculated: true },
  { id: 'frais_bancaires', name: 'Frais bancaires & Cotisations', amount: 0, categoryGroup: 'bancaire', isAutoCalculated: true },
];

export const CostOfLivingBuilderDrawer: React.FC<CostOfLivingBuilderDrawerProps> = ({
  isOpen,
  onClose,
  onBack,
  bankTransactions
}) => {
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemAmount, setNewItemAmount] = useState('');
  const [newItemGroup, setNewItemGroup] = useState('logement');
  const [openDrillDownId, setOpenDrillDownId] = useState<string | null>(null);

  const categoryMedians = useMemo(() => {
    return calculateCategoryMedians(bankTransactions as any);
  }, [bankTransactions]);

  const getCategoryForExpenseItem = (itemName: string): string | null => {
    if (categoryMedians[itemName]) return itemName;
    if (itemName.includes('Loyer') || itemName.includes('Crédit')) return 'Loyer / Crédit Immobilier';
    if (itemName.includes('Électricité') || itemName.includes('Gaz')) return 'Électricité / Gaz';
    if (itemName.includes('Eau')) return 'Eau & Charges';
    if (itemName.includes('Assurance')) return 'Assurances';
    if (itemName.includes('Santé') || itemName.includes('Mutuelle')) return 'Santé & Mutuelle';
    if (itemName.includes('Courses') || itemName.includes('Alimentation')) return 'Courses Alimentaires';
    if (itemName.includes('Restaurant')) return 'Restaurants & Restauration';
    if (itemName.includes('Café') || itemName.includes('Bar')) return 'Cafés, Bars & Sorties';
    if (itemName.includes('Carburant') || itemName.includes('Péage')) return 'Carburant & Péages';
    if (itemName.includes('Transports en commun')) return 'Transports en commun';
    if (itemName.includes('Internet') || itemName.includes('Mobile') || itemName.includes('Télécom')) return 'Box Internet & Mobiles';
    if (itemName.includes('Streaming') || itemName.includes('Cloud')) return 'Streaming, Cloud & Services';
    if (itemName.includes('Abonnement')) return 'Streaming, Cloud & Services';
    if (itemName.includes('Loisir') || itemName.includes('Culture')) return 'Loisirs, Sorties & Culture';
    if (itemName.includes('Sport')) return 'Sport & Bien-être';
    if (itemName.includes('Shopping') || itemName.includes('Équipement') || itemName.includes('Maison')) return 'Shopping & Équipement';
    if (itemName.includes('Frais') || itemName.includes('Bancaire') || itemName.includes('Cotisation')) return 'Frais bancaires & Cotisations';
    return null;
  };

  const getEstimatedMedian = (item: ExpenseItem): number => {
    // 1. Direct item name match
    if (categoryMedians[item.name]?.median) return categoryMedians[item.name].median;
    // 2. Category mapping
    const targetCat = getCategoryForExpenseItem(item.name);
    if (targetCat && categoryMedians[targetCat]?.median) {
      return categoryMedians[targetCat].median;
    }
    // 3. Fallbacks
    if (item.name.includes('Loyer')) return categoryMedians['Loyer / Charges']?.median || categoryMedians['Logement & Énergie']?.median || 0;
    if (item.name.includes('Électricité') || item.name.includes('Gaz')) return categoryMedians['Électricité, Gaz, Eau']?.median || 0;
    if (item.name.includes('Eau')) return categoryMedians['Eau & Charges']?.median || categoryMedians['Eau']?.median || 0;
    if (item.name.includes('Assurance')) return categoryMedians['Assurances']?.median || 0;
    if (item.name.includes('Santé')) return categoryMedians['Santé & Mutuelle']?.median || categoryMedians['Santé']?.median || 0;
    if (item.name.includes('Courses')) return categoryMedians['Alimentation & Courses']?.median || 0;
    if (item.name.includes('Restaurant')) return categoryMedians['Restaurants & Sorties']?.median || 0;
    if (item.name.includes('Café') || item.name.includes('Bar')) return categoryMedians['Cafés, Bars & Sorties']?.median || 0;
    if (item.name.includes('Carburant') || item.name.includes('Péage')) return categoryMedians['Carburant & Péages']?.median || categoryMedians['Transports & Carburant']?.median || 0;
    if (item.name.includes('Transports en commun')) return categoryMedians['Transports en commun']?.median || categoryMedians['Transports']?.median || 0;
    if (item.name.includes('Internet') || item.name.includes('Mobile')) return categoryMedians['Box Internet & Mobiles']?.median || categoryMedians['Abonnements & Télécom']?.median || 0;
    if (item.name.includes('Streaming') || item.name.includes('Cloud')) return categoryMedians['Streaming, Cloud & Services']?.median || categoryMedians['Abonnements & Télécom']?.median || 0;
    if (item.name.includes('Abonnement')) return categoryMedians['Abonnements & Télécom']?.median || 0;
    if (item.name.includes('Loisir')) return categoryMedians['Loisirs & Activités']?.median || 0;
    if (item.name.includes('Sport')) return categoryMedians['Sport & Bien-être']?.median || 0;
    if (item.name.includes('Shopping')) return categoryMedians['Shopping & Maison']?.median || 0;
    if (item.name.includes('Frais') || item.name.includes('Bancaire')) return categoryMedians['Frais bancaires']?.median || 0;
    return 0;
  };

  const getMedianDetailObj = (item: ExpenseItem) => {
    if (categoryMedians[item.name] && (categoryMedians[item.name].median > 0 || categoryMedians[item.name].sampleTx?.length > 0)) {
      return categoryMedians[item.name];
    }
    const targetCat = getCategoryForExpenseItem(item.name);
    if (targetCat && categoryMedians[targetCat]) {
      return categoryMedians[targetCat];
    }
    return null;
  };

  // Computed grouped recent expenses and averages
  const groupStats = useMemo(() => {
    const expenses = bankTransactions.filter(t => t.amount < 0 && !t.isInternalTransfer);
    const groups: Record<string, BankTransaction[]> = {};
    const sums: Record<string, number> = {};
    const months = new Set<string>();

    CATEGORY_GROUPS.forEach(g => {
      groups[g.id] = [];
      sums[g.id] = 0;
    });

    expenses.forEach(t => {
      if (t.monthKey) months.add(t.monthKey);
      let groupId = 'autre';
      const cat = (t.category || '').toLowerCase();
      if (cat.includes('loyer') || cat.includes('électricité') || cat.includes('electricite') || cat.includes('gaz') || cat.includes('eau') || cat.includes('logement') || cat.includes('énergie')) groupId = 'logement';
      else if (cat.includes('assurance') || cat.includes('santé') || cat.includes('sante') || cat.includes('mutuelle')) groupId = 'sante';
      else if (cat.includes('alimentation') || cat.includes('courses') || cat.includes('supermarché')) groupId = 'alimentation';
      else if (cat.includes('restaurant') || cat.includes('sorties') || cat.includes('resto') || cat.includes('café') || cat.includes('bar')) groupId = 'restaurants';
      else if (cat.includes('carburant') || cat.includes('transport') || cat.includes('véhicule') || cat.includes('péage') || cat.includes('peage')) groupId = 'transport';
      else if (cat.includes('abonnement') || cat.includes('télécom') || cat.includes('telecom') || cat.includes('mobile') || cat.includes('internet') || cat.includes('streaming')) groupId = 'abonnements';
      else if (cat.includes('loisirs') || cat.includes('activités') || cat.includes('sport') || cat.includes('culture') || cat.includes('cinéma')) groupId = 'loisirs';
      else if (cat.includes('shopping') || cat.includes('maison') || cat.includes('habillement') || cat.includes('vêtements')) groupId = 'shopping';
      else if (cat.includes('frais bancaires') || cat.includes('bancaire') || cat.includes('cotisation')) groupId = 'bancaire';
      
      if (groups[groupId]) {
        groups[groupId].push(t);
        sums[groupId] += Math.abs(t.amount);
      }
    });

    const numMonths = Math.max(1, months.size);
    const stats: Record<string, { average: number; recent: BankTransaction[] }> = {};

    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      stats[key] = {
        average: sums[key] / numMonths,
        recent: groups[key]
      };
    });
    
    return stats;
  }, [bankTransactions]);

  // Calcul rigoureux des médianes mensuelles par groupe de catégorie (Budget moyen par catégorie)
  const categoryGroupMedians = useMemo(() => {
    const monthlyGroupTotals: Record<string, Record<string, number>> = {
      logement: {},
      sante: {},
      alimentation: {},
      restaurants: {},
      transport: {},
      abonnements: {},
      loisirs: {},
      shopping: {},
      bancaire: {}
    };

    const expenses = bankTransactions.filter(t => Number(t.amount) < 0 && !t.isInternalTransfer);

    expenses.forEach(t => {
      const d = t.date || '';
      const m = d.substring(0, 7) || 'general';
      const cat = (t.category || '').toLowerCase();
      let groupId = 'autre';
      if (cat.includes('loyer') || cat.includes('électricité') || cat.includes('electricite') || cat.includes('gaz') || cat.includes('eau') || cat.includes('logement') || cat.includes('énergie')) groupId = 'logement';
      else if (cat.includes('assurance') || cat.includes('santé') || cat.includes('sante') || cat.includes('mutuelle')) groupId = 'sante';
      else if (cat.includes('alimentation') || cat.includes('courses') || cat.includes('supermarché')) groupId = 'alimentation';
      else if (cat.includes('restaurant') || cat.includes('sorties') || cat.includes('resto') || cat.includes('café') || cat.includes('bar')) groupId = 'restaurants';
      else if (cat.includes('carburant') || cat.includes('transport') || cat.includes('véhicule') || cat.includes('péage') || cat.includes('peage')) groupId = 'transport';
      else if (cat.includes('abonnement') || cat.includes('télécom') || cat.includes('telecom') || cat.includes('mobile') || cat.includes('internet') || cat.includes('streaming')) groupId = 'abonnements';
      else if (cat.includes('loisirs') || cat.includes('activités') || cat.includes('sport') || cat.includes('culture') || cat.includes('cinéma')) groupId = 'loisirs';
      else if (cat.includes('shopping') || cat.includes('maison') || cat.includes('habillement') || cat.includes('vêtements')) groupId = 'shopping';
      else if (cat.includes('frais bancaires') || cat.includes('bancaire') || cat.includes('cotisation')) groupId = 'bancaire';

      if (monthlyGroupTotals[groupId]) {
        monthlyGroupTotals[groupId][m] = (monthlyGroupTotals[groupId][m] || 0) + Math.abs(Number(t.amount) || 0);
      }
    });

    const result: Record<string, number> = {};
    Object.keys(monthlyGroupTotals).forEach(gid => {
      const monthlyValues = Object.values(monthlyGroupTotals[gid]);
      if (monthlyValues.length > 0) {
        monthlyValues.sort((a, b) => a - b);
        const mid = Math.floor(monthlyValues.length / 2);
        const med = monthlyValues.length % 2 !== 0 ? monthlyValues[mid] : (monthlyValues[mid - 1] + monthlyValues[mid]) / 2;
        result[gid] = Math.round(med);
      } else {
        // Fallback arithmétique : somme des médianes des items par défaut de ce groupe
        const defaultItemsForGroup = DEFAULT_ITEMS.filter(d => d.categoryGroup === gid);
        const sumDefaultMedians = defaultItemsForGroup.reduce((acc, d) => {
          const med = getEstimatedMedian(d);
          return acc + med;
        }, 0);
        result[gid] = Math.round(sumDefaultMedians);
      }
    });

    return result;
  }, [bankTransactions, categoryMedians]);

  // Initialisation avec les médianes calculées par l'IA
  const initializeItems = () => {
    const initItems = DEFAULT_ITEMS.map(item => {
      const avgAmount = getEstimatedMedian(item);
      return { ...item, amount: Math.round(avgAmount || 0), isAutoCalculated: true };
    });
    saveItems(initItems);
  };

  // Remise à zéro stricte de tous les montants (exigence utilisateur explicite)
  const handleResetToZero = () => {
    const zeroed = items.map(item => ({
      ...item,
      amount: 0
    }));
    saveItems(zeroed);
  };

  // Load from local storage or initialize avec migration transparente vers les 9 catégories
  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem('cashpilot_cost_of_living_v2') || localStorage.getItem('cashpilot_cost_of_living');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Migration : s'assurer que tous les nouveaux DEFAULT_ITEMS sont présents
            const existingIds = new Set(parsed.map(p => p.id));
            const missingDefaults = DEFAULT_ITEMS.filter(d => !existingIds.has(d.id));
            if (missingDefaults.length > 0) {
              const updated = [
                ...parsed,
                ...missingDefaults.map(d => ({
                  ...d,
                  amount: Math.round(getEstimatedMedian(d) || 0)
                }))
              ];
              saveItems(updated);
            } else {
              setItems(parsed);
            }
          } else {
            initializeItems();
          }
        } catch {
          initializeItems();
        }
      } else {
        initializeItems();
      }
    }
  }, [isOpen]);

  const saveItems = (newItems: ExpenseItem[]) => {
    setItems(newItems);
    localStorage.setItem('cashpilot_cost_of_living', JSON.stringify(newItems));
  };

  const handleUpdateItem = (id: string, newAmount: number) => {
    saveItems(items.map(item => item.id === id ? { ...item, amount: newAmount } : item));
    setIsEditing(null);
  };

  const handleRemoveItem = (id: string) => {
    const isDefault = DEFAULT_ITEMS.some(d => d.id === id);
    if (isDefault) {
      // Pour les postes par défaut, on remet le montant à 0 € sans supprimer la ligne ni l'œil
      saveItems(items.map(item => item.id === id ? { ...item, amount: 0 } : item));
    } else {
      // Pour les postes personnalisés créés par l'utilisateur, suppression de la ligne
      saveItems(items.filter(item => item.id !== id));
    }
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !newItemAmount) return;
    const amountNum = parseFloat(newItemAmount.replace(',', '.'));
    if (isNaN(amountNum)) return;

    const newItem: ExpenseItem = {
      id: `custom_${Date.now()}`,
      name: newItemName.trim(),
      amount: amountNum,
      categoryGroup: newItemGroup,
      isAutoCalculated: false
    };

    saveItems([...items, newItem]);
    setNewItemName('');
    setNewItemAmount('');
  };

  const totalCost = items.reduce((sum, item) => sum + item.amount, 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative z-10 w-full max-w-2xl bg-card border-l border-border/80 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300 text-foreground overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border/60 bg-secondary/30 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="p-2.5 -ml-1 rounded-2xl bg-secondary/80 hover:bg-secondary text-foreground transition-all flex items-center gap-1.5 text-xs font-bold shrink-0 shadow-sm active:scale-95 cursor-pointer"
                  title="Retour à la liste des outils"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Retour</span>
                </button>
              )}
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-md shrink-0 mt-0.5">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-foreground">
                  Simulateur : Coût de la vie
                </h2>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Estimez vos charges incompressibles mensuelles. Chaque catégorie affiche sa médiane constatée afin de guider votre budget moyen.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors shrink-0 cursor-pointer"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Total Summary */}
        <div className="p-5 border-b border-border/60 bg-secondary/15 shrink-0">
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs uppercase font-bold text-emerald-500/90 block mb-1">
                Coût de la vie Mensuel Estimé
              </span>
              <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-400">
                {formatCurrency(totalCost, { showSign: false })}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button 
                onClick={handleResetToZero}
                className="px-3 py-2 text-xs font-bold rounded-xl bg-secondary/80 hover:bg-secondary text-foreground flex items-center gap-1.5 transition-all border border-border/60 hover:border-border cursor-pointer shadow-sm active:scale-95"
                title="Remettre tous les comptes et postes à 0 €"
              >
                <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
                <span>Réinitialiser (0 €)</span>
              </button>
              <button 
                onClick={initializeItems}
                className="px-3 py-2 text-xs font-bold rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 transition-all border border-emerald-500/30 cursor-pointer shadow-sm active:scale-95"
                title="Remplir automatiquement avec les médianes constatées par l'IA"
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>Médianes IA</span>
              </button>
            </div>
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6 overscroll-contain">
          {CATEGORY_GROUPS.map(group => {
            const groupItems = items.filter(i => i.categoryGroup === group.id);
            if (groupItems.length === 0) return null;
            
            const GroupIcon = group.icon;
            const groupTotal = groupItems.reduce((s, i) => s + i.amount, 0);

            const stats = groupStats[group.id];
            let discrepancyAlert = null;
            if (stats && stats.average > 0) {
              const diffPercent = (groupTotal / stats.average) * 100;
              // Alert if estimation is less than 80% or more than 120% of the reality
              if (diffPercent < 80 || diffPercent > 120) {
                const isUnder = diffPercent < 80;
                discrepancyAlert = (
                  <div className={`mt-2 mb-2 flex items-center justify-center gap-1.5 text-[11px] font-medium px-2 py-1.5 rounded-lg border ${isUnder ? 'text-amber-500 border-amber-500/20 bg-amber-500/10' : 'text-blue-400 border-blue-500/20 bg-blue-500/10'}`}>
                    <span>En réalité, vous dépensez environ <strong>{formatCurrency(stats.average, { showSign: false })}/mois</strong></span>
                  </div>
                );
              }
            }

            return (
              <div key={group.id} className="space-y-3">
                {/* Header de catégorie avec Médiane constatée du groupe (budget moyen) */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-border/40 gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-lg ${group.bg} ${group.color} flex items-center justify-center`}>
                      <GroupIcon className="w-3.5 h-3.5" />
                    </div>
                    <h3 className="font-bold text-sm text-foreground">{group.label}</h3>
                  </div>
                  
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/80 border border-border/60 text-xs shadow-sm">
                      <span className="text-muted-foreground font-medium text-[11px]">Budget moyen / Médiane :</span>
                      <span className="font-mono font-extrabold text-foreground text-xs">
                        {formatCurrency(categoryGroupMedians[group.id] || 0, { showSign: false })}/mois
                      </span>
                    </div>
                    <span className="font-mono font-bold text-sm text-foreground">
                      {formatCurrency(groupTotal, { showSign: false })}
                    </span>
                  </div>
                </div>

                {discrepancyAlert}

                <div className="space-y-2">
                  {groupItems.map(item => {
                    const estimatedMedian = getEstimatedMedian(item);
                    const medianDetail = getMedianDetailObj(item);

                    return (
                      <div key={item.id} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/50 hover:border-border transition-colors group/item">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm text-foreground/90">{item.name}</span>
                            
                            {/* Badge Médiane Constatée avec valeur estimée, toujours visible même si montant à 0 € */}
                            {estimatedMedian > 0 && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/90 text-muted-foreground font-semibold flex items-center gap-1 border border-border/40">
                                <span className="hidden sm:inline">Médiane constatée :</span>
                                <span className="sm:hidden">Médiane :</span>
                                <span className="font-mono font-bold text-foreground">
                                  {formatCurrency(estimatedMedian, { showSign: false })}
                                </span>
                              </span>
                            )}

                            {/* Bouton Œil : TOUJOURS visible pour consulter le détail et les transactions */}
                            <button
                              onClick={() => setOpenDrillDownId(openDrillDownId === item.id ? null : item.id)}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                openDrillDownId === item.id 
                                  ? 'bg-primary text-primary-foreground shadow-sm' 
                                  : 'text-primary hover:bg-primary/10'
                              }`}
                              title="Voir le détail de la médiane et les transactions du relevé"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            {/* Bouton rapide d'application de la médiane si le montant est à 0 € */}
                            {item.amount === 0 && estimatedMedian > 0 && (
                              <button
                                onClick={() => handleUpdateItem(item.id, estimatedMedian)}
                                className="text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 transition-all cursor-pointer flex items-center gap-1 shadow-sm active:scale-95"
                                title={`Appliquer directement la médiane constatée (${formatCurrency(estimatedMedian, { showSign: false })})`}
                              >
                                <span>+ {formatCurrency(estimatedMedian, { showSign: false })}</span>
                              </button>
                            )}

                            {isEditing === item.id ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="w-20 px-2 py-1 text-sm bg-background border border-primary/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono text-right"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleUpdateItem(item.id, parseFloat(editValue) || 0);
                                    if (e.key === 'Escape') setIsEditing(null);
                                  }}
                                />
                                <button
                                  onClick={() => handleUpdateItem(item.id, parseFloat(editValue) || 0)}
                                  className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer"
                                  title="Enregistrer"
                                >
                                  <Save className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className={`font-black font-mono text-sm ${item.amount === 0 ? 'text-muted-foreground' : 'text-foreground'}`}>
                                  {formatCurrency(item.amount, { showSign: false })}
                                </span>
                                <button
                                  onClick={() => {
                                    setIsEditing(item.id);
                                    setEditValue(String(item.amount));
                                  }}
                                  className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary opacity-0 group-hover/item:opacity-100 transition-opacity cursor-pointer"
                                  title="Modifier le montant"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleRemoveItem(item.id)}
                                  className="p-1.5 rounded-lg text-rose-500/70 hover:text-rose-500 hover:bg-rose-500/10 opacity-0 group-hover/item:opacity-100 transition-opacity cursor-pointer"
                                  title={DEFAULT_ITEMS.some(d => d.id === item.id) ? "Mettre à 0 €" : "Supprimer cette charge"}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Drill-down de la médiane (détail & historique de transactions) */}
                        {openDrillDownId === item.id && (() => {
                          const sampleTx = medianDetail?.sampleTx || [];
                          
                          if (sampleTx.length === 0) {
                            return (
                              <div className="mx-4 p-3 rounded-xl bg-secondary/50 text-xs text-muted-foreground border border-border/50 animate-in slide-in-from-top-2 flex items-center justify-between">
                                <span>
                                  {estimatedMedian > 0 
                                    ? `Médiane de référence calculée : ${formatCurrency(estimatedMedian, { showSign: false })}/mois.` 
                                    : 'Aucun historique récent pour calculer la médiane.'}
                                </span>
                                {estimatedMedian > 0 && (
                                  <button
                                    onClick={() => {
                                      handleUpdateItem(item.id, estimatedMedian);
                                      setOpenDrillDownId(null);
                                    }}
                                    className="text-[10px] font-bold px-2.5 py-1 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors cursor-pointer"
                                  >
                                    Appliquer {formatCurrency(estimatedMedian, { showSign: false })}
                                  </button>
                                )}
                              </div>
                            );
                          }

                          return (
                            <div className="mx-4 p-3 rounded-xl bg-secondary/50 border border-border/50 animate-in slide-in-from-top-2 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                  Transactions récentes de référence ({sampleTx.length})
                                </span>
                                {estimatedMedian > 0 && (
                                  <button
                                    onClick={() => {
                                      handleUpdateItem(item.id, estimatedMedian);
                                      setOpenDrillDownId(null);
                                    }}
                                    className="text-[10px] font-bold px-2.5 py-1 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors cursor-pointer"
                                  >
                                    Appliquer la médiane : {formatCurrency(estimatedMedian, { showSign: false })}
                                  </button>
                                )}
                              </div>
                              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                {sampleTx.slice(0, 10).map(tx => (
                                  <div key={tx.id || `${tx.date}_${tx.amount}`} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg hover:bg-background/50 transition-colors">
                                    <div className="flex flex-col min-w-0">
                                      <span className="font-medium text-foreground truncate">{tx.cleanLabel || (tx as any).rawLabel || (tx as any).description}</span>
                                      <span className="text-[10px] text-muted-foreground">{formatDateFR(tx.date)}</span>
                                    </div>
                                    <span className="font-mono font-bold text-foreground shrink-0 ml-2">
                                      {formatCurrency(Math.abs(tx.amount), { showSign: false })}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add New Item Form */}
        <div className="p-4 border-t border-border/60 bg-secondary/30 shrink-0">
          <form onSubmit={handleAddItem} className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Ajouter une charge</label>
              <input
                type="text"
                placeholder="Nom (ex: Box Internet)..."
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground"
              />
            </div>
            
            <div className="w-32 space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Catégorie</label>
              <select
                value={newItemGroup}
                onChange={(e) => setNewItemGroup(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground"
              >
                {CATEGORY_GROUPS.map(g => (
                  <option key={g.id} value={g.id}>{g.label}</option>
                ))}
              </select>
            </div>

            <div className="w-28 space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Montant</label>
              <input
                type="number"
                placeholder="0.00"
                value={newItemAmount}
                onChange={(e) => setNewItemAmount(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={!newItemName || !newItemAmount}
              className="h-[38px] px-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};
