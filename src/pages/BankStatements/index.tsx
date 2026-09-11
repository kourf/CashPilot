import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { UploadCloud, AlertCircle, CheckCircle2, FileText, ClipboardPaste, Search, Loader2, Trash2, Filter, Plus, Info } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { collection, writeBatch, doc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, functions } from '../../lib/firebase';
import { Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Sankey, Legend } from 'recharts';
import Papa from 'papaparse';
import { cn } from '../../lib/utils';
import { calculateKpis, filterByMonth, getAvailableMonths, formatMonthLabel, buildSankeyData, buildCategoryBreakdown, type Transaction } from '../../lib/kpiUtils';


type ViewState = 'dashboard' | 'upload' | 'mapping' | 'validation';

// --- UTILS ---
const parseAmount = (val: any): number | null => {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  let str = String(val).trim();
  if (str === '') return null;

  let isNegative = false;
  if (str.endsWith('-')) { isNegative = true; str = str.slice(0, -1).trim(); }
  else if (str.startsWith('-')) { isNegative = true; str = str.substring(1).trim(); }
  if (str.startsWith('+')) { str = str.substring(1).trim(); }

  str = str.replace(/[€$a-zA-Z\s]/g, '');

  const commaCount = (str.match(/,/g) || []).length;
  const dotCount = (str.match(/\./g) || []).length;

  if (commaCount > 0 && dotCount > 0) {
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    if (lastComma > lastDot) { str = str.replace(/\./g, '').replace(',', '.'); }
    else { str = str.replace(/,/g, ''); }
  } else if (commaCount === 1 && dotCount === 0) {
    str = str.replace(',', '.');
  } else if (commaCount > 1 && dotCount === 0) {
    str = str.replace(/,/g, '');
  } else if (dotCount > 1 && commaCount === 0) {
    str = str.replace(/\./g, '');
  }

  const parsed = parseFloat(str);
  if (isNaN(parsed)) return null;
  return isNegative ? -parsed : parsed;
};

