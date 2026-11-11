import React, { useState, useEffect, useRef, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Star,
  Check,
  X,
  Trophy,
  BookOpen,
  Maximize2,
  Minimize2,
} from "lucide-react";

export interface FigurinaPlayer {
  numero: number;
  player_id: string;
  name: string;
  birth_year: number;
  photo_url: string;
  serie_a_apps: number;
  nationality: string;
  position: string;
}

interface LocalFigurineState {
  solvedIds: string[];
  hintsByPlayer: Record<string, string[]>;
  points: number;
}

const LOCAL_STORAGE_KEY = "kickoff_figurine_progress_v1";

function loadLocalState(): LocalFigurineState {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        solvedIds: Array.isArray(parsed.solvedIds) ? parsed.solvedIds : [],
        hintsByPlayer: parsed.hintsByPlayer || {},
        points: typeof parsed.points === "number" ? parsed.points : 0,
      };
    }
  } catch {
    // ignore
  }
  return { solvedIds: [], hintsByPlayer: {}, points: 0 };
}

function saveLocalState(state: LocalFigurineState) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

function normalizeStr(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

function matchesPlayerName(guess: string, fullName: string): boolean {
  const normGuess = normalizeStr(guess);
  const normFull = normalizeStr(fullName);
  if (!normGuess) return false;
  if (normGuess === normFull) return true;
  const parts = fullName.split(" ").map(normalizeStr).filter(Boolean);
  return parts.some((p) => p.length > 2 && p === normGuess);
}

function maskPlayerName(fullName: string): string {
  return fullName
    .split(" ")
    .map((part) => {
      if (part.length <= 2) return part[0] + ".";
      return (
        part[0] +
        "_".repeat(Math.max(1, part.length - 2)) +
        part[part.length - 1]
      );
    })
    .join("  ");
}

function FigurinaThumb({
  player,
  isSolved,
  onClick,
}: {
  player: FigurinaPlayer;
  isSolved: boolean;
  onClick: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "250px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      onClick={onClick}
      title={`#${player.numero}`}
      className={`relative aspect-[3/4] cursor-pointer border-3 border-black bg-gray-200 overflow-hidden shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all group ${
        isSolved ? "ring-3 ring-green-500" : ""
      }`}
    >
      {visible && (
        <img
          src={player.photo_url}
          alt="Figurina"
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              "https://via.placeholder.com/300x400?text=Figurina";
            setLoaded(true);
          }}
          className={`w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-105 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
      {!loaded && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse" />
      )}
      {isSolved && (
        <div className="absolute top-1.5 right-1.5 bg-green-500 text-white rounded-full p-1 border-2 border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
          <Trophy className="w-3.5 h-3.5" />
        </div>
      )}
    </div>
  );
}

const RANGES = [
  { label: "1–200", min: 1, max: 200 },
  { label: "201–400", min: 201, max: 400 },
  { label: "401–600", min: 401, max: 600 },
  { label: "601–800", min: 601, max: 800 },
  { label: "801–1000", min: 801, max: 1000 },
  { label: "1001–1200", min: 1001, max: 1200 },
  { label: "1201–1400", min: 1201, max: 1400 },
  { label: "1401–1538", min: 1401, max: 1538 },
  { label: "Tutte", min: 1, max: 9999 },
];

export function FigurinePopup() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [players, setPlayers] = useState<FigurinaPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<FigurinaPlayer | null>(
    null
  );
  const [selectedRangeIdx, setSelectedRangeIdx] = useState(0);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "unsolved" | "solved"
  >("all");

  // Local fallback state (used when not logged in or alongside server state)
  const [localState, setLocalState] = useState<LocalFigurineState>(() =>
    loadLocalState()
  );

  // Detail view state
  const [guess, setGuess] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [attempts, setAttempts] = useState<
    { value: string; correct: boolean }[]
  >([]);
  const [justSolved, setJustSolved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load dataset when popup opens (or eagerly after mount)
  useEffect(() => {
    setLoading(true);
    fetch("/data/figurine_players.json?v=1538")
      .then((r) => r.json())
      .then((data: FigurinaPlayer[]) => {
        setPlayers(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  // Server progress for logged-in user
  const { data: serverData, refetch: refetchServer } =
    trpc.figurine.getProgress.useQuery(undefined, {
      enabled: !!user,
    });

  const solveMutation = trpc.figurine.solvePlayer.useMutation({
    onSuccess: () => {
      refetchServer();
    },
  });

  const hintMutation = trpc.figurine.useHint.useMutation({
    onSuccess: () => {
      refetchServer();
    },
  });

  // Combined solved set & hints & points
  const solvedSet = useMemo(() => {
    const s = new Set<string>(localState.solvedIds);
    if (serverData?.progress) {
      for (const p of serverData.progress) {
        if (p.solved === 1) s.add(p.playerId);
      }
    }
    return s;
  }, [localState.solvedIds, serverData]);

  const getPlayerHints = (playerId: string): string[] => {
    const set = new Set<string>(localState.hintsByPlayer[playerId] || []);
    if (serverData?.progress) {
      const row = serverData.progress.find((p) => p.playerId === playerId);
      if (row?.hintsUsed) {
        try {
          const parsed: string[] = JSON.parse(row.hintsUsed);
          parsed.forEach((h) => set.add(h));
        } catch {
          // ignore
        }
      }
    }
    return Array.from(set);
  };

  const currentPoints = user
    ? Math.max(serverData?.points ?? 0, localState.points)
    : localState.points;

  const allPlayerNames = useMemo(
    () =>
      Array.from(new Set(players.map((p) => p.name))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [players]
  );

  // Reset detail state when switching selected player
  useEffect(() => {
    setGuess("");
    setShowDropdown(false);
    setAttempts([]);
    setJustSolved(false);
  }, [selectedPlayer?.player_id]);

  const handleGuess = () => {
    if (!guess.trim() || !selectedPlayer) return;
    const isCorrect = matchesPlayerName(guess.trim(), selectedPlayer.name);
    setAttempts((prev) => [{ value: guess.trim(), correct: isCorrect }, ...prev]);
    setGuess("");
    setShowDropdown(false);

    if (isCorrect) {
      const alreadySolved = solvedSet.has(selectedPlayer.player_id);
      setJustSolved(true);
      if (!alreadySolved) {
        const nextState: LocalFigurineState = {
          ...localState,
          solvedIds: [...localState.solvedIds, selectedPlayer.player_id],
          points: localState.points + 1,
        };
        setLocalState(nextState);
        saveLocalState(nextState);
        toast.success("🏆 Figurina sbloccata! +1 Punto Indizio", {
          duration: 3500,
        });
      }
      if (user) {
        solveMutation.mutate({ playerId: selectedPlayer.player_id });
      }
    } else {
      toast.error("Nome errato, riprova!", { duration: 2000 });
    }
  };

  const handleUseHint = (
    hintType: "anno_ruolo" | "nazionalita_presenze" | "iniziali"
  ) => {
    if (!selectedPlayer) return;
    const revealed = getPlayerHints(selectedPlayer.player_id);
    if (revealed.includes(hintType)) return;

    const cost = hintType === "iniziali" ? 3 : 1;
    if (currentPoints < cost) {
      toast.error(
        `Punti indizio insufficienti! (Necessari: ${cost} pt, hai: ${currentPoints} pt)`
      );
      return;
    }

    const nextHints = [...revealed, hintType];
    const nextState: LocalFigurineState = {
      ...localState,
      hintsByPlayer: {
        ...localState.hintsByPlayer,
        [selectedPlayer.player_id]: nextHints,
      },
      points: Math.max(0, currentPoints - cost),
    };
    setLocalState(nextState);
    saveLocalState(nextState);

    if (user) {
      hintMutation.mutate({
        playerId: selectedPlayer.player_id,
        hintType,
      });
    } else {
      toast.success(
        `Indizio svelato! (Punti rimasti: ${Math.max(0, currentPoints - cost)})`
      );
    }
  };

  const activeRange = RANGES[selectedRangeIdx] || RANGES[0];
  const filteredPlayers = useMemo(() => {
    return players.filter((p) => {
      if (p.numero < activeRange.min || p.numero > activeRange.max) return false;
      const solved = solvedSet.has(p.player_id);
      if (statusFilter === "solved" && !solved) return false;
      if (statusFilter === "unsolved" && solved) return false;
      return true;
    });
  }, [players, activeRange, statusFilter, solvedSet]);

  const totalSolved = solvedSet.size;
  const totalPlayers = players.length || 1538;

  // Navigate prev/next in detail view
  const currentIndexInAll = useMemo(() => {
    if (!selectedPlayer) return -1;
    return players.findIndex((p) => p.player_id === selectedPlayer.player_id);
  }, [players, selectedPlayer]);

  const goPrev = () => {
    if (currentIndexInAll > 0) {
      setSelectedPlayer(players[currentIndexInAll - 1]);
    }
  };

  const goNext = () => {
    if (currentIndexInAll >= 0 && currentIndexInAll < players.length - 1) {
      setSelectedPlayer(players[currentIndexInAll + 1]);
    }
  };

  const isSelectedSolved = selectedPlayer
    ? solvedSet.has(selectedPlayer.player_id)
    : false;
  const selectedHints = selectedPlayer
    ? getPlayerHints(selectedPlayer.player_id)
    : [];

  return (
    <>
      {/* Pulsante Pop-up fisso in basso a destra */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Apri Raccoglitore di Figurine"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-amber-400 hover:bg-amber-300 text-black font-display font-black uppercase tracking-tight border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 transition-all cursor-pointer"
      >
        <BookOpen className="w-5 h-5 stroke-[2.5]" />
        <span className="text-sm md:text-base">Figurine</span>
        <span className="bg-black text-white text-xs font-bold px-2 py-0.5 border border-black">
          {totalSolved}/{totalPlayers}
        </span>
      </button>

      {/* Finestra Pop-up Raccoglitore */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end sm:justify-end p-0 sm:p-6 pointer-events-none">
          {/* Backdrop cliccabile su mobile o quando espanso */}
          <div
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/40 pointer-events-auto transition-opacity"
          />

          <div
            className={`relative pointer-events-auto bg-background border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col overflow-hidden transition-all duration-200 ${
              isExpanded
                ? "w-full h-full sm:w-[94vw] sm:h-[90vh] sm:max-w-6xl sm:mx-auto"
                : "w-full h-[88vh] sm:w-[540px] md:w-[680px] sm:h-[82vh]"
            }`}
          >
            {/* Top Bar */}
            <div className="bg-amber-400 border-b-4 border-black px-4 py-3 flex items-center justify-between gap-2 flex-shrink-0">
              <div className="flex items-center gap-2">
                {selectedPlayer ? (
                  <button
                    onClick={() => setSelectedPlayer(null)}
                    className="flex items-center gap-1 bg-white hover:bg-gray-100 text-black font-bold text-xs uppercase px-2.5 py-1.5 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Raccoglitore
                  </button>
                ) : (
                  <span className="text-xl">🃏</span>
                )}
                <div>
                  <h2 className="font-display font-black uppercase text-base md:text-lg tracking-tight text-black leading-none">
                    {selectedPlayer
                      ? `Figurina #${selectedPlayer.numero}`
                      : "Raccoglitore Figurine"}
                  </h2>
                  <p className="text-[11px] font-bold uppercase text-black/75 mt-0.5">
                    {selectedPlayer
                      ? isSelectedSolved
                        ? selectedPlayer.name
                        : "Chi è questo calciatore?"
                      : `Dal più facile (#1) al più difficile (#${totalPlayers})`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Punti indizio */}
                <div
                  title="Punti Indizio"
                  className="flex items-center gap-1 bg-white border-2 border-black px-2.5 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                >
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span className="font-black text-sm text-black">
                    {currentPoints}
                  </span>
                  <span className="hidden sm:inline text-[10px] font-bold uppercase text-muted-foreground">
                    pt
                  </span>
                </div>

                {/* Pulsante espandi/riduci */}
                <button
                  onClick={() => setIsExpanded((v) => !v)}
                  title={isExpanded ? "Riduci finestra" : "Ingrandisci finestra"}
                  className="hidden sm:flex items-center justify-center w-8 h-8 bg-white hover:bg-gray-100 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
                >
                  {isExpanded ? (
                    <Minimize2 className="w-4 h-4 text-black" />
                  ) : (
                    <Maximize2 className="w-4 h-4 text-black" />
                  )}
                </button>

                {/* Chiudi */}
                <button
                  onClick={() => setIsOpen(false)}
                  title="Chiudi"
                  className="flex items-center justify-center w-8 h-8 bg-black hover:bg-gray-800 text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* VISTA 1: GRIGLIA RACCOGLITORE (solo immagini dei calciatori in sequenza) */}
            {!selectedPlayer && (
              <>
                {/* Barra progresso + filtri */}
                <div className="bg-white border-b-2 border-black p-3 space-y-2.5 flex-shrink-0">
                  <div className="flex items-center justify-between text-xs font-bold uppercase">
                    <span>
                      Collezione completata: {totalSolved} / {totalPlayers}
                    </span>
                    <span>
                      {Math.round((totalSolved / totalPlayers) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 h-3 border-2 border-black">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-green-500 transition-all duration-500"
                      style={{
                        width: `${(totalSolved / totalPlayers) * 100}%`,
                      }}
                    />
                  </div>

                  {/* Selettore Pagine/Fasce in sequenza */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {RANGES.map((r, idx) => (
                      <button
                        key={r.label}
                        onClick={() => setSelectedRangeIdx(idx)}
                        className={`px-2 py-1 text-[11px] font-bold uppercase border-2 border-black transition-all cursor-pointer ${
                          selectedRangeIdx === idx
                            ? "bg-black text-white"
                            : "bg-gray-100 text-black hover:bg-amber-100"
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>

                  {/* Filtro stato */}
                  <div className="flex gap-1.5">
                    {(
                      [
                        { key: "all", label: "Tutte" },
                        { key: "unsolved", label: "Da indovinare" },
                        { key: "solved", label: "Indovinate" },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.key}
                        onClick={() => setStatusFilter(f.key)}
                        className={`px-2.5 py-0.5 text-[11px] font-bold uppercase border border-black cursor-pointer ${
                          statusFilter === f.key
                            ? "bg-amber-400 text-black"
                            : "bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Griglia di sole immagini */}
                <div className="flex-1 overflow-y-auto p-3 bg-gray-50">
                  {loading ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                      {Array.from({ length: 15 }).map((_, i) => (
                        <div
                          key={i}
                          className="aspect-[3/4] bg-gray-200 animate-pulse border-2 border-black"
                        />
                      ))}
                    </div>
                  ) : filteredPlayers.length === 0 ? (
                    <div className="h-48 flex items-center justify-center text-sm font-bold text-muted-foreground uppercase">
                      Nessuna figurina in questo filtro
                    </div>
                  ) : (
                    <div
                      className={`grid gap-3 ${
                        isExpanded
                          ? "grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8"
                          : "grid-cols-3 sm:grid-cols-4 md:grid-cols-5"
                      }`}
                    >
                      {filteredPlayers.map((p) => (
                        <FigurinaThumb
                          key={p.player_id}
                          player={p}
                          isSolved={solvedSet.has(p.player_id)}
                          onClick={() => setSelectedPlayer(p)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* VISTA 2: PAGINA INGRANDITA DEL CALCIATORE */}
            {selectedPlayer && (
              <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-gray-50">
                {/* Navigazione figurina precedente / successiva */}
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentIndexInAll <= 0}
                    onClick={goPrev}
                    className="border-2 border-black font-bold text-xs uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />#
                    {selectedPlayer.numero - 1}
                  </Button>
                  <span className="font-display font-black text-sm uppercase bg-white px-3 py-1 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    Figurina #{selectedPlayer.numero} di {totalPlayers}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      currentIndexInAll < 0 ||
                      currentIndexInAll >= players.length - 1
                    }
                    onClick={goNext}
                    className="border-2 border-black font-bold text-xs uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  >
                    #{selectedPlayer.numero + 1}
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>

                {/* Immagine ingrandita del calciatore */}
                <div className="relative max-w-xs mx-auto aspect-[3/4] border-4 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                  <img
                    src={selectedPlayer.photo_url}
                    alt={isSelectedSolved ? selectedPlayer.name : "???"}
                    className="w-full h-full object-cover object-top"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "https://via.placeholder.com/400x530?text=Figurina";
                    }}
                  />
                  {isSelectedSolved && (
                    <div className="absolute top-3 right-3 bg-green-500 text-white px-2.5 py-1 font-bold uppercase text-xs border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1">
                      <Trophy className="w-3.5 h-3.5" />
                      Sbloccata!
                    </div>
                  )}
                </div>

                {/* Se già indovinato: mostra scheda completa del calciatore */}
                {(isSelectedSolved || justSolved) && (
                  <div className="bg-green-50 border-4 border-green-500 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-4 space-y-4">
                    <h3 className="text-xl font-display font-black uppercase text-green-800 flex items-center gap-2">
                      <Trophy className="w-5 h-5" />
                      {selectedPlayer.name}
                    </h3>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white border-2 border-black p-2.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        <div className="text-[10px] font-bold uppercase text-muted-foreground">
                          Presenze Serie A
                        </div>
                        <div className="font-black text-base">
                          {selectedPlayer.serie_a_apps}
                        </div>
                      </div>
                      <div className="bg-white border-2 border-black p-2.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        <div className="text-[10px] font-bold uppercase text-muted-foreground">
                          Anno di Nascita
                        </div>
                        <div className="font-black text-base">
                          {selectedPlayer.birth_year}
                        </div>
                      </div>
                      <div className="bg-white border-2 border-black p-2.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        <div className="text-[10px] font-bold uppercase text-muted-foreground">
                          Ruolo
                        </div>
                        <div className="font-bold text-sm">
                          {selectedPlayer.position}
                        </div>
                      </div>
                      <div className="bg-white border-2 border-black p-2.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        <div className="text-[10px] font-bold uppercase text-muted-foreground">
                          Nazionalità
                        </div>
                        <div className="font-bold text-sm">
                          {selectedPlayer.nationality}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => setSelectedPlayer(null)}
                        className="flex-1 bg-black text-white font-bold uppercase border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                      >
                        Torna al Raccoglitore
                      </Button>
                      {currentIndexInAll < players.length - 1 && (
                        <Button
                          onClick={goNext}
                          className="bg-amber-400 hover:bg-amber-300 text-black font-bold uppercase border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                        >
                          Prossima →
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Se NON ancora indovinato: mostra Indizi + Input Nome */}
                {!isSelectedSolved && !justSolved && (
                  <>
                    {/* Box Indizi (stesso funzionamento delle cartoline degli stadi) */}
                    <div className="bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-4">
                      <h3 className="font-display font-bold uppercase text-base mb-3 flex items-center gap-2">
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                        Indizi
                        <span className="ml-auto text-xs font-bold text-muted-foreground">
                          Disponibili: {currentPoints} pt
                        </span>
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {/* Indizio 1: Anno & Ruolo (1 pt) */}
                        <div
                          className={`border-2 border-black p-2.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                            selectedHints.includes("anno_ruolo")
                              ? "bg-amber-50"
                              : "bg-white"
                          }`}
                        >
                          <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                            Anno & Ruolo
                          </div>
                          {selectedHints.includes("anno_ruolo") ? (
                            <div className="font-bold text-xs">
                              {selectedPlayer.birth_year} •{" "}
                              {selectedPlayer.position}
                            </div>
                          ) : (
                            <div className="font-bold text-xs text-muted-foreground">
                              ???
                            </div>
                          )}
                          {!selectedHints.includes("anno_ruolo") && (
                            <Button
                              size="sm"
                              onClick={() => handleUseHint("anno_ruolo")}
                              className="mt-2 w-full h-7 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                            >
                              <Star className="w-3 h-3 mr-1 fill-white" />1 pt
                            </Button>
                          )}
                        </div>

                        {/* Indizio 2: Nazionalità & Presenze (1 pt) */}
                        <div
                          className={`border-2 border-black p-2.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                            selectedHints.includes("nazionalita_presenze")
                              ? "bg-amber-50"
                              : "bg-white"
                          }`}
                        >
                          <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                            Nazione & Presenze
                          </div>
                          {selectedHints.includes("nazionalita_presenze") ? (
                            <div className="font-bold text-xs">
                              {selectedPlayer.nationality} •{" "}
                              {selectedPlayer.serie_a_apps} pres.
                            </div>
                          ) : (
                            <div className="font-bold text-xs text-muted-foreground">
                              ???
                            </div>
                          )}
                          {!selectedHints.includes("nazionalita_presenze") && (
                            <Button
                              size="sm"
                              onClick={() =>
                                handleUseHint("nazionalita_presenze")
                              }
                              className="mt-2 w-full h-7 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                            >
                              <Star className="w-3 h-3 mr-1 fill-white" />1 pt
                            </Button>
                          )}
                        </div>

                        {/* Indizio 3: Iniziali Nome (3 pt) */}
                        <div
                          className={`border-2 border-black p-2.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                            selectedHints.includes("iniziali")
                              ? "bg-amber-50"
                              : "bg-white"
                          }`}
                        >
                          <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                            Iniziali Nome
                          </div>
                          {selectedHints.includes("iniziali") ? (
                            <div className="font-mono font-bold text-xs tracking-wider">
                              {maskPlayerName(selectedPlayer.name)}
                            </div>
                          ) : (
                            <div className="font-bold text-xs text-muted-foreground">
                              ???
                            </div>
                          )}
                          {!selectedHints.includes("iniziali") && (
                            <Button
                              size="sm"
                              onClick={() => handleUseHint("iniziali")}
                              className="mt-2 w-full h-7 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                            >
                              <Star className="w-3 h-3 mr-1 fill-white" />3 pt
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Box Input Risposta */}
                    <div className="bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-4">
                      <h3 className="font-display font-bold uppercase text-base mb-1">
                        Indovina il calciatore
                      </h3>
                      <p className="text-xs text-muted-foreground mb-3">
                        Inserisci il nome del calciatore per sbloccare la
                        figurina e guadagnare +1 Punto Indizio
                      </p>

                      <div className="relative flex gap-2">
                        <div className="relative flex-1">
                          <input
                            ref={inputRef}
                            type="text"
                            value={guess}
                            onChange={(e) => {
                              setGuess(e.target.value);
                              setShowDropdown(
                                e.target.value.trim().length >= 2
                              );
                            }}
                            onFocus={() => {
                              if (guess.trim().length >= 2)
                                setShowDropdown(true);
                            }}
                            onBlur={() => {
                              setTimeout(() => setShowDropdown(false), 150);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleGuess();
                              if (e.key === "Escape") setShowDropdown(false);
                            }}
                            placeholder="Scrivi il nome del calciatore..."
                            className="w-full border-2 border-black px-3 py-2.5 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] bg-white"
                            autoComplete="off"
                          />

                          {showDropdown &&
                            (() => {
                              const normG = normalizeStr(guess);
                              const matches = allPlayerNames
                                .filter((n) => normalizeStr(n).includes(normG))
                                .slice(0, 10);
                              return matches.length > 0 ? (
                                <div className="absolute z-50 bottom-full mb-1 left-0 right-0 border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] max-h-48 overflow-y-auto">
                                  {matches.map((name) => (
                                    <button
                                      key={name}
                                      type="button"
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        setGuess(name);
                                        setShowDropdown(false);
                                        inputRef.current?.focus();
                                      }}
                                      className="w-full text-left px-3 py-2 font-bold text-xs hover:bg-amber-50 border-b border-gray-100 last:border-b-0 cursor-pointer"
                                    >
                                      {name}
                                    </button>
                                  ))}
                                </div>
                              ) : null;
                            })()}
                        </div>

                        <Button
                          onClick={handleGuess}
                          disabled={!guess.trim()}
                          className="bg-black text-white font-bold uppercase px-5 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50"
                        >
                          Conferma
                        </Button>
                      </div>

                      {/* Storico tentativi */}
                      {attempts.length > 0 && (
                        <div className="mt-3 space-y-1.5">
                          <div className="text-[10px] font-bold uppercase text-muted-foreground">
                            Tentativi
                          </div>
                          {attempts.map((a, i) => (
                            <div
                              key={i}
                              className={`flex items-center gap-2 px-3 py-1.5 border-2 border-black font-bold text-xs ${
                                a.correct
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-50 text-red-700"
                              }`}
                            >
                              {a.correct ? (
                                <Check className="w-3.5 h-3.5 text-green-600" />
                              ) : (
                                <X className="w-3.5 h-3.5 text-red-500" />
                              )}
                              {a.value}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
