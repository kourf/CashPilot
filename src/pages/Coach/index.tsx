import React, { useState, useEffect, useRef } from 'react';
import { MarkdownRenderer } from '../../components/ui/MarkdownRenderer';
import { useTransactions } from '../../context/TransactionsContext';
import { useCoach, type SavedConversation } from '../../context/CoachContext';
import { getGeminiModelName, type ProposedAdminAction } from '../../lib/coachFinancialEngine';
import { DEFAULT_COST_OF_LIVING_ITEMS, type CustomUserRule } from '../../lib/kpiUtils';
import { 
  Sparkles, 
  ArrowUp,
  Mic,
  MicOff,
  Copy, 
  Check, 
  Plus, 
  Target, 
  Scale, 
  ShoppingBag, 
  CreditCard, 
  SlidersHorizontal,
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
  Lock,
  ShieldCheck,
  Receipt,
  PieChart,
  Repeat,
  TrendingUp,
  Zap
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
  const { transactions = [], availableMonths = [] } = useTransactions();
  const {
    conversations,
    activeConversationId,
    messages,
    selectedScope,
    scopedTransactions,
    isLoading,
    loadingStep,
    inputPrompt,
    setInputPrompt,
    setActiveConversationId,
    handleScopeChange,
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

  const activeModel = getGeminiModelName();
  const validConversations = conversations.filter(c => c.messages && c.messages.length > 0);

  // 4 Suggestions officielles Google Stitch visionOS
  const stitchSuggestions = [
    {
      icon: Receipt,
      iconColor: 'text-sky-400',
      bgGlow: 'bg-sky-500/10 border-sky-400/20 group-hover:bg-sky-500/20',
      title: 'Audit courses & alimentation',
      subtitle: '« À combien j\'achète mes fruits et quel est le magasin le moins cher ? »',
      prompt: "À combien j'achète mes fruits ? Donne-moi la synthèse directe et le tableau comparatif complet."
    },
    {
      icon: PieChart,
      iconColor: 'text-emerald-400',
      bgGlow: 'bg-emerald-500/10 border-emerald-400/20 group-hover:bg-emerald-500/20',
      title: 'Analyse règle 50/30/20',
      subtitle: '« Évalue la répartition de mes besoins, envies et épargne sur mes revenus réels. »',
      prompt: "Donne-moi des conseils sur la répartition de mes dépenses selon la règle 50/30/20 en te basant sur mes chiffres réels."
    },
    {
      icon: Repeat,
      iconColor: 'text-violet-400',
      bgGlow: 'bg-violet-500/10 border-violet-400/20 group-hover:bg-violet-500/20',
      title: 'Détection abonnements cachés',
      subtitle: '« Quels sont mes prélèvements récurrents et ceux potentiellement oubliés ? »',
      prompt: "Quels sont mes abonnements et prélèvements récurrents ? Détecte les anomalies ou doublons potentiels."
    },
    {
      icon: TrendingUp,
      iconColor: 'text-amber-400',
      bgGlow: 'bg-amber-500/10 border-amber-400/20 group-hover:bg-amber-500/20',
      title: 'Prévision de fin de mois',
      subtitle: '« Selon mon rythme de dépenses, quel sera mon solde estimé le 30 ? »',
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
    <div className="coach-liquid-aura flex flex-col min-h-[calc(100vh-4rem)] text-white relative selection:bg-sky-500/30 selection:text-white overflow-x-hidden">
      
      {/* 1. TOP BAR ÉPURÉE LIQUID GLASS CAPSULE */}
      <div className="sticky top-0 z-30 px-3 sm:px-6 py-3">
        <div className="apple-glass rounded-full px-3 sm:px-5 py-2 flex items-center justify-between gap-2 max-w-5xl mx-auto shadow-2xl">
          
          {/* Gauche: Historique & Mes Règles */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsHistoryOpen(true)}
              className="apple-glass-pill hover:bg-white/15 px-3 py-1.5 rounded-full text-xs font-semibold text-white/90 flex items-center gap-1.5 transition-all group cursor-pointer"
              title="Ouvrir l'historique des conversations"
            >
              <History size={14} className="text-sky-400 group-hover:rotate-12 transition-transform" />
              <span>Historique <span className="text-sky-400 font-bold">({validConversations.length})</span></span>
            </button>

            <button
              onClick={() => setIsRulesOpen(true)}
              className="apple-glass-pill hover:bg-white/15 px-3 py-1.5 rounded-full text-xs font-semibold text-emerald-400 border-emerald-500/30 flex items-center gap-1.5 transition-all group cursor-pointer"
              title="Gérer mes règles personnalisées et clarifications d'abonnements"
            >
              <BookmarkCheck size={14} className="group-hover:scale-110 transition-transform" />
              <span className="hidden sm:inline">Mes Règles</span>
              <span className="sm:hidden">Règles</span>
              <span className="font-bold">({customRules.length})</span>
            </button>
          </div>

          {/* Centre: Indicateur Live IA & Données connectées */}
          <div className="hidden md:flex items-center gap-2">
            <div className="apple-glass-pill px-3 py-1 rounded-full text-[11px] text-white/90 flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
              <span className="text-white font-semibold">{activeModel}</span>
            </div>
            <div className="apple-glass-pill px-3 py-1 rounded-full text-[11px] text-slate-300 flex items-center gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              <span>{scopedTransactions.length} flux connectés</span>
            </div>
          </div>

          {/* Droite: Portée & Nouvelle discussion */}
          <div className="flex items-center gap-2">
            <div className="apple-glass-pill px-2.5 py-1 rounded-full flex items-center gap-1.5 text-xs text-slate-200">
              <SlidersHorizontal size={12} className="text-slate-400" />
              <select
                value={selectedScope}
                onChange={(e) => handleScopeChange(e.target.value)}
                className="bg-transparent text-xs font-medium text-white focus:outline-none cursor-pointer pr-1"
              >
                <option value="all" className="bg-[#080a14] text-white">Toute la base ({transactions.length})</option>
                {availableMonths.map(m => (
                  <option key={m} value={m} className="bg-[#080a14] text-white">
                    Mois {m}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => {
                handleCreateNewConversation();
                setIsHistoryOpen(false);
              }}
              className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-sky-400 to-blue-600 hover:from-sky-300 hover:to-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-sky-500/25 active:scale-95 transition-all cursor-pointer"
              title="Créer une nouvelle discussion"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">Nouvelle</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. DRAWER HISTORIQUE LATÉRAL APPLE GLASS */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-200">
          <div 
            onClick={() => setIsHistoryOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-md cursor-pointer"
          />

          <div className="relative w-full max-w-sm md:max-w-md apple-glass bg-[#080a14]/95 border-l border-white/20 h-full shadow-2xl flex flex-col justify-between z-10 animate-in slide-in-from-right duration-300">
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
                className="w-full p-3 rounded-2xl border border-dashed border-sky-400/40 hover:border-sky-400 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all mb-3 cursor-pointer"
              >
                <Plus size={15} />
                Nouvelle discussion
              </button>

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
              ) : (
                validConversations.map((conv) => {
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
            className="absolute inset-0 bg-black/60 backdrop-blur-md cursor-pointer"
          />

          <div className="relative w-full max-w-lg apple-glass bg-[#080a14]/95 border-l border-white/20 h-full shadow-2xl flex flex-col justify-between z-10 animate-in slide-in-from-right duration-300">
            <div className="p-4 md:p-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl apple-glass text-emerald-400 border border-emerald-400/30 flex items-center justify-center">
                  <BookmarkCheck size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Mes Règles & Abonnements</h3>
                  <p className="text-[11px] text-slate-400">
                    Clarifications de libellés, affectations budgétaires et montants fixes
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

      {/* 3. ZONE CENTRALE */}
      <div className="flex-1 flex flex-col justify-between max-w-4xl w-full mx-auto px-4 md:px-6">
        
        {messages.length === 0 ? (
          /* ÉCRAN D'ACCUEIL APPLE VISIONOS LIQUID GLASS */
          <div className="flex-1 flex flex-col items-center justify-center py-6 md:py-12 pb-24 md:pb-12 space-y-6 md:space-y-8 animate-in fade-in duration-500">
            
            {/* Squircle Orb Central avec Specular Glow */}
            <div className="relative mb-2">
              <div className="apple-glass specular-glow w-24 h-24 rounded-[32px] flex items-center justify-center relative z-10 transition-transform duration-500 hover:scale-105">
                <div className="absolute inset-1 rounded-[28px] bg-gradient-to-tr from-cyan-500/20 via-sky-400/10 to-indigo-500/20" />
                <Sparkles className="w-10 h-10 text-sky-400 relative z-10 drop-shadow-[0_0_12px_rgba(56,189,248,0.5)]" />
              </div>
              <div className="absolute -bottom-1 -right-1 z-20 w-8 h-8 rounded-full apple-glass flex items-center justify-center border border-white/30 text-emerald-400 shadow-lg">
                <Zap size={14} />
              </div>
            </div>

            {/* Titre & Sous-titre Épurés */}
            <div className="text-center space-y-2.5 max-w-xl px-2">
              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white">
                Par quoi voulez-vous commencer ?
              </h1>
              <p className="text-xs md:text-sm text-slate-400 max-w-lg mx-auto font-light leading-relaxed">
                Votre copilote financier de nouvelle génération. Auditez vos tickets, analysez vos flux et pilotez vos budgets en langage naturel.
              </p>
            </div>

            {/* Boîte de Saisie Flottante Centrale */}
            <div className="w-full max-w-2xl">
              <div className="apple-glass rounded-full p-2 pl-5 sm:pl-6 flex items-center gap-2 sm:gap-3 relative transition-all duration-300 focus-within:border-sky-400/60 focus-within:shadow-[0_0_40px_rgba(56,189,248,0.25)]">
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
                  placeholder="Combien j'ai dépensé chez Leclerc ce mois-ci ?"
                  disabled={isLoading}
                  className="flex-1 bg-transparent border-none text-white text-xs sm:text-sm placeholder-slate-400 focus:outline-none focus:ring-0 font-light"
                />
                
                <div className="flex items-center gap-1.5 sm:gap-2 pr-1">
                  <button
                    type="button"
                    onClick={toggleListening}
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full apple-glass flex items-center justify-center transition-all cursor-pointer ${
                      isListening 
                        ? 'bg-rose-500/25 text-rose-300 border border-rose-500/50 animate-pulse' 
                        : 'text-slate-300 hover:text-white hover:bg-white/10'
                    }`}
                    title={isListening ? "Écoute en cours... Cliquez pour terminer" : "Activer la saisie vocale"}
                  >
                    {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                  </button>

                  <button
                    type="button"
                    onClick={() => onSend()}
                    disabled={!inputPrompt.trim() || isLoading}
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-r from-sky-400 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/30 hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    title="Envoyer"
                  >
                    <ArrowUp size={18} />
                  </button>
                </div>
              </div>

              {/* Badges de sécurité et connectivité */}
              <div className="flex items-center justify-center gap-4 sm:gap-6 mt-3.5 text-[11px] text-slate-400 font-medium flex-wrap">
                <span className="flex items-center gap-1.5">
                  <Lock size={12} className="text-sky-400" /> Chiffrement bancaire AES-256
                </span>
                <span className="flex items-center gap-1.5">
                  <ShieldCheck size={12} className="text-emerald-400" /> Grand livre connecté ({scopedTransactions.length} flux)
                </span>
              </div>
            </div>

            {/* 4 Cartes de Suggestions Google Stitch */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 w-full max-w-3xl pt-2">
              {stitchSuggestions.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onSend(item.prompt)}
                    className="apple-glass-card rounded-3xl p-4 sm:p-5 flex items-start gap-4 cursor-pointer group text-left transition-all duration-300"
                  >
                    <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shrink-0 border ${item.bgGlow} ${item.iconColor} group-hover:scale-110 transition-all duration-300`}>
                      <Icon size={22} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-xs sm:text-sm font-semibold text-white group-hover:text-sky-300 transition-colors">
                          {item.title}
                        </h3>
                        <ArrowRight size={14} className="text-slate-500 group-hover:text-sky-400 group-hover:translate-x-1 transition-all" />
                      </div>
                      <p className="text-[11px] sm:text-xs text-slate-400 font-light leading-relaxed line-clamp-2">
                        {item.subtitle}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* VUE CONVERSATION LIQUID GLASS */
          <div className="flex-1 flex flex-col py-6 space-y-6">
            <div className="space-y-6 pb-64 md:pb-40">
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3.5 group ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in duration-300`}
                  >
                    {!isUser && (
                      <div className="w-9 h-9 rounded-2xl apple-glass specular-glow flex items-center justify-center text-sky-400 shrink-0 border border-white/20 mt-1 shadow-md">
                        <Sparkles size={18} />
                      </div>
                    )}

                    <div className={`space-y-1.5 ${isUser ? 'max-w-[85%] sm:max-w-[75%]' : 'max-w-full flex-1'}`}>
                      <div
                        className={`text-sm leading-relaxed ${
                          isUser
                            ? 'p-4 sm:p-5 rounded-3xl apple-glass-active text-white inline-block border border-white/30'
                            : 'p-5 sm:p-6 rounded-3xl apple-glass-card text-slate-100 border border-white/15'
                        }`}
                      >
                        {isUser ? (
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        ) : (
                          <>
                            <MarkdownRenderer content={msg.content} />
                            {msg.proposedAction && renderValidationCard(msg.id, msg.proposedAction)}
                          </>
                        )}
                      </div>

                      <div className={`flex items-center gap-3 pt-1 text-xs text-slate-400 px-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
                        {!isUser && (
                          <button
                            onClick={() => handleCopyMessage(msg.id, msg.content)}
                            className="hover:text-white flex items-center gap-1.5 transition-colors text-[11px] cursor-pointer"
                            title="Copier la réponse"
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check size={12} className="text-emerald-400" />
                                <span className="text-emerald-400 font-medium">Copié !</span>
                              </>
                            ) : (
                              <>
                                <Copy size={12} />
                                <span>Copier</span>
                              </>
                            )}
                          </button>
                        )}

                        <button
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="hover:text-rose-400 flex items-center gap-1 transition-colors text-[11px] opacity-40 hover:opacity-100 group-hover:opacity-75 cursor-pointer"
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

              {/* Indicateur de chargement épuré Liquid Glass */}
              {isLoading && (
                <div className="flex items-start gap-3.5 animate-in fade-in duration-300">
                  <div className="w-9 h-9 rounded-2xl apple-glass flex items-center justify-center text-sky-400 shrink-0 border border-white/20 mt-1">
                    <Sparkles size={18} className="animate-spin text-sky-400" />
                  </div>
                  <div className="space-y-1.5 py-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-sky-300">
                      <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                      <span>{loadingStep}</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Vous pouvez naviguer librement vers les autres onglets : l'analyse continue en arrière-plan.
                    </p>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Zone de Saisie Flottante Pinned en Bas (au-dessus de la nav mobile sur téléphone) */}
            <div className="fixed bottom-[4.25rem] md:bottom-2 left-0 right-0 md:left-64 z-40 p-2.5 sm:p-4 bg-gradient-to-t from-[#080a14] via-[#080a14]/90 to-transparent backdrop-blur-md">
              <div className="max-w-3xl mx-auto space-y-2">
                
                {/* Pilules d'audit rapide horizontales */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs touch-pan-x">
                  <span className="text-slate-400 text-[11px] font-semibold shrink-0 flex items-center gap-1 pl-1">
                    <Sparkles size={11} className="text-sky-400" /> Audit :
                  </span>
                  <button
                    type="button"
                    onClick={() => onSend("À combien j'achète mes fruits ? Donne-moi la synthèse directe et le tableau complet.")}
                    className="px-3 py-1 rounded-full apple-glass-pill hover:bg-white/15 hover:text-sky-300 shrink-0 transition-colors text-[11px] font-medium cursor-pointer"
                  >
                    🍎 Prix de mes fruits
                  </button>
                  <button
                    type="button"
                    onClick={() => onSend("Combien j'achète mon pain ? Donne-moi la synthèse directe et le tableau complet.")}
                    className="px-3 py-1 rounded-full apple-glass-pill hover:bg-white/15 hover:text-sky-300 shrink-0 transition-colors text-[11px] font-medium cursor-pointer"
                  >
                    🥖 Prix de mon pain
                  </button>
                  <button
                    type="button"
                    onClick={() => onSend("Fixe mon budget Courses Alimentaires à 400 €")}
                    className="px-3 py-1 rounded-full apple-glass-pill hover:bg-white/15 hover:text-sky-300 shrink-0 transition-colors text-[11px] font-medium cursor-pointer"
                  >
                    🎯 Ajuster un budget
                  </button>
                  <button
                    type="button"
                    onClick={() => onSend("Donne-moi des conseils sur la répartition de mes dépenses selon la règle 50/30/20 avec mes chiffres réels")}
                    className="px-3 py-1 rounded-full apple-glass-pill hover:bg-white/15 hover:text-sky-300 shrink-0 transition-colors text-[11px] font-medium cursor-pointer"
                  >
                    ⚖️ Règle 50/30/20
                  </button>
                  <button
                    type="button"
                    onClick={() => onSend("Quels sont mes abonnements et prélèvements récurrents ? Détecte les anomalies ou doublons potentiels.")}
                    className="px-3 py-1 rounded-full apple-glass-pill hover:bg-white/15 hover:text-sky-300 shrink-0 transition-colors text-[11px] font-medium cursor-pointer"
                  >
                    🔍 Abonnements
                  </button>
                </div>

                {/* Capsule de saisie active Liquid Glass */}
                <div className="apple-glass rounded-full p-1.5 pl-4 sm:pl-5 flex items-center gap-2 relative border border-white/20 focus-within:border-sky-400/60 focus-within:shadow-[0_0_30px_rgba(56,189,248,0.25)] transition-all">
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
                    placeholder="Poser une question ou demander une modification..."
                    disabled={isLoading}
                    className="flex-1 bg-transparent border-none text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-0 font-light"
                  />

                  <div className="flex items-center gap-1.5 pr-1">
                    <button
                      type="button"
                      onClick={toggleListening}
                      className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full apple-glass flex items-center justify-center transition-all cursor-pointer ${
                        isListening 
                          ? 'bg-rose-500/25 text-rose-300 border border-rose-500/50 animate-pulse' 
                          : 'text-slate-300 hover:text-white hover:bg-white/10'
                      }`}
                      title={isListening ? "Écoute en cours... Cliquez pour terminer" : "Activer la saisie vocale"}
                    >
                      {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                    </button>

                    <button
                      type="button"
                      onClick={() => onSend()}
                      disabled={!inputPrompt.trim() || isLoading}
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-r from-sky-400 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/30 hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      title="Envoyer"
                    >
                      <ArrowUp size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
