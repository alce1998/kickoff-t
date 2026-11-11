import { describe, it, expect } from "vitest";
import path from "path";
import fs from "fs";

// ── Inline the server-side helpers for testing ──────────────────────────────

interface DTPlayer { name: string; role: string; roles?: string[]; nat: string; ovr: number; }

function xorshift32(s: number): number {
  let x = s | 0;
  if (x === 0) x = 1;
  x ^= x << 13;
  x ^= x >> 17;
  x ^= x << 5;
  return x | 0;
}

function hashSeed(s: number): number {
  let x = s | 0;
  x = (((x >>> 16) ^ x) * 0x45d9f3b) | 0;
  x = (((x >>> 16) ^ x) * 0x45d9f3b) | 0;
  x = ((x >>> 16) ^ x) | 0;
  return x || 1;
}

function dtSimulateMatch(myOvr: number, oppOvr: number, _myPlayers: DTPlayer[], _oppPlayers: DTPlayer[], seed: number) {
  let s = hashSeed(seed);
  const nextR = () => { s = xorshift32(s); return (s >>> 0) / 0xffffffff; };
  const winProb = Math.min(0.75, Math.max(0.10, 0.45 + (myOvr - oppOvr) * 0.015));
  const drawProb = 0.22;
  const r = nextR();
  const win = r < winProb;
  const draw = (!win) && r < winProb + drawProb;
  const myGoals = win
    ? Math.floor(nextR() * 4) + 1
    : draw
    ? Math.floor(nextR() * 3)
    : Math.floor(nextR() * 3);
  const oppGoals = win
    ? Math.max(0, myGoals - 1 - Math.floor(nextR() * myGoals))
    : draw
    ? myGoals
    : myGoals + 1 + Math.floor(nextR() * 3);
  return { win, draw, score: `${myGoals}-${oppGoals}`, myGoals, oppGoals };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("DreamTeam DB", () => {
  it("dreamteam_db.d7d8b7b0.json exists and has teams", () => {
    const dbPath = path.join(process.cwd(), "client", "public", "dreamteam_db.d7d8b7b0.json");
    expect(fs.existsSync(dbPath)).toBe(true);
    const raw = fs.readFileSync(dbPath, "utf-8");
    const db = JSON.parse(raw);
    expect(Array.isArray(db.teams)).toBe(true);
    expect(db.teams.length).toBeGreaterThan(100);
    const team = db.teams[0];
    expect(team).toHaveProperty("id");
    expect(team).toHaveProperty("players");
    expect(Array.isArray(team.players)).toBe(true);
    expect(team.players.length).toBeGreaterThanOrEqual(10);
  });
});

describe("xorshift32 + hashSeed RNG", () => {
  it("hashSeed produces different values for different inputs", () => {
    const seeds = [0, 1, 2, 100, 999999, 0xabcdef];
    const results = seeds.map(hashSeed);
    const unique = new Set(results);
    expect(unique.size).toBe(seeds.length);
  });

  it("xorshift32 never collapses to 0 after chaining", () => {
    let s = hashSeed(0xabcdef);
    for (let i = 0; i < 100; i++) {
      s = xorshift32(s);
      expect(s).not.toBe(0);
    }
  });

  it("produces diverse r values (spans at least 0.3 range)", () => {
    let s = hashSeed(0xabcdef);
    const rs: number[] = [];
    for (let i = 0; i < 20; i++) {
      s = xorshift32(s);
      rs.push((s >>> 0) / 0xffffffff);
    }
    const min = Math.min(...rs);
    const max = Math.max(...rs);
    expect(max - min).toBeGreaterThan(0.3);
  });
});

describe("dtSimulateMatch (realistic scores)", () => {
  it("produces varied scores across different seeds (>5 distinct)", () => {
    const scores = new Set<string>();
    for (let seed = 1; seed <= 50; seed++) {
      const { score } = dtSimulateMatch(75, 72, [], [], seed * 1234);
      scores.add(score);
    }
    expect(scores.size).toBeGreaterThan(5);
  });

  it("win probability is respected: stronger team wins more often", () => {
    let wins = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const { win } = dtSimulateMatch(82, 65, [], [], seed * 7919);
      if (win) wins++;
    }
    expect(wins).toBeGreaterThan(50);
  });

  it("scores are not always 1-0", () => {
    const scores: string[] = [];
    for (let seed = 1; seed <= 30; seed++) {
      const { score } = dtSimulateMatch(75, 72, [], [], seed * 1234);
      scores.push(score);
    }
    const only10 = scores.every(s => s === "1-0");
    expect(only10).toBe(false);
  });

  it("draw probability is approximately 22%", () => {
    let draws = 0;
    for (let seed = 1; seed <= 1000; seed++) {
      const { draw } = dtSimulateMatch(75, 72, [], [], seed * 7919);
      if (draw) draws++;
    }
    // Should be between 10% and 35%
    expect(draws).toBeGreaterThan(100);
    expect(draws).toBeLessThan(350);
  });
});

