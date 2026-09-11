import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Camera, Search, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { storage, functions, db } from '../../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { collection, writeBatch, doc } from 'firebase/firestore';

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
      const deviceId = localStorage.getItem('deviceId') || 'default-user';
      const storageRef = ref(storage, `users/${deviceId}/uploads/receipts/${Date.now()}_${file.name}`);
      
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
      alert("Erreur serveur ou timeout.");
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
      const deviceId = localStorage.getItem('deviceId') || 'default-user';
      const batch = writeBatch(db);
      const receiptsRef = collection(db, `users/${deviceId}/receipts`);
      
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
      alert("Ticket sauvegardé avec succès !");
      setExtractedData(null);
    } catch (error) {
      console.error(error);
      alert("Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 md:p-10 space-y-8 animate-in fade-in pb-20">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tickets de Caisse & Comparateur</h1>
        <p className="text-muted-foreground mt-1">Importez vos tickets pour analyser vos achats et comparer les prix avec l'IA.</p>
      </div>

      {!extractedData ? (
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="glass h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="text-primary" size={20} />
                Photographier ou importer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div 
                className={`flex flex-col items-center justify-center py-10 rounded-xl border-2 border-dashed mb-4 cursor-pointer transition-colors ${
                  isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/50'
                }`}
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
                  <div className="flex flex-col items-center text-primary">
                    <Loader2 size={48} className="animate-spin mb-4" />
                    <p className="font-medium">L'IA Gemini analyse le ticket...</p>
                    <p className="text-xs text-muted-foreground mt-2 text-center max-w-xs">
                      Extraction des produits, des prix et normalisation des libellés en cours.
                    </p>
                  </div>
                ) : (
                  <>
                    <Button size="lg" className="rounded-full shadow-lg h-16 w-16 mb-4 pointer-events-none">
                      <Camera size={28} />
                    </Button>
                    <p className="text-sm font-medium">Prendre une photo ou glisser un fichier</p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="glass">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="text-primary" size={20} />
                  Comparateur de Prix (Exemple)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Une fois vos tickets importés, le comparateur identifiera les meilleurs prix.
                </p>
                <div className="overflow-x-auto opacity-50">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground uppercase bg-muted/50 rounded-t-lg">
                      <tr>
                        <th className="px-4 py-3 rounded-tl-lg">Produit</th>
                        <th className="px-4 py-3">Magasin A</th>
                        <th className="px-4 py-3">Magasin B</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-border/50 bg-card/50">
                        <td className="px-4 py-3 font-medium">Lait (1L)</td>
                        <td className="px-4 py-3">0.99 €</td>
                        <td className="px-4 py-3 font-bold text-success">0.95 €</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <Card className="glass animate-in zoom-in-95 duration-300 border-primary/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Validation du Ticket</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Magasin : <strong className="text-foreground">{extractedData.storeName}</strong> | 
                Date : <strong className="text-foreground">{extractedData.date}</strong> | 
                Total : <strong className="text-foreground">{extractedData.total} €</strong>
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setExtractedData(null)}>Annuler</Button>
              <Button onClick={saveToFirestore} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Valider et Sauvegarder
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <div className="grid grid-cols-12 bg-muted p-3 text-xs font-medium text-muted-foreground border-b">
                <div className="col-span-4">Produit Standardisé</div>
                <div className="col-span-2 text-center">Quantité</div>
                <div className="col-span-3">Catégorie</div>
                <div className="col-span-3 text-right">Prix Payé</div>
              </div>
              <div className="divide-y max-h-[500px] overflow-auto">
                {extractedData.products.map((prod: any, i: number) => (
                  <div key={i} className="grid grid-cols-12 p-3 text-sm items-center hover:bg-muted/50 transition-colors">
                    <div className="col-span-4 font-medium pr-2">
                      {prod.standardName || prod.rawName}
                      {prod.brand && <span className="text-xs text-muted-foreground ml-2">({prod.brand})</span>}
                    </div>
                    <div className="col-span-2 text-center text-muted-foreground">
                      {prod.quantity} {prod.unit}
                    </div>
                    <div className="col-span-3">
                      <select 
                        className="w-full bg-background border rounded px-2 py-1 text-xs"
                        value={prod.category || 'Alimentation'}
                        onChange={(e) => updateProductCategory(i, e.target.value)}
                      >
                        <option value="Produits frais">Produits frais</option>
                        <option value="Boissons">Boissons</option>
                        <option value="Hygiène">Hygiène</option>
                        <option value="Entretien">Entretien</option>
                        <option value="Bricolage">Bricolage</option>
                        <option value="Électronique">Électronique</option>
                        <option value="Alimentation">Alimentation générale</option>
                        <option value="Autres">Autres</option>
                      </select>
                    </div>
                    <div className="col-span-3 text-right font-bold">
                      {prod.paidPrice?.toFixed(2)} €
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="mt-4 flex items-center gap-2 text-sm text-amber-500 bg-amber-500/10 p-3 rounded-lg">
              <AlertCircle size={16} />
              Vérifiez la normalisation des noms des produits. Ce nettoyage est crucial pour le comparateur de prix multi-magasins.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
