import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  isDeleting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  isOpen,
  title,
  description,
  confirmLabel = "Supprimer définitivement",
  isDeleting = false,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-[#0c1222]/95 backdrop-blur-2xl border border-white/20 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-rose-950/30 space-y-4 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0 shadow-inner">
            <AlertTriangle size={22} />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-white tracking-tight">
              {title}
            </h3>
            <p className="text-[11px] font-mono text-cyan-300 mt-0.5">
              Règle d'intégrité comptable
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          {description}
        </p>

        <div className="pt-2 flex items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isDeleting}
            className="text-xs h-9 px-4 rounded-xl border-white/15 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            Annuler
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={onConfirm}
            disabled={isDeleting}
            className="text-xs h-9 px-4 font-bold rounded-xl bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white shadow-lg shadow-rose-950/40 transition-all cursor-pointer"
          >
            {isDeleting ? (
              <>
                <Loader2 size={13} className="mr-1.5 animate-spin" />
                Suppression en cours...
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
