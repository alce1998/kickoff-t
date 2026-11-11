import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  eloRating: int("eloRating").default(1200).notNull(), // Rating ELO per partite live, default 1200
  /** Username scelto dall'utente (max 10 caratteri), visualizzato online. Null = non ancora scelto. */
  username: varchar("username", { length: 10 }).unique(),
  /** Username in attesa di conferma via email */
  pendingUsername: varchar("pendingUsername", { length: 10 }),
  /** Token per conferma cambio username via email */
  usernameChangeToken: varchar("usernameChangeToken", { length: 64 }),
  /** Scadenza token cambio username */
  usernameChangeTokenExpiry: timestamp("usernameChangeTokenExpiry"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Leaderboard table for Link and Progressione games
export const leaderboard = mysqlTable("leaderboard", {
  id: int("id").autoincrement().primaryKey(),
  gameType: mysqlEnum("gameType", ["link", "progressione"]).notNull(),
  playerName: varchar("playerName", { length: 100 }).notNull(),
  timeSeconds: int("timeSeconds").notNull(), // Tempo totale in secondi
  competition: varchar("competition", { length: 50 }).notNull(), // es. "serie-a", "premier-league"
  difficulty: varchar("difficulty", { length: 20 }), // "easy" o "hard" per Link, "height" o "age" per Progressione
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Leaderboard = typeof leaderboard.$inferSelect;
export type InsertLeaderboard = typeof leaderboard.$inferInsert;

// Game scores table for tracking user performance across all games
export const gameScores = mysqlTable("gameScores", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // Foreign key to users table
  gameType: mysqlEnum("gameType", ["formazioni", "carriere", "link", "progressione"]).notNull(),
  score: int("score").notNull(), // Punteggio (es. giocatori indovinati, tempo in secondi)
  timeSeconds: int("timeSeconds"), // Tempo impiegato (opzionale, per giochi a tempo)
  competition: varchar("competition", { length: 50 }), // Campionato (es. "serie-a")
  difficulty: varchar("difficulty", { length: 20 }), // Difficoltà o modalità (es. "hard", "height")
  metadata: text("metadata"), // JSON con dati aggiuntivi (es. {"hints_used": 2, "lives_remaining": 1})
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GameScore = typeof gameScores.$inferSelect;
export type InsertGameScore = typeof gameScores.$inferInsert;

// Friend requests table
export const friendRequests = mysqlTable("friendRequests", {
  id: int("id").autoincrement().primaryKey(),
  senderId: int("senderId").notNull(), // User who sent the request
  receiverId: int("receiverId").notNull(), // User who received the request
  status: mysqlEnum("status", ["pending", "accepted", "rejected"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FriendRequest = typeof friendRequests.$inferSelect;
export type InsertFriendRequest = typeof friendRequests.$inferInsert;

// Friendships table (accepted friend relationships)
export const friendships = mysqlTable("friendships", {
  id: int("id").autoincrement().primaryKey(),
  userId1: int("userId1").notNull(), // First user in friendship
  userId2: int("userId2").notNull(), // Second user in friendship
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Friendship = typeof friendships.$inferSelect;
export type InsertFriendship = typeof friendships.$inferInsert;

// Async challenges table for Formazioni game
export const asyncChallenges = mysqlTable("asyncChallenges", {
  id: int("id").autoincrement().primaryKey(),
  challengerId: int("challengerId").notNull(), // User who created the challenge
  opponentId: int("opponentId").notNull(), // User who was challenged
  status: mysqlEnum("status", ["pending", "active", "completed", "rejected"]).default("pending").notNull(),
  competition: varchar("competition", { length: 50 }).notNull(), // es. "serie-a"
  period: varchar("period", { length: 50 }).notNull(), // es. "2020-2024"
  matchData: text("matchData").notNull(), // JSON con dati partita (formazione, giocatori, ecc.)
  gameMode: mysqlEnum("gameMode", ["standard", "rapid"]).default("standard").notNull(), // Standard (asincrona) o Rapid (sincrona)
  currentTurn: mysqlEnum("currentTurn", ["challenger", "opponent"]).default("opponent").notNull(), // Inizia l'opponent
  attemptsInCurrentTurn: int("attemptsInCurrentTurn").default(0).notNull(), // Conta tentativi nel turno corrente (max 3 per standard)
  challengerLives: int("challengerLives").default(5).notNull(),
  opponentLives: int("opponentLives").default(5).notNull(),
  challengerHints: int("challengerHints").default(5).notNull(),
  opponentHints: int("opponentHints").default(5).notNull(),
  challengerScore: int("challengerScore").default(0).notNull(), // Giocatori indovinati
  opponentScore: int("opponentScore").default(0).notNull(),
  challengerTimeRemaining: int("challengerTimeRemaining").default(600), // Secondi rimanenti (600 = 10 min per Rapid, null per standard)
  opponentTimeRemaining: int("opponentTimeRemaining").default(600),
  lastMoveAt: timestamp("lastMoveAt"), // Timestamp ultima mossa (per calcolare tempo trascorso in Rapid)
  winnerId: int("winnerId"), // User ID del vincitore (null se in corso)
  challengerEloChange: int("challengerEloChange"), // Variazione ELO del challenger a fine partita
  opponentEloChange: int("opponentEloChange"), // Variazione ELO dell'opponent a fine partita
  challengerNewElo: int("challengerNewElo"), // Nuovo ELO del challenger a fine partita
  opponentNewElo: int("opponentNewElo"), // Nuovo ELO dell'opponent a fine partita
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AsyncChallenge = typeof asyncChallenges.$inferSelect;
export type InsertAsyncChallenge = typeof asyncChallenges.$inferInsert;

// Challenge turns table (history of moves)
export const challengeTurns = mysqlTable("challengeTurns", {
  id: int("id").autoincrement().primaryKey(),
  challengeId: int("challengeId").notNull(), // Foreign key to asyncChallenges
  userId: int("userId").notNull(), // User who made the move
  playerName: varchar("playerName", { length: 100 }).notNull(), // Nome giocatore indovinato/tentato
  isCorrect: int("isCorrect").notNull(), // 1 = corretto, 0 = sbagliato (boolean as int)
  hintsUsed: int("hintsUsed").default(0).notNull(), // Numero indizi usati in questo turno
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChallengeTurn = typeof challengeTurns.$inferSelect;
export type InsertChallengeTurn = typeof challengeTurns.$inferInsert;

// Matchmaking queue for Live mode
export const matchmakingQueue = mysqlTable("matchmakingQueue", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // User searching for match
  timeLimit: int("timeLimit").notNull(), // Tempo partita in secondi (180, 300, 600, 1200, 1800)
  competition: varchar("competition", { length: 50 }).notNull(), // Campionato selezionato (serie-a, premier-league, etc.)
  status: mysqlEnum("status", ["searching", "matched", "cancelled"]).default("searching").notNull(),
  matchedChallengeId: int("matchedChallengeId"), // ID sfida creata dopo match
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MatchmakingQueue = typeof matchmakingQueue.$inferSelect;
export type InsertMatchmakingQueue = typeof matchmakingQueue.$inferInsert;

// Cartoline game: progress per user per stadium
export const cartolinesProgress = mysqlTable("cartolinesProgress", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // Foreign key to users
  stadiumId: varchar("stadiumId", { length: 100 }).notNull(), // e.g. "camp-nou"
  solved: int("solved").default(0).notNull(), // 1 = solved, 0 = not yet
  hintsUsed: text("hintsUsed"), // JSON array of hint types used: ["nome","capienza","anno"]
  solvedAt: timestamp("solvedAt"), // When the stadium was solved
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CartolinesProgress = typeof cartolinesProgress.$inferSelect;
export type InsertCartolinesProgress = typeof cartolinesProgress.$inferInsert;

// Cartoline game: hint points balance per user
export const cartolinesPoints = mysqlTable("cartolinesPoints", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(), // One row per user
  points: int("points").default(0).notNull(), // Current hint points balance
  totalEarned: int("totalEarned").default(0).notNull(), // Lifetime points earned
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CartolinesPoints = typeof cartolinesPoints.$inferSelect;
export type InsertCartolinesPoints = typeof cartolinesPoints.$inferInsert;

// Dream Team multiplayer rooms
export const dreamTeamRooms = mysqlTable("dreamTeamRooms", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 8 }).notNull().unique(), // 6-char room code
  hostUserId: int("hostUserId").notNull(),
  status: mysqlEnum("status", ["lobby", "picking", "tournament", "finished"]).default("lobby").notNull(),
  formation: varchar("formation", { length: 20 }), // e.g. "4-3-3"
  maxPlayers: int("maxPlayers").default(16).notNull(),
  tournamentData: text("tournamentData"), // JSON with bracket results
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DreamTeamRoom = typeof dreamTeamRooms.$inferSelect;
export type InsertDreamTeamRoom = typeof dreamTeamRooms.$inferInsert;

// Dream Team multiplayer room participants
export const dreamTeamRoomPlayers = mysqlTable("dreamTeamRoomPlayers", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("roomId").notNull(),
  userId: int("userId").notNull(),
  displayName: varchar("displayName", { length: 50 }).notNull(),
  isReady: int("isReady").default(0).notNull(), // 1 = ready
  pickData: text("pickData"), // JSON: array of picked players
  teamOverall: int("teamOverall"), // calculated after pick
  bracketSeed: int("bracketSeed"), // position in bracket (1-16)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DreamTeamRoomPlayer = typeof dreamTeamRoomPlayers.$inferSelect;
export type InsertDreamTeamRoomPlayer = typeof dreamTeamRoomPlayers.$inferInsert;
// ─── Achievements / Trofei ─────────────────────────────────────────────────

/**
 * User achievement progress: tracks which tier (bronze/silver/gold) each user
 * has unlocked for each achievement.
 * achievementId: matches the ACHIEVEMENTS definition in shared/achievements.ts
 * tier: 1=bronze, 2=silver, 3=gold
 */
export const userAchievements = mysqlTable("userAchievements", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  achievementId: varchar("achievementId", { length: 64 }).notNull(), // e.g. "overthinker"
  tier: int("tier").notNull(), // 1=bronze, 2=silver, 3=gold
  unlockedAt: timestamp("unlockedAt").defaultNow().notNull(),
});

export type UserAchievement = typeof userAchievements.$inferSelect;
export type InsertUserAchievement = typeof userAchievements.$inferInsert;

// ─── User Stats (for achievement tracking) ────────────────────────────────────
/**
 * Per-user counters used to track achievement progress server-side.
 * One row per user (upserted on each relevant event).
 */
export const userStats = mysqlTable("userStats", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  /** Scout: total ranked online matches played */
  rankedMatchesPlayed: int("rankedMatchesPlayed").default(0).notNull(),
  /** Habitué: current consecutive login streak (days) */
  loginStreak: int("loginStreak").default(0).notNull(),
  /** Habitué: last login date as UTC ms timestamp (stored as seconds to fit in int) */
  lastLoginDate: int("lastLoginDate").default(0).notNull(),
  /** Poliglotta: JSON array of game types played (e.g. ["formazioni","link"]) */
  gamesPlayedSet: text("gamesPlayedSet").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type UserStats = typeof userStats.$inferSelect;
export type InsertUserStats = typeof userStats.$inferInsert;
