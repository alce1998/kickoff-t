import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { NavigationBar } from "@/components/NavigationBar";
import { FeedbackModal } from "@/components/FeedbackModal";

// ─── Tipi ────────────────────────────────────────────────────────────────────

interface FootsterPlayer {
  player_id: string;
  name: string;
  birth_year: number;
  photo_url: string;
}

interface TimelineCard {
  player: FootsterPlayer;
}

interface GamePlayer {
  name: string;
  score: number;
  stealTokens: number;
  timeline: TimelineCard[];
}

/**
 * Fasi del turno:
 * 1. turn_start    → mostra foto nascosta, il giocatore attivo sceglie uno slot nella propria timeline
 * 2. name_bonus    → chiedi il nome per guadagnare un gettone furto
 * 3. steal_prompt  → selezione multipla contestatori (checkbox)
 * 4. steal_action  → il contestatore corrente sceglie uno slot nella timeline del giocatore ATTIVO
 * 5. reveal        → rivela nome + anno, mostra risultato, avanza turno
 * 6. winner        → fine partita
 */
type GamePhase =
  | "turn_start"
  | "name_bonus"
  | "steal_prompt"
  | "steal_action"
  | "reveal"
  | "winner";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isCorrectSlot(sortedTimeline: TimelineCard[], slotIndex: number, year: number): boolean {
  const prev = sortedTimeline[slotIndex - 1]?.player.birth_year ?? -Infinity;
  const next = sortedTimeline[slotIndex]?.player.birth_year ?? Infinity;
  if (year === prev || year === next) return true;
  return year > prev && year < next;
}

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function nameMatches(input: string, player: FootsterPlayer): boolean {
  const norm = normalizeText(input);
  const fullNorm = normalizeText(player.name);
  const parts = player.name.split(" ").map(normalizeText);
  return norm === fullNorm || parts.some((p) => p.length > 2 && norm === p);
}

// ─── Navbar ───────────────────────────────────────────────────────────────────

function FootsterNavbar() {
  const { user } = useAuth();
  return (
    <nav className="bg-card border-b-4 border-black px-4 py-2 flex items-center justify-between z-50 flex-shrink-0">
      <Link href="/" className="flex items-center gap-2 font-bold text-sm hover:text-pink-600 transition-colors">
        ← Home
      </Link>
      <span className="font-display font-black text-base uppercase tracking-widest text-pink-600">
        Footster
      </span>
      {user ? (
        <span className="text-xs font-bold truncate max-w-[80px]">{user.name}</span>
      ) : (
        <a
          href={getLoginUrl()}
          className="text-xs font-bold border-2 border-black px-2 py-1 hover:bg-pink-100 transition-colors"
        >
          Login
        </a>
      )}
    </nav>
  );
}

// ─── Autocomplete Input ───────────────────────────────────────────────────────

interface AutocompleteInputProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  allNames: string[];
}

