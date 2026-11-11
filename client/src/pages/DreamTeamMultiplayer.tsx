import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { NavigationBar } from "@/components/NavigationBar";
import { FeedbackModal } from "@/components/FeedbackModal";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useAchievements } from "@/hooks/useAchievements";
import { useTheme } from "@/contexts/ThemeContext";
import { Users, Copy, Check, Trophy, Star, ChevronLeft, Zap } from "lucide-react";

// ─── Types (shared with DreamTeamGame) ───────────────────────────────────────
type SpecificRole = "GK" | "CB" | "RB" | "LB" | "WB" | "CDM" | "CM" | "CAM" | "RM" | "LM" | "RW" | "LW" | "SS" | "ST" | "CF";
type GenericRole = "GK" | "DF" | "MF" | "FW";

interface Player {
  name: string;
  role: GenericRole;
  roles?: SpecificRole[];
  nat: string;
  ovr: number;
}

interface Team {
  id: string;
  name: string;
  season: string;
  coach: string;
  color: string;
  badge: string;
  description: string;
  overall: number;
  players: Player[];
}

interface DB { teams: Team[]; }

interface FieldSlot {
  id: string;
  role: GenericRole;
  specificRole: SpecificRole;
  x: number;
  y: number;
  assignedPlayer: Player | null;
  fromTeam: Team | null;
}

interface SlotDef {
  specificRole: SpecificRole;
  role: GenericRole;
  xFn: (i: number, total: number) => number;
  y: number;
}

interface Formation {
  label: string;
  df: number; mf: number; fw: number;
  slots: SlotDef[];
}

// ─── Formations (same as DreamTeamGame) ──────────────────────────────────────
const xPos = (i: number, total: number) => ((i + 1) / (total + 1)) * 100;

const FORMATIONS: Formation[] = [
  {
    label: "4-3-3", df: 4, mf: 3, fw: 3,
    slots: [
      { specificRole: "GK", role: "GK", xFn: () => 50, y: 88 },
      { specificRole: "RB", role: "DF", xFn: (i) => xPos(i, 4), y: 72 },
      { specificRole: "CB", role: "DF", xFn: (i) => xPos(i, 4), y: 72 },
      { specificRole: "CB", role: "DF", xFn: (i) => xPos(i, 4), y: 72 },
      { specificRole: "LB", role: "DF", xFn: (i) => xPos(i, 4), y: 72 },
      { specificRole: "CM", role: "MF", xFn: (i) => xPos(i, 3), y: 50 },
      { specificRole: "CDM", role: "MF", xFn: (i) => xPos(i, 3), y: 50 },
      { specificRole: "CM", role: "MF", xFn: (i) => xPos(i, 3), y: 50 },
      { specificRole: "RW", role: "FW", xFn: (i) => xPos(i, 3), y: 20 },
      { specificRole: "ST", role: "FW", xFn: (i) => xPos(i, 3), y: 20 },
      { specificRole: "LW", role: "FW", xFn: (i) => xPos(i, 3), y: 20 },
    ],
  },
  {
    label: "4-4-2", df: 4, mf: 4, fw: 2,
    slots: [
      { specificRole: "GK", role: "GK", xFn: () => 50, y: 88 },
      { specificRole: "RB", role: "DF", xFn: (i) => xPos(i, 4), y: 72 },
      { specificRole: "CB", role: "DF", xFn: (i) => xPos(i, 4), y: 72 },
      { specificRole: "CB", role: "DF", xFn: (i) => xPos(i, 4), y: 72 },
      { specificRole: "LB", role: "DF", xFn: (i) => xPos(i, 4), y: 72 },
      { specificRole: "RM", role: "MF", xFn: (i) => xPos(i, 4), y: 52 },
      { specificRole: "CM", role: "MF", xFn: (i) => xPos(i, 4), y: 52 },
      { specificRole: "CM", role: "MF", xFn: (i) => xPos(i, 4), y: 52 },
      { specificRole: "LM", role: "MF", xFn: (i) => xPos(i, 4), y: 52 },
      { specificRole: "ST", role: "FW", xFn: (i) => xPos(i, 2), y: 22 },
      { specificRole: "ST", role: "FW", xFn: (i) => xPos(i, 2), y: 22 },
    ],
  },
  {
    label: "4-2-3-1", df: 4, mf: 5, fw: 1,
    slots: [
      { specificRole: "GK", role: "GK", xFn: () => 50, y: 88 },
      { specificRole: "RB", role: "DF", xFn: (i) => xPos(i, 4), y: 72 },
      { specificRole: "CB", role: "DF", xFn: (i) => xPos(i, 4), y: 72 },
      { specificRole: "CB", role: "DF", xFn: (i) => xPos(i, 4), y: 72 },
      { specificRole: "LB", role: "DF", xFn: (i) => xPos(i, 4), y: 72 },
      { specificRole: "CDM", role: "MF", xFn: (i) => xPos(i, 2), y: 58 },
      { specificRole: "CDM", role: "MF", xFn: (i) => xPos(i, 2), y: 58 },
      { specificRole: "RW", role: "MF", xFn: (i) => xPos(i, 3), y: 38 },
      { specificRole: "CAM", role: "MF", xFn: (i) => xPos(i, 3), y: 38 },
      { specificRole: "LW", role: "MF", xFn: (i) => xPos(i, 3), y: 38 },
      { specificRole: "ST", role: "FW", xFn: () => 50, y: 18 },
    ],
  },
  {
    label: "3-5-2", df: 3, mf: 5, fw: 2,
    slots: [
      { specificRole: "GK", role: "GK", xFn: () => 50, y: 88 },
      { specificRole: "CB", role: "DF", xFn: (i) => xPos(i, 3), y: 72 },
      { specificRole: "CB", role: "DF", xFn: (i) => xPos(i, 3), y: 72 },
      { specificRole: "CB", role: "DF", xFn: (i) => xPos(i, 3), y: 72 },
      { specificRole: "RM", role: "MF", xFn: (i) => xPos(i, 5), y: 52 },
      { specificRole: "CM", role: "MF", xFn: (i) => xPos(i, 5), y: 52 },
      { specificRole: "CDM", role: "MF", xFn: (i) => xPos(i, 5), y: 52 },
      { specificRole: "CM", role: "MF", xFn: (i) => xPos(i, 5), y: 52 },
      { specificRole: "LM", role: "MF", xFn: (i) => xPos(i, 5), y: 52 },
      { specificRole: "ST", role: "FW", xFn: (i) => xPos(i, 2), y: 22 },
      { specificRole: "ST", role: "FW", xFn: (i) => xPos(i, 2), y: 22 },
    ],
  },
];

// ─── Role compatibility ───────────────────────────────────────────────────────
const ROLE_COMPAT: Partial<Record<SpecificRole, SpecificRole[]>> = {
  RM: ["RM", "RW"], RW: ["RW", "RM"],
  LM: ["LM", "LW"], LW: ["LW", "LM"],
  CF: ["CF", "ST"], ST: ["ST", "CF", "SS"], SS: ["SS", "ST", "CF"],
  WB: ["WB", "RB", "LB"], RB: ["RB", "WB"], LB: ["LB", "WB"],
};

function canPlayPosition(player: Player, slotSpecificRole: SpecificRole): boolean {
  const playerRoles: SpecificRole[] = player.roles && player.roles.length > 0 ? player.roles : ["GK"];
  const acceptedRoles: SpecificRole[] = ROLE_COMPAT[slotSpecificRole] ?? [slotSpecificRole];
  return playerRoles.some(r => acceptedRoles.includes(r));
}

const ROLE_LABEL: Record<string, string> = {
  GK: "Portiere", CB: "Difensore Centrale", RB: "Terzino Destro", LB: "Terzino Sinistro",
  WB: "Terzino a Tutta Fascia", CDM: "Mediano", CM: "Centrocampista", CAM: "Trequartista",
  RM: "Mezzala Destra", LM: "Mezzala Sinistra", RW: "Ala Destra", LW: "Ala Sinistra",
  SS: "Seconda Punta", ST: "Prima Punta", CF: "Centravanti",
};

