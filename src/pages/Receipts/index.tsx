import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { 
  Camera, 
  Search, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  UploadCloud, 
  Sparkles, 
  TrendingDown, 
  Store
} from 'lucide-react';
import { storage, functions, db } from '../../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { collection, writeBatch, doc } from 'firebase/firestore';
import { cn } from '../../lib/utils';
import { getActiveAccountId } from '../../lib/userUtils';
import { formatDateFR } from '../../lib/bankUtils';


export default function Receipts() {
  const [isDragging, setIsDragging] = useState(false);
  const [analyzingFile, setAnalyzingFile] = useState(false);
  const [extractedData, setExtractedData] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      analyzeFile(e.dataTransfer.files[0]);
    }
  };

  const analyzeFile = async (file: File) => {
    try {
      setAnalyzingFile(true);
      const accountId = getActiveAccountId();
      const storageRef = ref(storage, `users/${accountId}/uploads/receipts/${Date.now()}_${file.name}`);
      
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      const analyzeDocument = httpsCallable(functions, 'analyzeDocument');
      const response = await analyzeDocument({ fileUrl: url, fileType: 'receipt', mimeType: file.type });
      
      const result = response.data as any;
      if (result.success && result.data) {
        setExtractedData(result.data);
      } else {
        alert("Erreur lors de l'analyse.");
      }
    } catch (error: any) {
      console.error(error);
      alert("Erreur serveur ou timeout lors de l'analyse du ticket.");
    } finally {
      setAnalyzingFile(false);
    }
  };

  const updateProductCategory = (index: number, category: string) => {
    const newProducts = [...extractedData.products];
    newProducts[index].category = category;
    setExtractedData({ ...extractedData, products: newProducts });
  };

  const saveToFirestore = async () => {
    if (!extractedData) return;
    setSaving(true);
    
    try {
      const accountId = getActiveAccountId();
      const batch = writeBatch(db);
      const receiptsRef = collection(db, `users/${accountId}/receipts`);
      
      const newDocRef = doc(receiptsRef);

      batch.set(newDocRef, {
        id: newDocRef.id,
        storeName: extractedData.storeName || "Inconnu",
        date: extractedData.date || new Date().toISOString().slice(0, 10),
        total: Number(extractedData.total) || 0,
        products: extractedData.products || [],
        createdAt: new Date().toISOString()
      });
      
      await batch.commit();
      alert("Ticket sauvegardé avec succès dans votre espace !");
      setExtractedData(null);
    } catch (error) {
      console.error(error);
      alert("Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-28 md:pb-12">
      <div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Module Alimentation & Courses</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mt-1 text-foreground">
          Tickets de Caisse & Comparateur
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Scannez vos tickets de supermarché pour extraire vos articles et comparer les prix multi-enseignes.
        </p>
      </div>

      {!extractedData ? (
        <div className="grid md:grid-cols-2 gap-6">
          
          {/* UPLOAD SCANNER CARD */}
          <Card className="glass-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <Camera className="text-primary" size={20} />
                  Scanner ou Déposer un Ticket
                </CardTitle>
                <span className="badge-cyan text-[10px] font-bold px-2 py-0.5 rounded-full">
                  OCR Gemini Vision
                </span>
              </div>
              <CardDescription>
                Formats supportés : JPEG, PNG, PDF de facture ou photo de ticket
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div 
                className={cn(
                  "flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-300 relative overflow-hidden group",
                  isDragging 
                    ? "border-primary bg-primary/10 shadow-glow-cyan" 
                    : "border-border/80 dark:border-white/[0.1] hover:border-primary/50 hover:bg-secondary/40 dark:hover:bg-white/[0.02]"
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById('receipt-upload')?.click()}
              >
                <input 
                  type="file" 
                  id="receipt-upload" 
                  className="hidden" 
                  accept="image/*, application/pdf" 
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      analyzeFile(e.target.files[0]);
                    }
                  }}
                />
                
                {analyzingFile ? (
                  <div className="flex flex-col items-center text-primary py-6">
                    <div className="relative mb-4">
                      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <Loader2 size={32} className="animate-spin text-primary" />
                      </div>
                    </div>
                    <p className="font-bold text-sm text-foreground">Extraction IA en cours...</p>
                    <p className="text-xs text-muted-foreground mt-1.5 text-center max-w-xs leading-relaxed">
                      Gemini identifie l'enseigne, les produits, les quantités et normalise les prix au kilo.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center py-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/15 to-cyan-500/15 text-primary flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-300 shadow-sm">
                      <UploadCloud size={30} className="stroke-[2.2]" />
                    </div>
                    <p className="text-sm font-bold text-foreground">
                      Prendre une photo ou glisser un ticket
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                      Glissez votre reçu ici ou cliquez pour parcourir vos fichiers
                    </p>
                    <span className="mt-4 px-3 py-1 rounded-full text-[11px] font-semibold bg-secondary/80 dark:bg-white/[0.05] border border-border/60 text-muted-foreground">
                      Analyse instantanée
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* PRICE COMPARATOR PREVIEW */}
          <Card className="glass-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <Search className="text-cyan-500" size={18} />
                  Comparateur Multi-Enseignes
                </CardTitle>
                <span className="badge-jade text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <TrendingDown size={12} /> Économies
                </span>
              </div>
              <CardDescription>
                Exemple d'arbitrage automatisé sur vos articles du quotidien
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              
              <div className="overflow-hidden rounded-2xl border border-border/70 dark:border-white/[0.06]">
                <table className="w-full text-xs text-left">
                  <thead className="text-[11px] font-semibold text-muted-foreground uppercase bg-secondary/60 dark:bg-white/[0.03] border-b border-border/60">
                    <tr>
                      <th className="px-3.5 py-3">Produit de base</th>
                      <th className="px-3.5 py-3">Prix Enseigne A</th>
                      <th className="px-3.5 py-3">Meilleur Prix</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50 dark:divide-white/[0.04]">
                    <tr className="hover:bg-secondary/30 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-3.5 py-3 font-semibold text-foreground">Lait Demi-Écrémé (1L)</td>
                      <td className="px-3.5 py-3 text-muted-foreground">1,15 € (Monoprix)</td>
                      <td className="px-3.5 py-3 font-bold text-emerald-600 dark:text-emerald-400">0,95 € (Lidl)</td>
                    </tr>
                    <tr className="hover:bg-secondary/30 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-3.5 py-3 font-semibold text-foreground">Pâtes Coquillettes (500g)</td>
                      <td className="px-3.5 py-3 text-muted-foreground">1,49 € (Carrefour)</td>
                      <td className="px-3.5 py-3 font-bold text-emerald-600 dark:text-emerald-400">0,89 € (Leclerc)</td>
                    </tr>
                    <tr className="hover:bg-secondary/30 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-3.5 py-3 font-semibold text-foreground">Café Moulu Arabica (250g)</td>
                      <td className="px-3.5 py-3 text-muted-foreground">3,60 € (Auchan)</td>
                      <td className="px-3.5 py-3 font-bold text-emerald-600 dark:text-emerald-400">2,45 € (Lidl)</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 flex items-start gap-2.5">
                <Sparkles size={16} className="text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Dès que vous scannez vos premiers tickets réels, l'IA compare automatiquement le prix au kilo de chaque produit entre vos supermarchés habituels !
                </p>
              </div>
            </CardContent>
          </Card>

        </div>
      ) : (
        /* VALIDATION VIEW */
        <Card className="glass-card animate-in zoom-in-95 duration-300 border-primary/40">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/70 dark:border-white/[0.06]">
            <div>
              <span className="badge-jade text-xs font-bold px-2.5 py-0.5 rounded-full inline-block mb-1">
                Extraction Validée
              </span>
              <CardTitle className="text-lg font-bold">Détail du Ticket Numérisé</CardTitle>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
                <span className="flex items-center gap-1 font-semibold text-foreground">
                  <Store size={14} className="text-primary" /> {extractedData.storeName || "Supermarché"}
                </span>
                <span>•</span>
                <span>Date : {formatDateFR(extractedData.date)}</span>
                <span>•</span>
                <span className="font-bold text-foreground">Total : {extractedData.total} €</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setExtractedData(null)}>
                Annuler
              </Button>
              <Button size="sm" onClick={saveToFirestore} disabled={saving} className="shadow-sm">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Valider et Sauvegarder
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="rounded-2xl border border-border/70 dark:border-white/[0.06] overflow-hidden">
              <div className="grid grid-cols-12 bg-secondary/50 dark:bg-white/[0.03] p-3 text-xs font-bold text-muted-foreground uppercase border-b border-border/60">
                <div className="col-span-5">Article Standardisé</div>
                <div className="col-span-2 text-center">Quantité</div>
                <div className="col-span-3">Catégorie</div>
                <div className="col-span-2 text-right">Prix Payé</div>
              </div>
              <div className="divide-y divide-border/50 dark:divide-white/[0.04] max-h-[420px] overflow-auto">
                {extractedData.products.map((prod: any, i: number) => (
                  <div key={i} className="grid grid-cols-12 p-3 text-xs items-center hover:bg-secondary/30 dark:hover:bg-white/[0.02] transition-colors">
                    <div className="col-span-5 font-semibold text-foreground pr-2 truncate">
                      {prod.standardName || prod.rawName}
                      {prod.brand && <span className="text-muted-foreground text-[11px] font-normal ml-1.5">({prod.brand})</span>}
                    </div>
                    <div className="col-span-2 text-center text-muted-foreground font-mono">
                      {prod.quantity || 1} {prod.unit || 'pce'}
                    </div>
                    <div className="col-span-3">
                      <select 
                        className="w-full bg-card border border-border/80 rounded-lg px-2 py-1 text-xs outline-none cursor-pointer"
                        value={prod.category || 'Alimentation'}
                        onChange={(e) => updateProductCategory(i, e.target.value)}
                      >
                        <option value="Produits frais">Produits frais</option>
                        <option value="Boissons">Boissons</option>
                        <option value="Hygiène">Hygiène</option>
                        <option value="Entretien">Entretien</option>
                        <option value="Alimentation">Alimentation générale</option>
                        <option value="Autres">Autres</option>
                      </select>
                    </div>
                    <div className="col-span-2 text-right font-extrabold text-foreground">
                      {(Number(prod.paidPrice) || 0).toFixed(2)} €
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex items-center gap-2.5 text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl">
              <AlertCircle size={16} className="shrink-0" />
              <span>Vérifiez la normalisation des articles. Ces données alimentent votre comparateur multi-enseignes personnel.</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