function AutocompleteInput({ value, onChange, onSubmit, placeholder, allNames }: AutocompleteInputProps) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    if (!value || value.length < 2) return [];
    const norm = normalizeText(value);
    return allNames
      .filter((n) => normalizeText(n).includes(norm))
      .slice(0, 8);
  }, [value, allNames]);

  // Chiudi dropdown cliccando fuori
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative flex-1">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { setOpen(false); onSubmit(); }
          if (e.key === "Escape") setOpen(false);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="border-2 border-black rounded-none"
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 bg-card border-2 border-black border-t-0 z-50 max-h-48 overflow-y-auto shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          {suggestions.map((name, i) => (
            <button
              key={i}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(name);
                setOpen(false);
                setTimeout(() => inputRef.current?.focus(), 50);
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-pink-100 border-b border-black/10 last:border-0 font-medium"
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Componente principale ────────────────────────────────────────────────────

export default function FootsterGame() {
  const [, setLocation] = useLocation();

  const params = new URLSearchParams(window.location.search);
  const playerNamesRaw = params.get("players");
  const playerNames: string[] = playerNamesRaw
    ? JSON.parse(playerNamesRaw)
    : ["Giocatore 1", "Giocatore 2"];

  const [db, setDb] = useState<FootsterPlayer[]>([]);
  const [deck, setDeck] = useState<FootsterPlayer[]>([]);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [currentPlayerIdx, setCurrentPlayerIdx] = useState(0);
  const [currentCard, setCurrentCard] = useState<FootsterPlayer | null>(null);
  const [phase, setPhase] = useState<GamePhase>("turn_start");

  // Slot scelto dal giocatore attivo nella propria timeline
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  // Bonus nome
  const [nameInput, setNameInput] = useState("");
  const [nameResult, setNameResult] = useState<"correct" | "wrong" | null>(null);

  // Contestazione multipla
  // Lista degli indici dei giocatori selezionati per contestare (checkbox)
  const [selectedStealers, setSelectedStealers] = useState<number[]>([]);
  // Coda dei contestatori (ordine casuale, determinato al momento della conferma)
  const [stealQueue, setStealQueue] = useState<number[]>([]);
  // Indice corrente nella coda
  const [stealQueuePos, setStealQueuePos] = useState(0);
  // Slot scelto dal contestatore corrente
  const [stealSlot, setStealSlot] = useState<number | null>(null);
  const [stealResult, setStealResult] = useState<"correct" | "wrong" | null>(null);
  // Slot già "occupati" durante la contestazione (non riselezionabili)
  const [usedStealSlots, setUsedStealSlots] = useState<number[]>([]);

  // Risultato finale del posizionamento
  const [revealResult, setRevealResult] = useState<"correct" | "wrong" | null>(null);

  const [imgError, setImgError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  const WIN_SCORE = 7;

  // Tutti i nomi del db per autocomplete
  const allNames = useMemo(() => db.map((p) => p.name), [db]);

  // ─── Carica database ───────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/data/footster_players.0d91baeb.json")
      .then((r) => r.json())
      .then((data: FootsterPlayer[]) => {
        setDb(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // ─── Inizializza gioco ────────────────────────────────────────────────────
  useEffect(() => {
    if (db.length === 0) return;
    const shuffled = shuffle(db);
    const shuffledPlayerNames = shuffle([...playerNames]);
    const initialPlayers: GamePlayer[] = shuffledPlayerNames.map((name, i) => {
      const startCard = shuffled[i % shuffled.length];
      return {
        name,
        score: 0,
        stealTokens: 0,
        timeline: [{ player: startCard }],
      };
    });
    const usedIds = new Set(initialPlayers.map((p) => p.timeline[0].player.player_id));
    const remaining = shuffle(shuffled.filter((p) => !usedIds.has(p.player_id)));
    setPlayers(initialPlayers);
    if (remaining.length > 0) {
      setCurrentCard(remaining[0]);
      setDeck(remaining.slice(1));
    }
    setPhase("turn_start");
  }, [db]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentPlayer = players[currentPlayerIdx];

  // Timeline ordinata del giocatore attivo
  const sortedActiveTimeline = currentPlayer
    ? [...currentPlayer.timeline].sort((a, b) => a.player.birth_year - b.player.birth_year)
    : [];

  // Contestatore corrente (dalla coda)
  const currentStealerIdx = stealQueue[stealQueuePos] ?? null;

  // ─── Fase 1: Posizionamento ───────────────────────────────────────────────
  const handleSlotChoice = (slotIdx: number) => {
    if (phase !== "turn_start" || selectedSlot !== null) return;
    setSelectedSlot(slotIdx);
    setPhase("name_bonus");
  };

  // ─── Fase 2: Bonus nome ───────────────────────────────────────────────────
  const handleNameSubmit = () => {
    if (!currentCard) return;
    const correct = nameMatches(nameInput, currentCard);
    setNameResult(correct ? "correct" : "wrong");
    if (correct) {
      setPlayers((prev) =>
        prev.map((p, i) =>
          i === currentPlayerIdx ? { ...p, stealTokens: p.stealTokens + 1 } : p
        )
      );
    }
    setTimeout(() => {
      setNameResult(null);
      setNameInput("");
      setPhase("steal_prompt");
    }, 1400);
  };

  const handleSkipName = () => {
    setNameInput("");
    setPhase("steal_prompt");
  };

  // ─── Fase 3: Contestazione — selezione multipla ───────────────────────────
  const toggleStealer = (idx: number) => {
    setSelectedStealers((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const handleConfirmStealers = () => {
    if (selectedStealers.length === 0) {
      handleNoSteal();
      return;
    }
    // Ordine casuale tra i contestatori selezionati
    const queue = shuffle([...selectedStealers]);
    setStealQueue(queue);
    setStealQueuePos(0);
    setUsedStealSlots(selectedSlot !== null ? [selectedSlot] : []);
    setStealSlot(null);
    setStealResult(null);
    setPhase("steal_action");
  };

  // ─── Fase 4: Rinuncia alla contestazione ───────────────────────────────────
  const handleStealGiveUp = () => {
    // Il contestatore rinuncia senza perdere gettoni, passa al prossimo
    setTimeout(() => {
      setStealResult(null);
      setStealSlot(null);
      const nextPos = stealQueuePos + 1;
      if (nextPos < stealQueue.length) {
        setStealQueuePos(nextPos);
      } else {
        // Nessun altro contestatore: verifica se il giocatore attivo aveva ragione
        const activeCorrect = isCorrectSlot(sortedActiveTimeline, selectedSlot!, currentCard!.birth_year);
        if (activeCorrect) {
          setPlayers((prev) =>
            prev.map((p, i) => {
              if (i === currentPlayerIdx) {
                return {
                  ...p,
                  score: p.score + 1,
                  timeline: [...p.timeline, { player: currentCard! }],
                };
              }
              return p;
            })
          );
        }
        setRevealResult(activeCorrect ? "correct" : "wrong");
        setPhase("reveal");
      }
    }, 0);
  };

  // ─── Fase 4: Azione furto ─────────────────────────────────────────────────
  const handleStealSlotChoice = (slotIdx: number) => {
    if (!currentCard || currentStealerIdx === null || selectedSlot === null) return;
    if (usedStealSlots.includes(slotIdx)) return; // slot già usato

    setStealSlot(slotIdx);

    const correct = isCorrectSlot(sortedActiveTimeline, slotIdx, currentCard.birth_year);
    setStealResult(correct ? "correct" : "wrong");

    if (correct) {
      // Il contestatore ruba il cartellino
      setPlayers((prev) =>
        prev.map((p, i) => {
          if (i === currentStealerIdx) {
            return {
              ...p,
              score: p.score + 1,
              stealTokens: p.stealTokens - 1,
              timeline: [...p.timeline, { player: currentCard }],
            };
          }
          return p;
        })
      );
      setRevealResult("wrong");
      setTimeout(() => {
        setStealResult(null);
        setStealSlot(null);
        setPhase("reveal");
      }, 1600);
    } else {
      // Sbaglia: perde il gettone, aggiunge lo slot agli usati e passa al prossimo contestatore
      setPlayers((prev) =>
        prev.map((p, i) =>
          i === currentStealerIdx ? { ...p, stealTokens: p.stealTokens - 1 } : p
        )
      );
      const newUsed = [...usedStealSlots, slotIdx];
      setUsedStealSlots(newUsed);

      setTimeout(() => {
        setStealResult(null);
        setStealSlot(null);
        const nextPos = stealQueuePos + 1;
        if (nextPos < stealQueue.length) {
          // Prossimo contestatore
          setStealQueuePos(nextPos);
        } else {
          // Nessun altro contestatore: verifica se il giocatore attivo aveva ragione
          const activeCorrect = isCorrectSlot(sortedActiveTimeline, selectedSlot, currentCard.birth_year);
          if (activeCorrect) {
            setPlayers((prev) =>
              prev.map((p, i) => {
                if (i === currentPlayerIdx) {
                  return {
                    ...p,
                    score: p.score + 1,
                    timeline: [...p.timeline, { player: currentCard }],
                  };
                }
                return p;
              })
            );
          }
          setRevealResult(activeCorrect ? "correct" : "wrong");
          setPhase("reveal");
        }
      }, 1600);
    }
  };

  // ─── Fase 3b: Nessuna contestazione ──────────────────────────────────────
  const handleNoSteal = () => {
    if (!currentCard || selectedSlot === null) return;
    const correct = isCorrectSlot(sortedActiveTimeline, selectedSlot, currentCard.birth_year);
    setRevealResult(correct ? "correct" : "wrong");
    if (correct) {
      setPlayers((prev) =>
        prev.map((p, i) => {
          if (i === currentPlayerIdx) {
            return {
              ...p,
              score: p.score + 1,
              timeline: [...p.timeline, { player: currentCard }],
            };
          }
          return p;
        })
      );
    }
    setPhase("reveal");
  };

  // ─── Avanza turno ─────────────────────────────────────────────────────────
  const handleNextTurn = () => {
    const winner = players.find((p) => p.score >= WIN_SCORE);
    if (winner) {
      setPhase("winner");
      return;
    }
    let nextCard: FootsterPlayer | null = null;
    let nextDeck = deck;
    if (deck.length === 0) {
      const usedIds = new Set(players.flatMap((p) => p.timeline.map((c) => c.player.player_id)));
      const newDeck = shuffle(db.filter((p) => !usedIds.has(p.player_id)));
      if (newDeck.length === 0) { setPhase("winner"); return; }
      nextCard = newDeck[0];
      nextDeck = newDeck.slice(1);
    } else {
      nextCard = deck[0];
      nextDeck = deck.slice(1);
    }
    setCurrentCard(nextCard);
    setDeck(nextDeck);
    setSelectedSlot(null);
    setNameInput("");
    setSelectedStealers([]);
    setStealQueue([]);
    setStealQueuePos(0);
    setStealSlot(null);
    setUsedStealSlots([]);
    setStealResult(null);
    setRevealResult(null);
    setImgError(false);
    setCurrentPlayerIdx((prev) => (prev + 1) % players.length);
    setPhase("turn_start");
  };

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <FootsterNavbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-xl font-bold animate-pulse">Caricamento Footster...</div>
        </div>
      </div>
    );
  }

  if (!currentCard || players.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <FootsterNavbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-xl font-bold">Errore nel caricamento del database.</div>
        </div>
      </div>
    );
  }

  // ─── Schermata vittoria ───────────────────────────────────────────────────
  if (phase === "winner") {
    const winner = [...players].sort((a, b) => b.score - a.score)[0];
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <FootsterNavbar />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-card border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8 max-w-sm w-full">
            <div className="text-7xl mb-4">🏆</div>
            <h1 className="font-display text-4xl font-black uppercase mb-2">HAI VINTO!</h1>
            <p className="text-2xl font-bold mb-1">{winner.name}</p>
            <p className="text-muted-foreground mb-6">{winner.score} cartellini collezionati</p>
            <div className="border-2 border-black p-4 mb-6 text-left">
              <h3 className="font-bold uppercase text-sm tracking-wider mb-3">Classifica finale</h3>
              {[...players]
                .sort((a, b) => b.score - a.score)
                .map((p, i) => (
                  <div key={i} className="flex justify-between py-1 border-b border-black/10 last:border-0">
                    <span className="font-medium">{i + 1}. {p.name}</span>
                    <span className="font-black text-pink-600">{p.score} 🃏</span>
                  </div>
                ))}
            </div>
            <Button
              onClick={() => setLocation("/footster")}
              className="w-full bg-black hover:bg-gray-900 text-white font-black py-4 rounded-none border-2 border-black uppercase"
            >
              Nuova partita
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Layout principale ────────────────────────────────────────────────────
  const eligibleStealers = players.filter((p, i) => i !== currentPlayerIdx && p.stealTokens > 0);

  return (
    <>
      <NavigationBar onFeedbackClick={() => setIsFeedbackOpen(true)} />
      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
    <div className="min-h-screen bg-background flex flex-col pt-16">
      <FootsterNavbar />

      {/* Header punteggi */}
      <div className="bg-card border-b-4 border-black px-3 py-2 flex gap-2 overflow-x-auto flex-shrink-0">
        {players.map((p, i) => (
          <div
            key={i}
            className={`flex-shrink-0 border-2 border-black px-3 py-1.5 text-center min-w-[72px] transition-all ${
              i === currentPlayerIdx
                ? "bg-pink-500 text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                : "bg-white text-black"
            }`}
          >
            <div className="text-xs font-bold truncate max-w-[64px]">{p.name}</div>
            <div className="text-base font-black leading-none">{p.score}<span className="text-xs ml-0.5">🃏</span></div>
            <div className="text-xs opacity-70">{p.stealTokens}🪙</div>
          </div>
        ))}
      </div>

      {/* Corpo */}
      <div className="flex-1 flex flex-col items-center px-4 py-5 gap-5 max-w-2xl mx-auto w-full">

        {/* Turno */}
        <div className="font-display font-black text-sm uppercase tracking-widest text-pink-600">
          Turno di {currentPlayer.name}
        </div>

        {/* Carta calciatore */}
        <div className="relative w-48 h-64 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-gray-200 flex-shrink-0">
          {!imgError ? (
            <img
              src={currentCard.photo_url}
              alt="Calciatore"
              className="w-full h-full object-cover object-top"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-300">
              <span className="text-6xl">⚽</span>
            </div>
          )}
          {phase !== "reveal" && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-2 text-center">
              <div className="text-white font-black text-xl">???</div>
              <div className="text-yellow-300 text-xs">Anno nascosto</div>
            </div>
          )}
          {phase === "reveal" && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/90 p-2 text-center">
              <div className="text-white font-bold text-sm leading-tight">{currentCard.name}</div>
              <div className="text-yellow-300 font-black text-2xl">{currentCard.birth_year}</div>
            </div>
          )}
        </div>

        {/* ─── FASE 1: Posizionamento ───────────────────────────────────────── */}
        {phase === "turn_start" && (
          <div className="w-full">
            <p className="font-bold text-center mb-3 text-sm uppercase tracking-wide">
              Dove si posiziona questo calciatore nella tua timeline?
            </p>
            <TimelineSlots
              timeline={sortedActiveTimeline}
              onSlotSelect={handleSlotChoice}
              selectedSlot={selectedSlot}
              highlightSlot={null}
              disabledSlots={[]}
            />
          </div>
        )}

        {/* ─── FASE 2: Bonus nome ───────────────────────────────────────────── */}
        {phase === "name_bonus" && (
          <div className="w-full max-w-sm bg-card border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-5 text-center">
            <p className="font-display font-black text-lg uppercase mb-1">⭐ Bonus Gettone Furto</p>
            <p className="text-sm text-muted-foreground mb-4">Conosci il nome di questo calciatore?</p>
            {nameResult === "correct" && (
              <div className="text-green-600 font-black text-xl mb-2">✅ Corretto! +1 🪙</div>
            )}
            {nameResult === "wrong" && (
              <div className="text-red-600 font-black text-xl mb-2">❌ Sbagliato!</div>
            )}
            {nameResult === null && (
              <>
                <div className="flex gap-2">
                  <AutocompleteInput
                    value={nameInput}
                    onChange={setNameInput}
                    onSubmit={handleNameSubmit}
                    placeholder="Nome del calciatore..."
                    allNames={allNames}
                  />
                  <Button
                    onClick={handleNameSubmit}
                    className="bg-black hover:bg-gray-900 text-white font-bold rounded-none border-2 border-black"
                  >
                    OK
                  </Button>
                </div>
                <button
                  onClick={handleSkipName}
                  className="mt-3 text-muted-foreground hover:text-foreground text-sm transition-colors underline"
                >
                  Non lo so → Salta
                </button>
              </>
            )}
          </div>
        )}

        {/* ─── FASE 3: Contestazione — selezione multipla ──────────────────── */}
        {phase === "steal_prompt" && (
          <div className="w-full max-w-sm bg-card border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-5 text-center">
            <p className="font-display font-black text-lg uppercase mb-1">🔥 Qualcuno vuole contestare?</p>
            <p className="text-sm text-muted-foreground mb-4">
              Seleziona chi vuole sfidare il posizionamento di <strong>{currentPlayer.name}</strong>.
              Il sistema stabilirà l'ordine casuale.
            </p>
            <div className="flex flex-col gap-2 mb-4">
              {eligibleStealers.length === 0 && (
                <p className="text-sm text-muted-foreground italic">Nessun giocatore ha gettoni disponibili.</p>
              )}
              {eligibleStealers.map((p) => {
                const realIdx = players.findIndex((pl) => pl.name === p.name);
                const checked = selectedStealers.includes(realIdx);
                return (
                  <button
                    key={realIdx}
                    onClick={() => toggleStealer(realIdx)}
                    className={`flex items-center gap-3 py-2 px-4 border-2 border-black font-bold transition-all uppercase text-left ${
                      checked
                        ? "bg-red-600 text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                        : "bg-white text-black hover:bg-red-50"
                    }`}
                  >
                    <span className={`w-5 h-5 border-2 border-black flex items-center justify-center flex-shrink-0 ${checked ? "bg-white" : "bg-white"}`}>
                      {checked && <span className="text-red-600 font-black text-xs">✓</span>}
                    </span>
                    {p.name} ({p.stealTokens}🪙)
                  </button>
                );
              })}
            </div>
            <Button
              onClick={handleConfirmStealers}
              className="w-full bg-black hover:bg-gray-900 text-white font-bold rounded-none border-2 border-black uppercase"
            >
              {selectedStealers.length > 0
                ? `Avvia contestazione (${selectedStealers.length}) →`
                : "Nessuna contestazione →"}
            </Button>
          </div>
        )}

        {/* ─── FASE 4: Azione furto — slot sulla timeline del giocatore ATTIVO */}
        {phase === "steal_action" && currentStealerIdx !== null && (
          <div className="w-full">
            <div className="bg-red-50 border-4 border-red-600 shadow-[4px_4px_0px_0px_rgba(220,38,38,1)] p-4 text-center mb-4">
              <p className="font-display font-black text-lg uppercase text-red-700">
                🔥 {players[currentStealerIdx].name} sta contestando!
              </p>
              <p className="text-sm text-red-600 mt-1">
                Scegli uno slot <strong>diverso</strong> nella timeline di <strong>{currentPlayer.name}</strong>
              </p>
              {stealQueue.length > 1 && (
                <p className="text-xs text-red-500 mt-1">
                  Contestatore {stealQueuePos + 1} di {stealQueue.length}
                </p>
              )}
            </div>
            {stealResult === "correct" && (
              <div className="text-green-600 font-black text-xl text-center mb-3">✅ Furto riuscito! +1 🃏</div>
            )}
            {stealResult === "wrong" && (
              <div className="text-red-600 font-black text-xl text-center mb-3">❌ Furto fallito! -1 🪙</div>
            )}
            {stealResult === null && (
              <>
                <TimelineSlots
                  timeline={sortedActiveTimeline}
                  onSlotSelect={handleStealSlotChoice}
                  selectedSlot={stealSlot}
                  highlightSlot={selectedSlot}
                  disabledSlots={usedStealSlots}
                />
                <div className="text-center mt-3">
                  <button
                    onClick={handleStealGiveUp}
                    className="text-sm text-muted-foreground hover:text-foreground underline transition-colors"
                  >
                    Rinuncia alla contestazione →
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ─── FASE 5: Reveal ──────────────────────────────────────────────── */}
        {phase === "reveal" && (
          <div className="w-full max-w-sm text-center">
            {revealResult === "correct" && (
              <div className="text-green-600 font-black text-2xl mb-3">✅ Corretto! +1 🃏</div>
            )}
            {revealResult === "wrong" && (
              <div className="text-red-600 font-black text-2xl mb-3">❌ Sbagliato!</div>
            )}
            <div className="bg-card border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 mb-4">
              <div className="font-bold text-lg">{currentCard.name}</div>
              <div className="font-black text-4xl text-pink-600">{currentCard.birth_year}</div>

            </div>
            <Button
              onClick={handleNextTurn}
              className="w-full bg-black hover:bg-gray-900 text-white font-black py-4 rounded-none border-2 border-black uppercase tracking-wide"
            >
              Turno successivo →
            </Button>
          </div>
        )}
      </div>
    </div>
    </>
  );
}

// ─── Componente Timeline con Slot ─────────────────────────────────────────────

interface TimelineSlotsProps {
  timeline: TimelineCard[];
  onSlotSelect: (idx: number) => void;
  selectedSlot: number | null;
  /** Slot già scelto dal giocatore attivo (evidenziato in giallo durante la contestazione) */
  highlightSlot: number | null;
  /** Slot disabilitati (già scelti da contestatori precedenti o dal giocatore attivo) */
  disabledSlots: number[];
}

function TimelineSlots({ timeline, onSlotSelect, selectedSlot, highlightSlot, disabledSlots }: TimelineSlotsProps) {
  const slots = timeline.length + 1;

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2 px-2">
      {Array.from({ length: slots }, (_, i) => {
        const isDisabled = disabledSlots.includes(i) || (selectedSlot !== null && selectedSlot !== i);
        const isHighlight = highlightSlot === i;
        const isSelected = selectedSlot === i;

        return (
          <div key={i} className="flex items-center gap-1 flex-shrink-0">
            {/* Slot pulsante */}
            <button
              onClick={() => !isDisabled && onSlotSelect(i)}
              disabled={isDisabled}
              title={disabledSlots.includes(i) ? "Slot già scelto" : undefined}
              className={`w-8 h-16 border-2 border-black font-black text-lg transition-all flex items-center justify-center flex-shrink-0 ${
                isSelected
                  ? "bg-pink-500 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  : isHighlight
                  ? "bg-yellow-400 text-black border-yellow-600 cursor-not-allowed"
                  : disabledSlots.includes(i)
                  ? "bg-gray-300 text-gray-400 cursor-not-allowed border-gray-400 line-through"
                  : isDisabled
                  ? "bg-gray-100 text-gray-300 cursor-not-allowed"
                  : "bg-white text-black hover:bg-pink-100 hover:border-pink-500"
              }`}
            >
              {disabledSlots.includes(i) ? "✗" : isHighlight ? "★" : "+"}
            </button>
            {/* Carta calciatore */}
            {i < timeline.length && (
              <div className="flex-shrink-0 w-20 h-28 border-2 border-black overflow-hidden bg-gray-200 relative">
                <img
                  src={timeline[i].player.photo_url}
                  alt={timeline[i].player.name}
                  className="w-full h-full object-cover object-top"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-0.5 text-center">
                  <div className="text-yellow-300 font-black text-sm leading-none">
                    {timeline[i].player.birth_year}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
