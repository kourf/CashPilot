import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Sparkles, Target, ShieldCheck } from 'lucide-react';

export default function Coach() {
  return (
    <div className="p-6 md:p-10 space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Coach IA CashPilot</h1>
        <p className="text-muted-foreground mt-1">Vos conseils personnalisés basés sur l'analyse de vos finances et les repères français.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card className="glass border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-primary">
                <Sparkles size={20} />
                Conseil du mois
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">
                Bonjour ! Ce mois-ci, vos dépenses alimentaires ont augmenté de 12% par rapport au mois dernier. En analysant vos tickets de caisse, on remarque que vos achats chez <strong>Monoprix</strong> représentent une part importante. En transférant 30% de ces achats vers <strong>Lidl</strong> ou <strong>Leclerc</strong> (qui sont vos autres magasins habituels), vous pourriez économiser environ <strong>45€ par mois</strong>.
              </p>
              <div className="mt-4 flex gap-3">
                <Button size="sm">Voir l'analyse détaillée</Button>
                <Button size="sm" variant="outline">Générer le rapport PDF</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target size={20} className="text-warning" />
                Vos Objectifs (Effort : Moyen)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Réduire les abonnements</span>
                  <span className="text-muted-foreground">En cours (2/3)</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-warning w-2/3 rounded-full"></div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Épargne de précaution</span>
                  <span className="text-muted-foreground">Atteint (100%)</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-success w-full rounded-full"></div>
                </div>
              </div>
              <Button variant="link" className="px-0">Modifier mes objectifs ou mon niveau d'effort</Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck size={20} className="text-success" />
                Repères France
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4">
                Données moyennes comparatives basées sur les sources officielles.
              </p>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span>Alimentation</span>
                  <span className="font-bold">385 € / mois</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span>Logement</span>
                  <span className="font-bold">650 € / mois</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span>Épargne moyenne</span>
                  <span className="font-bold">15% des revenus</span>
                </div>
                <div className="mt-4 pt-4 border-t text-[10px] text-muted-foreground">
                  Sources: INSEE (2025), Banque de France (2025). Données indicatives pour un foyer d'une personne.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
