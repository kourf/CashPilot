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
  SlidersHorizontal,
  History,
  Trash2,
  X,
  MessageSquare
} from 'lucide-react';

export interface SavedConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  scope: string;
}

const STORAGE_CONVERSATIONS = 'cashpilot_coach_conversations_v3';
const STORAGE_ACTIVE_ID = 'cashpilot_coach_active_id_v3';
const LEGACY_STORAGE_CHAT = 'cashpilot_coach_chat_v2';

export default function Coach() {
  const { transactions = [], currency = 'EUR', availableMonths = [] } = useTransactions();
  const { receipts = [], products = [] } = useReceipts();

  // Liste de toutes les conversations enregistrées
  const [conversations, setConversations] = useState<SavedConversation[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CONVERSATIONS);
      if (saved) {
        const parsed: SavedConversation[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(c => ({
            ...c,
            messages: c.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }))
          }));
        }
      }

      // Migration fluide de l'ancienne conversation v2 si elle existe
      const legacy = localStorage.getItem(LEGACY_STORAGE_CHAT);
      if (legacy) {
        const parsedLegacy = JSON.parse(legacy);
        if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
          const firstUserMsg = parsedLegacy.find((m: any) => m.role === 'user');
          const title = firstUserMsg ? firstUserMsg.content.slice(0, 40) + '...' : 'Discussion existante';
          const conv: SavedConversation = {
            id: `conv-${Date.now()}`,
            title,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messages: parsedLegacy.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })),
            scope: 'all'
          };
          return [conv];
        }
      }
    } catch (e) {
      console.warn("Erreur chargement conversations coach:", e);
    }

    // Nouvelle conversation par défaut
    const defaultConv: SavedConversation = {
      id: `conv-${Date.now()}`,
      title: 'Nouvelle discussion',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
      scope: 'all'
    };
    return [defaultConv];
  });

  // ID de la conversation active
  const [activeConversationId, setActiveConversationId] = useState<string>(() => {
    try {
      const savedId = localStorage.getItem(STORAGE_ACTIVE_ID);
      if (savedId) return savedId;
    } catch {}
    return conversations[0]?.id || `conv-${Date.now()}`;
  });

  // Drawer d'historique ouvert/fermé
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Conversation courante
  const currentConversation = useMemo(() => {
    return conversations.find(c => c.id === activeConversationId) || conversations[0] || {
      id: `conv-${Date.now()}`,
      title: 'Nouvelle discussion',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
      scope: 'all'
    };
  }, [conversations, activeConversationId]);

  const messages = currentConversation.messages;
  const selectedScope = currentConversation.scope || 'all';

  // Sauvegarde automatique des conversations
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_CONVERSATIONS, JSON.stringify(conversations));
      localStorage.setItem(STORAGE_ACTIVE_ID, activeConversationId);
    } catch (e) {
      console.warn("Erreur sauvegarde conversations coach:", e);
    }
  }, [conversations, activeConversationId]);

  // Filtrage des transactions selon la portée choisie
  const scopedTransactions = useMemo(() => {
    if (selectedScope === 'all') return transactions;
    return transactions.filter(t => t.monthKey === selectedScope || (t.date && t.date.startsWith(selectedScope)));
  }, [transactions, selectedScope]);

  // Profil financier déterministe
  const financialProfile: FinancialProfile = useMemo(() => {
    return buildFinancialProfile(scopedTransactions, receipts, products, currency);
  }, [scopedTransactions, receipts, products, currency]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState<string>('Analyse des données...');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const activeModel = getGeminiModelName();

  // Suggestions de questions épurées
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

  // Gestion de la portée (mois ou all) pour la conversation active
  const handleScopeChange = (newScope: string) => {
    setConversations(prev => prev.map(c => {
      if (c.id === activeConversationId) {
        return { ...c, scope: newScope, updatedAt: Date.now() };
      }
      return c;
    }));
  };

  // Créer une nouvelle conversation
  const handleCreateNewConversation = () => {
    const newConv: SavedConversation = {
      id: `conv-${Date.now()}`,
      title: 'Nouvelle discussion',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
      scope: selectedScope
    };
    setConversations(prev => [newConv, ...prev]);
    setActiveConversationId(newConv.id);
    setIsHistoryOpen(false);
  };

  // Supprimer UNE conversation entière de l'historique
  const handleDeleteConversation = (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    if (conversations.length <= 1) {
      // S'il ne reste qu'une seule discussion, on la réinitialise
      const resetConv: SavedConversation = {
        id: `conv-${Date.now()}`,
        title: 'Nouvelle discussion',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [],
        scope: 'all'
      };
      setConversations([resetConv]);
      setActiveConversationId(resetConv.id);
      return;
    }

    const updated = conversations.filter(c => c.id !== convId);
    setConversations(updated);

    if (activeConversationId === convId) {
      setActiveConversationId(updated[0].id);
    }
  };

  // Supprimer UNE RÉPONSE / UN MESSAGE spécifique dans la conversation active
  const handleDeleteMessage = (messageId: string) => {
    setConversations(prev => prev.map(c => {
      if (c.id === activeConversationId) {
        const filtered = c.messages.filter(m => m.id !== messageId);
        return {
          ...c,
          messages: filtered,
          updatedAt: Date.now()
        };
      }
      return c;
    }));
  };

  // Envoyer un message
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

    // Mise à jour de la conversation active
    const newTitle = messages.length === 0 ? prompt.slice(0, 42) + (prompt.length > 42 ? '...' : '') : currentConversation.title;

    setConversations(prev => prev.map(c => {
      if (c.id === activeConversationId) {
        return {
          ...c,
          title: newTitle,
          messages: [...c.messages, userMessage],
          updatedAt: Date.now()
        };
      }
      return c;
    }));

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
        receipts,
        products,
        currency
      );

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: responseText,
        timestamp: new Date(),
        status: 'done'
      };

      setConversations(prev => prev.map(c => {
        if (c.id === activeConversationId) {
          return {
            ...c,
            messages: [...c.messages, assistantMessage],
            updatedAt: Date.now()
          };
        }
        return c;
      }));
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: `assistant-err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ **Une erreur est survenue lors de la communication avec l'IA.**\n\n${err?.message || 'Veuillez vérifier votre connexion ou votre clé API.'}`,
        timestamp: new Date(),
        status: 'error'
      };

      setConversations(prev => prev.map(c => {
        if (c.id === activeConversationId) {
          return {
            ...c,
            messages: [...c.messages, errorMessage],
            updatedAt: Date.now()
          };
        }
        return c;
      }));
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

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] bg-background text-foreground relative selection:bg-primary/20 selection:text-primary overflow-x-hidden">
      
      {/* 1. TOP BAR ÉPURÉE */}
      <div className="sticky top-0 z-20 backdrop-blur-xl bg-background/80 dark:bg-[#0a0d14]/75 border-b border-border/40 dark:border-white/[0.04] px-4 md:px-8 py-3 flex items-center justify-between">
        
        {/* Modèle & Base */}
        <div className="flex items-center gap-2.5">
          {/* Bouton d'accès à l'historique des discussions */}
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/60 dark:bg-white/[0.05] hover:bg-secondary dark:hover:bg-white/[0.09] border border-border/60 dark:border-white/[0.08] text-xs font-semibold text-foreground transition-all group"
            title="Ouvrir l'historique des conversations"
          >
            <History size={14} className="text-cyan-400 group-hover:scale-110 transition-transform" />
            <span>Historique ({conversations.length})</span>
          </button>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary/40 dark:bg-white/[0.03] border border-border/50 dark:border-white/[0.05] text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-foreground">{activeModel}</span>
          </div>

          <div className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground px-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>{scopedTransactions.length} transactions</span>
          </div>
        </div>

        {/* Portée & Nouvelle discussion */}
        <div className="flex items-center gap-2">
          {/* Sélecteur de portée */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/40 dark:bg-white/[0.03] border border-border/50 dark:border-white/[0.05] text-xs">
            <SlidersHorizontal size={12} className="text-muted-foreground" />
            <select
              value={selectedScope}
              onChange={(e) => handleScopeChange(e.target.value)}
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
          <button
            onClick={handleCreateNewConversation}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-cyan-500/10 to-primary/10 hover:from-cyan-500/20 hover:to-primary/20 border border-cyan-500/30 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-all shadow-sm"
            title="Créer une nouvelle discussion"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Nouvelle discussion</span>
          </button>
        </div>

      </div>

      {/* 2. DRAWER HISTORIQUE LATÉRAL ÉPURÉ (SLIDE-OVER) */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-200">
          {/* Backdrop sombre flouté */}
          <div 
            onClick={() => setIsHistoryOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
          />

          {/* Panneau latéral */}
          <div className="relative w-full max-w-sm md:max-w-md bg-[#0f131f]/95 dark:bg-[#0c101a]/95 border-l border-border/80 dark:border-white/[0.08] backdrop-blur-2xl h-full shadow-2xl flex flex-col justify-between z-10 animate-in slide-in-from-right duration-300">
            
            {/* Header du Drawer */}
            <div className="p-4 md:p-5 border-b border-border/60 dark:border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History size={18} className="text-cyan-400" />
                <h3 className="text-sm font-bold text-foreground">Historique des discussions</h3>
              </div>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="w-8 h-8 rounded-full bg-secondary/50 dark:bg-white/[0.05] hover:bg-secondary dark:hover:bg-white/[0.1] text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Liste des conversations */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              <button
                onClick={handleCreateNewConversation}
                className="w-full p-3 rounded-2xl border border-dashed border-cyan-500/40 hover:border-cyan-500/80 bg-cyan-500/[0.04] hover:bg-cyan-500/[0.08] text-cyan-400 text-xs font-semibold flex items-center justify-center gap-2 transition-all mb-3"
              >
                <Plus size={15} />
                Nouvelle discussion
              </button>

              {conversations.map((conv) => {
                const isActive = conv.id === activeConversationId;
                const dateStr = new Date(conv.updatedAt).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit'
                });

                return (
                  <div
                    key={conv.id}
                    onClick={() => {
                      setActiveConversationId(conv.id);
                      setIsHistoryOpen(false);
                    }}
                    className={`group w-full p-3 rounded-2xl text-left border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isActive
                        ? 'bg-cyan-500/[0.12] border-cyan-500/40 text-foreground shadow-sm'
                        : 'bg-secondary/30 dark:bg-white/[0.02] hover:bg-secondary/60 dark:hover:bg-white/[0.05] border-border/50 dark:border-white/[0.05] text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <MessageSquare size={13} className={isActive ? 'text-cyan-400 shrink-0' : 'text-muted-foreground/60 shrink-0'} />
                        <h4 className="text-xs font-semibold truncate text-foreground">
                          {conv.title || 'Discussion sans titre'}
                        </h4>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground/80 mt-1 pl-5">
                        <span>{dateStr}</span>
                        <span>•</span>
                        <span>{conv.messages.length} messages</span>
                      </div>
                    </div>

                    {/* Bouton de suppression d'UNE conversation */}
                    <button
                      onClick={(e) => handleDeleteConversation(e, conv.id)}
                      className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-rose-400 hover:bg-rose-500/10 transition-colors opacity-70 group-hover:opacity-100"
                      title="Supprimer cette conversation"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Footer du Drawer */}
            <div className="p-4 border-t border-border/60 dark:border-white/[0.06] text-center">
              <span className="text-[11px] text-muted-foreground">
                Toutes vos discussions sont sauvegardées localement.
              </span>
            </div>

          </div>
        </div>
      )}

      {/* 3. ZONE CENTRALE (STREAMING GEMINI) */}
      <div className="flex-1 flex flex-col justify-between max-w-4xl w-full mx-auto px-4 md:px-6">
        
        {/* ÉTAT 1 : AUCUN MESSAGE DANS LA DISCUSSION */}
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 md:py-20 space-y-8 animate-in fade-in duration-500">
            
            {/* Titre Principal */}
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

            {/* Boîte de Saisie Centrale */}
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
          
          /* ÉTAT 2 : DISCUSSION ACTIVE */
          <div className="flex-1 flex flex-col py-6 space-y-6">
            
            {/* Flux des messages */}
            <div className="space-y-6 pb-36">
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3.5 group ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in duration-300`}
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

                      {/* Barre d'action sous le message : Copier + SUPPRIMER CE MESSAGE */}
                      <div className={`flex items-center gap-3 pt-1 text-xs text-muted-foreground px-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
                        {/* Bouton Copier */}
                        {!isUser && (
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
                        )}

                        {/* Bouton SUPPRIMER CETTE RÉPONSE / CE MESSAGE */}
                        <button
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="hover:text-rose-400 flex items-center gap-1 transition-colors text-[11px] opacity-40 hover:opacity-100 group-hover:opacity-75"
                          title="Supprimer ce message de la discussion"
                        >
                          <Trash2 size={12} />
                          <span>Supprimer</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Indicateur de chargement */}
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

            {/* Zone de Saisie Flottante Pinned en Bas */}
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
