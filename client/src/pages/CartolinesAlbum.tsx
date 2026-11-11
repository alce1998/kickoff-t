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

// Tipo stadio
interface Stadio {
  id: string;
  nome: string;
  capienza: string;
  anno: string;
  campionato: string;
  squadre: string[];
  foto: string;
}

// Tipo progresso
interface ProgressoStadio {
  stadiumId: string;
  solved: number;
  hintsUsed: string | null;
}

const CAMPIONATI = [
  { key: "Serie A", label: "Serie A", flag: "🇮🇹" },
  { key: "Premier League", label: "Premier League", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { key: "La Liga", label: "La Liga", flag: "🇪🇸" },
  { key: "Ligue 1", label: "Ligue 1", flag: "🇫🇷" },
  { key: "Bundesliga", label: "Bundesliga", flag: "🇩🇪" },
  { key: "Resto del Mondo", label: "Resto del Mondo", flag: "🌍" },
];

// Hook per lazy loading immagini con IntersectionObserver
function useLazyImage(src: string) {
  const ref = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible, loaded, setLoaded };
}

// Componente card stadio con lazy loading
function StadioCard({ stadio, isSolved, onClick }: { stadio: Stadio; isSolved: boolean; onClick: () => void }) {
  const { ref, visible, loaded, setLoaded } = useLazyImage(stadio.foto);
  return (
    <div
      ref={ref}
      onClick={onClick}
      className={`relative cursor-pointer border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all duration-200 group overflow-hidden ${
        isSolved ? "ring-4 ring-green-500" : ""
      }`}
    >
      <div className="aspect-[4/3] relative overflow-hidden bg-gray-200">
        {visible && (
          <img
            src={stadio.foto}
            alt={isSolved ? stadio.nome : "???"}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${
              isSolved ? "" : "grayscale brightness-75"
            } ${loaded ? "opacity-100" : "opacity-0"}`}
            onError={(e) => {
              (e.target as HTMLImageElement).src = "https://via.placeholder.com/400x300?text=Stadio";
              setLoaded(true);
            }}
          />
        )}
        {!loaded && <div className="absolute inset-0 bg-gray-200 animate-pulse" />}
        {!isSolved && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-white font-black text-2xl drop-shadow-lg">???</span>
          </div>
        )}
        {isSolved && (
          <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <Trophy className="w-4 h-4" />
          </div>
        )}
      </div>
      <div
        className={`p-2 text-center font-bold text-sm uppercase border-t-2 border-black ${
          isSolved ? "bg-green-50 text-green-800" : "bg-black text-white"
        }`}
      >
        {isSolved ? stadio.nome : "???"}
      </div>
    </div>
  );
}

export default function CartolinesAlbum() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { user } = useAuth();
  const loginUrl = getLoginUrl();
  const { t } = useTranslation();
  const { unlock } = useAchievements();
  const recordGamePlayed = trpc.achievements.recordGamePlayed.useMutation();
  const [stadi, setStadi] = useState<Stadio[]>([]);
  // Legge il campionato dall'URL query param (es. ?campionato=La+Liga)
  const initialCampionato = new URLSearchParams(search).get("campionato") ?? "Serie A";
  const [selectedCampionato, setSelectedCampionato] = useState(initialCampionato);
  const [loadingStadi, setLoadingStadi] = useState(true);

  // Poliglotta: record that the user played this game
  useEffect(() => {
    if (user) recordGamePlayed.mutate({ gameType: 'cartoline' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Carica dati stadi
  useEffect(() => {
    fetch("/data/stadi_cartoline.65c9338a.json?v=121")
      .then((r) => r.json())
      .then((data: Stadio[]) => {
        setStadi(data);
        setLoadingStadi(false);
      })
      .catch(() => {
        toast.error("Errore nel caricamento degli stadi");
        setLoadingStadi(false);
      });
  }, []);

  // Carica progressi utente (solo se loggato)
  const { data: progressData, refetch: refetchProgress } =
    trpc.cartoline.getProgress.useQuery(undefined, {
      enabled: !!user,
    });

  const progressMap: Record<string, ProgressoStadio> = {};
  if (progressData?.progress) {
    for (const p of progressData.progress) {
      progressMap[p.stadiumId] = p;
    }
  }

  const stadiCampionato = stadi.filter(
    (s) => s.campionato === selectedCampionato
  );
  const solvedCount = stadiCampionato.filter(
    (s) => progressMap[s.id]?.solved === 1
  ).length;
  const totalCount = stadiCampionato.length;

  // Collezionista: unlock when all stadiums in a competition are solved
  useEffect(() => {
    if (!user || totalCount === 0 || solvedCount < totalCount) return;
    // All stadiums in this competition are solved
    const allCampionati = CAMPIONATI.map(c => c.key);
    const allSolvedCampionati = allCampionati.filter(campId => {
      const stadiC = stadi.filter(s => s.campionato === campId);
      return stadiC.length > 0 && stadiC.every(s => progressMap[s.id]?.solved === 1);
    });
    const candidates: { achievementId: string; tier: 1 | 2 | 3 }[] = [
      { achievementId: 'collezionista', tier: 1 }, // Bronze: complete 1 competition
    ];
    if (allSolvedCampionati.length >= 3) candidates.push({ achievementId: 'collezionista', tier: 2 }); // Silver: 3 competitions
    if (allSolvedCampionati.length >= CAMPIONATI.length) candidates.push({ achievementId: 'collezionista', tier: 3 }); // Gold: all competitions
    unlock(candidates);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, solvedCount, totalCount, selectedCampionato]);

  const handleCardClick = (stadio: Stadio) => {
    if (!user) {
      window.location.href = loginUrl;
      return;
    }
    // Passa il campionato come query param per il pulsante "torna all'album"
    setLocation(`/cartoline/${stadio.id}?from=${encodeURIComponent(stadio.campionato)}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <NavigationBar onFeedbackClick={() => {}} />

      <div className="container max-w-5xl pt-20 pb-12 px-4">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="outline"
            onClick={() => setLocation("/")}
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

          {/* Punti indizio */}
          {user && (
            <div className="ml-auto flex items-center gap-2 bg-amber-100 border-2 border-black px-4 py-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
              <span className="font-bold text-lg">
                {progressData?.points ?? 0}
              </span>
              <span className="text-sm font-bold text-muted-foreground uppercase">
                {t("cartoline.puntiIndizio", "Punti Indizio")}
              </span>
            </div>
          )}
        </div>

        {/* Tabs campionati */}
        <div className="flex flex-wrap gap-2 mb-6">
          {CAMPIONATI.map((c) => {
            const stadiC = stadi.filter((s) => s.campionato === c.key);
            const solvedC = stadiC.filter(
              (s) => progressMap[s.id]?.solved === 1
            ).length;
            return (
              <button
                key={c.key}
                onClick={() => setSelectedCampionato(c.key)}
                className={`flex items-center gap-2 px-4 py-2 font-bold uppercase text-sm border-2 border-black transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${
                  selectedCampionato === c.key
                    ? "bg-black text-white"
                    : "bg-white text-black hover:bg-gray-50"
                }`}
              >
                <span>{c.flag}</span>
                <span>{c.label}</span>
                {user && (
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                      solvedC === stadiC.length && stadiC.length > 0
                        ? "bg-green-500 text-white"
                        : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {solvedC}/{stadiC.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Barra progresso campionato */}
        {user && totalCount > 0 && (
          <div className="mb-6 bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold uppercase text-sm">
                {t("cartoline.progresso", "Progresso")} {selectedCampionato}
              </span>
              <span className="font-bold text-lg">
                {solvedCount}/{totalCount}
              </span>
            </div>
            <div className="w-full bg-gray-200 h-4 border-2 border-black">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-500"
                style={{ width: `${(solvedCount / totalCount) * 100}%` }}
              />
            </div>
            {solvedCount === totalCount && (
              <div className="mt-2 flex items-center gap-2 text-green-600 font-bold">
                <Trophy className="w-4 h-4" />
                {t("cartoline.completato", "Campionato completato!")}
              </div>
            )}
          </div>
        )}

        {/* Messaggio login */}
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

        {/* Griglia stadi */}
        {loadingStadi ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[4/3] bg-gray-200 animate-pulse border-2 border-black"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {stadiCampionato.map((stadio) => {
              const progresso = progressMap[stadio.id];
              const isSolved = progresso?.solved === 1;
              return (
                <StadioCard
                  key={stadio.id}
                  stadio={stadio}
                  isSolved={isSolved}
                  onClick={() => handleCardClick(stadio)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
