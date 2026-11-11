import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { useAchievements } from "@/hooks/useAchievements";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { NavigationBar } from "@/components/NavigationBar";
import { FeedbackModal } from "@/components/FeedbackModal";
import { useMatchGuard } from "@/contexts/MatchGuardContext";
import { ChevronLeft, Shuffle, Star, Users, Zap, Trophy, CheckCircle, AlertTriangle } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

// Ruoli specifici supportati
type SpecificRole = "GK" | "CB" | "RB" | "LB" | "WB" | "CDM" | "CM" | "CAM" | "RM" | "LM" | "RW" | "LW" | "SS" | "ST" | "CF";
type GenericRole = "GK" | "DF" | "MF" | "FW";

interface Player {
  name: string;
  role: GenericRole;
  roles?: SpecificRole[];  // ruoli specifici (multi-ruolo)
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

interface DB {
  teams: Team[];
}

// Una posizione sul campo
interface FieldSlot {
  id: string;
  role: GenericRole;          // ruolo generico per compatibilità
  specificRole: SpecificRole; // ruolo specifico della posizione
  x: number;
  y: number;
  assignedPlayer: Player | null;
  fromTeam: Team | null;
}

// ─── Formations ──────────────────────────────────────────────────────────────

interface SlotDef {
  specificRole: SpecificRole;
  role: GenericRole;
  xFn: (i: number, total: number) => number; // funzione per calcolare x
  y: number;
}

interface Formation {
  label: string;
  df: number;
  mf: number;
  fw: number;
  slots: SlotDef[];
}

// Helper per distribuire uniformemente
const xPos = (i: number, total: number) => ((i + 1) / (total + 1)) * 100;

const FORMATIONS: Formation[] = [
  {
    label: "4-3-3",
    df: 4, mf: 3, fw: 3,
    slots: [
      { specificRole: "GK", role: "GK", xFn: () => 50, y: 88 },
      { specificRole: "RB", role: "DF", xFn: (i) => xPos(i, 4), y: 72 },
      { specificRole: "CB", role: "DF", xFn: (i) => xPos(i, 4), y: 72 },
      { specificRole: "CB", role: "DF", xFn: (i) => xPos(i, 4), y: 72 },
      { specificRole: "LB", role: "DF", xFn: (i) => xPos(i, 4), y: 72 },
      { specificRole: "CM", role: "MF", xFn: (i) => xPos(i, 3), y: 50 },
      { specificRole: "CDM", role: "MF", xFn: (i) => xPos(i, 3), y: 50 },
      { specificRole: "CM", role: "MF", xFn: (i) => xPos(i, 3), y: 50 },
      { specificRole: "RW", role: "FW", xFn: (i) => xPos(i, 3), y: 22 },
      { specificRole: "ST", role: "FW", xFn: (i) => xPos(i, 3), y: 22 },
      { specificRole: "LW", role: "FW", xFn: (i) => xPos(i, 3), y: 22 },
    ],
  },
  {
    label: "4-4-2",
    df: 4, mf: 4, fw: 2,
    slots: [
      { specificRole: "GK", role: "GK", xFn: () => 50, y: 88 },
      { specificRole: "RB", role: "DF", xFn: (i) => xPos(i, 4), y: 72 },
      { specificRole: "CB", role: "DF", xFn: (i) => xPos(i, 4), y: 72 },
      { specificRole: "CB", role: "DF", xFn: (i) => xPos(i, 4), y: 72 },
      { specificRole: "LB", role: "DF", xFn: (i) => xPos(i, 4), y: 72 },
      { specificRole: "RM", role: "MF", xFn: (i) => xPos(i, 4), y: 50 },
      { specificRole: "CM", role: "MF", xFn: (i) => xPos(i, 4), y: 50 },
      { specificRole: "CM", role: "MF", xFn: (i) => xPos(i, 4), y: 50 },
      { specificRole: "LM", role: "MF", xFn: (i) => xPos(i, 4), y: 50 },
      { specificRole: "ST", role: "FW", xFn: (i) => xPos(i, 2), y: 22 },
      { specificRole: "ST", role: "FW", xFn: (i) => xPos(i, 2), y: 22 },
    ],
  },
  {
    label: "4-2-3-1",
    df: 4, mf: 5, fw: 1,
    slots: [
      { specificRole: "GK", role: "GK", xFn: () => 50, y: 88 },
      { specificRole: "RB", role: "DF", xFn: (i) => xPos(i, 4), y: 72 },
      { specificRole: "CB", role: "DF", xFn: (i) => xPos(i, 4), y: 72 },
      { specificRole: "CB", role: "DF", xFn: (i) => xPos(i, 4), y: 72 },
      { specificRole: "LB", role: "DF", xFn: (i) => xPos(i, 4), y: 72 },
      { specificRole: "CDM", role: "MF", xFn: (i) => xPos(i, 2), y: 58 },
      { specificRole: "CDM", role: "MF", xFn: (i) => xPos(i, 2), y: 58 },
      { specificRole: "RW", role: "MF", xFn: (i) => xPos(i, 3), y: 40 },
      { specificRole: "CAM", role: "MF", xFn: (i) => xPos(i, 3), y: 40 },
      { specificRole: "LW", role: "MF", xFn: (i) => xPos(i, 3), y: 40 },
      { specificRole: "ST", role: "FW", xFn: () => 50, y: 20 },
    ],
  },
  {
    label: "3-5-2",
    df: 3, mf: 5, fw: 2,
    slots: [
      { specificRole: "GK", role: "GK", xFn: () => 50, y: 88 },
      { specificRole: "CB", role: "DF", xFn: (i) => xPos(i, 3), y: 72 },
      { specificRole: "CB", role: "DF", xFn: (i) => xPos(i, 3), y: 72 },
      { specificRole: "CB", role: "DF", xFn: (i) => xPos(i, 3), y: 72 },
      { specificRole: "WB", role: "MF", xFn: (i) => xPos(i, 5), y: 55 },
      { specificRole: "CDM", role: "MF", xFn: (i) => xPos(i, 5), y: 55 },
      { specificRole: "CM", role: "MF", xFn: (i) => xPos(i, 5), y: 55 },
      { specificRole: "CDM", role: "MF", xFn: (i) => xPos(i, 5), y: 55 },
      { specificRole: "WB", role: "MF", xFn: (i) => xPos(i, 5), y: 55 },
      { specificRole: "ST", role: "FW", xFn: (i) => xPos(i, 2), y: 22 },
      { specificRole: "ST", role: "FW", xFn: (i) => xPos(i, 2), y: 22 },
    ],
  },
  {
    label: "3-4-3",
    df: 3, mf: 4, fw: 3,
    slots: [
      { specificRole: "GK", role: "GK", xFn: () => 50, y: 88 },
      { specificRole: "CB", role: "DF", xFn: (i) => xPos(i, 3), y: 72 },
      { specificRole: "CB", role: "DF", xFn: (i) => xPos(i, 3), y: 72 },
      { specificRole: "CB", role: "DF", xFn: (i) => xPos(i, 3), y: 72 },
      { specificRole: "RM", role: "MF", xFn: (i) => xPos(i, 4), y: 52 },
      { specificRole: "CM", role: "MF", xFn: (i) => xPos(i, 4), y: 52 },
      { specificRole: "CM", role: "MF", xFn: (i) => xPos(i, 4), y: 52 },
      { specificRole: "LM", role: "MF", xFn: (i) => xPos(i, 4), y: 52 },
      { specificRole: "RW", role: "FW", xFn: (i) => xPos(i, 3), y: 22 },
      { specificRole: "ST", role: "FW", xFn: (i) => xPos(i, 3), y: 22 },
      { specificRole: "LW", role: "FW", xFn: (i) => xPos(i, 3), y: 22 },
    ],
  },
  {
    label: "5-3-2",
    df: 5, mf: 3, fw: 2,
    slots: [
      { specificRole: "GK", role: "GK", xFn: () => 50, y: 88 },
      { specificRole: "WB", role: "DF", xFn: (i) => xPos(i, 5), y: 72 },
      { specificRole: "CB", role: "DF", xFn: (i) => xPos(i, 5), y: 72 },
      { specificRole: "CB", role: "DF", xFn: (i) => xPos(i, 5), y: 72 },
      { specificRole: "CB", role: "DF", xFn: (i) => xPos(i, 5), y: 72 },
      { specificRole: "WB", role: "DF", xFn: (i) => xPos(i, 5), y: 72 },
      { specificRole: "CM", role: "MF", xFn: (i) => xPos(i, 3), y: 50 },
      { specificRole: "CDM", role: "MF", xFn: (i) => xPos(i, 3), y: 50 },
      { specificRole: "CM", role: "MF", xFn: (i) => xPos(i, 3), y: 50 },
      { specificRole: "ST", role: "FW", xFn: (i) => xPos(i, 2), y: 22 },
      { specificRole: "ST", role: "FW", xFn: (i) => xPos(i, 2), y: 22 },
    ],
  },
  {
    label: "4-3-1-2",
    df: 4, mf: 4, fw: 2,
    slots: [
      { specificRole: "GK", role: "GK", xFn: () => 50, y: 88 },
      { specificRole: "RB", role: "DF", xFn: (i) => xPos(i, 4), y: 72 },
      { specificRole: "CB", role: "DF", xFn: (i) => xPos(i, 4), y: 72 },
      { specificRole: "CB", role: "DF", xFn: (i) => xPos(i, 4), y: 72 },
      { specificRole: "LB", role: "DF", xFn: (i) => xPos(i, 4), y: 72 },
      { specificRole: "CM", role: "MF", xFn: (i) => xPos(i, 3), y: 56 },
      { specificRole: "CDM", role: "MF", xFn: (i) => xPos(i, 3), y: 56 },
      { specificRole: "CM", role: "MF", xFn: (i) => xPos(i, 3), y: 56 },
      { specificRole: "CAM", role: "MF", xFn: () => 50, y: 38 },
      { specificRole: "ST", role: "FW", xFn: (i) => xPos(i, 2), y: 22 },
      { specificRole: "ST", role: "FW", xFn: (i) => xPos(i, 2), y: 22 },
    ],
  },
  {
    label: "4-1-4-1",
    df: 4, mf: 5, fw: 1,
    slots: [
      { specificRole: "GK", role: "GK", xFn: () => 50, y: 88 },
      { specificRole: "RB", role: "DF", xFn: (i) => xPos(i, 4), y: 72 },
      { specificRole: "CB", role: "DF", xFn: (i) => xPos(i, 4), y: 72 },
      { specificRole: "CB", role: "DF", xFn: (i) => xPos(i, 4), y: 72 },
      { specificRole: "LB", role: "DF", xFn: (i) => xPos(i, 4), y: 72 },
      { specificRole: "CDM", role: "MF", xFn: () => 50, y: 60 },
      { specificRole: "RM", role: "MF", xFn: (i) => xPos(i, 4), y: 44 },
      { specificRole: "CM", role: "MF", xFn: (i) => xPos(i, 4), y: 44 },
      { specificRole: "CM", role: "MF", xFn: (i) => xPos(i, 4), y: 44 },
      { specificRole: "LM", role: "MF", xFn: (i) => xPos(i, 4), y: 44 },
      { specificRole: "ST", role: "FW", xFn: () => 50, y: 20 },
    ],
  },
];

const ROLE_LABEL: Record<string, string> = {
  // Generici
  GK: "Portiere",
  DF: "Difensore",
  MF: "Centrocampista",
  FW: "Attaccante",
  // Specifici
  CB: "Difensore Centrale",
  RB: "Terzino Destro",
  LB: "Terzino Sinistro",
  WB: "Terzino a Tutta Fascia",
  CDM: "Mediano",
  CM: "Centrocampista Centrale",
  CAM: "Trequartista",
  RM: "Ala/Mezzala Destra",
  LM: "Ala/Mezzala Sinistra",
  RW: "Ala Destra",
  LW: "Ala Sinistra",
  SS: "Seconda Punta",
  ST: "Prima Punta",
  CF: "Centravanti",
};

// Ruoli specifici compatibili con ogni ruolo generico
const GENERIC_TO_SPECIFIC: Record<GenericRole, SpecificRole[]> = {
  GK: ["GK"],
  DF: ["CB", "RB", "LB", "WB"],
  MF: ["CDM", "CM", "CAM", "RM", "LM", "RW", "LW", "WB"],
  FW: ["ST", "SS", "CF", "RW", "LW", "CAM"],
};

// Controlla se un giocatore può giocare in una posizione specifica
// Regola: solo corrispondenza esatta sul ruolo specifico — nessun fallback generico
function canPlayPosition(player: Player, slotSpecificRole: SpecificRole, _slotGenericRole: GenericRole): boolean {
  const playerRoles = player.roles ?? [];
  // Corrispondenza esatta
  if (playerRoles.includes(slotSpecificRole)) return true;
  // Equivalenze tattiche reali (ruoli storicamente intercambiabili)
  const equivalences: Partial<Record<SpecificRole, SpecificRole[]>> = {
    RW: ["RM"],   // ala destra ↔ mezzala destra
    LW: ["LM"],   // ala sinistra ↔ mezzala sinistra
    RM: ["RW"],
    LM: ["LW"],
    ST: ["CF", "SS"],  // varianti del centravanti
    CF: ["ST", "SS"],
    SS: ["ST", "CF"],
    WB: ["RB", "LB"], // terzino a tutta fascia
    RB: ["WB"],
    LB: ["WB"],
  };
  const equiv = equivalences[slotSpecificRole] ?? [];
  return equiv.some((r) => playerRoles.includes(r));
}

const ROLE_COLOR: Record<string, string> = {
  // Generici
  GK: "bg-yellow-500", DF: "bg-blue-500", MF: "bg-green-500", FW: "bg-red-500",
  // Specifici
  CB: "bg-blue-600", RB: "bg-blue-400", LB: "bg-blue-400", WB: "bg-blue-300",
  CDM: "bg-emerald-600", CM: "bg-green-500", CAM: "bg-teal-500",
  RM: "bg-green-400", LM: "bg-green-400", RW: "bg-lime-500", LW: "bg-lime-500",
  SS: "bg-orange-500", ST: "bg-red-500", CF: "bg-red-600",
};

const ROLE_BORDER: Record<string, string> = {
  GK: "border-yellow-500", DF: "border-blue-500", MF: "border-green-500", FW: "border-red-500",
  CB: "border-blue-600", RB: "border-blue-400", LB: "border-blue-400", WB: "border-blue-300",
  CDM: "border-emerald-600", CM: "border-green-500", CAM: "border-teal-500",
  RM: "border-green-400", LM: "border-green-400", RW: "border-lime-500", LW: "border-lime-500",
  SS: "border-orange-500", ST: "border-red-500", CF: "border-red-600",
};

const ROLE_TEXT: Record<string, string> = {
  GK: "text-yellow-600", DF: "text-blue-600", MF: "text-green-600", FW: "text-red-600",
  CB: "text-blue-700", RB: "text-blue-500", LB: "text-blue-500", WB: "text-blue-400",
  CDM: "text-emerald-700", CM: "text-green-600", CAM: "text-teal-600",
  RM: "text-green-500", LM: "text-green-500", RW: "text-lime-600", LW: "text-lime-600",
  SS: "text-orange-600", ST: "text-red-600", CF: "text-red-700",
};

// ─── Build field slots from formation ────────────────────────────────────────

function buildFieldSlots(f: Formation): FieldSlot[] {
  // Raggruppa per riga (stessa y) per calcolare l'indice corretto dentro ogni riga
  const rowMap = new Map<number, SlotDef[]>();
  for (const s of f.slots) {
    if (!rowMap.has(s.y)) rowMap.set(s.y, []);
    rowMap.get(s.y)!.push(s);
  }
  // Precomputa l'indice di ogni slot nella sua riga
  const slotRowIdx = new Map<SlotDef, number>();
  for (const rowSlots of Array.from(rowMap.values())) {
    rowSlots.forEach((s, i) => slotRowIdx.set(s, i));
  }

  const roleCount: Record<string, number> = {};
  return f.slots.map((def, globalIdx) => {
    const count = roleCount[def.specificRole] ?? 0;
    roleCount[def.specificRole] = count + 1;
    // Usa l'indice nella riga (non nel ruolo generico) per il calcolo x
    const rowSlots = rowMap.get(def.y)!;
    const idxInRow = slotRowIdx.get(def)!;
    const rawX = def.xFn(idxInRow, rowSlots.length);
    // Posizionamento laterale: in una visuale TV (guardando il campo dall'alto),
    // LB (terzino sinistro) sta a SINISTRA dello schermo, RB (terzino destro) a DESTRA.
    // xPos con indice basso dà x bassa (sinistra schermo).
    // Nei moduli RB è definito prima (indice basso) e LB dopo (indice alto).
    // Quindi RB ha rawX bassa e LB ha rawX alta → RB è già a sinistra e LB a destra.
    // Ma vogliamo il contrario: RB a destra, LB a sinistra.
    // Soluzione: NON specchiare nulla — lasciare rawX così com'è.
    // RB (indice 0) → rawX=20% → sinistra schermo → ma in TV il terzino destro è a SINISTRA
    //   dello spettatore (la destra del campo è la sinistra di chi guarda in TV).
    // Quindi la posizione naturale è corretta per la visuale TV!
    // Se l'utente vede LB a destra e RB a sinistra come errore, significa che vuole
    // la visuale "dal campo" (non TV): LB a sinistra schermo, RB a destra schermo.
    // In quel caso specchiamo SOLO i ruoli destri e non i sinistri.
    let finalX = rawX;
    const rightRoles: SpecificRole[] = ["RB", "RW", "RM"];
    const leftRoles: SpecificRole[] = ["LB", "LW", "LM"];
    // Ruoli destri: definiti prima (indice basso = x bassa = sinistra) → specchia a destra
    if (rightRoles.includes(def.specificRole)) {
      finalX = 100 - rawX;
    }
    // Ruoli sinistri: definiti dopo (indice alto = x alta = destra) → specchia a sinistra
    if (leftRoles.includes(def.specificRole)) {
      finalX = 100 - rawX;
    }
    return {
      id: `${def.specificRole}-${globalIdx}`,
      role: def.role,
      specificRole: def.specificRole,
      x: finalX,
      y: def.y,
      assignedPlayer: null,
      fromTeam: null,
    };
  });
}

// ─── Simulation helpers ───────────────────────────────────────────────────────

function calcTeamOvr(slots: FieldSlot[]): number {
  const filled = slots.filter((s) => s.assignedPlayer !== null);
  if (filled.length === 0) return 70;
  return Math.round(filled.reduce((s, p) => s + (p.assignedPlayer?.ovr ?? 70), 0) / filled.length);
}

function pickScorers(players: Player[], count: number): string[] {
  if (count === 0) return [];
  const fw = players.filter((p) => p.role === "FW" || (p.roles && (p.roles.includes("ST") || p.roles.includes("SS") || p.roles.includes("CF"))));
  const mf = players.filter((p) => p.role === "MF" && !(p.roles && (p.roles.includes("ST") || p.roles.includes("SS"))));
  const df = players.filter((p) => p.role === "DF");
  const pool = [...fw, ...fw, ...mf, ...df]; // FW doppio peso
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    const pick = pool[Math.floor(Math.random() * pool.length)];
    result.push(pick ? pick.name : "Sconosciuto");
  }
  return result;
}

