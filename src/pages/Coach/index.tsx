import { useState, useEffect, useRef, useMemo } from 'react';
import { MarkdownRenderer } from '../../components/ui/MarkdownRenderer';
import { useTransactions } from '../../context/TransactionsContext';
import { useReceipts } from '../../context/ReceiptsContext';
import { 
  buildFinancialProfile, 
  askFinancialCoach, 
  getGeminiModelName, 
  type ChatMessage,
  type FinancialProfile
} from '../../lib/coachFinancialEngine.ts';
import { 
  Sparkles, 
  Send, 
  Copy, 
  Check, 
  Plus, 
  Calendar, 
  Target, 
  Scale, 
  ShoppingBag, 
  CreditCard, 
  SlidersHorizontal
} from 'lucide-react';

const STORAGE_KEY_CHAT = 'cashpilot_coach_chat_v2';

export default function Coach() {
  const { transactions = [], currency = 'EUR', availableMonths = [] } = useTransactions();
  const { receipts = [], products = [] } = useReceipts();

  // Filtre de portée : 'all' (toute la base) ou mois spécifique
  const [selectedScope, setSelectedScope] = useState<string>('all');

  // Filtrage des transactions selon la portée choisie
  const scopedTransactions = useMemo(() => {
    if (selectedScope === 'all') return transactions;
    return transactions.filter(t => t.monthKey === selectedScope || (t.date && t.date.startsWith(selectedScope)));
  }, [transactions, selectedScope]);

  // Profil financier déterministe compilé en direct
  const financialProfile: FinancialProfile = useMemo(() => {
    return buildFinancialProfile(scopedTransactions, receipts, products, currency);
  }, [scopedTransactions, receipts, products, currency]);

  // Messages de chat (avec persistance localStorage)
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CHAT);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp)
          }));
        }
      }
    } catch (e) {
      console.warn("Erreur chargement historique chat coach:", e);
    }
    return [];
  });

  // Sauvegarde automatique du chat
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CHAT, JSON.stringify(messages));
    } catch (e) {
      console.warn("Erreur sauvegarde chat coach:", e);
    }
  }, [messages]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState<string>('Analyse des données...');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll vers le bas
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Modèle actuel
  const activeModel = getGeminiModelName();

  // Suggestions de questions principales inspirées de Gemini
  const suggestions = [
    {
      icon: Calendar,
      title: "Liste des dépenses par date",
      subtitle: "« Liste moi mes dépenses du 01 au 15 de ce mois avec le total »",
      prompt: "Liste moi mes dépenses du 01 au 15 de ce mois sous forme de tableau détaillé avec le montant total."
    },
    {
      icon: Target,
      title: "Top 3 postes de dépenses",
      subtitle: "« Quels sont mes 3 postes de dépenses les plus importants ? »",
      prompt: "Quels sont mes 3 postes de dépenses les plus importants et comment puis-je les optimiser ?"
    },
    {
      icon: Scale,
      title: "Règle budgétaire 50 / 30 / 20",
      subtitle: "« Analyse mes finances selon la méthode 50/30/20 avec mes chiffres réels »",
      prompt: "Donne-moi des conseils sur la répartition de mes dépenses selon la règle 50/30/20 en te basant sur mes chiffres réels."
    },
    {
      icon: ShoppingBag,
      title: "Économies en supermarché",
      subtitle: "« Où et sur quels produits puis-je économiser d'après mes tickets ? »",
      prompt: "En analysant mes tickets de caisse et mes courses de supermarché, sur quels articles et enseignes puis-je faire des économies ?"
    },
    {
      icon: CreditCard,
      title: "Audit de mes abonnements",
      subtitle: "« Combien me coûtent mes abonnements par an et que résilier ? »",
      prompt: "Fais-moi l'audit de mes abonnements et prélèvements récurrents : combien me coûtent-ils par an et comment les optimiser ?"
    }
  ];

  // Envoi d'un message au coach
  const handleSendMessage = async (textToSend?: string) => {
    const prompt = (textToSend || inputPrompt).trim();
    if (!prompt || isLoading) return;

    setInputPrompt('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: new Date(),
      status: 'done'
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setLoadingStep("Exploration de l'ensemble de votre base bancaire...");

    const stepTimer1 = setTimeout(() => {
      setLoadingStep("Calcul des ratios 50/30/20 et agrégations financières...");
    }, 900);

    const stepTimer2 = setTimeout(() => {
      setLoadingStep("Génération de la réponse par Gemini...");
    }, 1800);

    try {
      const responseText = await askFinancialCoach(
        prompt,
        messages,
        financialProfile,
        scopedTransactions,
        currency
      );

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: responseText,
        timestamp: new Date(),
        status: 'done'
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: `assistant-err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ **Une erreur est survenue lors de la communication avec l'IA.**\n\n${err?.message || 'Veuillez vérifier votre connexion ou votre clé API.'}`,
        timestamp: new Date(),
        status: 'error'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleNewChat = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY_CHAT);
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] bg-background text-foreground relative selection:bg-primary/20 selection:text-primary">
      
      {/* Barre Supérieure Épurée (Top Bar Gemini) */}
      <div className="sticky top-0 z-20 backdrop-blur-xl bg-background/80 dark:bg-[#0a0d14]/75 border-b border-border/40 dark:border-white/[0.04] px-4 md:px-8 py-3 flex items-center justify-between">
        
        {/* Modèle & Statut Base */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/60 dark:bg-white/[0.04] border border-border/60 dark:border-white/[0.06] text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-foreground">{activeModel}</span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground px-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>{scopedTransactions.length} transactions connectées</span>
          </div>
        </div>

        {/* Contrôles : Portée & Nouvelle discussion */}
        <div className="flex items-center gap-2">
          {/* Sélecteur de mois / période */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/40 dark:bg-white/[0.03] border border-border/50 dark:border-white/[0.05] text-xs">
            <SlidersHorizontal size={12} className="text-muted-foreground" />
            <select
              value={selectedScope}
              onChange={(e) => setSelectedScope(e.target.value)}
              className="bg-transparent text-xs font-medium text-foreground focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-card text-foreground">Toute la base ({transactions.length} ops)</option>
              {availableMonths.map(m => (
                <option key={m} value={m} className="bg-card text-foreground">
                  Mois {m}
                </option>
              ))}
            </select>
          </div>

          {/* Bouton Nouvelle Discussion */}
          {messages.length > 0 && (
            <button
              onClick={handleNewChat}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary/60 dark:bg-white/[0.05] hover:bg-secondary dark:hover:bg-white/[0.1] border border-border/60 dark:border-white/[0.08] text-xs font-semibold text-foreground transition-all"
              title="Commencer une nouvelle discussion"
            >
              <Plus size={14} className="text-primary" />
              <span className="hidden sm:inline">Nouvelle discussion</span>
            </button>
          )}
        </div>

      </div>

      {/* ZONE CENTRALE */}
      <div className="flex-1 flex flex-col justify-between max-w-4xl w-full mx-auto px-4 md:px-6">
        
        {/* ÉTAT 1 : ACCUEIL ÉPURÉ GEMINI (Aucun message) */}
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 md:py-20 space-y-8 animate-in fade-in duration-500">
            
            {/* Titre Principal Type Gemini */}
            <div className="text-center space-y-3 max-w-2xl px-2">
              <div className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-cyan-500/10 via-primary/10 to-indigo-500/10 border border-primary/20 mb-1">
                <Sparkles className="w-8 h-8 text-cyan-400 animate-pulse" />
              </div>
              <h1 className="text-3xl md:text-5xl font-medium tracking-tight text-foreground">
                Par quoi voulez-vous commencer ?
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground leading-relaxed max-w-lg mx-auto">
                Votre Coach Financier a analysé vos relevés et tickets. Posez n'importe quelle question sur vos comptes, vos ratios ou vos dépenses.
              </p>
            </div>

            {/* Boîte de Saisie Gemini (Au Centre) */}
            <div className="w-full max-w-2xl">
              <div className="relative rounded-3xl bg-[#1e2330]/80 dark:bg-[#131722]/90 border border-border/80 dark:border-white/[0.1] shadow-2xl p-3 focus-within:border-cyan-500/50 focus-within:ring-2 focus-within:ring-cyan-500/20 transition-all backdrop-blur-2xl">
                <textarea
                  ref={textareaRef}
                  value={inputPrompt}
                  onChange={(e) => setInputPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Demander au Coach IA (ex: dépenses du 01 au 15, top 3 postes, règle 50/30/20)..."
                  rows={2}
                  disabled={isLoading}
                  className="w-full resize-none bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none leading-relaxed"
                />

                <div className="flex items-center justify-between pt-2 px-1">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Grand livre connecté ({scopedTransactions.length} flux)</span>
                  </div>

                  <button
                    onClick={() => handleSendMessage()}
                    disabled={!inputPrompt.trim() || isLoading}
                    className="w-9 h-9 rounded-full bg-gradient-to-r from-cyan-500 to-primary hover:from-cyan-400 hover:to-primary/90 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed shadow-md shadow-primary/20 transition-all"
                  >
                    <Send size={15} />
                  </button>
                </div>
              </div>
            </div>

            {/* Cartes de Suggestions Épurées */}
            <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
              {suggestions.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(item.prompt)}
                    className="p-3.5 rounded-2xl text-left bg-secondary/30 dark:bg-white/[0.02] hover:bg-secondary/60 dark:hover:bg-white/[0.06] border border-border/60 dark:border-white/[0.06] hover:border-cyan-500/40 transition-all duration-200 group flex items-start gap-3"
                  >
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs font-semibold text-foreground group-hover:text-cyan-400 transition-colors">
                        {item.title}
                      </h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                        {item.subtitle}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

          </div>
        ) : (
          
          /* ÉTAT 2 : DISCUSSION ACTIVE (Style Gemini Stream) */
          <div className="flex-1 flex flex-col py-6 space-y-6">
            
            {/* Flux des messages */}
            <div className="space-y-6 pb-32">
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3.5 ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in duration-300`}
                  >
                    {!isUser && (
                      <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-cyan-500 via-primary to-indigo-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-cyan-500/20 mt-1">
                        <Sparkles size={16} />
                      </div>
                    )}

                    <div className={`space-y-1.5 ${isUser ? 'max-w-[85%] sm:max-w-[75%]' : 'max-w-full flex-1'}`}>
                      <div
                        className={`text-sm leading-relaxed ${
                          isUser
                            ? 'p-4 rounded-3xl bg-secondary/80 dark:bg-[#1a202e] border border-border/60 dark:border-white/[0.08] text-foreground inline-block'
                            : 'p-1 text-foreground/95'
                        }`}
                      >
                        {isUser ? (
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        ) : (
                          <MarkdownRenderer content={msg.content} />
                        )}
                      </div>

                      {/* Actions sous la bulle du Coach */}
                      {!isUser && (
                        <div className="flex items-center gap-3 pt-2 text-xs text-muted-foreground px-1">
                          <button
                            onClick={() => handleCopyMessage(msg.id, msg.content)}
                            className="hover:text-foreground flex items-center gap-1.5 transition-colors text-[11px]"
                            title="Copier la réponse"
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check size={12} className="text-emerald-500" />
                                <span className="text-emerald-500 font-medium">Copié !</span>
                              </>
                            ) : (
                              <>
                                <Copy size={12} />
                                <span>Copier</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Indicateur de chargement Gemini */}
              {isLoading && (
                <div className="flex items-start gap-3.5 animate-in fade-in duration-300">
                  <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-cyan-500 to-primary text-white flex items-center justify-center shrink-0 shadow-md shadow-cyan-500/20 mt-1">
                    <Sparkles size={16} className="animate-spin" />
                  </div>
                  <div className="space-y-2 py-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                      <span>{loadingStep}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-cyan-500/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full bg-cyan-500/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full bg-cyan-500/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Zone de Saisie Flottante Pinned en Bas (Gemini Style) */}
            <div className="fixed bottom-0 left-0 right-0 md:left-64 z-30 p-4 bg-gradient-to-t from-background via-background/95 to-transparent backdrop-blur-md">
              <div className="max-w-3xl mx-auto space-y-2">
                
                {/* Suggestions Rapides sous forme de Pilules au-dessus de l'input */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
                  <span className="text-muted-foreground text-[11px] font-semibold shrink-0 flex items-center gap-1">
                    <Sparkles size={11} className="text-cyan-400" /> Suggestions :
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSendMessage("Liste moi mes dépenses du 01 au 15 de ce mois avec le montant total")}
                    className="px-3 py-1 rounded-full bg-secondary/70 dark:bg-white/[0.04] hover:bg-cyan-500/10 hover:text-cyan-400 border border-border/70 dark:border-white/[0.07] shrink-0 transition-colors text-[11px] font-medium"
                  >
                    📅 Dépenses du 01 au 15
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendMessage("Quels sont mes 3 postes de dépenses les plus importants et comment les optimiser ?")}
                    className="px-3 py-1 rounded-full bg-secondary/70 dark:bg-white/[0.04] hover:bg-cyan-500/10 hover:text-cyan-400 border border-border/70 dark:border-white/[0.07] shrink-0 transition-colors text-[11px] font-medium"
                  >
                    📊 Top 3 postes de dépenses
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendMessage("Donne-moi des conseils sur la répartition de mes dépenses selon la règle 50/30/20 avec mes chiffres réels")}
                    className="px-3 py-1 rounded-full bg-secondary/70 dark:bg-white/[0.04] hover:bg-cyan-500/10 hover:text-cyan-400 border border-border/70 dark:border-white/[0.07] shrink-0 transition-colors text-[11px] font-medium"
                  >
                    ⚖️ Règle 50/30/20
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendMessage("En analysant mes courses et tickets de caisse, sur quoi puis-je économiser ?")}
                    className="px-3 py-1 rounded-full bg-secondary/70 dark:bg-white/[0.04] hover:bg-cyan-500/10 hover:text-cyan-400 border border-border/70 dark:border-white/[0.07] shrink-0 transition-colors text-[11px] font-medium"
                  >
                    🛒 Optimiser mes courses
                  </button>
                </div>

                {/* Champ de Saisie Style Gemini */}
                <div className="relative rounded-3xl bg-[#1e2330]/90 dark:bg-[#131722]/95 border border-border/80 dark:border-white/[0.1] shadow-2xl p-2.5 focus-within:border-cyan-500/50 focus-within:ring-2 focus-within:ring-cyan-500/20 transition-all backdrop-blur-2xl flex items-center gap-2">
                  <textarea
                    ref={textareaRef}
                    value={inputPrompt}
                    onChange={(e) => setInputPrompt(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Demander au Coach IA..."
                    rows={1}
                    disabled={isLoading}
                    className="flex-1 resize-none bg-transparent px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none max-h-32"
                    style={{ minHeight: '38px' }}
                  />

                  <button
                    onClick={() => handleSendMessage()}
                    disabled={!inputPrompt.trim() || isLoading}
                    className="w-9 h-9 rounded-full bg-gradient-to-r from-cyan-500 to-primary hover:from-cyan-400 hover:to-primary/90 text-white flex items-center justify-center shrink-0 disabled:opacity-30 disabled:cursor-not-allowed shadow-md shadow-primary/20 transition-all"
                  >
                    <Send size={15} />
                  </button>
                </div>

              </div>
            </div>

          </div>

        )}

      </div>

    </div>
  );
}
