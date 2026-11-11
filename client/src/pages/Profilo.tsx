import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { NavigationBar } from "@/components/NavigationBar";
import { FeedbackModal } from "@/components/FeedbackModal";
import { Button } from "@/components/ui/button";
import { User, Mail, Calendar, Shield, LogOut, Trophy, TrendingUp, Target, Clock, Star, AtSign, Pencil, Loader2, Check, X } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "../lib/trpc";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";

export default function Profilo() {
  const { isModern } = useTheme();
  const bgPage = isModern ? "bg-gray-950 text-gray-100" : "bg-[#fce4ec] text-black";
  const bgAccent = isModern ? "bg-gray-900 border-gray-700" : "bg-[#fce4ec] border-black";
  const { user, isAuthenticated, loading, logout } = useAuth({
    redirectOnUnauthenticated: true,
  });
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [, setLocation] = useLocation();
  const [showUsernameForm, setShowUsernameForm] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [debouncedUsername, setDebouncedUsername] = useState("");
  const [usernameValidationError, setUsernameValidationError] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const { data: userStats } = trpc.gameScores.getUserStats.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { t } = useTranslation();

  // Debounce per controllo disponibilità username
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedUsername(newUsername), 500);
    return () => clearTimeout(timer);
  }, [newUsername]);

  const { data: usernameAvailability, isLoading: checkingUsername } = trpc.username.checkAvailable.useQuery(
    { username: debouncedUsername },
    { enabled: debouncedUsername.length >= 2 && !usernameValidationError }
  );

  const requestChangeMutation = trpc.username.requestChange.useMutation({
    onSuccess: () => {
      toast.success(t("username.emailInviata"));
      setShowUsernameForm(false);
      setNewUsername("");
    },
    onError: (err) => {
      if (err.message === "USERNAME_TAKEN") toast.error(t("username.nonDisponibile"));
      else toast.error(`${t("common.errore")}: ${err.message}`);
    },
  });

  const validateUsername = (value: string): string | null => {
    if (value.length < 2) return t("username.troppoCorto");
    if (value.length > 10) return t("username.troppoLungo");
    if (!/^[a-zA-Z0-9_]+$/.test(value)) return t("username.caratteriNonValidi");
    return null;
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.slice(0, 10);
    setNewUsername(val);
    setUsernameValidationError(val.length > 0 ? validateUsername(val) : null);
  };

  const handleSubmitUsernameChange = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateUsername(newUsername);
    if (err) { setUsernameValidationError(err); return; }
    requestChangeMutation.mutate({ newUsername });
  };

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  if (loading) {
    return (
      <>
        <NavigationBar onFeedbackClick={() => setIsFeedbackOpen(true)} />
        <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
        <div className={`min-h-screen ${bgPage} flex items-center justify-center font-mono`}>
          <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8 text-center">
            <p className="text-xl font-bold uppercase tracking-widest">{t('profilo.caricamento')}</p>
          </div>
        </div>
      </>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  const isUsernameAvailable = debouncedUsername.length >= 2 && !usernameValidationError && usernameAvailability?.available === true;
  const isUsernameTaken = debouncedUsername.length >= 2 && !usernameValidationError && usernameAvailability?.available === false;

  const gameLabels: Record<string, string> = {
    link: "🔗 LINK",
    progressione: "📈 PROGRESSIONE",
    formazioni: "⚽ FORMAZIONI",
    carriere: "🏆 CARRIERE",
  };

  return (
    <>
      <NavigationBar onFeedbackClick={() => setIsFeedbackOpen(true)} />
      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />

      <div className={`min-h-screen ${bgPage} font-mono pt-20 pb-12 px-4`}>
        <div className="max-w-2xl mx-auto">

          {/* Titolo pagina */}
          <div className="text-center mb-8">
            <h1 className="text-5xl md:text-6xl font-display font-bold uppercase tracking-tighter text-primary mb-1">
              {t('profilo.titolo')}
            </h1>
            <p className="text-sm font-bold uppercase tracking-widest text-gray-600">
              {t('profilo.sottotitolo')}
            </p>
          </div>

          {/* Card principale utente */}
          <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] mb-6">
            {/* Header card */}
            <div className="bg-primary text-white p-6 border-b-4 border-black">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-white/20 border-4 border-white flex items-center justify-center shrink-0">
                  <User className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-display font-bold uppercase truncate">{user.username ? `@${user.username}` : user.name}</h2>
                  <p className="text-white/80 text-sm font-bold uppercase tracking-widest">
                    {t('profilo.membro')}
                  </p>
                </div>
                <div className="bg-yellow-400 text-black border-2 border-black px-3 py-2 text-center shrink-0 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-black" />
                    <span className="font-bold text-lg">{user.eloRating || 1200}</span>
                  </div>
                  <div className="text-xs font-bold uppercase">ELO</div>
                </div>
              </div>
            </div>

            {/* Corpo card */}
            <div className="p-6 space-y-6">

              {/* Sezione Username */}
              <div>
                <h3 className="font-display font-bold uppercase text-lg mb-4 flex items-center gap-2 border-b-2 border-black pb-2">
                  <AtSign className="w-5 h-5 text-primary" />
                  {t('username.label')}
                </h3>
                <div className={`flex items-center gap-3 p-3 ${bgAccent} border-2 mb-3`}>
                  <AtSign className="w-5 h-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold uppercase text-gray-500">{t('username.label')}</p>
                    <p className="font-bold text-lg">{user.username ? `@${user.username}` : <span className="text-gray-400 italic text-sm">{t('username.nonImpostato')}</span>}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowUsernameForm(!showUsernameForm)}
                    className="border-2 border-black font-bold uppercase text-xs shrink-0"
                  >
                    <Pencil className="w-3 h-3 mr-1" />
                    {t('username.cambia')}
                  </Button>
                </div>

                {showUsernameForm && (
                  <form onSubmit={handleSubmitUsernameChange} className="bg-white border-2 border-black p-4 space-y-3">
                    <p className="text-xs text-gray-600">{t('username.descrizioneChange')}</p>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">@</span>
                      <Input
                        value={newUsername}
                        onChange={handleUsernameChange}
                        placeholder={t('username.placeholder')}
                        maxLength={10}
                        className={`pl-8 border-2 font-mono uppercase tracking-wider ${
                          usernameValidationError ? "border-red-500" :
                          isUsernameAvailable ? "border-green-500" :
                          isUsernameTaken ? "border-red-400" : "border-black"
                        }`}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {checkingUsername && debouncedUsername.length >= 2 && !usernameValidationError && <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />}
                        {isUsernameAvailable && <Check className="w-4 h-4 text-green-500" />}
                        {isUsernameTaken && <X className="w-4 h-4 text-red-500" />}
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs h-4">
                        {usernameValidationError && <span className="text-red-500">{usernameValidationError}</span>}
                        {!usernameValidationError && isUsernameAvailable && <span className="text-green-600 font-bold">{t('username.disponibile')}</span>}
                        {!usernameValidationError && isUsernameTaken && <span className="text-red-500">{t('username.nonDisponibile')}</span>}
                      </span>
                      <span className={`text-xs font-bold ${newUsername.length >= 10 ? "text-red-500" : "text-gray-400"}`}>{newUsername.length}/10</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        disabled={!isUsernameAvailable || requestChangeMutation.isPending}
                        className="flex-1 bg-primary text-white font-bold uppercase text-xs border-2 border-black"
                      >
                        {requestChangeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t('username.inviaConferma')}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => { setShowUsernameForm(false); setNewUsername(""); }}
                        className="border-2 border-black font-bold uppercase text-xs"
                      >
                        {t('common.annulla')}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 italic">{t('username.emailConfermaInfo')}</p>
                  </form>
                )}
              </div>

              {/* Informazioni Account */}
              <div>
                <h3 className="font-display font-bold uppercase text-lg mb-4 flex items-center gap-2 border-b-2 border-black pb-2">
                  <Shield className="w-5 h-5 text-primary" />
                  {t('profilo.infoAccount')}
                </h3>
                <div className="space-y-3">
                  <div className={`flex items-center gap-3 p-3 ${bgAccent} border-2`}>
                    <User className="w-5 h-5 text-primary shrink-0" />
                    <div>
                      <p className="text-xs font-bold uppercase text-gray-500">{t('profilo.nome')}</p>
                      <p className="font-bold">{user.name}</p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-3 p-3 ${bgAccent} border-2`}>
                    <Mail className="w-5 h-5 text-primary shrink-0" />
                    <div>
                      <p className="text-xs font-bold uppercase text-gray-500">{t('profilo.email')}</p>
                      <p className="font-bold">{user.email}</p>
                    </div>
                  </div>
                  {user.role && (
                    <div className={`flex items-center gap-3 p-3 ${bgAccent} border-2`}>
                      <Shield className="w-5 h-5 text-primary shrink-0" />
                      <div>
                        <p className="text-xs font-bold uppercase text-gray-500">{t('profilo.ruolo')}</p>
                        <p className="font-bold capitalize">
                          {user.role === "admin" ? t('profilo.admin') : t('profilo.utente')}
                        </p>
                      </div>
                    </div>
                  )}
                  {user.createdAt && (
                    <div className={`flex items-center gap-3 p-3 ${bgAccent} border-2`}>
                      <Calendar className="w-5 h-5 text-primary shrink-0" />
                      <div>
                        <p className="text-xs font-bold uppercase text-gray-500">{t('profilo.membroDal')}</p>
                        <p className="font-bold">
                          {new Date(user.createdAt).toLocaleDateString("it-IT", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Storico Punteggi */}
              {userStats && userStats.totalGames > 0 && (
                <div>
                  <h3 className="font-display font-bold uppercase text-lg mb-4 flex items-center gap-2 border-b-2 border-black pb-2">
                    <Trophy className="w-5 h-5 text-primary" />
                    {t('profilo.statistiche')}
                  </h3>

                  {/* Totale partite */}
                  <div className="bg-primary text-white border-2 border-black p-4 mb-4 flex items-center gap-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <Target className="w-6 h-6 shrink-0" />
                    <div>
                      <p className="text-xs font-bold uppercase text-white/80">{t('profilo.partiteTotali')}</p>
                      <p className="text-3xl font-display font-bold">{userStats.totalGames}</p>
                    </div>
                  </div>

                  {/* Statistiche per gioco */}
                  <div className="space-y-3">
                    {Object.entries(userStats.statsByGame).map(([gameType, stats]) => (
                      <div key={gameType} className={`${isModern ? 'bg-gray-900 border-gray-700 rounded-xl' : 'bg-[#fce4ec] border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'} border-2 p-4`}>
                        <h4 className="font-display font-bold uppercase text-base mb-3 flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-primary" />
                          {gameLabels[gameType] || gameType}
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-white border-2 border-black p-2 text-center">
                            <p className="text-xs font-bold uppercase text-gray-500">{t('profilo.partite')}</p>
                            <p className="text-xl font-bold">{stats.totalGames}</p>
                          </div>
                          <div className="bg-white border-2 border-black p-2 text-center">
                            <p className="text-xs font-bold uppercase text-gray-500">{t('profilo.migliorScore')}</p>
                            <p className="text-xl font-bold">{stats.bestScore}</p>
                          </div>
                          {stats.bestTime !== null && (
                            <>
                              <div className="bg-white border-2 border-black p-2 text-center">
                                <p className="text-xs font-bold uppercase text-gray-500 flex items-center justify-center gap-1">
                                  <Clock className="w-3 h-3" /> {t('profilo.migliorTempo')}
                                </p>
                                <p className="text-xl font-bold">
                                  {Math.floor(stats.bestTime / 60)}:{(stats.bestTime % 60).toString().padStart(2, "0")}
                                </p>
                              </div>
                              {stats.averageTime !== null && (
                                <div className="bg-white border-2 border-black p-2 text-center">
                                  <p className="text-xs font-bold uppercase text-gray-500">{t('profilo.tempoMedio')}</p>
                                  <p className="text-xl font-bold">
                                    {Math.floor(stats.averageTime / 60)}:{(stats.averageTime % 60).toString().padStart(2, "0")}
                                  </p>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Azioni */}
              <div className="pt-4 border-t-2 border-black">
                <Button
                  onClick={handleLogout}
                  className="w-full font-display font-bold uppercase text-base py-6 bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:shadow-none transition-all"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  {t('profilo.esci')}
                </Button>
              </div>
            </div>
          </div>

          {/* Nota privacy */}
          <p className="text-center text-xs font-bold uppercase text-gray-500 tracking-widest">
            {t('profilo.notePrivacy')}
          </p>
        </div>
      </div>
    </>
  );
}