function simulateMatch(
  ovr1: number,
  ovr2: number,
  players1: Player[],
  players2: Player[]
): { win: boolean; draw: boolean; score: string; scorers: string[]; oppScorers: string[] } {
  const diff = ovr1 - ovr2;
  const winProb = Math.max(0.1, Math.min(0.75, 0.45 + diff * 0.015));
  const drawProb = 0.22;
  const r = Math.random();
  const win = r < winProb;
  const draw = !win && r < winProb + drawProb;
  const g1 = win
    ? Math.floor(Math.random() * 3) + 1
    : draw
    ? Math.floor(Math.random() * 3)
    : Math.floor(Math.random() * 2);
  const g2 = win
    ? Math.max(0, g1 - Math.floor(Math.random() * 2) - 1)
    : draw
    ? g1
    : g1 + Math.floor(Math.random() * 2) + 1;
  return {
    win, draw,
    score: `${g1}-${g2}`,
    scorers: pickScorers(players1, g1),
    oppScorers: pickScorers(players2, g2),
  };
}

function simulatePenalties(myPlayers: Player[], oppPlayers: Player[]): PenaltyResult {
  // Seleziona tiratori: i portieri non tirano mai i rigori
  const myShooters = shuffle(myPlayers.filter(p => p.role !== 'GK')).slice(0, 10);
  const oppShooters = shuffle(oppPlayers.filter(p => p.role !== 'GK')).slice(0, 10);
  // Serie da 5 rigori ciascuno, poi sudden death
  let my = 0, opp = 0;
  const sequence: { isHome: boolean; scored: boolean; shooter: string }[] = [];
  for (let i = 0; i < 5; i++) {
    const ms = Math.random() > 0.25; if (ms) my++;
    sequence.push({ isHome: true, scored: ms, shooter: myShooters[i]?.name ?? 'Dream Team' });
    const os = Math.random() > 0.25; if (os) opp++;
    sequence.push({ isHome: false, scored: os, shooter: oppShooters[i]?.name ?? 'Avversario' });
  }
  if (my !== opp) return { myPens: my, oppPens: opp, win: my > opp, sequence };
  // Sudden death
  for (let i = 0; i < 10; i++) {
    const m = Math.random() > 0.25;
    const o = Math.random() > 0.25;
    const mi = 5 + i;
    sequence.push({ isHome: true, scored: m, shooter: myShooters[mi % myShooters.length]?.name ?? 'Dream Team' });
    sequence.push({ isHome: false, scored: o, shooter: oppShooters[mi % oppShooters.length]?.name ?? 'Avversario' });
    if (m !== o) return { myPens: my + (m ? 1 : 0), oppPens: opp + (o ? 1 : 0), win: m, sequence };
  }
  return { myPens: my + 1, oppPens: opp, win: true, sequence };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = "loading" | "setup" | "pick" | "reveal" | "group" | "knockout" | "result";

interface GroupMatch {
  opponent: Team;
  myOvr: number;
  oppOvr: number;
  win: boolean;
  draw: boolean;
  score: string;
  points: number;
  scorers: string[];    // marcatori mia squadra
  oppScorers: string[]; // marcatori avversario
}

interface PenaltyResult {
  myPens: number;
  oppPens: number;
  win: boolean;
  sequence: { isHome: boolean; scored: boolean; shooter: string }[];
}


interface KnockoutRound {
  label: string;
  opponent: Team;
  myOvr: number;
  oppOvr: number;
  win: boolean;
  score: string;
  scorers: string[];
  oppScorers: string[];
  penalties?: PenaltyResult; // presente solo se c'è stato pareggio
}

// ─── Field component ─────────────────────────────────────────────────────────

interface FieldProps {
  slots: FieldSlot[];
  selectedSlotId: string | null;
  onSlotClick: (slotId: string) => void;
  formation: Formation;
}

function FootballField({ slots, selectedSlotId, onSlotClick, formation }: FieldProps) {
  return (
    <div className="relative w-full" style={{ paddingBottom: "140%" }}>
      {/* Campo verde */}
      <div className="absolute inset-0 rounded-lg overflow-hidden border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
        {/* Sfondo campo */}
        <svg viewBox="0 0 100 140" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          {/* Strisce erba */}
          {Array.from({ length: 7 }).map((_, i) => (
            <rect key={i} x="0" y={i * 20} width="100" height="20"
              fill={i % 2 === 0 ? "#2d7a2d" : "#267026"} />
          ))}
          {/* Linee campo */}
          <rect x="5" y="5" width="90" height="130" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="0.8" />
          <line x1="5" y1="70" x2="95" y2="70" stroke="rgba(255,255,255,0.6)" strokeWidth="0.8" />
          {/* Cerchio centrocampo */}
          <circle cx="50" cy="70" r="12" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="0.8" />
          <circle cx="50" cy="70" r="0.8" fill="rgba(255,255,255,0.6)" />
          {/* Area grande nostra */}
          <rect x="22" y="110" width="56" height="25" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="0.8" />
          {/* Area piccola nostra */}
          <rect x="35" y="125" width="30" height="10" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="0.8" />
          {/* Area grande avversaria */}
          <rect x="22" y="5" width="56" height="25" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="0.8" />
          {/* Area piccola avversaria */}
          <rect x="35" y="5" width="30" height="10" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="0.8" />
          {/* Porta nostra */}
          <rect x="40" y="133" width="20" height="4" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1" />
          {/* Porta avversaria */}
          <rect x="40" y="3" width="20" height="4" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1" />
        </svg>

        {/* Etichetta modulo */}
        <div className="absolute top-2 left-2 bg-black/60 text-white text-xs font-bold px-2 py-0.5 rounded">
          {formation.label}
        </div>

        {/* Slot giocatori */}
        {slots.map((slot) => {
          const isSelected = selectedSlotId === slot.id;
          const isFilled = slot.assignedPlayer !== null;
          return (
            <button
              key={slot.id}
              onClick={() => onSlotClick(slot.id)}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all"
              style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
            >
              <div
                className={`w-12 h-12 rounded-full border-3 flex flex-col items-center justify-center text-center transition-all
                  ${isSelected
                    ? "ring-4 ring-white ring-offset-1 scale-110"
                    : ""
                  }
                  ${isFilled
                    ? "bg-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)]"
                    : `border-dashed border-2 border-white/80 bg-black/30 hover:bg-black/50`
                  }`}
                style={isFilled ? { borderColor: getRoleHex(slot.specificRole), borderWidth: 3 } : {}}
              >
                {isFilled ? (
                  <div className="flex flex-col items-center leading-none px-0.5">
                    <span className="text-[8px] font-black text-gray-800 leading-tight max-w-[44px] overflow-hidden text-ellipsis whitespace-nowrap">
                      {slot.assignedPlayer!.name.split(" ").pop()}
                    </span>
                    <span className={`text-[7px] font-bold mt-0.5 ${ROLE_TEXT[slot.specificRole] ?? ROLE_TEXT[slot.role]}`}>
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
  );
}

function getRoleHex(role: string): string {
  const map: Record<string, string> = {
    GK: "#eab308",
    DF: "#3b82f6", CB: "#2563eb", RB: "#60a5fa", LB: "#60a5fa", WB: "#93c5fd",
    MF: "#22c55e", CDM: "#059669", CM: "#22c55e", CAM: "#14b8a6",
    RM: "#4ade80", LM: "#4ade80", RW: "#84cc16", LW: "#84cc16",
    FW: "#ef4444", SS: "#f97316", ST: "#ef4444", CF: "#dc2626",
  };
  return map[role] ?? "#000";
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DreamTeamGame() {
  const [, setLocation] = useLocation();
  const { unlock } = useAchievements();
  const { isAuthenticated } = useAuth({});
  const recordGamePlayed = trpc.achievements.recordGamePlayed.useMutation();

  // Poliglotta: record that the user played this game
  useEffect(() => {
    if (isAuthenticated) recordGamePlayed.mutate({ gameType: 'dream-team' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const [db, setDb] = useState<DB | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const { setMatchActive, confirmExit } = useMatchGuard();

  useEffect(() => {
    setMatchActive(phase !== "loading" && phase !== "setup" && phase !== "result");
    return () => setMatchActive(false);
  }, [phase, setMatchActive]);

  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportTeam, setReportTeam] = useState<{ name: string; season: string } | null>(null);
  const [reportText, setReportText] = useState("");
  const [reportSent, setReportSent] = useState(false);

  const reportErrorMutation = trpc.dreamTeam.reportError.useMutation({
    onSuccess: () => {
      setReportSent(true);
      setTimeout(() => {
        setIsReportOpen(false);
        setReportSent(false);
        setReportText("");
      }, 2500);
    },
  });

  // Setup
  const [selectedFormation, setSelectedFormation] = useState<Formation>(FORMATIONS[0]);

  // Pick phase
  const [fieldSlots, setFieldSlots] = useState<FieldSlot[]>([]);
  const [teamQueue, setTeamQueue] = useState<Team[]>([]);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [selectedPlayerForSlot, setSelectedPlayerForSlot] = useState<Player | null>(null);
  // Track which teams have been used (one player per team)
  const [usedTeamIds, setUsedTeamIds] = useState<Set<string>>(new Set());

  // Simulation
  const [myOvr, setMyOvr] = useState(0);
  const [groupMatches, setGroupMatches] = useState<GroupMatch[]>([]);
  const [groupStep, setGroupStep] = useState(0);
  const [groupPoints, setGroupPoints] = useState(0);
  const [knockoutRounds, setKnockoutRounds] = useState<KnockoutRound[]>([]);
  const [knockoutStep, setKnockoutStep] = useState(0);
  const [qualified, setQualified] = useState(false);
  const [knockoutPool, setKnockoutPool] = useState<Team[]>([]);
  // Simulazione progressiva per minuto (knockout)
  const [matchMinute, setMatchMinute] = useState(0); // 0-90
  const [matchScoreHome, setMatchScoreHome] = useState(0);
  const [matchScoreAway, setMatchScoreAway] = useState(0);
  const [matchGoalEvents, setMatchGoalEvents] = useState<{minute: number; scorer: string; isHome: boolean}[]>([]);
  const [matchSimRunning, setMatchSimRunning] = useState(false);
  const [matchSimDone, setMatchSimDone] = useState(false);
  const [currentKnockoutIdx, setCurrentKnockoutIdx] = useState(0);
  const [waitingNextRound, setWaitingNextRound] = useState(false);
  // Velocità simulazione: slow=333ms/min (30s), normal=167ms/min (15s), fast=60ms/min (5.4s)
  const [matchSpeed, setMatchSpeed] = useState<"slow" | "normal" | "fast">("fast");
  const matchSpeedMs = matchSpeed === "slow" ? 333 : matchSpeed === "normal" ? 167 : 60;
  // Rigori progressivi
  const [penaltyStep, setPenaltyStep] = useState(0); // quanti rigori mostrati
  const [penaltyRunning, setPenaltyRunning] = useState(false);
  const [penaltyDone, setPenaltyDone] = useState(false); // true solo dopo che l'animazione è completata

  // Load DB
  useEffect(() => {
    fetch("/dreamteam_db.d7d8b7b0.json")
      .then((r) => r.json())
      .then((data: DB) => {
        setDb(data);
        setPhase("setup");
      });
  }, []);

  const startGame = useCallback((data: DB, formation: Formation) => {
    const slots = buildFieldSlots(formation);
    const shuffledTeams = shuffle(data.teams);
    setFieldSlots(slots);
    setTeamQueue(shuffledTeams.slice(1));
    setCurrentTeam(shuffledTeams[0]);
    setSelectedSlotId(null);
    setSelectedPlayerForSlot(null);
    setUsedTeamIds(new Set());
    setGroupMatches([]);
    setKnockoutRounds([]);
    setGroupStep(0);
    setGroupPoints(0);
    setQualified(false);
    setMatchMinute(0);
    setMatchScoreHome(0);
    setMatchScoreAway(0);
    setMatchGoalEvents([]);
    setMatchSimRunning(false);
    setMatchSimDone(false);
    setCurrentKnockoutIdx(0);
    setWaitingNextRound(false);
    setPhase("pick");
  }, []);

  // When user clicks a slot on the field
  const handleSlotClick = (slotId: string) => {
    const slot = fieldSlots.find((s) => s.id === slotId);
    if (!slot) return;
    // If a player is already selected from the roster, assign them
    if (selectedPlayerForSlot) {
      // Check role compatibility using specific roles
      if (!canPlayPosition(selectedPlayerForSlot, slot.specificRole, slot.role)) {
        // Role mismatch — do nothing
        return;
      }
      // Slot already filled — skip
      if (slot.assignedPlayer !== null) return;
      // Assign player to slot
      const newSlots = fieldSlots.map((s) =>
        s.id === slotId
          ? { ...s, assignedPlayer: selectedPlayerForSlot, fromTeam: currentTeam }
          : s
      );
      setFieldSlots(newSlots);
      setSelectedPlayerForSlot(null);
      setSelectedSlotId(null);
      // Advance to next team immediately
      advanceTeam(newSlots);
    } else {
      // Just select the slot to highlight it
      setSelectedSlotId(slotId === selectedSlotId ? null : slotId);
    }
  };

  // When user clicks a player from the roster
  const handlePlayerClick = (player: Player) => {
    if (!currentTeam) return;
    // If a slot is already selected, try to assign
    if (selectedSlotId) {
      const slot = fieldSlots.find((s) => s.id === selectedSlotId);
      if (slot && canPlayPosition(player, slot.specificRole, slot.role) && slot.assignedPlayer === null) {
        setFieldSlots((prev) =>
          prev.map((s) =>
            s.id === selectedSlotId
              ? { ...s, assignedPlayer: player, fromTeam: currentTeam }
              : s
          )
        );
        setSelectedSlotId(null);
        setSelectedPlayerForSlot(null);
        // Advance to next team after assignment
        advanceTeam(fieldSlots.map((s) =>
          s.id === selectedSlotId ? { ...s, assignedPlayer: player, fromTeam: currentTeam } : s
        ));
        return;
      }
    }
    // Otherwise just select the player
    setSelectedPlayerForSlot(selectedPlayerForSlot?.name === player.name ? null : player);
    setSelectedSlotId(null);
  };

  // Confirm assignment: player selected + slot selected
  const handleConfirmAssignment = () => {
    if (!selectedPlayerForSlot || !selectedSlotId || !currentTeam) return;
    const slot = fieldSlots.find((s) => s.id === selectedSlotId);
    if (!slot || !canPlayPosition(selectedPlayerForSlot, slot.specificRole, slot.role)) return;
    if (slot.assignedPlayer !== null) return;

    const newSlots = fieldSlots.map((s) =>
      s.id === selectedSlotId
        ? { ...s, assignedPlayer: selectedPlayerForSlot, fromTeam: currentTeam }
        : s
    );
    setFieldSlots(newSlots);
    setSelectedPlayerForSlot(null);
    setSelectedSlotId(null);
    advanceTeam(newSlots);
  };

  const advanceTeam = (newSlots: FieldSlot[]) => {
    const allFilled = newSlots.every((s) => s.assignedPlayer !== null);
    if (allFilled) {
      setPhase("reveal");
      return;
    }
    // Reset selection state before switching team
    setSelectedPlayerForSlot(null);
    setSelectedSlotId(null);
    // Move to next team in queue
    if (teamQueue.length > 0) {
      const [next, ...rest] = teamQueue;
      setCurrentTeam(next);
      setTeamQueue(rest);
      setUsedTeamIds((prev) => { const next = new Set(Array.from(prev)); next.add(currentTeam?.id ?? ""); return next; });
    }
  };

  // Build group stage
  const runGroupStage = () => {
    if (!db) return;
    const ovrCalc = calcTeamOvr(fieldSlots);
    setMyOvr(ovrCalc);
    const myPlayers = fieldSlots.map((s) => s.assignedPlayer).filter(Boolean) as Player[];

    const usedIds = new Set(fieldSlots.map((s) => s.fromTeam?.id).filter(Boolean));
    // Prendi 10 avversari unici per tutto il torneo (girone + knockout)
    // Ordinati per overall crescente: i più deboli al girone, i più forti alla finale
    const available = db.teams
      .filter((t) => !usedIds.has(t.id))
      .sort((a, b) => a.overall - b.overall); // dal più debole al più forte
    // Shuffle all'interno di fasce per evitare ordine troppo rigido
    const totalNeeded = 10; // 6 girone + 4 knockout
    const pool = available.slice(0, Math.max(totalNeeded, available.length));
    // Dividi in 3 fasce: deboli (girone 1-3), medi (girone 4-6), forti (knockout)
    const weak = pool.slice(0, Math.ceil(pool.length * 0.3));
    const mid = pool.slice(Math.ceil(pool.length * 0.3), Math.ceil(pool.length * 0.6));
    const strong = pool.slice(Math.ceil(pool.length * 0.6));
    const groupOpps = [...shuffle(weak).slice(0, 3), ...shuffle(mid).slice(0, 3)].slice(0, 6);
    // Salva i forti per il knockout
    const knockoutPool = shuffle(strong).slice(0, 4);

    const matches: GroupMatch[] = [];
    for (let i = 0; i < Math.min(6, groupOpps.length); i++) {
      const opp = groupOpps[i];
      const { win, draw, score, scorers, oppScorers } = simulateMatch(ovrCalc, opp.overall, myPlayers, opp.players);
      const pts = win ? 3 : draw ? 1 : 0;
      matches.push({ opponent: opp, myOvr: ovrCalc, oppOvr: opp.overall, win, draw, score, points: pts, scorers, oppScorers });
    }
    setGroupMatches(matches);
    // Salva il pool knockout nello stato per usarlo in buildKnockout
    setKnockoutPool(knockoutPool);
    setGroupStep(0);
    setPhase("group");
  };

  // Animate group matches
  useEffect(() => {
    if (phase !== "group") return;
    if (groupStep >= groupMatches.length) {
      const totalPts = groupMatches.reduce((s, m) => s + m.points, 0);
      setGroupPoints(totalPts);
      const qual = totalPts >= 10;
      setQualified(qual);
      if (!qual) {
        setTimeout(() => setPhase("result"), 800);
      } else {
        setTimeout(() => buildKnockout(totalPts), 800);
      }
      return;
    }
    const t = setTimeout(() => setGroupStep((s) => s + 1), 1200);
    return () => clearTimeout(t);
  }, [phase, groupStep, groupMatches]);

  const buildKnockout = useCallback((_pts?: number) => {
    if (!db) return;
    const myPlayers = fieldSlots.map((s) => s.assignedPlayer).filter(Boolean) as Player[];
    // Usa il pool pre-calcolato (squadre forti, ordinate per overall crescente)
    // Se non disponibile, fallback a squadre non usate
    let opponents = knockoutPool.length >= 4
      ? knockoutPool.slice(0, 4)
      : (() => {
          const usedInPick = new Set(fieldSlots.map((s) => s.fromTeam?.id).filter(Boolean));
          const usedInGroup = new Set(groupMatches.map((m) => m.opponent.id));
          const usedIds = new Set([...Array.from(usedInPick), ...Array.from(usedInGroup)]);
          return shuffle(db.teams.filter((t) => !usedIds.has(t.id))).slice(0, 4);
        })();
    // Ordina dal più debole al più forte: ottavi = più debole, finale = più forte
    opponents = [...opponents].sort((a, b) => a.overall - b.overall);
    const labels = ["Ottavi di Finale", "Quarti di Finale", "Semifinale", "Finale"];
    const ovrCalc = myOvr || calcTeamOvr(fieldSlots);

    // Simula solo i round necessari (stop al primo ko)
    const rounds: KnockoutRound[] = [];
    for (let i = 0; i < labels.length; i++) {
      const opp = opponents[i] ?? opponents[opponents.length - 1];
      const { win, draw, score, scorers, oppScorers } = simulateMatch(ovrCalc, opp.overall, myPlayers, opp.players);
      let penalties: PenaltyResult | undefined;
      let finalWin = win;
      if (draw) {
        penalties = simulatePenalties(myPlayers, opp.players);
        finalWin = penalties.win;
      }
      rounds.push({ label: labels[i], opponent: opp, myOvr: ovrCalc, oppOvr: opp.overall, win: finalWin, score, scorers, oppScorers, penalties });
      if (!finalWin) break; // stop: eliminato, non simulare i round successivi
    }
    setKnockoutRounds(rounds);
    setKnockoutStep(0);
    setPhase("knockout");
  }, [db, fieldSlots, myOvr, groupMatches, knockoutPool]);

  // Avvia simulazione progressiva per minuto di una partita knockout
  const startMatchSim = useCallback((roundIdx: number) => {
    if (!knockoutRounds[roundIdx]) return;
    const round = knockoutRounds[roundIdx];
    setMatchMinute(0);
    setMatchScoreHome(0);
    setMatchScoreAway(0);
    setMatchGoalEvents([]);
    setMatchSimRunning(true);
    setMatchSimDone(false);
    setWaitingNextRound(false);
    // Genera eventi gol distribuiti nei 90 minuti
    const [myGoals, oppGoals] = round.score.split("-").map(Number);
    const events: {minute: number; scorer: string; isHome: boolean}[] = [];
    const usedMinutes = new Set<number>();
    const randMinute = () => {
      let m = Math.floor(Math.random() * 90) + 1;
      while (usedMinutes.has(m)) m = m % 90 + 1;
      usedMinutes.add(m);
      return m;
    };
    for (let i = 0; i < myGoals; i++) {
      events.push({ minute: randMinute(), scorer: round.scorers[i] ?? "Dream Team", isHome: true });
    }
    for (let i = 0; i < oppGoals; i++) {
      events.push({ minute: randMinute(), scorer: round.oppScorers[i] ?? round.opponent.name, isHome: false });
    }
    events.sort((a, b) => a.minute - b.minute);
    setMatchGoalEvents(events);
  }, [knockoutRounds]);

  // Animazione minuto per minuto
  useEffect(() => {
    if (!matchSimRunning || matchSimDone) return;
    if (matchMinute >= 90) {
      setMatchSimRunning(false);
      setMatchSimDone(true);
      const round = knockoutRounds[currentKnockoutIdx];
      if (round?.penalties?.sequence) {
        // Pareggio ai rigori: avvia animazione progressiva
        setTimeout(() => {
          setPenaltyStep(0);
          setPenaltyRunning(true);
        }, 800);
      } else if (round && !round.win) {
        setTimeout(() => setPhase("result"), 2000);
      } else {
        setWaitingNextRound(true);
      }
      return;
    }
    const t = setTimeout(() => {
      setMatchMinute((m) => m + 1);
      // Aggiorna score se ci sono gol a questo minuto
      setMatchGoalEvents((events) => {
        const goalsAtMinute = events.filter((e) => e.minute === matchMinute + 1);
        goalsAtMinute.forEach((g) => {
          if (g.isHome) setMatchScoreHome((s) => s + 1);
          else setMatchScoreAway((s) => s + 1);
        });
        return events;
      });
    }, matchSpeedMs);
    return () => clearTimeout(t);
  }, [matchSimRunning, matchSimDone, matchMinute, knockoutRounds, currentKnockoutIdx, matchSpeedMs]);

  // Animazione rigori progressiva
  useEffect(() => {
    if (!penaltyRunning) return;
    const currentRound = knockoutRounds[currentKnockoutIdx];
    if (!currentRound?.penalties?.sequence) return;
    const seq = currentRound.penalties.sequence;
    if (penaltyStep >= seq.length) {
      setPenaltyRunning(false);
      setPenaltyDone(true);
      setWaitingNextRound(true);
      return;
    }
    const t = setTimeout(() => setPenaltyStep(s => s + 1), 900);
    return () => clearTimeout(t);
  }, [penaltyRunning, penaltyStep, knockoutRounds, currentKnockoutIdx]);

  const proceedToNextRound = () => {
    const nextIdx = currentKnockoutIdx + 1;
    setPenaltyStep(0);
    setPenaltyRunning(false);
    setPenaltyDone(false);
    if (nextIdx >= knockoutRounds.length) {
      setPhase("result");
    } else {
      setCurrentKnockoutIdx(nextIdx);
      setKnockoutStep(nextIdx);
      setWaitingNextRound(false);
      startMatchSim(nextIdx);
    }
  };

  // Avvia automaticamente la prima partita knockout
  useEffect(() => {
    if (phase === "knockout" && knockoutRounds.length > 0 && !matchSimRunning && !matchSimDone && currentKnockoutIdx === 0) {
      startMatchSim(0);
    }
  }, [phase, knockoutRounds, matchSimRunning, matchSimDone, currentKnockoutIdx, startMatchSim]);

  // ─── Derived state ────────────────────────────────────────────────────────

  const filledCount = fieldSlots.filter((s) => s.assignedPlayer !== null).length;
  const totalSlots = fieldSlots.length;
  const emptySlots = fieldSlots.filter((s) => s.assignedPlayer === null);

  // Which roles are still needed
  const neededRoles = emptySlots.map((s) => s.role);
  // Players from current team that can play in a given specific slot
  const availableForSlot = (specificRole: SpecificRole, genericRole: GenericRole) =>
    currentTeam?.players.filter((p) => canPlayPosition(p, specificRole, genericRole)) ?? [];
  // Players grouped by generic role (for display)
  const availableByRole = (role: GenericRole) =>
    currentTeam?.players.filter((p) => p.role === role) ?? [];

  // Achievement: Dream Team Campione (single player win)
  // MUST be before any conditional return to respect Rules of Hooks
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (phase !== 'result') return;
    const wonAll = qualified && knockoutRounds.length > 0 && knockoutRounds.every((r) => r.win);
    if (!wonAll || !isAuthenticated) return;
    const candidates: { achievementId: string; tier: 1 | 2 | 3 }[] = [
      { achievementId: 'dream-team-campione', tier: 1 },
    ];
    const wonFormations: string[] = JSON.parse(localStorage.getItem('dt_won_formations') || '[]');
    if (!wonFormations.includes(selectedFormation.label)) {
      wonFormations.push(selectedFormation.label);
      localStorage.setItem('dt_won_formations', JSON.stringify(wonFormations));
    }
    if (wonFormations.length >= FORMATIONS.length) {
      candidates.push({ achievementId: 'dream-team-campione', tier: 3 });
    }
    unlock(candidates);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ─── LOADING ─────────────────────────────────────────────────────────────
  if (phase === "loading" || !db) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-2xl font-display font-bold animate-pulse">Caricamento...</div>
      </div>
    );
  }

  // ─── SETUP ───────────────────────────────────────────────────────────────
  if (phase === "setup") {
    return (
      <div className="min-h-screen bg-background">
        <NavigationBar onFeedbackClick={() => setIsFeedbackOpen(true)} />
        <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
        <div className="container max-w-2xl py-8 space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-display font-black uppercase tracking-tight">Dream Team</h1>
              <p className="text-muted-foreground text-sm">Costruisci il tuo Dream Team storico</p>
            </div>
          </div>

          <div className="bg-card border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6 space-y-3">
            <h2 className="font-display font-black uppercase text-lg border-b-2 border-black pb-2">Come si gioca</h2>
            <p className="text-sm text-muted-foreground">
              Scegli il modulo, poi costruisci il tuo Dream Team: per ogni posizione sul campo viene estratta una grande squadra storica della Serie A, e tu scegli quale giocatore di quella rosa mettere in quella posizione.
            </p>
            <p className="text-sm text-muted-foreground">
              L'overall è <strong>nascosto</strong> durante la scelta. Poi il tuo Dream Team affronta una <strong>fase a gironi</strong> (6 partite, servono 10 punti) e, se ti qualifichi, il tabellone: <strong>Ottavi → Quarti → Semifinale → Finale</strong>.
            </p>
          </div>

          <div className="bg-card border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
            <h2 className="font-display font-black uppercase text-lg border-b-2 border-black pb-2 mb-4">Scegli il Modulo</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {FORMATIONS.map((f) => (
                <button
                  key={f.label}
                  onClick={() => setSelectedFormation(f)}
                  className={`border-4 border-black p-3 text-center font-display font-black text-lg transition-all
                    ${selectedFormation.label === f.label
                      ? "bg-pink-500 text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] translate-x-[-1px] translate-y-[-1px]"
                      : "bg-white hover:bg-pink-50 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                    }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="mt-4 p-3 bg-muted border-2 border-black text-sm">
              <p className="font-bold mb-2">Posizioni nel modulo {selectedFormation.label}:</p>
              <div className="flex flex-wrap gap-1.5">
                {selectedFormation.slots.map((s, i) => (
                  <span key={i} className={`text-white text-xs font-bold px-2 py-0.5 ${ROLE_COLOR[s.specificRole] ?? ROLE_COLOR[s.role]}`}>
                    {s.specificRole}
                  </span>
                ))}
              </div>
              <p className="text-muted-foreground mt-2 text-xs">Totale: 11 giocatori</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              onClick={() => startGame(db, selectedFormation)}
              className="w-full py-6 text-xl font-bold uppercase bg-black hover:bg-gray-800 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
            >
              <Zap className="mr-2 h-6 w-6" />
              Single Player
            </Button>
            <Button
              onClick={() => setLocation("/dream-team/multiplayer")}
              className="w-full py-6 text-xl font-bold uppercase bg-amber-400 hover:bg-amber-300 text-black border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
            >
              <Users className="mr-2 h-6 w-6" />
              Multiplayer
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── PICK ─────────────────────────────────────────────────────────────────
  if (phase === "pick" && currentTeam) {
    const selectedSlot = fieldSlots.find((s) => s.id === selectedSlotId);

    return (
      <div className="min-h-screen bg-background">
        <NavigationBar onFeedbackClick={() => setIsFeedbackOpen(true)} />
        <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />

        {/* Modale Segnala Errore Dream Team */}
        {isReportOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setIsReportOpen(false)}>
            <div className="bg-card border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 max-w-md w-full space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                <h2 className="text-lg font-display font-black uppercase">Segnala Errore</h2>
              </div>
              {reportTeam && (
                <p className="text-sm text-muted-foreground">
                  Rosa: <strong>{reportTeam.name} {reportTeam.season}</strong>
                </p>
              )}
              {reportSent ? (
                <div className="text-center py-4">
                  <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
                  <p className="font-bold text-green-600">Segnalazione inviata! Grazie.</p>
                </div>
              ) : (
                <>
                  <textarea
                    className="w-full border-2 border-black p-3 text-sm bg-background resize-none focus:outline-none focus:border-pink-500"
                    rows={4}
                    placeholder="Descrivi l'errore (es. 'Ronaldo non ha mai giocato qui', 'Stagione sbagliata', ecc.)"
                    value={reportText}
                    onChange={(e) => setReportText(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 border-2 border-black"
                      onClick={() => setIsReportOpen(false)}
                    >
                      Annulla
                    </Button>
                    <Button
                      className="flex-1 bg-orange-500 hover:bg-orange-600 text-white border-2 border-black font-bold uppercase"
                      disabled={!reportText.trim() || reportErrorMutation.isPending}
                      onClick={() => {
                        if (reportTeam && reportText.trim()) {
                          reportErrorMutation.mutate({
                            teamName: reportTeam.name,
                            season: reportTeam.season,
                            description: reportText.trim(),
                          });
                        }
                      }}
                    >
                      {reportErrorMutation.isPending ? "Invio..." : "Invia"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div className="container max-w-5xl py-6 space-y-4">

          {/* Header */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => confirmExit(() => setPhase("setup"))}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-display font-black uppercase tracking-tight">Dream Team</h1>
              <p className="text-muted-foreground text-xs">
                {filledCount}/{totalSlots} posizioni riempite · Modulo {selectedFormation.label}
              </p>
            </div>
            <div className="text-right flex items-center gap-2">
              <div>
                <div className="text-xs font-bold text-muted-foreground">Squadra estratta</div>
                <div className="font-display font-black text-sm">{currentTeam.name} {currentTeam.season}</div>
              </div>
              <button
                onClick={() => { setReportTeam({ name: currentTeam.name, season: currentTeam.season }); setIsReportOpen(true); }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-orange-500 border border-muted hover:border-orange-400 px-2 py-1 rounded transition-colors"
                title="Segnala un errore in questa rosa"
              >
                <AlertTriangle className="w-3 h-3" />
                <span className="hidden sm:inline">Segnala</span>
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-muted border-2 border-black">
            <div
              className="h-full bg-gradient-to-r from-pink-500 to-rose-500 transition-all duration-500"
              style={{ width: `${(filledCount / totalSlots) * 100}%` }}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Campo */}
            <div className="space-y-2">
              <p className="font-bold uppercase text-xs text-muted-foreground">
                Clicca una posizione vuota, poi scegli il giocatore dalla rosa →
              </p>
              <FootballField
                slots={fieldSlots}
                selectedSlotId={selectedSlotId}
                onSlotClick={handleSlotClick}
                formation={selectedFormation}
              />
            </div>

            {/* Rosa squadra corrente */}
            <div className="space-y-3">
              {/* Info squadra */}
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
              </div>

              {/* Istruzione contestuale */}
              {selectedSlot && !selectedSlot.assignedPlayer && (
                <div className={`border-2 p-2 text-sm font-bold ${ROLE_BORDER[selectedSlot.specificRole] ?? ROLE_BORDER[selectedSlot.role]} bg-muted`}>
                  Posizione selezionata: <span className={ROLE_TEXT[selectedSlot.specificRole] ?? ROLE_TEXT[selectedSlot.role]}>{ROLE_LABEL[selectedSlot.specificRole]}</span>
                  {" "}— scegli un giocatore compatibile qui sotto
                </div>
              )}
              {selectedPlayerForSlot && (
                <div className="border-2 border-pink-500 p-2 text-sm font-bold bg-pink-50">
                  Giocatore selezionato: <span className="text-pink-600">{selectedPlayerForSlot.name}</span>
                  {" "}({(selectedPlayerForSlot.roles ?? [selectedPlayerForSlot.role]).join("/")})
                  {" "}— ora clicca la posizione compatibile sul campo
                </div>
              )}

              {/* Giocatori — lista piatta filtrata per slot selezionato */}
              <div key={currentTeam.id} className="max-h-[420px] overflow-y-auto pr-1">
                <div className="flex flex-wrap gap-1.5">
                  {currentTeam.players.filter((p) => {
                    // Escludi giocatori già assegnati da questa squadra specifica
                    return !fieldSlots.some((s) => s.fromTeam?.id === currentTeam.id && s.assignedPlayer?.name === p.name);
                  }).map((p) => {
                    const isSelected = selectedPlayerForSlot?.name === p.name;
                    const slotSelected = !!selectedSlotId && !!selectedSlot && !selectedSlot.assignedPlayer;
                    const slotCompatible = slotSelected && selectedSlot &&
                      canPlayPosition(p, selectedSlot.specificRole, selectedSlot.role);
                    const isClickable = slotSelected && !!slotCompatible;
                    const isDisabled = !isClickable;
                    const playerRolesLabel = (p.roles ?? []).join("/") || p.role;
                    return (
                      <button
                        key={currentTeam.id + '-' + p.name}
                        onClick={() => isClickable ? handlePlayerClick(p) : undefined}
                        disabled={isDisabled}
                        title={!slotSelected ? "Seleziona prima una posizione sul campo" : !slotCompatible ? `Incompatibile con ${ROLE_LABEL[selectedSlot?.specificRole ?? selectedSlot?.role ?? ""]}` : playerRolesLabel}
                        className={`px-2.5 py-1.5 border-2 border-black text-xs font-bold transition-all
                          ${isSelected
                            ? "bg-pink-500 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] translate-x-[-1px] translate-y-[-1px]"
                            : isClickable
                            ? "bg-white hover:bg-pink-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
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

              {/* Pulsante conferma */}
              {selectedPlayerForSlot && selectedSlotId && (
                <Button
                  onClick={handleConfirmAssignment}
                  disabled={
                    !selectedSlot ||
                    !canPlayPosition(selectedPlayerForSlot, selectedSlot?.specificRole ?? "ST", selectedSlot?.role ?? "FW") ||
                    selectedSlot.assignedPlayer !== null
                  }
                  className="w-full py-4 text-base font-bold uppercase bg-black hover:bg-gray-800 text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] disabled:opacity-40"
                >
                  {selectedSlot && !canPlayPosition(selectedPlayerForSlot, selectedSlot.specificRole, selectedSlot.role)
                    ? `❌ Incompatibile (serve ${ROLE_LABEL[selectedSlot.specificRole]})`
                    : `✓ Assegna ${selectedPlayerForSlot.name}`}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── REVEAL ───────────────────────────────────────────────────────────────
  if (phase === "reveal") {
    const teamOvr = calcTeamOvr(fieldSlots);
    const byRole: Record<string, FieldSlot[]> = { GK: [], DF: [], MF: [], FW: [] };
    fieldSlots.forEach((s) => byRole[s.role]?.push(s));

    return (
      <div className="min-h-screen bg-background">
        <NavigationBar onFeedbackClick={() => setIsFeedbackOpen(true)} />
        <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
        <div className="container max-w-3xl py-8 space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-3xl font-display font-black uppercase tracking-tight">Il Tuo Dream Team</h1>
          </div>

          <div className="bg-card border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 text-center">
            <p className="text-sm font-bold uppercase text-muted-foreground mb-1">Overall Squadra</p>
            <div className="text-7xl font-display font-black text-pink-500">{teamOvr}</div>
            <div className="flex justify-center gap-1 mt-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className={`h-5 w-5 ${i < Math.round(teamOvr / 20) ? "text-yellow-400 fill-yellow-400" : "text-muted"}`} />
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Modulo {selectedFormation.label}</p>
          </div>

          <div className="bg-card border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
            <p className="font-bold uppercase text-sm mb-4 border-b-2 border-black pb-2">Rosa selezionata</p>
            <div className="space-y-4">
              {(["GK", "DF", "MF", "FW"] as const).map((role) => {
                const slots = byRole[role];
                if (!slots || slots.length === 0) return null;
                return (
                  <div key={role}>
                    <div className={`inline-block text-white text-xs font-bold px-2 py-0.5 mb-2 ${ROLE_COLOR[role]}`}>
                      {ROLE_LABEL[role]}
                    </div>
                    <div className="space-y-1">
                      {slots.map((s, i) => (
                        <div key={i} className="flex items-center justify-between border-2 border-black p-2 bg-muted">
                          <div>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 text-white mr-2 ${ROLE_COLOR[s.specificRole] ?? ROLE_COLOR[s.role]}`}>
                              {s.specificRole}
                            </span>
                            <span className="font-bold">{s.assignedPlayer?.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {s.fromTeam?.name} {s.fromTeam?.season}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-bold text-muted-foreground">OVR</span>
                            <span className="font-display font-black text-lg text-pink-500">{s.assignedPlayer?.ovr}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Button
            onClick={runGroupStage}
            className="w-full py-6 text-xl font-bold uppercase bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
          >
            <Trophy className="mr-2 h-6 w-6" />
            Inizia il Torneo!
          </Button>
        </div>
      </div>
    );
  }

  // ─── GROUP STAGE ──────────────────────────────────────────────────────────
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
                  <span className="font-display font-black text-base text-right">{m.opponent.name} {m.opponent.season.slice(0, 4)}</span>
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

  // ─── KNOCKOUT ─────────────────────────────────────────────────────────────
  if (phase === "knockout") {
    const currentRound = knockoutRounds[currentKnockoutIdx];
    const pastRounds = knockoutRounds.slice(0, currentKnockoutIdx);
    // Gol segnati fino al minuto corrente
    const goalsShownHome = matchGoalEvents.filter((e) => e.isHome && e.minute <= matchMinute);
    const goalsShownAway = matchGoalEvents.filter((e) => !e.isHome && e.minute <= matchMinute);

    return (
      <div className="min-h-screen bg-background">
        <NavigationBar onFeedbackClick={() => setIsFeedbackOpen(true)} />
        <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
        <div className="container max-w-2xl py-8 space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-display font-black uppercase tracking-tight">Fase ad Eliminazione</h1>
            <p className="text-muted-foreground text-sm mt-1">Ottavi → Quarti → Semifinale → Finale</p>
            {/* Selettore velocità */}
            <div className="flex items-center justify-center gap-2 mt-3">
              <span className="text-xs text-muted-foreground font-bold uppercase">Velocità:</span>
              {(["slow", "normal", "fast"] as const).map(speed => (
                <button
                  key={speed}
                  onClick={() => setMatchSpeed(speed)}
                  className={`px-3 py-1 text-xs font-bold uppercase border-2 border-black transition-all ${
                    matchSpeed === speed
                      ? "bg-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                      : "bg-white text-black hover:bg-gray-100"
                  }`}
                >
                  {speed === "slow" ? "🐢 Lenta (30s)" : speed === "normal" ? "🐇 Normale (15s)" : "⚡ Veloce (5s)"}
                </button>
              ))}
            </div>
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
                <span className="font-bold text-sm text-right">{r.opponent.name} {r.opponent.season.slice(0,4)}</span>
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
                  <div className="font-display font-black text-base">{currentRound.opponent.name}</div>
                  <div className="text-xs text-muted-foreground">{currentRound.opponent.season} · OVR {currentRound.oppOvr}</div>
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

              {/* Rigori progressivi */}
              {matchSimDone && currentRound.penalties && (
                <div className="mt-3 p-3 bg-muted border-2 border-black">
                  <p className="font-bold text-sm text-center mb-2">⚽ Rigori</p>
                  {/* Intestazione colonne */}
                  <div className="grid grid-cols-2 gap-1 text-xs font-black uppercase mb-2 border-b border-black pb-1">
                    <div className="text-left text-green-700">Dream Team</div>
                    <div className="text-right text-blue-700">{currentRound.opponent.name}</div>
                  </div>
                  {/* Sequenza rigori */}
                  {currentRound.penalties.sequence && (
                    <div className="space-y-1">
                      {currentRound.penalties.sequence
                        .slice(0, (penaltyRunning || !penaltyDone) ? penaltyStep : currentRound.penalties.sequence.length)
                        .map((kick, ki) => (
                        <div key={ki} className="grid grid-cols-2 gap-1 text-xs">
                          {kick.isHome ? (
                            <>
                              <div className={`font-bold ${kick.scored ? "text-green-600" : "text-red-500"}`}>
                                {kick.scored ? "⚽" : "✗"} {kick.shooter}
                              </div>
                              <div />
                            </>
                          ) : (
                            <>
                              <div />
                              <div className={`font-bold text-right ${kick.scored ? "text-green-600" : "text-red-500"}`}>
                                {kick.shooter} {kick.scored ? "⚽" : "✗"}
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                      {penaltyRunning && penaltyStep < (currentRound.penalties.sequence?.length ?? 0) && (
                        <div className="text-center text-xs text-muted-foreground animate-pulse mt-1">In corso...</div>
                      )}
                    </div>
                  )}
                  {/* Punteggio finale rigori — visibile solo dopo l'animazione */}
                  {penaltyDone && (
                    <div className="text-center mt-3 pt-2 border-t border-black">
                      <p className="font-display font-black text-2xl">
                        {currentRound.penalties.myPens} - {currentRound.penalties.oppPens}
                      </p>
                      <p className={`text-sm font-bold ${currentRound.penalties.win ? "text-green-600" : "text-red-600"}`}>
                        {currentRound.penalties.win ? "✓ Qualificato ai rigori" : "✗ Eliminato ai rigori"}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Pulsante conferma round successivo */}
              {waitingNextRound && (
                <Button
                  onClick={proceedToNextRound}
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

  // ─── RESULT ───────────────────────────────────────────────────────────────
  if (phase === "result") {
    const wonAll = qualified && knockoutRounds.length > 0 && knockoutRounds.every((r) => r.win);
    const lastKnockoutWin = knockoutRounds.filter((r) => r.win).length;
    const knockoutLabels = ["Ottavi", "Quarti", "Semifinale", "Finale"];
    // Il round in cui si è stati eliminati è quello con win=false, cioè knockoutLabels[lastKnockoutWin]
    const eliminatedAt = qualified ? knockoutLabels[lastKnockoutWin] ?? "Finale" : null;

    return (
      <div className="min-h-screen bg-background">
        <NavigationBar onFeedbackClick={() => setIsFeedbackOpen(true)} />
        <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
        <div className="container max-w-2xl py-8 space-y-6">
          <div className={`border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8 text-center ${wonAll ? "bg-gradient-to-br from-yellow-50 to-amber-50" : "bg-card"}`}>
            <div className="text-6xl mb-4">{wonAll ? "🏆" : qualified ? "⚽" : "❌"}</div>
            <h2 className="text-4xl font-display font-black uppercase mb-2">
              {wonAll ? "Campione!" : qualified ? `Eliminato ai ${eliminatedAt}` : "Eliminato al Girone"}
            </h2>
            <p className="text-muted-foreground text-lg">
              {wonAll ? "Hai vinto il Torneo con il tuo Dream Team!" : qualified ? `Hai superato il girone con ${groupPoints} punti, ma sei stato eliminato ai ${eliminatedAt}.` : `Non hai raggiunto i 10 punti nel girone (${groupPoints}/18). Riprova!`}
            </p>
            <div className="mt-4 text-5xl font-display font-black text-pink-500">OVR {myOvr}</div>
          </div>

          <div className="bg-card border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-5">
            <p className="font-bold uppercase text-sm mb-3 border-b-2 border-black pb-2">Fase a Gironi — {groupPoints} punti</p>
            <div className="space-y-1">
              {groupMatches.map((m, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground w-20">Giornata {i + 1}</span>
                  <span className="font-bold">vs {m.opponent.name} {m.opponent.season.slice(0, 4)}</span>
                  <span className="font-display font-black">{m.score}</span>
                  <span className={`font-bold w-4 text-right ${m.win ? "text-green-600" : m.draw ? "text-yellow-600" : "text-red-600"}`}>
                    {m.win ? "V" : m.draw ? "P" : "S"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {knockoutRounds.length > 0 && (
            <div className="bg-card border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-5">
              <p className="font-bold uppercase text-sm mb-3 border-b-2 border-black pb-2">Fase ad Eliminazione</p>
              <div className="space-y-1">
                {knockoutRounds.slice(0, lastKnockoutWin + 1).map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="font-bold text-muted-foreground w-28">{r.label}</span>
                    <span className="font-bold">vs {r.opponent.name} {r.opponent.season.slice(0, 4)}</span>
                    <span className="font-display font-black">{r.score}</span>
                    <span className={`font-bold ${r.win ? "text-green-600" : "text-red-600"}`}>{r.win ? "V" : "X"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-card border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-5">
            <p className="font-bold uppercase text-sm mb-3 border-b-2 border-black pb-2">Il tuo Dream Team ({selectedFormation.label})</p>
            <div className="space-y-1">
              {fieldSlots.map((s, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ROLE_COLOR[s.role]}`} />
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
              onClick={() => startGame(db, selectedFormation)}
              className="flex-1 py-6 text-xl font-bold uppercase bg-black hover:bg-gray-800 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
            >
              <Shuffle className="mr-2 h-5 w-5" />
              Nuova Partita
            </Button>
            <Button
              variant="outline"
              onClick={() => setPhase("setup")}
              className="flex-1 py-6 text-xl font-bold uppercase border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white hover:bg-pink-50"
            >
              <Users className="mr-2 h-5 w-5" />
              Cambia Modulo
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
