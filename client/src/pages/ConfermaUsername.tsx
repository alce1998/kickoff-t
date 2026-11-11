import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NavigationBar } from "@/components/NavigationBar";
import { useTheme } from "@/contexts/ThemeContext";

export default function ConfermaUsername() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [newUsername, setNewUsername] = useState<string>("");
  const [errorCode, setErrorCode] = useState<string>("");

  const { isModern } = useTheme();
  const confirmMutation = trpc.username.confirmChange.useMutation({
    onSuccess: (data) => {
      setNewUsername(data.username);
      setStatus("success");
    },
    onError: (err) => {
      setErrorCode(err.message);
      setStatus("error");
    },
  });

  useEffect(() => {
    if (token && token.length === 64) {
      confirmMutation.mutate({ token });
    } else {
      setErrorCode("TOKEN_INVALID");
      setStatus("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const getErrorMessage = () => {
    switch (errorCode) {
      case "TOKEN_INVALID": return t("username.tokenNonValido");
      case "TOKEN_EXPIRED": return t("username.tokenScaduto");
      case "USERNAME_TAKEN": return t("username.nonDisponibile");
      default: return t("common.errore");
    }
  };

  return (
    <>
      <NavigationBar onFeedbackClick={() => {}} />
      <div className={`min-h-screen ${isModern ? 'bg-gray-950' : 'bg-[#fce4ec]'} flex items-center justify-center p-4 font-mono`}>
        <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-md w-full">
          {/* Header */}
          <div className="bg-primary text-white p-6 border-b-4 border-black text-center">
            <h1 className="text-3xl font-display font-bold uppercase tracking-tight">
              {t("username.confermaEmail")}
            </h1>
          </div>

          {/* Body */}
          <div className="p-8 text-center">
            {status === "loading" && (
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-16 h-16 text-primary animate-spin" />
                <p className="text-lg font-bold uppercase tracking-widest text-gray-600">
                  {t("common.caricamento")}
                </p>
              </div>
            )}

            {status === "success" && (
              <div className="flex flex-col items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-green-100 border-4 border-green-500 flex items-center justify-center">
                  <Check className="w-10 h-10 text-green-500" />
                </div>
                <h2 className="text-2xl font-bold uppercase tracking-tight text-green-700">
                  {t("username.confermato")}
                </h2>
                <p className="text-gray-600">
                  {t("username.nuovoUsername")}: <strong className="text-primary text-xl">@{newUsername}</strong>
                </p>
                <Button
                  onClick={() => setLocation("/profilo")}
                  className="mt-4 bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-widest border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                >
                  {t("username.vaiAlProfilo")}
                </Button>
              </div>
            )}

            {status === "error" && (
              <div className="flex flex-col items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-red-100 border-4 border-red-500 flex items-center justify-center">
                  <X className="w-10 h-10 text-red-500" />
                </div>
                <h2 className="text-2xl font-bold uppercase tracking-tight text-red-700">
                  {t("username.erroreConferma")}
                </h2>
                <p className="text-gray-600">{getErrorMessage()}</p>
                <Button
                  onClick={() => setLocation("/profilo")}
                  variant="outline"
                  className="mt-4 font-bold uppercase tracking-widest border-3 border-black"
                >
                  {t("username.vaiAlProfilo")}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