const ROLE_COLOR: Record<string, string> = {
  GK: "bg-yellow-500", DF: "bg-blue-500", MF: "bg-green-500", FW: "bg-red-500",
  CB: "bg-blue-600", RB: "bg-blue-400", LB: "bg-blue-400", WB: "bg-blue-300",
  CDM: "bg-emerald-600", CM: "bg-green-500", CAM: "bg-teal-500",
  RM: "bg-green-400", LM: "bg-green-400", RW: "bg-lime-500", LW: "bg-lime-500",
  SS: "bg-orange-500", ST: "bg-red-500", CF: "bg-red-600",
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function calcTeamOvr(slots: FieldSlot[]): number {
  const players = slots.map(s => s.assignedPlayer).filter(Boolean) as Player[];
  if (!players.length) return 70;
  return Math.round(players.reduce((s, p) => s + p.ovr, 0) / players.length);
}

function buildFieldSlots(f: Formation): FieldSlot[] {
  const rowGroups = new Map<number, SlotDef[]>();
  for (const s of f.slots) {
    if (!rowGroups.has(s.y)) rowGroups.set(s.y, []);
    rowGroups.get(s.y)!.push(s);
  }
  const slots: FieldSlot[] = [];
  const roleCount: Record<string, number> = {};
  const rightRolesMP: SpecificRole[] = ["RB", "RW", "RM"];
  const leftRolesMP: SpecificRole[] = ["LB", "LW", "LM"];
  for (const [, rowSlots] of Array.from(rowGroups)) {
    rowSlots.forEach((s: SlotDef, idxInRow: number) => {
      const key = s.specificRole;
      roleCount[key] = (roleCount[key] || 0) + 1;
      const id = `${s.specificRole}-${roleCount[key]}`;
      const rawX = s.xFn(idxInRow, rowSlots.length);
      // Specchia LB e RB come nel single player per posizionarli correttamente
      let finalX = rawX;
      if (rightRolesMP.includes(s.specificRole) || leftRolesMP.includes(s.specificRole)) {
        finalX = 100 - rawX;
      }
      slots.push({
        id, role: s.role, specificRole: s.specificRole,
        x: finalX,
        y: s.y, assignedPlayer: null, fromTeam: null,
      });
    });
  }
  return slots;
}

// ─── Simulate match ───────────────────────────────────────────────────────────
function simulateMatch(myOvr: number, oppOvr: number, myPlayers: Player[], _oppPlayers: Player[]) {
  const winProb = Math.min(0.75, Math.max(0.10, 0.45 + (myOvr - oppOvr) * 0.015));
  const drawProb = 0.22;
  const r = Math.random();
  const win = r < winProb;
  const draw = !win && r < winProb + drawProb;
  const myGoals = win ? Math.floor(Math.random() * 3) + 1 : draw ? Math.floor(Math.random() * 2) : Math.floor(Math.random() * 2);
  const oppGoals = win ? Math.max(0, myGoals - 1 - Math.floor(Math.random() * 2)) : draw ? myGoals : myGoals + 1 + Math.floor(Math.random() * 2);
  const scorers: string[] = [];
  const fwPlayers = myPlayers.filter(p => p.role === "FW" || (p.roles && (p.roles.includes("ST") || p.roles.includes("CF") || p.roles.includes("LW") || p.roles.includes("RW"))));
  const mfPlayers = myPlayers.filter(p => p.role === "MF");
  const allScorers = [...fwPlayers, ...fwPlayers, ...mfPlayers, ...myPlayers];
  for (let i = 0; i < myGoals; i++) {
    const scorer = allScorers[Math.floor(Math.random() * allScorers.length)];
    if (scorer) scorers.push(scorer.name.split(" ").pop() || scorer.name);
  }
  return { win, draw, score: `${myGoals}-${oppGoals}`, scorers, oppGoals: oppGoals as number, myGoals: myGoals as number };
}

function simulatePenalties(): { win: boolean; myPens: number; oppPens: number } {
  let myPens = 0, oppPens = 0;
  for (let i = 0; i < 5; i++) {
    if (Math.random() < 0.75) myPens++;
    if (Math.random() < 0.75) oppPens++;
  }
  let round = 0;
  while (myPens === oppPens && round < 10) {
    if (Math.random() < 0.75) myPens++;
    if (Math.random() < 0.75) oppPens++;
    round++;
  }
  return { win: myPens > oppPens, myPens, oppPens };
}

// ─── DB hash ─────────────────────────────────────────────────────────────────
const DB_FILE = "/dreamteam_db.d7d8b7b0.json";

// ─── Main Component ───────────────────────────────────────────────────────────
type MultiPhase = "menu" | "create" | "join" | "lobby" | "picking" | "waiting" | "group" | "knockout" | "tournament" | "result";

export default function DreamTeamMultiplayer() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { isModern } = useTheme();
  const bgPage = isModern ? "bg-gray-950" : "bg-[#FFF5F5]";
  const { unlock } = useAchievements();
  const recordGamePlayed = trpc.achievements.recordGamePlayed.useMutation();

  // Poliglotta: record that the user played this game
  useEffect(() => {
    if (user) recordGamePlayed.mutate({ gameType: 'dream-team' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [db, setDb] = useState<DB | null>(null);
  const [phase, setPhase] = useState<MultiPhase>("menu");
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [selectedFormation, setSelectedFormation] = useState<Formation>(FORMATIONS[0]);
  const [fieldSlots, setFieldSlots] = useState<FieldSlot[]>([]);
  const [teamQueue, setTeamQueue] = useState<Team[]>([]);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [myOvr, setMyOvr] = useState(0);
  const [bracketResults, setBracketResults] = useState<{ round: string; opp: string; score: string; win: boolean; penalties?: { myPens: number; oppPens: number } }[]>([]);
  const [bracketStep, setBracketStep] = useState(0);
  const [finalResult, setFinalResult] = useState<"winner" | "eliminated" | null>(null);
  // Simulazione knockout progressiva (identica al single player)
  const [groupMatches, setGroupMatches] = useState<{opponent: string; oppOvr: number; win: boolean; draw: boolean; score: string; points: number; scorers: string[]; oppScorers: string[]}[]>([]);
  const [groupStep, setGroupStep] = useState(0);
  const [groupPoints, setGroupPoints] = useState(0);
  const [qualified, setQualified] = useState(false);
  const [knockoutRounds, setKnockoutRounds] = useState<{label: string; opp: string; myOvr: number; oppOvr: number; win: boolean; score: string; scorers: string[]; oppScorers: string[]; penalties?: {myPens: number; oppPens: number; win: boolean; sequence?: {isHome: boolean; scored: boolean}[]}}[]>([]);
  const [currentKnockoutIdx, setCurrentKnockoutIdx] = useState(0);
  const [matchMinute, setMatchMinute] = useState(0);
  const [matchScoreHome, setMatchScoreHome] = useState(0);
  const [matchScoreAway, setMatchScoreAway] = useState(0);
  const [matchGoalEvents, setMatchGoalEvents] = useState<{minute: number; scorer: string; isHome: boolean}[]>([]);
  const [matchSimRunning, setMatchSimRunning] = useState(false);
  const [matchSimDone, setMatchSimDone] = useState(false);
  const [waitingNextRound, setWaitingNextRound] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [myUserId, setMyUserId] = useState<number | null>(null);

  // tRPC mutations/queries
  const createRoom = trpc.dreamTeam.createRoom.useMutation();
  const joinRoom = trpc.dreamTeam.joinRoom.useMutation();
  const setFormation = trpc.dreamTeam.setFormation.useMutation();
  const startPickingMutation = trpc.dreamTeam.startPicking.useMutation();
  const setReady = trpc.dreamTeam.setReady.useMutation();
  const leaveRoom = trpc.dreamTeam.leaveRoom.useMutation();
  const { data: roomData, refetch: refetchRoom } = trpc.dreamTeam.getRoom.useQuery(
    { code: roomCode },
    { enabled: roomCode.length === 6, refetchInterval: (phase === "lobby" || phase === "picking" || phase === "waiting") ? 2000 : false }
  );

  // Load DB
  useEffect(() => {
    fetch(DB_FILE).then(r => r.json()).then((d: DB) => setDb(d)).catch(console.error);
  }, []);

  // Set display name from user
  useEffect(() => {
    if (user?.name && !displayName) setDisplayName(user.name.slice(0, 20));
    if (user?.id) setMyUserId(user.id);
  }, [user]);

  // Watch room status changes
  useEffect(() => {
    if (!roomData || !db) return;

    // Non-host: lobby → picking quando l'host avvia il pick
    if (roomData.status === "picking" && phase === "lobby") {
      const formation = FORMATIONS.find(f => f.label === roomData.formation) || FORMATIONS[0];
      setSelectedFormation(formation);
      setFieldSlots(buildFieldSlots(formation));
      initTeamQueue(formation);
      setPhase("picking");
    }

    // Tutti: picking → tournament quando tutti sono pronti
    if (roomData.status === "tournament" && (phase === "picking" || phase === "waiting")) {
      if (roomData.tournamentData) {
        // Find our userId from the players list in roomData
        const myPlayer = roomData.players.find(p => p.userId === myUserId || p.displayName === displayName);
        const resolvedUid = myPlayer?.userId ?? myUserId ?? undefined;
        startTournamentFromServer(roomData.tournamentData, resolvedUid ?? undefined);
      }
    }
  }, [roomData, phase, db]);

  const initTeamQueue = useCallback((formation: Formation) => {
    if (!db) return;
    const needed = formation.slots.length;
    const shuffled = shuffle(db.teams).slice(0, needed);
    setTeamQueue(shuffled.slice(1));
    setCurrentTeam(shuffled[0]);
  }, [db]);

  const handleSlotClick = (slotId: string) => {
    const slot = fieldSlots.find(s => s.id === slotId);
    if (!slot) return;
    if (selectedPlayerForSlot) {
      if (!canPlayPositionMP(selectedPlayerForSlot, slot.specificRole, slot.role)) return;
      if (slot.assignedPlayer !== null) return;
      const newSlots = fieldSlots.map(s =>
        s.id === slotId ? { ...s, assignedPlayer: selectedPlayerForSlot, fromTeam: currentTeam } : s
      );
      setFieldSlots(newSlots);
      setSelectedPlayerForSlot(null);
      setSelectedSlotId(null);
      advanceTeamMP(newSlots);
    } else {
      setSelectedSlotId(slotId === selectedSlotId ? null : slotId);
    }
  };

  const handlePlayerClick = (player: Player) => {
    if (!currentTeam) return;
    if (selectedSlotId) {
      const slot = fieldSlots.find(s => s.id === selectedSlotId);
      if (slot && canPlayPositionMP(player, slot.specificRole, slot.role) && slot.assignedPlayer === null) {
        const newSlots = fieldSlots.map(s =>
          s.id === selectedSlotId ? { ...s, assignedPlayer: player, fromTeam: currentTeam } : s
        );
        setFieldSlots(newSlots);
        setSelectedSlotId(null);
        setSelectedPlayerForSlot(null);
        advanceTeamMP(newSlots);
        return;
      }
    }
    setSelectedPlayerForSlot(selectedPlayerForSlot?.name === player.name ? null : player);
    setSelectedSlotId(null);
  };

  const handleConfirmAssignmentMP = () => {
    if (!selectedPlayerForSlot || !selectedSlotId || !currentTeam) return;
    const slot = fieldSlots.find(s => s.id === selectedSlotId);
    if (!slot || !canPlayPositionMP(selectedPlayerForSlot, slot.specificRole, slot.role)) return;
    if (slot.assignedPlayer !== null) return;
    const newSlots = fieldSlots.map(s =>
      s.id === selectedSlotId ? { ...s, assignedPlayer: selectedPlayerForSlot, fromTeam: currentTeam } : s
    );
    setFieldSlots(newSlots);
    setSelectedPlayerForSlot(null);
    setSelectedSlotId(null);
    advanceTeamMP(newSlots);
  };

  const advanceTeamMP = (newSlots: FieldSlot[]) => {
    setSelectedPlayerForSlot(null);
    setSelectedSlotId(null);
    if (teamQueue.length > 0) {
      setCurrentTeam(teamQueue[0]);
      setTeamQueue(teamQueue.slice(1));
    } else {
      setCurrentTeam(null);
    }
  };

  const handleConfirmTeam = async () => {
    if (!db) return;
    const ovr = calcTeamOvr(fieldSlots);
    setMyOvr(ovr);
    const pickData = JSON.stringify(fieldSlots.map(s => ({
      slotId: s.id, player: s.assignedPlayer, fromTeam: s.fromTeam?.id
    })));
    const result = await setReady.mutateAsync({ code: roomCode, pickData, teamOverall: ovr });
    // Update myUserId from server response (most reliable source)
    if (result.myUserId) setMyUserId(result.myUserId);
    const resolvedUid = result.myUserId ?? myUserId;
    if (result.allReady && result.tournamentData) {
      // Ultimo giocatore: avvia subito il torneo senza aspettare il polling
      startTournamentFromServer(result.tournamentData, resolvedUid ?? undefined);
    } else if (result.allReady) {
      // tournamentData non ancora disponibile: forza refetch
      const fresh = await refetchRoom();
      if (fresh.data?.tournamentData) {
        startTournamentFromServer(fresh.data.tournamentData, resolvedUid ?? undefined);
      } else {
        setPhase("waiting");
      }
    } else {
      // Aspetta che gli altri finiscano
      setPhase("waiting");
    }
  };

  // ─── Simulazione knockout progressiva (identica al single player) ────────────

  const startMatchSimMP = useCallback((roundIdx: number, rounds: typeof knockoutRounds) => {
    const round = rounds[roundIdx];
    if (!round) return;
    setMatchMinute(0);
    setMatchScoreHome(0);
    setMatchScoreAway(0);
    setMatchSimRunning(true);
    setMatchSimDone(false);
    setWaitingNextRound(false);
    const [myGoals, oppGoals] = round.score.split("-").map(Number);
    const events: {minute: number; scorer: string; isHome: boolean}[] = [];
    const usedMinutes = new Set<number>();
    const randMinute = () => {
      let m = Math.floor(Math.random() * 90) + 1;
      while (usedMinutes.has(m)) m = m % 90 + 1;
      usedMinutes.add(m);
      return m;
    };
    for (let i = 0; i < myGoals; i++) events.push({ minute: randMinute(), scorer: round.scorers[i] ?? "Dream Team", isHome: true });
    for (let i = 0; i < oppGoals; i++) events.push({ minute: randMinute(), scorer: round.oppScorers[i] ?? round.opp, isHome: false });
    events.sort((a, b) => a.minute - b.minute);
    setMatchGoalEvents(events);
  }, []);

  // Animazione minuto per minuto
  useEffect(() => {
    if (!matchSimRunning || matchSimDone) return;
    if (matchMinute >= 90) {
      setMatchSimRunning(false);
      setMatchSimDone(true);
      const round = knockoutRounds[currentKnockoutIdx];
      if (round && !round.win) {
        setTimeout(() => { setFinalResult("eliminated"); setPhase("result"); }, 2000);
      } else {
        setWaitingNextRound(true);
      }
      return;
    }
    const t = setTimeout(() => {
      setMatchMinute(m => m + 1);
      setMatchGoalEvents(events => {
        const goalsAtMinute = events.filter(e => e.minute === matchMinute + 1);
        goalsAtMinute.forEach(g => {
          if (g.isHome) setMatchScoreHome(s => s + 1);
          else setMatchScoreAway(s => s + 1);
        });
        return events;
      });
    }, 60);
    return () => clearTimeout(t);
  }, [matchSimRunning, matchSimDone, matchMinute, knockoutRounds, currentKnockoutIdx]);

  // Achievement: Dream Team Campione Silver (multiplayer win)
  useEffect(() => {
    if (phase === 'result' && finalResult === 'winner' && user) {
      unlock([{ achievementId: 'dream-team-campione', tier: 2 }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, finalResult]);

  const proceedToNextRoundMP = () => {
    const nextIdx = currentKnockoutIdx + 1;
    if (nextIdx >= knockoutRounds.length) {
      setFinalResult("winner");
      setPhase("result");
    } else {
      setCurrentKnockoutIdx(nextIdx);
      setWaitingNextRound(false);
      startMatchSimMP(nextIdx, knockoutRounds);
    }
  };

  // Avvia automaticamente la prima partita knockout
  useEffect(() => {
    if (phase === "knockout" && knockoutRounds.length > 0 && !matchSimRunning && !matchSimDone && currentKnockoutIdx === 0) {
      startMatchSimMP(0, knockoutRounds);
    }
  }, [phase, knockoutRounds, matchSimRunning, matchSimDone, currentKnockoutIdx, startMatchSimMP]);

  // Animazione fase a gironi
  useEffect(() => {
    if (phase !== "group") return;
    if (groupStep >= groupMatches.length) {
      const totalPts = groupMatches.reduce((s, m) => s + m.points, 0);
      setGroupPoints(totalPts);
      const qual = totalPts >= 10;
      setQualified(qual);
      if (!qual) {
        setTimeout(() => { setFinalResult("eliminated"); setPhase("result"); }, 800);
      } else {
        // Use server-generated knockout rounds (already in state)
        setTimeout(() => {
          setCurrentKnockoutIdx(0);
          setMatchSimRunning(false);
          setMatchSimDone(false);
          setWaitingNextRound(false);
          setPhase("knockout");
        }, 800);
      }
      return;
    }
    const t = setTimeout(() => setGroupStep(s => s + 1), 1200);
    return () => clearTimeout(t);
  }, [phase, groupStep, groupMatches]);

  const buildKnockoutMP = useCallback(() => {
    if (!db) return;
    const usedInPick = new Set(fieldSlots.map(s => s.fromTeam?.id).filter(Boolean));
    const available = db.teams.filter(t => !usedInPick.has(t.id)).sort((a, b) => a.overall - b.overall);
    const opponents = shuffle(available.slice(Math.ceil(available.length * 0.6))).slice(0, 4).sort((a, b) => a.overall - b.overall);
    const labels = ["Ottavi di Finale", "Quarti di Finale", "Semifinale", "Finale"];
    const ovrCalc = myOvr || calcTeamOvr(fieldSlots);
    const myPlayers = fieldSlots.map(s => s.assignedPlayer).filter(Boolean) as Player[];
    const rounds: typeof knockoutRounds = [];
    for (let i = 0; i < labels.length; i++) {
      const opp = opponents[i] ?? opponents[opponents.length - 1];
      const { win, draw, score, scorers, oppGoals } = simulateMatch(ovrCalc, opp.overall, myPlayers, opp.players);
      const oppScorers: string[] = [];
      for (let j = 0; j < oppGoals; j++) {
        const p = opp.players[Math.floor(Math.random() * opp.players.length)];
        if (p) oppScorers.push(p.name.split(" ").pop() || p.name);
      }
      let penalties: {myPens: number; oppPens: number; win: boolean} | undefined;
      let finalWin = win;
      if (draw) { penalties = simulatePenalties(); finalWin = penalties.win; }
      rounds.push({ label: labels[i], opp: `${opp.name} ${opp.season.slice(0,4)}`, myOvr: ovrCalc, oppOvr: opp.overall, win: finalWin, score, scorers, oppScorers, penalties });
      if (!finalWin) break;
    }
    setKnockoutRounds(rounds);
    setCurrentKnockoutIdx(0);
    setMatchSimRunning(false);
    setMatchSimDone(false);
    setWaitingNextRound(false);
    setPhase("knockout");
  }, [db, fieldSlots, myOvr]);

  const startTournamentFromServer = (tournamentDataJson: string, resolvedUserId?: number) => {
    try {
      const allData = JSON.parse(tournamentDataJson) as Record<string, {
        groupMatches: typeof groupMatches;
        groupPoints: number;
        qualified: boolean;
        knockoutRounds: typeof knockoutRounds;
      }>;
      // Use explicitly passed userId, or fall back to myUserId state, or try all keys
      const uid = resolvedUserId ?? myUserId;
      let myData = uid != null ? allData[String(uid)] : undefined;
      if (!myData) {
        // Fallback: try all keys in allData (works for any room size)
        const keys = Object.keys(allData);
        console.warn("[Multiplayer] uid not found directly, trying all keys. uid=", uid, "keys=", keys);
        // Use first key as last resort (each player gets their own data anyway)
        if (keys.length > 0) myData = allData[keys[0]];
      }
      if (!myData) {
        console.error("[Multiplayer] Could not find my data in tournamentData. uid=", uid, "keys=", Object.keys(allData));
        setPhase("waiting");
        return;
      }
      const ovrCalc = myData.knockoutRounds[0]?.myOvr || calcTeamOvr(fieldSlots);
      setMyOvr(ovrCalc);
      // Pre-load knockout rounds from server (no group phase in multiplayer)
      setKnockoutRounds(myData.knockoutRounds);
      setGroupPoints(18);
      setQualified(true);
      setGroupMatches([]);
      setCurrentKnockoutIdx(0);
      setMatchSimRunning(false);
      setMatchSimDone(false);
      setWaitingNextRound(false);
      setPhase("knockout");
    } catch (e) {
      console.error("[Multiplayer] Failed to parse tournamentData:", e);
    }
  };

  // (bracketResults/bracketStep kept for compatibility but no longer used for animation)

  const handleCreate = async () => {
    if (!displayName.trim()) { setError("Inserisci un nome"); return; }
    setError("");
    try {
      const res = await createRoom.mutateAsync({ displayName: displayName.trim(), formation: selectedFormation.label });
      setRoomCode(res.code);
      setIsHost(true);
      setPhase("lobby");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Errore");
    }
  };

  const handleJoin = async () => {
    if (!displayName.trim()) { setError("Inserisci un nome"); return; }
    if (joinCode.trim().length !== 6) { setError("Inserisci un codice valido (6 caratteri)"); return; }
    setError("");
    try {
      const res = await joinRoom.mutateAsync({ code: joinCode.trim().toUpperCase(), displayName: displayName.trim() });
      setRoomCode(res.code);
      setIsHost(false);
      setPhase("lobby");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Errore");
    }
  };

  const handleStartPicking = async () => {
    if (!isHost) return;
    try {
      // Mette la stanza in status "picking" — tutti i giocatori entrano in picking tramite polling
      await startPickingMutation.mutateAsync({ code: roomCode, formation: selectedFormation.label });
      const formation = selectedFormation;
      setFieldSlots(buildFieldSlots(formation));
      initTeamQueue(formation);
      setPhase("picking");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Errore avvio pick");
    }
  };

  const handleLeave = async () => {
    await leaveRoom.mutateAsync({ code: roomCode });
    setRoomCode("");
    setPhase("menu");
  };

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filledCount = fieldSlots.filter(s => s.assignedPlayer !== null).length;
  const totalSlots = fieldSlots.length;
  const allFilled = filledCount === totalSlots && totalSlots > 0;
  const [selectedPlayerForSlot, setSelectedPlayerForSlot] = useState<Player | null>(null);

  // Role helpers (same as single player)
  const ROLE_LABEL_MP: Record<string, string> = {
    GK: "Portiere", DF: "Difensore", MF: "Centrocampista", FW: "Attaccante",
    CB: "Difensore Centrale", RB: "Terzino Destro", LB: "Terzino Sinistro",
    WB: "Terzino a Tutta Fascia", CDM: "Mediano", CM: "Centrocampista Centrale",
    CAM: "Trequartista", RM: "Ala/Mezzala Destra", LM: "Ala/Mezzala Sinistra",
    RW: "Ala Destra", LW: "Ala Sinistra", SS: "Seconda Punta", ST: "Prima Punta", CF: "Centravanti",
  };
  const ROLE_TEXT_MP: Record<string, string> = {
    GK: "text-yellow-600", DF: "text-blue-600", MF: "text-green-600", FW: "text-red-600",
    CB: "text-blue-700", RB: "text-blue-500", LB: "text-blue-500", WB: "text-blue-400",
    CDM: "text-emerald-700", CM: "text-green-600", CAM: "text-teal-600",
    RM: "text-green-500", LM: "text-green-500", RW: "text-lime-600", LW: "text-lime-600",
    SS: "text-orange-600", ST: "text-red-600", CF: "text-red-700",
  };
  const ROLE_BORDER_MP: Record<string, string> = {
    GK: "border-yellow-500", DF: "border-blue-500", MF: "border-green-500", FW: "border-red-500",
    CB: "border-blue-600", RB: "border-blue-400", LB: "border-blue-400", WB: "border-blue-300",
    CDM: "border-emerald-600", CM: "border-green-500", CAM: "border-teal-500",
    RM: "border-green-400", LM: "border-green-400", RW: "border-lime-500", LW: "border-lime-500",
    SS: "border-orange-500", ST: "border-red-500", CF: "border-red-600",
  };
  const ROLE_HEX_MP: Record<string, string> = {
    GK: "#eab308", CB: "#2563eb", RB: "#60a5fa", LB: "#60a5fa", WB: "#93c5fd",
    DF: "#3b82f6", CDM: "#059669", CM: "#22c55e", CAM: "#14b8a6",
    RM: "#4ade80", LM: "#4ade80", RW: "#84cc16", LW: "#84cc16",
    MF: "#22c55e", FW: "#ef4444", SS: "#f97316", ST: "#ef4444", CF: "#dc2626",
  };

  function canPlayPositionMP(player: Player, slotSpecificRole: SpecificRole, _slotGenericRole: GenericRole): boolean {
    const playerRoles = player.roles ?? [];
    if (playerRoles.includes(slotSpecificRole)) return true;
    const equivalences: Partial<Record<SpecificRole, SpecificRole[]>> = {
      RW: ["RM"], LW: ["LM"], RM: ["RW"], LM: ["LW"],
      ST: ["CF", "SS"], CF: ["ST", "SS"], SS: ["ST", "CF"],
      WB: ["RB", "LB"], RB: ["WB"], LB: ["WB"],
    };
    const equiv = equivalences[slotSpecificRole] ?? [];
    return equiv.some((r) => playerRoles.includes(r));
  }

  // ─── RENDER ───────────────────────────────────────────────────────────────

  // Menu
  if (phase === "menu") {
    return (
      <div className={`min-h-screen ${bgPage}`}>
        <NavigationBar onFeedbackClick={() => setIsFeedbackOpen(true)} />
        <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
        <div className="max-w-lg mx-auto px-4 py-10">
          <button onClick={() => setLocation("/dream-team")} className="flex items-center gap-2 text-sm font-bold uppercase mb-6 hover:opacity-70 transition-opacity">
            <ChevronLeft className="w-4 h-4" /> Torna a Dream Team
          </button>
          <div className="border-4 border-black bg-white shadow-[6px_6px_0px_#000] p-8 rounded-none">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-amber-400 border-4 border-black flex items-center justify-center">
                <Users className="w-6 h-6 text-black" />
              </div>
              <div>
                <h1 className="text-2xl font-black uppercase tracking-tight">Dream Team</h1>
                <p className="text-sm font-bold text-gray-500 uppercase">Multiplayer</p>
              </div>
            </div>
            <p className="text-sm font-medium mb-6 text-gray-700">
              Fino a <strong>16 giocatori</strong>. Ogni partecipante costruisce il suo Dream Team scegliendo un giocatore per ogni squadra estratta. Il torneo parte dagli <strong>Ottavi di Finale</strong> quando tutti sono pronti.
            </p>
            <div className="mb-4">
              <label className="block text-xs font-black uppercase mb-1">Il tuo nome</label>
              <input
                className="w-full border-2 border-black px-3 py-2 font-bold text-sm focus:outline-none focus:border-amber-400"
                placeholder="Es. Alessandro"
                value={displayName}
                onChange={e => setDisplayName(e.target.value.slice(0, 20))}
                maxLength={20}
              />
            </div>
            {error && <p className="text-red-600 text-xs font-bold mb-3">{error}</p>}
            <div className="grid grid-cols-2 gap-3 mt-6">
              <Button
                onClick={() => setPhase("create")}
                className="bg-amber-400 text-black border-2 border-black font-black uppercase hover:bg-amber-300 rounded-none shadow-[3px_3px_0px_#000]"
              >
                Crea Stanza
              </Button>
              <Button
                onClick={() => setPhase("join")}
                className="bg-white text-black border-2 border-black font-black uppercase hover:bg-gray-100 rounded-none shadow-[3px_3px_0px_#000]"
              >
                Unisciti
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Create room
  if (phase === "create") {
    return (
      <div className={`min-h-screen ${bgPage}`}>
        <NavigationBar onFeedbackClick={() => setIsFeedbackOpen(true)} />
        <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
        <div className="max-w-lg mx-auto px-4 py-10">
          <button onClick={() => setPhase("menu")} className="flex items-center gap-2 text-sm font-bold uppercase mb-6 hover:opacity-70">
            <ChevronLeft className="w-4 h-4" /> Indietro
          </button>
          <div className="border-4 border-black bg-white shadow-[6px_6px_0px_#000] p-8">
            <h2 className="text-xl font-black uppercase mb-6">Crea Stanza</h2>
            <div className="mb-4">
              <label className="block text-xs font-black uppercase mb-1">Il tuo nome</label>
              <input
                className="w-full border-2 border-black px-3 py-2 font-bold text-sm focus:outline-none"
                value={displayName}
                onChange={e => setDisplayName(e.target.value.slice(0, 20))}
                maxLength={20}
              />
            </div>
            <div className="mb-6">
              <label className="block text-xs font-black uppercase mb-2">Modulo</label>
              <div className="grid grid-cols-2 gap-2">
                {FORMATIONS.map(f => (
                  <button
                    key={f.label}
                    onClick={() => setSelectedFormation(f)}
                    className={`border-2 border-black px-3 py-2 text-sm font-black uppercase transition-all ${selectedFormation.label === f.label ? "bg-pink-400 text-black shadow-[2px_2px_0px_#000]" : "bg-white hover:bg-gray-100"}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-red-600 text-xs font-bold mb-3">{error}</p>}
            <Button
              onClick={handleCreate}
              disabled={createRoom.isPending}
              className="w-full bg-black text-white border-2 border-black font-black uppercase rounded-none shadow-[3px_3px_0px_#000] hover:bg-gray-800"
            >
              {createRoom.isPending ? "Creazione..." : "Crea Stanza"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Join room
  if (phase === "join") {
    return (
      <div className={`min-h-screen ${bgPage}`}>
        <NavigationBar onFeedbackClick={() => setIsFeedbackOpen(true)} />
        <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
        <div className="max-w-lg mx-auto px-4 py-10">
          <button onClick={() => setPhase("menu")} className="flex items-center gap-2 text-sm font-bold uppercase mb-6 hover:opacity-70">
            <ChevronLeft className="w-4 h-4" /> Indietro
          </button>
          <div className="border-4 border-black bg-white shadow-[6px_6px_0px_#000] p-8">
            <h2 className="text-xl font-black uppercase mb-6">Unisciti a una Stanza</h2>
            <div className="mb-4">
              <label className="block text-xs font-black uppercase mb-1">Il tuo nome</label>
              <input
                className="w-full border-2 border-black px-3 py-2 font-bold text-sm focus:outline-none"
                value={displayName}
                onChange={e => setDisplayName(e.target.value.slice(0, 20))}
                maxLength={20}
              />
            </div>
            <div className="mb-6">
              <label className="block text-xs font-black uppercase mb-1">Codice Stanza</label>
              <input
                className="w-full border-2 border-black px-3 py-2 font-bold text-sm focus:outline-none uppercase tracking-widest text-center text-lg"
                placeholder="XXXXXX"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                maxLength={6}
              />
            </div>
            {error && <p className="text-red-600 text-xs font-bold mb-3">{error}</p>}
            <Button
              onClick={handleJoin}
              disabled={joinRoom.isPending}
              className="w-full bg-black text-white border-2 border-black font-black uppercase rounded-none shadow-[3px_3px_0px_#000] hover:bg-gray-800"
            >
              {joinRoom.isPending ? "Connessione..." : "Entra"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Lobby
  if (phase === "lobby") {
    const players = roomData?.players ?? [];
    const allReady = players.length >= 2 && players.every(p => p.isReady === 1);
    return (
      <div className={`min-h-screen ${bgPage}`}>
        <NavigationBar onFeedbackClick={() => setIsFeedbackOpen(true)} />
        <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
        <div className="max-w-lg mx-auto px-4 py-10">
          <div className="border-4 border-black bg-white shadow-[6px_6px_0px_#000] p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black uppercase">Lobby</h2>
              <button onClick={handleLeave} className="text-xs font-bold uppercase text-red-500 hover:underline">Esci</button>
            </div>
            {/* Room code */}
            <div className="bg-amber-50 border-2 border-amber-400 p-4 mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase text-amber-700 mb-1">Codice Stanza</p>
                <p className="text-3xl font-black tracking-widest">{roomCode}</p>
              </div>
              <button onClick={copyCode} className="flex items-center gap-1 text-xs font-bold uppercase border-2 border-black px-3 py-2 hover:bg-gray-100">
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copiato" : "Copia"}
              </button>
            </div>
            {/* Formation (host only) */}
            {isHost && (
              <div className="mb-6">
                <label className="block text-xs font-black uppercase mb-2">Modulo ({selectedFormation.label})</label>
                <div className="grid grid-cols-4 gap-1">
                  {FORMATIONS.map(f => (
                    <button
                      key={f.label}
                      onClick={() => { setSelectedFormation(f); setFormation.mutate({ code: roomCode, formation: f.label }); }}
                      className={`border-2 border-black px-2 py-1 text-xs font-black uppercase ${selectedFormation.label === f.label ? "bg-pink-400" : "bg-white hover:bg-gray-100"}`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* Players list */}
            <div className="mb-6">
              <p className="text-xs font-black uppercase mb-2">Giocatori ({players.length}/{roomData?.maxPlayers ?? 16})</p>
              <div className="space-y-2">
                {players.map(p => (
                  <div key={p.id} className="flex items-center justify-between border-2 border-black px-3 py-2">
                    <span className="font-bold text-sm">{p.displayName}</span>
                    <span className={`text-xs font-black uppercase px-2 py-0.5 ${p.isReady ? "bg-green-400" : "bg-gray-200"}`}>
                      {p.isReady ? "Pronto" : "In attesa"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {isHost && (
              <Button
                onClick={handleStartPicking}
                disabled={players.length < 2}
                className="w-full bg-black text-white border-2 border-black font-black uppercase rounded-none shadow-[3px_3px_0px_#000] hover:bg-gray-800 disabled:opacity-40"
              >
                {players.length < 2 ? "Aspetta almeno 2 giocatori" : "Inizia il Pick!"}
              </Button>
            )}
            {!isHost && (
              <p className="text-center text-sm font-bold text-gray-500 uppercase">In attesa che l'host avvii il pick...</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Picking phase
  if (phase === "picking") {
    const selectedSlot = fieldSlots.find(s => s.id === selectedSlotId);
    return (
      <div className="min-h-screen bg-background">
        <NavigationBar onFeedbackClick={() => setIsFeedbackOpen(true)} />
        <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
        <div className="container max-w-5xl py-6 space-y-4">

          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              <span className="text-xs font-black uppercase bg-amber-100 border-2 border-amber-400 px-2 py-1">Multiplayer</span>
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-display font-black uppercase tracking-tight">Dream Team</h1>
              <p className="text-muted-foreground text-xs">
                {filledCount}/{totalSlots} posizioni riempite · Modulo {selectedFormation.label}
              </p>
            </div>
            {currentTeam && (
              <div className="text-right">
                <div className="text-xs font-bold text-muted-foreground">Squadra estratta</div>
                <div className="font-display font-black text-sm">{currentTeam.name} {currentTeam.season}</div>
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-muted border-2 border-black">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-500"
              style={{ width: `${(filledCount / totalSlots) * 100}%` }}
            />
          </div>

          {!currentTeam && !allFilled && (
            <div className="border-4 border-black bg-amber-50 p-6 text-center">
              <p className="font-black uppercase text-lg">Caricamento squadre...</p>
              <p className="text-sm text-gray-600 mt-2">Se il problema persiste, ricarica la pagina.</p>
            </div>
          )}

          {(currentTeam || allFilled) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Campo */}
              <div className="space-y-2">
                <p className="font-bold uppercase text-xs text-muted-foreground">
                  Clicca una posizione vuota, poi scegli il giocatore dalla rosa →
                </p>
                {/* Football Field - identico al single player */}
                <div className="relative w-full" style={{ paddingBottom: "140%" }}>
                  <div className="absolute inset-0 rounded-lg overflow-hidden border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                    <svg viewBox="0 0 100 140" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                      {Array.from({ length: 7 }).map((_, i) => (
                        <rect key={i} x="0" y={i * 20} width="100" height="20"
                          fill={i % 2 === 0 ? "#2d7a2d" : "#267026"} />
                      ))}
                      <rect x="5" y="5" width="90" height="130" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="0.8" />
                      <line x1="5" y1="70" x2="95" y2="70" stroke="rgba(255,255,255,0.6)" strokeWidth="0.8" />
                      <circle cx="50" cy="70" r="12" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="0.8" />
                      <circle cx="50" cy="70" r="0.8" fill="rgba(255,255,255,0.6)" />
                      <rect x="22" y="110" width="56" height="25" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="0.8" />
                      <rect x="35" y="125" width="30" height="10" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="0.8" />
                      <rect x="22" y="5" width="56" height="25" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="0.8" />
                      <rect x="35" y="5" width="30" height="10" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="0.8" />
                      <rect x="40" y="133" width="20" height="4" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1" />
                      <rect x="40" y="3" width="20" height="4" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1" />
                    </svg>
                    <div className="absolute top-2 left-2 bg-black/60 text-white text-xs font-bold px-2 py-0.5 rounded">
                      {selectedFormation.label}
                    </div>
                    {fieldSlots.map(slot => {
                      const isSelected = selectedSlotId === slot.id;
                      const isFilled = slot.assignedPlayer !== null;
                      return (
                        <button
                          key={slot.id}
                          onClick={() => handleSlotClick(slot.id)}
                          className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all"
                          style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                        >
                          <div
                            className={`w-12 h-12 rounded-full border-3 flex flex-col items-center justify-center text-center transition-all
                              ${isSelected ? "ring-4 ring-white ring-offset-1 scale-110" : ""}
                              ${isFilled
                                ? "bg-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)]"
                                : "border-dashed border-2 border-white/80 bg-black/30 hover:bg-black/50"
                              }`}
                            style={isFilled ? { borderColor: ROLE_HEX_MP[slot.specificRole] ?? "#000", borderWidth: 3 } : {}}
                          >
                            {isFilled ? (
                              <div className="flex flex-col items-center leading-none px-0.5">
                                <span className="text-[8px] font-black text-gray-800 leading-tight max-w-[44px] overflow-hidden text-ellipsis whitespace-nowrap">
                                  {slot.assignedPlayer!.name.split(" ").pop()}
                                </span>
                                <span className={`text-[7px] font-bold mt-0.5 ${ROLE_TEXT_MP[slot.specificRole] ?? ROLE_TEXT_MP[slot.role]}`}>
                                  {slot.specificRole}
                                </span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center">
                                <span className="text-white/90 text-[9px] font-bold">{slot.specificRole}</span>
                                <span className="text-white/60 text-[8px]">+</span>
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Rosa squadra corrente */}
              <div className="space-y-3">
                {currentTeam && (
                  <div
                    className="border-4 border-black p-3 flex items-center gap-3"
                    style={{ borderLeftColor: currentTeam.color, borderLeftWidth: 6 }}
                  >
                    <div
                      className="w-10 h-10 rounded-full border-2 border-black flex items-center justify-center text-xl flex-shrink-0"
                      style={{ backgroundColor: currentTeam.color + "22" }}
                    >
                      {currentTeam.badge}
                    </div>
                    <div>
                      <div className="font-display font-black text-base uppercase">{currentTeam.name} {currentTeam.season}</div>
                    </div>
                    <span className="ml-auto text-xs font-black bg-black text-white px-2 py-1">OVR {currentTeam.overall}</span>
                  </div>
                )}

                {/* Istruzione contestuale */}
                {selectedSlot && !selectedSlot.assignedPlayer && (
                  <div className={`border-2 p-2 text-sm font-bold ${ROLE_BORDER_MP[selectedSlot.specificRole] ?? ROLE_BORDER_MP[selectedSlot.role] ?? "border-black"} bg-muted`}>
                    Posizione selezionata: <span className={ROLE_TEXT_MP[selectedSlot.specificRole] ?? ROLE_TEXT_MP[selectedSlot.role]}>{ROLE_LABEL_MP[selectedSlot.specificRole]}</span>
                    {" "}— scegli un giocatore compatibile qui sotto
                  </div>
                )}
                {selectedPlayerForSlot && (
                  <div className="border-2 border-amber-500 p-2 text-sm font-bold bg-amber-50">
                    Giocatore selezionato: <span className="text-amber-600">{selectedPlayerForSlot.name}</span>
                    {" "}({(selectedPlayerForSlot.roles ?? [selectedPlayerForSlot.role]).join("/")})
                    {" "}— ora clicca la posizione compatibile sul campo
                  </div>
                )}

                {/* Giocatori */}
                {currentTeam && (
                  <div className="max-h-[420px] overflow-y-auto pr-1">
                    <div className="flex flex-wrap gap-1.5">
                      {currentTeam.players.filter(p =>
                        !fieldSlots.some(s => s.assignedPlayer?.name === p.name)
                      ).map(p => {
                        const isSelected = selectedPlayerForSlot?.name === p.name;
                        const slotSelected = !!selectedSlotId && !!selectedSlot && !selectedSlot.assignedPlayer;
                        const slotCompatible = slotSelected && selectedSlot &&
                          canPlayPositionMP(p, selectedSlot.specificRole, selectedSlot.role);
                        const isClickable = slotSelected ? !!slotCompatible : true;
                        const isDisabled = slotSelected ? !slotCompatible : false;
                        const playerRolesLabel = (p.roles ?? []).join("/") || p.role;
                        return (
                          <button
                            key={p.name}
                            onClick={() => isClickable ? handlePlayerClick(p) : undefined}
                            disabled={isDisabled}
                            title={!slotSelected ? "Seleziona prima una posizione sul campo" : !slotCompatible ? `Incompatibile con ${ROLE_LABEL_MP[selectedSlot?.specificRole ?? selectedSlot?.role ?? ""]}` : playerRolesLabel}
                            className={`px-2.5 py-1.5 border-2 border-black text-xs font-bold transition-all
                              ${isSelected
                                ? "bg-amber-400 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] translate-x-[-1px] translate-y-[-1px]"
                                : isClickable
                                ? "bg-white hover:bg-amber-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
                                : "bg-gray-50 text-gray-400 opacity-60 cursor-not-allowed"
                              }`}
                          >
                            <span>{p.name}</span>
                            {p.roles && p.roles.length > 0 && (
                              <span className="ml-1 text-[9px] opacity-60">({p.roles.join("/")})</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Pulsante conferma */}
                {selectedPlayerForSlot && selectedSlotId && (
                  <Button
                    onClick={handleConfirmAssignmentMP}
                    disabled={
                      !selectedSlot ||
                      !canPlayPositionMP(selectedPlayerForSlot, selectedSlot?.specificRole ?? "ST", selectedSlot?.role ?? "FW") ||
                      selectedSlot.assignedPlayer !== null
                    }
                    className="w-full py-4 text-base font-bold uppercase bg-black hover:bg-gray-800 text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] disabled:opacity-40"
                  >
                    {selectedSlot && !canPlayPositionMP(selectedPlayerForSlot, selectedSlot.specificRole, selectedSlot.role)
                      ? `❌ Incompatibile (serve ${ROLE_LABEL_MP[selectedSlot.specificRole]})`
                      : `✓ Assegna ${selectedPlayerForSlot.name}`}
                  </Button>
                )}

                {/* Conferma team completo */}
                {allFilled && (
                  <Button
                    onClick={handleConfirmTeam}
                    disabled={setReady.isPending}
                    className="w-full mt-4 bg-black text-white border-2 border-black font-black uppercase rounded-none shadow-[3px_3px_0px_#000] hover:bg-gray-800"
                  >
                    {setReady.isPending ? "Invio..." : "Confermo il mio Dream Team →"}
                  </Button>
                )}
                {setReady.isSuccess && (
                  <p className="text-center text-sm font-bold text-green-600 mt-4 uppercase">✓ Pronto! In attesa degli altri giocatori...</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Waiting for other players
  if (phase === "waiting") {
    const readyCount = roomData?.players.filter(p => p.isReady === 1).length ?? 0;
    const totalCount = roomData?.players.length ?? 0;
    return (
      <div className={`min-h-screen ${bgPage} flex flex-col items-center justify-center px-4`}>
        <NavigationBar onFeedbackClick={() => setIsFeedbackOpen(true)} />
        <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
        <div className="max-w-lg w-full border-4 border-black bg-white shadow-[6px_6px_0px_#000] p-8 mt-10 text-center">
          <div className="text-5xl mb-4">⏳</div>
          <h2 className="text-2xl font-black uppercase mb-2">Team Confermato!</h2>
          <p className="text-muted-foreground mb-6">In attesa che gli altri giocatori completino la loro rosa...</p>
          <div className="bg-amber-50 border-2 border-amber-400 p-4 mb-6">
            <p className="text-xs font-black uppercase text-amber-700 mb-1">Giocatori pronti</p>
            <p className="text-3xl font-black">{readyCount} / {totalCount}</p>
          </div>
          {roomData?.players && (
            <div className="space-y-2 text-left">
              {roomData.players.map(p => (
                <div key={p.id} className="flex items-center justify-between border-2 border-black px-3 py-2">
                  <span className="font-bold text-sm">{p.displayName}</span>
                  <span className={`text-xs font-black uppercase px-2 py-0.5 ${p.isReady ? "bg-green-400" : "bg-amber-200"}`}>
                    {p.isReady ? "✓ Pronto" : "In corso..."}
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-gray-400 mt-6 uppercase font-bold">Il torneo partirà automaticamente quando tutti sono pronti</p>
        </div>
      </div>
    );
  }

  // ─── GROUP STAGE ──────────────────────────────────────────────────────────────
  if (phase === "group") {
    const currentPts = groupMatches.slice(0, groupStep).reduce((s, m) => s + m.points, 0);
    return (
      <div className="min-h-screen bg-background">
        <NavigationBar onFeedbackClick={() => setIsFeedbackOpen(true)} />
        <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
        <div className="container max-w-2xl py-8 space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-display font-black uppercase tracking-tight">Fase a Gironi</h1>
            <p className="text-muted-foreground text-sm mt-1">Servono 10 punti per qualificarsi agli ottavi</p>
          </div>
          <div className="bg-card border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 text-center">
            <div className="text-5xl font-display font-black text-pink-500">{currentPts}</div>
            <div className="text-sm font-bold text-muted-foreground">punti su 18 possibili</div>
            <div className="mt-2 h-3 bg-muted border-2 border-black">
              <div
                className={`h-full transition-all duration-500 ${currentPts >= 10 ? "bg-green-500" : "bg-pink-500"}`}
                style={{ width: `${Math.min(100, (currentPts / 18) * 100)}%` }}
              />
            </div>
            <div className="text-xs text-muted-foreground mt-1">Soglia qualificazione: 10 punti</div>
          </div>
          <div className="space-y-3">
            {groupMatches.slice(0, groupStep).map((m, i) => (
              <div key={i} className={`border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 ${m.win ? "bg-green-50" : m.draw ? "bg-yellow-50" : "bg-red-50"}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-muted-foreground uppercase">Giornata {i + 1}</span>
                  <span className={`font-bold text-sm ${m.win ? "text-green-600" : m.draw ? "text-yellow-600" : "text-red-600"}`}>
                    {m.win ? "VITTORIA +3" : m.draw ? "PAREGGIO +1" : "SCONFITTA +0"}
                  </span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-display font-black text-base">Dream Team</span>
                  <span className="font-display font-black text-2xl text-pink-500">{m.score}</span>
                  <span className="font-display font-black text-base text-right">{m.opponent}</span>
                </div>
                {(m.scorers.length > 0 || m.oppScorers.length > 0) && (
                  <div className="grid grid-cols-2 gap-2 text-xs border-t border-black/20 pt-2">
                    <div>
                      {m.scorers.map((s, j) => (
                        <div key={j} className="text-green-700">⚽ {s}</div>
                      ))}
                    </div>
                    <div className="text-right">
                      {m.oppScorers.map((s, j) => (
                        <div key={j} className="text-red-700">{s} ⚽</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {groupStep < groupMatches.length && (
              <div className="border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 bg-card animate-pulse text-center font-bold text-muted-foreground uppercase text-sm">
                Giornata {groupStep + 1} in corso...
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── KNOCKOUT ─────────────────────────────────────────────────────────────────
  if (phase === "knockout") {
    const currentRound = knockoutRounds[currentKnockoutIdx];
    const pastRounds = knockoutRounds.slice(0, currentKnockoutIdx);
    const goalsShownHome = matchGoalEvents.filter((e) => e.isHome && e.minute <= matchMinute);
    const goalsShownAway = matchGoalEvents.filter((e) => !e.isHome && e.minute <= matchMinute);

    return (
      <div className="min-h-screen bg-background">
        <NavigationBar onFeedbackClick={() => setIsFeedbackOpen(true)} />
        <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
        <div className="container max-w-2xl py-8 space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-display font-black uppercase tracking-tight">Torneo — Eliminazione Diretta</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {knockoutRounds.map(r => r.label).join(" → ")}
            </p>
          </div>

          {/* Partite già giocate */}
          {pastRounds.map((r, i) => (
            <div key={i} className={`border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 ${r.win ? "bg-green-50" : "bg-red-50"}`}>
              <div className="flex items-center justify-between">
                <span className="font-bold uppercase text-xs text-muted-foreground">{r.label}</span>
                <span className={`font-display font-black text-base ${r.win ? "text-green-600" : "text-red-600"}`}>{r.win ? "VITTORIA" : "ELIMINATO"}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="font-bold text-sm">Dream Team</span>
                <span className="font-display font-black text-xl text-pink-500">{r.score}</span>
                <span className="font-bold text-sm text-right">{r.opp}</span>
              </div>
            </div>
          ))}

          {/* Partita in corso */}
          {currentRound && (
            <div className="border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 bg-card">
              <div className="text-center mb-4">
                <span className="font-display font-black text-xl uppercase">{currentRound.label}</span>
              </div>

              {/* Scoreboard */}
              <div className="flex items-center justify-between mb-4">
                <div className="text-center flex-1">
                  <div className="font-display font-black text-base">Dream Team</div>
                  <div className="text-xs text-muted-foreground">OVR {currentRound.myOvr}</div>
                </div>
                <div className="text-center px-4">
                  <div className="font-display font-black text-5xl text-pink-500">
                    {goalsShownHome.length} - {goalsShownAway.length}
                  </div>
                  <div className={`text-sm font-bold mt-1 ${
                    matchSimDone ? "text-black" : "text-muted-foreground animate-pulse"
                  }`}>
                    {matchSimDone ? "Fischio finale" : `${matchMinute}'`}
                  </div>
                  {/* Barra del tempo */}
                  <div className="mt-2 h-2 bg-muted border-2 border-black w-32 mx-auto">
                    <div
                      className="h-full bg-pink-500 transition-all"
                      style={{ width: `${(matchMinute / 90) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="text-center flex-1">
                  <div className="font-display font-black text-base">{currentRound.opp}</div>
                  <div className="text-xs text-muted-foreground">OVR {currentRound.oppOvr}</div>
                </div>
              </div>

              {/* Marcatori in tempo reale */}
              <div className="grid grid-cols-2 gap-3 text-xs border-t-2 border-black pt-3">
                <div className="space-y-1">
                  {goalsShownHome.map((e, j) => (
                    <div key={j} className="text-green-700 font-bold">⚽ {e.minute}' {e.scorer}</div>
                  ))}
                </div>
                <div className="space-y-1 text-right">
                  {goalsShownAway.map((e, j) => (
                    <div key={j} className="text-red-700 font-bold">{e.scorer} {e.minute}' ⚽</div>
                  ))}
                </div>
              </div>

              {/* Rigori */}
              {matchSimDone && currentRound.penalties && (
                <div className="mt-3 p-3 bg-muted border-2 border-black text-center">
                  <p className="font-bold text-sm">Supplementari e Rigori</p>
                  <p className="font-display font-black text-2xl mt-1">
                    {currentRound.penalties.myPens} - {currentRound.penalties.oppPens}
                  </p>
                  <p className={`text-sm font-bold ${currentRound.penalties.win ? "text-green-600" : "text-red-600"}`}>
                    {currentRound.penalties.win ? "✓ Qualificato ai rigori" : "✗ Eliminato ai rigori"}
                  </p>
                </div>
              )}

              {/* Pulsante avanti */}
              {waitingNextRound && (
                <Button
                  onClick={proceedToNextRoundMP}
                  className="w-full mt-4 py-5 text-lg font-bold uppercase bg-black hover:bg-gray-800 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                >
                  {currentKnockoutIdx + 1 < knockoutRounds.length
                    ? `▶ Avanti — ${knockoutRounds[currentKnockoutIdx + 1]?.label}`
                    : "▶ Vai ai Risultati"}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── RESULT ───────────────────────────────────────────────────────────────────
  if (phase === "result") {
    const wonAll = qualified && knockoutRounds.length > 0 && knockoutRounds.every(r => r.win);
    const lastKnockoutWin = knockoutRounds.filter(r => r.win).length;
    const knockoutLabels = ["Ottavi", "Quarti", "Semifinale", "Finale"];
    const eliminatedAt = qualified ? knockoutLabels[lastKnockoutWin] ?? "Finale" : null;
    return (
      <div className="min-h-screen bg-background">
        <NavigationBar onFeedbackClick={() => setIsFeedbackOpen(true)} />
        <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
        <div className="container max-w-2xl py-8 space-y-6">
          <div className={`border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8 text-center ${wonAll ? "bg-gradient-to-br from-yellow-50 to-amber-50" : "bg-card"}`}>
            <div className="text-6xl mb-4">{wonAll ? "🏆" : qualified ? "⚽" : "❌"}</div>
            <h2 className="text-4xl font-display font-black uppercase mb-2">
              {wonAll ? "Campione!" : `Eliminato ai ${eliminatedAt ?? "Ottavi"}`}
            </h2>
            <p className="text-muted-foreground text-lg">
              {wonAll ? "Hai vinto il Torneo con il tuo Dream Team!" : `Sei stato eliminato ai ${eliminatedAt ?? "Ottavi"}.`}
            </p>
            <div className="mt-4 text-5xl font-display font-black text-pink-500">OVR {myOvr}</div>
          </div>

          {knockoutRounds.length > 0 && (
            <div className="bg-card border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-5">
              <p className="font-bold uppercase text-sm mb-3 border-b-2 border-black pb-2">Fase ad Eliminazione</p>
              <div className="space-y-1">
                {knockoutRounds.slice(0, lastKnockoutWin + 1).map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="font-bold text-muted-foreground w-28">{r.label}</span>
                    <span className="font-bold">vs {r.opp}</span>
                    <span className="font-display font-black">{r.score}</span>
                    <span className={`font-bold ${r.win ? "text-green-600" : "text-red-600"}`}>{r.win ? "V" : "X"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-card border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-5">
            <p className="font-bold uppercase text-sm mb-3 border-b-2 border-black pb-2">Il tuo Dream Team</p>
            <div className="space-y-1">
              {fieldSlots.map((s, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{s.assignedPlayer?.name}</span>
                    <span className="text-xs text-muted-foreground">{s.fromTeam?.name} {s.fromTeam?.season?.slice(0, 4)}</span>
                  </div>
                  <span className="font-display font-black text-pink-500">{s.assignedPlayer?.ovr}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              onClick={() => setPhase("menu")}
              className="flex-1 py-6 text-xl font-bold uppercase bg-black hover:bg-gray-800 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
            >
              Menu Multiplayer
            </Button>
            <Button
              variant="outline"
              onClick={() => setLocation("/dream-team")}
              className="flex-1 py-6 text-xl font-bold uppercase border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white hover:bg-pink-50"
            >
              Single Player
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
