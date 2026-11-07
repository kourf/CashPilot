import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Lock, 
  ShieldCheck, 
  X, 
  Delete, 
  Sparkles, 
  ArrowRight, 
  Check, 
  AlertCircle,
  KeyRound,
  Mail
} from 'lucide-react';
import { verifyPasscode, DEFAULT_PASSCODE_WORKSPACE } from '../lib/passcodeAuth';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';

interface PasscodeUnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onSwitchToClassicAuth?: () => void;
}

export const PasscodeUnlockModal: React.FC<PasscodeUnlockModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onSwitchToClassicAuth
}) => {
  const { loginAsAdmin } = useAuth();
  const [pin, setPin] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('Saisissez votre code PIN à 4 chiffres');
  const inputRef = useRef<HTMLInputElement>(null);

  // Remise à zéro à l'ouverture
  useEffect(() => {
    if (isOpen) {
      setPin('');
      setIsVerifying(false);
      setIsError(false);
      setIsSuccess(false);
      setStatusMessage('Saisissez votre code PIN à 4 chiffres');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Validation immédiate du code dès le 4e chiffre
  const handleVerify = useCallback(async (codeToVerify: string) => {
    if (isVerifying || isSuccess) return;
    setIsVerifying(true);
    setIsError(false);
    setStatusMessage('Vérification sécurisée en cours...');

    try {
      const isValid = await verifyPasscode(codeToVerify);

      if (isValid) {
        setIsSuccess(true);
        setStatusMessage('Code validé • Déverrouillage de votre espace');
        
        // Connexion immédiate sur l'espace de données historique cashpilot_main_user
        await loginAsAdmin(DEFAULT_PASSCODE_WORKSPACE);

        setTimeout(() => {
          if (onSuccess) {
            onSuccess();
          }
          onClose();
        }, 600);
      } else {
        setIsError(true);
        setStatusMessage('Code incorrect. Veuillez réessayer.');
        setTimeout(() => {
          setPin('');
          setIsError(false);
          setStatusMessage('Saisissez votre code PIN à 4 chiffres');
          inputRef.current?.focus();
        }, 800);
      }
    } catch (err) {
      console.error('Erreur vérification code:', err);
      setIsError(true);
      setStatusMessage('Erreur inattendue. Veuillez réessayer.');
      setPin('');
    } finally {
      setIsVerifying(false);
    }
  }, [isVerifying, isSuccess, loginAsAdmin, onSuccess, onClose]);

  // Ajout d'un chiffre
  const handleAddDigit = useCallback((digit: string) => {
    if (pin.length >= 4 || isVerifying || isSuccess) return;
    const nextPin = pin + digit;
    setPin(nextPin);
    if (nextPin.length === 4) {
      handleVerify(nextPin);
    }
  }, [pin, isVerifying, isSuccess, handleVerify]);

  // Suppression du dernier chiffre
  const handleDeleteDigit = useCallback(() => {
    if (isVerifying || isSuccess) return;
    setPin((prev) => prev.slice(0, -1));
    setIsError(false);
  }, [isVerifying, isSuccess]);

  // Écouteur global du clavier physique
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleAddDigit(e.key);
      } else if (e.key === 'Backspace') {
        handleDeleteDigit();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleAddDigit, handleDeleteDigit, onClose]);

  if (!isOpen) return null;

  const keypadRows = [
    [
      { digit: '1', letters: '' },
      { digit: '2', letters: 'ABC' },
      { digit: '3', letters: 'DEF' }
    ],
    [
      { digit: '4', letters: 'GHI' },
      { digit: '5', letters: 'JKL' },
      { digit: '6', letters: 'MNO' }
    ],
    [
      { digit: '7', letters: 'PQRS' },
      { digit: '8', letters: 'TUV' },
      { digit: '9', letters: 'WXYZ' }
    ]
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop sombre avec flou optique profond */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-[#04060d]/85 backdrop-blur-2xl transition-opacity" 
      />

      {/* Halo d'ambiance Apple VisionOS */}
      <div className="pointer-events-none absolute w-96 h-96 rounded-full bg-gradient-to-tr from-cyan-500/20 via-indigo-600/20 to-blue-500/10 blur-[100px] -z-0" />

      {/* Boîte Modale Liquid Glass */}
      <div 
        className={cn(
          "relative w-full max-w-sm rounded-[2.5rem] liquid-glass p-6 sm:p-7 shadow-[0_25px_60px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.4)] border border-white/20 text-slate-100 z-10 transition-all duration-300",
          isError && "animate-shake border-rose-500/50 shadow-[0_0_30px_rgba(244,63,94,0.3)]",
          isSuccess && "border-emerald-500/60 shadow-[0_0_40px_rgba(16,185,129,0.35)]"
        )}
      >
        {/* Bouton Fermer */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full liquid-pill flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
          title="Fermer"
        >
          <X size={15} />
        </button>

        {/* Input caché pour capturer les claviers virtuels mobiles */}
        <input
          ref={inputRef}
          type="tel"
          pattern="[0-9]*"
          maxLength={4}
          value={pin}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, '').slice(0, 4);
            setPin(val);
            if (val.length === 4) {
              handleVerify(val);
            }
          }}
          className="absolute opacity-0 pointer-events-none -top-10 left-0 w-1 h-1"
          aria-hidden="true"
        />

        {/* En-tête de la passerelle */}
        <div className="text-center space-y-2 pt-2">
          <div className={cn(
            "w-13 h-13 rounded-2xl mx-auto flex items-center justify-center shadow-lg transition-all duration-300",
            isSuccess 
              ? "bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-emerald-500/30 scale-110" 
              : isError
              ? "bg-gradient-to-tr from-rose-500 to-pink-600 text-white shadow-rose-500/30"
              : "bg-gradient-to-tr from-cyan-500 to-indigo-600 text-white shadow-cyan-500/30"
          )}>
            {isSuccess ? (
              <Check size={26} className="stroke-[3]" />
            ) : isError ? (
              <AlertCircle size={26} />
            ) : (
              <Lock size={24} className="stroke-[2.5]" />
            )}
          </div>

          <div>
            <h3 className="text-lg font-bold text-white tracking-tight flex items-center justify-center gap-1.5">
              <span>Déverrouillage Express</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono font-semibold">
                PIN
              </span>
            </h3>
            <p className={cn(
              "text-xs transition-colors mt-1 font-medium",
              isError ? "text-rose-400 font-semibold" : isSuccess ? "text-emerald-400 font-semibold" : "text-slate-400"
            )}>
              {statusMessage}
            </p>
          </div>
        </div>

        {/* 4 Indicateurs Lumineux de Code PIN (iOS / visionOS Passcode Style) */}
        <div className="flex items-center justify-center gap-4 py-5 my-1">
          {[0, 1, 2, 3].map((index) => {
            const isFilled = pin.length > index;
            return (
              <div
                key={index}
                className={cn(
                  "w-4 h-4 rounded-full transition-all duration-200 border",
                  isSuccess
                    ? "bg-emerald-400 border-emerald-300 shadow-[0_0_15px_rgba(52,211,153,0.8)] scale-110"
                    : isError
                    ? "bg-rose-500 border-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.8)] scale-105"
                    : isFilled
                    ? "bg-gradient-to-tr from-cyan-400 to-blue-500 border-cyan-300 shadow-[0_0_15px_rgba(56,189,248,0.7)] scale-110"
                    : "bg-white/[0.08] border-white/20"
                )}
              />
            );
          })}
        </div>

        {/* Clavier Numérique Tactile Liquid Glass (1 à 9 + 0) */}
        <div className="space-y-2.5 max-w-[260px] mx-auto">
          {keypadRows.map((row, rowIndex) => (
            <div key={rowIndex} className="flex justify-between gap-2.5">
              {row.map((item) => (
                <button
                  key={item.digit}
                  type="button"
                  onClick={() => handleAddDigit(item.digit)}
                  disabled={isVerifying || isSuccess}
                  className="w-18 h-14 rounded-2xl liquid-pill hover:border-cyan-400/50 flex flex-col items-center justify-center active:scale-95 transition-all text-white group cursor-pointer disabled:opacity-50"
                >
                  <span className="text-xl font-bold tracking-tight group-hover:text-cyan-300 transition-colors">
                    {item.digit}
                  </span>
                  {item.letters && (
                    <span className="text-[8px] font-bold tracking-widest text-slate-400 uppercase -mt-0.5">
                      {item.letters}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}

          {/* Dernière ligne : Effacer tout / 0 / Touche Retour */}
          <div className="flex justify-between gap-2.5">
            <button
              type="button"
              onClick={() => setPin('')}
              disabled={pin.length === 0 || isVerifying || isSuccess}
              className="w-18 h-14 rounded-2xl liquid-glass-subtle flex items-center justify-center text-[10px] font-bold text-slate-400 hover:text-white active:scale-95 transition-all cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed"
            >
              Effacer
            </button>

            <button
              type="button"
              onClick={() => handleAddDigit('0')}
              disabled={isVerifying || isSuccess}
              className="w-18 h-14 rounded-2xl liquid-pill hover:border-cyan-400/50 flex flex-col items-center justify-center active:scale-95 transition-all text-white group cursor-pointer disabled:opacity-50"
            >
              <span className="text-xl font-bold tracking-tight group-hover:text-cyan-300 transition-colors">
                0
              </span>
            </button>

            <button
              type="button"
              onClick={handleDeleteDigit}
              disabled={pin.length === 0 || isVerifying || isSuccess}
              className="w-18 h-14 rounded-2xl liquid-glass-subtle flex items-center justify-center text-slate-300 hover:text-white active:scale-95 transition-all cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed"
              title="Supprimer un chiffre"
            >
              <Delete size={18} />
            </button>
          </div>
        </div>

        {/* Pied de Modale : Bascule vers connexion classique E-mail / Google */}
        <div className="pt-4 mt-2 border-t border-white/10 text-center space-y-2">
          {onSwitchToClassicAuth && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onSwitchToClassicAuth();
              }}
              className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-semibold hover:underline transition-colors cursor-pointer"
            >
              <Mail size={13} />
              <span>Se connecter par E-mail ou Google</span>
            </button>
          )}

          <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400">
            <ShieldCheck size={11} className="text-emerald-400" />
            <span>Chiffrement SHA-256 • Accès complet à votre espace</span>
          </div>
        </div>
      </div>
    </div>
  );
};
