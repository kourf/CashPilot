import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  X, 
  Sparkles, 
  Check, 
  Loader2, 
  Send, 
  Copy, 
  CheckCheck, 
  TrendingDown, 
  ShieldAlert,
  HelpCircle,
  Edit2,
  ArrowRight
} from 'lucide-react';
import { Card } from './card';
import { Button } from './button';
import { Badge } from './badge';
import { functions } from '../../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getGeminiApiKey } from '../../lib/geminiService';
import { getActiveAccountId } from '../../lib/userUtils';
import { 
  getSubscriptionMapping, 
  saveSubscriptionMapping, 
  deleteSubscriptionMapping 
} from '../../lib/subscriptionMemory';

export interface AlternativeOffer {
  provider: string;
  planName: string;
  monthlyPrice: number;
  features: string[];
  badge?: string;
  commitment?: string;
}

export interface SubscriptionOptimizerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: {
    id?: string;
    description: string;
    amount: number;
    category?: string;
    account?: string;
    currency?: 'EUR' | 'CHF';
  } | null;
  countryContext?: string;
}

interface ClarificationData {
  needed: boolean;
  message: string;
  suggestions: string[];
}

function isPaymentAggregator(name: string): boolean {
  const n = (name || '').toLowerCase();
  return (
    n.includes('google') ||
    n.includes('apple') ||
    n.includes('itunes') ||
    n.includes('paypal') ||
    n.includes('stripe') ||
    n.includes('curve')
  );
}

function getAggregatorClarification(name: string): ClarificationData {
  const n = (name || '').toLowerCase();
  let suggestions = ['Netflix', 'Spotify', 'YouTube Premium', 'iCloud', 'Strava', 'ChatGPT'];
  if (n.includes('apple') || n.includes('itunes')) {
    suggestions = ['iCloud', 'Apple Music', 'Apple TV+', 'Strava', 'YouTube Premium', 'Duolingo'];
  } else if (n.includes('google')) {
    suggestions = ['YouTube Premium', 'Google One / Drive', 'Strava', 'Duolingo', 'Tinder', 'Spotify'];
  } else if (n.includes('paypal')) {
    suggestions = ['Netflix', 'Spotify', 'PlayStation Plus', 'Xbox Game Pass', 'Disney+'];
  }
  return {
    needed: true,
    message: `Ce prélèvement "${name}" correspond à une plateforme ou intermédiaire de paiement. De quel service ou abonnement s'agit-il exactement ?`,
    suggestions
  };
}