const getMonthKey = (dateStr: string) => {
  if (!dateStr) return new Date().toISOString().substring(0, 7);
  const parts = dateStr.split(/[/-]/);
  if (parts.length >= 3) {
    if (parts[2].length === 4) { // DD/MM/YYYY
      return `${parts[2]}-${parts[1].padStart(2, '0')}`;
    } else if (parts[0].length === 4) { // YYYY-MM-DD
      return `${parts[0]}-${parts[1].padStart(2, '0')}`;
    }
  }
  return new Date().toISOString().substring(0, 7);
};

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("BankStatements ErrorBoundary:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 flex flex-col items-center justify-center text-center animate-in fade-in">
          <AlertCircle className="w-16 h-16 text-destructive mb-4" />
          <h2 className="text-2xl font-bold mb-2">Erreur d'affichage</h2>
          <p className="text-muted-foreground mb-6">Une donnée corrompue (ex: montant invalide) a causé un crash de l'interface.</p>
          <div className="flex gap-4">
            <Button onClick={() => window.location.reload()}>Recharger la page</Button>
            <Button variant="outline" onClick={() => window.location.href = '/'}>Retour Accueil</Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function BankStatementsContent() {
  const [view, setView] = useState<ViewState>('dashboard');
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  
  // Upload States
  const [isDragging, setIsDragging] = useState(false);
  const [analyzingFile, setAnalyzingFile] = useState<string | null>(null);
  
  // CSV States
  const [csvRawData, setCsvRawData] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvMapping, setCsvMapping] = useState({ date: '', description: '', amount: '' });
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteData, setPasteData] = useState('');
  
  // Validation States
  const [extractedData, setExtractedData] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [diagnosticReport, setDiagnosticReport] = useState<any | null>(null);
  
  // Filters for Dashboard Table
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [selectedMonth, setSelectedMonth] = useState('all');

  useEffect(() => {
    const deviceId = localStorage.getItem('deviceId') || 'default-user';
    const q = query(
      collection(db, `users/${deviceId}/transactions`),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(txs as Transaction[]);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const availableMonths = useMemo(() => getAvailableMonths(transactions), [transactions]);
  
  useEffect(() => {
    if (availableMonths.length > 0 && selectedMonth === 'all') {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  // Draft persistence
  useEffect(() => {
    const saved = localStorage.getItem('draftBankStatement');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.extractedData) {
          setExtractedData(parsed.extractedData);
          setView(parsed.view || 'validation');
        }
      } catch(e) { console.error(e); }
    }
  }, []);

  useEffect(() => {
    if ((view === 'validation' || view === 'mapping') && extractedData) {
      localStorage.setItem('draftBankStatement', JSON.stringify({ view, extractedData }));
    } else if (view === 'dashboard') {
      localStorage.removeItem('draftBankStatement');
    }
  }, [view, extractedData]);

  const filteredTransactions = useMemo(() => filterByMonth(transactions, selectedMonth), [transactions, selectedMonth]);

  const kpis = useMemo(() => {
    const calculated = calculateKpis(filteredTransactions);
    return {
      ...calculated,
      nbTx: calculated.txCount,
      topCat: calculated.topCategory,
      biggestExp: { val: calculated.topDepense, name: 'Plus grosse dǸpense' },
      reste: calculated.resteAVivre
    };
  }, [filteredTransactions]);

  const pieData = useMemo(() => buildCategoryBreakdown(filteredTransactions).slice(0, 5), [filteredTransactions]);
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];
  const sankeyData = useMemo(() => buildSankeyData(kpis as any, pieData), [kpis, pieData]);

  // --- FILE HANDLING ---
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files?.length) processFile(e.dataTransfer.files[0]);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) processFile(e.target.files[0]);
  };

  const guessMapping = (headers: string[]) => {
    const guess = {
      date: headers.find(h => h.toLowerCase().includes('date')) || '',
      description: headers.find(h => h.toLowerCase().includes('libell') || h.toLowerCase().includes('desc')) || '',
      amount: headers.find(h => h.toLowerCase().includes('montant') || h.toLowerCase().includes('valeur') || h.toLowerCase().includes('amount') || h.toLowerCase() === 'montant(s)') || ''
    };
    setCsvMapping(guess);
  };

  const handlePasteSubmit = () => {
    if (!pasteData) return;
    const rows = pasteData.trim().split('\n').map(r => r.split('\t'));
    if (rows.length < 2) {
      alert("Format invalide. Assurez-vous de coller plusieurs lignes (y compris les en-tǦtes) sǸparǸes par des tabulations.");
      return;
    }
    const headers = rows[0].map(h => h.trim());
    const data = rows.slice(1).map(row => {
      const obj: any = {};
      headers.forEach((h, i) => obj[h] = row[i]?.trim() || '');
      return obj;
    });
    setCsvHeaders(headers);
    setCsvRawData(data);
    guessMapping(headers);
    setView('mapping');
  };

  const processFile = async (file: File) => {
    if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        complete: (results) => {
          if (results.data && results.data.length > 0) {
            const headers = Object.keys(results.data[0]);
            setCsvHeaders(headers);
            setCsvRawData(results.data);
            guessMapping(headers);
            setView('mapping');
          }
        }
      });
    } else {
      await analyzePDF(file);
    }
  };

  const analyzePDF = async (file: File) => {
    try {
      setAnalyzingFile("Analyse du PDF en cours...");
      const deviceId = localStorage.getItem('deviceId') || 'default-user';
      const storageRef = ref(storage, `users/${deviceId}/uploads/statements/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      const analyzeDocument = httpsCallable(functions, 'analyzeDocument');
      const response = await analyzeDocument({ fileUrl: url, fileType: 'statement', mimeType: file.type });
      
      const result = response.data as any;
      if (result.success && result.data?.transactions) {
        setExtractedData(result.data);
        setView('validation');
      } else {
        alert("Erreur lors de l'analyse: " + (result.error || "Format non reconnu"));
      }
    } catch (error: any) {
      console.error(error);
      alert("Erreur serveur lors de l'analyse du PDF. (Timeout ou erreur rǸseau)");
    } finally {
      setAnalyzingFile(null);
    }
  };

  const processCSVMapping = async () => {
    if (!csvMapping.date || !csvMapping.description || !csvMapping.amount) {
      alert("Veuillez mapper au moins la date, le libellé et la colonne de montant.");
      return;
    }
    
    setAnalyzingFile("CatǸgorisation intelligente en cours...");
    
    try {
      // Format mapped data
      const mappedData = csvRawData.map((row, index) => {
        let amt: number | null = null;
        let rawAmt = '';
        
        if (csvMapping.amount) {
           rawAmt = String(row[csvMapping.amount] || '');
           amt = parseAmount(rawAmt);
        }

        return {
          originalLine: index + 2,
          date: row[csvMapping.date] || '',
          description: row[csvMapping.description] || '',
          amount: amt,
          _rawAmount: rawAmt
        };
      });

      // Valid items to send to AI (we don't want to break the AI with null amounts)
      const validForAi = mappedData.filter(t => t.description && t.amount !== null && t.amount !== 0);
      
      let finalTransactions = mappedData.map(t => ({
        ...t,
        category: 'Autres',
        nature: 'variable',
        aiStatus: 'pending',
        categorizationMode: 'manual'
      }));

      // Call AI
      const categorizeTransactions = httpsCallable(functions, 'categorizeTransactions');
      try {
        const response = await categorizeTransactions({ transactions: validForAi });
        const result = response.data as any;
        
        if (result.success && result.data?.transactions) {
          // Merge AI results back into finalTransactions
          finalTransactions = finalTransactions.map(t => {
            const aiTx = result.data.transactions.find((tx: any) => tx.description === t.description && tx.amount === t.amount);
            if (aiTx) {
              return { ...t, ...aiTx, aiStatus: 'completed', categorizationMode: 'ai' };
            }
            return t;
          });
        }
      } catch (e) {
        console.error("AI Error:", e);
        // We gracefully fallback to the manual list if AI fails.
      }
      
      setExtractedData({ transactions: finalTransactions, bankName: 'Import CSV' });
      setView('validation');
    } catch (error) {
      console.error(error);
      alert("Erreur fatale lors du mapping.");
    } finally {
      setAnalyzingFile(null);
    }
  };

  const validateAndSave = async () => {
    if (!extractedData || !extractedData.transactions || extractedData.transactions.length === 0) {
      alert("Aucune transaction  sauvegarder.");
      return;
    }
    
    setSaving(true);
    setAnalyzingFile("Validation locale en cours...");

    // 1. Validation Locale et Normalisation
    const normalizedTransactions: any[] = [];
    for (let i = 0; i < extractedData.transactions.length; i++) {
      const tx = extractedData.transactions[i];
      if (!tx) continue;

      const normTx: any = {
        date: tx.date || "",
        amount: Number(tx.amount),
        _rawAmount: tx._rawAmount || String(tx.amount || ""),
        description: tx.description || tx.rawLabel || tx.cleanLabel || "",
        category: tx.category || "Autres",
        subcategory: tx.subcategory || tx.subCategory || "",
        nature: tx.nature || tx.expenseType || tx.type || "variable",
        isSubscription: Boolean(tx.isSubscription),
        isBankFee: Boolean(tx.isBankFee),
        accountName: tx.accountName || "Compte Principal",
        sourceDocumentId: tx.sourceDocumentId || ""
      };

      if (isNaN(normTx.amount) || !isFinite(normTx.amount)) {
         normTx.amount = null;
      }
      normalizedTransactions.push(normTx);
    }

    setAnalyzingFile("VǸrification des doublons...");

    // 2. Duplicate Check Local
    let duplicatesCount = 0;
    const finalTransactionsToSave: any[] = [];
    
    normalizedTransactions.forEach((tx: any) => {
      // Find if an existing transaction has the exact same date, amount, and similar description
      const isDuplicate = transactions.some((existingTx: any) => {
        return existingTx.date === tx.date && 
               Number(existingTx.amount) === Number(tx.amount) &&
               (existingTx.rawLabel === tx.description || existingTx.cleanLabel === tx.description);
      });
      
      if (isDuplicate) {
        duplicatesCount++;
      } else {
        finalTransactionsToSave.push(tx);
      }
    });

    if (finalTransactionsToSave.length === 0) {
      alert(`Les ${duplicatesCount} transactions importǸes existent dǸj. Aucune nouvelle donnǸe ajoutǸe.`);
      setSaving(false);
      setAnalyzingFile(null);
      setExtractedData(null);
      setView('dashboard');
      return;
    }

    setAnalyzingFile("Sauvegarde Firestore en cours...");

    try {
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => resolve("OFFLINE_QUEUED"), 8000);
      });

      const deviceId = localStorage.getItem('deviceId') || 'default-user';
      const batch = writeBatch(db);
      const txRef = collection(db, `users/${deviceId}/transactions`);

      finalTransactionsToSave.forEach((tx: any) => {
        const newDocRef = doc(txRef);
        const monthKey = getMonthKey(tx.date);
        
        batch.set(newDocRef, {
          id: newDocRef.id,
          date: tx.date,
          monthKey,
          rawLabel: tx.description,
          cleanLabel: tx.description,
          amount: Number(tx.amount),
          direction: Number(tx.amount) > 0 ? 'credit' : 'debit',
          category: tx.category,
          subcategory: tx.subcategory,
          nature: tx.nature || 'autre',
          bankName: extractedData.bankName || 'Inconnu',
          accountName: tx.accountName,
          sourceDocumentId: tx.sourceDocumentId,
          aiStatus: 'completed',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      });

      const raceResult = await Promise.race([batch.commit(), timeoutPromise]);
      
      if (raceResult === "OFFLINE_QUEUED") {
        alert(`OpǸration en attente (hors ligne). ${finalTransactionsToSave.length} ajoutǸes, ${duplicatesCount} doublons ignorǸs.`);
      } else {
        if (duplicatesCount > 0) {
          alert(`Sauvegarde rǸussie : ${finalTransactionsToSave.length} ajoutǸes, ${duplicatesCount} doublons ignorǸs.`);
        } else {
          alert(`Sauvegarde rǸussie : ${finalTransactionsToSave.length} transactions ajoutǸes.`);
        }
      }
      setExtractedData(null);
      setDiagnosticReport(null);
      setView('dashboard');
    } catch (error: any) {
      console.error("Save Error:", error);
      alert("�%chec de la sauvegarde : " + (error.message || "Erreur interne"));
    } finally {
      setSaving(false);
      setAnalyzingFile(null);
    }
  };

  const filteredDashboardTx = useMemo(() => {
    return filteredTransactions.filter(t => {
      const matchSearch = (t.description || t.rawLabel || t.cleanLabel || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = categoryFilter === 'All' || t.category === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [filteredTransactions, searchTerm, categoryFilter]);

  const categories = ['All', ...Array.from(new Set(filteredTransactions.map(t => t.category || 'Autres')))];

  return (
    <div className="p-6 md:p-10 space-y-8 animate-in fade-in pb-20">
      
      {/* HEADER */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Relevés Bancaires</h1>
          <p className="text-muted-foreground mt-1">Gérez, analysez et importez vos relevés financiers.</p>
        </div>
        <div className="flex gap-2">
          {view === 'dashboard' && availableMonths.length > 0 && (
            <div className="flex items-center gap-2 bg-background border rounded-md px-3 py-1.5 shadow-sm mr-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <select 
                className="bg-transparent text-sm font-medium outline-none text-foreground cursor-pointer"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              >
                <option value="all">Tous les mois</option>
                {availableMonths.map(m => (
                  <option key={m} value={m}>{formatMonthLabel(m)}</option>
                ))}
              </select>
            </div>
          )}
          {view === 'dashboard' && (
            <Button onClick={() => setView('upload')}>
              <Plus className="w-4 h-4 mr-2" /> Nouveau relevé
            </Button>
          )}
          {view !== 'dashboard' && transactions.length > 0 && (
            <Button variant="outline" onClick={() => setView('dashboard')}>
              Retour au Dashboard
            </Button>
          )}
        </div>
      </div>

      {analyzingFile && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-card p-6 rounded-xl border shadow-lg flex flex-col items-center">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
            <h3 className="text-lg font-bold">{analyzingFile}</h3>
            <p className="text-sm text-muted-foreground mt-2">Veuillez patienter...</p>
          </div>
        </div>
      )}

      {/* --- DASHBOARD VIEW --- */}
      {view === 'dashboard' && (
        <div className="space-y-6">
          
          {/* LUXURY DROPZONE */}
          <Card className={cn("glass-card border-primary/30", transactions.length === 0 ? "bg-primary/[0.03]" : "")}>
            <CardContent className={transactions.length === 0 ? "p-8" : "p-3 md:p-4"}>
              <div 
                className={cn(
                  "border-2 border-dashed rounded-2xl flex items-center transition-all duration-300 cursor-pointer group relative overflow-hidden", 
                  isDragging 
                    ? 'border-primary bg-primary/10 shadow-glow-cyan' 
                    : 'border-border/80 dark:border-white/[0.1] hover:border-primary/50 hover:bg-secondary/40 dark:hover:bg-white/[0.02]',
                  transactions.length === 0 
                    ? "p-8 flex-col justify-center text-center" 
                    : "p-3 md:p-4 flex-row gap-3.5 justify-start"
                )}
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById('file-upload-dash')?.click()}
              >
                <input type="file" id="file-upload-dash" className="hidden" accept=".pdf,.csv" onChange={handleFileInput} />
                <div className={cn(
                  "rounded-2xl bg-gradient-to-br from-primary/15 to-cyan-500/15 text-primary flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 shadow-sm", 
                  transactions.length === 0 ? "w-16 h-16 mb-3" : "w-10 h-10"
                )}>
                  <UploadCloud size={transactions.length === 0 ? 28 : 20} className="stroke-[2.2]" />
                </div>
                <div>
                  <h3 className={cn("font-bold text-foreground", transactions.length === 0 ? "text-base mb-1" : "text-xs md:text-sm")}>
                    Glissez-déposez un relevé PDF ou CSV pour commencer
                  </h3>
                  {transactions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Les KPIs et graphiques ci-dessous s'animeront automatiquement avec vos données réelles.
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground hidden sm:block">
                      Cliquez pour ajouter un nouveau relevé et enrichir votre historique multi-mois.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KPIs Grid */}
          <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
            <Card className="glass-card border-primary/30">
              <CardContent className="pt-4 p-4">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Revenus du mois</span>
                <p className="text-xl md:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  {loading ? <div className="h-7 w-24 bg-muted animate-pulse rounded mt-1"></div> : `+${kpis.revenus.toFixed(2)} €`}
                </p>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardContent className="pt-4 p-4">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Dépenses réelles</span>
                <p className="text-xl md:text-2xl font-black text-foreground mt-1">
                  {loading ? <div className="h-7 w-24 bg-muted animate-pulse rounded mt-1"></div> : `-${kpis.depenses.toFixed(2)} €`}
                </p>
              </CardContent>
            </Card>

            <Card className="glass-card border-primary/40 bg-gradient-to-br from-card to-primary/[0.04]">
              <CardContent className="pt-4 p-4">
                <span className="text-xs font-semibold text-primary uppercase tracking-wider block">Reste à vivre</span>
                <p className="text-xl md:text-2xl font-black text-foreground mt-1">
                  {loading ? <div className="h-7 w-24 bg-muted animate-pulse rounded mt-1"></div> : `${kpis.reste.toFixed(2)} €`}
                </p>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardContent className="pt-4 p-4">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Rythme journalier</span>
                <p className="text-xl md:text-2xl font-black text-foreground mt-1">
                  {loading ? <div className="h-7 w-24 bg-muted animate-pulse rounded mt-1"></div> : `${(kpis.reste > 0 ? kpis.reste / 30 : 0).toFixed(2)} €`}
                </p>
              </CardContent>
            </Card>

            <Card className="glass-card col-span-2 sm:col-span-1">
              <CardContent className="pt-4 p-4">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Top Catégorie</span>
                <p className="text-lg md:text-xl font-bold text-foreground mt-1 truncate">
                  {loading ? <div className="h-7 w-20 bg-muted animate-pulse rounded mt-1"></div> : (kpis.topCat || 'Général')}
                </p>
              </CardContent>
            </Card>
          </div>
          
          {/* Sub KPIs */}
          <div className="grid gap-3 grid-cols-3 md:grid-cols-6 text-xs font-medium">
            <div className="glass-card rounded-xl p-3 text-center">
              <span className="block text-muted-foreground text-[11px] mb-0.5">Fixes</span>
              {loading ? <div className="h-4 w-12 mx-auto bg-muted animate-pulse rounded"></div> : <span className="font-bold text-sm">{kpis.fixe.toFixed(0)} €</span>}
            </div>
            <div className="glass-card rounded-xl p-3 text-center">
              <span className="block text-muted-foreground text-[11px] mb-0.5">Variables</span>
              {loading ? <div className="h-4 w-12 mx-auto bg-muted animate-pulse rounded"></div> : <span className="font-bold text-sm">{kpis.variable.toFixed(0)} €</span>}
            </div>
            <div className="glass-card rounded-xl p-3 text-center">
              <span className="block text-muted-foreground text-[11px] mb-0.5">Imprévus</span>
              {loading ? <div className="h-4 w-12 mx-auto bg-muted animate-pulse rounded"></div> : <span className="font-bold text-sm">{kpis.exceptionnelle.toFixed(0)} €</span>}
            </div>
            <div className="glass-card rounded-xl p-3 text-center">
              <span className="block text-muted-foreground text-[11px] mb-0.5">Épargne</span>
              {loading ? <div className="h-4 w-12 mx-auto bg-muted animate-pulse rounded"></div> : <span className="font-bold text-sm text-primary">{kpis.epargne.toFixed(0)} €</span>}
            </div>
            <div className="glass-card rounded-xl p-3 text-center">
              <span className="block text-muted-foreground text-[11px] mb-0.5">Abonnements</span>
              {loading ? <div className="h-4 w-8 mx-auto bg-muted animate-pulse rounded"></div> : <span className="font-bold text-sm">{kpis.abonnements}</span>}
            </div>
            <div className="glass-card rounded-xl p-3 text-center">
              <span className="block text-muted-foreground text-[11px] mb-0.5">Frais Bancaires</span>
              {loading ? <div className="h-4 w-12 mx-auto bg-muted animate-pulse rounded"></div> : <span className="font-bold text-sm text-rose-500">{kpis.frais.toFixed(2)} €</span>}
            </div>
          </div>

          {/* Charts */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold">Flux des Finances (Sankey)</CardTitle>
              </CardHeader>
              <CardContent className="h-[280px]">
                {sankeyData?.nodes?.length > 0 && sankeyData?.links?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <Sankey data={sankeyData} nodePadding={50} margin={{ left: 20, right: 20, top: 20, bottom: 20 }}
                      link={{ stroke: 'hsl(var(--border))' }} node={{ fill: 'hsl(var(--primary))' }} />
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-xs flex-col">
                    <Info className="w-8 h-8 mb-2 opacity-25" />
                    Pas assez de données pour générer le diagramme de flux.
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold">Répartition des Dépenses</CardTitle>
              </CardHeader>
              <CardContent className="h-[280px]">
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value" nameKey="name">
                        {pieData.map((_entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          borderRadius: '0.875rem',
                          border: '1px solid hsl(var(--border))',
                          fontSize: '12px'
                        }}
                        formatter={(value: any, name: any, props: any) => [`${Number(value).toFixed(2)} € (${(props?.payload?.percentage || 0).toFixed(1)} %)`, name]} 
                      />
                      <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-xs flex-col">
                    <Info className="w-8 h-8 mb-2 opacity-25" />
                    Aucune dépense catégorisée pour ce mois.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Transactions Table (Apple Wallet / HyperOS style) */}
          <Card className="glass-card">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Grand Livre</span>
                <CardTitle className="text-base font-bold mt-0.5">Toutes les transactions</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <input 
                    type="text" 
                    placeholder="Filtrer..." 
                    className="pl-8.5 pr-3 h-9 text-xs rounded-xl border border-border/80 bg-background/80 outline-none w-36 sm:w-48 transition-all focus:w-56 focus:border-primary" 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                  />
                </div>
                <select 
                  className="h-9 text-xs rounded-xl border border-border/80 bg-background/80 px-2.5 outline-none cursor-pointer" 
                  value={categoryFilter} 
                  onChange={e => setCategoryFilter(e.target.value)}
                >
                  {categories.map(c => <option key={String(c)} value={String(c)} className="dark:bg-[#10141e]">{String(c)}</option>)}
                </select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-2xl border border-border/70 dark:border-white/[0.06] overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-secondary/50 dark:bg-white/[0.03] text-muted-foreground uppercase text-[11px] font-semibold border-b border-border/60">
                    <tr>
                      <th className="px-3.5 py-3">Date</th>
                      <th className="px-3.5 py-3">Libellé</th>
                      <th className="px-3.5 py-3">Catégorie</th>
                      <th className="px-3.5 py-3">Nature</th>
                      <th className="px-3.5 py-3 text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50 dark:divide-white/[0.04]">
                    {filteredDashboardTx.slice(0, 60).map((tx, i) => {
                      const isPositive = (tx.amount || 0) > 0;
                      return (
                        <tr key={i} className="hover:bg-secondary/30 dark:hover:bg-white/[0.02] transition-colors">
                          <td className="px-3.5 py-3 whitespace-nowrap font-mono text-muted-foreground">{tx.date}</td>
                          <td className="px-3.5 py-3 max-w-[220px] truncate font-semibold text-foreground" title={tx.cleanLabel || tx.rawLabel}>
                            {tx.cleanLabel || tx.rawLabel}
                          </td>
                          <td className="px-3.5 py-3">
                            <span className="glass-pill text-[11px]">
                              {tx.category || 'Autres'}
                            </span>
                          </td>
                          <td className="px-3.5 py-3 text-muted-foreground capitalize">{tx.nature || '-'}</td>
                          <td className={cn("px-3.5 py-3 text-right font-extrabold text-xs md:text-sm", isPositive ? "text-emerald-500" : "text-foreground")}>
                            {isPositive ? '+' : ''}{Number(tx.amount || 0).toFixed(2)} €
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* --- UPLOAD VIEW --- */}
      {view === 'upload' && (
        <Card className="glass max-w-2xl mx-auto animate-in slide-in-from-bottom-4">
          <CardHeader>
            <CardTitle>Importer des données</CardTitle>
            <p className="text-sm text-muted-foreground">Plusieurs méthodes d'import sont disponibles.</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Button 
                variant={!pasteMode ? "default" : "outline"} 
                className="h-24 flex flex-col items-center justify-center gap-2"
                onClick={() => setPasteMode(false)}
              >
                <FileText className="w-6 h-6" />
                Fichier CSV / PDF
              </Button>
              <Button 
                variant={pasteMode ? "default" : "outline"} 
                className="h-24 flex flex-col items-center justify-center gap-2"
                onClick={() => setPasteMode(true)}
              >
                <ClipboardPaste className="w-6 h-6" />
                Copier / Coller (Excel)
              </Button>
            </div>

            {!pasteMode ? (
              <div 
                className={cn("border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center transition-colors cursor-pointer", isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50')}
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                <input type="file" id="file-upload" className="hidden" accept=".pdf,.csv" onChange={handleFileInput} />
                <div className="bg-primary/10 p-4 rounded-full mb-4 text-primary"><UploadCloud size={32} /></div>
                <h3 className="font-medium text-lg mb-1">Glissez-déposez un fichier PDF ou CSV</h3>
                <p className="text-sm text-muted-foreground text-center">L'IA extraira et normalisera les données.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <textarea 
                  className="w-full h-48 p-4 border rounded-xl bg-background text-sm font-mono focus:ring-1 focus:ring-primary"
                  placeholder="Collez ici vos lignes depuis Excel, Google Sheets ou Numbers (avec les entêtes)..."
                  value={pasteData}
                  onChange={e => setPasteData(e.target.value)}
                />
                <Button className="w-full" onClick={handlePasteSubmit}>Analyser les données copiées</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* --- MAPPING VIEW (CSV Only) --- */}
      {view === 'mapping' && (
        <Card className="glass max-w-4xl mx-auto border-primary/50">
          <CardHeader>
            <CardTitle>Configuration des colonnes</CardTitle>
            <p className="text-sm text-muted-foreground">Mappez les colonnes de votre fichier pour comprendre sa structure. Vous devez utiliser une colonne Montant unique.</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3 bg-muted/30 p-4 rounded-xl border border-border/50">
              <div>
                <label className="text-sm font-medium mb-1 block">Date <span className="text-destructive">*</span></label>
                <select className="w-full border rounded-md p-2 bg-background text-sm" value={csvMapping.date} onChange={e => setCsvMapping({...csvMapping, date: e.target.value})}>
                  <option value="">Sélectionner...</option>
                  {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Libellé <span className="text-destructive">*</span></label>
                <select className="w-full border rounded-md p-2 bg-background text-sm" value={csvMapping.description} onChange={e => setCsvMapping({...csvMapping, description: e.target.value})}>
                  <option value="">Sélectionner...</option>
                  {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Montant (Signé) <span className="text-destructive">*</span></label>
                <select className="w-full border rounded-md p-2 bg-background text-sm" value={csvMapping.amount} onChange={e => setCsvMapping({...csvMapping, amount: e.target.value})}>
                  <option value="">Sélectionner...</option>
                  {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            </div>

            <div className="border rounded-md overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted text-muted-foreground text-xs uppercase">
                  <tr>{csvHeaders.map(h => <th key={h} className="px-4 py-2">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y">
                  {csvRawData.slice(0, 3).map((row, i) => (
                    <tr key={i}>{csvHeaders.map(h => <td key={h} className="px-4 py-2 truncate max-w-[150px]">{String(row[h])}</td>)}</tr>
                  ))}
                </tbody>
              </table>
              <div className="p-2 text-center text-xs text-muted-foreground bg-muted/30 border-t">Aperçu des 3 premières lignes</div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setView('upload')}>Annuler</Button>
              <Button onClick={processCSVMapping}>Envoyer à l'IA pour Catégorisation</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* --- VALIDATION VIEW --- */}
      {view === 'validation' && extractedData && (
        <Card className="glass animate-in zoom-in-95 duration-300 border-primary/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Validation de l'import</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                L'IA a traité {extractedData.transactions?.length || 0} opérations. Corrigez les erreurs en rouge si nécessaire.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setView('mapping')} disabled={saving}>Retour Mapping</Button>
              <Button onClick={validateAndSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                {saving ? "Validation..." : "Valider et Sauvegarder"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            
            {diagnosticReport && (
              <div className="mb-6 p-4 border border-destructive/50 bg-destructive/5 rounded-xl">
                <div className="flex items-center gap-2 text-destructive font-semibold mb-3">
                  <AlertCircle className="w-5 h-5" />
                  Diagnostic Serveur : {diagnosticReport.invalidRows} transaction(s) corrompue(s) sur {diagnosticReport.totalRows || 0}
                </div>
                <div className="space-y-3">
                  {diagnosticReport.details?.map((err: any, idx: number) => (
                    <div key={idx} className="text-sm bg-background/50 p-3 rounded-lg border border-border/50">
                      <div><span className="font-semibold">Ligne {err.row}</span> – Problème avec le champ <span className="font-semibold capitalize">{err.field}</span></div>
                      <div className="text-muted-foreground mt-1 text-xs">
                        Raison : {err.reason} <br/>
                        Valeur détectée : <span className="font-mono bg-muted px-1 py-0.5 rounded text-destructive">{err.valuePreview}</span> <br/>
                        {err.suggestedValue !== null && err.suggestedValue !== "" && err.suggestedValue !== undefined && (
                          <span className="text-success mt-1 block">Correction suggérée : {err.suggestedValue}</span>
                        )}
                      </div>
                      <div className="mt-2 flex gap-2">
                        {err.suggestedValue !== null && err.suggestedValue !== "" && err.suggestedValue !== undefined && (
                           <Button size="sm" variant="outline" onClick={() => {
                             const newTx = [...extractedData.transactions];
                             newTx[err.row - 1][err.field] = err.suggestedValue;
                             setExtractedData({...extractedData, transactions: newTx});
                             setDiagnosticReport(null);
                           }}>Appliquer la correction</Button>
                        )}
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => {
                           const newTx = extractedData.transactions.filter((_: any, i: number) => i !== (err.row - 1));
                           setExtractedData({...extractedData, transactions: newTx});
                           setDiagnosticReport(null);
                        }}>Supprimer la ligne</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted text-muted-foreground text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2 w-[10%]">Date</th>
                    <th className="px-3 py-2 w-[30%]">Libellé</th>
                    <th className="px-3 py-2 w-[20%]">Catégorie</th>
                    <th className="px-3 py-2 w-[15%]">Nature</th>
                    <th className="px-3 py-2 w-[15%] text-right">Montant</th>
                    <th className="px-3 py-2 w-[10%] text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y max-h-[500px] overflow-auto block table-row-group">
                  {extractedData.transactions?.map((tx: any, i: number) => {
                    const isAmountInvalid = tx.amount === null || isNaN(tx.amount);
                    const isDateInvalid = !tx.date;
                    
                    return (
                    <tr key={i} className={cn("hover:bg-muted/50", (isAmountInvalid || isDateInvalid) ? "bg-destructive/5" : "")}>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {isDateInvalid ? (
                          <input 
                            type="text" 
                            className="border border-destructive text-destructive bg-destructive/10 rounded px-2 py-1 w-full text-xs" 
                            placeholder="Invalide"
                            value={tx.date || ''}
                            onChange={e => {
                               const newTx = [...extractedData.transactions];
                               newTx[i].date = e.target.value;
                               setExtractedData({...extractedData, transactions: newTx});
                            }}
                          />
                        ) : tx.date}
                      </td>
                      <td className="px-3 py-2 truncate max-w-[200px]" title={tx.description}>{tx.description}</td>
                      <td className="px-3 py-2">
                        <select 
                          className="w-full bg-background border rounded px-2 py-1 text-xs"
                          value={tx.category || ''}
                          onChange={(e) => {
                            const newTx = [...extractedData.transactions];
                            newTx[i].category = e.target.value;
                            setExtractedData({...extractedData, transactions: newTx});
                          }}
                        >
                          <option value="Revenus">Revenus</option>
                          <option value="Logement">Logement</option>
                          <option value="Alimentation">Alimentation</option>
                          <option value="Transports">Transports</option>
                          <option value="SantǸ">SantǸ</option>
                          <option value="Loisirs">Loisirs</option>
                          <option value="Shopping">Shopping</option>
                          <option value="Abonnements">Abonnements</option>
                          <option value="Épargne">Épargne</option>
                          <option value="Frais bancaires">Frais bancaires</option>
                          <option value="Autres">Autres</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <select 
                          className="w-full bg-background border rounded px-2 py-1 text-xs"
                          value={tx.nature || ''}
                          onChange={(e) => {
                            const newTx = [...extractedData.transactions];
                            newTx[i].nature = e.target.value;
                            setExtractedData({...extractedData, transactions: newTx});
                          }}
                        >
                          <option value="fixe">Fixe</option>
                          <option value="variable">Variable</option>
                          <option value="exceptionnelle">Exceptionnelle</option>
                          <option value="">-</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        {isAmountInvalid ? (
                          <div className="flex flex-col gap-1 items-end">
                            <input 
                              type="text" 
                              className="border border-destructive text-destructive bg-destructive/10 rounded px-2 py-1 w-24 text-xs text-right" 
                              placeholder="ex: -12.50"
                              value={tx._rawAmount || ''}
                              onChange={e => {
                                 const newTx = [...extractedData.transactions];
                                 newTx[i]._rawAmount = e.target.value;
                                 newTx[i].amount = parseAmount(e.target.value);
                                 setExtractedData({...extractedData, transactions: newTx});
                              }}
                            />
                            <span className="text-[10px] text-destructive leading-tight">�? corriger</span>
                          </div>
                        ) : (
                          <div className={cn("text-right font-bold", tx.amount > 0 ? 'text-success' : '')}>
                            {tx.amount > 0 ? '+' : ''}{Number(tx.amount).toFixed(2)} �'�
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Button variant="ghost" size="icon" onClick={() => {
                          const newTx = extractedData.transactions.filter((_: any, idx: number) => idx !== i);
                          setExtractedData({...extractedData, transactions: newTx});
                        }}>
                          <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive transition-colors" />
                        </Button>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
            
            {extractedData.transactions?.some((tx: any) => tx.amount === null || isNaN(tx.amount) || !tx.date) && (
              <div className="mt-4 flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 p-3 rounded-lg">
                <AlertCircle size={16} />
                Il y a des donnǸes invalides (en rouge). Veuillez corriger les valeurs ou supprimer les lignes pour pouvoir sauvegarder.
              </div>
            )}
            
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function BankStatements() {
  return (
    <ErrorBoundary>
      <BankStatementsContent />
    </ErrorBoundary>
  );
}