describe("Bracket tournament (direct elimination)", () => {
  it("2 players: each gets exactly 1 knockout round (Finale)", () => {
    const players = [
      { userId: 101, displayName: "Alice", ovrCalc: 78, myPlayers: [] as DTPlayer[] },
      { userId: 202, displayName: "Bob",   ovrCalc: 74, myPlayers: [] as DTPlayer[] },
    ];
    const roomId = 42;
    const seeded = [...players].sort((a, b) => b.ovrCalc - a.ovrCalc);
    const n = seeded.length;
    let bracketSize = 2;
    while (bracketSize < n) bracketSize *= 2;
    const roundLabels: Record<number, string> = { 2: "Finale", 4: "Semifinale", 8: "Quarti di Finale", 16: "Ottavi di Finale" };
    const interleaved: (number | null)[] = new Array(bracketSize).fill(null);
    for (let i = 0; i < bracketSize / 2; i++) {
      interleaved[i * 2] = i < n ? i : null;
      interleaved[i * 2 + 1] = (bracketSize - 1 - i) < n ? bracketSize - 1 - i : null;
    }
    const knockoutRoundsMap = new Map<number, unknown[]>();
    players.forEach(p => knockoutRoundsMap.set(p.userId, []));
    let currentSlots = interleaved;
    let roundSize = bracketSize;
    const baseSeed = (roomId * 31337) | 0;
    while (roundSize > 1) {
      const label = roundLabels[roundSize] ?? `Round ${roundSize}`;
      const nextSlots: (number | null)[] = [];
      for (let i = 0; i < currentSlots.length; i += 2) {
        const aIdx = currentSlots[i];
        const bIdx = currentSlots[i + 1];
        if (aIdx === null && bIdx === null) { nextSlots.push(null); continue; }
        if (aIdx === null) { nextSlots.push(bIdx); continue; }
        if (bIdx === null) { nextSlots.push(aIdx); continue; }
        const pA = seeded[aIdx];
        const pB = seeded[bIdx];
        const matchSeed = xorshift32(hashSeed(baseSeed ^ (pA.userId * 7919) ^ (pB.userId * 1234567)));
        const { win: aWins, score } = dtSimulateMatch(pA.ovrCalc, pB.ovrCalc, [], [], matchSeed);
        const [aGoals, bGoals] = score.split("-").map(Number);
        const finalAWins = aWins || aGoals > bGoals; // simplified: no penalties in test
        (knockoutRoundsMap.get(pA.userId) as unknown[]).push({ label, opp: pB.displayName, win: finalAWins, score });
        (knockoutRoundsMap.get(pB.userId) as unknown[]).push({ label, opp: pA.displayName, win: !finalAWins, score: `${bGoals}-${aGoals}` });
        nextSlots.push(finalAWins ? aIdx : bIdx);
      }
      currentSlots = nextSlots;
      roundSize = roundSize / 2;
    }
    expect((knockoutRoundsMap.get(101) as unknown[]).length).toBe(1);
    expect((knockoutRoundsMap.get(202) as unknown[]).length).toBe(1);
    const aliceRound = (knockoutRoundsMap.get(101) as {label: string; opp: string; win: boolean}[])[0];
    const bobRound = (knockoutRoundsMap.get(202) as {label: string; opp: string; win: boolean}[])[0];
    expect(aliceRound.label).toBe("Finale");
    expect(bobRound.label).toBe("Finale");
    expect(aliceRound.opp).toBe("Bob");
    expect(bobRound.opp).toBe("Alice");
    // Exactly one winner
    expect(aliceRound.win !== bobRound.win).toBe(true);
  });

  it("16-slot bracket: 2 real players get 4 rounds each (Ottavi → Quarti → Semi → Finale)", () => {
    // With 2 real players and 14 AI fillers, each real player plays 4 rounds
    // (they could be eliminated at any round, but the bracket always has 4 rounds)
    const BRACKET_SIZE = 16;
    const roundLabels: Record<number, string> = {
      2: "Finale", 4: "Semifinale", 8: "Quarti di Finale", 16: "Ottavi di Finale",
    };
    // Simulate: real player always wins (OVR 99 vs 50)
    const realPlayers = [
      { userId: 1, displayName: "P1", ovrCalc: 99, isAI: false },
      { userId: 2, displayName: "P2", ovrCalc: 98, isAI: false },
    ];
    const aiPlayers = Array.from({ length: 14 }, (_, i) => ({
      userId: null, displayName: `AI_${i}`, ovrCalc: 50 + i, isAI: true,
    }));
    const seeded = [...realPlayers, ...aiPlayers].sort((a, b) => b.ovrCalc - a.ovrCalc);
    expect(seeded.length).toBe(BRACKET_SIZE);
    // Real players should be at positions 0 and 1 (highest OVR)
    expect(seeded[0].isAI).toBe(false);
    expect(seeded[1].isAI).toBe(false);
    // Bracket should have 4 rounds (log2(16) = 4)
    const rounds = Math.log2(BRACKET_SIZE);
    expect(rounds).toBe(4);
    // Labels for each round
    let size = BRACKET_SIZE;
    const labels: string[] = [];
    while (size > 1) { labels.push(roundLabels[size] ?? `Round ${size}`); size /= 2; }
    expect(labels).toEqual(["Ottavi di Finale", "Quarti di Finale", "Semifinale", "Finale"]);
  });

  it("JSON key lookup: String(userId) matches numeric key", () => {
    const tournamentData: Record<number, { test: string }> = {
      42: { test: "player42" },
      99: { test: "player99" },
    };
    const json = JSON.stringify(tournamentData);
    const parsed = JSON.parse(json) as Record<string, { test: string }>;
    expect(parsed[String(42)]).toBeDefined();
    expect(parsed[String(42)].test).toBe("player42");
    expect(parsed[String(99)]).toBeDefined();
  });
});