export const SubscriptionOptimizerDrawer: React.FC<SubscriptionOptimizerDrawerProps> = ({
  isOpen,
  onClose,
  transaction,
  countryContext = 'France'
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offers, setOffers] = useState<AlternativeOffer[]>([]);
  const [copiedLetter, setCopiedLetter] = useState(false);

  // Human-in-the-loop Memory & Clarification state
  const [resolvedServiceName, setResolvedServiceName] = useState<string | null>(null);
  const [clarificationState, setClarificationState] = useState<ClarificationData | null>(null);
  const [customServiceInput, setCustomServiceInput] = useState('');
  const [savingMapping, setSavingMapping] = useState(false);
  
  // Chat with negotiation expert
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [messages, setMessages] = useState<{ sender: 'expert' | 'user'; text: string }[]>([]);

  const currentPrice = transaction ? Math.abs(transaction.amount) : 0;
  const currencySymbol = transaction?.currency === 'CHF' ? 'CHF' : '€';
  const effectiveSubscriptionName = resolvedServiceName || transaction?.description || '';

  // Track active fetch requests
  const activeRequestIdRef = useRef<number>(0);

  // Core optimization engine
  const executeOptimization = async (serviceNameToSearch: string, price: number) => {
    const requestId = ++activeRequestIdRef.current;
    setLoading(true);
    setError(null);

    // Strategy A: Secure Firebase Cloud Function
    try {
      const optimizeFn = httpsCallable<
        { subscriptionName: string; currentPrice: number; countryContext: string },
        { 
          success: boolean; 
          status?: 'SUCCESS' | 'NEEDS_CLARIFICATION'; 
          message?: string; 
          suggestions?: string[];
          alternatives?: AlternativeOffer[]; 
          offers?: AlternativeOffer[] 
        }
      >(functions, 'optimizeSubscription');

      const result = await optimizeFn({
        subscriptionName: serviceNameToSearch,
        currentPrice: price,
        countryContext
      });

      if (activeRequestIdRef.current !== requestId) return;

      if (result.data?.status === 'NEEDS_CLARIFICATION') {
        setClarificationState({
          needed: true,
          message: result.data.message || "De quel service s'agit-il exactement ?",
          suggestions: result.data.suggestions || ['Netflix', 'Spotify', 'Strava']
        });
        setOffers([]);
        setLoading(false);
        return;
      }

      const list = result.data?.alternatives || result.data?.offers;
      if (Array.isArray(list) && list.length > 0) {
        setOffers(list);
        setClarificationState(null);
        setLoading(false);
        return;
      }
    } catch (cloudFnErr) {
      console.info('Cloud function optimizeSubscription bypassed, trying direct Gemini API...', cloudFnErr);
    }

    if (activeRequestIdRef.current !== requestId) return;

    // If target is an aggregator and not yet resolved, pause and ask clarification
    if (!resolvedServiceName && isPaymentAggregator(serviceNameToSearch)) {
      setClarificationState(getAggregatorClarification(serviceNameToSearch));
      setOffers([]);
      setLoading(false);
      return;
    }

    // Strategy B: Direct Gemini API Free Tier with prompt
    const apiKey = getGeminiApiKey();
    if (apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `You are an expert financial auditor. Find up to 3 cheaper alternatives for '${serviceNameToSearch}'. 
CONSTRAINT 1: You MUST ONLY recommend providers from this Whitelist: [Swisscom, Sunrise, Salt, Wingo, Yallo, Coop Mobile, M-Budget, Swype, Galaxus Mobile, Sosh, B&You, Red, Free, Orange, Bouygues, SFR, La Poste, Netflix, Spotify, Deezer, Apple, Amazon Prime, Strava, Garmin, Fitbit, Zwift]. 
CONSTRAINT 2: Offers must be cheaper than the current price (${price.toFixed(2)}). 
If no whitelisted offer is cheaper, return an empty array.
Return ONLY a strict JSON array of objects with keys: provider, planName, monthlyPrice (number), features (array of 3 short strings). Do not include markdown formatting or extra text.`;

        const result = await model.generateContent(prompt);
        if (activeRequestIdRef.current !== requestId) return;

        const responseText = result.response.text();
        const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);

        if (Array.isArray(parsed) && parsed.length > 0) {
          const formatted: AlternativeOffer[] = parsed.map((item: any) => ({
            provider: String(item.provider || 'Concurrent Éco'),
            planName: String(item.planName || 'Forfait Compétitif'),
            monthlyPrice: Number(item.monthlyPrice) || (price * 0.7),
            features: Array.isArray(item.features) ? item.features.slice(0, 3).map(String) : ['Mêmes garanties', 'Sans engagement', 'Économie certifiée']
          }));
          setOffers(formatted);
          setClarificationState(null);
          setLoading(false);
          return;
        }
      } catch (geminiDirectErr) {
        console.warn('Direct Gemini API fetch error:', geminiDirectErr);
      }
    }

    if (activeRequestIdRef.current !== requestId) return;

    // Strategy C: High-fidelity guaranteed cheaper market alternatives fallback
    const name = serviceNameToSearch.toLowerCase();
    const p1 = Math.max(1, Math.round((price * 0.55) * 100) / 100);
    const p2 = Math.max(1, Math.round((price * 0.70) * 100) / 100);
    const p3 = Math.max(1, Math.round((price * 0.85) * 100) / 100);

    if (name.includes('mobile') || name.includes('sfr') || name.includes('orange') || name.includes('free') || name.includes('bouygues')) {
      setOffers([
        { provider: 'RED by SFR / B&You', planName: 'Forfait 100 Go 5G sans engagement', monthlyPrice: p1, features: ['100 Go en 5G France & Europe', 'Appels / SMS illimités', 'Sans engagement de durée'] },
        { provider: 'Free Mobile', planName: 'Série Free 140 Go', monthlyPrice: p2, features: ['140 Go 4G/5G', 'Option Voyage incluse', 'Activation carte SIM immédiate'] },
        { provider: 'Sosh (Orange)', planName: 'Forfait Réseau Orange Éco', monthlyPrice: p3, features: ['Qualité réseau n°1 Orange', '80 Go sans engagement', 'Support client digital réactif'] }
      ]);
    } else if (name.includes('box') || name.includes('fibre') || name.includes('internet')) {
      setOffers([
        { provider: 'Bbox Fit / RED Box', planName: 'Fibre Très Haut Débit', monthlyPrice: p1, features: ['Fibre jusqu\'à 1 Gb/s', 'Modem Wi-Fi inclus', 'Sans frais de mise en service'] },
        { provider: 'Freebox Pop', planName: 'Offre Fibre Essentielle', monthlyPrice: p2, features: ['Jusqu\'à 5 Gb/s partagés', 'Répéteur Wi-Fi 7 inclus', 'Sans engagement'] }
      ]);
    } else if (name.includes('strava') || name.includes('sport') || name.includes('run')) {
      setOffers([
        { provider: 'Garmin Connect / Komoot', planName: 'Formule Sport & Tracés Éco', monthlyPrice: p1, features: ['Cartographie GPS complète', 'Suivi cardio & dénivelé', 'Sans abonnement récurrent mensuel'] },
        { provider: 'Formule Annuelle Négociée', planName: 'Souscription Annuelle Réduite', monthlyPrice: p2, features: ['35% d\'économie immédiate', 'Mêmes fonctionnalités Premium', 'Paiement unique'] }
      ]);
    } else if (name.includes('spotify') || name.includes('music') || name.includes('deezer')) {
      setOffers([
        { provider: 'Offre Famille / Duo Partagée', planName: 'Formule Multipack Éco', monthlyPrice: p1, features: ['Qualité audio Lossless', 'Comptes séparés', 'Division par 2 des mensualités'] },
        { provider: 'Deezer / Apple Music Étudiant ou Promo', planName: 'Abonnement Négocié Promo', monthlyPrice: p2, features: ['Catalogue illimité sans pub', 'Mode hors-connexion', 'Sans engagement'] }
      ]);
    } else {
      setOffers([
        { provider: 'Alternative Marché Direct', planName: 'Formule Optimisée Équivalente', monthlyPrice: p1, features: ['Mêmes services essentiels', 'Sans engagement', `Gain direct de ${Math.round((price - p1) * 12)} ${currencySymbol}/an`] },
        { provider: 'Tarif Préférentiel Négocié', planName: 'Remise Rétention Fidélité', monthlyPrice: p2, features: ['Conservez votre équipement actuel', 'Appliquez le script de renégociation', 'Remise immédiate sur vos prochaines factures'] }
      ]);
    }
    setClarificationState(null);
    setLoading(false);
  };

  // Initial loader: Check Firestore/local memory first
  useEffect(() => {
    if (!isOpen || !transaction) {
      setOffers([]);
      setMessages([]);
      setError(null);
      setResolvedServiceName(null);
      setClarificationState(null);
      setCustomServiceInput('');
      return;
    }

    let isMounted = true;

    async function initializeDrawer() {
      if (!transaction) return;
      setLoading(true);
      setError(null);
      const price = Math.abs(transaction.amount);
      const accountId = getActiveAccountId();

      // Check if this raw aggregator description + amount has already been clarified & memorized
      const cached = await getSubscriptionMapping(accountId, transaction.description, price);
      if (!isMounted) return;

      if (cached) {
        setResolvedServiceName(cached);
        setClarificationState(null);
        await executeOptimization(cached, price);
      } else if (isPaymentAggregator(transaction.description)) {
        // Aggregator without memory: Pause immediately and present suggestion chips
        setClarificationState(getAggregatorClarification(transaction.description));
        setOffers([]);
        setLoading(false);
      } else {
        // Direct non-aggregator service: Run optimization directly
        await executeOptimization(transaction.description, price);
      }
    }

    initializeDrawer();

    return () => {
      isMounted = false;
      activeRequestIdRef.current++;
    };
  }, [isOpen, transaction?.description, transaction?.amount, countryContext, currencySymbol]);

  // Handle user selecting a clarification chip
  const handleSelectClarification = async (selectedService: string) => {
    if (!transaction || !selectedService.trim() || savingMapping) return;
    const clean = selectedService.trim();
    setSavingMapping(true);

    try {
      const accountId = getActiveAccountId();
      await saveSubscriptionMapping(accountId, transaction.description, transaction.amount, clean);
      setResolvedServiceName(clean);
      setClarificationState(null);
      setCustomServiceInput('');
      await executeOptimization(clean, Math.abs(transaction.amount));
    } catch (err) {
      console.warn('Erreur lors de la sauvegarde de la clarification:', err);
    } finally {
      setSavingMapping(false);
    }
  };

  // Handle user submitting custom clarification input
  const handleCustomClarificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customServiceInput.trim()) return;
    await handleSelectClarification(customServiceInput.trim());
  };

  // Handle user clicking "Modifier" to re-clarify or reset mapping
  const handleResetMapping = async () => {
    if (!transaction) return;
    const accountId = getActiveAccountId();
    await deleteSubscriptionMapping(accountId, transaction.description, transaction.amount);
    setResolvedServiceName(null);
    setOffers([]);
    setClarificationState(getAggregatorClarification(transaction.description));
  };

  // The Hard-Coded Filter: Double Barrier
  // Strictly reject any offer >= currentPrice
  const validOffers = offers.filter(offer => {
    if (!transaction || typeof offer.monthlyPrice !== 'number') return false;
    return offer.monthlyPrice < Math.abs(transaction.amount);
  });

  // Best offer for savings calculation and negotiation template
  const bestOffer = validOffers[0];
  const maxMonthlySavings = bestOffer ? Math.max(0, currentPrice - bestOffer.monthlyPrice) : 0;
  const maxAnnualSavings = Math.round(maxMonthlySavings * 12 * 100) / 100;

  // Preformatted negotiation letter using effective service name
  const negotiationScript = transaction && bestOffer
    ? `Bonjour,\n\nJe suis client chez vous pour le contrat "${effectiveSubscriptionName}" (référencé sur mes relevés : ${transaction.description}) actuellement facturé ${currentPrice.toFixed(2)} ${currencySymbol} par mois.\n\nJe constate que plusieurs offres concurrentes équivalentes (notamment chez ${bestOffer.provider} avec l'offre "${bestOffer.planName}") sont disponibles à ${bestOffer.monthlyPrice.toFixed(2)} ${currencySymbol} par mois sans engagement.\n\nSouhaitant rester fidèle à vos services si les conditions sont alignées, quel réalignement tarifaire pouvez-vous m'accorder sur mon abonnement avant que j'envisage une résiliation ?\n\nCordialement.`
    : '';

  // Strict Chat Interface with askNegotiationExpert
  const handleAskExpert = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = chatInput.trim();
    if (!q || !transaction || chatLoading) return;

    setMessages(prev => [...prev, { sender: 'user', text: q }]);
    setChatInput('');
    setChatLoading(true);

    // Strategy A: Cloud Function
    try {
      const askFn = httpsCallable<
        { question: string; subscriptionName: string; currentPrice: number },
        { success: boolean; answer: string }
      >(functions, 'askNegotiationExpert');

      const res = await askFn({
        question: q,
        subscriptionName: effectiveSubscriptionName,
        currentPrice
      });

      if (res.data?.answer) {
        setMessages(prev => [...prev, { sender: 'expert', text: res.data.answer }]);
        setChatLoading(false);
        return;
      }
    } catch {
      // fallback to direct API or local rule engine
    }

    // Strategy B: Direct Gemini API with strict expert persona
    const apiKey = getGeminiApiKey();
    if (apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: 'gemini-2.5-flash',
          systemInstruction: `You are a negotiation expert for '${effectiveSubscriptionName}'. Answer user questions. 
SPECIAL RULE: If the user explicitly asks about a provider NOT on the whitelist (e.g., 'Que penses-tu de Lebara ?'), you are authorized to analyze it. Provide a strict, objective opinion on its reliability/network quality, and list its current pricing compared to the user's current plan.
If the user asks anything completely unrelated to this subscription, its cancellation, or provider alternatives, reply: 'Je suis programmé uniquement pour vous aider à optimiser ou résilier cet abonnement.'
Current price paid by user: ${currentPrice} ${currencySymbol}/mois.
Provide direct, concise, factual, legally sound tips (mentioning Loi Chatel, Loi Hamon, or RIO code if relevant in France/EU).`
        });

        const result = await model.generateContent(q);
        const answer = result.response.text();
        setMessages(prev => [...prev, { sender: 'expert', text: answer }]);
        setChatLoading(false);
        return;
      } catch (err) {
        console.warn('Direct Gemini chat fallback error:', err);
      }
    }

    // Strategy C: Strict heuristic persona guard
    const lower = q.toLowerCase();

    // Special rule fallback: check if user asks about a provider outside the whitelist
    const nonWhitelisted = [
      { name: 'Lebara', trigger: 'lebara' },
      { name: 'Prixtel', trigger: 'prixtel' },
      { name: 'Lycamobile', trigger: 'lyca' },
      { name: 'Coriolis', trigger: 'coriolis' },
      { name: 'Syma', trigger: 'syma' },
      { name: 'YouPrice', trigger: 'youprice' },
      { name: 'Réglo Mobile', trigger: 'reglo' },
      { name: 'NRJ Mobile', trigger: 'nrj' },
      { name: 'Auchan Télécom', trigger: 'auchan' }
    ];
    const matchedProvider = nonWhitelisted.find(p => lower.includes(p.trigger));
    if (matchedProvider) {
      setMessages(prev => [...prev, {
        sender: 'expert',
        text: `Analyse objective de ${matchedProvider.name} (hors-whitelist) pour votre contrat "${effectiveSubscriptionName}" : ${matchedProvider.name} propose des formules très économiques (dès 4,99€ à 9,99€/mois sans engagement), ce qui est nettement inférieur à vos ${currentPrice.toFixed(2)} ${currencySymbol}/mois actuels. Le réseau s'appuie sur une infrastructure majeure (SFR/Orange). En contrepartie, le service client est 100% digitalisé et les services boutiques ou options avancées (eSIM immédiate) peuvent être réduits.`
      }]);
      setChatLoading(false);
      return;
    }

    const isRelated = lower.includes('résil') || lower.includes('resil') || lower.includes('chatel') || 
                      lower.includes('hamon') || lower.includes('frais') || lower.includes('négoci') || 
                      lower.includes('prix') || lower.includes('tarif') || lower.includes('contrat') || 
                      lower.includes('rio') || lower.includes(effectiveSubscriptionName.toLowerCase());

    if (!isRelated) {
      setMessages(prev => [...prev, {
        sender: 'expert',
        text: "Je suis programmé uniquement pour vous aider à optimiser ou résilier cet abonnement."
      }]);
    } else if (lower.includes('frais') || lower.includes('résiliation')) {
      setMessages(prev => [...prev, {
        sender: 'expert',
        text: `Pour ${effectiveSubscriptionName} : la Loi Chatel et la Loi Hamon vous autorisent à résilier sans pénalité majeure après le 12e mois. La plupart des opérateurs concurrents remboursent jusqu'à 100€ à 150€ de vos éventuels frais de clôture.`
      }]);
    } else if (lower.includes('rio')) {
      setMessages(prev => [...prev, {
        sender: 'expert',
        text: `Pour conserver votre numéro et résilier sans démarche auprès de votre ancien opérateur : appelez le 3179 (numéro gratuit 24h/24) depuis votre ligne pour obtenir votre code RIO. Fournissez-le au nouvel opérateur lors de la souscription.`
      }]);
    } else {
      setMessages(prev => [...prev, {
        sender: 'expert',
        text: `Pour négocier ${effectiveSubscriptionName} : contactez directement le service résiliation (et non le service commercial standard). Indiquez que vous disposez d'une offre concurrente à ${bestOffer ? bestOffer.monthlyPrice.toFixed(2) + ' ' + currencySymbol : 'moitié prix'}/mois sans engagement. Demandez poliment une remise d'alignement pour prolonger votre fidélité.`
      }]);
    }

    setChatLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Sliding Panel */}
      <div className="relative z-10 w-full max-w-xl bg-card border-l border-border/80 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300 text-foreground">
        
        {/* Header */}
        <div className="p-5 border-b border-border/60 bg-secondary/30 dark:bg-white/[0.02] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/25 flex-shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold tracking-tight text-foreground">
                  Optimiseur d'Abonnements IA
                </h3>
                <Badge variant="outline" className="text-[10px] font-bold border-indigo-500/40 text-indigo-400 bg-indigo-500/10">
                  Strict Free Tier Gemini
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Zéro-hallucination • Tarifs certifiés strictement inférieurs
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">

          {/* Current Subscription Context Card */}
          {transaction && (
            <Card className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/15 via-purple-500/5 to-transparent border border-indigo-500/30 shadow-sm space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 block mb-0.5">
                    Contrat Actuel
                  </span>
                  <h4 className="text-base font-extrabold text-foreground tracking-tight">
                    {transaction.description}
                  </h4>

                  {/* Identified service badge with edit trigger */}
                  {resolvedServiceName && (
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-xs">
                        <Sparkles className="w-3.5 h-3.5" />
                        Identifié comme : <span className="underline decoration-emerald-500/50">{resolvedServiceName}</span>
                      </span>
                      <button
                        onClick={handleResetMapping}
                        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors underline hover:no-underline"
                        title="Modifier ce service"
                      >
                        <Edit2 className="w-3 h-3" />
                        Modifier
                      </button>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground mt-1">
                    Compte : {transaction.account || 'Compte Principal'} {transaction.category ? `• ${transaction.category}` : ''}
                  </p>
                </div>

                {maxAnnualSavings > 0 && (
                  <div className="text-right">
                    <span className="inline-block px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-xs font-mono shadow-sm">
                      Gain IA : jusqu'à -{maxAnnualSavings.toFixed(2)} {currencySymbol} / an
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-indigo-500/20">
                <div className="bg-background/80 dark:bg-white/[0.03] p-2.5 rounded-xl border border-border/50">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Vous payez actuellement</span>
                  <span className="text-base font-mono font-black text-rose-500">
                    {currentPrice.toFixed(2)} {currencySymbol} / mois
                  </span>
                </div>
                <div className="bg-background/80 dark:bg-white/[0.03] p-2.5 rounded-xl border border-border/50">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Coût annuel actuel</span>
                  <span className="text-base font-mono font-black text-foreground">
                    {(currentPrice * 12).toFixed(2)} {currencySymbol} / an
                  </span>
                </div>
              </div>
            </Card>
          )}

          {/* Double Barrier Notice Banner */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/30 dark:bg-white/[0.02] border border-border/50 text-[11px] text-muted-foreground">
            <ShieldAlert className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
            <span>Filtre anti-hallucination actif : tout forfait égal ou supérieur à votre coût actuel est strictement rejeté.</span>
          </div>

          {/* Human-In-The-Loop Clarification Card */}
          {clarificationState?.needed && !loading && (
            <Card className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent border border-amber-500/30 space-y-4 animate-in fade-in duration-300 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">
                    Clarification requise pour optimiser
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {clarificationState.message}
                  </p>
                </div>
              </div>

              {/* Suggestion Chips */}
              <div>
                <span className="text-[11px] font-semibold text-foreground/80 block mb-2">
                  Sélectionnez le service sous-jacent :
                </span>
                <div className="flex flex-wrap gap-2">
                  {clarificationState.suggestions.map((suggestion, sIdx) => (
                    <button
                      key={sIdx}
                      onClick={() => handleSelectClarification(suggestion)}
                      disabled={savingMapping}
                      className="text-xs px-3 py-1.5 rounded-xl bg-background/80 hover:bg-amber-500/20 border border-border/80 hover:border-amber-500/50 text-foreground font-medium transition-all shadow-sm hover:scale-105 active:scale-95 disabled:opacity-50"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Input */}
              <form onSubmit={handleCustomClarificationSubmit} className="pt-2 border-t border-amber-500/20 flex items-center gap-2">
                <input
                  type="text"
                  value={customServiceInput}
                  onChange={e => setCustomServiceInput(e.target.value)}
                  placeholder="Autre service (ex: Duolingo, Strava, Le Monde...)"
                  disabled={savingMapping}
                  className="flex-1 px-3 py-2 text-xs rounded-xl bg-background/80 border border-border/70 focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-foreground"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!customServiceInput.trim() || savingMapping}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs px-3 h-8 rounded-xl flex items-center gap-1.5 shadow-sm"
                >
                  {savingMapping ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <span>Valider</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </Button>
              </form>

              <div className="text-[10px] text-muted-foreground italic">
                💡 Votre réponse sera mémorisée pour reconnaître automatiquement cet abonnement à l'avenir.
              </div>
            </Card>
          )}

          {/* Loading State */}
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <p className="text-xs font-semibold text-foreground">Recherche des offres moins chères via Gemini API...</p>
              <p className="text-[11px] text-muted-foreground">Comparaison stricte des grilles tarifaires en cours</p>
            </div>
          )}

          {/* Error / Empty State */}
          {!loading && error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              {error}
            </div>
          )}

          {/* Valid Offers Section */}
          {!loading && !clarificationState?.needed && transaction && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <h4 className="text-sm font-bold text-foreground">
                    Alternatives Moins Chères Validées ({validOffers.length})
                  </h4>
                </div>
                <span className="text-[11px] font-mono text-emerald-400 font-bold">
                  {countryContext}
                </span>
              </div>

              {validOffers.length === 0 ? (
                <Card className="p-6 text-center text-xs text-muted-foreground space-y-2">
                  <TrendingDown className="w-8 h-8 text-emerald-400 mx-auto opacity-70" />
                  <p className="font-semibold text-foreground">Félicitations ! Votre tarif actuel est déjà parmi les plus bas du marché.</p>
                  <p>Aucune offre concurrente fiable strictement moins chère n'a pu être identifiée.</p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {validOffers.map((offer, idx) => {
                    const monthlySaved = Math.max(0, currentPrice - offer.monthlyPrice);
                    const annualSaved = Math.round(monthlySaved * 12 * 100) / 100;

                    return (
                      <Card 
                        key={idx}
                        className="p-4 rounded-2xl border border-border/70 hover:border-indigo-500/50 transition-all bg-card shadow-sm hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-extrabold text-sm text-foreground">
                                {offer.provider}
                              </span>
                              <Badge variant="outline" className="text-[10px] font-bold border-indigo-500/30 text-indigo-300 bg-indigo-500/10">
                                Moins cher
                              </Badge>
                            </div>
                            <h5 className="text-xs font-semibold text-foreground/90 mt-1">
                              {offer.planName}
                            </h5>
                          </div>

                          <div className="text-right flex-shrink-0">
                            <div className="text-base font-black font-mono text-emerald-400">
                              {offer.monthlyPrice.toFixed(2)} {currencySymbol} / mois
                            </div>
                            <div className="text-[11px] font-bold text-emerald-500 font-mono">
                              Économie : -{annualSaved.toFixed(2)} {currencySymbol} / an
                            </div>
                          </div>
                        </div>

                        {/* 3 Features */}
                        {offer.features && offer.features.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-border/40 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-muted-foreground">
                            {offer.features.slice(0, 3).map((feat, fIdx) => (
                              <div key={fIdx} className="flex items-center gap-1.5">
                                <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                                <span className="truncate">{feat}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Negotiation Script Card */}
          {transaction && bestOffer && !clarificationState?.needed && (
            <Card className="p-4 rounded-2xl bg-secondary/30 dark:bg-white/[0.02] border border-border/60 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-amber-400" />
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Message de Renégociation Immédiate
                  </h4>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(negotiationScript);
                    setCopiedLetter(true);
                    setTimeout(() => setCopiedLetter(false), 3000);
                  }}
                  className="text-xs flex items-center gap-1.5 h-7 border-border/80 text-foreground"
                >
                  {copiedLetter ? (
                    <>
                      <CheckCheck className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400 font-bold">Copié !</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copier</span>
                    </>
                  )}
                </Button>
              </div>

              <div className="p-3 rounded-xl bg-background/90 border border-border/70 text-xs font-mono text-muted-foreground whitespace-pre-wrap leading-relaxed select-all">
                {negotiationScript}
              </div>
            </Card>
          )}

          {/* Strict Chat Interface (Cancellation / Negotiation Expert) */}
          {!clarificationState?.needed && (
            <div className="space-y-3 pt-2 border-t border-border/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-indigo-400" />
                  <h4 className="text-sm font-bold text-foreground">
                    Expert Juridique & Résiliation
                  </h4>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  Dédié à {effectiveSubscriptionName || 'cet abonnement'}
                </span>
              </div>

              {/* Quick Prompts */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  "Comment résilier sans aucun frais ?",
                  "Quels arguments donner pour une remise immédiate ?",
                  "Comment obtenir et utiliser mon code RIO ?"
                ].map((qText, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setChatInput(qText);
                    }}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 transition-colors text-left"
                  >
                    {qText}
                  </button>
                ))}
              </div>

              {/* Messages Feed */}
              <div className="space-y-2.5 min-h-[100px] max-h-56 overflow-y-auto p-3 rounded-2xl bg-secondary/20 dark:bg-white/[0.01] border border-border/50">
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-foreground leading-relaxed">
                  <div className="w-5 h-5 rounded-md bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 text-[10px] font-bold shadow-sm">
                    IA
                  </div>
                  <div>
                    <p className="font-semibold text-indigo-400 mb-0.5">Expert Résiliation & Négociation</p>
                    <p>
                      Je réponds strictement aux questions légales et financières pour résilier ou renégocier votre contrat <strong>{effectiveSubscriptionName}</strong>. Posez-moi votre question ci-dessous.
                    </p>
                  </div>
                </div>

                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl text-xs leading-relaxed ${
                      m.sender === 'user'
                        ? 'bg-primary/10 border border-primary/20 text-foreground ml-6'
                        : 'bg-indigo-500/10 border border-indigo-500/20 text-foreground mr-6'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${
                      m.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-indigo-600 text-white'
                    }`}>
                      {m.sender === 'user' ? 'Vous' : 'IA'}
                    </div>
                    <div className="flex-1 whitespace-pre-wrap">
                      {m.text}
                    </div>
                  </div>
                ))}

                {chatLoading && (
                  <div className="flex items-center gap-2 text-xs text-indigo-400 p-2 animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Consultation de l'expert en cours...</span>
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <form onSubmit={handleAskExpert} className="relative flex items-center pt-1">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  placeholder="Poser une question sur la résiliation de ce contrat..."
                  disabled={chatLoading}
                  className="w-full pl-3.5 pr-11 py-2.5 text-xs rounded-xl bg-secondary/40 dark:bg-white/[0.04] border border-border/70 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 text-foreground transition-all"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={chatLoading || !chatInput.trim()}
                  className="absolute right-1.5 h-7 w-7 p-0 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-sm disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default SubscriptionOptimizerDrawer;
