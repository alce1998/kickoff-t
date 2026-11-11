import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { User, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface UsernameOnboardingModalProps {
  isOpen: boolean;
  onComplete: (username: string) => void;
}

export function UsernameOnboardingModal({ isOpen, onComplete }: UsernameOnboardingModalProps) {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [debouncedUsername, setDebouncedUsername] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  // Debounce per il controllo disponibilità
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedUsername(username);
    }, 500);
    return () => clearTimeout(timer);
  }, [username]);

  const { data: availabilityData, isLoading: checkingAvailability } = trpc.username.checkAvailable.useQuery(
    { username: debouncedUsername },
    {
      enabled: debouncedUsername.length >= 2 && !validationError,
    }
  );

  const setUsernameMutation = trpc.username.setUsername.useMutation({
    onSuccess: (data) => {
      toast.success(`${t("username.benvenuto")} @${data.username}`);
      onComplete(data.username);
    },
    onError: (err) => {
      if (err.message === "USERNAME_TAKEN") {
        toast.error(t("username.nonDisponibile"));
      } else {
        toast.error(`${t("common.errore")}: ${err.message}`);
      }
    },
  });

  const validateUsername = (value: string): string | null => {
    if (value.length < 2) return t("username.troppoCorto");
    if (value.length > 10) return t("username.troppoLungo");
    if (!/^[a-zA-Z0-9_]+$/.test(value)) return t("username.caratteriNonValidi");
    return null;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.slice(0, 10);
    setUsername(val);
    setValidationError(val.length > 0 ? validateUsername(val) : null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateUsername(username);
    if (err) {
      setValidationError(err);
      return;
    }
    setUsernameMutation.mutate({ username });
  };

  const isAvailable = debouncedUsername.length >= 2 && !validationError && availabilityData?.available === true;
  const isTaken = debouncedUsername.length >= 2 && !validationError && availabilityData?.available === false;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white border-4 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] max-w-md w-full font-mono">
        {/* Header */}
        <div className="bg-primary text-white p-6 border-b-4 border-black">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 border-3 border-white flex items-center justify-center">
              <User className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-display font-bold uppercase tracking-tight">
                {t("username.scegli")}
              </h2>
              <p className="text-white/80 text-sm uppercase tracking-widest">
                {t("username.sottotitolo")}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-sm text-gray-600 mb-6 leading-relaxed">
            {t("username.descrizione")}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Input username */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-2 text-gray-700">
                {t("username.label")}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">@</span>
                <Input
                  value={username}
                  onChange={handleChange}
                  placeholder={t("username.placeholder")}
                  maxLength={10}
                  className={`pl-8 border-3 font-mono text-lg uppercase tracking-wider h-12 ${
                    validationError
                      ? "border-red-500 focus:border-red-500"
                      : isAvailable
                      ? "border-green-500 focus:border-green-500"
                      : isTaken
                      ? "border-red-400 focus:border-red-400"
                      : "border-black"
                  }`}
                  autoFocus
                />
                {/* Indicatore stato */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {checkingAvailability && debouncedUsername.length >= 2 && !validationError && (
                    <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                  )}
                  {isAvailable && <Check className="w-5 h-5 text-green-500" />}
                  {isTaken && <X className="w-5 h-5 text-red-500" />}
                </div>
              </div>
              {/* Contatore caratteri */}
              <div className="flex justify-between items-center mt-1">
                <div className="text-xs h-4">
                  {validationError && (
                    <span className="text-red-500">{validationError}</span>
                  )}
                  {!validationError && isAvailable && (
                    <span className="text-green-600 font-bold">{t("username.disponibile")}</span>
                  )}
                  {!validationError && isTaken && (
                    <span className="text-red-500">{t("username.nonDisponibile")}</span>
                  )}
                </div>
                <span className={`text-xs font-bold ${username.length >= 10 ? "text-red-500" : "text-gray-400"}`}>
                  {username.length}/10
                </span>
              </div>
            </div>

            {/* Regole */}
            <div className="bg-gray-50 border-2 border-gray-200 p-3 text-xs text-gray-600 space-y-1">
              <p className="font-bold uppercase tracking-wide text-gray-700 mb-2">{t("username.regole")}</p>
              <p>• {t("username.regola1")}</p>
              <p>• {t("username.regola2")}</p>
              <p>• {t("username.regola3")}</p>
            </div>

            {/* Pulsante conferma */}
            <Button
              type="submit"
              disabled={!isAvailable || setUsernameMutation.isPending}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-widest text-base border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {setUsernameMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t("common.caricamento")}</>
              ) : (
                t("username.conferma")
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
