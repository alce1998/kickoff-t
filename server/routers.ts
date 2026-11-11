import { COOKIE_NAME } from "@shared/const";
import { achievementsRouter } from "./routers/achievements";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import { leaderboard, gameScores, friendRequests, friendships, asyncChallenges, challengeTurns, users, matchmakingQueue, cartolinesProgress, cartolinesPoints, dreamTeamRooms, dreamTeamRoomPlayers } from "../drizzle/schema";
import { and, eq, desc, sql } from "drizzle-orm";
import { getDb } from "./db";
import { ENV } from "./_core/env";

// Email configuration
const RECIPIENT_EMAIL = "alessandro.centra10401@manus.bot";

// ─── Dream Team server-side tournament generation ─────────────────────────────
interface DTPlayer { name: string; role: string; roles?: string[]; nat: string; ovr: number; }
interface DTTeam { id: string; name: string; season: string; coach: string; color: string; badge: string; description: string; overall: number; players: DTPlayer[]; }

// xorshift32 — much better statistical properties than LCG
function xorshift32(s: number): number {
  let x = s | 0;
  if (x === 0) x = 1;
  x ^= x << 13;
  x ^= x >> 17;
  x ^= x << 5;
  return x | 0;
}

// Mix hash for initial seed (avalanche effect)
function hashSeed(s: number): number {
  let x = s | 0;
  x = (((x >>> 16) ^ x) * 0x45d9f3b) | 0;
  x = (((x >>> 16) ^ x) * 0x45d9f3b) | 0;
  x = ((x >>> 16) ^ x) | 0;
  return x || 1;
}

function dtShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = hashSeed(seed);
  for (let i = a.length - 1; i > 0; i--) {
    s = xorshift32(s);
    const j = (s >>> 0) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function dtRand(seed: number): number {
  const s = xorshift32(hashSeed(seed));
  return (s >>> 0) / 0xffffffff;
}

function dtSimulateMatch(myOvr: number, oppOvr: number, myPlayers: DTPlayer[], _oppPlayers: DTPlayer[], seed: number) {
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
  const scorers: string[] = [];
  const fwPlayers = myPlayers.filter(p => p.role === "FW" || (p.roles && (p.roles.includes("ST") || p.roles.includes("CF") || p.roles.includes("LW") || p.roles.includes("RW"))));
  const mfPlayers = myPlayers.filter(p => p.role === "MF");
  const dfPlayers = myPlayers.filter(p => p.role === "DF");
  // I portieri non segnano mai
  const allScorers = [...fwPlayers, ...fwPlayers, ...mfPlayers, ...dfPlayers];
  for (let i = 0; i < myGoals; i++) {
    const scorer = allScorers[Math.floor(nextR() * allScorers.length)];
    if (scorer) scorers.push(scorer.name.split(" ").pop() || scorer.name);
  }
  return { win, draw, score: `${myGoals}-${oppGoals}`, scorers, oppGoals: oppGoals as number, myGoals: myGoals as number };
}

function dtSimulatePenalties(seed: number): { win: boolean; myPens: number; oppPens: number; sequence: {isHome: boolean; scored: boolean}[] } {
  let s = hashSeed(seed);
  const nextR = () => { s = xorshift32(s); return (s >>> 0) / 0xffffffff; };
  let myPens = 0, oppPens = 0;
  const sequence: {isHome: boolean; scored: boolean}[] = [];
  for (let i = 0; i < 5; i++) {
    const ms = nextR() < 0.75; if (ms) myPens++; sequence.push({isHome: true, scored: ms});
    const os = nextR() < 0.75; if (os) oppPens++; sequence.push({isHome: false, scored: os});
  }
  let round = 0;
  while (myPens === oppPens && round < 10) {
    const ms = nextR() < 0.75; if (ms) myPens++; sequence.push({isHome: true, scored: ms});
    const os = nextR() < 0.75; if (os) oppPens++; sequence.push({isHome: false, scored: os});
    round++;
  }
  return { win: myPens > oppPens, myPens, oppPens, sequence };
}

function dtLoadTeams(): DTTeam[] {
  try {
    const dbPath = path.join(process.cwd(), "client", "public", "dreamteam_db.d7d8b7b0.json");
    const raw = fs.readFileSync(dbPath, "utf-8");
    return JSON.parse(raw).teams as DTTeam[];
  } catch { return []; }
}

function dtNextSeed(s: number): number {
  return xorshift32(s);
}

function dtGenerateTournament(players: {userId: number; displayName: string; teamOverall: number; pickData: string | null}[], roomId: number): Record<number, unknown> {
  if (!players.length) return {};

  // ── Parse each player's squad ──────────────────────────────────────────────
  const squads = players.map(player => {
    const myPlayers: DTPlayer[] = [];
    try {
      const picks = JSON.parse(player.pickData || "[]") as {player: DTPlayer | null; fromTeam: string | null}[];
      picks.forEach(p => { if (p.player) myPlayers.push(p.player); });
    } catch { /* ignore */ }
    return { ...player, myPlayers, ovrCalc: player.teamOverall || 70 };
  });

  // ── Always use a 16-slot bracket; fill empty slots with AI teams from DB ──────
  const BRACKET_SIZE = 16;
  const roundLabels: Record<number, string> = {
    2: "Finale",
    4: "Semifinale",
    8: "Quarti di Finale",
    16: "Ottavi di Finale",
  };

  // Load AI filler teams from DB
  const allTeams = dtLoadTeams();
  const baseSeed = (roomId * 31337) | 0;

  // Build a unified participant list: real players first, then AI fillers
  // Each participant: { displayName, ovrCalc, myPlayers, userId (null for AI), isAI }
  type Participant = {
    displayName: string;
    ovrCalc: number;
    myPlayers: DTPlayer[];
    userId: number | null;
    isAI: boolean;
  };

  const realParticipants: Participant[] = squads.map(s => ({
    displayName: s.displayName,
    ovrCalc: s.ovrCalc,
    myPlayers: s.myPlayers,
    userId: s.userId,
    isAI: false,
  }));

  // Pick AI filler teams (exclude teams already used by real players)
  const usedTeamNames = new Set(squads.flatMap(s => s.myPlayers.map(p => p.name)));
  const availableAITeams = dtShuffle(
    allTeams.filter(t => !usedTeamNames.has(t.name)),
    baseSeed ^ 0xdeadbeef
  );
  const aiFillerCount = BRACKET_SIZE - realParticipants.length;
  const aiParticipants: Participant[] = availableAITeams.slice(0, aiFillerCount).map(team => ({
    displayName: team.name,
    ovrCalc: team.overall,
    myPlayers: team.players,
    userId: null,
    isAI: true,
  }));

  // Seed all 16 participants by OVR descending
  const seeded: Participant[] = [...realParticipants, ...aiParticipants]
    .sort((a, b) => b.ovrCalc - a.ovrCalc);

  // Interleave: 1st vs 16th, 2nd vs 15th, ...
  const interleaved: number[] = new Array(BRACKET_SIZE).fill(0);
  for (let i = 0; i < BRACKET_SIZE / 2; i++) {
    interleaved[i * 2] = i;
    interleaved[i * 2 + 1] = BRACKET_SIZE - 1 - i;
  }

  // For each real player, store their knockout rounds
  const knockoutRoundsMap: Map<number, unknown[]> = new Map();
  squads.forEach(p => knockoutRoundsMap.set(p.userId, []));

  // Simulate round by round
  let currentSlots: number[] = interleaved;
  let roundSize = BRACKET_SIZE;

  while (roundSize > 1) {
    const label = roundLabels[roundSize] ?? `Round ${roundSize}`;
    const nextSlots: number[] = [];
    for (let i = 0; i < currentSlots.length; i += 2) {
      const aIdx = currentSlots[i];
      const bIdx = currentSlots[i + 1];
      const playerA = seeded[aIdx];
      const playerB = seeded[bIdx];
      // Deterministic seed for this match
      // Use a stable numeric ID for AI teams (based on their index in seeded[])
      const idA = playerA.userId ?? -(aIdx + 1);
      const idB = playerB.userId ?? -(bIdx + 1);
      let matchSeed = dtNextSeed(baseSeed ^ (idA * 7919) ^ (idB * 1234567));
      const { win: aWins, draw, score, scorers: aScorers, oppGoals: bGoals, myGoals: aGoals } =
        dtSimulateMatch(playerA.ovrCalc, playerB.ovrCalc, playerA.myPlayers, playerB.myPlayers, matchSeed);
      matchSeed = dtNextSeed(matchSeed);
      // Compute oppScorers for B side
      const bScorers: string[] = [];
      for (let j = 0; j < bGoals; j++) {
        const p = playerB.myPlayers[Math.abs(dtNextSeed(matchSeed + j)) % Math.max(1, playerB.myPlayers.length)];
        if (p) bScorers.push(p.name.split(" ").pop() || p.name);
      }
      // Handle draw with penalties
      let finalAWins = aWins;
      let penalties: {myPens: number; oppPens: number; win: boolean; sequence: {isHome: boolean; scored: boolean}[]} | undefined;
      if (draw) {
        penalties = dtSimulatePenalties(dtNextSeed(matchSeed ^ 0xffff));
        finalAWins = penalties.win;
      }
      const reverseScore = `${bGoals}-${aGoals}`;
      const reversePenalties = penalties ? { myPens: penalties.oppPens, oppPens: penalties.myPens, win: !penalties.win, sequence: penalties.sequence.map(s => ({...s, isHome: !s.isHome})) } : undefined;
      // Record round only for real players
      if (!playerA.isAI && playerA.userId !== null) {
        (knockoutRoundsMap.get(playerA.userId) as unknown[]).push({
          label, opp: playerB.displayName, myOvr: playerA.ovrCalc, oppOvr: playerB.ovrCalc,
          win: finalAWins, score, scorers: aScorers, oppScorers: bScorers, penalties,
        });
      }
      if (!playerB.isAI && playerB.userId !== null) {
        (knockoutRoundsMap.get(playerB.userId) as unknown[]).push({
          label, opp: playerA.displayName, myOvr: playerB.ovrCalc, oppOvr: playerA.ovrCalc,
          win: !finalAWins, score: reverseScore, scorers: bScorers, oppScorers: aScorers, penalties: reversePenalties,
        });
      }
      // Advance winner
      nextSlots.push(finalAWins ? aIdx : bIdx);
    }
    currentSlots = nextSlots;
    roundSize = roundSize / 2;
  }

  // ── Build result map ───────────────────────────────────────────────────────
  const result: Record<number, unknown> = {};
  squads.forEach(player => {
    const rounds = (knockoutRoundsMap.get(player.userId) as unknown[]) ?? [];
    result[player.userId] = {
      groupMatches: [],   // no group phase in multiplayer
      groupPoints: 18,    // always qualified
      qualified: true,
      knockoutRounds: rounds,
    };
  });
  return result;
}

export const appRouter = router({
  system: systemRouter,
  achievements: achievementsRouter,
  
  // Leaderboard for Link and Progressione games
  leaderboard: router({
    // Save a new score
    saveScore: publicProcedure
      .input(z.object({
        gameType: z.enum(["link", "progressione"]),
        playerName: z.string().min(1).max(100),
        timeSeconds: z.number().int().positive(),
        competition: z.string().max(50),
        difficulty: z.string().max(20).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) {
          throw new Error("Database not available");
        }
        
        const result = await db.insert(leaderboard).values({
          gameType: input.gameType,
          playerName: input.playerName,
          timeSeconds: input.timeSeconds,
          competition: input.competition,
          difficulty: input.difficulty || null,
        });
        return { success: true, id: result[0].insertId };
      }),
    
    // Get top scores for a specific game type and competition
    getTopScores: publicProcedure
      .input(z.object({
        gameType: z.enum(["link", "progressione"]),
        competition: z.string().max(50),
        difficulty: z.string().max(20).optional(),
        limit: z.number().int().positive().default(10),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) {
          return [];
        }
        
        const conditions = [
          eq(leaderboard.gameType, input.gameType),
          eq(leaderboard.competition, input.competition),
        ];
        
        if (input.difficulty) {
          conditions.push(eq(leaderboard.difficulty, input.difficulty));
        }
        
        const results = await db
          .select()
          .from(leaderboard)
          .where(and(...conditions))
          .orderBy(leaderboard.timeSeconds)
          .limit(input.limit);
        
        return results;
      }),
    
    // Get Maratona record (best score)
    getMaratonaRecord: publicProcedure
      .query(async () => {
        const db = await getDb();
        if (!db) {
          throw new Error("Database connection failed");
        }
        
        const records = await db
          .select({
            playerName: users.name,
            score: gameScores.score
          })
          .from(gameScores)
          .innerJoin(users, eq(gameScores.userId, users.id))
          .where(and(
            eq(gameScores.gameType, "carriere"),
            eq(gameScores.difficulty, "maratona")
          ))
          .orderBy(desc(gameScores.score))
          .limit(1);
        
        if (records.length === 0) {
          return null;
        }
        
        return records[0];
      }),
  }),
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Feedback endpoint
  feedback: router({
    send: publicProcedure
      .input(z.object({
        message: z.string().min(1).max(5000),
      }))
      .mutation(async ({ input }) => {
        const { message } = input;
        
        // Check if SMTP credentials are configured
        const smtpHost = process.env.SMTP_HOST;
        const smtpPort = process.env.SMTP_PORT;
        const smtpUser = process.env.SMTP_USER;
        const smtpPass = process.env.SMTP_PASS;
        
        if (!smtpHost || !smtpUser || !smtpPass) {
          console.error("[Email] SMTP credentials not configured");
          return { success: false, error: "Email service not configured" };
        }
        
        try {
          const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: parseInt(smtpPort || "587"),
            secure: smtpPort === "465",
            auth: {
              user: smtpUser,
              pass: smtpPass,
            },
          });
          
          const subject = "Feedback - La Grande Partita del Passato";
          const body = `
Nuovo feedback ricevuto:

${message}

---
Inviato automaticamente da La Grande Partita del Passato
          `.trim();
          
          await transporter.sendMail({
            from: smtpUser,
            to: RECIPIENT_EMAIL,
            subject,
            text: body,
          });
          
          console.log("[Email] Feedback sent successfully");
          return { success: true };
        } catch (error) {
          console.error("[Email] Failed to send feedback:", error);
          return { success: false, error: "Failed to send email" };
        }
      }),
  }),
  
  // Error reporting endpoint
  report: router({
    sendError: publicProcedure
      .input(z.object({
        matchId: z.string(),
        homeTeam: z.string(),
        awayTeam: z.string(),
        date: z.string(),
        description: z.string(),
      }))
      .mutation(async ({ input }) => {
        const { matchId, homeTeam, awayTeam, date, description } = input;
        
        // Check if SMTP credentials are configured
        const smtpHost = process.env.SMTP_HOST;
        const smtpPort = process.env.SMTP_PORT;
        const smtpUser = process.env.SMTP_USER;
        const smtpPass = process.env.SMTP_PASS;
        
        if (!smtpHost || !smtpUser || !smtpPass) {
          console.error("[Email] SMTP credentials not configured");
          return { success: false, error: "Email service not configured" };
        }
        
        try {
          const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: parseInt(smtpPort || "587"),
            secure: smtpPort === "465",
            auth: {
              user: smtpUser,
              pass: smtpPass,
            },
          });
          
          const subject = `Segnalazione Errore: ${homeTeam} vs ${awayTeam} (${date})`;
          const body = `
Partita: ${homeTeam} vs ${awayTeam}
Data: ${date}
ID: ${matchId}

Descrizione Errore:
${description}

---
Inviato automaticamente da La Grande Partita del Passato
          `.trim();
          
          await transporter.sendMail({
            from: smtpUser,
            to: RECIPIENT_EMAIL,
            subject,
            text: body,
          });
          
          console.log(`[Email] Error report sent for match ${matchId}`);
          
          // Save to Google Drive
          try {
            const { execSync } = require('child_process');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const reportLine = `${timestamp} | ID: ${matchId} | ${homeTeam} vs ${awayTeam} (${date}) | ${description}\n`;
            
            // Append to errori_segnalati.txt on Google Drive
            execSync(
              `echo '${reportLine.replace(/'/g, "'\\''")}' >> /tmp/gdrive_report.txt && ` +
              `rclone copy /tmp/gdrive_report.txt "manus_google_drive:Calcio d'Inizio/errori_segnalati.txt" --config /home/ubuntu/.gdrive-rclone.ini --append`,
              { encoding: 'utf-8' }
            );
            
            console.log(`[Google Drive] Report saved for match ${matchId}`);
          } catch (driveError) {
            console.error('[Google Drive] Failed to save report:', driveError);
            // Non bloccare l'invio email se il salvataggio su Drive fallisce
          }
          
          return { success: true };
        } catch (error) {
          console.error("[Email] Failed to send:", error);
          return { success: false, error: "Failed to send email" };
        }
      }),
  }),

  // Donations - PayPal pool scraping
  donations: router({
    getProgress: publicProcedure
      .query(async () => {
        try {
          const response = await fetch('https://www.paypal.com/pools/c/9lCKCiF8hN');
          const html = await response.text();
          
          // Extract amount raised and goal from HTML
          // PayPal uses JSON-LD structured data
          const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
          if (jsonLdMatch) {
            const data = JSON.parse(jsonLdMatch[1]);
            const raised = parseFloat(data.amountRaised?.value || '0');
            const goal = parseFloat(data.targetAmount?.value || '1000');
            const currency = data.amountRaised?.currency || 'EUR';
            
            return {
              raised,
              goal,
              currency,
              percentage: Math.round((raised / goal) * 100),
            };
          }
          
          // Fallback: try to extract from meta tags or page content
          const raisedMatch = html.match(/"amountRaised"[^}]*"value"[^"]*"([0-9.]+)"/i);
          const goalMatch = html.match(/"targetAmount"[^}]*"value"[^"]*"([0-9.]+)"/i);
          
          if (raisedMatch && goalMatch) {
            const raised = parseFloat(raisedMatch[1]);
            const goal = parseFloat(goalMatch[1]);
            
            return {
              raised,
              goal,
              currency: 'EUR',
              percentage: Math.round((raised / goal) * 100),
            };
          }
          
          // Return default values if scraping fails
          return {
            raised: 0,
            goal: 1000,
            currency: 'EUR',
            percentage: 0,
          };
        } catch (error) {
          console.error('[Donations] Failed to fetch PayPal data:', error);
          // Return default values on error
          return {
            raised: 0,
            goal: 1000,
            currency: 'EUR',
            percentage: 0,
          };
        }
      }),
  }),
  
  // Game scores tracking for user profiles
  gameScores: router({
    // Save a new score (protected - requires authentication)
    saveScore: protectedProcedure
      .input(z.object({
        gameType: z.enum(["formazioni", "carriere", "link", "progressione"]),
        score: z.number().int(),
        timeSeconds: z.number().int().optional(),
        competition: z.string().max(50).optional(),
        difficulty: z.string().max(20).optional(),
        metadata: z.string().optional(), // JSON string with additional data
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) {
          throw new Error("Database not available");
        }
        
        // Per la modalità maratona, salva solo se il punteggio è migliore del precedente
        if (input.gameType === "carriere" && input.difficulty === "maratona") {
          const existingBest = await db
            .select({ score: gameScores.score })
            .from(gameScores)
            .where(and(
              eq(gameScores.userId, ctx.user.id),
              eq(gameScores.gameType, "carriere"),
              eq(gameScores.difficulty, "maratona")
            ))
            .orderBy(desc(gameScores.score))
            .limit(1);
          
          if (existingBest.length > 0 && existingBest[0].score >= input.score) {
            // Punteggio non migliore, non salvare
            return { success: true, id: null, improved: false, bestScore: existingBest[0].score };
          }
        }
        
        const result = await db.insert(gameScores).values({
          userId: ctx.user.id,
          gameType: input.gameType,
          score: input.score,
          timeSeconds: input.timeSeconds || null,
          competition: input.competition || null,
          difficulty: input.difficulty || null,
          metadata: input.metadata || null,
        });
        return { success: true, id: result[0].insertId, improved: true };
      }),
    
    // Get all scores for the current user
    getUserScores: protectedProcedure
      .input(z.object({
        gameType: z.enum(["formazioni", "carriere", "link", "progressione"]).optional(),
        limit: z.number().int().positive().default(50),
      }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) {
          throw new Error("Database not available");
        }
        
        const conditions = [eq(gameScores.userId, ctx.user.id)];
        if (input.gameType) {
          conditions.push(eq(gameScores.gameType, input.gameType));
        }
        
        const scores = await db
          .select()
          .from(gameScores)
          .where(and(...conditions))
          .orderBy(gameScores.createdAt)
          .limit(input.limit);
        
        return scores;
      }),
    
    // Get aggregated stats for the current user
    getUserStats: protectedProcedure
      .query(async ({ ctx }) => {
        const db = await getDb();
        if (!db) {
          throw new Error("Database not available");
        }
        
        const allScores = await db
          .select()
          .from(gameScores)
          .where(eq(gameScores.userId, ctx.user.id));
        
        // Group by game type and calculate stats
        const statsByGame: Record<string, {
          totalGames: number;
          bestScore: number;
          averageScore: number;
          bestTime: number | null;
          averageTime: number | null;
        }> = {};
        
        for (const score of allScores) {
          if (!statsByGame[score.gameType]) {
            statsByGame[score.gameType] = {
              totalGames: 0,
              bestScore: score.score,
              averageScore: 0,
              bestTime: score.timeSeconds,
              averageTime: null,
            };
          }
          
          const stats = statsByGame[score.gameType];
          stats.totalGames++;
          stats.bestScore = Math.max(stats.bestScore, score.score);
          
          if (score.timeSeconds !== null) {
            if (stats.bestTime === null || score.timeSeconds < stats.bestTime) {
              stats.bestTime = score.timeSeconds;
            }
          }
        }
        
        // Calculate averages
        for (const gameType in statsByGame) {
          const gameScoresFiltered = allScores.filter(s => s.gameType === gameType);
          const totalScore = gameScoresFiltered.reduce((sum, s) => sum + s.score, 0);
          statsByGame[gameType].averageScore = Math.round(totalScore / gameScoresFiltered.length);
          
          const timesFiltered = gameScoresFiltered.filter(s => s.timeSeconds !== null).map(s => s.timeSeconds!);
          if (timesFiltered.length > 0) {
            const totalTime = timesFiltered.reduce((sum, t) => sum + t, 0);
            statsByGame[gameType].averageTime = Math.round(totalTime / timesFiltered.length);
          }
        }
        
        return {
          totalGames: allScores.length,
          statsByGame,
        };
      }),
  }),

  // Friends system
  friends: router({    // Search users by name
    searchUsers: protectedProcedure
      .input(z.object({
        query: z.string().min(1).max(100),
      }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) {
          throw new Error("Database not available");
        }
        
        // Search users by name or email (case insensitive, exclude current user)
        const searchPattern = `%${input.query}%`;
        const foundUsers = await db
          .select({
            id: users.id,
            name: users.name,
              username: users.username,
            email: users.email,
          })
          .from(users)
          .limit(20);
        
        // Filter out current user and apply search pattern (case insensitive)
        const searchLower = input.query.toLowerCase();
        const filteredUsers = foundUsers.filter(u => 
          u.id !== ctx.user.id && 
          (u.name?.toLowerCase().includes(searchLower) || u.email?.toLowerCase().includes(searchLower))
        );
        
        return filteredUsers;
      }),
    
    // Send friend request
    sendFriendRequest: protectedProcedure
      .input(z.object({
        receiverId: z.number().int().positive(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) {
          throw new Error("Database not available");
        }
        
        // Check if already friends
        const existingFriendship = await db
          .select()
          .from(friendships)
          .where(
            and(
              eq(friendships.userId1, Math.min(ctx.user.id, input.receiverId)),
              eq(friendships.userId2, Math.max(ctx.user.id, input.receiverId))
            )
          )
          .limit(1);
        
        if (existingFriendship.length > 0) {
          throw new Error("Already friends");
        }
        
        // Check if request already exists
        const existingRequest = await db
          .select()
          .from(friendRequests)
          .where(
            and(
              eq(friendRequests.senderId, ctx.user.id),
              eq(friendRequests.receiverId, input.receiverId),
              eq(friendRequests.status, "pending")
            )
          )
          .limit(1);
        
        if (existingRequest.length > 0) {
          throw new Error("Request already sent");
        }
        
        // Create friend request
        const result = await db.insert(friendRequests).values({
          senderId: ctx.user.id,
          receiverId: input.receiverId,
          status: "pending",
        });
        
        return { success: true, id: result[0].insertId };
      }),
    
    // Accept friend request
    acceptFriendRequest: protectedProcedure
      .input(z.object({
        requestId: z.number().int().positive(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) {
          throw new Error("Database not available");
        }
        
        // Get request
        const request = await db
          .select()
          .from(friendRequests)
          .where(
            and(
              eq(friendRequests.id, input.requestId),
              eq(friendRequests.receiverId, ctx.user.id),
              eq(friendRequests.status, "pending")
            )
          )
          .limit(1);
        
        if (request.length === 0) {
          throw new Error("Request not found");
        }
        
        // Update request status
        await db
          .update(friendRequests)
          .set({ status: "accepted" })
          .where(eq(friendRequests.id, input.requestId));
        
        // Create friendship
        await db.insert(friendships).values({
          userId1: Math.min(ctx.user.id, request[0].senderId),
          userId2: Math.max(ctx.user.id, request[0].senderId),
        });
        
        return { success: true };
      }),
    
    // Reject friend request
    rejectFriendRequest: protectedProcedure
      .input(z.object({
        requestId: z.number().int().positive(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) {
          throw new Error("Database not available");
        }
        
        // Update request status
        await db
          .update(friendRequests)
          .set({ status: "rejected" })
          .where(
            and(
              eq(friendRequests.id, input.requestId),
              eq(friendRequests.receiverId, ctx.user.id)
            )
          );
        
        return { success: true };
      }),
    
    // Get friends list
    getFriends: protectedProcedure
      .query(async ({ ctx }) => {
        const db = await getDb();
        if (!db) {
          throw new Error("Database not available");
        }
        
        // Get all friendships where current user is involved
        const friendshipsList = await db
          .select()
          .from(friendships);
        
        // Filter friendships
        const filteredFriendships = friendshipsList.filter(
          f => f.userId1 === ctx.user.id || f.userId2 === ctx.user.id
        );
        
        // Get friend IDs
        const friendIds = filteredFriendships.map(f => 
          f.userId1 === ctx.user.id ? f.userId2 : f.userId1
        );
        
        // Get friend details
        const friendsDetails = await db
          .select({
            id: users.id,
            name: users.name,
              username: users.username,
            email: users.email,
            eloRating: users.eloRating,
          })
          .from(users);
        
        // Filter by friend IDs
        const friends = friendsDetails.filter(u => friendIds.includes(u.id));
        
        return friends;
      }),
    
    // Get pending friend requests (received)
    getPendingRequests: protectedProcedure
      .query(async ({ ctx }) => {
        const db = await getDb();
        if (!db) {
          throw new Error("Database not available");
        }
        
        // Get pending requests where current user is receiver
        const requests = await db
          .select()
          .from(friendRequests)
          .where(
            and(
              eq(friendRequests.receiverId, ctx.user.id),
              eq(friendRequests.status, "pending")
            )
          );
        
        // Get sender details
        const senderIds = requests.map(r => r.senderId);
        const sendersDetails = await db
          .select({
            id: users.id,
            name: users.name,
              username: users.username,
            email: users.email,
          })
          .from(users);
        
        // Filter by sender IDs
        const senders = sendersDetails.filter(u => senderIds.includes(u.id));
        
        // Combine requests with sender details
        const requestsWithSenders = requests.map(r => ({
          ...r,
          sender: senders.find(s => s.id === r.senderId),
        }));
        
        return requestsWithSenders;
      }),
    
    // Remove friend
    removeFriend: protectedProcedure
      .input(z.object({
        friendId: z.number().int().positive(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) {
          throw new Error("Database not available");
        }
        
        // Delete friendship (bidirectional)
        await db
          .delete(friendships)
          .where(
            and(
              eq(friendships.userId1, Math.min(ctx.user.id, input.friendId)),
              eq(friendships.userId2, Math.max(ctx.user.id, input.friendId))
            )
          );
        
        return { success: true };
      }),
  }),

  // Async challenges system for Formazioni game
  challenges: router({
    // Create a new challenge
    createChallenge: protectedProcedure
      .input(z.object({
        opponentId: z.number(),
        competition: z.string(),
        period: z.string(),
        matchData: z.string(),
        gameMode: z.enum(["standard", "rapid"]).default("standard"),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) {
          throw new Error("Database not available");
        }
        
        // Check if opponent is a friend
        const friendship = await db
          .select()
          .from(friendships)
          .where(
            and(
              eq(friendships.userId1, Math.min(ctx.user.id, input.opponentId)),
              eq(friendships.userId2, Math.max(ctx.user.id, input.opponentId))
            )
          )
          .limit(1);
        
        if (friendship.length === 0) {
          throw new Error("Can only challenge friends");
        }
        
        // Create challenge
        const isRapid = input.gameMode === "rapid";
        const result = await db.insert(asyncChallenges).values({
          challengerId: ctx.user.id,
          opponentId: input.opponentId,
          status: "pending",
          competition: input.competition,
          period: input.period,
          matchData: input.matchData,
          gameMode: input.gameMode,
          currentTurn: "opponent", // Opponent starts
          attemptsInCurrentTurn: 0,
          challengerLives: isRapid ? 0 : 5, // Rapid non usa vite
          opponentLives: isRapid ? 0 : 5,
          challengerHints: 5,
          opponentHints: 5,
          challengerScore: 0,
          opponentScore: 0,
          challengerTimeRemaining: isRapid ? 600 : null, // 10 minuti per Rapid
          opponentTimeRemaining: isRapid ? 600 : null,
          lastMoveAt: isRapid ? new Date() : null,
        });
        
        return { success: true, challengeId: result[0].insertId };
      }),
    
    // Accept challenge
    acceptChallenge: protectedProcedure
      .input(z.object({
        challengeId: z.number().int().positive(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) {
          throw new Error("Database not available");
        }
        
        // Update challenge status
        await db
          .update(asyncChallenges)
          .set({ status: "active" })
          .where(
            and(
              eq(asyncChallenges.id, input.challengeId),
              eq(asyncChallenges.opponentId, ctx.user.id),
              eq(asyncChallenges.status, "pending")
            )
          );
        
        return { success: true };
      }),
    
    // Reject challenge
    rejectChallenge: protectedProcedure
      .input(z.object({
        challengeId: z.number().int().positive(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) {
          throw new Error("Database not available");
        }
        
        // Update challenge status
        await db
          .update(asyncChallenges)
          .set({ status: "rejected" })
          .where(
            and(
              eq(asyncChallenges.id, input.challengeId),
              eq(asyncChallenges.opponentId, ctx.user.id),
              eq(asyncChallenges.status, "pending")
            )
          );
        
        return { success: true };
      }),
    
    // Submit a turn (guess a player)
    submitTurn: protectedProcedure
      .input(z.object({
        challengeId: z.number().int().positive(),
        playerName: z.string().max(100),
        isCorrect: z.boolean(),
        hintsUsed: z.number().int().min(0).default(0),
        matchCount: z.number().int().min(1).default(1), // Numero di giocatori trovati con questa risposta
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) {
          throw new Error("Database not available");
        }
        
        // Get challenge
        const challenges = await db
          .select()
          .from(asyncChallenges)
          .where(
            and(
              eq(asyncChallenges.id, input.challengeId),
              eq(asyncChallenges.status, "active")
            )
          )
          .limit(1);
        
        if (challenges.length === 0) {
          throw new Error("Challenge not found or not active");
        }
        
        const challenge = challenges[0];
        
        // Check if it's user's turn
        const isChallenger = challenge.challengerId === ctx.user.id;
        const isOpponent = challenge.opponentId === ctx.user.id;
        
        if (!isChallenger && !isOpponent) {
          throw new Error("Not a participant in this challenge");
        }
        
        const currentTurnUser = challenge.currentTurn === "challenger" ? "challenger" : "opponent";
        const userRole = isChallenger ? "challenger" : "opponent";
        
        if (currentTurnUser !== userRole) {
          throw new Error("Not your turn");
        }
        
        // Record turn
        await db.insert(challengeTurns).values({
          challengeId: input.challengeId,
          userId: ctx.user.id,
          playerName: input.playerName,
          isCorrect: input.isCorrect ? 1 : 0,
          hintsUsed: input.hintsUsed,
        });
        
        // Update challenge state
        const updates: any = {};
        
        if (input.isCorrect) {
          // Increment score by matchCount (es. "Silva" trova David Silva + Thiago Silva = +2)
          const pointsToAdd = input.matchCount || 1;
          if (isChallenger) {
            updates.challengerScore = challenge.challengerScore + pointsToAdd;
          } else {
            updates.opponentScore = challenge.opponentScore + pointsToAdd;
          }
        } else {
          // Decrement lives
          if (isChallenger) {
            updates.challengerLives = challenge.challengerLives - 1;
          } else {
            updates.opponentLives = challenge.opponentLives - 1;
          }
        }
        
        // Update hints con validazione limite 5 indizi
        if (input.hintsUsed > 0) {
          const currentHints = isChallenger ? challenge.challengerHints : challenge.opponentHints;
          const hintsUsedSoFar = 5 - currentHints; // Quanti indizi sono già stati usati
          
          // Verifica che non si superino i 5 indizi totali
          if (hintsUsedSoFar >= 5) {
            throw new Error("Hai già usato tutti i 5 indizi disponibili");
          }
          
          if (isChallenger) {
            updates.challengerHints = Math.max(0, challenge.challengerHints - input.hintsUsed);
          } else {
            updates.opponentHints = Math.max(0, challenge.opponentHints - input.hintsUsed);
          }
        }
        
        // Gestione turni: Standard (3 tentativi) vs Rapid (1 tentativo)
        const attemptsPerTurn = challenge.gameMode === "rapid" ? 1 : 3;
        const newAttempts = challenge.attemptsInCurrentTurn + 1;
        
        if (newAttempts >= attemptsPerTurn) {
          // Switch turn dopo 3 tentativi (standard) o 1 (rapid)
          updates.currentTurn = challenge.currentTurn === "challenger" ? "opponent" : "challenger";
          updates.attemptsInCurrentTurn = 0;
          
          // Per Rapid: aggiorna tempo rimanente
          if (challenge.gameMode === "rapid" && challenge.lastMoveAt) {
            const timeElapsed = Math.floor((Date.now() - new Date(challenge.lastMoveAt).getTime()) / 1000);
            if (isChallenger) {
              updates.challengerTimeRemaining = Math.max(0, (challenge.challengerTimeRemaining || 600) - timeElapsed);
            } else {
              updates.opponentTimeRemaining = Math.max(0, (challenge.opponentTimeRemaining || 600) - timeElapsed);
            }
          }
          updates.lastMoveAt = new Date();
        } else {
          // Incrementa contatore tentativi
          updates.attemptsInCurrentTurn = newAttempts;
        }
        
        // Check if game is over
        const challengerLives = isChallenger ? (updates.challengerLives ?? challenge.challengerLives) : challenge.challengerLives;
        const opponentLives = isOpponent ? (updates.opponentLives ?? challenge.opponentLives) : challenge.opponentLives;
        const challengerScore = updates.challengerScore ?? challenge.challengerScore;
        const opponentScore = updates.opponentScore ?? challenge.opponentScore;
        const challengerTime = updates.challengerTimeRemaining ?? challenge.challengerTimeRemaining ?? 600;
        const opponentTime = updates.opponentTimeRemaining ?? challenge.opponentTimeRemaining ?? 600;
        
        // Logica vittoria diversa per Standard vs Rapid
        if (challenge.gameMode === "rapid") {
          // Rapid: primo a 12 punti vince, o timeout
          const matchDataRapid = JSON.parse(challenge.matchData);
          const homePlayersCountRapid = matchDataRapid.match?.homeFormation?.players?.length || 11;
          const awayPlayersCountRapid = matchDataRapid.match?.awayFormation?.players?.length || 11;
          const totalPlayersRapid = homePlayersCountRapid + awayPlayersCountRapid;
          const totalGuessedRapid = challengerScore + opponentScore;

          if (challengerScore >= 12 || opponentTime <= 0) {
            updates.status = "completed";
            updates.winnerId = challenge.challengerId;
          } else if (opponentScore >= 12 || challengerTime <= 0) {
            updates.status = "completed";
            updates.winnerId = challenge.opponentId;
          } else if (totalGuessedRapid >= totalPlayersRapid) {
            // Tutti i giocatori indovinati senza che nessuno abbia raggiunto 12 punti → pareggio
            updates.status = "completed";
            if (challengerScore > opponentScore) {
              updates.winnerId = challenge.challengerId;
            } else if (opponentScore > challengerScore) {
              updates.winnerId = challenge.opponentId;
            } else {
              // Pareggio (es. 11-11)
              updates.winnerId = null;
            }
          }
        } else {
          // Standard: vite esaurite o tutti i giocatori indovinati
          const matchData = JSON.parse(challenge.matchData);
          const homePlayersCount = matchData.match?.homeFormation?.players?.length || 11;
          const awayPlayersCount = matchData.match?.awayFormation?.players?.length || 11;
          const totalPlayers = homePlayersCount + awayPlayersCount;
          const totalGuessed = challengerScore + opponentScore;
          
          if (challengerLives <= 0 || opponentLives <= 0 || totalGuessed >= totalPlayers) {
            updates.status = "completed";
            // Determine winner
            if (challengerScore > opponentScore) {
              updates.winnerId = challenge.challengerId;
            } else if (opponentScore > challengerScore) {
              updates.winnerId = challenge.opponentId;
            } else {
              // Tie - no winner
              updates.winnerId = null;
            }
          }
        }
        
        // Update challenge
        await db
          .update(asyncChallenges)
          .set(updates)
          .where(eq(asyncChallenges.id, input.challengeId));
        
        // Calcola e aggiorna ELO se la partita è terminata
        let eloChange: number | null = null;
        let newEloRating: number | null = null;
        if (updates.status === "completed") {
          // Ottieni rating ELO correnti
          const [challengerData, opponentData] = await Promise.all([
            db.select({ eloRating: users.eloRating }).from(users).where(eq(users.id, challenge.challengerId)).limit(1),
            db.select({ eloRating: users.eloRating }).from(users).where(eq(users.id, challenge.opponentId)).limit(1),
          ]);
          
          const challengerElo = challengerData[0]?.eloRating || 1200;
          const opponentElo = opponentData[0]?.eloRating || 1200;
          
          // Calcola probabilità attesa (formula ELO)
          const expectedChallenger = 1 / (1 + Math.pow(10, (opponentElo - challengerElo) / 400));
          const expectedOpponent = 1 / (1 + Math.pow(10, (challengerElo - opponentElo) / 400));
          
          // Determina risultato (1 = vittoria, 0.5 = pareggio, 0 = sconfitta)
          let challengerResult = 0.5;
          let opponentResult = 0.5;
          if (updates.winnerId === challenge.challengerId) {
            challengerResult = 1;
            opponentResult = 0;
          } else if (updates.winnerId === challenge.opponentId) {
            challengerResult = 0;
            opponentResult = 1;
          }
          
          // Calcola nuovi rating (K = 32)
          const K = 32;
          const newChallengerElo = Math.round(challengerElo + K * (challengerResult - expectedChallenger));
          const newOpponentElo = Math.round(opponentElo + K * (opponentResult - expectedOpponent));
          
          const challengerEloChange = newChallengerElo - challengerElo;
          const opponentEloChange = newOpponentElo - opponentElo;

          // Aggiorna rating nel database e salva le variazioni ELO nella sfida
          await Promise.all([
            db.update(users).set({ eloRating: newChallengerElo }).where(eq(users.id, challenge.challengerId)),
            db.update(users).set({ eloRating: newOpponentElo }).where(eq(users.id, challenge.opponentId)),
            db.update(asyncChallenges).set({
              challengerEloChange,
              opponentEloChange,
              challengerNewElo: newChallengerElo,
              opponentNewElo: newOpponentElo,
            }).where(eq(asyncChallenges.id, challenge.id)),
          ]);

          // Restituisci variazione ELO per il giocatore corrente
          if (isChallenger) {
            eloChange = challengerEloChange;
            newEloRating = newChallengerElo;
          } else {
            eloChange = opponentEloChange;
            newEloRating = newOpponentElo;
          }
        }
        
        // Invia notifica all'avversario se il gioco non è finito
        if (updates.status !== "completed") {
          const opponentId = isChallenger ? challenge.opponentId : challenge.challengerId;
          const opponentDetails = await db
            .select({ name: users.name })
            .from(users)
            .where(eq(users.id, opponentId))
            .limit(1);
          
          if (opponentDetails.length > 0 && opponentId === parseInt(ENV.ownerOpenId || "0")) {
            // Invia notifica solo se l'avversario è l'owner del progetto
            const { notifyOwner } = await import("./_core/notification");
            await notifyOwner({
              title: "È il tuo turno!",
              content: `${ctx.user.name || "Un avversario"} ha completato il suo turno nella sfida Formazioni. Vai su https://kickoff-trivia.com/sfide per giocare!`,
            }).catch(err => console.error("Errore invio notifica:", err));
          }
        }
        
        return { 
          success: true, 
          gameOver: updates.status === "completed",
          winnerId: updates.winnerId,
          eloChange,
          newEloRating,
        };
      }),
    
    // Get challenge details
    getChallenge: protectedProcedure
      .input(z.object({
        challengeId: z.number().int().positive(),
      }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) {
          throw new Error("Database not available");
        }
        
        // Get challenge
        const challenges = await db
          .select()
          .from(asyncChallenges)
          .where(eq(asyncChallenges.id, input.challengeId))
          .limit(1);
        
        if (challenges.length === 0) {
          throw new Error("Challenge not found");
        }
        
        const challenge = challenges[0];
        
        // Check if user is a participant
        if (challenge.challengerId !== ctx.user.id && challenge.opponentId !== ctx.user.id) {
          throw new Error("Not a participant in this challenge");
        }
        
        // Check for abandonment (only for active challenges)
        if (challenge.status === 'active' && challenge.lastMoveAt) {
          const now = new Date();
          const lastMove = new Date(challenge.lastMoveAt);
          const minutesSinceLastMove = (now.getTime() - lastMove.getTime()) / 1000 / 60;
          
          // Timeout: 5 minuti per rapid, 24 ore per standard
          const timeoutMinutes = challenge.gameMode === 'rapid' ? 5 : 24 * 60;
          
          if (minutesSinceLastMove > timeoutMinutes) {
            // Abbandono rilevato: assegna vittoria all'altro giocatore
            const isChallenger = ctx.user.id === challenge.challengerId;
            const winnerId = isChallenger ? challenge.challengerId : challenge.opponentId;
            
            await db
              .update(asyncChallenges)
              .set({
                status: 'completed',
                winnerId: winnerId,
                updatedAt: now,
              })
              .where(eq(asyncChallenges.id, input.challengeId));
            
            // Aggiorna l'oggetto challenge locale
            challenge.status = 'completed';
            challenge.winnerId = winnerId;
          }
        }
        
        // Get turn history
        const turns = await db
          .select()
          .from(challengeTurns)
          .where(eq(challengeTurns.challengeId, input.challengeId));
        
        // Get opponent/challenger details
        const opponentId = challenge.challengerId === ctx.user.id ? challenge.opponentId : challenge.challengerId;
        const opponentDetails = await db
          .select({
            id: users.id,
            name: users.name,
              username: users.username,
          })
          .from(users)
          .where(eq(users.id, opponentId))
          .limit(1);
              // Calcola eloChange e newEloRating per l'utente corrente (se la partita è completata)
        let myEloChange: number | null = null;
        let myNewEloRating: number | null = null;
        if (challenge.status === 'completed') {
          const isChallenger = challenge.challengerId === ctx.user.id;
          if (isChallenger) {
            myEloChange = challenge.challengerEloChange ?? null;
            myNewEloRating = challenge.challengerNewElo ?? null;
          } else {
            myEloChange = challenge.opponentEloChange ?? null;
            myNewEloRating = challenge.opponentNewElo ?? null;
          }
        }

        return {
          ...challenge,
          turns,
          opponent: opponentDetails[0],
          eloChange: myEloChange,
          newEloRating: myNewEloRating,
        };
      }),
    
    // Get pending challengesfor current user
    getMyChallenges: protectedProcedure
      .query(async ({ ctx }) => {
        const db = await getDb();
        if (!db) {
          throw new Error("Database not available");
        }
        
        // Get all challenges where user is involved
        const allChallenges = await db
          .select()
          .from(asyncChallenges);
        
        // Filter challenges
        const myChallenges = allChallenges.filter(
          c => c.challengerId === ctx.user.id || c.opponentId === ctx.user.id
        );
        
        // Get opponent details for each challenge
        const challengesWithOpponents = await Promise.all(
          myChallenges.map(async (challenge) => {
            const opponentId = challenge.challengerId === ctx.user.id ? challenge.opponentId : challenge.challengerId;
            const opponentDetails = await db
              .select({
                id: users.id,
                name: users.name,
              username: users.username,
                eloRating: users.eloRating,
              })
              .from(users)
              .where(eq(users.id, opponentId))
              .limit(1);
            
            return {
              ...challenge,
              opponent: opponentDetails[0],
              isMyTurn: (
                (challenge.challengerId === ctx.user.id && challenge.currentTurn === "challenger") ||
                (challenge.opponentId === ctx.user.id && challenge.currentTurn === "opponent")
              ),
            };
          })
        );
        
        return challengesWithOpponents;
      }),
    
    // Get pending challenges (received)
    getPendingChallenges: protectedProcedure
      .query(async ({ ctx }) => {
        const db = await getDb();
        if (!db) {
          throw new Error("Database not available");
        }
        
        // Get pending challenges where current user is opponent
        const pendingChallenges = await db
          .select()
          .from(asyncChallenges)
          .where(
            and(
              eq(asyncChallenges.opponentId, ctx.user.id),
              eq(asyncChallenges.status, "pending")
            )
          );
        
        // Get challenger details
        const challengesWithChallengers = await Promise.all(
          pendingChallenges.map(async (challenge) => {
            const challengerDetails = await db
              .select({
                id: users.id,
                name: users.name,
              username: users.username,
              })
              .from(users)
              .where(eq(users.id, challenge.challengerId))
              .limit(1);
            
            return {
              ...challenge,
              challenger: challengerDetails[0],
            };
          })
        );
        
        return challengesWithChallengers;
      }),
    
    // Use hint in challenge
    useHint: protectedProcedure
      .input(z.object({
        challengeId: z.number().int().positive(),
        hintType: z.enum(["nationality", "number"]),
        team: z.enum(["home", "away"]),
        playerIndex: z.number().int().min(0),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) {
          throw new Error("Database not available");
        }
        
        // Get challenge
        const challenges = await db
          .select()
          .from(asyncChallenges)
          .where(eq(asyncChallenges.id, input.challengeId))
          .limit(1);
        
        if (challenges.length === 0) {
          throw new Error("Challenge not found");
        }
        
        const challenge = challenges[0];
        
        // Check if user is part of this challenge
        const isChallenger = challenge.challengerId === ctx.user.id;
        const isOpponent = challenge.opponentId === ctx.user.id;
        
        if (!isChallenger && !isOpponent) {
          throw new Error("Not authorized");
        }
        
        // Check if it's user's turn
        const currentTurnUser = challenge.currentTurn === "challenger" ? "challenger" : "opponent";
        const userRole = isChallenger ? "challenger" : "opponent";
        
        if (currentTurnUser !== userRole) {
          throw new Error("Not your turn");
        }
        
        // Check if user has hints remaining
        const currentHints = isChallenger ? challenge.challengerHints : challenge.opponentHints;
        
        if (currentHints <= 0) {
          throw new Error("No hints remaining");
        }
        
        // Decrement hints
        const updates: any = {};
        if (isChallenger) {
          updates.challengerHints = challenge.challengerHints - 1;
        } else {
          updates.opponentHints = challenge.opponentHints - 1;
        }
        
        // Update challenge
        await db
          .update(asyncChallenges)
          .set(updates)
          .where(eq(asyncChallenges.id, input.challengeId));
        
        return { 
          success: true,
          hintsRemaining: currentHints - 1,
        };
      }),
    
    // Forfeit challenge (abbandona partita)
    forfeitChallenge: protectedProcedure
      .input(z.object({
        challengeId: z.number().int().positive(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) {
          throw new Error("Database not available");
        }
        
        // Get challenge
        const challenges = await db
          .select()
          .from(asyncChallenges)
          .where(eq(asyncChallenges.id, input.challengeId))
          .limit(1);
        
        if (challenges.length === 0) {
          throw new Error("Challenge not found");
        }
        
        const challenge = challenges[0];
        
        // Check if user is part of this challenge
        const isChallenger = challenge.challengerId === ctx.user.id;
        const isOpponent = challenge.opponentId === ctx.user.id;
        
        if (!isChallenger && !isOpponent) {
          throw new Error("Not authorized");
        }
        
        // Check if challenge is still active
        if (challenge.status !== 'active') {
          throw new Error("Challenge is not active");
        }
        
        // Assign victory to opponent
        const winnerId = isChallenger ? challenge.opponentId : challenge.challengerId;
        
        // Update challenge
        await db
          .update(asyncChallenges)
          .set({
            status: 'completed',
            winnerId: winnerId,
            updatedAt: new Date(),
          })
          .where(eq(asyncChallenges.id, input.challengeId));
        
        // Update ELO ratings
        const challengerUser = await db
          .select()
          .from(users)
          .where(eq(users.id, challenge.challengerId))
          .limit(1);
        
        const opponentUser = await db
          .select()
          .from(users)
          .where(eq(users.id, challenge.opponentId!))
          .limit(1);
        
        if (challengerUser.length > 0 && opponentUser.length > 0) {
          const challengerElo = challengerUser[0].eloRating ?? 1200;
          const opponentElo = opponentUser[0].eloRating ?? 1200;
          
          // Calculate expected scores
          const expectedChallenger = 1 / (1 + Math.pow(10, (opponentElo - challengerElo) / 400));
          const expectedOpponent = 1 / (1 + Math.pow(10, (challengerElo - opponentElo) / 400));
          
          // Actual scores (winner gets 1, loser gets 0)
          const actualChallenger = winnerId === challenge.challengerId ? 1 : 0;
          const actualOpponent = winnerId === challenge.opponentId ? 1 : 0;
          
          // K-factor
          const K = 32;
          
          // Calculate new ratings
          const newChallengerElo = Math.round(challengerElo + K * (actualChallenger - expectedChallenger));
          const newOpponentElo = Math.round(opponentElo + K * (actualOpponent - expectedOpponent));
          
          // Update ratings
          await db
            .update(users)
            .set({ eloRating: newChallengerElo })
            .where(eq(users.id, challenge.challengerId));
          
          await db
            .update(users)
            .set({ eloRating: newOpponentElo })
            .where(eq(users.id, challenge.opponentId!));
        }
        
        return { 
          success: true,
          winnerId: winnerId,
        };
      }),
    
    // Time expired (tempo scaduto)
    timeExpired: protectedProcedure
      .input(z.object({
        challengeId: z.number().int().positive(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) {
          throw new Error("Database not available");
        }
        
        // Get challenge
        const challenges = await db
          .select()
          .from(asyncChallenges)
          .where(eq(asyncChallenges.id, input.challengeId))
          .limit(1);
        
        if (challenges.length === 0) {
          throw new Error("Challenge not found");
        }
        
        const challenge = challenges[0];
        
        // Check if user is part of this challenge
        const isChallenger = challenge.challengerId === ctx.user.id;
        const isOpponent = challenge.opponentId === ctx.user.id;
        
        if (!isChallenger && !isOpponent) {
          throw new Error("Not authorized");
        }
        
        // Check if challenge is still active
        if (challenge.status !== 'active') {
          throw new Error("Challenge is not active");
        }
        
        // Check if time has actually expired for the current user
        const myTimeRemaining = isChallenger ? challenge.challengerTimeRemaining : challenge.opponentTimeRemaining;
        
        if (myTimeRemaining === null || myTimeRemaining > 0) {
          throw new Error("Time has not expired");
        }
        
        // Assign victory to opponent (user who called this lost)
        const winnerId = isChallenger ? challenge.opponentId : challenge.challengerId;
        
        // Update challenge
        await db
          .update(asyncChallenges)
          .set({
            status: 'completed',
            winnerId: winnerId,
            updatedAt: new Date(),
          })
          .where(eq(asyncChallenges.id, input.challengeId));
        
        // Update ELO ratings
        const challengerUser = await db
          .select()
          .from(users)
          .where(eq(users.id, challenge.challengerId))
          .limit(1);
        
        const opponentUser = await db
          .select()
          .from(users)
          .where(eq(users.id, challenge.opponentId!))
          .limit(1);
        
        if (challengerUser.length > 0 && opponentUser.length > 0) {
          const challengerElo = challengerUser[0].eloRating ?? 1200;
          const opponentElo = opponentUser[0].eloRating ?? 1200;
          
          // Calculate expected scores
          const expectedChallenger = 1 / (1 + Math.pow(10, (opponentElo - challengerElo) / 400));
          const expectedOpponent = 1 / (1 + Math.pow(10, (challengerElo - opponentElo) / 400));
          
          // Actual scores (winner gets 1, loser gets 0)
          const actualChallenger = winnerId === challenge.challengerId ? 1 : 0;
          const actualOpponent = winnerId === challenge.opponentId ? 1 : 0;
          
          // K-factor
          const K = 32;
          
          // Calculate new ratings
          const newChallengerElo = Math.round(challengerElo + K * (actualChallenger - expectedChallenger));
          const newOpponentElo = Math.round(opponentElo + K * (actualOpponent - expectedOpponent));
          
          // Update ratings
          await db
            .update(users)
            .set({ eloRating: newChallengerElo })
            .where(eq(users.id, challenge.challengerId));
          
          await db
            .update(users)
            .set({ eloRating: newOpponentElo })
            .where(eq(users.id, challenge.opponentId!));
        }
        
        return { 
          success: true,
          winnerId: winnerId,
        };
      }),
    
    // Delete challenge
    deleteChallenge: protectedProcedure
      .input(z.object({
        challengeId: z.number().int().positive(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) {
          throw new Error("Database not available");
        }
        
        // Get challenge to verify ownership
        const challenges = await db
          .select()
          .from(asyncChallenges)
          .where(eq(asyncChallenges.id, input.challengeId))
          .limit(1);
        
        if (challenges.length === 0) {
          throw new Error("Challenge not found");
        }
        
        const challenge = challenges[0];
        
        // Only challenger or opponent can delete
        if (challenge.challengerId !== ctx.user.id && challenge.opponentId !== ctx.user.id) {
          throw new Error("Not authorized to delete this challenge");
        }
        
        // Delete challenge turns first (foreign key)
        await db
          .delete(challengeTurns)
          .where(eq(challengeTurns.challengeId, input.challengeId));
        
        // Delete challenge
        await db
          .delete(asyncChallenges)
          .where(eq(asyncChallenges.id, input.challengeId));
        
        return { success: true };
      }),
    
    // Matchmaking for Live mode
    enterMatchmaking: protectedProcedure
      .input(z.object({
        timeLimit: z.number().int().positive(), // Tempo in secondi (180, 300, 600, 1200, 1800)
        competition: z.string().max(50), // Campionato selezionato
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) {
          throw new Error("Database not available");
        }
        
        // Cancel any existing searches for this user
        await db
          .update(matchmakingQueue)
          .set({ status: "cancelled" })
          .where(and(
            eq(matchmakingQueue.userId, ctx.user.id),
            eq(matchmakingQueue.status, "searching")
          ));
        
        // Add user to matchmaking queue
        const result = await db.insert(matchmakingQueue).values({
          userId: ctx.user.id,
          timeLimit: input.timeLimit,
          competition: input.competition,
          status: "searching",
        });
        
        return { success: true, queueId: result[0].insertId };
      }),
    
    checkMatchmaking: protectedProcedure
      .input(z.object({
        queueId: z.number().int().positive(),
      }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) {
          throw new Error("Database not available");
        }
        
        // Get queue entry
        const entries = await db
          .select()
          .from(matchmakingQueue)
          .where(eq(matchmakingQueue.id, input.queueId))
          .limit(1);
        
        if (entries.length === 0) {
          throw new Error("Queue entry not found");
        }
        
        const entry = entries[0];
        
        if (entry.status === "matched") {
          return { matched: true, challengeId: entry.matchedChallengeId };
        }
        
        if (entry.status === "cancelled") {
          return { matched: false, cancelled: true };
        }
        
        // Try to find a match con stesso tempo E stesso campionato
        const opponents = await db
          .select()
          .from(matchmakingQueue)
          .where(and(
            eq(matchmakingQueue.timeLimit, entry.timeLimit),
            eq(matchmakingQueue.competition, entry.competition), // Stesso campionato
            eq(matchmakingQueue.status, "searching")
          ))
          .limit(10);
        
        // Find first opponent that is not the current user
        const opponent = opponents.find(o => o.userId !== ctx.user.id);
        
        if (opponent) {
          // Create Live challenge with random match from selected competition
          const fs = await import('fs');
          const path = await import('path');
          
          // Carica file partite
          const matchesPath = path.join(process.cwd(), 'client/src/data/matches_verified_100.json');
          const matchesData = JSON.parse(fs.readFileSync(matchesPath, 'utf-8'));
          
          // Filtra per campionato selezionato
          let filteredMatches = matchesData.filter((match: any) => {
            const comp = (match.competition || '').toLowerCase();
            
            switch (entry.competition) {
              case 'serie-a':
                return comp.includes('serie a');
              case 'premier-league':
                return comp.includes('premier league');
              case 'la-liga':
                return comp.includes('la liga') || comp.includes('liga');
              case 'ligue-1':
                return comp.includes('ligue 1');
              case 'bundesliga':
                return comp.includes('bundesliga');
              case 'international':
                return comp.includes('world cup') || comp.includes('euro') || comp.includes('international') || comp.includes('mondiali') || comp.includes('europei');
              case 'european-cups':
                return comp.includes('champions') || comp.includes('europa') || comp.includes('uefa');
              default:
                return true;
            }
          });
          
          // Seleziona partita random
          if (filteredMatches.length === 0) {
            throw new Error(`Nessuna partita disponibile per il campionato ${entry.competition}`);
          }
          
          const randomMatch = filteredMatches[Math.floor(Math.random() * filteredMatches.length)];
          const matchData = JSON.stringify({ match: randomMatch });
          
          const challengeResult = await db.insert(asyncChallenges).values({
            challengerId: ctx.user.id,
            opponentId: opponent.userId,
            status: "active",
            competition: entry.competition, // Campionato selezionato
            period: "all",
            matchData,
            gameMode: "rapid",
            currentTurn: "challenger",
            attemptsInCurrentTurn: 0,
            challengerLives: 0,
            opponentLives: 0,
            challengerHints: 5,
            opponentHints: 5,
            challengerScore: 0,
            opponentScore: 0,
            challengerTimeRemaining: entry.timeLimit,
            opponentTimeRemaining: entry.timeLimit,
            lastMoveAt: new Date(),
          });
          
          const challengeId = challengeResult[0].insertId;
          
          // Update both queue entries
          await db
            .update(matchmakingQueue)
            .set({ status: "matched", matchedChallengeId: challengeId })
            .where(eq(matchmakingQueue.id, entry.id));
          
          await db
            .update(matchmakingQueue)
            .set({ status: "matched", matchedChallengeId: challengeId })
            .where(eq(matchmakingQueue.id, opponent.id));
          
          return { matched: true, challengeId };
        }
        
        return { matched: false };
      }),
    
    cancelMatchmaking: protectedProcedure
      .input(z.object({
        queueId: z.number().int().positive(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) {
          throw new Error("Database not available");
        }
        
        await db
          .update(matchmakingQueue)
          .set({ status: "cancelled" })
          .where(and(
            eq(matchmakingQueue.id, input.queueId),
            eq(matchmakingQueue.userId, ctx.user.id)
          ));
        
        return { success: true };
      }),
  }),
  
  // Global and Friends Leaderboards
  rankings: router({
    // Get global leaderboard (top 30 + user position)
    getGlobalLeaderboard: protectedProcedure
      .query(async ({ ctx }) => {
        const db = await getDb();
        if (!db) {
          throw new Error("Database not available");
        }
        
        // Get top 30 users by ELO rating
        const topUsers = await db
          .select({
            id: users.id,
            name: users.name,
            username: users.username,
            eloRating: users.eloRating,
          })
          .from(users)
          .orderBy(desc(users.eloRating))
          .limit(30);
        
        // Get current user's position
        const userRank = await db
          .select({
            rank: sql<number>`(SELECT COUNT(*) + 1 FROM users WHERE eloRating > ${ctx.user.eloRating})`,
            eloRating: users.eloRating,
          })
          .from(users)
          .where(eq(users.id, ctx.user.id))
          .limit(1);
        
        return {
          topUsers: topUsers.map((u, index) => ({
            ...u,
            rank: index + 1,
          })),
          currentUser: userRank[0] ? {
            id: ctx.user.id,
            name: ctx.user.name,
            eloRating: userRank[0].eloRating,
            rank: userRank[0].rank,
          } : null,
        };
      }),
    
    // Get friends leaderboard
    getFriendsLeaderboard: protectedProcedure
      .query(async ({ ctx }) => {
        const db = await getDb();
        if (!db) {
          throw new Error("Database not available");
        }
        
        // Get all friends of current user
        const friendIds = await db
          .select({
            friendId: sql<number>`CASE WHEN userId1 = ${ctx.user.id} THEN userId2 ELSE userId1 END`,
          })
          .from(friendships)
          .where(
            sql`userId1 = ${ctx.user.id} OR userId2 = ${ctx.user.id}`
          );
        
        if (friendIds.length === 0) {
          // No friends, return only current user
          return {
            friendsRanking: [{
              id: ctx.user.id,
              name: ctx.user.name,
              eloRating: ctx.user.eloRating,
              rank: 1,
            }],
          };
        }
        
        // Get friends + current user, sorted by ELO
        const allIds = [ctx.user.id, ...friendIds.map(f => f.friendId)];
        const friendsRanking = await db
          .select({
            id: users.id,
            name: users.name,
            username: users.username,
            eloRating: users.eloRating,
          })
          .from(users)
          .where(sql`id IN (${sql.join(allIds.map(id => sql`${id}`), sql`, `)})`)
          .orderBy(desc(users.eloRating));
        
        return {
          friendsRanking: friendsRanking.map((u, index) => ({
            ...u,
            rank: index + 1,
          })),
        };
      }),
  }),
  username: router({
    // Controlla disponibilità username
    checkAvailable: publicProcedure
      .input(z.object({ username: z.string().min(1).max(10) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { available: false };
        const normalized = input.username.trim().toLowerCase();
        const existing = await db.select({ id: users.id }).from(users)
          .where(eq(users.username, normalized)).limit(1);
        return { available: existing.length === 0 };
      }),

    // Imposta username per la prima volta (onboarding)
    setUsername: protectedProcedure
      .input(z.object({ username: z.string().min(2).max(10).regex(/^[a-zA-Z0-9_]+$/, "Solo lettere, numeri e underscore") }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database non disponibile");
        const normalized = input.username.trim().toLowerCase();
        // Controlla unicità
        const existing = await db.select({ id: users.id }).from(users)
          .where(eq(users.username, normalized)).limit(1);
        if (existing.length > 0) throw new Error("USERNAME_TAKEN");
        await db.update(users).set({ username: normalized }).where(eq(users.id, ctx.user.id));
        return { success: true, username: normalized };
      }),

    // Richiede cambio username: salva pendingUsername e invia email di conferma
    requestChange: protectedProcedure
      .input(z.object({ newUsername: z.string().min(2).max(10).regex(/^[a-zA-Z0-9_]+$/, "Solo lettere, numeri e underscore") }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database non disponibile");
        const normalized = input.newUsername.trim().toLowerCase();
        // Controlla unicità
        const existing = await db.select({ id: users.id }).from(users)
          .where(eq(users.username, normalized)).limit(1);
        if (existing.length > 0) throw new Error("USERNAME_TAKEN");
        // Genera token sicuro
        const crypto = await import("crypto");
        const token = crypto.randomBytes(32).toString("hex");
        const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 ore
        await db.update(users).set({
          pendingUsername: normalized,
          usernameChangeToken: token,
          usernameChangeTokenExpiry: expiry,
        }).where(eq(users.id, ctx.user.id));
        // Invia email di conferma
        const smtpHost = process.env.SMTP_HOST;
        const smtpPort = process.env.SMTP_PORT;
        const smtpUser = process.env.SMTP_USER;
        const smtpPass = process.env.SMTP_PASS;
        if (!smtpHost || !smtpUser || !smtpPass) {
          throw new Error("Email service not configured");
        }
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: parseInt(smtpPort || "587"),
          secure: smtpPort === "465",
          auth: { user: smtpUser, pass: smtpPass },
        });
        const confirmUrl = `https://kickoff-trivia.com/conferma-username/${token}`;
        await transporter.sendMail({
          from: smtpUser,
          to: ctx.user.email || smtpUser,
          subject: "Kickoff Trivia - Conferma cambio username",
          html: `
            <div style="font-family:monospace;max-width:500px;margin:0 auto;padding:20px;border:4px solid #000">
              <h1 style="color:#e91e8c;font-size:24px;text-transform:uppercase">Kickoff Trivia</h1>
              <p>Hai richiesto di cambiare il tuo username in: <strong>${normalized}</strong></p>
              <p>Clicca il link qui sotto per confermare il cambio (valido 24 ore):</p>
              <a href="${confirmUrl}" style="display:inline-block;background:#e91e8c;color:#fff;padding:12px 24px;text-decoration:none;font-weight:bold;border:3px solid #000;margin:16px 0">
                CONFERMA USERNAME
              </a>
              <p style="color:#666;font-size:12px">Se non hai richiesto questo cambio, ignora questa email.</p>
            </div>
          `,
        });
        return { success: true, email: ctx.user.email };
      }),

    // Conferma cambio username tramite token
    confirmChange: publicProcedure
      .input(z.object({ token: z.string().length(64) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database non disponibile");
        const result = await db.select().from(users)
          .where(eq(users.usernameChangeToken, input.token)).limit(1);
        if (result.length === 0) throw new Error("TOKEN_INVALID");
        const user = result[0];
        if (!user.usernameChangeTokenExpiry || user.usernameChangeTokenExpiry < new Date()) {
          throw new Error("TOKEN_EXPIRED");
        }
        if (!user.pendingUsername) throw new Error("NO_PENDING_USERNAME");
        // Controlla unicità ancora (potrebbe essere stato preso nel frattempo)
        const existing = await db.select({ id: users.id }).from(users)
          .where(eq(users.username, user.pendingUsername)).limit(1);
        if (existing.length > 0 && existing[0].id !== user.id) throw new Error("USERNAME_TAKEN");
        // Applica il cambio
        await db.update(users).set({
          username: user.pendingUsername,
          pendingUsername: null,
          usernameChangeToken: null,
          usernameChangeTokenExpiry: null,
        }).where(eq(users.id, user.id));
        return { success: true, username: user.pendingUsername };
      }),
  }),

  // Cartoline game
  cartoline: router({
    // Get all progress for current user
    getProgress: protectedProcedure
      .query(async ({ ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const progress = await db
          .select()
          .from(cartolinesProgress)
          .where(eq(cartolinesProgress.userId, ctx.user.id));
        const pointsRow = await db
          .select()
          .from(cartolinesPoints)
          .where(eq(cartolinesPoints.userId, ctx.user.id))
          .limit(1);
        return {
          progress,
          points: pointsRow[0]?.points ?? 0,
          totalEarned: pointsRow[0]?.totalEarned ?? 0,
        };
      }),

    // Solve a stadium (correct answer)
    solveStadium: protectedProcedure
      .input(z.object({ stadiumId: z.string().max(100) }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        // Check if already solved
        const existing = await db
          .select()
          .from(cartolinesProgress)
          .where(
            and(
              eq(cartolinesProgress.userId, ctx.user.id),
              eq(cartolinesProgress.stadiumId, input.stadiumId)
            )
          )
          .limit(1);
        if (existing.length > 0 && existing[0].solved === 1) {
          return { alreadySolved: true, points: 0 };
        }
        // Mark as solved
        if (existing.length > 0) {
          await db
            .update(cartolinesProgress)
            .set({ solved: 1, solvedAt: new Date() })
            .where(eq(cartolinesProgress.id, existing[0].id));
        } else {
          await db.insert(cartolinesProgress).values({
            userId: ctx.user.id,
            stadiumId: input.stadiumId,
            solved: 1,
            hintsUsed: JSON.stringify([]),
            solvedAt: new Date(),
          });
        }
        // Award 1 hint point
        const pointsRow = await db
          .select()
          .from(cartolinesPoints)
          .where(eq(cartolinesPoints.userId, ctx.user.id))
          .limit(1);
        if (pointsRow.length > 0) {
          await db
            .update(cartolinesPoints)
            .set({
              points: pointsRow[0].points + 1,
              totalEarned: pointsRow[0].totalEarned + 1,
            })
            .where(eq(cartolinesPoints.userId, ctx.user.id));
        } else {
          await db.insert(cartolinesPoints).values({
            userId: ctx.user.id,
            points: 1,
            totalEarned: 1,
          });
        }
        return { alreadySolved: false, points: 1 };
      }),

    // Use a hint (spend points)
    useHint: protectedProcedure
      .input(z.object({
        stadiumId: z.string().max(100),
        hintType: z.enum(["nome", "capienza", "anno"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        // Cost: nome=3, capienza=1, anno=1
        const cost = input.hintType === "nome" ? 3 : 1;
        // Check points
        const pointsRow = await db
          .select()
          .from(cartolinesPoints)
          .where(eq(cartolinesPoints.userId, ctx.user.id))
          .limit(1);
        const currentPoints = pointsRow[0]?.points ?? 0;
        if (currentPoints < cost) {
          throw new Error("INSUFFICIENT_POINTS");
        }
        // Deduct points
        if (pointsRow.length > 0) {
          await db
            .update(cartolinesPoints)
            .set({ points: currentPoints - cost })
            .where(eq(cartolinesPoints.userId, ctx.user.id));
        } else {
          await db.insert(cartolinesPoints).values({
            userId: ctx.user.id,
            points: -cost,
            totalEarned: 0,
          });
        }
        // Record hint used for this stadium
        const existing = await db
          .select()
          .from(cartolinesProgress)
          .where(
            and(
              eq(cartolinesProgress.userId, ctx.user.id),
              eq(cartolinesProgress.stadiumId, input.stadiumId)
            )
          )
          .limit(1);
        if (existing.length > 0) {
          const hints: string[] = JSON.parse(existing[0].hintsUsed ?? "[]");
          if (!hints.includes(input.hintType)) hints.push(input.hintType);
          await db
            .update(cartolinesProgress)
            .set({ hintsUsed: JSON.stringify(hints) })
            .where(eq(cartolinesProgress.id, existing[0].id));
        } else {
          await db.insert(cartolinesProgress).values({
            userId: ctx.user.id,
            stadiumId: input.stadiumId,
            solved: 0,
            hintsUsed: JSON.stringify([input.hintType]),
          });
        }
        return { success: true, newPoints: currentPoints - cost };
      }),
  }),
  // ─── Dream Team Multiplayer ──────────────────────────────────────────────────
  dreamTeam: router({
    // Create a new room
    createRoom: protectedProcedure
      .input(z.object({
        displayName: z.string().min(1).max(50),
        formation: z.string().max(20).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        // Generate unique 6-char code
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let code = "";
        for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
        const [room] = await db.insert(dreamTeamRooms).values({
          code,
          hostUserId: ctx.user.id,
          status: "lobby",
          formation: input.formation || null,
          maxPlayers: 16,
        });
        const roomId = room.insertId;
        await db.insert(dreamTeamRoomPlayers).values({
          roomId,
          userId: ctx.user.id,
          displayName: input.displayName,
          isReady: 0,
        });
        return { code, roomId };
      }),

    // Join an existing room
    joinRoom: protectedProcedure
      .input(z.object({
        code: z.string().length(6),
        displayName: z.string().min(1).max(50),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const [room] = await db.select().from(dreamTeamRooms).where(eq(dreamTeamRooms.code, input.code.toUpperCase()));
        if (!room) throw new Error("Stanza non trovata");
        if (room.status !== "lobby") throw new Error("La stanza non è più in fase di attesa");
        const players = await db.select().from(dreamTeamRoomPlayers).where(eq(dreamTeamRoomPlayers.roomId, room.id));
        if (players.length >= room.maxPlayers) throw new Error("Stanza piena");
        // Check if already in room
        const existing = players.find(p => p.userId === ctx.user.id);
        if (!existing) {
          await db.insert(dreamTeamRoomPlayers).values({
            roomId: room.id,
            userId: ctx.user.id,
            displayName: input.displayName,
            isReady: 0,
          });
        }
        return { roomId: room.id, code: room.code };
      }),

    // Get room state (polling)
    getRoom: publicProcedure
      .input(z.object({ code: z.string() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        const [room] = await db.select().from(dreamTeamRooms).where(eq(dreamTeamRooms.code, input.code.toUpperCase()));
        if (!room) return null;
        const players = await db.select({
          id: dreamTeamRoomPlayers.id,
          userId: dreamTeamRoomPlayers.userId,
          displayName: dreamTeamRoomPlayers.displayName,
          isReady: dreamTeamRoomPlayers.isReady,
          teamOverall: dreamTeamRoomPlayers.teamOverall,
          bracketSeed: dreamTeamRoomPlayers.bracketSeed,
          pickData: dreamTeamRoomPlayers.pickData,
        }).from(dreamTeamRoomPlayers).where(eq(dreamTeamRoomPlayers.roomId, room.id));
        return {
          id: room.id,
          code: room.code,
          status: room.status,
          formation: room.formation,
          hostUserId: room.hostUserId,
          maxPlayers: room.maxPlayers,
          tournamentData: room.tournamentData,
          players,
        };
      }),

    // Set formation (host only)
    setFormation: protectedProcedure
      .input(z.object({ code: z.string(), formation: z.string().max(20) }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const [room] = await db.select().from(dreamTeamRooms).where(eq(dreamTeamRooms.code, input.code.toUpperCase()));
        if (!room) throw new Error("Stanza non trovata");
        if (room.hostUserId !== ctx.user.id) throw new Error("Solo l'host può impostare il modulo");
        await db.update(dreamTeamRooms).set({ formation: input.formation }).where(eq(dreamTeamRooms.id, room.id));
        return { success: true };
      }),

    // Start picking phase (host only) — all players enter picking simultaneously
    startPicking: protectedProcedure
      .input(z.object({ code: z.string(), formation: z.string().max(20) }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const [room] = await db.select().from(dreamTeamRooms).where(eq(dreamTeamRooms.code, input.code.toUpperCase()));
        if (!room) throw new Error("Stanza non trovata");
        if (room.hostUserId !== ctx.user.id) throw new Error("Solo l'host può avviare il pick");
        if (room.status !== "lobby") throw new Error("La stanza non è in fase lobby");
        const players = await db.select().from(dreamTeamRoomPlayers).where(eq(dreamTeamRoomPlayers.roomId, room.id));
        if (players.length < 2) throw new Error("Servono almeno 2 giocatori");
        // Reset isReady for all players
        await db.update(dreamTeamRoomPlayers).set({ isReady: 0 }).where(eq(dreamTeamRoomPlayers.roomId, room.id));
        await db.update(dreamTeamRooms)
          .set({ status: "picking", formation: input.formation })
          .where(eq(dreamTeamRooms.id, room.id));
        return { success: true };
      }),

    // Mark player as ready (pick complete)
    setReady: protectedProcedure
      .input(z.object({
        code: z.string(),
        pickData: z.string(), // JSON
        teamOverall: z.number().int(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const [room] = await db.select().from(dreamTeamRooms).where(eq(dreamTeamRooms.code, input.code.toUpperCase()));
        if (!room) throw new Error("Stanza non trovata");
        await db.update(dreamTeamRoomPlayers)
          .set({ isReady: 1, pickData: input.pickData, teamOverall: input.teamOverall })
          .where(and(eq(dreamTeamRoomPlayers.roomId, room.id), eq(dreamTeamRoomPlayers.userId, ctx.user.id)));
        // Check if all players are ready → start tournament
        const players = await db.select().from(dreamTeamRoomPlayers).where(eq(dreamTeamRoomPlayers.roomId, room.id));
        const allReady = players.length >= 2 && players.every(p => p.isReady === 1);
        let tournamentDataStr: string | undefined;
        if (allReady) {
          // Assign bracket seeds by overall descending
          const sorted = [...players].sort((a, b) => (b.teamOverall ?? 0) - (a.teamOverall ?? 0));
          for (let i = 0; i < sorted.length; i++) {
            await db.update(dreamTeamRoomPlayers)
              .set({ bracketSeed: i + 1 })
              .where(eq(dreamTeamRoomPlayers.id, sorted[i].id));
          }
          // Generate tournament server-side (deterministic, same for all clients)
          const tournamentData = dtGenerateTournament(
            players.map(p => ({ userId: p.userId, displayName: p.displayName, teamOverall: p.teamOverall ?? 70, pickData: p.pickData })),
            room.id
          );
          const tournamentKeys = Object.keys(tournamentData);
          console.log(`[DreamTeam] Tournament generated for room ${room.id}: keys=${tournamentKeys.join(',')}, players=${players.map(p=>p.userId).join(',')}`);
          tournamentDataStr = JSON.stringify(tournamentData);
          await db.update(dreamTeamRooms)
            .set({ status: "tournament", tournamentData: tournamentDataStr })
            .where(eq(dreamTeamRooms.id, room.id));
        }
        return { success: true, allReady, tournamentData: tournamentDataStr, myUserId: ctx.user.id };
      }),

    // Save tournament result
    saveTournament: protectedProcedure
      .input(z.object({
        code: z.string(),
        tournamentData: z.string(), // JSON
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const [room] = await db.select().from(dreamTeamRooms).where(eq(dreamTeamRooms.code, input.code.toUpperCase()));
        if (!room) throw new Error("Stanza non trovata");
        if (room.hostUserId !== ctx.user.id) throw new Error("Solo l'host può salvare il torneo");
        await db.update(dreamTeamRooms)
          .set({ status: "finished", tournamentData: input.tournamentData })
          .where(eq(dreamTeamRooms.id, room.id));
        return { success: true };
      }),

    // Leave room
    leaveRoom: protectedProcedure
      .input(z.object({ code: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const [room] = await db.select().from(dreamTeamRooms).where(eq(dreamTeamRooms.code, input.code.toUpperCase()));
        if (!room) return { success: true };
        await db.delete(dreamTeamRoomPlayers)
          .where(and(eq(dreamTeamRoomPlayers.roomId, room.id), eq(dreamTeamRoomPlayers.userId, ctx.user.id)));
        return { success: true };
      }),

    // Segnala errore nella rosa di una squadra
    reportError: publicProcedure
      .input(z.object({
        teamName: z.string(),
        season: z.string(),
        description: z.string().min(3).max(1000),
      }))
      .mutation(async ({ input }) => {
        const smtpHost = process.env.SMTP_HOST;
        const smtpPort = process.env.SMTP_PORT;
        const smtpUser = process.env.SMTP_USER;
        const smtpPass = process.env.SMTP_PASS;

        if (!smtpHost || !smtpUser || !smtpPass) {
          console.error("[DreamTeam] SMTP not configured");
          return { success: false };
        }

        try {
          const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: parseInt(smtpPort || "587"),
            secure: smtpPort === "465",
            auth: { user: smtpUser, pass: smtpPass },
          });

          const subject = `[Dream Team] Segnalazione errore: ${input.teamName} ${input.season}`;
          const body = `
Segnalazione errore Dream Team
================================
Squadra: ${input.teamName}
Stagione: ${input.season}

Descrizione errore:
${input.description}

---
Inviato automaticamente da La Grande Partita del Passato
          `.trim();

          await transporter.sendMail({
            from: smtpUser,
            to: "Alessandro.centra10@gmail.com",
            subject,
            text: body,
          });

          console.log(`[DreamTeam] Error report sent for ${input.teamName} ${input.season}`);
          return { success: true };
        } catch (error) {
          console.error("[DreamTeam] Failed to send error report:", error);
          return { success: false };
        }
      }),
  }),
});
export type AppRouter = typeof appRouter;
