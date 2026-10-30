import React, { useState, useEffect, useRef } from 'react';
import { MarkdownRenderer } from '../../components/ui/MarkdownRenderer';
import { useTransactions } from '../../context/TransactionsContext';
import { useCoach, type SavedConversation } from '../../context/CoachContext';
import { getGeminiModelName, type ProposedAdminAction } from '../../lib/coachFinancialEngine';
import { DEFAULT_COST_OF_LIVING_ITEMS, type CustomUserRule } from '../../lib/kpiUtils';
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
  MessageSquare,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  RotateCcw,
  BookmarkCheck,
  Edit3,
  ArrowRight,
  Layers
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

  // État du formulaire "Mes Règles & Abonnements"
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [rulePattern, setRulePattern] = useState('');
  const [ruleExactAmount, setRuleExactAmount] = useState('');
  const [ruleCustomLabel, setRuleCustomLabel] = useState('');
  const [ruleCategory, setRuleCategory] = useState('Abonnements & Télécom');
  const [ruleBudgetPost, setRuleBudgetPost] = useState('Streaming, Cloud & Services');
  const [ruleNote, setRuleNote] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const activeModel = getGeminiModelName();
  const validConversations = conversations.filter(c => c.messages && c.messages.length > 0);

  const suggestions = [
    {
      icon: ShoppingBag,
      title: "Audit direct : Prix de mes fruits / pain",
      subtitle: "« À combien j'achète mes fruits et quel est le magasin le moins cher ? »",
      prompt: "À combien j'achète mes fruits ? Donne-moi la synthèse directe et le tableau complet."
    },
    {
      icon: Calendar,
      title: "Liste des dépenses par date",
      subtitle: "« Liste moi mes dépenses du 01 au 15 de ce mois avec le total »",
      prompt: "Liste moi mes dépenses du 01 au 15 de ce mois sous forme de tableau détaillé avec le montant total."
    },
    {
      icon: Target,
      title: "Modifier un Budget (Carte de Validation)",
      subtitle: "« Fixe mon budget Courses Alimentaires à 400 € »",
      prompt: "Fixe mon budget Courses Alimentaires à 400 € dans Budget et coût de la vie."
    },
    {
      icon: Scale,
      title: "Règle budgétaire 50 / 30 / 20",
      subtitle: "« Analyse mes finances selon la méthode 50/30/20 avec mes chiffres réels »",
      prompt: "Donne-moi des conseils sur la répartition de mes dépenses selon la règle 50/30/20 en te basant sur mes chiffres réels."
    },
    {
      icon: CreditCard,
      title: "Clarifier un abonnement (Règle perso)",
      subtitle: "« Le prélèvement Google de 2,99 € correspond à Google One 100 Go »",
      prompt: "Le prélèvement Google de 2,99 € correspond à Google One 100 Go."
    }
  ];

  const onSend = async (textToSend?: string) => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    await sendMessage(textToSend);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
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
   * Rendu d'une Carte de Confirmation Administrateur Interactive (Chantier 3)
   */
  const renderValidationCard = (messageId: string, action: ProposedAdminAction) => {
    const oldEntries = Object.entries(action.oldValues || {});
    const newEntries = Object.entries(action.newValues || {});

    return (
      <div className="mt-4 rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-[#121826]/95 via-[#0f1420]/95 to-cyan-950/20 p-4 md:p-5 shadow-xl backdrop-blur-xl space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {/* Header de la carte */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0">
              <ShieldAlert size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  Validation Humaine Requise
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/5 text-muted-foreground">
                  {action.targetType}
                </span>
              </div>
              <h4 className="text-sm font-bold text-foreground mt-1">
                {action.title}
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {action.description}
              </p>
            </div>
          </div>
        </div>

        {/* Grille comparative Avant / Après */}
        {(oldEntries.length > 0 || newEntries.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3 rounded-xl bg-rose-500/[0.06] border border-rose-500/20 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 block">
                Avant modification
              </span>
              {oldEntries.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-xs gap-2">
                  <span className="text-muted-foreground truncate">{k} :</span>
                  <span className="font-mono font-semibold text-foreground">{String(v)}</span>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/25 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                <ArrowRight size={11} /> Après validation
              </span>
              {newEntries.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-xs gap-2">
                  <span className="text-muted-foreground truncate">{k} :</span>
                  <span className="font-mono font-bold text-emerald-400">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Boutons d'action selon le statut */}
        <div className="pt-2 border-t border-white/[0.07] flex items-center justify-between flex-wrap gap-3">
          {action.status === 'pending' && (
            <>
              <span className="text-[11px] text-muted-foreground">
                Aucune donnée n'est modifiée sans votre clic :
              </span>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => confirmProposedAction(messageId)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer active:scale-95"
                >
                  <CheckCircle2 size={15} />
                  <span>✅ Valider</span>
                </button>
                <button
                  type="button"
                  onClick={() => rejectProposedAction(messageId)}
                  className="px-4 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                >
                  <XCircle size={15} />
                  <span>❌ Annuler</span>
                </button>
              </div>
            </>
          )}

          {action.status === 'validated' && (
            <div className="w-full flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                <CheckCircle2 size={16} />
                <span>Changement validé et synchronisé sur tous vos onglets !</span>
              </div>
              <button
                type="button"
                onClick={() => undoProposedAction(messageId)}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <RotateCcw size={13} />
                <span>↩️ Annuler l'action</span>
              </button>
            </div>
          )}

          {action.status === 'cancelled' && (
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <XCircle size={15} className="text-rose-400" />
              <span>Action annulée — Vos données sont restées intactes.</span>
            </div>
          )}

          {action.status === 'undone' && (
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400">
              <RotateCcw size={15} />
              <span>Action annulée — L'état précédent a été intégralement restauré.</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] bg-background text-foreground relative selection:bg-primary/20 selection:text-primary overflow-x-hidden">
      
      {/* 1. TOP BAR ÉPURÉE */}
      <div className="sticky top-0 z-20 backdrop-blur-xl bg-background/80 dark:bg-[#0a0d14]/75 border-b border-border/40 dark:border-white/[0.04] px-4 md:px-8 py-3 flex items-center justify-between gap-2 flex-wrap">
        
        {/* Historique, Règles & Modèle */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/60 dark:bg-white/[0.05] hover:bg-secondary dark:hover:bg-white/[0.09] border border-border/60 dark:border-white/[0.08] text-xs font-semibold text-foreground transition-all group cursor-pointer"
            title="Ouvrir l'historique des conversations"
          >
            <History size={14} className="text-cyan-400 group-hover:scale-110 transition-transform" />
            <span>Historique ({validConversations.length})</span>
          </button>

          {/* Bouton Module "Mes Règles & Abonnements" */}
          <button
            onClick={() => setIsRulesOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-xs font-semibold text-emerald-400 transition-all group cursor-pointer"
            title="Gérer mes règles personnalisées et clarifications d'abonnements"
          >
            <BookmarkCheck size={14} className="group-hover:scale-110 transition-transform" />
            <span>Mes Règles & Abonnements ({customRules.length})</span>
          </button>

          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary/40 dark:bg-white/[0.03] border border-border/50 dark:border-white/[0.05] text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-foreground">{activeModel}</span>
          </div>

          <div className="hidden xl:flex items-center gap-1.5 text-xs text-muted-foreground px-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>{scopedTransactions.length} transactions connectées</span>
          </div>
        </div>

        {/* Portée & Nouvelle discussion */}
        <div className="flex items-center gap-2">
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

          <button
            onClick={() => {
              handleCreateNewConversation();
              setIsHistoryOpen(false);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-cyan-500/10 to-primary/10 hover:from-cyan-500/20 hover:to-primary/20 border border-cyan-500/30 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-all shadow-sm cursor-pointer"
            title="Créer une nouvelle discussion"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Nouvelle discussion</span>
          </button>
        </div>

      </div>

      {/* 2. DRAWER HISTORIQUE LATÉRAL */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-200">
          <div 
            onClick={() => setIsHistoryOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
          />

          <div className="relative w-full max-w-sm md:max-w-md bg-[#0f131f]/95 dark:bg-[#0c101a]/95 border-l border-border/80 dark:border-white/[0.08] backdrop-blur-2xl h-full shadow-2xl flex flex-col justify-between z-10 animate-in slide-in-from-right duration-300">
            <div className="p-4 md:p-5 border-b border-border/60 dark:border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History size={18} className="text-cyan-400" />
                <h3 className="text-sm font-bold text-foreground">Historique des discussions</h3>
              </div>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="w-8 h-8 rounded-full bg-secondary/50 dark:bg-white/[0.05] hover:bg-secondary dark:hover:bg-white/[0.1] text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
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
                className="w-full p-3 rounded-2xl border border-dashed border-cyan-500/40 hover:border-cyan-500/80 bg-cyan-500/[0.04] hover:bg-cyan-500/[0.08] text-cyan-400 text-xs font-semibold flex items-center justify-center gap-2 transition-all mb-3 cursor-pointer"
              >
                <Plus size={15} />
                Nouvelle discussion
              </button>

              {validConversations.length === 0 ? (
                <div className="py-14 px-4 text-center flex flex-col items-center justify-center space-y-3 animate-in fade-in duration-300">
                  <div className="w-12 h-12 rounded-2xl bg-secondary/40 dark:bg-white/[0.03] border border-border/50 dark:border-white/[0.05] flex items-center justify-center text-muted-foreground/40">
                    <MessageSquare size={20} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-foreground/80">Aucune discussion archivée</p>
                    <p className="text-[11px] text-muted-foreground/60 max-w-[220px] mx-auto leading-relaxed">
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
                          <span>{conv.messages.length} message{conv.messages.length > 1 ? 's' : ''}</span>
                        </div>
                      </div>

                      <button
                        onClick={(e) => handleDeleteConversation(e, conv.id)}
                        className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-rose-400 hover:bg-rose-500/10 transition-colors opacity-70 group-hover:opacity-100 cursor-pointer"
                        title="Supprimer cette discussion de l'historique"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 border-t border-border/60 dark:border-white/[0.06] text-center">
              <span className="text-[11px] text-muted-foreground">
                Vos discussions continuent de charger même si vous changez d'onglet.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 2B. DRAWER MODULE "MES RÈGLES & ABONNEMENTS" (CHANTIER 3.4) */}
      {isRulesOpen && (
        <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-200">
          <div
            onClick={() => setIsRulesOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
          />

          <div className="relative w-full max-w-lg bg-[#0f131f]/95 dark:bg-[#0c101a]/95 border-l border-border/80 dark:border-white/[0.08] backdrop-blur-2xl h-full shadow-2xl flex flex-col justify-between z-10 animate-in slide-in-from-right duration-300">
            <div className="p-4 md:p-5 border-b border-border/60 dark:border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                  <BookmarkCheck size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Mes Règles & Abonnements</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Clarifications de libellés, affectations budgétaires et prix fixes
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsRulesOpen(false)}
                className="w-8 h-8 rounded-full bg-secondary/50 dark:bg-white/[0.05] hover:bg-secondary dark:hover:bg-white/[0.1] text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Formulaire d'ajout ou d'édition de règle */}
              <form onSubmit={handleSaveRuleForm} className="p-4 rounded-2xl bg-secondary/30 dark:bg-white/[0.03] border border-border/60 dark:border-white/[0.08] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers size={13} />
                    {editingRuleId ? 'Modifier la règle' : 'Ajouter une règle / préciser un abonnement'}
                  </span>
                  {editingRuleId && (
                    <button
                      type="button"
                      onClick={resetRuleForm}
                      className="text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      Annuler l'édition
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">
                      Mot-clé du libellé bancaire *
                    </label>
                    <input
                      type="text"
                      value={rulePattern}
                      onChange={e => setRulePattern(e.target.value)}
                      placeholder="Ex: GOOGLE, SOBRIO, ALMA..."
                      required
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border/60 text-xs text-foreground focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">
                      Montant exact optionnel (€)
                    </label>
                    <input
                      type="text"
                      value={ruleExactAmount}
                      onChange={e => setRuleExactAmount(e.target.value)}
                      placeholder="Ex: 2.99 (distingue de 10.99)"
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border/60 text-xs text-foreground focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">
                    Nom explicite à afficher *
                  </label>
                  <input
                    type="text"
                    value={ruleCustomLabel}
                    onChange={e => setRuleCustomLabel(e.target.value)}
                    placeholder="Ex: Google One (Stockage Cloud 100 Go)"
                    required
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border/60 text-xs text-foreground focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">
                      Catégorie CashPilot
                    </label>
                    <select
                      value={ruleCategory}
                      onChange={e => setRuleCategory(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border/60 text-xs text-foreground focus:outline-none focus:border-emerald-500"
                    >
                      {AVAILABLE_CATEGORIES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">
                      Poste "Budget & Coût de la vie"
                    </label>
                    <select
                      value={ruleBudgetPost}
                      onChange={e => setRuleBudgetPost(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border/60 text-xs text-foreground focus:outline-none focus:border-emerald-500"
                    >
                      {DEFAULT_COST_OF_LIVING_ITEMS.map(item => (
                        <option key={item.id} value={item.name}>{item.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer shadow-md shadow-emerald-600/20"
                >
                  {editingRuleId ? 'Enregistrer les modifications' : '+ Créer cette règle personnalisée'}
                </button>
              </form>

              {/* Liste des règles existantes */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
                  Règles actives ({customRules.length})
                </h4>

                {customRules.length === 0 ? (
                  <div className="p-6 rounded-2xl border border-dashed border-border/60 text-center space-y-1.5">
                    <p className="text-xs font-semibold text-foreground">Aucune règle personnalisée</p>
                    <p className="text-[11px] text-muted-foreground">
                      Dites au Coach IA dans le chat « Le prélèvement Google de 2,99 € correspond à Google One » ou créez une règle ci-dessus.
                    </p>
                  </div>
                ) : (
                  customRules.map(rule => (
                    <div
                      key={rule.id}
                      className="p-3.5 rounded-2xl bg-secondary/30 dark:bg-white/[0.03] border border-border/60 dark:border-white/[0.07] flex items-start justify-between gap-3 group"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-foreground">{rule.customLabel}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                            Mot-clé : {rule.pattern}
                          </span>
                          {rule.exactAmount !== undefined && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              {Number(rule.exactAmount).toFixed(2)} €
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                          <span>Catégorie : <strong className="text-foreground/90">{rule.category}</strong></span>
                          {rule.budgetPostName && (
                            <>
                              <span>•</span>
                              <span>Budget : <strong className="text-emerald-400">{rule.budgetPostName}</strong></span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleStartEditRule(rule)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors cursor-pointer"
                          title="Modifier cette règle"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => deleteCustomRule(rule.id)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
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
          <div className="flex-1 flex flex-col items-center justify-center py-8 md:py-16 pb-24 md:pb-8 space-y-6 md:space-y-8 animate-in fade-in duration-500">
            <div className="text-center space-y-3 max-w-2xl px-2">
              <div className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-cyan-500/10 via-primary/10 to-indigo-500/10 border border-primary/20 mb-1">
                <Sparkles className="w-8 h-8 text-cyan-400 animate-pulse" />
              </div>
              <h1 className="text-3xl md:text-5xl font-medium tracking-tight text-foreground">
                Par quoi voulez-vous commencer ?
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground leading-relaxed max-w-lg mx-auto">
                Votre Coach Financier audite vos relevés, vos tickets et vos budgets. Posez une question ou demandez une modification sécurisée.
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
                  placeholder="Ex: À combien j'achète mes fruits ? / Fixe mon budget Courses à 400 € / Google 2,99€ c'est Google One..."
                  rows={2}
                  disabled={isLoading}
                  className="w-full resize-none bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none leading-relaxed"
                />

                <div className="flex items-center justify-between pt-2 px-1">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Grand livre connecté ({scopedTransactions.length} flux) • Persisté en arrière-plan</span>
                  </div>

                  <button
                    onClick={() => onSend()}
                    disabled={!inputPrompt.trim() || isLoading}
                    className="w-9 h-9 rounded-full bg-gradient-to-r from-cyan-500 to-primary hover:from-cyan-400 hover:to-primary/90 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed shadow-md shadow-primary/20 transition-all cursor-pointer"
                  >
                    <Send size={15} />
                  </button>
                </div>
              </div>
            </div>

            {/* Cartes de Suggestions */}
            <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
              {suggestions.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => onSend(item.prompt)}
                    className="p-3.5 rounded-2xl text-left bg-secondary/30 dark:bg-white/[0.02] hover:bg-secondary/60 dark:hover:bg-white/[0.06] border border-border/60 dark:border-white/[0.06] hover:border-cyan-500/40 transition-all duration-200 group flex items-start gap-3 cursor-pointer"
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
                          <>
                            <MarkdownRenderer content={msg.content} />
                            {msg.proposedAction && renderValidationCard(msg.id, msg.proposedAction)}
                          </>
                        )}
                      </div>

                      <div className={`flex items-center gap-3 pt-1 text-xs text-muted-foreground px-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
                        {!isUser && (
                          <button
                            onClick={() => handleCopyMessage(msg.id, msg.content)}
                            className="hover:text-foreground flex items-center gap-1.5 transition-colors text-[11px] cursor-pointer"
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

              {/* Indicateur de chargement épuré (sans affichage des secondes de réflexion) */}
              {isLoading && (
                <div className="flex items-start gap-3.5 animate-in fade-in duration-300">
                  <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-cyan-500 to-primary text-white flex items-center justify-center shrink-0 shadow-md shadow-cyan-500/20 mt-1">
                    <Sparkles size={16} className="animate-spin" />
                  </div>
                  <div className="space-y-1.5 py-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                      <span>{loadingStep}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Vous pouvez naviguer librement vers les autres onglets : l'analyse continue en arrière-plan.
                    </p>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Zone de Saisie Flottante Pinned en Bas (au-dessus de la nav mobile sur téléphone) */}
            <div className="fixed bottom-[4.25rem] md:bottom-0 left-0 right-0 md:left-64 z-40 p-2.5 sm:p-4 bg-gradient-to-t from-background/95 via-background/90 to-transparent backdrop-blur-md">
              <div className="max-w-3xl mx-auto space-y-2">
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs touch-pan-x">
                  <span className="text-muted-foreground text-[11px] font-semibold shrink-0 flex items-center gap-1">
                    <Sparkles size={11} className="text-cyan-400" /> Audit Direct :
                  </span>
                  <button
                    type="button"
                    onClick={() => onSend("À combien j'achète mes fruits ? Donne-moi la synthèse directe et le tableau complet.")}
                    className="px-3 py-1 rounded-full bg-secondary/70 dark:bg-white/[0.04] hover:bg-cyan-500/10 hover:text-cyan-400 border border-border/70 dark:border-white/[0.07] shrink-0 transition-colors text-[11px] font-medium cursor-pointer"
                  >
                    🍎 Prix de mes fruits
                  </button>
                  <button
                    type="button"
                    onClick={() => onSend("Combien j'achète mon pain ? Donne-moi la synthèse directe et le tableau complet.")}
                    className="px-3 py-1 rounded-full bg-secondary/70 dark:bg-white/[0.04] hover:bg-cyan-500/10 hover:text-cyan-400 border border-border/70 dark:border-white/[0.07] shrink-0 transition-colors text-[11px] font-medium cursor-pointer"
                  >
                    🥖 Prix de mon pain
                  </button>
                  <button
                    type="button"
                    onClick={() => onSend("Fixe mon budget Courses Alimentaires à 400 €")}
                    className="px-3 py-1 rounded-full bg-secondary/70 dark:bg-white/[0.04] hover:bg-cyan-500/10 hover:text-cyan-400 border border-border/70 dark:border-white/[0.07] shrink-0 transition-colors text-[11px] font-medium cursor-pointer"
                  >
                    🎯 Ajuster un budget
                  </button>
                  <button
                    type="button"
                    onClick={() => onSend("Donne-moi des conseils sur la répartition de mes dépenses selon la règle 50/30/20 avec mes chiffres réels")}
                    className="px-3 py-1 rounded-full bg-secondary/70 dark:bg-white/[0.04] hover:bg-cyan-500/10 hover:text-cyan-400 border border-border/70 dark:border-white/[0.07] shrink-0 transition-colors text-[11px] font-medium cursor-pointer"
                  >
                    ⚖️ Règle 50/30/20
                  </button>
                </div>

                <div className="relative rounded-2xl md:rounded-3xl bg-[#1e2330]/90 dark:bg-[#131722]/95 border border-border/80 dark:border-white/[0.1] shadow-2xl p-2 md:p-2.5 focus-within:border-cyan-500/50 focus-within:ring-2 focus-within:ring-cyan-500/20 transition-all backdrop-blur-2xl flex items-center gap-2">
                  <textarea
                    ref={textareaRef}
                    value={inputPrompt}
                    onChange={(e) => setInputPrompt(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Demander au Coach IA (analyse, modification de budget, règle d'abonnement, archivage)..."
                    rows={1}
                    disabled={isLoading}
                    className="flex-1 resize-none bg-transparent px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none max-h-32"
                    style={{ minHeight: '38px' }}
                  />

                  <button
                    onClick={() => onSend()}
                    disabled={!inputPrompt.trim() || isLoading}
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-r from-cyan-500 to-primary hover:from-cyan-400 hover:to-primary/90 text-white flex items-center justify-center shrink-0 disabled:opacity-30 disabled:cursor-not-allowed shadow-md shadow-primary/20 transition-all cursor-pointer"
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
