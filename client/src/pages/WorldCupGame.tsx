import { useState, useCallback, useMemo } from "react";
import { Link } from "wouter";
import { NavigationBar } from "@/components/NavigationBar";
import { FeedbackModal } from "@/components/FeedbackModal";

// ─── Tipi ────────────────────────────────────────────────────────────────────

interface PlayerOption {
  name: string;
  overall: number;
}

interface TeamData {
  id: string;
  name: string;
  season: string;
  formation: string;
  overall: number;
  color: string;
  badge: string;
  description: string;
  players: Record<string, PlayerOption[]>;
}

interface BracketOpponent {
  id: string;
  name: string;
  overall: number;
  badge: string;
}

interface BracketRound {
  round: string;
  opponents: BracketOpponent[];
}

interface FormationDef {
  positions: string[];
  positionKeys: string[];
}

interface WorldCupDB {
  teams: TeamData[];
  tournament_bracket: BracketRound[];
  formations: Record<string, FormationDef>;
}

type Phase = "setup" | "build" | "simulate" | "result";

interface BuiltPlayer {
  positionKey: string;
  positionLabel: string;
  player: PlayerOption | null;
  searchQuery: string;
  suggestions: PlayerOption[];
  confirmed: boolean;
}

interface MatchResult {
  opponent: BracketOpponent;
  round: string;
  myOverall: number;
  opponentOverall: number;
  myGoals: number;
  opponentGoals: number;
  won: boolean;
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function computeTeamOverall(players: BuiltPlayer[]): number {
  const confirmed = players.filter((p) => p.confirmed && p.player);
  if (confirmed.length === 0) return 0;
  const sum = confirmed.reduce((acc, p) => acc + (p.player?.overall ?? 0), 0);
  return Math.round(sum / confirmed.length);
}

function simulateMatch(myOverall: number, opponentOverall: number): { myGoals: number; opponentGoals: number } {
  // Formula ispirata a 7a0: differenza di overall influenza probabilità
  const diff = myOverall - opponentOverall;
  const winProb = 0.5 + diff * 0.012; // ogni punto di overall vale ~1.2% di prob
  const clampedProb = Math.max(0.1, Math.min(0.9, winProb));

  // Genera gol con distribuzione Poisson approssimata
  const baseGoals = 1.5;
  const myExpected = baseGoals * (1 + Math.max(0, diff) * 0.02);
  const oppExpected = baseGoals * (1 + Math.max(0, -diff) * 0.02);

  const myGoals = Math.round(myExpected * (0.5 + Math.random()));
  const opponentGoals = Math.round(oppExpected * (0.5 + Math.random()));

  // Assicura che il risultato rispetti la probabilità di vittoria
  const won = Math.random() < clampedProb;
  if (won && myGoals <= opponentGoals) {
    return { myGoals: opponentGoals + 1, opponentGoals };
  }
  if (!won && myGoals >= opponentGoals) {
    return { myGoals, opponentGoals: myGoals + 1 };
  }
  return { myGoals, opponentGoals };
}

function getPositionLabel(key: string): string {
  const map: Record<string, string> = {
    GK: "POR", RB: "TD", CB: "DC", CB2: "DC", CB3: "DC",
    LB: "TS", CDM: "CDC", CDM2: "CDC", CM: "CC", CM2: "CC", CM3: "CC",
    RM: "CD", LM: "CS", RW: "AD", LW: "AS", AM: "TRQ", ST: "ATT", ST2: "ATT"
  };
  return map[key] ?? key;
}

// ─── Componente campo da calcio ───────────────────────────────────────────────

function PitchDisplay({
  formation,
  players,
  onSelectPosition,
  activePosition,
}: {
  formation: string;
  players: BuiltPlayer[];
  onSelectPosition: (key: string) => void;
  activePosition: string | null;
}) {
  // Layout posizioni sul campo (percentuale y dal basso, x da sinistra)
  const positionLayout: Record<string, { x: number; y: number }> = {
    GK:  { x: 50, y: 8 },
    RB:  { x: 80, y: 22 }, CB:  { x: 62, y: 22 }, CB2: { x: 38, y: 22 }, CB3: { x: 20, y: 22 },
    LB:  { x: 20, y: 22 },
    CDM: { x: 60, y: 38 }, CDM2: { x: 40, y: 38 },
    RM:  { x: 80, y: 50 }, CM:  { x: 65, y: 50 }, CM2: { x: 50, y: 50 }, CM3: { x: 35, y: 50 }, LM: { x: 20, y: 50 },
    RW:  { x: 80, y: 70 }, AM:  { x: 50, y: 65 }, LW: { x: 20, y: 70 },
    ST:  { x: 60, y: 82 }, ST2: { x: 40, y: 82 },
  };

  return (
    <div className="relative w-full" style={{ paddingBottom: "140%", background: "linear-gradient(180deg, #2d7a2d 0%, #1e5c1e 100%)", borderRadius: "8px", border: "2px solid #1a4a1a" }}>
      {/* Linee del campo */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 140" preserveAspectRatio="none">
        {/* Bordo */}
        <rect x="5" y="5" width="90" height="130" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5"/>
        {/* Linea di metà campo */}
        <line x1="5" y1="70" x2="95" y2="70" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5"/>
        {/* Cerchio centrale */}
        <circle cx="50" cy="70" r="12" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5"/>
        {/* Area piccola bassa */}
        <rect x="35" y="125" width="30" height="10" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5"/>
        {/* Area grande bassa */}
        <rect x="20" y="115" width="60" height="20" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5"/>
        {/* Area piccola alta */}
        <rect x="35" y="5" width="30" height="10" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5"/>
        {/* Area grande alta */}
        <rect x="20" y="5" width="60" height="20" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5"/>
      </svg>

      {/* Giocatori */}
      {players.map((p) => {
        const pos = positionLayout[p.positionKey] ?? { x: 50, y: 50 };
        const isActive = activePosition === p.positionKey;
        const isConfirmed = p.confirmed && p.player;
        return (
          <button
            key={p.positionKey}
            onClick={() => onSelectPosition(p.positionKey)}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-pointer group"
            style={{ left: `${pos.x}%`, top: `${100 - pos.y}%` }}
          >
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                isActive
                  ? "bg-yellow-400 border-yellow-200 text-black scale-110 shadow-lg"
                  : isConfirmed
                  ? "bg-white border-green-400 text-green-800"
                  : "bg-white/20 border-white/60 text-white hover:bg-white/40"
              }`}
            >
              {isConfirmed ? (
                <span className="text-[10px] font-bold">{p.player!.overall}</span>
              ) : (
                <span className="text-[10px]">{p.positionLabel}</span>
              )}
            </div>
            <div
              className={`mt-0.5 text-[9px] font-semibold max-w-[60px] text-center leading-tight truncate ${
                isConfirmed ? "text-yellow-300" : "text-white/80"
              }`}
            >
              {isConfirmed
                ? p.player!.name.split(" ").slice(-1)[0]
                : p.positionLabel}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Componente principale ────────────────────────────────────────────────────

export default function WorldCupGame() {
  const [db, setDb] = useState<WorldCupDB | null>(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>("setup");
  const [selectedFormation, setSelectedFormation] = useState("4-3-3");
  const [rolledTeam, setRolledTeam] = useState<TeamData | null>(null);
  const [builtPlayers, setBuiltPlayers] = useState<BuiltPlayer[]>([]);
  const [activePositionKey, setActivePositionKey] = useState<string | null>(null);
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationStep, setSimulationStep] = useState(0);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  // Carica il DB al primo render
  const loadDb = useCallback(async () => {
    if (db || dbLoading) return;
    setDbLoading(true);
    try {
      const files = import.meta.glob("/public/worldcup_db.*.json", { as: "url" });
      const keys = Object.keys(files);
      if (keys.length === 0) throw new Error("DB non trovato");
      const url = await files[keys[0]]();
      const res = await fetch(url);
      const data: WorldCupDB = await res.json();
      setDb(data);
    } catch (e) {
      console.error("Errore caricamento DB:", e);
    } finally {
      setDbLoading(false);
    }
  }, [db, dbLoading]);

  // Carica DB all'avvio
  useState(() => { loadDb(); });

  // Estrai una squadra casuale
  const handleRoll = useCallback(() => {
    if (!db) return;
    const available = db.teams.filter((t) => t.id !== rolledTeam?.id);
    const team = available[Math.floor(Math.random() * available.length)];
    setRolledTeam(team);

    // Inizializza i giocatori per la formazione scelta
    const formDef = db.formations[selectedFormation] ?? db.formations["4-3-3"];
    const players: BuiltPlayer[] = formDef.positionKeys.map((key, i) => ({
      positionKey: key,
      positionLabel: getPositionLabel(key),
      player: null,
      searchQuery: "",
      suggestions: [],
      confirmed: false,
    }));
    setBuiltPlayers(players);
    setActivePositionKey(players[0]?.positionKey ?? null);
    setPhase("build");
  }, [db, rolledTeam, selectedFormation]);

  // Cerca giocatori per una posizione
  const handleSearch = useCallback(
    (posKey: string, query: string) => {
      if (!rolledTeam) return;
      setBuiltPlayers((prev) =>
        prev.map((p) => {
          if (p.positionKey !== posKey) return p;
          const options = rolledTeam.players[posKey] ?? [];
          const filtered = query.trim().length >= 2
            ? options.filter((o) =>
                o.name.toLowerCase().includes(query.toLowerCase())
              )
            : options;
          return { ...p, searchQuery: query, suggestions: filtered };
        })
      );
    },
    [rolledTeam]
  );

  // Seleziona un giocatore per una posizione
  const handleSelectPlayer = useCallback((posKey: string, player: PlayerOption) => {
    setBuiltPlayers((prev) =>
      prev.map((p) => {
        if (p.positionKey !== posKey) return p;
        return { ...p, player, searchQuery: player.name, suggestions: [], confirmed: true };
      })
    );
    // Avanza alla prossima posizione non confermata
    setBuiltPlayers((current) => {
      const nextUnconfirmed = current.find(
        (p) => p.positionKey !== posKey && !p.confirmed
      );
      if (nextUnconfirmed) setActivePositionKey(nextUnconfirmed.positionKey);
      return current;
    });
  }, []);

  // Overall totale della squadra costruita
  const teamOverall = useMemo(() => computeTeamOverall(builtPlayers), [builtPlayers]);
  const confirmedCount = builtPlayers.filter((p) => p.confirmed).length;
  const totalPositions = builtPlayers.length;

  // Simula il torneo
  const handleSimulate = useCallback(async () => {
    if (!db || !rolledTeam) return;
    setIsSimulating(true);
    setMatchResults([]);
    setSimulationStep(0);
    setPhase("simulate");

    const results: MatchResult[] = [];
    let eliminated = false;

    for (const bracketRound of db.tournament_bracket) {
      if (eliminated) break;
      // Scegli un avversario casuale per questo round
      const opp = bracketRound.opponents[Math.floor(Math.random() * bracketRound.opponents.length)];
      // Evita di affrontare la propria squadra
      const safeOpp = opp.id === rolledTeam.id
        ? bracketRound.opponents.find((o) => o.id !== rolledTeam.id) ?? opp
        : opp;

      await new Promise((r) => setTimeout(r, 1200));
      const { myGoals, opponentGoals } = simulateMatch(teamOverall, safeOpp.overall);
      const won = myGoals > opponentGoals;

      const result: MatchResult = {
        opponent: safeOpp,
        round: bracketRound.round,
        myOverall: teamOverall,
        opponentOverall: safeOpp.overall,
        myGoals,
        opponentGoals,
        won,
      };
      results.push(result);
      setMatchResults([...results]);
      setSimulationStep((s) => s + 1);

      if (!won) { eliminated = true; }
    }

    setIsSimulating(false);
    setPhase("result");
  }, [db, rolledTeam, teamOverall]);

  // Reset
  const handleReset = useCallback(() => {
    setPhase("setup");
    setRolledTeam(null);
    setBuiltPlayers([]);
    setActivePositionKey(null);
    setMatchResults([]);
    setSimulationStep(0);
  }, []);

  const activePlayer = builtPlayers.find((p) => p.positionKey === activePositionKey);
  const allConfirmed = confirmedCount === totalPositions && totalPositions > 0;
  const won = matchResults.length > 0 && matchResults[matchResults.length - 1]?.won;

  // ─── Render ────────────────────────────────────────────────────────────────

  if (dbLoading) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">Caricamento database...</div>
      </div>
    );
  }

  return (
    <>
      <NavigationBar onFeedbackClick={() => setIsFeedbackOpen(true)} />
      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
    <div className="min-h-screen bg-[#0f0e17] text-white pt-16" style={{ fontFamily: "'Oswald', sans-serif" }}>
      {/* Header */}
      <header className="border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <Link href="/">
          <span className="text-white/60 hover:text-white text-sm cursor-pointer transition-colors">← Torna ai giochi</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-3xl font-black tracking-tighter text-yellow-400">7-0</span>
          <div className="hidden sm:block">
            <div className="text-xs text-white/50 uppercase tracking-widest">Mondiale dei Campioni</div>
            <div className="text-xs text-white/30">Serie A Edition</div>
          </div>
        </div>
        <div className="text-xs text-white/40 uppercase tracking-widest">
          {phase === "setup" && "Setup"}
          {phase === "build" && `${confirmedCount}/${totalPositions}`}
          {phase === "simulate" && "Simulazione"}
          {phase === "result" && (won ? "🏆 Campione!" : "Eliminato")}
        </div>
      </header>

      {/* ── FASE SETUP ── */}
      {phase === "setup" && (
        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Hero */}
          <div className="text-center mb-10">
            <div className="text-8xl font-black tracking-tighter text-yellow-400 leading-none mb-2">7–0</div>
            <h1 className="text-2xl font-bold text-white/90 mb-2">Mondiale dei Campioni</h1>
            <p className="text-white/50 max-w-md mx-auto text-sm">
              Tira i dadi: ottieni una grande squadra della Serie A. Scegli i campioni che ci hanno giocato. Simula il torneo — riesci a vincere 7-0?
            </p>
          </div>

          {/* Steps */}
          <div className="grid grid-cols-3 gap-4 mb-10">
            {[
              { num: "01", label: "TIRA", desc: "Estrai una squadra storica della Serie A" },
              { num: "02", label: "COSTRUISCI", desc: "Scegli i campioni per ogni ruolo" },
              { num: "03", label: "SIMULA", desc: "Scopri se vinci il torneo" },
            ].map((s) => (
              <div key={s.num} className="bg-white/5 rounded-lg p-4 text-center border border-white/10">
                <div className="text-yellow-400 text-2xl font-black">{s.num}</div>
                <div className="text-white font-bold text-sm mt-1">{s.label}</div>
                <div className="text-white/40 text-xs mt-1">{s.desc}</div>
              </div>
            ))}
          </div>

          {/* Selezione formazione */}
          <div className="mb-8">
            <div className="text-white/60 text-xs uppercase tracking-widest mb-3">Formazione</div>
            <div className="flex flex-wrap gap-2">
              {["4-3-3", "4-4-2", "4-2-3-1", "3-5-2"].map((f) => (
                <button
                  key={f}
                  onClick={() => setSelectedFormation(f)}
                  className={`px-4 py-2 rounded text-sm font-bold transition-all ${
                    selectedFormation === f
                      ? "bg-yellow-400 text-black"
                      : "bg-white/10 text-white/70 hover:bg-white/20"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Statistiche DB */}
          <div className="flex gap-6 text-center mb-10 text-white/40 text-xs uppercase tracking-widest">
            <div><span className="text-white font-bold text-lg block">{db?.teams.length ?? 0}</span>squadre storiche</div>
            <div><span className="text-white font-bold text-lg block">3</span>round del torneo</div>
            <div><span className="text-white font-bold text-lg block">1950–2023</span>era coperta</div>
          </div>

          {/* Pulsante ROLL */}
          <div className="text-center">
            <button
              onClick={handleRoll}
              disabled={!db}
              className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black text-xl px-12 py-4 rounded-lg transition-all hover:scale-105 active:scale-95 shadow-lg shadow-red-900/50"
            >
              TIRA I DADI 🎲
            </button>
          </div>
        </div>
      )}

      {/* ── FASE BUILD ── */}
      {phase === "build" && rolledTeam && (
        <div className="max-w-5xl mx-auto px-4 py-6">
          {/* Intestazione squadra estratta */}
          <div className="flex items-center gap-4 mb-6 p-4 rounded-lg" style={{ background: `${rolledTeam.color}22`, border: `1px solid ${rolledTeam.color}44` }}>
            <div className="text-4xl">{rolledTeam.badge}</div>
            <div>
              <div className="font-black text-xl">{rolledTeam.name} <span className="text-white/50">{rolledTeam.season}</span></div>
              <div className="text-white/60 text-sm">{rolledTeam.description}</div>
              <div className="text-xs text-white/40 mt-1">Formazione: {selectedFormation} · Overall squadra: {rolledTeam.overall}</div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-3xl font-black text-yellow-400">{teamOverall || "—"}</div>
              <div className="text-xs text-white/40">tuo overall</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Campo */}
            <div>
              <div className="text-xs text-white/40 uppercase tracking-widest mb-2">Campo — clicca un ruolo per selezionarlo</div>
              <PitchDisplay
                formation={selectedFormation}
                players={builtPlayers}
                onSelectPosition={setActivePositionKey}
                activePosition={activePositionKey}
              />
            </div>

            {/* Pannello selezione giocatore */}
            <div>
              <div className="text-xs text-white/40 uppercase tracking-widest mb-2">
                {activePlayer ? `Seleziona: ${activePlayer.positionLabel} (${activePlayer.positionKey})` : "Seleziona una posizione"}
              </div>

              {activePlayer && (
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <div className="text-sm font-bold mb-3 text-yellow-300">
                    {activePlayer.confirmed ? `✓ ${activePlayer.player?.name} (${activePlayer.player?.overall})` : `Scegli il ${activePlayer.positionLabel}`}
                  </div>

                  {/* Ricerca */}
                  <input
                    type="text"
                    value={activePlayer.searchQuery}
                    onChange={(e) => handleSearch(activePlayer.positionKey, e.target.value)}
                    onFocus={() => handleSearch(activePlayer.positionKey, activePlayer.searchQuery)}
                    placeholder={`Cerca giocatore per ${activePlayer.positionLabel}...`}
                    className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-yellow-400/60 mb-3"
                  />

                  {/* Suggerimenti */}
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {(activePlayer.suggestions.length > 0
                      ? activePlayer.suggestions
                      : rolledTeam.players[activePlayer.positionKey] ?? []
                    ).map((opt) => (
                      <button
                        key={opt.name}
                        onClick={() => handleSelectPlayer(activePlayer.positionKey, opt)}
                        className={`w-full text-left px-3 py-2 rounded text-sm flex items-center justify-between transition-all hover:bg-white/20 ${
                          activePlayer.player?.name === opt.name ? "bg-yellow-400/20 border border-yellow-400/40" : "bg-white/5"
                        }`}
                      >
                        <span className="font-medium">{opt.name}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                          opt.overall >= 90 ? "bg-yellow-400 text-black" :
                          opt.overall >= 85 ? "bg-green-500 text-white" :
                          opt.overall >= 80 ? "bg-blue-500 text-white" :
                          "bg-white/20 text-white"
                        }`}>{opt.overall}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Lista ruoli */}
              <div className="mt-4 space-y-1">
                {builtPlayers.map((p) => (
                  <button
                    key={p.positionKey}
                    onClick={() => setActivePositionKey(p.positionKey)}
                    className={`w-full text-left px-3 py-1.5 rounded text-xs flex items-center gap-2 transition-all ${
                      activePositionKey === p.positionKey
                        ? "bg-yellow-400/20 border border-yellow-400/40"
                        : p.confirmed
                        ? "bg-green-900/30 border border-green-700/30"
                        : "bg-white/5 border border-transparent hover:bg-white/10"
                    }`}
                  >
                    <span className="w-8 text-white/50 font-bold">{p.positionLabel}</span>
                    <span className={p.confirmed ? "text-white" : "text-white/40"}>
                      {p.confirmed ? p.player?.name : "—"}
                    </span>
                    {p.confirmed && (
                      <span className="ml-auto text-yellow-400 font-bold">{p.player?.overall}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Pulsante simula */}
              {allConfirmed && (
                <button
                  onClick={handleSimulate}
                  className="w-full mt-4 bg-red-600 hover:bg-red-500 text-white font-black text-lg py-3 rounded-lg transition-all hover:scale-105 active:scale-95"
                >
                  SIMULA IL TORNEO →
                </button>
              )}
              {!allConfirmed && (
                <div className="mt-4 text-center text-white/30 text-xs">
                  {confirmedCount}/{totalPositions} giocatori selezionati
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── FASE SIMULATE ── */}
      {(phase === "simulate" || phase === "result") && (
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <div className="text-xs text-white/40 uppercase tracking-widest mb-2">Torneo dei Campioni</div>
            <div className="text-xl font-black">{rolledTeam?.name} {rolledTeam?.season}</div>
            <div className="text-white/50 text-sm">Overall squadra: <span className="text-yellow-400 font-bold">{teamOverall}</span></div>
          </div>

          {/* Risultati partite */}
          <div className="space-y-4 mb-8">
            {matchResults.map((r, i) => (
              <div
                key={i}
                className={`rounded-lg p-4 border ${
                  r.won ? "bg-green-900/30 border-green-600/40" : "bg-red-900/30 border-red-600/40"
                }`}
              >
                <div className="text-xs text-white/40 uppercase tracking-widest mb-2">{r.round}</div>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold">
                    <span className="text-yellow-300">{rolledTeam?.badge} {rolledTeam?.name}</span>
                    <span className="text-white/40 text-xs ml-2">OVR {r.myOverall}</span>
                  </div>
                  <div className="text-2xl font-black mx-4">
                    <span className={r.won ? "text-green-400" : "text-white"}>{r.myGoals}</span>
                    <span className="text-white/30 mx-1">–</span>
                    <span className={!r.won ? "text-red-400" : "text-white"}>{r.opponentGoals}</span>
                  </div>
                  <div className="text-sm font-bold text-right">
                    <span>{r.opponent.badge} {r.opponent.name}</span>
                    <span className="text-white/40 text-xs ml-2">OVR {r.opponentOverall}</span>
                  </div>
                </div>
                <div className={`text-xs mt-2 font-bold ${r.won ? "text-green-400" : "text-red-400"}`}>
                  {r.won ? "✓ Vittoria" : "✗ Eliminato"}
                </div>
              </div>
            ))}

            {/* Animazione in corso */}
            {isSimulating && (
              <div className="rounded-lg p-4 border border-white/10 bg-white/5 animate-pulse">
                <div className="text-xs text-white/40 uppercase tracking-widest mb-2">
                  {db?.tournament_bracket[simulationStep]?.round ?? "In corso..."}
                </div>
                <div className="text-center text-white/50">Simulazione in corso...</div>
              </div>
            )}
          </div>

          {/* Risultato finale */}
          {phase === "result" && (
            <div className={`rounded-xl p-6 text-center border ${won ? "bg-yellow-400/10 border-yellow-400/40" : "bg-red-900/20 border-red-600/30"}`}>
              {won ? (
                <>
                  <div className="text-5xl mb-3">🏆</div>
                  <div className="text-2xl font-black text-yellow-400 mb-1">CAMPIONE!</div>
                  <div className="text-white/60 text-sm">Hai vinto il Mondiale dei Campioni con {rolledTeam?.name} {rolledTeam?.season}!</div>
                </>
              ) : (
                <>
                  <div className="text-5xl mb-3">😞</div>
                  <div className="text-2xl font-black text-red-400 mb-1">ELIMINATO</div>
                  <div className="text-white/60 text-sm">
                    Sei stato eliminato al {matchResults[matchResults.length - 1]?.round}. Riprova!
                  </div>
                </>
              )}

              <div className="flex gap-3 justify-center mt-6">
                <button
                  onClick={handleReset}
                  className="bg-white/10 hover:bg-white/20 text-white font-bold px-6 py-2 rounded-lg transition-all"
                >
                  Nuova Partita
                </button>
                <button
                  onClick={() => { setPhase("build"); setMatchResults([]); }}
                  className="bg-yellow-400/20 hover:bg-yellow-400/30 text-yellow-300 font-bold px-6 py-2 rounded-lg transition-all"
                >
                  Modifica Squadra
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
    </>
  );
}
