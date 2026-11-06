import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MarkdownRenderer, highlightSearchMatch } from '../../components/ui/MarkdownRenderer';
import { useCoach, type SavedConversation } from '../../context/CoachContext';
import { type ProposedAdminAction } from '../../lib/coachFinancialEngine';
import { DEFAULT_COST_OF_LIVING_ITEMS, type CustomUserRule } from '../../lib/kpiUtils';
import { 
  findSearchMatches, 
  getNextMatchIndex, 
  getPrevMatchIndex, 
  filterConversations 
} from '../../lib/conversationSearchUtils';
import { 
  Sparkles, 
  ArrowUp,
  Mic,
  MicOff,
  Copy, 
  Check, 
  Plus, 
  History,
  Trash2,
  X,
  MessageSquare,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  RotateCcw,
  BookmarkCheck,
  Edit3,
  ArrowRight,
  Layers,
  Search,
  ChevronUp,
  ChevronDown,
  ShoppingBag,
  PieChart,
  Repeat,
  TrendingUp
} from 'lucide-react';

export type { SavedConversation };

const AVAILABLE_CATEGORIES = [
  'Abonnements & Télécom',
  'Alimentation & Courses',
  'Restaurants & Sorties',
  'Logement & Énergie',
  'Assurances',
  'Santé',
  'Transports & Carburant',
  'Loisirs & Activités',
  'Shopping & Maison',
  'Frais bancaires',
  'Épargne & Investissement',
  'Virements Internes',
  'Solidarité',
  'Salaire & Revenus',
  'Autre'
];

