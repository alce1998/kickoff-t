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

export interface Stadio {
  id: string;
  nome: string;
  capienza: string;
  anno: string;
  campionato: string;
  squadre: string[];
  foto: string;
}

interface LocalAlbumState {
  solvedPlayers: string[];
  hintsByPlayer: Record<string, string[]>;
  solvedStadi: string[];
  hintsByStadio: Record<string, string[]>;
  points: number;
}

const LOCAL_STORAGE_KEY = "kickoff_figurine_progress_v1";

function loadLocalState(): LocalAlbumState {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        solvedPlayers: Array.isArray(parsed.solvedIds || parsed.solvedPlayers)
          ? parsed.solvedIds || parsed.solvedPlayers
          : [],
        hintsByPlayer: parsed.hintsByPlayer || {},
        solvedStadi: Array.isArray(parsed.solvedStadi) ? parsed.solvedStadi : [],
        hintsByStadio: parsed.hintsByStadio || {},
        points: typeof parsed.points === "number" ? parsed.points : 0,
      };
    }
  } catch {
    // ignore
  }
  return {
    solvedPlayers: [],
    hintsByPlayer: {},
    solvedStadi: [],
    hintsByStadio: {},
    points: 0,
  };
}

function saveLocalState(state: LocalAlbumState) {
  try {
    localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify({
        ...state,
        solvedIds: state.solvedPlayers,
      })
    );
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

const COMPOUND_GIVEN_NAMES = new Set([
  "gian marco",
  "jose luis",
  "fabian natale",
  "antonio carlos",
  "john arne",
  "marc oliver",
  "tore andre",
  "juan pablo",
  "joseph dayo",
  "ramos borges",
]);

function extractSurname(fullName: string): string {
  const cleaned = fullName.replace(/\s+Jr\.?$/i, "").trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length <= 1) return parts[0] || fullName;
  if (parts.length === 2) return parts[1];
  const firstTwo = normalizeStr(parts[0] + " " + parts[1]);
  if (COMPOUND_GIVEN_NAMES.has(firstTwo)) {
    return parts.slice(2).join(" ");
  }
  // Prepositions/particles (Di, Del, Dalla, Dall', El, Van, De, Da, ecc.) and compound surnames stay part of the surname
  return parts.slice(1).join(" ");
}

function matchesPlayerName(guess: string, fullName: string): boolean {
  const normGuess = normalizeStr(guess);
  const normFull = normalizeStr(fullName);
  const normSurname = normalizeStr(extractSurname(fullName));
  if (!normGuess) return false;
  return normGuess === normFull || normGuess === normSurname;
}

