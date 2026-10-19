import React, { useState, useMemo, useEffect } from 'react';
import { X, Lock, Plus, Trash2, Home, HeartPulse, ShoppingCart, Car, Tv, Edit2, Save, Calculator, RefreshCw, ChevronDown, History, Eye, ArrowLeft } from 'lucide-react';
import { formatCurrency, type BankTransaction } from '../lib/bankUtils';
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
  isAutoCalculated: boolean;
}

const CATEGORY_GROUPS = [
  { id: 'logement', label: 'Logement & Énergie', icon: Home, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { id: 'sante', label: 'Assurances & Santé', icon: HeartPulse, color: 'text-rose-400', bg: 'bg-rose-500/10' },
  { id: 'alimentation', label: 'Alimentation & Courses', icon: ShoppingCart, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { id: 'transport', label: 'Transport', icon: Car, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  { id: 'abonnements', label: 'Abonnements & Loisirs', icon: Tv, color: 'text-purple-400', bg: 'bg-purple-500/10' }
];

const DEFAULT_ITEMS: ExpenseItem[] = [
  { id: 'loyer', name: 'Loyer / Crédit Immobilier', amount: 0, categoryGroup: 'logement', isAutoCalculated: true },
  { id: 'elec', name: 'Électricité / Gaz', amount: 0, categoryGroup: 'logement', isAutoCalculated: true },
  { id: 'eau', name: 'Eau', amount: 0, categoryGroup: 'logement', isAutoCalculated: true },
  { id: 'assurance', name: 'Assurances', amount: 0, categoryGroup: 'sante', isAutoCalculated: true },
  { id: 'sante', name: 'Santé & Mutuelle', amount: 0, categoryGroup: 'sante', isAutoCalculated: true },
  { id: 'courses', name: 'Courses Alimentaires', amount: 0, categoryGroup: 'alimentation', isAutoCalculated: true },
  { id: 'carburant', name: 'Carburant / Péages', amount: 0, categoryGroup: 'transport', isAutoCalculated: true },
  { id: 'transports', name: 'Transports en commun', amount: 0, categoryGroup: 'transport', isAutoCalculated: true },
  { id: 'telecom', name: 'Abonnements & Télécom', amount: 0, categoryGroup: 'abonnements', isAutoCalculated: true },
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

  const getCategoryForExpenseItem = (itemName: string): string | null => {
    if (categoryMedians[itemName]) return itemName;
    if (itemName.includes('Loyer')) return 'Loyer / Crédit Immobilier';
    if (itemName.includes('Électricité') || itemName.includes('Gaz')) return 'Électricité / Gaz';
    if (itemName.includes('Eau')) return 'Eau';
    if (itemName.includes('Assurance')) return 'Assurances';
    if (itemName.includes('Santé')) return 'Santé & Mutuelle';
    if (itemName.includes('Courses')) return 'Courses Alimentaires';
    if (itemName.includes('Carburant')) return 'Carburant / Péages';
    if (itemName.includes('Transports en commun')) return 'Transports en commun';
    if (itemName.includes('Abonnements')) return 'Abonnements & Télécom';
    return null;
  };

  const categoryMedians = useMemo(() => {
    return calculateCategoryMedians(bankTransactions as any);
  }, [bankTransactions]);

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
      const cat = t.category || '';
      if (cat.includes('Loyer') || cat.includes('Électricité') || cat.includes('Eau')) groupId = 'logement';
      else if (cat.includes('Assurance') || cat.includes('Santé') || cat.includes('Mutuelle')) groupId = 'sante';
      else if (cat.includes('Alimentation') || cat.includes('Courses') || cat.includes('Restaurant')) groupId = 'alimentation';
      else if (cat.includes('Carburant') || cat.includes('Transport') || cat.includes('Véhicule')) groupId = 'transport';
      else if (cat.includes('Abonnement') || cat.includes('Télécom') || cat.includes('Loisirs')) groupId = 'abonnements';
      
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

  const initializeItems = () => {
    const initItems = DEFAULT_ITEMS.map(item => {
      // 1. Priorité au calcul de la médiane par poste via les synonymes
      let avgAmount = categoryMedians[item.name]?.median;

      // 2. Si non trouvé directement par le nom du poste, tester le getter de catégorie
      if (avgAmount === undefined) {
        const targetCat = getCategoryForExpenseItem(item.name);
        if (targetCat && categoryMedians[targetCat]) {
          avgAmount = categoryMedians[targetCat].median;
        }
      }

      // 3. Fallbacks historiques de compatibilité
      if (avgAmount === undefined || avgAmount === 0) {
        if (item.name.includes('Loyer')) avgAmount = categoryMedians['Loyer / Charges']?.median || categoryMedians['Logement & Énergie']?.median || 0;
        else if (item.name.includes('Assurance')) avgAmount = categoryMedians['Assurances']?.median || 0;
        else if (item.name.includes('Santé')) avgAmount = categoryMedians['Santé & Mutuelle']?.median || categoryMedians['Santé']?.median || 0;
        else if (item.name.includes('Courses')) avgAmount = categoryMedians['Alimentation & Courses']?.median || 0;
        else if (item.name.includes('Carburant')) avgAmount = categoryMedians['Carburant & Péages']?.median || categoryMedians['Transports & Carburant']?.median || 0;
        else if (item.name.includes('Transports en commun')) avgAmount = categoryMedians['Transports']?.median || 0;
        else if (item.name.includes('Abonnements')) avgAmount = categoryMedians['Abonnements & Télécom']?.median || 0;
      }

      return { ...item, amount: Math.round(avgAmount || 0) };
    });
    setItems(initItems);
  };

  // Load from local storage or initialize
  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem('cashpilot_cost_of_living');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setItems(parsed);
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
  }, [isOpen, categoryMedians]);

  const saveItems = (newItems: ExpenseItem[]) => {
    setItems(newItems);
    localStorage.setItem('cashpilot_cost_of_living', JSON.stringify(newItems));
  };

  const handleUpdateItem = (id: string, newAmount: number) => {
    saveItems(items.map(item => item.id === id ? { ...item, amount: newAmount, isAutoCalculated: false } : item));
    setIsEditing(null);
  };

  const handleRemoveItem = (id: string) => {
    saveItems(items.filter(item => item.id !== id));
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
                  Estimez vos charges incompressibles mensuelles. Les montants initiaux sont basés sur la médiane de vos dépenses réelles par catégorie.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors shrink-0"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Total Summary */}
        <div className="p-5 border-b border-border/60 bg-secondary/15 shrink-0">
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
            <div>
              <span className="text-xs uppercase font-bold text-emerald-500/90 block mb-1">
                Coût de la vie Mensuel Estimé
              </span>
              <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-400">
                {formatCurrency(totalCost, { showSign: false })}
              </span>
            </div>
            <button 
              onClick={() => {
                if (window.confirm("Voulez-vous réinitialiser toutes les valeurs avec les moyennes calculées par l'IA ?")) {
                  initializeItems();
                  localStorage.removeItem('cashpilot_cost_of_living');
                }
              }}
              className="px-3 py-2 text-xs font-semibold rounded-xl bg-secondary/80 hover:bg-secondary text-foreground flex items-center gap-2 transition-colors border border-border/50"
              title="Réinitialiser avec les médianes constatées"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Réinitialiser
            </button>
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
                <div className="flex items-center justify-between pb-2 border-b border-border/40">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-lg ${group.bg} ${group.color} flex items-center justify-center`}>
                      <GroupIcon className="w-3.5 h-3.5" />
                    </div>
                    <h3 className="font-bold text-sm text-foreground">{group.label}</h3>
                  </div>
                  <span className="font-mono font-bold text-sm text-muted-foreground">
                    {formatCurrency(groupTotal, { showSign: false })}
                  </span>
                </div>
                {discrepancyAlert}

                <div className="space-y-2">
                  {groupItems.map(item => (
                    <div key={item.id} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/50 hover:border-border transition-colors group/item">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-foreground/90">{item.name}</span>
                          {item.isAutoCalculated && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground uppercase font-bold tracking-wider">
                              Médiane Constatée
                            </span>
                          )}
                          {item.isAutoCalculated && (
                            <button
                              onClick={() => setOpenDrillDownId(openDrillDownId === item.id ? null : item.id)}
                              className="p-1 rounded-md text-primary hover:bg-primary/10 transition-colors ml-1"
                              title="Voir le détail de la médiane"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-3">
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
                                className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20"
                              >
                                <Save className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-black font-mono text-sm">
                                {formatCurrency(item.amount, { showSign: false })}
                              </span>
                              <button
                                onClick={() => {
                                  setIsEditing(item.id);
                                  setEditValue(String(item.amount));
                                }}
                                className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary opacity-0 group-hover/item:opacity-100 transition-opacity"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleRemoveItem(item.id)}
                                className="p-1.5 rounded-lg text-rose-500/50 hover:text-rose-500 hover:bg-rose-500/10 opacity-0 group-hover/item:opacity-100 transition-opacity"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {openDrillDownId === item.id && (() => {
                        const targetCat = getCategoryForExpenseItem(item.name);
                        const medianObj = targetCat ? categoryMedians[targetCat] : null;
                        
                        if (!medianObj || medianObj.sampleTx.length === 0) {
                          return (
                            <div className="mx-4 p-3 rounded-lg bg-secondary/50 text-xs text-muted-foreground border border-border/50 animate-in slide-in-from-top-2">
                              Aucun historique récent pour calculer la médiane.
                            </div>
                          );
                        }

                        return (
                          <div className="mx-4 p-3 rounded-lg bg-secondary/50 border border-border/50 animate-in slide-in-from-top-2">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                Historique récent
                              </span>
                              <button
                                onClick={() => {
                                  handleUpdateItem(item.id, medianObj.median);
                                  setOpenDrillDownId(null);
                                }}
                                className="text-[10px] font-bold px-2 py-1 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                              >
                                Appliquer la médiane : {formatCurrency(medianObj.median, { showSign: false })}
                              </button>
                            </div>
                            <div className="space-y-1.5 max-h-40 overflow-y-auto">
                              {medianObj.sampleTx.slice(0, 5).map(tx => (
                                <div key={tx.id || tx.date} className="flex items-center justify-between text-xs py-1 px-2 rounded-md hover:bg-background/50 transition-colors">
                                  <div className="flex flex-col min-w-0">
                                    <span className="font-medium text-foreground truncate">{tx.cleanLabel || tx.rawLabel}</span>
                                    <span className="text-[10px] text-muted-foreground">{tx.date}</span>
                                  </div>
                                  <span className="font-mono font-semibold text-foreground shrink-0 ml-2">
                                    {formatCurrency(Math.abs(tx.amount), { showSign: false })}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ))}
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
              className="h-[38px] px-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold flex items-center gap-1 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};