export default function Coach() {
  const {
    conversations,
    activeConversationId,
    messages,
    isLoading,
    loadingStep,
    inputPrompt,
    setInputPrompt,
    setActiveConversationId,
    handleCreateNewConversation,
    handleDeleteConversation,
    handleDeleteMessage,
    sendMessage,
    confirmProposedAction,
    rejectProposedAction,
    undoProposedAction,
    customRules,
    addCustomRule,
    updateCustomRule,
    deleteCustomRule
  } = useCoach();

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);

  // Loupe & Moteur de recherche live dans la discussion (Apple VisionOS)
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // État du formulaire "Mes Règles & Abonnements"
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [rulePattern, setRulePattern] = useState('');
  const [ruleExactAmount, setRuleExactAmount] = useState('');
  const [ruleCustomLabel, setRuleCustomLabel] = useState('');
  const [ruleCategory, setRuleCategory] = useState('Abonnements & Télécom');
  const [ruleBudgetPost, setRuleBudgetPost] = useState('Streaming, Cloud & Services');
  const [ruleNote, setRuleNote] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Initialisation de la reconnaissance vocale Web Speech API
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'fr-FR';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputPrompt((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, [setInputPrompt]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("La reconnaissance vocale n'est pas supportée par votre navigateur (essayez Chrome ou Safari).");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.warn('Speech recognition error', err);
        setIsListening(false);
      }
    }
  };

  // Liste de toutes les occurrences du terme recherché dans les messages de la conversation active
  const searchMatches = useMemo(() => {
    return findSearchMatches(messages, searchQuery);
  }, [messages, searchQuery]);

  const scrollToMessage = (messageId: string) => {
    if (!messageId) return;
    const el = document.getElementById(`coach-msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleNextMatch = () => {
    if (searchMatches.length === 0) return;
    const next = getNextMatchIndex(currentMatchIndex, searchMatches.length);
    setCurrentMatchIndex(next);
    scrollToMessage(searchMatches[next].messageId);
  };

  const handlePrevMatch = () => {
    if (searchMatches.length === 0) return;
    const prev = getPrevMatchIndex(currentMatchIndex, searchMatches.length);
    setCurrentMatchIndex(prev);
    scrollToMessage(searchMatches[prev].messageId);
  };

  // Dès que le terme recherché change, pointer sur la première occurrence et faire défiler l'écran
  useEffect(() => {
    setCurrentMatchIndex(0);
    if (searchMatches.length > 0) {
      scrollToMessage(searchMatches[0].messageId);
    }
  }, [searchQuery]);

  // Raccourci clavier universel : Ctrl+F / Cmd+F ouvre la loupe de recherche, Échap la ferme
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsSearchOpen(true);
        setTimeout(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        }, 80);
      } else if (e.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false);
        setSearchQuery('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen]);

  const validConversations = conversations.filter(c => c.messages && c.messages.length > 0);

  const filteredConversations = useMemo(() => {
    return filterConversations(validConversations, historySearchQuery);
  }, [validConversations, historySearchQuery]);

  // Suggestions Pleine Largeur Inspirées de Google Gemini & Stitch
  const geminiSuggestions = [
    {
      icon: ShoppingBag,
      iconColor: 'text-sky-400',
      bgGlow: 'bg-sky-500/10 border-sky-400/20 group-hover:border-sky-400/50 group-hover:bg-sky-500/20',
      title: "Audit courses & alimentation",
      description: "Compare le coût de vos produits frais, courses et enseignes les moins chères",
      prompt: "À combien j'achète mes fruits et courses ? Donne-moi la synthèse directe et le tableau comparatif des magasins."
    },
    {
      icon: PieChart,
      iconColor: 'text-emerald-400',
      bgGlow: 'bg-emerald-500/10 border-emerald-400/20 group-hover:border-emerald-400/50 group-hover:bg-emerald-500/20',
      title: "Règle budgétaire 50/30/20",
      description: "Évalue la répartition besoins, envies et épargne sur vos revenus réels",
      prompt: "Donne-moi des conseils sur la répartition de mes dépenses selon la règle 50/30/20 en te basant sur mes chiffres réels."
    },
    {
      icon: Repeat,
      iconColor: 'text-violet-400',
      bgGlow: 'bg-violet-500/10 border-violet-400/20 group-hover:border-violet-400/50 group-hover:bg-violet-500/20',
      title: "Détection des abonnements",
      description: "Isole vos prélèvements récurrents et repère les doublons ou hausses de tarif",
      prompt: "Quels sont mes abonnements et prélèvements récurrents ? Détecte les anomalies ou doublons potentiels."
    },
    {
      icon: TrendingUp,
      iconColor: 'text-amber-400',
      bgGlow: 'bg-amber-500/10 border-amber-400/20 group-hover:border-amber-400/50 group-hover:bg-amber-500/20',
      title: "Projection de fin de mois",
      description: "Estime votre reste à vivre et votre solde le 30 selon votre rythme de dépense",
      prompt: "Selon mon rythme actuel de dépenses, quelle est ma projection budgétaire et mon solde estimé de fin de mois ?"
    }
  ];

  const onSend = async (textToSend?: string) => {
    await sendMessage(textToSend);
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const resetRuleForm = () => {
    setEditingRuleId(null);
    setRulePattern('');
    setRuleExactAmount('');
    setRuleCustomLabel('');
    setRuleCategory('Abonnements & Télécom');
    setRuleBudgetPost('Streaming, Cloud & Services');
    setRuleNote('');
  };

  const handleStartEditRule = (rule: CustomUserRule) => {
    setEditingRuleId(rule.id);
    setRulePattern(rule.pattern);
    setRuleExactAmount(rule.exactAmount !== undefined ? String(rule.exactAmount) : '');
    setRuleCustomLabel(rule.customLabel);
    setRuleCategory(rule.category);
    setRuleBudgetPost(rule.budgetPostName || 'Streaming, Cloud & Services');
    setRuleNote(rule.customNote || '');
  };

  const handleSaveRuleForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rulePattern.trim() || !ruleCustomLabel.trim()) return;

    const parsedAmt = ruleExactAmount.trim() ? parseFloat(ruleExactAmount.replace(',', '.')) : undefined;

    if (editingRuleId) {
      await updateCustomRule(editingRuleId, {
        pattern: rulePattern.trim(),
        exactAmount: parsedAmt && !isNaN(parsedAmt) ? parsedAmt : undefined,
        customLabel: ruleCustomLabel.trim(),
        category: ruleCategory,
        budgetPostName: ruleBudgetPost,
        customNote: ruleNote.trim() || undefined
      });
    } else {
      await addCustomRule({
        pattern: rulePattern.trim(),
        exactAmount: parsedAmt && !isNaN(parsedAmt) ? parsedAmt : undefined,
        customLabel: ruleCustomLabel.trim(),
        category: ruleCategory,
        budgetPostName: ruleBudgetPost,
        isSubscription: ruleCategory.includes('Abonnement'),
        customNote: ruleNote.trim() || undefined
      });
    }
    resetRuleForm();
  };

  /**
   * Rendu d'une Carte de Confirmation Administrateur Interactive Apple VisionOS
   */
  const renderValidationCard = (messageId: string, action: ProposedAdminAction) => {
    const oldEntries = Object.entries(action.oldValues || {});
    const newEntries = Object.entries(action.newValues || {});

    return (
      <div className="mt-4 rounded-3xl apple-glass-card p-4 sm:p-5 border-sky-400/30 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {/* Header de la carte */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl apple-glass flex items-center justify-center text-sky-400 border border-sky-400/30 shrink-0">
              <ShieldAlert size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30">
                  Validation Humaine Requise
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-slate-300">
                  {action.targetType}
                </span>
              </div>
              <h4 className="text-sm font-bold text-white mt-1">
                {action.title}
              </h4>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                {action.description}
              </p>
            </div>
          </div>
        </div>

        {/* Grille comparative Avant / Après */}
        {(oldEntries.length > 0 || newEntries.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3.5 rounded-2xl bg-rose-500/[0.08] border border-rose-500/25 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-300 block">
                Avant modification
              </span>
              {oldEntries.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-xs gap-2">
                  <span className="text-slate-400 truncate">{k} :</span>
                  <span className="font-mono font-semibold text-white">{String(v)}</span>
                </div>
              ))}
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-500/[0.1] border border-emerald-500/30 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1">
                <ArrowRight size={11} /> Après validation
              </span>
              {newEntries.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-xs gap-2">
                  <span className="text-slate-400 truncate">{k} :</span>
                  <span className="font-mono font-bold text-emerald-300">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Boutons d'action selon le statut */}
        <div className="pt-2 border-t border-white/10 flex items-center justify-between flex-wrap gap-3">
          {action.status === 'pending' && (
            <>
              <span className="text-[11px] text-slate-400">
                Aucune donnée n'est modifiée sans votre clic :
              </span>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => confirmProposedAction(messageId)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer active:scale-95"
                >
                  <CheckCircle2 size={15} />
                  <span>Valider</span>
                </button>
                <button
                  type="button"
                  onClick={() => rejectProposedAction(messageId)}
                  className="px-4 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                >
                  <XCircle size={15} />
                  <span>Annuler</span>
                </button>
              </div>
            </>
          )}

          {action.status === 'validated' && (
            <div className="w-full flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                <CheckCircle2 size={16} />
                <span>Changement validé et synchronisé sur tous vos onglets !</span>
              </div>
              <button
                type="button"
                onClick={() => undoProposedAction(messageId)}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <RotateCcw size={13} />
                <span>Annuler l'action</span>
              </button>
            </div>
          )}

          {action.status === 'cancelled' && (
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <XCircle size={15} className="text-rose-400" />
              <span>Action annulée — Vos données sont restées intactes.</span>
            </div>
          )}

          {action.status === 'undone' && (
            <div className="flex items-center gap-2 text-xs font-semibold text-sky-400">
              <RotateCcw size={15} />
              <span>Action annulée — L'état précédent a été intégralement restauré.</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#070913] bg-[radial-gradient(ellipse_75%_55%_at_50%_35%,rgba(18,48,88,0.30),rgba(7,9,19,0)_80%)] text-white relative selection:bg-sky-500/30 selection:text-white overflow-hidden">
      
      {/* 1. TOP BAR ÉPURÉE STYLE GOOGLE GEMINI & APPLE GLASS */}
      <div className="shrink-0 z-30 px-3 sm:px-6 lg:px-8 py-2 sm:py-2.5 w-full">
        <div className="apple-glass rounded-full px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 max-w-6xl xl:max-w-7xl mx-auto shadow-2xl border border-white/15 bg-[#0b0f1e]/85 backdrop-blur-2xl">
          
          {/* Gauche: Historique & Mes Règles & Abonnements */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Bouton Historique */}
            <button
              onClick={() => setIsHistoryOpen(true)}
              className="apple-glass-pill hover:bg-white/15 px-3.5 py-1.5 rounded-full text-xs font-semibold text-white/90 flex items-center gap-1.5 transition-all group cursor-pointer"
              title="Ouvrir l'historique des discussions"
            >
              <History size={14} className="text-sky-400 group-hover:rotate-12 transition-transform shrink-0" />
              <span>Historique</span>
            </button>

            {/* Bouton Mes Règles & Abonnements épuré avec infobulle claire */}
            <div className="relative group/tooltip">
              <button
                onClick={() => setIsRulesOpen(true)}
                className="apple-glass-pill hover:bg-white/15 px-3.5 py-1.5 rounded-full text-xs font-semibold text-emerald-400 border-emerald-500/30 flex items-center gap-1.5 transition-all group cursor-pointer"
              >
                <BookmarkCheck size={14} className="group-hover:scale-110 transition-transform shrink-0" />
                <span className="hidden sm:inline">Règles & Abonnements</span>
                <span className="sm:hidden">Règles</span>
                {customRules.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                    {customRules.length}
                  </span>
                )}
              </button>

              {/* Infobulle explicative sur hover */}
              <div className="absolute left-0 sm:left-1/2 sm:-translate-x-1/2 top-full mt-2 hidden group-hover/tooltip:flex flex-col items-center z-50 pointer-events-none w-64 animate-in fade-in zoom-in-95 duration-150">
                <div className="w-2.5 h-2.5 bg-[#141724] border-t border-l border-white/20 rotate-45 -mb-1.5 hidden sm:block" />
                <div className="rounded-xl bg-[#141724]/95 backdrop-blur-xl border border-white/20 p-2.5 shadow-2xl text-[11px] text-slate-200 text-center leading-relaxed">
                  <span className="font-semibold text-emerald-400 block mb-0.5">Classification automatique</span>
                  Associez vos prélèvements récurrents (loyer, Netflix, courses...) pour que le Coach les classe automatiquement.
                </div>
              </div>
            </div>
          </div>

          {/* Droite: Loupe de recherche + Nouvelle Discussion */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => {
                setIsSearchOpen((prev) => {
                  const next = !prev;
                  if (next) {
                    setTimeout(() => searchInputRef.current?.focus(), 80);
                  } else {
                    setSearchQuery('');
                  }
                  return next;
                });
              }}
              className={`apple-glass-pill px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all group cursor-pointer ${
                isSearchOpen
                  ? 'bg-sky-500/25 text-sky-300 border border-sky-400/50 shadow-[0_0_12px_rgba(56,189,248,0.35)]'
                  : 'hover:bg-white/15 text-white/90'
              }`}
              title="Rechercher des mots dans la discussion (Ctrl+F)"
            >
              <Search size={14} className="text-sky-400 group-hover:scale-110 transition-transform shrink-0" />
              <span className="hidden sm:inline">Recherche</span>
            </button>

            <button
              onClick={() => {
                handleCreateNewConversation();
                setIsHistoryOpen(false);
                setIsSearchOpen(false);
                setSearchQuery('');
              }}
              className="px-4 py-1.5 rounded-full bg-gradient-to-r from-sky-400 to-blue-600 hover:from-sky-300 hover:to-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-sky-500/25 active:scale-95 transition-all cursor-pointer shrink-0"
              title="Créer une nouvelle discussion"
            >
              <Plus size={14} className="shrink-0" />
              <span>Nouvelle Discussion</span>
            </button>
          </div>
        </div>

        {/* Barre de Recherche Live Apple Liquid Glass */}
        {isSearchOpen && (
          <div className="pt-2 max-w-4xl xl:max-w-5xl mx-auto animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="apple-glass rounded-2xl px-4 py-2.5 flex items-center gap-2.5 shadow-2xl border border-sky-400/40 bg-[#080a14]/90 backdrop-blur-2xl">
              <Search size={15} className="text-sky-400 shrink-0 ml-0.5" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (e.shiftKey) {
                      handlePrevMatch();
                    } else {
                      handleNextMatch();
                    }
                  } else if (e.key === 'Escape') {
                    setIsSearchOpen(false);
                    setSearchQuery('');
                  }
                }}
                placeholder="Rechercher un mot, un montant ou un commerce..."
                className="flex-1 bg-transparent border-none text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-0 font-light"
              />

              {searchQuery.trim() && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {searchMatches.length > 0 ? (
                    <span className="text-[10px] sm:text-[11px] font-mono font-bold text-sky-300 bg-sky-500/20 border border-sky-400/40 px-2 py-0.5 rounded-full">
                      {currentMatchIndex + 1} / {searchMatches.length}
                    </span>
                  ) : (
                    <span className="text-[10px] sm:text-[11px] font-medium text-rose-300 bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded-full">
                      0 résultat
                    </span>
                  )}
                </div>
              )}

              {searchMatches.length > 0 && (
                <div className="flex items-center gap-0.5 shrink-0 border-l border-white/15 pl-1.5 sm:pl-2">
                  <button
                    type="button"
                    onClick={handlePrevMatch}
                    className="p-1 rounded-lg hover:bg-white/15 text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title="Occurrence précédente (Maj+Entrée)"
                  >
                    <ChevronUp size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMatch}
                    className="p-1 rounded-lg hover:bg-white/15 text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title="Occurrence suivante (Entrée)"
                  >
                    <ChevronDown size={15} />
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsSearchOpen(false);
                  setSearchQuery('');
                }}
                className="w-6 h-6 rounded-full hover:bg-white/15 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-0.5"
                title="Fermer la recherche (Échap)"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. DRAWER HISTORIQUE LATÉRAL APPLE GLASS */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-200">
          <div 
            onClick={() => setIsHistoryOpen(false)}
            className="absolute inset-0 bg-[#070a14]/80 backdrop-blur-xl cursor-pointer"
          />

          <div className="relative w-full max-w-sm md:max-w-md apple-glass bg-[#0b0f1e]/95 border-l border-white/20 h-full shadow-2xl flex flex-col justify-between z-10 animate-in slide-in-from-right duration-300">
            <div className="p-4 md:p-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History size={18} className="text-sky-400" />
                <h3 className="text-sm font-bold text-white">Historique des discussions</h3>
              </div>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="w-8 h-8 rounded-full apple-glass-pill hover:bg-white/15 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              <button
                onClick={() => {
                  handleCreateNewConversation();
                  setIsHistoryOpen(false);
                }}
                className="w-full p-3 rounded-2xl border border-dashed border-sky-400/40 hover:border-sky-400 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all mb-2 cursor-pointer"
              >
                <Plus size={15} />
                Nouvelle discussion
              </button>

              {/* Filtre de recherche dans l'historique */}
              {validConversations.length > 0 && (
                <div className="apple-glass rounded-xl px-3 py-1.5 flex items-center gap-2 mb-2 border border-white/10 focus-within:border-sky-400/50 transition-colors">
                  <Search size={13} className="text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    placeholder="Filtrer l'historique par mot-clé..."
                    className="w-full bg-transparent border-none text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-0"
                  />
                  {historySearchQuery && (
                    <button
                      onClick={() => setHistorySearchQuery('')}
                      className="text-slate-400 hover:text-white shrink-0 p-0.5 cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              )}

              {validConversations.length === 0 ? (
                <div className="py-14 px-4 text-center flex flex-col items-center justify-center space-y-3 animate-in fade-in duration-300">
                  <div className="w-12 h-12 rounded-2xl apple-glass flex items-center justify-center text-slate-500">
                    <MessageSquare size={20} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-200">Aucune discussion archivée</p>
                    <p className="text-[11px] text-slate-400 max-w-[220px] mx-auto leading-relaxed">
                      Vos échanges avec le Coach IA apparaîtront ici automatiquement dès votre première question.
                    </p>
                  </div>
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="py-8 px-4 text-center flex flex-col items-center justify-center space-y-2 animate-in fade-in duration-200">
                  <p className="text-xs font-semibold text-slate-300">Aucun résultat trouvé</p>
                  <p className="text-[11px] text-slate-400">
                    Aucune discussion ne contient « {historySearchQuery} ».
                  </p>
                </div>
              ) : (
                filteredConversations.map((conv) => {
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
                          ? 'apple-glass-active text-white border-sky-400/50 shadow-lg'
                          : 'apple-glass-pill hover:bg-white/10 text-slate-300 hover:text-white'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <MessageSquare size={13} className={isActive ? 'text-sky-400 shrink-0' : 'text-slate-400 shrink-0'} />
                          <h4 className="text-xs font-semibold truncate text-white">
                            {conv.title || 'Discussion sans titre'}
                          </h4>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1 pl-5">
                          <span>{dateStr}</span>
                          <span>•</span>
                          <span>{conv.messages.length} message{conv.messages.length > 1 ? 's' : ''}</span>
                        </div>
                      </div>

                      <button
                        onClick={(e) => handleDeleteConversation(e, conv.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 transition-colors opacity-70 group-hover:opacity-100 cursor-pointer"
                        title="Supprimer cette discussion de l'historique"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 border-t border-white/10 text-center">
              <span className="text-[11px] text-slate-400">
                Vos discussions continuent de charger même si vous changez d'onglet.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 2B. DRAWER MODULE "MES RÈGLES & ABONNEMENTS" APPLE GLASS */}
      {isRulesOpen && (
        <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-200">
          <div
            onClick={() => setIsRulesOpen(false)}
            className="absolute inset-0 bg-[#070a14]/80 backdrop-blur-xl cursor-pointer"
          />

          <div className="relative w-full max-w-lg apple-glass bg-[#0b0f1e]/95 border-l border-white/20 h-full shadow-2xl flex flex-col justify-between z-10 animate-in slide-in-from-right duration-300">
            <div className="p-4 md:p-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl apple-glass text-emerald-400 border border-emerald-400/30 flex items-center justify-center">
                  <BookmarkCheck size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Mes Règles & Abonnements</h3>
                  <p className="text-[11px] text-emerald-300/90 font-light">
                    Apprenez à l'IA à reconnaître vos abonnements récurrents (ex : Netflix, Loyer, Salle de sport) pour les classer automatiquement.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsRulesOpen(false)}
                className="w-8 h-8 rounded-full apple-glass-pill hover:bg-white/15 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Formulaire d'ajout ou d'édition de règle */}
              <form onSubmit={handleSaveRuleForm} className="p-4 rounded-3xl apple-glass-card border-white/15 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers size={13} />
                    {editingRuleId ? 'Modifier la règle' : 'Ajouter une règle / préciser un abonnement'}
                  </span>
                  {editingRuleId && (
                    <button
                      type="button"
                      onClick={resetRuleForm}
                      className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
                    >
                      Annuler l'édition
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] text-slate-300 block mb-1">
                      Mot-clé du libellé bancaire *
                    </label>
                    <input
                      type="text"
                      value={rulePattern}
                      onChange={e => setRulePattern(e.target.value)}
                      placeholder="Ex: GOOGLE, SOBRIO, ALMA..."
                      required
                      className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-300 block mb-1">
                      Montant exact optionnel (€)
                    </label>
                    <input
                      type="text"
                      value={ruleExactAmount}
                      onChange={e => setRuleExactAmount(e.target.value)}
                      placeholder="Ex: 2.99"
                      className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-slate-300 block mb-1">
                    Nom explicite à afficher *
                  </label>
                  <input
                    type="text"
                    value={ruleCustomLabel}
                    onChange={e => setRuleCustomLabel(e.target.value)}
                    placeholder="Ex: Google One (Stockage Cloud 100 Go)"
                    required
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] text-slate-300 block mb-1">
                      Catégorie CashPilot
                    </label>
                    <select
                      value={ruleCategory}
                      onChange={e => setRuleCategory(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#0e1220] border border-white/15 text-xs text-white focus:outline-none focus:border-emerald-400"
                    >
                      {AVAILABLE_CATEGORIES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-300 block mb-1">
                      Poste "Budget & Coût de la vie"
                    </label>
                    <select
                      value={ruleBudgetPost}
                      onChange={e => setRuleBudgetPost(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#0e1220] border border-white/15 text-xs text-white focus:outline-none focus:border-emerald-400"
                    >
                      {DEFAULT_COST_OF_LIVING_ITEMS.map(item => (
                        <option key={item.id} value={item.name}>{item.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-bold transition-all cursor-pointer shadow-lg shadow-emerald-500/20 active:scale-95"
                >
                  {editingRuleId ? 'Enregistrer les modifications' : '+ Créer cette règle personnalisée'}
                </button>
              </form>

              {/* Liste des règles existantes */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
                  Règles actives ({customRules.length})
                </h4>

                {customRules.length === 0 ? (
                  <div className="p-6 rounded-3xl apple-glass-card text-center space-y-1.5 border-dashed border-white/20">
                    <p className="text-xs font-semibold text-white">Aucune règle personnalisée</p>
                    <p className="text-[11px] text-slate-400">
                      Dites au Coach IA dans le chat « Le prélèvement Google de 2,99 € correspond à Google One » ou créez une règle ci-dessus.
                    </p>
                  </div>
                ) : (
                  customRules.map(rule => (
                    <div
                      key={rule.id}
                      className="p-3.5 rounded-2xl apple-glass-card border-white/15 flex items-start justify-between gap-3 group"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-white">{rule.customLabel}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-400/30">
                            Mot-clé : {rule.pattern}
                          </span>
                          {rule.exactAmount !== undefined && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-400/30">
                              {Number(rule.exactAmount).toFixed(2)} €
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-300 flex-wrap">
                          <span>Catégorie : <strong className="text-white">{rule.category}</strong></span>
                          {rule.budgetPostName && (
                            <>
                              <span>•</span>
                              <span>Budget : <strong className="text-emerald-300">{rule.budgetPostName}</strong></span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleStartEditRule(rule)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-sky-300 hover:bg-white/10 transition-colors cursor-pointer"
                          title="Modifier cette règle"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => deleteCustomRule(rule.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer"
                          title="Archiver cette règle"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. ZONE CENTRALE EXPANDED & AIRY (INSPIRÉE DE GOOGLE GEMINI) */}
      <div className="flex-1 overflow-y-auto w-full min-h-0 px-4 sm:px-6 lg:px-8 flex flex-col">
        
        {messages.length === 0 ? (
          /* ÉCRAN D'ACCUEIL PLEINE LARGEUR INSPIRÉ DE GOOGLE GEMINI */
          <div className="flex-1 flex flex-col justify-center py-4 sm:py-6 lg:py-8 w-full max-w-5xl xl:max-w-6xl mx-auto space-y-4 sm:space-y-6 animate-in fade-in duration-300">
            
            {/* Header d'Accueil Inspiré de Google Gemini */}
            <div className="space-y-2.5 sm:space-y-3.5 max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-sky-500/15 via-indigo-500/15 to-purple-500/15 border border-sky-400/25 shadow-[0_0_15px_rgba(56,189,248,0.2)]">
                <Sparkles size={14} className="text-sky-400 animate-pulse" />
                <span className="text-xs font-semibold bg-gradient-to-r from-sky-300 via-indigo-200 to-rose-200 bg-clip-text text-transparent">
                  Copilote Financier IA • CashPilot Intelligence
                </span>
              </div>

              <h1 className="text-2xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-white leading-tight">
                <span className="bg-gradient-to-r from-sky-400 via-indigo-300 to-rose-300 bg-clip-text text-transparent font-semibold">
                  Bonjour,
                </span>
                <br />
                <span className="font-normal text-slate-100">
                  Par quoi voulez-vous commencer ?
                </span>
              </h1>

              <p className="text-xs sm:text-sm md:text-base text-slate-400 font-light leading-relaxed max-w-2xl">
                Auditez vos tickets de caisse, pilotez vos flux bancaires et optimisez vos abonnements en langage naturel.
              </p>
            </div>

            {/* Grille des 4 Cartes de Suggestions Pleine Largeur Google Gemini */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full">
              {geminiSuggestions.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onSend(item.prompt)}
                    className="group relative p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-[#121422]/85 hover:bg-[#181c2f]/95 border border-white/10 hover:border-sky-400/40 shadow-md hover:shadow-[0_12px_28px_-6px_rgba(56,189,248,0.22)] transition-all duration-200 text-left flex flex-col justify-between min-h-[110px] sm:min-h-[125px] active:scale-[0.98] cursor-pointer"
                  >
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-white group-hover:text-sky-300 transition-colors">
                        {item.title}
                      </h3>
                      <p className="text-xs text-slate-400 font-light leading-relaxed line-clamp-2">
                        {item.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-3 mt-auto">
                      <span className="text-[11px] font-semibold text-slate-500 group-hover:text-sky-400 transition-colors flex items-center gap-1">
                        Lancer l'audit
                        <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
                      </span>
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all duration-200 ${item.bgGlow} ${item.iconColor} group-hover:scale-110 shadow-sm`}>
                        <Icon size={16} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

          </div>
        ) : (
          /* VUE CONVERSATION AÉRÉE ET ÉLARGIE STYLE GOOGLE GEMINI */
          <div className="flex-1 flex flex-col py-4 sm:py-6 space-y-6 w-full max-w-4xl xl:max-w-5xl mx-auto">
            <div className="space-y-6 pb-6 w-full">
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                const isCurrentTargetMsg = isSearchOpen && searchMatches[currentMatchIndex]?.messageId === msg.id;

                if (isUser) {
                  return (
                    <div
                      key={msg.id}
                      id={`coach-msg-${msg.id}`}
                      className={`flex justify-end animate-in fade-in duration-300 transition-all ${
                        isCurrentTargetMsg ? 'ring-2 ring-sky-400/90 shadow-[0_0_25px_rgba(56,189,248,0.45)] rounded-[28px]' : ''
                      }`}
                    >
                      <div className="max-w-2xl sm:max-w-3xl lg:max-w-4xl space-y-1.5">
                        <div className="px-5 sm:px-6 py-3.5 sm:py-4 rounded-[24px] bg-[#282a2c]/90 hover:bg-[#282a2c] border border-white/10 text-white shadow-lg text-[15px] sm:text-base leading-relaxed">
                          <p className="whitespace-pre-wrap">{highlightSearchMatch(msg.content, searchQuery)}</p>
                        </div>
                        <div className="flex items-center justify-end gap-2 text-xs text-slate-400 pr-2">
                          <button
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="hover:text-rose-400 flex items-center gap-1 transition-colors text-[11px] opacity-40 hover:opacity-100 cursor-pointer"
                            title="Supprimer ce message"
                          >
                            <Trash2 size={12} />
                            <span>Supprimer</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                // Assistant (Coach IA Gemini Style)
                return (
                  <div
                    key={msg.id}
                    id={`coach-msg-${msg.id}`}
                    className={`flex items-start gap-3.5 sm:gap-4.5 animate-in fade-in duration-300 transition-all w-full ${
                      isCurrentTargetMsg ? 'ring-2 ring-sky-400/90 shadow-[0_0_25px_rgba(56,189,248,0.45)] rounded-[32px] p-1.5' : ''
                    }`}
                  >
                    {/* Avatar Gemini Star Luminescent */}
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-sky-500/25 via-indigo-500/20 to-purple-500/25 border border-sky-400/30 flex items-center justify-center text-sky-400 shrink-0 mt-1 shadow-[0_0_20px_rgba(56,189,248,0.3)]">
                      <Sparkles size={18} />
                    </div>

                    <div className="flex-1 min-w-0 space-y-2.5">
                      <div className="p-5 sm:p-7 rounded-[26px] bg-[#141724]/75 backdrop-blur-2xl border border-white/10 text-slate-100 shadow-xl space-y-4">
                        <MarkdownRenderer content={msg.content} searchQuery={searchQuery} />
                        {msg.proposedAction && renderValidationCard(msg.id, msg.proposedAction)}
                      </div>

                      {/* Barre d'outils et métadonnées sous le message Gemini */}
                      <div className="flex items-center justify-between px-2 text-xs text-slate-400">
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                          <span>Coach IA</span>
                          <span>•</span>
                          <span className="text-sky-400/80">Gemini Intelligence</span>
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleCopyMessage(msg.id, msg.content)}
                            className="hover:text-white flex items-center gap-1.5 transition-colors text-[11px] cursor-pointer"
                            title="Copier la réponse"
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check size={13} className="text-emerald-400" />
                                <span className="text-emerald-400 font-medium">Copié !</span>
                              </>
                            ) : (
                              <>
                                <Copy size={13} />
                                <span>Copier</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="hover:text-rose-400 flex items-center gap-1 transition-colors text-[11px] opacity-40 hover:opacity-100 cursor-pointer"
                            title="Supprimer cette réponse"
                          >
                            <Trash2 size={13} />
                            <span>Supprimer</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Indicateur de chargement épuré Liquid Glass */}
              {isLoading && (
                <div className="flex items-start gap-3.5 sm:gap-4.5 animate-in fade-in duration-300 w-full">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-sky-500/25 via-indigo-500/20 to-purple-500/25 border border-sky-400/30 flex items-center justify-center text-sky-400 shrink-0 mt-1 shadow-[0_0_20px_rgba(56,189,248,0.3)]">
                    <Sparkles size={18} className="animate-spin text-sky-400" />
                  </div>
                  <div className="space-y-2 py-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-sky-300">
                      <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-ping" />
                      <span>{loadingStep}</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Vous pouvez naviguer librement vers les autres onglets : l'analyse continue en arrière-plan.
                    </p>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>
        )}
      </div>

      {/* 4. BARRE DE SAISIE PROMPT GEMINI (FLEX SIBLING NON-FIXED) */}
      <div className="shrink-0 z-30 w-full px-4 sm:px-6 lg:px-8 pt-2 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] bg-gradient-to-t from-[#070913] via-[#070913]/95 to-transparent">
        <div className="max-w-4xl xl:max-w-5xl mx-auto space-y-2">
          
          {/* Pilules d'audit rapide épurées horizontales (UNIQUEMENT EN MODE DISCUSSION) */}
          {messages.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs touch-pan-x px-1 animate-in fade-in duration-200">
              <span className="text-slate-400 text-xs font-semibold shrink-0 flex items-center gap-1.5 pr-1">
                <Sparkles size={12} className="text-sky-400" /> Suggestions :
              </span>
              {geminiSuggestions.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSend(item.prompt)}
                  className="px-3 py-1 rounded-full bg-white/[0.05] hover:bg-white/[0.12] border border-white/10 hover:border-sky-400/40 text-slate-300 hover:text-sky-300 shrink-0 transition-all text-xs font-medium cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-sm"
                >
                  <span>{item.title}</span>
                </button>
              ))}
            </div>
          )}

          {/* Capsule de Saisie Prompt Style Google Gemini */}
          <div className="bg-[#1e1f20]/95 backdrop-blur-2xl rounded-[32px] border border-white/15 p-2 sm:p-2.5 pl-4 sm:pl-6 flex items-center gap-2.5 sm:gap-3.5 shadow-[0_20px_50px_rgba(0,0,0,0.65)] focus-within:border-sky-400/70 focus-within:ring-2 focus-within:ring-sky-400/25 transition-all duration-300">
            
            {/* Bouton '+' (Connecteurs / Règles) */}
            <button
              type="button"
              onClick={() => setIsRulesOpen(true)}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/[0.06] hover:bg-white/[0.14] border border-white/10 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
              title="Mes règles & abonnements personnalisés"
            >
              <Plus size={16} />
            </button>

            {/* Champ de saisie prompt épuré & large */}
            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onSend();
                }
              }}
              placeholder="Posez une question sur vos relevés, demandez un audit, comparez vos prix..."
              disabled={isLoading}
              className="flex-1 bg-transparent border-none text-sm sm:text-base text-white placeholder-slate-400 focus:outline-none focus:ring-0 font-light"
            />

            {/* Microphone Vocal */}
            <button
              type="button"
              onClick={toggleListening}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                isListening 
                  ? 'bg-rose-500/25 text-rose-300 border border-rose-500/50 animate-pulse' 
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
              title={isListening ? "Écoute en cours... Cliquez pour terminer" : "Activer la saisie vocale"}
            >
              {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>

            {/* Bouton Envoyer Google Gemini */}
            <button
              type="button"
              onClick={() => onSend()}
              disabled={!inputPrompt.trim() || isLoading}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-r from-sky-400 to-blue-600 hover:from-sky-300 hover:to-blue-500 text-white flex items-center justify-center shadow-lg shadow-sky-500/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-20 disabled:scale-100 disabled:cursor-not-allowed cursor-pointer shrink-0"
              title="Envoyer"
            >
              <ArrowUp size={18} className="stroke-[2.5]" />
            </button>

          </div>

          <p className="text-[11px] text-center text-slate-500 font-light">
            CashPilot IA peut faire des erreurs. Vérifiez les informations financières importantes.
          </p>

        </div>
      </div>
    </div>
  );
}
