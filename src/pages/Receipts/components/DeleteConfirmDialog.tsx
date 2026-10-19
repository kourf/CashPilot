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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-card/95 backdrop-blur-xl border border-border/80 dark:border-white/[0.1] rounded-2xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div>
            <h3 className="font-bold text-base text-foreground">
              {title}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Règle d'intégrité comptable
            </p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          {description}
        </p>

        <div className="pt-2 flex items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isDeleting}
            className="text-xs h-9"
          >
            Annuler
          </Button>

          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onConfirm}
            disabled={isDeleting}
            className="text-xs h-9 font-semibold"
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
