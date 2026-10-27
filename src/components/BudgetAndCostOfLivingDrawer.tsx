import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, Plus, Trash2, Home, HeartPulse, ShoppingCart, Car, Tv, Edit2, Save, 
  Calculator, RefreshCw, Eye, ArrowLeft, RotateCcw, UtensilsCrossed, Smartphone, 
  Ticket, ShoppingBag, Building2, PiggyBank, AlertTriangle, CheckCircle2, 
  ChevronDown, ChevronUp, ArrowRight, HelpCircle, Zap, Droplet, Shield, 
  Receipt, Scale, Utensils, Sparkles, Landmark
} from 'lucide-react';
import { formatCurrency, formatDateFR, isDebitTransaction, type BankTransaction } from '../lib/bankUtils';
import { calculateCategoryMedians, matchesCostOfLivingItem } from '../lib/kpiUtils';

export interface BudgetAndCostOfLivingDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  initialTab?: 'cost_of_living' | 'budget_tracking';
  bankTransactions?: BankTransaction[];
  monthTransactions?: BankTransaction[];
  allTransactions?: BankTransaction[];
}

export interface ExpenseItem {
  id: string;
  name: string;
  amount: number;
  categoryGroup: string;
  isAutoCalculated?: boolean;
}

export interface BudgetItemRow {
  id: string;
  name: string;
  categoryGroup?: string;
  budgetAllocated: number;
  realSpent: number;
  diff: number; // budgetAllocated - realSpent (>0: restant/économies, <0: dépassé)
  percentage: number;
  icon: React.ElementType;
  isFromRB: boolean;
  txCount: number;
  transactions: BankTransaction[];
}

