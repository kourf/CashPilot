import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Database, Download, AlertTriangle, RefreshCw } from 'lucide-react';

export default function Settings() {
  return (
    <div className="p-6 md:p-10 space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Paramètres & Données</h1>
        <p className="text-muted-foreground mt-1">Gérez vos données personnelles et les paramètres de l'application.</p>
      </div>

      <div className="grid gap-6 max-w-3xl">
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database size={20} />
              Gestion des données
            </CardTitle>
            <CardDescription>
              CashPilot sauvegarde vos données localement et dans votre espace personnel sécurisé.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border rounded-xl bg-card">
              <div>
                <h4 className="font-medium">Données brutes</h4>
                <p className="text-sm text-muted-foreground">Consultez les extractions IA non modifiées</p>
              </div>
              <Button variant="outline" className="mt-3 sm:mt-0 gap-2">
                <Download size={16} /> Voir les données brutes
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-destructive/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle size={20} />
              Zone de danger
            </CardTitle>
            <CardDescription>
              Actions irréversibles concernant vos données.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border border-destructive/20 rounded-xl bg-destructive/5">
              <div>
                <h4 className="font-medium text-destructive">Réinitialiser l'application</h4>
                <p className="text-sm text-muted-foreground">Efface les données en cache local</p>
              </div>
              <Button variant="outline" className="mt-3 sm:mt-0 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
                <RefreshCw size={16} className="mr-2" /> Réinitialiser
              </Button>
            </div>
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border border-destructive/50 rounded-xl bg-destructive/10">
              <div>
                <h4 className="font-medium text-destructive font-bold">Supprimer toutes mes données</h4>
                <p className="text-sm text-destructive/80">Efface définitivement toutes vos données du cloud</p>
              </div>
              <Button variant="destructive" className="mt-3 sm:mt-0">
                Supprimer mes données
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
