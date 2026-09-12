import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  ArrowLeftRight, 
  Search, 
  Upload, 
  Plus, 
  Trash2, 
  Sparkles, 
  X,
  Loader2,
  Calendar,
  Layers,
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { useTransactions } from '../../context/TransactionsContext';
import { 
  CATEGORIES, 
  classifyFlowType, 
  calculateBankMetrics, 
  checkDuplicateTransactions, 
  parseCsvBankFile,
  type FlowType, 
  type BankTransaction 
} from '../../lib/bankUtils';
import { db, storage, functions } from '../../lib/firebase';
import { doc, deleteDoc, writeBatch, collection, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';

export const BankStatements: React.FC = () => {
  const { 
    transactions: rawTransactions, 
    loading: contextLoading,
    selectedMonth,
    setSelectedMonth,
    availableMonths
  } = useTransactions();

  // Local state for interactive features
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkCategoryModalOpen, setIsBulkCategoryModalOpen] = useState(false);
  const [bulkTargetCategory, setBulkTargetCategory] = useState<string>(CATEGORIES[0]);
  
  // File processing states
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [fileStatusMessage, setFileStatusMessage] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state for manual transaction
  const [manualTx, setManualTx] = useState({
    date: new Date().toISOString().substring(0, 10),
    description: '',
    amount: '',
    category: 'Alimentation & Courses',
    flowType: 'VARIABLE_EXPENSE' as FlowType,
    account: 'Compte Courant'
  });

  // Convert raw Firestore transactions to BankTransaction models with strict flowType
  const bankTransactions: BankTransaction[] = useMemo(() => {
    return rawTransactions.map(t => {
      const id = String(t.id || `tx_${t.date}_${t.amount}_${Math.random()}`);
      const desc = t.description || t.cleanLabel || t.rawLabel || 'Opération';
      const amount = Number(t.amount) || 0;
      const category = t.category || (amount > 0 ? 'Salaire & Revenus' : 'Autre');
      const flowType: FlowType = t.flowType || classifyFlowType(category, amount, desc);

      return {
        id,
        date: t.date || new Date().toISOString().substring(0, 10),
        description: desc,
        amount,
        flowType,
        category,
        account: t.accountName || t.account || 'Compte Principal',
        status: flowType === 'SAVINGS_TRANSFER' ? 'Internal Transfer' : 'Reconciled',
        monthKey: t.monthKey || (t.date ? t.date.substring(0, 7) : undefined),
        rawLabel: t.rawLabel,
        cleanLabel: t.cleanLabel
      };
    });
  }, [rawTransactions]);

  // Financial Metrics Calculation (Finary separation rules: Savings/Transfers neutralised)
  const metrics = useMemo(() => {
    // If a month is selected, compute metrics on that month
    const scopedTxs = selectedMonth === 'all' 
      ? bankTransactions 
      : bankTransactions.filter(t => (t.monthKey === selectedMonth || t.date.startsWith(selectedMonth)));
      
    return calculateBankMetrics(scopedTxs);
  }, [bankTransactions, selectedMonth]);

  // Filtered & Searched Transaction List
  const filteredTransactions = useMemo(() => {
    return bankTransactions.filter(t => {
      // Month scope filter
      if (selectedMonth !== 'all' && t.monthKey !== selectedMonth && !t.date.startsWith(selectedMonth)) {
        return false;
      }

      // Text search filter
      const search = searchTerm.toLowerCase().trim();
      if (search) {
        const matchDesc = t.description.toLowerCase().includes(search);
        const matchCat = t.category.toLowerCase().includes(search);
        const matchAmt = String(t.amount).includes(search);
        const matchAcc = (t.account || '').toLowerCase().includes(search);
        if (!matchDesc && !matchCat && !matchAmt && !matchAcc) return false;
      }

      // Flow type filter
      if (selectedFilter === 'ALL') return true;
      if (selectedFilter === 'INCOME') return t.flowType === 'INCOME';
      if (selectedFilter === 'FIXED') return t.flowType === 'FIXED_EXPENSE';
      if (selectedFilter === 'VARIABLE') return t.flowType === 'VARIABLE_EXPENSE';
      if (selectedFilter === 'EXPENSE') return t.flowType === 'FIXED_EXPENSE' || t.flowType === 'VARIABLE_EXPENSE';
      if (selectedFilter === 'SAVINGS') return t.flowType === 'SAVINGS_TRANSFER';
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [bankTransactions, searchTerm, selectedFilter, selectedMonth]);

  // Auto-hide notification
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // 1. Inline Category Change with Firestore sync
  const handleCategoryChange = async (id: string, newCategory: string) => {
    const tx = bankTransactions.find(t => t.id === id);
    if (!tx) return;

    const newFlowType = classifyFlowType(newCategory, tx.amount, tx.description);

    try {
      const deviceId = localStorage.getItem('deviceId') || 'default-user';
      const docRef = doc(db, `users/${deviceId}/transactions`, id);
      
      await updateDoc(docRef, {
        category: newCategory,
        flowType: newFlowType,
        nature: newFlowType === 'FIXED_EXPENSE' ? 'fixe' : newFlowType === 'VARIABLE_EXPENSE' ? 'variable' : 'autre',
        updatedAt: new Date().toISOString()
      });

      setNotification({
        type: 'success',
        message: `Catégorie mise à jour : ${newCategory}`
      });
    } catch (err) {
      console.error("Erreur lors de la mise à jour de la catégorie:", err);
      setNotification({
        type: 'error',
        message: "Échec de la synchronisation Firestore."
      });
    }
  };

  // 2. Single Delete with Firestore sync
  const handleDelete = async (id: string) => {
    if (!window.confirm("Supprimer définitivement cette transaction ?")) return;

    try {
      const deviceId = localStorage.getItem('deviceId') || 'default-user';
      await deleteDoc(doc(db, `users/${deviceId}/transactions`, id));

      setSelectedTxIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });

      setNotification({
        type: 'info',
        message: "Transaction supprimée avec succès."
      });
    } catch (err) {
      console.error("Erreur suppression transaction:", err);
      setNotification({
        type: 'error',
        message: "Impossible de supprimer la transaction."
      });
    }
  };

  // 3. Selection Handlers
  const handleToggleSelect = (id: string) => {
    setSelectedTxIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedTxIds.size === filteredTransactions.length) {
      setSelectedTxIds(new Set());
    } else {
      setSelectedTxIds(new Set(filteredTransactions.map(t => t.id)));
    }
  };

  // 4. Bulk Delete with writeBatch
  const handleDeleteSelected = async () => {
    const count = selectedTxIds.size;
    if (count === 0) return;
    if (!window.confirm(`Supprimer ces ${count} transactions sélectionnées ?`)) return;

    try {
      const deviceId = localStorage.getItem('deviceId') || 'default-user';
      const batch = writeBatch(db);

      selectedTxIds.forEach(id => {
        const docRef = doc(db, `users/${deviceId}/transactions`, id);
        batch.delete(docRef);
      });

      await batch.commit();
      setSelectedTxIds(new Set());
      setNotification({
        type: 'info',
        message: `${count} transactions supprimées en lot.`
      });
    } catch (err) {
      console.error("Erreur suppression groupée:", err);
      setNotification({
        type: 'error',
        message: "Erreur lors de la suppression en lot."
      });
    }
  };

  // 5. Bulk Category Update
  const handleBulkCategoryApply = async () => {
    const count = selectedTxIds.size;
    if (count === 0) return;

    try {
      const deviceId = localStorage.getItem('deviceId') || 'default-user';
      const batch = writeBatch(db);

      selectedTxIds.forEach(id => {
        const tx = bankTransactions.find(t => t.id === id);
        const flow = tx ? classifyFlowType(bulkTargetCategory, tx.amount, tx.description) : 'VARIABLE_EXPENSE';
        const docRef = doc(db, `users/${deviceId}/transactions`, id);
        batch.update(docRef, {
          category: bulkTargetCategory,
          flowType: flow,
          nature: flow === 'FIXED_EXPENSE' ? 'fixe' : flow === 'VARIABLE_EXPENSE' ? 'variable' : 'autre',
          updatedAt: new Date().toISOString()
        });
      });

      await batch.commit();
      setIsBulkCategoryModalOpen(false);
      setSelectedTxIds(new Set());
      setNotification({
        type: 'success',
        message: `${count} transactions reclassées en "${bulkTargetCategory}".`
      });
    } catch (err) {
      console.error("Erreur réassignation groupée:", err);
      setNotification({
        type: 'error',
        message: "Erreur lors du changement de catégorie en lot."
      });
    }
  };

  // 6. Manual Transaction Submission
  const handleCreateManualTx = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawAmt = parseFloat(manualTx.amount.replace(',', '.'));
    if (isNaN(rawAmt) || rawAmt === 0) {
      alert("Veuillez saisir un montant numérique valide.");
      return;
    }
    if (!manualTx.description.trim()) {
      alert("Veuillez indiquer un libellé.");
      return;
    }

    try {
      const deviceId = localStorage.getItem('deviceId') || 'default-user';
      const txCollection = collection(db, `users/${deviceId}/transactions`);
      const newDocRef = doc(txCollection);

      const finalAmount = manualTx.flowType === 'INCOME' ? Math.abs(rawAmt) : -Math.abs(rawAmt);
      const monthKey = manualTx.date.substring(0, 7);

      await writeBatch(db).set(newDocRef, {
        id: newDocRef.id,
        date: manualTx.date,
        monthKey,
        rawLabel: manualTx.description,
        cleanLabel: manualTx.description,
        amount: finalAmount,
        direction: finalAmount > 0 ? 'credit' : 'debit',
        category: manualTx.category,
        flowType: manualTx.flowType,
        nature: manualTx.flowType === 'FIXED_EXPENSE' ? 'fixe' : manualTx.flowType === 'VARIABLE_EXPENSE' ? 'variable' : 'autre',
        accountName: manualTx.account || 'Compte Principal',
        aiStatus: 'completed',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }).commit();

      setIsAddModalOpen(false);
      setManualTx({
        date: new Date().toISOString().substring(0, 10),
        description: '',
        amount: '',
        category: 'Alimentation & Courses',
        flowType: 'VARIABLE_EXPENSE',
        account: 'Compte Courant'
      });

      setNotification({
        type: 'success',
        message: "Opération ajoutée avec succès !"
      });
    } catch (err) {
      console.error("Erreur ajout manuel:", err);
      setNotification({
        type: 'error',
        message: "Échec de l'enregistrement de l'opération."
      });
    }
  };

  // 7. File Upload & Extraction (CSV or PDF)
  const handleFileUpload = async (file: File) => {
    setIsProcessingFile(true);
    setFileStatusMessage(`Analyse de ${file.name}...`);

    try {
      const deviceId = localStorage.getItem('deviceId') || 'default-user';
      let extractedTxs: BankTransaction[] = [];

      if (file.name.endsWith('.csv') || file.type.includes('csv') || file.type.includes('text')) {
        // Direct Client CSV Parsing
        setFileStatusMessage("Lecture et détection des colonnes CSV...");
        extractedTxs = await parseCsvBankFile(file);
      } else {
        // PDF or Image Upload to Firebase Cloud Function
        setFileStatusMessage("Téléversement sécurisé vers Firebase Storage...");
        const storageRef = ref(storage, `users/${deviceId}/uploads/statements/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);

        setFileStatusMessage("Analyse OCR et extraction IA en cours...");
        const analyzeDocument = httpsCallable(functions, 'analyzeDocument');
        const response = await analyzeDocument({ fileUrl: url, fileType: 'bank_statement', mimeType: file.type });
        const result = response.data as any;

        if (result.success && result.data?.transactions) {
          extractedTxs = result.data.transactions.map((t: any, i: number) => {
            const amt = Number(t.amount) || 0;
            const desc = t.description || t.label || 'Opération';
            const cat = t.category || (amt > 0 ? 'Salaire & Revenus' : 'Autre');
            const flow = classifyFlowType(cat, amt, desc);
            return {
              id: `pdf_${Date.now()}_${i}`,
              date: t.date || new Date().toISOString().substring(0, 10),
              description: desc,
              amount: amt,
              flowType: flow,
              category: cat,
              account: 'Compte Relevé PDF'
            };
          });
        }
      }

      if (extractedTxs.length === 0) {
        setNotification({
          type: 'info',
          message: "Aucune transaction exploitable n'a été détectée dans ce fichier."
        });
        setIsProcessingFile(false);
        setFileStatusMessage(null);
        return;
      }

      // Check Duplicates against existing bank transactions
      setFileStatusMessage("Vérification des doublons...");
      const { duplicatesCount, uniqueTxs } = checkDuplicateTransactions(extractedTxs, bankTransactions);

      if (uniqueTxs.length === 0) {
        setNotification({
          type: 'info',
          message: `Les ${duplicatesCount} transactions importées sont déjà présentes dans vos relevés.`
        });
        setIsProcessingFile(false);
        setFileStatusMessage(null);
        setIsUploading(false);
        return;
      }

      // Save Unique Transactions in Firestore batch
      setFileStatusMessage(`Sauvegarde de ${uniqueTxs.length} opérations...`);
      const batch = writeBatch(db);
      const txRef = collection(db, `users/${deviceId}/transactions`);

      uniqueTxs.forEach(tx => {
        const newDoc = doc(txRef);
        const monthKey = tx.date ? tx.date.substring(0, 7) : new Date().toISOString().substring(0, 7);

        batch.set(newDoc, {
          id: newDoc.id,
          date: tx.date,
          monthKey,
          rawLabel: tx.description,
          cleanLabel: tx.description,
          amount: tx.amount,
          direction: tx.amount > 0 ? 'credit' : 'debit',
          category: tx.category,
          flowType: tx.flowType,
          nature: tx.flowType === 'FIXED_EXPENSE' ? 'fixe' : tx.flowType === 'VARIABLE_EXPENSE' ? 'variable' : 'autre',
          accountName: tx.account || 'Import',
          aiStatus: 'completed',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      });

      await batch.commit();

      setNotification({
        type: 'success',
        message: `Import réussi : ${uniqueTxs.length} opérations ajoutées (${duplicatesCount} doublons ignorés).`
      });
      setIsUploading(false);
    } catch (err: any) {
      console.error("Erreur import fichier:", err);
      setNotification({
        type: 'error',
        message: "Erreur lors de l'analyse du fichier : " + (err.message || 'Format non supporté.')
      });
    } finally {
      setIsProcessingFile(false);
      setFileStatusMessage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const getFlowBadge = (type: FlowType) => {
    switch (type) {
      case 'INCOME':
        return <Badge variant="income">Revenu</Badge>;
      case 'FIXED_EXPENSE':
        return <Badge variant="fixed">Charge Fixe</Badge>;
      case 'VARIABLE_EXPENSE':
        return <Badge variant="variable">Courante</Badge>;
      case 'SAVINGS_TRANSFER':
        return <Badge variant="savings">Épargne / Neutre</Badge>;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-28 md:pb-12 max-w-7xl mx-auto p-4 md:p-8">
      
      {/* Toast Notification Banner */}
      {notification && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between shadow-lg transition-all animate-in slide-in-from-top-2 ${
          notification.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
          notification.type === 'error' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' :
          'bg-primary/10 border-primary/30 text-primary'
        }`}>
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="p-1 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Title & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse" />
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Gestion de Trésorerie & Audit
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mt-1 text-foreground">
            Relevés Bancaires
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Contrôle d'audit, classification financière précise & neutralisation de l'épargne.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Month Selector */}
          {availableMonths.length > 0 && (
            <div className="flex items-center gap-2 bg-card/80 dark:bg-[#10141e]/80 border border-border/80 dark:border-white/[0.08] rounded-xl px-3 py-2 shadow-sm">
              <Calendar className="w-4 h-4 text-primary" />
              <select
                className="bg-transparent text-xs md:text-sm font-semibold outline-none text-foreground cursor-pointer"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
              >
                <option value="all">Toutes périodes</option>
                {availableMonths.map(m => (
                  <option key={m} value={m} className="dark:bg-[#10141e]">{m}</option>
                ))}
              </select>
            </div>
          )}

          <Button 
            variant="secondary"
            onClick={() => setIsUploading(!isUploading)}
            className="flex items-center gap-2 border border-border/40 shadow-sm"
          >
            <Upload className="w-4 h-4 text-primary" />
            Importer un relevé
          </Button>

          <Button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground shadow-lg shadow-primary/20"
          >
            <Plus className="w-4 h-4" />
            Ajouter une opération
          </Button>
        </div>
      </div>

      {/* Upload Dropzone Drawer */}
      {isUploading && (
        <Card className="p-8 border-dashed border-2 border-primary/40 bg-card/60 backdrop-blur-md text-center transition-all animate-in fade-in-50 rounded-2xl relative">
          <button 
            onClick={() => setIsUploading(false)}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div 
            className="flex flex-col items-center justify-center gap-3 py-4 cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileUpload(e.dataTransfer.files[0]);
              }
            }}
          >
            <div className="p-4 rounded-2xl bg-primary/10 text-primary shadow-inner">
              {isProcessingFile ? (
                <Loader2 className="w-8 h-8 animate-spin" />
              ) : (
                <Upload className="w-8 h-8 animate-bounce" />
              )}
            </div>

            <div>
              <p className="text-base font-semibold text-foreground">
                {isProcessingFile ? fileStatusMessage : "Glissez-déposez votre relevé bancaire (PDF ou CSV)"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Déduplication automatique, détection intelligente des flux & classification instantanée
              </p>
            </div>

            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".csv,.pdf,text/csv,application/pdf"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }} 
            />

            <Button 
              size="sm" 
              variant="outline" 
              disabled={isProcessingFile}
              className="mt-2 pointer-events-none"
            >
              {isProcessingFile ? "Traitement en cours..." : "Sélectionner un fichier"}
            </Button>
          </div>
        </Card>
      )}

      {/* Top Metrics Strip (Finary-grade luxury cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Inflows */}
        <Card className="glass-card p-5 border border-border/60 hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Revenus Réels
            </span>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold tracking-tight text-foreground">
              +{metrics.income.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </div>
            <p className="text-xs text-muted-foreground mt-1">Salaires et encaissements réels</p>
          </div>
        </Card>

        {/* Real Outflows */}
        <Card className="glass-card p-5 border border-border/60 hover:border-rose-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Dépenses Réelles
            </span>
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-500">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold tracking-tight text-rose-500">
              -{metrics.realExpenses.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Fixes ({metrics.fixed.toFixed(0)}€) + Variables ({metrics.variable.toFixed(0)}€)
            </p>
          </div>
        </Card>

        {/* Savings & Transfers (Neutralised) */}
        <Card className="glass-card p-5 border border-border/60 hover:border-purple-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Épargne & Trésorerie
            </span>
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-500">
              <ArrowLeftRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold tracking-tight text-purple-500">
              {metrics.savings.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </div>
            <p className="text-xs text-muted-foreground mt-1">Virements internes neutralisés</p>
          </div>
        </Card>

        {/* Net Cash Flow / Reste à Vivre Réel */}
        <Card className="glass-card p-5 border border-border/60 hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Reste à Vivre Réel
            </span>
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-2xl font-extrabold tracking-tight ${metrics.resteAVivre >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {metrics.resteAVivre >= 0 ? '+' : ''}
              {metrics.resteAVivre.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Solde net disponible : {metrics.netCashFlow >= 0 ? '+' : ''}{metrics.netCashFlow.toFixed(0)} €
            </p>
          </div>
        </Card>
      </div>

      {/* Interactive Control Bar */}
      <Card className="glass-card p-4 border border-border/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher libellé, commerçant, catégorie, montant..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs md:text-sm rounded-xl bg-background/80 border border-border/60 focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground transition-all"
            />
          </div>

          {/* Quick Flow Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {[
              { id: 'ALL', label: 'Toutes' },
              { id: 'INCOME', label: 'Revenus' },
              { id: 'FIXED', label: 'Fixes' },
              { id: 'VARIABLE', label: 'Variables' },
              { id: 'SAVINGS', label: 'Épargne / Neutre' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap ${
                  selectedFilter === tab.id
                    ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                    : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Bulk Actions when selected */}
          {selectedTxIds.size > 0 && (
            <div className="flex items-center gap-2 animate-in fade-in">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setIsBulkCategoryModalOpen(true)}
                className="flex items-center gap-1.5 text-xs"
              >
                <Layers className="w-3.5 h-3.5" />
                Reclasser ({selectedTxIds.size})
              </Button>
              <Button 
                size="sm" 
                variant="destructive"
                onClick={handleDeleteSelected}
                className="flex items-center gap-1.5 text-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Supprimer ({selectedTxIds.size})
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Transactions Table */}
      <Card className="glass-card overflow-hidden border border-border/60">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs md:text-sm border-collapse">
            <thead>
              <tr className="border-b border-border/60 bg-secondary/30 dark:bg-white/[0.02] text-muted-foreground font-semibold text-[11px] uppercase tracking-wider">
                <th className="py-3.5 px-4 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={filteredTransactions.length > 0 && selectedTxIds.size === filteredTransactions.length}
                    onChange={handleSelectAll}
                    className="rounded border-border cursor-pointer"
                  />
                </th>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Description</th>
                <th className="py-3.5 px-4">Type de Flux</th>
                <th className="py-3.5 px-4">Catégorie</th>
                <th className="py-3.5 px-4 text-right">Montant</th>
                <th className="py-3.5 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileSpreadsheet className="w-8 h-8 opacity-40 text-muted-foreground" />
                      <p className="text-sm font-medium">Aucune transaction trouvée pour ces critères.</p>
                      <p className="text-xs text-muted-foreground">Importez un relevé ou ajoutez une opération manuelle pour commencer.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map(tx => {
                  const isSelected = selectedTxIds.has(tx.id);
                  const isPositive = tx.amount > 0;

                  return (
                    <tr
                      key={tx.id}
                      className={`transition-colors hover:bg-secondary/40 dark:hover:bg-white/[0.03] ${
                        isSelected ? 'bg-primary/5' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(tx.id)}
                          className="rounded border-border cursor-pointer"
                        />
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-muted-foreground font-mono text-xs">
                        {tx.date}
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-foreground max-w-[280px] truncate" title={tx.description}>
                        {tx.description}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getFlowBadge(tx.flowType)}
                      </td>

                      <td className="py-3.5 px-4">
                        <select
                          value={tx.category}
                          onChange={e => handleCategoryChange(tx.id, e.target.value)}
                          className="bg-transparent text-xs font-semibold text-foreground border border-border/60 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer dark:bg-[#10141e]"
                        >
                          {CATEGORIES.map(cat => (
                            <option key={cat} value={cat} className="dark:bg-[#10141e] text-foreground">
                              {cat}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap font-bold font-mono">
                        <span className={
                          tx.flowType === 'SAVINGS_TRANSFER' ? 'text-purple-500' :
                          isPositive ? 'text-emerald-500' :
                          'text-foreground'
                        }>
                          {isPositive ? '+' : ''}{tx.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleDelete(tx.id)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                          title="Supprimer la transaction"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal: Add Manual Transaction */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <Card className="w-full max-w-md p-6 bg-card border border-border/80 shadow-2xl rounded-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-border/60">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" /> Nouvelle Opération
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="p-1 rounded-lg text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateManualTx} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={manualTx.date}
                  onChange={e => setManualTx({ ...manualTx, date: e.target.value })}
                  className="w-full p-2.5 text-xs rounded-xl bg-background border border-border/80 focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Libellé / Description</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Salaire, Loyer, Carrefour..."
                  value={manualTx.description}
                  onChange={e => setManualTx({ ...manualTx, description: e.target.value })}
                  className="w-full p-2.5 text-xs rounded-xl bg-background border border-border/80 focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Montant (€)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="Ex: 45.50"
                  value={manualTx.amount}
                  onChange={e => setManualTx({ ...manualTx, amount: e.target.value })}
                  className="w-full p-2.5 text-xs rounded-xl bg-background border border-border/80 focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Type de Flux</label>
                <select
                  value={manualTx.flowType}
                  onChange={e => setManualTx({ ...manualTx, flowType: e.target.value as FlowType })}
                  className="w-full p-2.5 text-xs rounded-xl bg-background border border-border/80 focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground"
                >
                  <option value="VARIABLE_EXPENSE">Dépense Courante (Variable)</option>
                  <option value="FIXED_EXPENSE">Charge Fixe (Loyer, Abonnements)</option>
                  <option value="INCOME">Revenu (Salaire, Entrée d'argent)</option>
                  <option value="SAVINGS_TRANSFER">Épargne & Virement Neutre</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Catégorie</label>
                <select
                  value={manualTx.category}
                  onChange={e => setManualTx({ ...manualTx, category: e.target.value })}
                  className="w-full p-2.5 text-xs rounded-xl bg-background border border-border/80 focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-border/60">
                <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" className="bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                  Enregistrer
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal: Bulk Category Update */}
      {isBulkCategoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <Card className="w-full max-w-sm p-6 bg-card border border-border/80 shadow-2xl rounded-2xl">
            <h3 className="text-base font-bold text-foreground mb-2">Reclasser les opérations sélectionnées</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Attribuer une nouvelle catégorie à {selectedTxIds.size} transactions.
            </p>

            <select
              value={bulkTargetCategory}
              onChange={e => setBulkTargetCategory(e.target.value)}
              className="w-full p-2.5 text-xs rounded-xl bg-background border border-border/80 focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground mb-6"
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setIsBulkCategoryModalOpen(false)}>
                Annuler
              </Button>
              <Button size="sm" onClick={handleBulkCategoryApply}>
                Appliquer
              </Button>
            </div>
          </Card>
        </div>
      )}

    </div>
  );
};

export default BankStatements;