export const CATEGORY_GROUPS = [
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

export const DEFAULT_ITEMS: ExpenseItem[] = [
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

export const getCategoryIcon = (name: string): React.ElementType => {
  const norm = (name || '').toLowerCase();
  if (norm.includes('loyer') || norm.includes('logement') || norm.includes('crédit immo') || norm.includes('credit immo')) return Home;
  if (norm.includes('élec') || norm.includes('elec') || norm.includes('gaz') || norm.includes('energie') || norm.includes('énergie')) return Zap;
  if (norm.includes('eau')) return Droplet;
  if (norm.includes('assur')) return Shield;
  if (norm.includes('santé') || norm.includes('mutuelle') || norm.includes('sante') || norm.includes('pharma')) return HeartPulse;
  if (norm.includes('course') || norm.includes('aliment') || norm.includes('supermarché') || norm.includes('courses')) return ShoppingCart;
  if (norm.includes('carburant') || norm.includes('péage') || norm.includes('peage') || norm.includes('essence') || norm.includes('auto')) return Car;
  if (norm.includes('transport')) return Car;
  if (norm.includes('internet') || norm.includes('mobile') || norm.includes('télécom') || norm.includes('telecom')) return Smartphone;
  if (norm.includes('streaming') || norm.includes('cloud') || norm.includes('abonnement')) return Tv;
  if (norm.includes('restaurant') || norm.includes('fast food') || norm.includes('traiteur')) return UtensilsCrossed;
  if (norm.includes('café') || norm.includes('bar') || norm.includes('pub') || norm.includes('sortie')) return Utensils;
  if (norm.includes('shopping') || norm.includes('maison') || norm.includes('vêtement') || norm.includes('mode') || norm.includes('équipement')) return ShoppingBag;
  if (norm.includes('loisir') || norm.includes('activité') || norm.includes('culture') || norm.includes('cinéma') || norm.includes('sport')) return Sparkles;
  if (norm.includes('frais') || norm.includes('banque') || norm.includes('bancaire') || norm.includes('cotisation')) return Landmark;
  if (norm.includes('impôt') || norm.includes('amende') || norm.includes('taxe')) return Scale;
  return Receipt;
};

export const BudgetAndCostOfLivingDrawer: React.FC<BudgetAndCostOfLivingDrawerProps> = ({
  isOpen,
  onClose,
  onBack,
  initialTab = 'cost_of_living',
  bankTransactions,
  monthTransactions,
  allTransactions
}) => {
  // Navigation par sous-onglets intégrés
  const [activeTab, setActiveTab] = useState<'cost_of_living' | 'budget_tracking'>(initialTab);

  // Synchronisation si l'initialTab change
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  // Réconciliation des listes de transactions (historique complet vs mois ciblé)
  const effectiveAllTxs = useMemo(() => {
    return allTransactions || bankTransactions || [];
  }, [allTransactions, bankTransactions]);

  const effectiveMonthTxs = useMemo(() => {
    if (monthTransactions && monthTransactions.length > 0) return monthTransactions;
    return effectiveAllTxs;
  }, [monthTransactions, effectiveAllTxs]);

  // État partagé unique des postes de charges (Budget Alloué)
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemAmount, setNewItemAmount] = useState('');
  const [newItemGroup, setNewItemGroup] = useState('logement');
  const [openDrillDownId, setOpenDrillDownId] = useState<string | null>(null);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [highlightItemId, setHighlightItemId] = useState<string | null>(null);

  // Calcul des médianes IA sur l'historique complet
  const categoryMedians = useMemo(() => {
    return calculateCategoryMedians(effectiveAllTxs as any);
  }, [effectiveAllTxs]);

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
    if (categoryMedians[item.name]?.median) return categoryMedians[item.name].median;
    const targetCat = getCategoryForExpenseItem(item.name);
    if (targetCat && categoryMedians[targetCat]?.median) {
      return categoryMedians[targetCat].median;
    }
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

  // Médianes par groupe de catégories
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

    const expenses = effectiveAllTxs.filter(t => Number(t.amount) < 0 && !t.isInternalTransfer);

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
        const defaultItemsForGroup = DEFAULT_ITEMS.filter(d => d.categoryGroup === gid);
        const sumDefaultMedians = defaultItemsForGroup.reduce((acc, d) => acc + getEstimatedMedian(d), 0);
        result[gid] = Math.round(sumDefaultMedians);
      }
    });

    return result;
  }, [effectiveAllTxs, categoryMedians]);

  // Initialisation et sauvegarde unifiée (synchronisée en temps réel avec le Coach IA)
  const saveItems = (newItems: ExpenseItem[]) => {
    setItems(newItems);
    try {
      localStorage.setItem('cashpilot_cost_of_living_v2', JSON.stringify(newItems));
      localStorage.setItem('cashpilot_cost_of_living', JSON.stringify(newItems));
      window.dispatchEvent(new CustomEvent('cashpilot_cost_of_living_updated'));
    } catch {}
  };

  useEffect(() => {
    const handleExternalSync = () => {
      try {
        const saved = localStorage.getItem('cashpilot_cost_of_living_v2') || localStorage.getItem('cashpilot_cost_of_living');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setItems(parsed);
          }
        }
      } catch {}
    };
    window.addEventListener('cashpilot_cost_of_living_updated', handleExternalSync);
    return () => window.removeEventListener('cashpilot_cost_of_living_updated', handleExternalSync);
  }, []);

  const initializeItems = () => {
    const initItems = DEFAULT_ITEMS.map(item => {
      const avgAmount = getEstimatedMedian(item);
      return { ...item, amount: Math.round(avgAmount || 0), isAutoCalculated: true };
    });
    saveItems(initItems);
  };

  const handleResetToZero = () => {
    const zeroed = items.map(item => ({ ...item, amount: 0 }));
    saveItems(zeroed);
  };

  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem('cashpilot_cost_of_living_v2') || localStorage.getItem('cashpilot_cost_of_living');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
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

  const handleUpdateItem = (id: string, newAmount: number) => {
    saveItems(items.map(item => item.id === id ? { ...item, amount: newAmount } : item));
    setIsEditing(null);
  };

  const handleRemoveItem = (id: string) => {
    const isDefault = DEFAULT_ITEMS.some(d => d.id === id);
    if (isDefault) {
      saveItems(items.map(item => item.id === id ? { ...item, amount: 0 } : item));
    } else {
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

  const totalCostOfLivingAllocated = useMemo(() => {
    return items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [items]);

  // --- MOTEUR DE SUIVI RÉEL DU BUDGET (TAB 2) ---
  const getTxAmount = (t: BankTransaction) => Math.abs(Number(t.amount !== undefined ? t.amount : t.rawAmount) || 0);

  const isExpense = (t: BankTransaction) => {
    if (!isDebitTransaction(t)) return false;
    if (t.isInternalTransfer) return false;
    if (t.flowType === 'SAVINGS_TRANSFER' || t.flowType === 'INCOME') return false;
    const cat = (t.category || '').toLowerCase();
    if (cat.includes('virement interne') || cat.includes('épargne')) return false;
    return true;
  };

  const budgetRows: BudgetItemRow[] = useMemo(() => {
    const expenseTxs = effectiveMonthTxs.filter(isExpense);
    const postList = items.length > 0 ? items : DEFAULT_ITEMS;
    const matchedTxIds = new Set<string>();

    // A. Postes calibrés depuis le Coût de la vie
    const rows: BudgetItemRow[] = postList.map((item, idx) => {
      const itemName = item.name || 'Poste';
      const budgeted = Number(item.amount) || 0;

      let realSpent = 0;
      const rowTxs: BankTransaction[] = [];

      expenseTxs.forEach(tx => {
        if (matchesCostOfLivingItem(tx as any, itemName)) {
          const amt = getTxAmount(tx);
          realSpent += amt;
          rowTxs.push(tx);
          if (tx.id) matchedTxIds.add(tx.id);
        }
      });

      const Icon = getCategoryIcon(itemName);
      const diff = budgeted - realSpent;
      const percentage = budgeted > 0 ? (realSpent / budgeted) * 100 : (realSpent > 0 ? 100 : 0);

      return {
        id: item.id || `post_${idx}`,
        name: itemName,
        categoryGroup: item.categoryGroup,
        budgetAllocated: budgeted,
        realSpent: Math.round(realSpent * 100) / 100,
        diff: Math.round(diff * 100) / 100,
        percentage,
        icon: Icon,
        isFromRB: false,
        txCount: rowTxs.length,
        transactions: rowTxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      };
    });

    // B. Dépenses réelles non budgétées issues du relevé bancaire
    const remainingExpenses = expenseTxs.filter(t => !t.id || !matchedTxIds.has(t.id));
    const rbCategoryGroups = new Map<string, BankTransaction[]>();

    remainingExpenses.forEach(tx => {
      const cat = tx.category || 'Autre';
      const list = rbCategoryGroups.get(cat) || [];
      list.push(tx);
      rbCategoryGroups.set(cat, list);
    });

    const sortedRBCategories = Array.from(rbCategoryGroups.entries())
      .map(([catName, txList]) => {
        const spent = txList.reduce((sum, tx) => sum + getTxAmount(tx), 0);
        return { catName, txList, spent };
      })
      .sort((a, b) => b.spent - a.spent);

    sortedRBCategories.forEach(({ catName, txList, spent }, idx) => {
      rows.push({
        id: `rb_cat_${idx}_${catName}`,
        name: catName,
        categoryGroup: 'rb_real',
        budgetAllocated: 0,
        realSpent: Math.round(spent * 100) / 100,
        diff: -Math.round(spent * 100) / 100,
        percentage: 100,
        icon: getCategoryIcon(catName),
        isFromRB: true,
        txCount: txList.length,
        transactions: txList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      });
    });

    return rows;
  }, [items, effectiveMonthTxs]);

  const totalAllocated = useMemo(() => {
    return budgetRows.reduce((sum, r) => sum + r.budgetAllocated, 0);
  }, [budgetRows]);

  const totalRealSpent = useMemo(() => {
    return budgetRows.reduce((sum, r) => sum + r.realSpent, 0);
  }, [budgetRows]);

  const totalRemaining = totalAllocated - totalRealSpent;
  const isGlobalOverBudget = totalRemaining < 0;
  const globalPercentage = totalAllocated > 0 ? (totalRealSpent / totalAllocated) * 100 : 0;
  const globalVisualPercentage = Math.min(globalPercentage, 100);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      {/* Backdrop sombre et flouté */}
      <div 
        className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Drawer Panel Premium */}
      <div className="relative z-10 w-full max-w-3xl bg-card border-l border-border/80 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300 text-foreground overflow-hidden">
        
        {/* Header Unifié avec Bascule par Sous-Onglets */}
        <div className="p-4 sm:p-5 border-b border-border/60 bg-secondary/30 shrink-0 space-y-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
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
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-md shrink-0 mt-0.5">
                {activeTab === 'cost_of_living' ? <Calculator className="w-5 h-5" /> : <PiggyBank className="w-5 h-5" />}
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
                  {activeTab === 'cost_of_living' ? 'Simulateur : Coût de la vie' : 'Fixation & Suivi du Budget'}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {activeTab === 'cost_of_living' 
                    ? 'Définissez vos charges incompressibles cibles (Budget Alloué) avec l\'aide des médianes IA.' 
                    : 'Confrontez vos débits réels du relevé avec le Budget Alloué fixé dans le Coût de la vie.'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors shrink-0 cursor-pointer"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Sélecteur de sous-onglets ergonomique en 1 clic */}
          <div className="p-1 bg-secondary/80 rounded-2xl border border-border/60 shadow-inner flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('cost_of_living')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'cost_of_living'
                  ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
              }`}
            >
              <Calculator className={`w-4 h-4 ${activeTab === 'cost_of_living' ? 'text-emerald-400' : 'text-muted-foreground'}`} />
              <span>1. Coût de la vie (Budget Alloué)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('budget_tracking')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'budget_tracking'
                  ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
              }`}
            >
              <PiggyBank className={`w-4 h-4 ${activeTab === 'budget_tracking' ? 'text-teal-400' : 'text-muted-foreground'}`} />
              <span>2. Fixation & Suivi Réel</span>
            </button>
          </div>
        </div>

        {/* CONTENU ONGLET 1 : COÛT DE LA VIE (BUDGET ALLOUÉ) */}
        {activeTab === 'cost_of_living' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* KPI Card Coût de la vie */}
            <div className="p-4 sm:p-5 border-b border-border/60 bg-emerald-500/5 shrink-0 flex items-center justify-between flex-wrap gap-4">
              <div>
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Budget Alloué Mensuel Estimé (Coût de la vie)
                </span>
                <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-500 tracking-tight block mt-0.5">
                  {formatCurrency(totalCostOfLivingAllocated, { showSign: false })}
                </span>
                <span className="text-[11px] text-muted-foreground block mt-0.5">
                  Ces montants constituent le <strong className="text-foreground">Budget Alloué</strong> pour le suivi réel.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetToZero}
                  className="px-3 py-1.5 rounded-xl border border-border/80 bg-background/80 hover:bg-secondary text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Remettre tous les montants à 0 € sans supprimer les postes par défaut"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
                  <span>Réinitialiser (0 €)</span>
                </button>
                <button
                  type="button"
                  onClick={initializeItems}
                  className="px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-xs font-bold text-emerald-400 flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Recalculer les médianes constatées sur l'ensemble de votre relevé"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Médianes IA</span>
                </button>
              </div>
            </div>

            {/* Liste des postes organisés selon les 9 univers */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 overscroll-contain">
              {CATEGORY_GROUPS.map(group => {
                const groupItems = items.filter(i => i.categoryGroup === group.id);
                const Icon = group.icon;
                const groupTotal = groupItems.reduce((sum, i) => sum + i.amount, 0);
                const groupMedian = categoryGroupMedians[group.id] || 0;

                return (
                  <div key={group.id} className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-xs">
                    <div className="px-4 py-3 bg-secondary/40 border-b border-border/50 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-1.5 rounded-xl ${group.bg} ${group.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="font-bold text-sm text-foreground">{group.label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          Budget moyen / Médiane : <strong className="text-foreground font-mono">{formatCurrency(groupMedian, { showSign: false })}/mois</strong>
                        </span>
                        <span className="text-xs font-black font-mono text-foreground px-2.5 py-1 rounded-lg bg-background border border-border/60">
                          {formatCurrency(groupTotal, { showSign: false })}
                        </span>
                      </div>
                    </div>

                    <div className="p-2 space-y-1">
                      {groupItems.map(item => {
                        const estimatedMedian = getEstimatedMedian(item);
                        const medianDetail = getMedianDetailObj(item);
                        const isHighlighted = highlightItemId === item.id;

                        return (
                          <div 
                            key={item.id} 
                            className={`rounded-xl transition-all ${
                              isHighlighted ? 'ring-2 ring-emerald-500 bg-emerald-500/10' : 'hover:bg-secondary/30'
                            }`}
                          >
                            <div className="flex items-center justify-between p-2.5 group/item">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-xs font-semibold text-foreground truncate">{item.name}</span>
                                {estimatedMedian > 0 && (
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-secondary text-muted-foreground font-mono">
                                      Médiane constatée : {formatCurrency(estimatedMedian, { showSign: false })}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setOpenDrillDownId(openDrillDownId === item.id ? null : item.id)}
                                      className={`p-1 rounded-md text-primary transition-colors cursor-pointer ${
                                        openDrillDownId === item.id ? 'bg-primary/20 text-primary' : 'hover:bg-primary/10'
                                      }`}
                                      title="Voir les transactions réelles de référence et leur date"
                                    >
                                      <Eye className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {estimatedMedian > 0 && item.amount === 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateItem(item.id, estimatedMedian)}
                                    className="px-2 py-0.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold text-[10px] transition-colors cursor-pointer flex items-center gap-0.5"
                                    title={`Appliquer directement la médiane constatée (${formatCurrency(estimatedMedian, { showSign: false })})`}
                                  >
                                    <span>+ {formatCurrency(estimatedMedian, { showSign: false })}</span>
                                  </button>
                                )}

                                {isEditing === item.id ? (
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="number"
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      className="w-20 px-2 py-1 text-xs bg-background border border-primary/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono text-right"
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleUpdateItem(item.id, parseFloat(editValue) || 0);
                                        if (e.key === 'Escape') setIsEditing(null);
                                      }}
                                    />
                                    <button
                                      onClick={() => handleUpdateItem(item.id, parseFloat(editValue) || 0)}
                                      className="p-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer"
                                      title="Enregistrer"
                                    >
                                      <Save className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <span className={`font-black font-mono text-xs ${item.amount === 0 ? 'text-muted-foreground' : 'text-foreground'}`}>
                                      {formatCurrency(item.amount, { showSign: false })}
                                    </span>
                                    <button
                                      onClick={() => {
                                        setIsEditing(item.id);
                                        setEditValue(String(item.amount));
                                      }}
                                      className="p-1 rounded-lg text-muted-foreground hover:bg-secondary cursor-pointer"
                                      title="Modifier le montant alloué"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => handleRemoveItem(item.id)}
                                      className="p-1 rounded-lg text-rose-500/70 hover:text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                                      title={DEFAULT_ITEMS.some(d => d.id === item.id) ? "Mettre à 0 €" : "Supprimer"}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Drill-down de la médiane avec dates formatées harmonisées */}
                            {openDrillDownId === item.id && (() => {
                              const sampleTx = medianDetail?.sampleTx || [];
                              return (
                                <div className="mx-3 mb-2 p-2.5 rounded-xl bg-secondary/50 border border-border/50 animate-in slide-in-from-top-2 space-y-2">
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
                                        className="text-[10px] font-bold px-2 py-0.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors cursor-pointer"
                                      >
                                        Appliquer {formatCurrency(estimatedMedian, { showSign: false })}
                                      </button>
                                    )}
                                  </div>
                                  <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                                    {sampleTx.length === 0 ? (
                                      <span className="text-xs text-muted-foreground block py-1">
                                        Aucune transaction récente trouvée pour ce poste.
                                      </span>
                                    ) : (
                                      sampleTx.slice(0, 10).map(tx => (
                                        <div key={tx.id || `${tx.date}_${tx.amount}`} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg hover:bg-background/50 transition-colors">
                                          <div className="flex flex-col min-w-0">
                                            <span className="font-medium text-foreground truncate">{tx.cleanLabel || (tx as any).rawLabel || (tx as any).description}</span>
                                            <span className="text-[10px] text-muted-foreground">{formatDateFR(tx.date)}</span>
                                          </div>
                                          <span className="font-mono font-bold text-foreground shrink-0 ml-2">
                                            {formatCurrency(Math.abs(tx.amount), { showSign: false })}
                                          </span>
                                        </div>
                                      ))
                                    )}
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

            {/* Barre de navigation directe vers le suivi réel & Ajout de charge */}
            <div className="p-3.5 border-t border-border/60 bg-secondary/30 shrink-0 space-y-3">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border/60">
                <span className="text-xs font-medium text-muted-foreground">
                  Vos charges cibles sont fixées à <strong className="text-emerald-400 font-mono">{formatCurrency(totalCostOfLivingAllocated, { showSign: false })}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('budget_tracking')}
                  className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                >
                  <span>Confronter au Suivi Réel</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Formulaire d'ajout rapide */}
              <form onSubmit={handleAddItem} className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase">Ajouter une charge</label>
                  <input
                    type="text"
                    placeholder="Nom du poste (ex: Box Internet)..."
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-background border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground"
                  />
                </div>
                <div className="w-36 space-y-1">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase">Catégorie</label>
                  <select
                    value={newItemGroup}
                    onChange={(e) => setNewItemGroup(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs bg-background border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground"
                  >
                    {CATEGORY_GROUPS.map(g => (
                      <option key={g.id} value={g.id}>{g.label}</option>
                    ))}
                  </select>
                </div>
                <div className="w-24 space-y-1">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase">Montant (€)</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={newItemAmount}
                    onChange={(e) => setNewItemAmount(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-background border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground font-mono text-right"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!newItemName.trim() || !newItemAmount}
                  className="h-[34px] px-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        )}

        {/* CONTENU ONGLET 2 : FIXATION & SUIVI DU BUDGET (RÉEL VS ALLOUÉ) */}
        {activeTab === 'budget_tracking' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Bannière explicative : Origine du Budget Alloué */}
            <div className="p-3.5 sm:px-5 border-b border-border/60 bg-teal-500/10 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <HelpCircle className="w-4 h-4 text-teal-400 shrink-0" />
                <p className="text-xs text-muted-foreground leading-snug">
                  <strong className="text-foreground">Comprendre le Budget Alloué :</strong> Ce montant correspond strictement à vos charges prévisionnelles configurées dans l'onglet{' '}
                  <button 
                    type="button" 
                    onClick={() => setActiveTab('cost_of_living')}
                    className="text-teal-400 font-extrabold underline hover:text-teal-300 cursor-pointer"
                  >
                    Coût de la vie
                  </button>. CashPilot confronte ensuite chaque poste avec vos débits réels du relevé bancaire.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('cost_of_living')}
                className="px-2.5 py-1.5 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 font-bold text-[11px] shrink-0 border border-teal-500/30 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Edit2 className="w-3 h-3" />
                <span>Ajuster le Coût de la vie</span>
              </button>
            </div>

            {/* Synthèse Métriques Réel vs Alloué */}
            <div className="p-4 sm:p-5 border-b border-border/60 bg-secondary/15 shrink-0 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                {isGlobalOverBudget ? (
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span className="text-xs font-extrabold">
                      Budget dépassé de {formatCurrency(Math.abs(totalRemaining), { showSign: false })} sur ce relevé
                    </span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span className="text-xs font-extrabold">
                      Il vous reste {formatCurrency(totalRemaining, { showSign: false })} sur votre budget de ce mois.
                    </span>
                  </div>
                )}

                <div className="text-right">
                  <span className={`text-xl sm:text-2xl font-black font-mono tracking-tight ${
                    globalPercentage > 100 ? 'text-rose-400' : (globalPercentage >= 85 ? 'text-amber-400' : 'text-emerald-400')
                  }`}>
                    {globalPercentage.toFixed(0)}%
                  </span>
                  <span className="text-[10px] text-muted-foreground block font-medium">du budget consommé</span>
                </div>
              </div>

              {/* Jauge globale */}
              <div className="w-full h-2.5 rounded-full bg-secondary/80 overflow-hidden shadow-inner">
                <div 
                  className={`h-full rounded-full transition-all duration-700 ease-out ${
                    globalPercentage > 100 ? 'bg-rose-500' : (globalPercentage >= 85 ? 'bg-amber-500' : 'bg-emerald-500')
                  }`}
                  style={{ width: `${globalVisualPercentage}%` }}
                />
              </div>

              {/* Cartes métriques */}
              <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                <div className="p-2.5 rounded-xl bg-card border border-border/70 relative group">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                    Budget Alloué
                  </span>
                  <span className="text-sm sm:text-base font-black font-mono text-foreground">
                    {formatCurrency(totalAllocated, { showSign: false })}
                  </span>
                  <span className="text-[9px] text-teal-400 block mt-0.5 font-medium">
                    (issu du Coût de la vie)
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-card border border-border/70">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Dépense Réelle</span>
                  <span className="text-sm sm:text-base font-black font-mono text-foreground">
                    {formatCurrency(totalRealSpent, { showSign: false })}
                  </span>
                  <span className="text-[9px] text-muted-foreground block mt-0.5">
                    (débits du relevé)
                  </span>
                </div>

                <div className={`p-2.5 rounded-xl border ${
                  totalRemaining >= 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                }`}>
                  <span className="text-[10px] uppercase font-bold block opacity-80">Écart Net</span>
                  <span className="text-sm sm:text-base font-black font-mono">
                    {totalRemaining >= 0 ? '+' : '-'}{formatCurrency(Math.abs(totalRemaining), { showSign: false })}
                  </span>
                  <span className="text-[9px] block mt-0.5 opacity-80">
                    {totalRemaining >= 0 ? 'Reste à dépenser' : 'Dépassement net'}
                  </span>
                </div>
              </div>
            </div>

            {/* Ventilation Ligne par Ligne */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3 overscroll-contain">
              <div className="flex items-center justify-between pb-1">
                <h3 className="text-xs uppercase font-extrabold text-muted-foreground tracking-wider">
                  Ventilation par poste et catégorie réelle du relevé
                </h3>
                <span className="text-[11px] text-muted-foreground font-medium">
                  {budgetRows.length} postes audités
                </span>
              </div>

              <div className="space-y-2">
                {/* Entête du tableau sur grand écran */}
                <div className="hidden sm:grid sm:grid-cols-12 gap-3 px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border/40">
                  <div className="col-span-4">Poste / Catégorie Relevé</div>
                  <div className="col-span-2 text-right">Budget Alloué</div>
                  <div className="col-span-2 text-right">Dépense Réelle</div>
                  <div className="col-span-2 text-right">Écart</div>
                  <div className="col-span-2 text-center">Jauge</div>
                </div>

                {budgetRows.map((row) => {
                  const Icon = row.icon;
                  const isOver = row.diff < 0;
                  const isAmber = row.percentage >= 85 && row.percentage <= 100;
                  const progressWidth = Math.min(row.percentage, 100);
                  const barColor = isOver ? 'bg-rose-500' : (isAmber ? 'bg-amber-500' : 'bg-emerald-500');
                  const badgeBg = isOver ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                  const isExpanded = expandedRowId === row.id;

                  return (
                    <div 
                      key={row.id}
                      className="rounded-xl bg-card border border-border/70 hover:border-border transition-all overflow-hidden"
                    >
                      <div 
                        onClick={() => setExpandedRowId(isExpanded ? null : row.id)}
                        className="p-3 sm:px-3 sm:py-2.5 flex flex-col sm:grid sm:grid-cols-12 sm:items-center gap-2.5 cursor-pointer select-none hover:bg-secondary/20 transition-colors"
                      >
                        {/* Colonne Poste */}
                        <div className="col-span-4 flex items-center gap-2.5 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                            row.isFromRB ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : 'bg-secondary/80 border-border/50 text-primary'
                          }`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-xs sm:text-sm text-foreground truncate block">
                                {row.name}
                              </span>
                              {row.isFromRB && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">
                                  Relevé Bancaire
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                              <span>{row.txCount} opération{row.txCount > 1 ? 's' : ''}</span>
                              {row.budgetAllocated === 0 && row.realSpent > 0 && !row.isFromRB && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveTab('cost_of_living');
                                    setHighlightItemId(row.id);
                                  }}
                                  className="text-amber-500 hover:text-amber-400 font-semibold underline flex items-center gap-0.5 cursor-pointer"
                                  title="Cliquer pour définir ce montant dans l'onglet Coût de la vie"
                                >
                                  <span>Non défini dans Coût de la vie</span>
                                  <ArrowRight className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Mobile summary */}
                        <div className="grid grid-cols-3 gap-2 sm:hidden text-center pt-1 border-t border-border/40">
                          <div>
                            <span className="text-[9px] text-muted-foreground uppercase block">Alloué</span>
                            <span className="font-mono font-bold text-xs text-foreground">
                              {formatCurrency(row.budgetAllocated, { showSign: false })}
                            </span>
                          </div>
                          <div>
                            <span className="text-[9px] text-muted-foreground uppercase block">Réel</span>
                            <span className="font-mono font-bold text-xs text-foreground">
                              {formatCurrency(row.realSpent, { showSign: false })}
                            </span>
                          </div>
                          <div>
                            <span className="text-[9px] text-muted-foreground uppercase block">Écart</span>
                            <span className={`font-mono font-bold text-xs ${isOver ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {row.diff >= 0 ? '+' : ''}{formatCurrency(row.diff, { showSign: false })}
                            </span>
                          </div>
                        </div>

                        {/* Colonne Budget Alloué (Desktop) */}
                        <div className="hidden sm:block col-span-2 text-right">
                          <span className="font-mono font-bold text-xs text-foreground block">
                            {formatCurrency(row.budgetAllocated, { showSign: false })}
                          </span>
                          {!row.isFromRB && (
                            <span className="text-[9px] text-muted-foreground block">
                              {row.budgetAllocated > 0 ? 'Coût de la vie' : '0 € alloué'}
                            </span>
                          )}
                        </div>

                        {/* Colonne Dépense Réelle (Desktop) */}
                        <div className="hidden sm:block col-span-2 text-right">
                          <span className="font-mono font-bold text-xs text-foreground block">
                            {formatCurrency(row.realSpent, { showSign: false })}
                          </span>
                          <span className="text-[9px] text-muted-foreground block">
                            Relevé mensuel
                          </span>
                        </div>

                        {/* Colonne Écart (Desktop) */}
                        <div className="hidden sm:block col-span-2 text-right">
                          <span className={`inline-block font-mono font-bold text-xs px-2 py-0.5 rounded-md border ${badgeBg}`}>
                            {row.diff >= 0 ? '+' : ''}{formatCurrency(row.diff, { showSign: false })}
                          </span>
                        </div>

                        {/* Colonne Jauge (Desktop) */}
                        <div className="hidden sm:flex col-span-2 items-center justify-center gap-1.5">
                          <div className="flex-1 h-2 rounded-full bg-secondary/80 overflow-hidden shadow-inner max-w-[60px]">
                            <div 
                              className={`h-full rounded-full ${barColor} transition-all duration-500`}
                              style={{ width: `${progressWidth}%` }}
                            />
                          </div>
                          <span className={`text-[10px] font-mono font-bold ${isOver ? 'text-rose-400' : 'text-muted-foreground'}`}>
                            {row.percentage.toFixed(0)}%
                          </span>
                          <div className="text-muted-foreground ml-1">
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </div>
                        </div>
                      </div>

                      {/* Accordéon : Détail des transactions réelles du mois pour ce poste */}
                      {isExpanded && (
                        <div className="border-t border-border/50 bg-secondary/20 p-3 sm:px-4 space-y-2 animate-in slide-in-from-top-1 duration-150">
                          <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground">
                            <span>Détail des opérations réelles ({row.txCount})</span>
                            <span>Total : {formatCurrency(row.realSpent, { showSign: false })}</span>
                          </div>

                          {row.transactions.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic py-1">
                              Aucune dépense constatée sur ce relevé pour ce poste.
                            </p>
                          ) : (
                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                              {row.transactions.map((tx) => (
                                <div 
                                  key={tx.id || `${tx.date}_${tx.amount}`}
                                  className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-card/60 border border-border/40 text-xs"
                                >
                                  <div className="min-w-0 flex-1 mr-3">
                                    <span className="font-semibold text-foreground truncate block">
                                      {tx.cleanLabel || tx.rawLabel || tx.description}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                                      {formatDateFR(tx.date)}
                                    </span>
                                  </div>
                                  <span className="font-mono font-bold text-foreground shrink-0">
                                    {formatCurrency(getTxAmount(tx), { showSign: false })}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-border/60 bg-secondary/30 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Synchronisation immédiate entre Coût de la vie et Fixation du budget</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-bold text-xs transition-colors cursor-pointer"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
};