function getSurnameInitials(fullName: string): string {
  const surname = extractSurname(fullName);
  return surname
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (word.includes("-")) {
        return word
          .split("-")
          .filter(Boolean)
          .map((w) => w[0].toUpperCase() + ".")
          .join("-");
      }
      const apoIdx = word.search(/['’]/);
      // Handle apostrophe prepositions like D'Ambrosio, Dall'Oglio, Dell'Orco, O'Neill, N'Koulou
      if (apoIdx > 0 && apoIdx <= 4 && word.length - 1 - apoIdx >= 2) {
        const prefix = word.slice(0, apoIdx);
        const after = word.slice(apoIdx + 1);
        return prefix[0].toUpperCase() + "'" + after[0].toUpperCase() + ".";
      }
      return word[0].toUpperCase() + ".";
    })
    .join(" ");
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
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      title={`#${player.numero}`}
      className={`relative aspect-[3/4] cursor-pointer border-3 border-black bg-gray-200 overflow-hidden select-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all group ${
        isSolved ? "ring-3 ring-green-500" : ""
      }`}
    >
      {visible && (
        <img
          src={player.photo_url}
          alt="Figurina"
          loading="lazy"
          draggable={false}
          onContextMenu={(e) => e.preventDefault()}
          onLoad={() => setLoaded(true)}
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              "https://via.placeholder.com/300x400?text=Figurina";
            setLoaded(true);
          }}
          className={`w-full h-full object-cover object-top select-none pointer-events-none transition-transform duration-300 group-hover:scale-105 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
      <div
        className="absolute inset-0 z-10 select-none"
        onContextMenu={(e) => e.preventDefault()}
      />
      {!loaded && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse" />
      )}
      {isSolved && (
        <div className="absolute top-1.5 right-1.5 z-20 bg-green-500 text-white rounded-full p-1 border-2 border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
          <Trophy className="w-3.5 h-3.5" />
        </div>
      )}
    </div>
  );
}

function StadioThumb({
  stadio,
  isSolved,
  onClick,
}: {
  stadio: Stadio;
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
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      onClick={onClick}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      className={`relative cursor-pointer border-3 border-black select-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all group overflow-hidden ${
        isSolved ? "ring-3 ring-green-500" : ""
      }`}
    >
      <div className="aspect-[4/3] relative overflow-hidden bg-gray-200">
        {visible && (
          <img
            src={stadio.foto}
            alt={isSolved ? stadio.nome : "???"}
            loading="lazy"
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
            onLoad={() => setLoaded(true)}
            className={`w-full h-full object-cover select-none pointer-events-none transition-all duration-500 group-hover:scale-105 ${
              isSolved ? "" : "grayscale brightness-75"
            } ${loaded ? "opacity-100" : "opacity-0"}`}
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                "https://via.placeholder.com/400x300?text=Stadio";
              setLoaded(true);
            }}
          />
        )}
        <div
          className="absolute inset-0 z-10 select-none"
          onContextMenu={(e) => e.preventDefault()}
        />
        {!loaded && (
          <div className="absolute inset-0 bg-gray-200 animate-pulse" />
        )}
        {!isSolved && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <span className="text-white font-black text-xl drop-shadow-lg">
              ???
            </span>
          </div>
        )}
        {isSolved && (
          <div className="absolute top-1.5 right-1.5 z-20 bg-green-500 text-white rounded-full p-1 border-2 border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
            <Trophy className="w-3.5 h-3.5" />
          </div>
        )}
      </div>
      <div
        className={`p-1.5 text-center font-bold text-xs uppercase border-t-2 border-black truncate ${
          isSolved ? "bg-green-50 text-green-800" : "bg-black text-white"
        }`}
      >
        {isSolved ? stadio.nome : "???"}
      </div>
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

const CAMPIONATI = [
  { key: "Serie A", label: "Serie A", flag: "🇮🇹" },
  { key: "Premier League", label: "Premier League", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { key: "La Liga", label: "La Liga", flag: "🇪🇸" },
  { key: "Ligue 1", label: "Ligue 1", flag: "🇫🇷" },
  { key: "Bundesliga", label: "Bundesliga", flag: "🇩🇪" },
  { key: "Resto del Mondo", label: "Resto del Mondo", flag: "🌍" },
];

export function FigurinePopup() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeSection, setActiveSection] = useState<"calciatori" | "stadi">(
    "calciatori"
  );

  // Calciatori state
  const [players, setPlayers] = useState<FigurinaPlayer[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<FigurinaPlayer | null>(
    null
  );
  const [selectedRangeIdx, setSelectedRangeIdx] = useState(0);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "unsolved" | "solved"
  >("all");

  // Stadi state
  const [stadi, setStadi] = useState<Stadio[]>([]);
  const [loadingStadi, setLoadingStadi] = useState(false);
  const [selectedStadio, setSelectedStadio] = useState<Stadio | null>(null);
  const [selectedCampionato, setSelectedCampionato] = useState("Serie A");

  // Local fallback state
  const [localState, setLocalState] = useState<LocalAlbumState>(() =>
    loadLocalState()
  );

  // Detail input state (shared between selectedPlayer and selectedStadio)
  const [guess, setGuess] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [attempts, setAttempts] = useState<
    { value: string; correct: boolean }[]
  >([]);
  const [justSolved, setJustSolved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Listen for custom open events (e.g. from /cartoline redirect)
  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<{ section?: "calciatori" | "stadi" }>;
      setIsOpen(true);
      if (custom.detail?.section) {
        setActiveSection(custom.detail.section);
        setSelectedPlayer(null);
        setSelectedStadio(null);
      }
    };
    window.addEventListener("open-figurine-popup", handler);
    return () => window.removeEventListener("open-figurine-popup", handler);
  }, []);

  // Load both datasets
  useEffect(() => {
    setLoadingPlayers(true);
    fetch("/data/figurine_players.json?v=anticheat1")
      .then((r) => r.json())
      .then((data: FigurinaPlayer[]) => {
        setPlayers(data);
        setLoadingPlayers(false);
      })
      .catch(() => setLoadingPlayers(false));

    setLoadingStadi(true);
    fetch("/data/stadi_cartoline.65c9338a.json?v=anticheat1")
      .then((r) => r.json())
      .then((data: Stadio[]) => {
        setStadi(data);
        setLoadingStadi(false);
      })
      .catch(() => setLoadingStadi(false));
  }, []);

  // Server progress for logged-in user
  const { data: serverFigurine, refetch: refetchFigurine } =
    trpc.figurine.getProgress.useQuery(undefined, { enabled: !!user });
  const { data: serverCartoline, refetch: refetchCartoline } =
    trpc.cartoline.getProgress.useQuery(undefined, { enabled: !!user });

  const refetchAllServer = () => {
    if (user) {
      refetchFigurine();
      refetchCartoline();
    }
  };

  const solvePlayerMutation = trpc.figurine.solvePlayer.useMutation({
    onSuccess: () => refetchAllServer(),
  });
  const hintPlayerMutation = trpc.figurine.useHint.useMutation({
    onSuccess: () => refetchAllServer(),
  });
  const solveStadiumMutation = trpc.cartoline.solveStadium.useMutation({
    onSuccess: () => refetchAllServer(),
  });
  const hintStadiumMutation = trpc.cartoline.useHint.useMutation({
    onSuccess: () => refetchAllServer(),
  });

  // Combined solved sets
  const solvedPlayersSet = useMemo(() => {
    const s = new Set<string>(localState.solvedPlayers);
    if (serverFigurine?.progress) {
      for (const p of serverFigurine.progress) {
        if (p.solved === 1) s.add(p.playerId);
      }
    }
    return s;
  }, [localState.solvedPlayers, serverFigurine]);

  const solvedStadiSet = useMemo(() => {
    const s = new Set<string>(localState.solvedStadi);
    if (serverCartoline?.progress) {
      for (const p of serverCartoline.progress) {
        if (p.solved === 1) s.add(p.stadiumId);
      }
    }
    return s;
  }, [localState.solvedStadi, serverCartoline]);

  const getPlayerHints = (playerId: string): string[] => {
    const set = new Set<string>(localState.hintsByPlayer[playerId] || []);
    if (serverFigurine?.progress) {
      const row = serverFigurine.progress.find((p) => p.playerId === playerId);
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

  const getStadioHints = (stadiumId: string): string[] => {
    const set = new Set<string>(localState.hintsByStadio[stadiumId] || []);
    if (serverCartoline?.progress) {
      const row = serverCartoline.progress.find(
        (p) => p.stadiumId === stadiumId
      );
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
    ? (serverCartoline?.points ?? serverFigurine?.points ?? localState.points)
    : localState.points;

  const allPlayerNames = useMemo(
    () =>
      Array.from(new Set(players.map((p) => p.name))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [players]
  );

  const allSquadre = useMemo(() => {
    const s = new Set<string>();
    stadi.forEach((st) => st.squadre.forEach((sq) => s.add(sq)));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [stadi]);

  // Reset detail state when switching selected card
  useEffect(() => {
    setGuess("");
    setShowDropdown(false);
    setAttempts([]);
    setJustSolved(false);
  }, [selectedPlayer?.player_id, selectedStadio?.id]);

  // Handle guess for Calciatore
  const handlePlayerGuess = () => {
    if (!guess.trim() || !selectedPlayer) return;
    const isCorrect = matchesPlayerName(guess.trim(), selectedPlayer.name);
    setAttempts((prev) => [{ value: guess.trim(), correct: isCorrect }, ...prev]);
    setGuess("");
    setShowDropdown(false);

    if (isCorrect) {
      const alreadySolved = solvedPlayersSet.has(selectedPlayer.player_id);
      setJustSolved(true);
      if (!alreadySolved) {
        const nextState: LocalAlbumState = {
          ...localState,
          solvedPlayers: [...localState.solvedPlayers, selectedPlayer.player_id],
          points: currentPoints + 1,
        };
        setLocalState(nextState);
        saveLocalState(nextState);
        toast.success("🏆 Figurina sbloccata! +1 Punto Indizio", {
          duration: 3500,
        });
      }
      if (user) {
        solvePlayerMutation.mutate({ playerId: selectedPlayer.player_id });
      }
    } else {
      toast.error("Nome errato, riprova!", { duration: 2000 });
    }
  };

  // Handle guess for Stadio
  const handleStadioGuess = () => {
    if (!guess.trim() || !selectedStadio) return;
    const normG = normalizeStr(guess.trim());
    const isCorrect = selectedStadio.squadre.some(
      (sq) => normalizeStr(sq) === normG
    );
    setAttempts((prev) => [{ value: guess.trim(), correct: isCorrect }, ...prev]);
    setGuess("");
    setShowDropdown(false);

    if (isCorrect) {
      const alreadySolved = solvedStadiSet.has(selectedStadio.id);
      setJustSolved(true);
      if (!alreadySolved) {
        const nextState: LocalAlbumState = {
          ...localState,
          solvedStadi: [...localState.solvedStadi, selectedStadio.id],
          points: currentPoints + 1,
        };
        setLocalState(nextState);
        saveLocalState(nextState);
        toast.success("🏆 Stadio sbloccato! +1 Punto Indizio", {
          duration: 3500,
        });
      }
      if (user) {
        solveStadiumMutation.mutate({ stadiumId: selectedStadio.id });
      }
    } else {
      toast.error("Squadra errata, riprova!", { duration: 2000 });
    }
  };

  // Handle hint for Calciatore
  const handleUsePlayerHint = (
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
    const nextState: LocalAlbumState = {
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
      hintPlayerMutation.mutate({
        playerId: selectedPlayer.player_id,
        hintType,
      });
    } else {
      toast.success(
        `Indizio svelato! (Punti rimasti: ${Math.max(0, currentPoints - cost)})`
      );
    }
  };

  // Handle hint for Stadio
  const handleUseStadioHint = (hintType: "nome" | "capienza" | "anno") => {
    if (!selectedStadio) return;
    const revealed = getStadioHints(selectedStadio.id);
    if (revealed.includes(hintType)) return;

    const cost = hintType === "nome" ? 3 : 1;
    if (currentPoints < cost) {
      toast.error(
        `Punti indizio insufficienti! (Necessari: ${cost} pt, hai: ${currentPoints} pt)`
      );
      return;
    }

    const nextHints = [...revealed, hintType];
    const nextState: LocalAlbumState = {
      ...localState,
      hintsByStadio: {
        ...localState.hintsByStadio,
        [selectedStadio.id]: nextHints,
      },
      points: Math.max(0, currentPoints - cost),
    };
    setLocalState(nextState);
    saveLocalState(nextState);

    if (user) {
      hintStadiumMutation.mutate({
        stadiumId: selectedStadio.id,
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
      const solved = solvedPlayersSet.has(p.player_id);
      if (statusFilter === "solved" && !solved) return false;
      if (statusFilter === "unsolved" && solved) return false;
      return true;
    });
  }, [players, activeRange, statusFilter, solvedPlayersSet]);

  const stadiCampionato = useMemo(
    () => stadi.filter((s) => s.campionato === selectedCampionato),
    [stadi, selectedCampionato]
  );

  const totalSolvedPlayers = solvedPlayersSet.size;
  const totalPlayers = players.length || 1538;
  const totalSolvedStadi = solvedStadiSet.size;
  const totalStadi = stadi.length || 121;

  // Navigation in Calciatori detail
  const currentIndexInAll = useMemo(() => {
    if (!selectedPlayer) return -1;
    return players.findIndex((p) => p.player_id === selectedPlayer.player_id);
  }, [players, selectedPlayer]);

  const goPrevPlayer = () => {
    if (currentIndexInAll > 0) {
      setSelectedPlayer(players[currentIndexInAll - 1]);
    }
  };

  const goNextPlayer = () => {
    if (currentIndexInAll >= 0 && currentIndexInAll < players.length - 1) {
      setSelectedPlayer(players[currentIndexInAll + 1]);
    }
  };

  // Navigation in Stadi detail
  const currentStadioIdx = useMemo(() => {
    if (!selectedStadio) return -1;
    return stadiCampionato.findIndex((s) => s.id === selectedStadio.id);
  }, [stadiCampionato, selectedStadio]);

  const goPrevStadio = () => {
    if (currentStadioIdx > 0) {
      setSelectedStadio(stadiCampionato[currentStadioIdx - 1]);
    }
  };

  const goNextStadio = () => {
    if (
      currentStadioIdx >= 0 &&
      currentStadioIdx < stadiCampionato.length - 1
    ) {
      setSelectedStadio(stadiCampionato[currentStadioIdx + 1]);
    }
  };

  const isSelectedPlayerSolved = selectedPlayer
    ? solvedPlayersSet.has(selectedPlayer.player_id)
    : false;
  const selectedPlayerHints = selectedPlayer
    ? getPlayerHints(selectedPlayer.player_id)
    : [];

  const isSelectedStadioSolved = selectedStadio
    ? solvedStadiSet.has(selectedStadio.id)
    : false;
  const selectedStadioHints = selectedStadio
    ? getStadioHints(selectedStadio.id)
    : [];

  return (
    <>
      {/* Pulsante Pop-up fisso in basso a destra */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Apri Raccoglitore di Figurine e Cartoline"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-amber-400 hover:bg-amber-300 text-black font-display font-black uppercase tracking-tight border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 transition-all cursor-pointer"
      >
        <BookOpen className="w-5 h-5 stroke-[2.5]" />
        <span className="text-sm md:text-base">Album</span>
        <span className="bg-black text-white text-xs font-bold px-2 py-0.5 border border-black">
          {totalSolvedPlayers + totalSolvedStadi}/{totalPlayers + totalStadi}
        </span>
      </button>

      {/* Finestra Pop-up Raccoglitore */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end p-0 sm:p-6 pointer-events-none">
          <div
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/40 pointer-events-auto transition-opacity"
          />

          <div
            className={`relative pointer-events-auto bg-background border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col overflow-hidden transition-all duration-200 ${
              isExpanded
                ? "w-full h-full sm:w-[94vw] sm:h-[90vh] sm:max-w-6xl sm:mx-auto"
                : "w-full h-[88vh] sm:w-[560px] md:w-[700px] sm:h-[84vh]"
            }`}
          >
            {/* Top Bar */}
            <div className="bg-amber-400 border-b-4 border-black px-4 py-3 flex items-center justify-between gap-2 flex-shrink-0">
              <div className="flex items-center gap-2">
                {selectedPlayer || selectedStadio ? (
                  <button
                    onClick={() => {
                      setSelectedPlayer(null);
                      setSelectedStadio(null);
                    }}
                    className="flex items-center gap-1 bg-white hover:bg-gray-100 text-black font-bold text-xs uppercase px-2.5 py-1.5 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Album
                  </button>
                ) : (
                  <span className="text-xl">
                    {activeSection === "calciatori" ? "🃏" : "🏟️"}
                  </span>
                )}
                <div>
                  <h2 className="font-display font-black uppercase text-base md:text-lg tracking-tight text-black leading-none">
                    {selectedPlayer
                      ? `Figurina #${selectedPlayer.numero}`
                      : selectedStadio
                        ? isSelectedStadioSolved
                          ? selectedStadio.nome
                          : "Cartolina Stadio"
                        : activeSection === "calciatori"
                          ? "Raccoglitore Figurine"
                          : "Cartoline degli Stadi"}
                  </h2>
                  <p className="text-[11px] font-bold uppercase text-black/75 mt-0.5">
                    {selectedPlayer
                      ? isSelectedPlayerSolved
                        ? selectedPlayer.name
                        : "Chi è questo calciatore?"
                      : selectedStadio
                        ? `${selectedStadio.campionato} • Quale squadra gioca qui?`
                        : activeSection === "calciatori"
                          ? `Dal più facile (#1) al più difficile (#${totalPlayers})`
                          : `${totalStadi} stadi dei grandi campionati`}
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

            {/* Selettore Sezione Principale: Calciatori vs Cartoline Stadi */}
            {!selectedPlayer && !selectedStadio && (
              <div className="grid grid-cols-2 border-b-4 border-black flex-shrink-0">
                <button
                  onClick={() => setActiveSection("calciatori")}
                  className={`py-2.5 px-3 font-display font-black uppercase text-xs sm:text-sm flex items-center justify-center gap-2 border-r-2 border-black transition-colors cursor-pointer ${
                    activeSection === "calciatori"
                      ? "bg-black text-white"
                      : "bg-white text-black hover:bg-amber-50"
                  }`}
                >
                  <span>⚽ Figurine Calciatori</span>
                  <span
                    className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${
                      activeSection === "calciatori"
                        ? "bg-amber-400 text-black"
                        : "bg-gray-200 text-gray-800"
                    }`}
                  >
                    {totalSolvedPlayers}/{totalPlayers}
                  </span>
                </button>
                <button
                  onClick={() => setActiveSection("stadi")}
                  className={`py-2.5 px-3 font-display font-black uppercase text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                    activeSection === "stadi"
                      ? "bg-black text-white"
                      : "bg-white text-black hover:bg-amber-50"
                  }`}
                >
                  <span>🏟️ Cartoline Stadi</span>
                  <span
                    className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${
                      activeSection === "stadi"
                        ? "bg-amber-400 text-black"
                        : "bg-gray-200 text-gray-800"
                    }`}
                  >
                    {totalSolvedStadi}/{totalStadi}
                  </span>
                </button>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════
                SEZIONE 1: FIGURINE CALCIATORI (Griglia solo foto)
               ══════════════════════════════════════════════════════════════════ */}
            {activeSection === "calciatori" &&
              !selectedPlayer &&
              !selectedStadio && (
                <>
                  <div className="bg-white border-b-2 border-black p-3 space-y-2.5 flex-shrink-0">
                    <div className="flex items-center justify-between text-xs font-bold uppercase">
                      <span>
                        Figurine sbloccate: {totalSolvedPlayers} / {totalPlayers}
                      </span>
                      <span>
                        {Math.round((totalSolvedPlayers / totalPlayers) * 100)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 h-3 border-2 border-black">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-green-500 transition-all duration-500"
                        style={{
                          width: `${(totalSolvedPlayers / totalPlayers) * 100}%`,
                        }}
                      />
                    </div>

                    {/* Fasce sequenziali */}
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
                    {loadingPlayers ? (
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
                            isSolved={solvedPlayersSet.has(p.player_id)}
                            onClick={() => setSelectedPlayer(p)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

            {/* ══════════════════════════════════════════════════════════════════
                SEZIONE 2: CARTOLINE STADI (Griglia per campionato)
               ══════════════════════════════════════════════════════════════════ */}
            {activeSection === "stadi" &&
              !selectedPlayer &&
              !selectedStadio && (
                <>
                  <div className="bg-white border-b-2 border-black p-3 space-y-2.5 flex-shrink-0">
                    {/* Tabs Campionati */}
                    <div className="flex flex-wrap gap-1.5">
                      {CAMPIONATI.map((c) => {
                        const stadiC = stadi.filter(
                          (s) => s.campionato === c.key
                        );
                        const solvedC = stadiC.filter((s) =>
                          solvedStadiSet.has(s.id)
                        ).length;
                        return (
                          <button
                            key={c.key}
                            onClick={() => setSelectedCampionato(c.key)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 font-bold uppercase text-xs border-2 border-black transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer ${
                              selectedCampionato === c.key
                                ? "bg-black text-white"
                                : "bg-white text-black hover:bg-amber-50"
                            }`}
                          >
                            <span>{c.flag}</span>
                            <span>{c.label}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                solvedC === stadiC.length && stadiC.length > 0
                                  ? "bg-green-500 text-white"
                                  : "bg-gray-200 text-gray-800"
                              }`}
                            >
                              {solvedC}/{stadiC.length}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Progresso campionato selezionato */}
                    {(() => {
                      const solvedCount = stadiCampionato.filter((s) =>
                        solvedStadiSet.has(s.id)
                      ).length;
                      const totCount = stadiCampionato.length || 20;
                      return (
                        <div>
                          <div className="flex items-center justify-between text-xs font-bold uppercase mb-1">
                            <span>Progresso {selectedCampionato}</span>
                            <span>
                              {solvedCount}/{totCount}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 h-3 border-2 border-black">
                            <div
                              className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-500"
                              style={{
                                width: `${(solvedCount / totCount) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Griglia Stadi */}
                  <div className="flex-1 overflow-y-auto p-3 bg-gray-50">
                    {loadingStadi ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {Array.from({ length: 9 }).map((_, i) => (
                          <div
                            key={i}
                            className="aspect-[4/3] bg-gray-200 animate-pulse border-2 border-black"
                          />
                        ))}
                      </div>
                    ) : (
                      <div
                        className={`grid gap-3 ${
                          isExpanded
                            ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
                            : "grid-cols-2 sm:grid-cols-3"
                        }`}
                      >
                        {stadiCampionato.map((stadio) => (
                          <StadioThumb
                            key={stadio.id}
                            stadio={stadio}
                            isSolved={solvedStadiSet.has(stadio.id)}
                            onClick={() => setSelectedStadio(stadio)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

            {/* ══════════════════════════════════════════════════════════════════
                DETTAGLIO INGRANDITO CALCIATORE
               ══════════════════════════════════════════════════════════════════ */}
            {selectedPlayer && (
              <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-gray-50">
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentIndexInAll <= 0}
                    onClick={goPrevPlayer}
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
                    onClick={goNextPlayer}
                    className="border-2 border-black font-bold text-xs uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  >
                    #{selectedPlayer.numero + 1}
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>

                {/* Immagine ingrandita */}
                <div
                  onContextMenu={(e) => e.preventDefault()}
                  onDragStart={(e) => e.preventDefault()}
                  className="relative max-w-xs mx-auto aspect-[3/4] border-4 border-black bg-white select-none shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden"
                >
                  <img
                    src={selectedPlayer.photo_url}
                    alt={isSelectedPlayerSolved ? selectedPlayer.name : "???"}
                    draggable={false}
                    onContextMenu={(e) => e.preventDefault()}
                    className="w-full h-full object-cover object-top select-none pointer-events-none"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "https://via.placeholder.com/400x530?text=Figurina";
                    }}
                  />
                  <div
                    className="absolute inset-0 z-10 select-none"
                    onContextMenu={(e) => e.preventDefault()}
                  />
                  {isSelectedPlayerSolved && (
                    <div className="absolute top-3 right-3 z-20 bg-green-500 text-white px-2.5 py-1 font-bold uppercase text-xs border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1">
                      <Trophy className="w-3.5 h-3.5" />
                      Sbloccata!
                    </div>
                  )}
                </div>

                {(isSelectedPlayerSolved || justSolved) && (
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
                          onClick={goNextPlayer}
                          className="bg-amber-400 hover:bg-amber-300 text-black font-bold uppercase border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                        >
                          Prossima →
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {!isSelectedPlayerSolved && !justSolved && (
                  <>
                    <div className="bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-4">
                      <h3 className="font-display font-bold uppercase text-base mb-3 flex items-center gap-2">
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                        Indizi
                        <span className="ml-auto text-xs font-bold text-muted-foreground">
                          Disponibili: {currentPoints} pt
                        </span>
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div
                          className={`border-2 border-black p-2.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                            selectedPlayerHints.includes("anno_ruolo")
                              ? "bg-amber-50"
                              : "bg-white"
                          }`}
                        >
                          <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                            Anno & Ruolo
                          </div>
                          {selectedPlayerHints.includes("anno_ruolo") ? (
                            <div className="font-bold text-xs">
                              {selectedPlayer.birth_year} •{" "}
                              {selectedPlayer.position}
                            </div>
                          ) : (
                            <div className="font-bold text-xs text-muted-foreground">
                              ???
                            </div>
                          )}
                          {!selectedPlayerHints.includes("anno_ruolo") && (
                            <Button
                              size="sm"
                              onClick={() => handleUsePlayerHint("anno_ruolo")}
                              className="mt-2 w-full h-7 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                            >
                              <Star className="w-3 h-3 mr-1 fill-white" />1 pt
                            </Button>
                          )}
                        </div>

                        <div
                          className={`border-2 border-black p-2.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                            selectedPlayerHints.includes("nazionalita_presenze")
                              ? "bg-amber-50"
                              : "bg-white"
                          }`}
                        >
                          <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                            Nazione & Presenze
                          </div>
                          {selectedPlayerHints.includes(
                            "nazionalita_presenze"
                          ) ? (
                            <div className="font-bold text-xs">
                              {selectedPlayer.nationality} •{" "}
                              {selectedPlayer.serie_a_apps} pres.
                            </div>
                          ) : (
                            <div className="font-bold text-xs text-muted-foreground">
                              ???
                            </div>
                          )}
                          {!selectedPlayerHints.includes(
                            "nazionalita_presenze"
                          ) && (
                            <Button
                              size="sm"
                              onClick={() =>
                                handleUsePlayerHint("nazionalita_presenze")
                              }
                              className="mt-2 w-full h-7 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                            >
                              <Star className="w-3 h-3 mr-1 fill-white" />1 pt
                            </Button>
                          )}
                        </div>

                        <div
                          className={`border-2 border-black p-2.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                            selectedPlayerHints.includes("iniziali")
                              ? "bg-amber-50"
                              : "bg-white"
                          }`}
                        >
                          <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                            Iniziali Cognome
                          </div>
                          {selectedPlayerHints.includes("iniziali") ? (
                            <div className="font-mono font-bold text-sm tracking-wider">
                              {getSurnameInitials(selectedPlayer.name)}
                            </div>
                          ) : (
                            <div className="font-bold text-xs text-muted-foreground">
                              ???
                            </div>
                          )}
                          {!selectedPlayerHints.includes("iniziali") && (
                            <Button
                              size="sm"
                              onClick={() => handleUsePlayerHint("iniziali")}
                              className="mt-2 w-full h-7 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                            >
                              <Star className="w-3 h-3 mr-1 fill-white" />3 pt
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

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
                              if (e.key === "Enter") handlePlayerGuess();
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
                          onClick={handlePlayerGuess}
                          disabled={!guess.trim()}
                          className="bg-black text-white font-bold uppercase px-5 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50"
                        >
                          Conferma
                        </Button>
                      </div>

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

            {/* ══════════════════════════════════════════════════════════════════
                DETTAGLIO INGRANDITO CARTOLINA STADIO
               ══════════════════════════════════════════════════════════════════ */}
            {selectedStadio && (
              <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-gray-50">
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentStadioIdx <= 0}
                    onClick={goPrevStadio}
                    className="border-2 border-black font-bold text-xs uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Prec
                  </Button>
                  <span className="font-display font-black text-xs sm:text-sm uppercase bg-white px-3 py-1 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    {selectedStadio.campionato} ({currentStadioIdx + 1}/
                    {stadiCampionato.length})
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      currentStadioIdx < 0 ||
                      currentStadioIdx >= stadiCampionato.length - 1
                    }
                    onClick={goNextStadio}
                    className="border-2 border-black font-bold text-xs uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  >
                    Succ
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>

                {/* Foto Stadio */}
                <div
                  onContextMenu={(e) => e.preventDefault()}
                  onDragStart={(e) => e.preventDefault()}
                  className="relative border-4 border-black select-none shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white"
                >
                  <img
                    src={selectedStadio.foto}
                    alt={isSelectedStadioSolved ? selectedStadio.nome : "???"}
                    draggable={false}
                    onContextMenu={(e) => e.preventDefault()}
                    className={`w-full aspect-video object-cover select-none pointer-events-none transition-all duration-700 ${
                      isSelectedStadioSolved ? "" : "grayscale brightness-75"
                    }`}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "https://via.placeholder.com/800x450?text=Stadio";
                    }}
                  />
                  <div
                    className="absolute inset-0 z-10 select-none"
                    onContextMenu={(e) => e.preventDefault()}
                  />
                  {!isSelectedStadioSolved && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                      <span className="text-white font-black text-4xl drop-shadow-lg">
                        ???
                      </span>
                    </div>
                  )}
                  {isSelectedStadioSolved && (
                    <div className="absolute top-3 right-3 z-20 bg-green-500 text-white px-2.5 py-1 font-bold uppercase text-xs border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1">
                      <Trophy className="w-3.5 h-3.5" />
                      Sbloccato!
                    </div>
                  )}
                </div>

                {(isSelectedStadioSolved || justSolved) && (
                  <div className="bg-green-50 border-4 border-green-500 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-4 space-y-4">
                    <h3 className="text-xl font-display font-black uppercase text-green-800 flex items-center gap-2">
                      <Trophy className="w-5 h-5" />
                      {selectedStadio.nome}
                    </h3>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white border-2 border-black p-2.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        <div className="text-[10px] font-bold uppercase text-muted-foreground">
                          Nome Stadio
                        </div>
                        <div className="font-bold text-sm">
                          {selectedStadio.nome}
                        </div>
                      </div>
                      <div className="bg-white border-2 border-black p-2.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        <div className="text-[10px] font-bold uppercase text-muted-foreground">
                          Capienza
                        </div>
                        <div className="font-bold text-sm">
                          {selectedStadio.capienza}
                        </div>
                      </div>
                      <div className="bg-white border-2 border-black p-2.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        <div className="text-[10px] font-bold uppercase text-muted-foreground">
                          Anno di costruzione
                        </div>
                        <div className="font-bold text-sm">
                          {selectedStadio.anno}
                        </div>
                      </div>
                      <div className="bg-white border-2 border-black p-2.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        <div className="text-[10px] font-bold uppercase text-muted-foreground">
                          Squadra
                        </div>
                        <div className="font-bold text-sm">
                          {selectedStadio.squadre.join(" / ")}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => setSelectedStadio(null)}
                        className="flex-1 bg-black text-white font-bold uppercase border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                      >
                        Torna alle Cartoline
                      </Button>
                      {currentStadioIdx < stadiCampionato.length - 1 && (
                        <Button
                          onClick={goNextStadio}
                          className="bg-amber-400 hover:bg-amber-300 text-black font-bold uppercase border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                        >
                          Prossimo →
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {!isSelectedStadioSolved && !justSolved && (
                  <>
                    {/* Indizi Stadio */}
                    <div className="bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-4">
                      <h3 className="font-display font-bold uppercase text-base mb-3 flex items-center gap-2">
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                        Indizi Stadio
                        <span className="ml-auto text-xs font-bold text-muted-foreground">
                          Disponibili: {currentPoints} pt
                        </span>
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div
                          className={`border-2 border-black p-2.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                            selectedStadioHints.includes("nome")
                              ? "bg-amber-50"
                              : "bg-white"
                          }`}
                        >
                          <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                            Nome Stadio
                          </div>
                          {selectedStadioHints.includes("nome") ? (
                            <div className="font-bold text-xs">
                              {selectedStadio.nome}
                            </div>
                          ) : (
                            <div className="font-bold text-xs text-muted-foreground">
                              ???
                            </div>
                          )}
                          {!selectedStadioHints.includes("nome") && (
                            <Button
                              size="sm"
                              onClick={() => handleUseStadioHint("nome")}
                              className="mt-2 w-full h-7 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                            >
                              <Star className="w-3 h-3 mr-1 fill-white" />3 pt
                            </Button>
                          )}
                        </div>

                        <div
                          className={`border-2 border-black p-2.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                            selectedStadioHints.includes("capienza")
                              ? "bg-amber-50"
                              : "bg-white"
                          }`}
                        >
                          <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                            Capienza
                          </div>
                          {selectedStadioHints.includes("capienza") ? (
                            <div className="font-bold text-xs">
                              {selectedStadio.capienza}
                            </div>
                          ) : (
                            <div className="font-bold text-xs text-muted-foreground">
                              ???
                            </div>
                          )}
                          {!selectedStadioHints.includes("capienza") && (
                            <Button
                              size="sm"
                              onClick={() => handleUseStadioHint("capienza")}
                              className="mt-2 w-full h-7 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                            >
                              <Star className="w-3 h-3 mr-1 fill-white" />1 pt
                            </Button>
                          )}
                        </div>

                        <div
                          className={`border-2 border-black p-2.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                            selectedStadioHints.includes("anno")
                              ? "bg-amber-50"
                              : "bg-white"
                          }`}
                        >
                          <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                            Anno
                          </div>
                          {selectedStadioHints.includes("anno") ? (
                            <div className="font-bold text-xs">
                              {selectedStadio.anno}
                            </div>
                          ) : (
                            <div className="font-bold text-xs text-muted-foreground">
                              ???
                            </div>
                          )}
                          {!selectedStadioHints.includes("anno") && (
                            <Button
                              size="sm"
                              onClick={() => handleUseStadioHint("anno")}
                              className="mt-2 w-full h-7 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                            >
                              <Star className="w-3 h-3 mr-1 fill-white" />1 pt
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Input Squadra Stadio */}
                    <div className="bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-4">
                      <h3 className="font-display font-bold uppercase text-base mb-1">
                        Indovina la squadra
                      </h3>
                      <p className="text-xs text-muted-foreground mb-3">
                        Inserisci il nome di una delle squadre che gioca in
                        questo stadio (+1 Punto Indizio)
                      </p>

                      <div className="relative flex gap-2">
                        <div className="relative flex-1">
                          <input
                            ref={inputRef}
                            type="text"
                            value={guess}
                            onChange={(e) => {
                              setGuess(e.target.value);
                              setShowDropdown(e.target.value.trim().length > 0);
                            }}
                            onFocus={() => {
                              if (guess.trim().length > 0)
                                setShowDropdown(true);
                            }}
                            onBlur={() => {
                              setTimeout(() => setShowDropdown(false), 150);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleStadioGuess();
                              if (e.key === "Escape") setShowDropdown(false);
                            }}
                            placeholder="Scrivi il nome della squadra..."
                            className="w-full border-2 border-black px-3 py-2.5 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] bg-white"
                            autoComplete="off"
                          />

                          {showDropdown &&
                            (() => {
                              const normG = normalizeStr(guess);
                              const matches = allSquadre
                                .filter((sq) => normalizeStr(sq).includes(normG))
                                .slice(0, 10);
                              return matches.length > 0 ? (
                                <div className="absolute z-50 bottom-full mb-1 left-0 right-0 border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] max-h-48 overflow-y-auto">
                                  {matches.map((sq) => (
                                    <button
                                      key={sq}
                                      type="button"
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        setGuess(sq);
                                        setShowDropdown(false);
                                        inputRef.current?.focus();
                                      }}
                                      className="w-full text-left px-3 py-2 font-bold text-xs hover:bg-amber-50 border-b border-gray-100 last:border-b-0 cursor-pointer"
                                    >
                                      {sq}
                                    </button>
                                  ))}
                                </div>
                              ) : null;
                            })()}
                        </div>

                        <Button
                          onClick={handleStadioGuess}
                          disabled={!guess.trim()}
                          className="bg-black text-white font-bold uppercase px-5 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50"
                        >
                          Conferma
                        </Button>
                      </div>

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
