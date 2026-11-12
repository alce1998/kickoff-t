// CartolinesAlbum.tsx – renders the player figurine album
import { useState, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { NavigationBar } from "@/components/NavigationBar";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ChevronLeft, Lock, Star, Trophy } from "lucide-react";
import { useAchievements } from "@/hooks/useAchievements";
import { FigurineCard } from "@/components/FigurineCard";

// Campionato UI (kept for layout consistency – optional filtering later)
const CAMPIONATI = [
  { key: "Serie A", label: "Serie A", flag: "🇮🇹" },
  { key: "Premier League", label: "Premier League", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { key: "La Liga", label: "La Liga", flag: "🇪🇸" },
  { key: "Ligue 1", label: "Ligue 1", flag: "🇫🇷" },
  { key: "Bundesliga", label: "Bundesliga", flag: "🇩🇪" },
  { key: "Resto del Mondo", label: "Resto del Mondo", flag: "🌍" },
];

// Player data interface (matches figurine_players.json)
interface Player {
  player_id: string;
  name: string;
  photo_url: string;
  nationality: string;
  position: string;
  isGuessed?: boolean;
}

export default function CartolinesAlbum() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { user } = useAuth();
  const loginUrl = getLoginUrl();
  const { t } = useTranslation();
  const { unlock } = useAchievements();
  const recordGamePlayed = trpc.achievements.recordGamePlayed.useMutation();
const { data: progressData } = trpc.cartoline.getProgress.useQuery(undefined, { enabled: !!user });

  // Load player data
  const [players, setPlayers] = useState<Player[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);

  // Selected "campionato" (kept for UI – currently does not filter players)
  const initialCampionato = new URLSearchParams(search).get("campionato") ?? "Serie A";
  const [selectedCampionato, setSelectedCampionato] = useState(initialCampionato);

  // Record album visit
  useEffect(() => {
    if (user) recordGamePlayed.mutate({ gameType: "cartoline" });
  }, [user?.id]);

  // Fetch player JSON
  useEffect(() => {
    fetch("/data/figurine_players.json")
      .then((r) => r.json())
      .then((data: Player[]) => {
        const normalized = data.map((p) => ({ ...p, isGuessed: p.isGuessed ?? false }));
        setPlayers(normalized);
        setLoadingPlayers(false);
      })
      .catch(() => {
        toast.error("Errore nel caricamento delle figurine dei giocatori");
        setLoadingPlayers(false);
      });
  }, []);

  // Listen for external guess events (e.g., from a game page)
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const guessedId = e.detail?.id;
      if (!guessedId) return;
      setPlayers((prev) =>
        prev.map((p) => (p.player_id === guessedId ? { ...p, isGuessed: true } : p))
      );
    };
    window.addEventListener("figurine-guessed", handler as EventListener);
    return () => window.removeEventListener("figurine-guessed", handler as EventListener);
  }, []);

  const handleBack = () => setLocation("/");

  // For now we display all players; you could filter by selectedCampionato if needed.
  const displayedPlayers = players;

  // Compute simple progress (number of guessed players)
  const guessedCount = displayedPlayers.filter((p) => p.isGuessed).length;
  const totalCount = displayedPlayers.length;

  return (
    <div className="min-h-screen bg-background">
      <NavigationBar onFeedbackClick={() => {}} />
      <div className="container max-w-5xl pt-20 pb-12 px-4">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="outline"
            onClick={handleBack}
            className="border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            {t("common.indietro", "Indietro")}
          </Button>
          <div>
            <h1 className="text-4xl md:text-5xl font-display font-bold uppercase tracking-tighter text-primary">
              🏟️ {t("cartoline.titolo", "CARTOLINE")}
            </h1>
            <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs mt-1">
              {t("cartoline.sottotitolo", "Completa il tuo album degli stadi")}
            </p>
          </div>
          {user && (
            <div className="ml-auto flex items-center gap-2 bg-amber-100 border-2 border-black px-4 py-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
              <span className="font-bold text-lg">{progressData?.points ?? 0}</span>
              <span className="text-sm font-bold text-muted-foreground uppercase">
                {t("cartoline.puntiIndizio", "Punti Indizio")} 
              </span>
            </div>
          )}
        </div>
        {/* Campionato tabs (kept for UI) */}
        <div className="flex flex-wrap gap-2 mb-6">
          {CAMPIONATI.map((c) => (
            <button
              key={c.key}
              onClick={() => setSelectedCampionato(c.key)}
              className={`flex items-center gap-2 px-4 py-2 font-bold uppercase text-sm border-2 border-black transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${
                selectedCampionato === c.key ? "bg-black text-white" : "bg-white text-black hover:bg-gray-50"
              }`}
            >
              <span>{c.flag}</span>
              <span>{c.label}</span>
            </button>
          ))}
        </div>
        {/* Simple progress bar for guessed players */}
        {user && totalCount > 0 && (
          <div className="mb-6 bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold uppercase text-sm">{t("cartoline.progresso", "Progresso")} ({selectedCampionato})</span>
              <span className="font-bold text-lg">{guessedCount}/{totalCount}</span>
            </div>
            <div className="w-full bg-gray-200 h-4 border-2 border-black">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-500"
                style={{ width: `${(guessedCount / totalCount) * 100}%` }}
              />
            </div>
            {guessedCount === totalCount && (
              <div className="mt-2 flex items-center gap-2 text-green-600 font-bold">
                <Trophy className="w-4 h-4" />
                {t("cartoline.completato", "Campionato completato!")}
              </div>
            )}
          </div>
        )}
        {/* Login prompt */}
        {!user && (
          <div className="mb-6 bg-blue-50 border-2 border-blue-400 p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-blue-500" />
              <span className="font-bold text-blue-800">
                {t(
                  "cartoline.loginRichiesto",
                  "Accedi per salvare i tuoi progressi e guadagnare punti indizio"
                )}
              </span>
            </div>
            <Button
              onClick={() => (window.location.href = loginUrl)}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] whitespace-nowrap"
            >
              {t("common.accedi", "Accedi")}
            </Button>
          </div>
        )}
        {/* Grid of player figurines */}
        {loadingPlayers ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[4/3] bg-gray-200 animate-pulse border-2 border-black" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {displayedPlayers.map((p) => (
              <FigurineCard
                key={p.player_id}
                src={p.photo_url}
                playerName={p.name}
                nationality={p.nationality}
                role={p.position}
                guessed={p.isGuessed ?? false}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
