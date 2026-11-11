var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/_core/env.ts
var ENV;
var init_env = __esm({
  "server/_core/env.ts"() {
    "use strict";
    ENV = {
      appId: process.env.VITE_APP_ID || "kickoff-trivia",
      cookieSecret: process.env.JWT_SECRET || "kickoff-trivia-jwt-secret-change-in-prod",
      databaseUrl: process.env.DATABASE_URL ?? "",
      oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
      ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
      isProduction: process.env.NODE_ENV === "production",
      forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
      forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
      googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
      googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? ""
    };
  }
});

// server/_core/notification.ts
var notification_exports = {};
__export(notification_exports, {
  notifyOwner: () => notifyOwner
});
import { TRPCError as TRPCError2 } from "@trpc/server";
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError2({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError2({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}
var TITLE_MAX_LENGTH, CONTENT_MAX_LENGTH, trimValue, isNonEmptyString2, buildEndpointUrl, validatePayload;
var init_notification = __esm({
  "server/_core/notification.ts"() {
    "use strict";
    init_env();
    TITLE_MAX_LENGTH = 1200;
    CONTENT_MAX_LENGTH = 2e4;
    trimValue = (value) => value.trim();
    isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
    buildEndpointUrl = (baseUrl) => {
      const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
      return new URL(
        "webdevtoken.v1.WebDevService/SendNotification",
        normalizedBase
      ).toString();
    };
    validatePayload = (input) => {
      if (!isNonEmptyString2(input.title)) {
        throw new TRPCError2({
          code: "BAD_REQUEST",
          message: "Notification title is required."
        });
      }
      if (!isNonEmptyString2(input.content)) {
        throw new TRPCError2({
          code: "BAD_REQUEST",
          message: "Notification content is required."
        });
      }
      const title = trimValue(input.title);
      const content = trimValue(input.content);
      if (title.length > TITLE_MAX_LENGTH) {
        throw new TRPCError2({
          code: "BAD_REQUEST",
          message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
        });
      }
      if (content.length > CONTENT_MAX_LENGTH) {
        throw new TRPCError2({
          code: "BAD_REQUEST",
          message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
        });
      }
      return { title, content };
    };
  }
});

// server/_core/vercel-entry.ts
import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/_core/oauth.ts
import axios2 from "axios";
import crypto from "crypto";

// server/db.ts
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

// drizzle/schema.ts
import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
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
  eloRating: int("eloRating").default(1200).notNull(),
  // Rating ELO per partite live, default 1200
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
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var leaderboard = mysqlTable("leaderboard", {
  id: int("id").autoincrement().primaryKey(),
  gameType: mysqlEnum("gameType", ["link", "progressione"]).notNull(),
  playerName: varchar("playerName", { length: 100 }).notNull(),
  timeSeconds: int("timeSeconds").notNull(),
  // Tempo totale in secondi
  competition: varchar("competition", { length: 50 }).notNull(),
  // es. "serie-a", "premier-league"
  difficulty: varchar("difficulty", { length: 20 }),
  // "easy" o "hard" per Link, "height" o "age" per Progressione
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var gameScores = mysqlTable("gameScores", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // Foreign key to users table
  gameType: mysqlEnum("gameType", ["formazioni", "carriere", "link", "progressione"]).notNull(),
  score: int("score").notNull(),
  // Punteggio (es. giocatori indovinati, tempo in secondi)
  timeSeconds: int("timeSeconds"),
  // Tempo impiegato (opzionale, per giochi a tempo)
  competition: varchar("competition", { length: 50 }),
  // Campionato (es. "serie-a")
  difficulty: varchar("difficulty", { length: 20 }),
  // Difficoltà o modalità (es. "hard", "height")
  metadata: text("metadata"),
  // JSON con dati aggiuntivi (es. {"hints_used": 2, "lives_remaining": 1})
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var friendRequests = mysqlTable("friendRequests", {
  id: int("id").autoincrement().primaryKey(),
  senderId: int("senderId").notNull(),
  // User who sent the request
  receiverId: int("receiverId").notNull(),
  // User who received the request
  status: mysqlEnum("status", ["pending", "accepted", "rejected"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var friendships = mysqlTable("friendships", {
  id: int("id").autoincrement().primaryKey(),
  userId1: int("userId1").notNull(),
  // First user in friendship
  userId2: int("userId2").notNull(),
  // Second user in friendship
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var asyncChallenges = mysqlTable("asyncChallenges", {
  id: int("id").autoincrement().primaryKey(),
  challengerId: int("challengerId").notNull(),
  // User who created the challenge
  opponentId: int("opponentId").notNull(),
  // User who was challenged
  status: mysqlEnum("status", ["pending", "active", "completed", "rejected"]).default("pending").notNull(),
  competition: varchar("competition", { length: 50 }).notNull(),
  // es. "serie-a"
  period: varchar("period", { length: 50 }).notNull(),
  // es. "2020-2024"
  matchData: text("matchData").notNull(),
  // JSON con dati partita (formazione, giocatori, ecc.)
  gameMode: mysqlEnum("gameMode", ["standard", "rapid"]).default("standard").notNull(),
  // Standard (asincrona) o Rapid (sincrona)
  currentTurn: mysqlEnum("currentTurn", ["challenger", "opponent"]).default("opponent").notNull(),
  // Inizia l'opponent
  attemptsInCurrentTurn: int("attemptsInCurrentTurn").default(0).notNull(),
  // Conta tentativi nel turno corrente (max 3 per standard)
  challengerLives: int("challengerLives").default(5).notNull(),
  opponentLives: int("opponentLives").default(5).notNull(),
  challengerHints: int("challengerHints").default(5).notNull(),
  opponentHints: int("opponentHints").default(5).notNull(),
  challengerScore: int("challengerScore").default(0).notNull(),
  // Giocatori indovinati
  opponentScore: int("opponentScore").default(0).notNull(),
  challengerTimeRemaining: int("challengerTimeRemaining").default(600),
  // Secondi rimanenti (600 = 10 min per Rapid, null per standard)
  opponentTimeRemaining: int("opponentTimeRemaining").default(600),
  lastMoveAt: timestamp("lastMoveAt"),
  // Timestamp ultima mossa (per calcolare tempo trascorso in Rapid)
  winnerId: int("winnerId"),
  // User ID del vincitore (null se in corso)
  challengerEloChange: int("challengerEloChange"),
  // Variazione ELO del challenger a fine partita
  opponentEloChange: int("opponentEloChange"),
  // Variazione ELO dell'opponent a fine partita
  challengerNewElo: int("challengerNewElo"),
  // Nuovo ELO del challenger a fine partita
  opponentNewElo: int("opponentNewElo"),
  // Nuovo ELO dell'opponent a fine partita
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var challengeTurns = mysqlTable("challengeTurns", {
  id: int("id").autoincrement().primaryKey(),
  challengeId: int("challengeId").notNull(),
  // Foreign key to asyncChallenges
  userId: int("userId").notNull(),
  // User who made the move
  playerName: varchar("playerName", { length: 100 }).notNull(),
  // Nome giocatore indovinato/tentato
  isCorrect: int("isCorrect").notNull(),
  // 1 = corretto, 0 = sbagliato (boolean as int)
  hintsUsed: int("hintsUsed").default(0).notNull(),
  // Numero indizi usati in questo turno
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var matchmakingQueue = mysqlTable("matchmakingQueue", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // User searching for match
  timeLimit: int("timeLimit").notNull(),
  // Tempo partita in secondi (180, 300, 600, 1200, 1800)
  competition: varchar("competition", { length: 50 }).notNull(),
  // Campionato selezionato (serie-a, premier-league, etc.)
  status: mysqlEnum("status", ["searching", "matched", "cancelled"]).default("searching").notNull(),
  matchedChallengeId: int("matchedChallengeId"),
  // ID sfida creata dopo match
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var cartolinesProgress = mysqlTable("cartolinesProgress", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // Foreign key to users
  stadiumId: varchar("stadiumId", { length: 100 }).notNull(),
  // e.g. "camp-nou"
  solved: int("solved").default(0).notNull(),
  // 1 = solved, 0 = not yet
  hintsUsed: text("hintsUsed"),
  // JSON array of hint types used: ["nome","capienza","anno"]
  solvedAt: timestamp("solvedAt"),
  // When the stadium was solved
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var cartolinesPoints = mysqlTable("cartolinesPoints", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  // One row per user
  points: int("points").default(0).notNull(),
  // Current hint points balance
  totalEarned: int("totalEarned").default(0).notNull(),
  // Lifetime points earned
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var figurineProgress = mysqlTable("figurineProgress", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // Foreign key to users
  playerId: varchar("playerId", { length: 100 }).notNull(),
  // e.g. "5023"
  solved: int("solved").default(0).notNull(),
  // 1 = solved, 0 = not yet
  hintsUsed: text("hintsUsed"),
  // JSON array of hint types used: ["anno_ruolo","nazionalita_presenze","iniziali"]
  solvedAt: timestamp("solvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var figurinePoints = mysqlTable("figurinePoints", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  // One row per user
  points: int("points").default(0).notNull(),
  // Current hint points balance
  totalEarned: int("totalEarned").default(0).notNull(),
  // Lifetime points earned
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var dreamTeamRooms = mysqlTable("dreamTeamRooms", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 8 }).notNull().unique(),
  // 6-char room code
  hostUserId: int("hostUserId").notNull(),
  status: mysqlEnum("status", ["lobby", "picking", "tournament", "finished"]).default("lobby").notNull(),
  formation: varchar("formation", { length: 20 }),
  // e.g. "4-3-3"
  maxPlayers: int("maxPlayers").default(16).notNull(),
  tournamentData: text("tournamentData"),
  // JSON with bracket results
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var dreamTeamRoomPlayers = mysqlTable("dreamTeamRoomPlayers", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("roomId").notNull(),
  userId: int("userId").notNull(),
  displayName: varchar("displayName", { length: 50 }).notNull(),
  isReady: int("isReady").default(0).notNull(),
  // 1 = ready
  pickData: text("pickData"),
  // JSON: array of picked players
  teamOverall: int("teamOverall"),
  // calculated after pick
  bracketSeed: int("bracketSeed"),
  // position in bracket (1-16)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var userAchievements = mysqlTable("userAchievements", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  achievementId: varchar("achievementId", { length: 64 }).notNull(),
  // e.g. "overthinker"
  tier: int("tier").notNull(),
  // 1=bronze, 2=silver, 3=gold
  unlockedAt: timestamp("unlockedAt").defaultNow().notNull()
});
var userStats = mysqlTable("userStats", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});

// server/db.ts
init_env();
var _db = null;
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      let dbUrl = process.env.DATABASE_URL.trim();
      if (dbUrl.includes("tidbcloud.com") && !dbUrl.includes("ssl=")) {
        dbUrl += (dbUrl.includes("?") ? "&" : "?") + 'ssl={"rejectUnauthorized":true}';
      }
      _db = drizzle(dbUrl);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values = {
      openId: user.openId
    };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = /* @__PURE__ */ new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function getUserByEmail(email) {
  const db = await getDb();
  if (!db) {
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: isSecureRequest(req)
  };
}

// server/_core/oauth.ts
init_env();

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
  statusCode;
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
init_env();
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  client;
  decodeState(state) {
    const redirectUri = atob(state);
    return redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function getBaseUrl(req) {
  const proto = req.headers["x-forwarded-proto"]?.split(",")[0]?.trim() || req.protocol || "https";
  const host = req.headers["x-forwarded-host"]?.split(",")[0]?.trim() || req.get("host");
  return `${proto}://${host}`;
}
function renderLoginPage(errorMsg) {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Accedi \u2014 KickOff Italia</title>
  <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fce4ec;
      font-family: 'Space Mono', monospace;
      padding: 16px;
      color: #111;
    }
    .card {
      background: #fff;
      border: 4px solid #000;
      box-shadow: 8px 8px 0px 0px #000;
      max-width: 440px;
      width: 100%;
      padding: 32px 24px;
    }
    h1 {
      font-family: 'Oswald', sans-serif;
      font-size: 2rem;
      text-transform: uppercase;
      text-align: center;
      margin: 0 0 8px 0;
      color: #d81b60;
    }
    p.sub {
      text-align: center;
      font-size: 0.85rem;
      color: #555;
      margin: 0 0 24px 0;
      font-weight: 700;
    }
    .error {
      background: #ffebee;
      border: 2px solid #c62828;
      color: #c62828;
      padding: 10px 12px;
      font-size: 0.8rem;
      font-weight: 700;
      margin-bottom: 16px;
    }
    label {
      display: block;
      font-size: 0.8rem;
      font-weight: 700;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    input {
      width: 100%;
      padding: 12px;
      border: 3px solid #000;
      font-family: 'Space Mono', monospace;
      font-size: 0.95rem;
      margin-bottom: 18px;
      outline: none;
    }
    input:focus {
      border-color: #d81b60;
    }
    button {
      width: 100%;
      padding: 14px;
      background: #d81b60;
      color: #fff;
      border: 3px solid #000;
      box-shadow: 4px 4px 0px 0px #000;
      font-family: 'Oswald', sans-serif;
      font-size: 1.15rem;
      font-weight: 700;
      text-transform: uppercase;
      cursor: pointer;
      transition: transform 0.1s;
    }
    button:hover {
      background: #ad1457;
    }
    button:active {
      transform: translate(2px, 2px);
      box-shadow: 2px 2px 0px 0px #000;
    }
    .back {
      display: block;
      text-align: center;
      margin-top: 18px;
      font-size: 0.8rem;
      color: #333;
      text-decoration: none;
      font-weight: 700;
    }
    .back:hover {
      color: #d81b60;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>KickOff Italia</h1>
    <p class="sub">Accedi o crea il tuo profilo giocatore</p>
    ${errorMsg ? `<div class="error">${errorMsg}</div>` : ""}
    <form method="POST" action="/api/auth/login">
      <label for="name">Nome / Nickname</label>
      <input id="name" name="name" type="text" required maxlength="30" placeholder="Es. Roberto Baggio" />

      <label for="email">La tua Email</label>
      <input id="email" name="email" type="email" required maxlength="120" placeholder="nome@esempio.it" />

      <button type="submit">\u26BD Entra in Campo</button>
    </form>
    <a class="back" href="/">\u2190 Torna alla Home</a>
  </div>
</body>
</html>`;
}
function registerOAuthRoutes(app2) {
  app2.get("/api/auth/google", (req, res) => {
    if (!ENV.googleClientId || req.query.mode === "email") {
      res.status(200).setHeader("Content-Type", "text/html; charset=utf-8").send(renderLoginPage());
      return;
    }
    const redirectUri = `${getBaseUrl(req)}/api/oauth/callback`;
    const state = Buffer.from(redirectUri).toString("base64");
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", ENV.googleClientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("prompt", "select_account");
    res.redirect(302, url.toString());
  });
  app2.post("/api/auth/login", async (req, res) => {
    try {
      const rawEmail = String(req.body?.email || "").trim().toLowerCase();
      const rawName = String(req.body?.name || "").trim();
      if (!rawEmail || !rawEmail.includes("@") || !rawName) {
        res.status(400).setHeader("Content-Type", "text/html; charset=utf-8").send(renderLoginPage("Inserisci un nome e un indirizzo email validi."));
        return;
      }
      const existingByEmail = await getUserByEmail(rawEmail);
      const emailHash = crypto.createHash("sha256").update(rawEmail).digest("hex").slice(0, 24);
      const openId = existingByEmail?.openId || `user_${emailHash}`;
      const displayName = rawName || existingByEmail?.name || "Giocatore";
      await upsertUser({
        openId,
        name: displayName,
        email: rawEmail,
        loginMethod: existingByEmail?.loginMethod || "email",
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(openId, {
        name: displayName,
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[Auth] Direct login failed:", error);
      res.status(500).setHeader("Content-Type", "text/html; charset=utf-8").send(renderLoginPage("Errore durante l'accesso. Riprova tra qualche istante."));
    }
  });
  app2.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code) {
      res.status(400).json({ error: "code is required" });
      return;
    }
    try {
      if (ENV.googleClientId && ENV.googleClientSecret && !ENV.oAuthServerUrl) {
        const redirectUri = state ? Buffer.from(state, "base64").toString("utf-8") : `${getBaseUrl(req)}/api/oauth/callback`;
        const tokenRes = await axios2.post(
          "https://oauth2.googleapis.com/token",
          new URLSearchParams({
            code,
            client_id: ENV.googleClientId,
            client_secret: ENV.googleClientSecret,
            redirect_uri: redirectUri,
            grant_type: "authorization_code"
          }).toString(),
          { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );
        const accessToken = tokenRes.data.access_token;
        const profileRes = await axios2.get("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const googleUser = profileRes.data;
        const existingByEmail = googleUser.email ? await getUserByEmail(googleUser.email) : void 0;
        const openId = existingByEmail?.openId || `google_${googleUser.id}`;
        await upsertUser({
          openId,
          name: googleUser.name || existingByEmail?.name || "Giocatore",
          email: googleUser.email ?? null,
          loginMethod: "google",
          lastSignedIn: /* @__PURE__ */ new Date()
        });
        const sessionToken2 = await sdk.createSessionToken(openId, {
          name: googleUser.name || existingByEmail?.name || "Giocatore",
          expiresInMs: ONE_YEAR_MS
        });
        const cookieOptions2 = getSessionCookieOptions(req);
        res.cookie(COOKIE_NAME, sessionToken2, { ...cookieOptions2, maxAge: ONE_YEAR_MS });
        res.redirect(302, "/");
        return;
      }
      if (!state) {
        res.status(400).json({ error: "state is required" });
        return;
      }
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/imageProxy.ts
import fs from "fs";
import path from "path";

// server/_core/imageMap.ts
var IMAGE_MAP = {
  "30788c55d73110ed": "https://upload.wikimedia.org/wikipedia/commons/5/54/Gianluigi_Buffon_%2831784615942%29_%28cropped%29.jpg",
  "33c1fef6c05dcfa1": "https://upload.wikimedia.org/wikipedia/it/1/1d/Francesco_Totti_-_AS_Roma_1998-99.jpg",
  "f5570fd6169294eb": "https://upload.wikimedia.org/wikipedia/commons/e/e7/Metalist-Inter_%282%29.jpg",
  "d054e44b30eb234c": "https://upload.wikimedia.org/wikipedia/it/1/19/Gianluca_Pagliuca_-_UC_Sampdoria_1988-89.jpg",
  "110657dc5ff81154": "https://upload.wikimedia.org/wikipedia/commons/2/29/Samir_Handanovi%C4%87_Slovenia.jpg",
  "fd1e0f70a97a1d00": "https://upload.wikimedia.org/wikipedia/commons/d/db/Zenit-Torino_%287%29.jpg",
  "7324aad6df2afc39": "https://upload.wikimedia.org/wikipedia/commons/7/7a/Andrea_Consigli_%28cropped%29.jpg",
  "70976b09e9ba2ba8": "https://upload.wikimedia.org/wikipedia/commons/9/9f/Ciro_Ferrara.jpg",
  "a947351dde7a7f6f": "https://upload.wikimedia.org/wikipedia/commons/e/e6/Goran_Pandev.JPG",
  "182fdd1410e7e457": "https://upload.wikimedia.org/wikipedia/it/7/7c/Angelo_Peruzzi_-_Juventus_FC_1996-97.jpg",
  "5f5b4a7aa226424e": "https://upload.wikimedia.org/wikipedia/commons/7/7d/Daniele_De_Rossi_BGR-ITA_2012.jpg",
  "ffb5102ac2d3a01b": "https://upload.wikimedia.org/wikipedia/commons/d/d5/Cardiff_City_FC_v_AC_ChievoVerona%2C_3_August_2013_-_Sergio_Pellissier_%28edited%29.jpg",
  "fc245bf1f97aecab": "https://upload.wikimedia.org/wikipedia/commons/d/dd/Costacurta_1992.jpg",
  "9d48ef9e247c656b": "https://upload.wikimedia.org/wikipedia/commons/8/8e/Lorenzo_de_silvestri_%281%29.JPG",
  "7551ef5e36658add": "https://upload.wikimedia.org/wikipedia/it/1/1b/Roberto_Baggio_-_Italia_%2790.jpg",
  "65bfad2c084e54a0": "https://upload.wikimedia.org/wikipedia/commons/8/8e/S%C3%A9bastien_Frey_Fiorentina.jpg",
  "1523e9bbd6f39a10": "https://upload.wikimedia.org/wikipedia/commons/e/e5/Dario_Dainelli%2C_2005.jpg",
  "da8109c1dd72f095": "https://upload.wikimedia.org/wikipedia/commons/3/37/Antonio_di_natale.JPG",
  "cc8c738c0b690346": "https://upload.wikimedia.org/wikipedia/commons/6/62/20150616_-_Portugal_-_Italie_-_Gen%C3%A8ve_-_Leonardo_Bonucci.jpg",
  "d3733ade30156e4e": "https://upload.wikimedia.org/wikipedia/commons/f/f3/Piotr_Zieli%C5%84ski_2018.jpg",
  "1d69688db435dd1f": "https://upload.wikimedia.org/wikipedia/commons/b/b9/Sergio_Mattarella_meets_Italy_national_football_team_and_Matteo_Berrettini_%2812_July_2021%29_30_-_Chiellini_%28cropped%29.jpg",
  "bdf32630f1f447ea": "https://upload.wikimedia.org/wikipedia/commons/6/68/Paolo_Cannavaro_Neapel_.jpg",
  "8df9fd14d937db41": "https://upload.wikimedia.org/wikipedia/it/0/07/Luca_Marchegiani_-_Torino_Calcio.jpg",
  "049532a7e287a223": "https://upload.wikimedia.org/wikipedia/commons/0/09/Fabio_Cannavaro_2011.jpg",
  "c0c6a4470147813b": "https://upload.wikimedia.org/wikipedia/commons/6/6c/Morgan_De_Sanctis_2012_%28cropped%29.jpg",
  "cf9bae3c9ff7c64f": "https://upload.wikimedia.org/wikipedia/commons/0/0f/Alessandro_Nesta_as_Miami_FC_Manager.jpg",
  "e04b6176bd45e367": "https://upload.wikimedia.org/wikipedia/commons/7/78/Francesco_Acerbi_2021.jpg",
  "4caf950f34a751eb": "https://upload.wikimedia.org/wikipedia/commons/5/5e/Hamsik_2016.jpg",
  "45de65597523d8d1": "https://upload.wikimedia.org/wikipedia/commons/b/b6/Juan_Cuadrado_2019_%28cropped%29.jpg",
  "0a0fd3a0eff4290f": "https://upload.wikimedia.org/wikipedia/commons/b/bf/Matteo_brighi.jpg",
  "f5888a3e2fff8d78": "https://upload.wikimedia.org/wikipedia/it/e/e6/Diego_Fuser_-_SS_Lazio_1993-94.jpg",
  "7cf14d4dae235ea6": "https://upload.wikimedia.org/wikipedia/commons/4/47/Simone_Perrotta_2007.jpg",
  "0d0f77a93c38f0bf": "https://upload.wikimedia.org/wikipedia/commons/3/36/Antonio_Cassano_Euro_2012_vs_England.jpg",
  "8ce4c822469b56da": "https://upload.wikimedia.org/wikipedia/commons/c/c2/Clarence_Seedorf_Introductory_Press_Conferences%2C_2_June_2025_-_40_%28cropped%29.jpg",
  "883b65a1a8dc88b5": "https://upload.wikimedia.org/wikipedia/commons/5/5b/Christian_Panucci_2012.jpg",
  "6706b56cf5620626": "https://upload.wikimedia.org/wikipedia/it/2/21/Fabrizio_Ferron_1991.jpg",
  "8b9f08ffebc07503": "https://upload.wikimedia.org/wikipedia/commons/8/8d/Massimo_Ambrosini_%E2%80%93_A.C._Milan_2.jpg",
  "5114b397a7165875": "https://upload.wikimedia.org/wikipedia/commons/4/46/AlessandroGamberini.jpg",
  "735f7fda33de21a6": "https://upload.wikimedia.org/wikipedia/commons/5/53/Di_biagio-Under_21_%28edited%29.jpg",
  "7141372607942ce6": "https://upload.wikimedia.org/wikipedia/commons/7/70/Giampiero_Pinzi_2.jpg",
  "532986be1120faea": "https://upload.wikimedia.org/wikipedia/commons/c/cc/Alessandro_Lucarelli.jpg",
  "a231ef243d5caf5a": "https://upload.wikimedia.org/wikipedia/it/6/60/N%C3%A9stor_Sensini_-_Udinese_Calcio_1991-92.jpg",
  "f6317e6c68b88d19": "https://upload.wikimedia.org/wikipedia/commons/8/81/Giampaolo_Pazzini_2022.jpg",
  "3a32768ca511f8fd": "https://upload.wikimedia.org/wikipedia/commons/e/e2/David_Pizarro_Footballteam_of_Chile_-_Spain_vs._Chile%2C_10th_September_2013_%28cropped%29.jpg",
  "4be755d6c10131d4": "https://upload.wikimedia.org/wikipedia/it/4/42/Nicola_Amoruso_-_Juventus_FC_1996-1997.jpg",
  "f1eb3ba21cf2e3dc": "https://upload.wikimedia.org/wikipedia/commons/8/8f/Francesco_Toldo_-_Inter_Mailand_%281%29.jpg",
  "133ad1364ab3fd17": "https://upload.wikimedia.org/wikipedia/commons/3/3a/Giacomo_Bonaventura_%2831931883345%29.jpg",
  "872aa1e697a91c68": "https://upload.wikimedia.org/wikipedia/it/9/98/Enrico_Chiesa_-_UC_Sampdoria_1992-93.jpg",
  "5f23ca36aa32f7ec": "https://upload.wikimedia.org/wikipedia/commons/c/c4/Riccardo_Montolivo_Euro_2012_vs_England.jpg",
  "b8c6d2aee13247de": "https://upload.wikimedia.org/wikipedia/commons/b/b2/2017_FRIENDLY_MATCH_RUSSIA_v_ARGENTINA_-_Paulo_Dybala_01.jpg",
  "f0d212b6aa0945db": "https://upload.wikimedia.org/wikipedia/commons/f/fa/AntonioMirante.png",
  "569b25194acd377c": "https://upload.wikimedia.org/wikipedia/commons/c/c6/20150616_Antonio_Conte.jpg",
  "86232a904bf9d815": "https://upload.wikimedia.org/wikipedia/commons/d/d8/Palombo_2015_%28cropped%29.jpg",
  "f07525742c494f5d": "https://upload.wikimedia.org/wikipedia/it/0/04/Milan_AC_-_2001_-_Filippo_Inzaghi.jpg",
  "6b1a55c9c4211fd7": "https://upload.wikimedia.org/wikipedia/commons/f/f1/Sergio_Floccari_%28cropped%29.jpg",
  "4882c2da14f6c544": "https://upload.wikimedia.org/wikipedia/commons/1/14/Dejan_Stankovi%C4%87_in_2025.jpg",
  "f0794ccee380ef9d": "https://upload.wikimedia.org/wikipedia/commons/d/d6/20150616_-_Portugal_-_Italie_-_Gen%C3%A8ve_-_Emiliano_Moretti.jpg",
  "590a6ba85176d735": "https://upload.wikimedia.org/wikipedia/commons/7/72/Radja_Nainggolan_in_2014_%28cropped%29_%28cropped%29.jpg",
  "c2976f4e277fc554": "https://upload.wikimedia.org/wikipedia/commons/4/4d/Alessio_Romagnoli_Luglio_2022.png",
  "6093e607b4b1f3b8": "https://upload.wikimedia.org/wikipedia/it/5/53/Paolo_Negro_-_Lazio_1995.png",
  "143c75bf1f3d0e4a": "https://upload.wikimedia.org/wikipedia/commons/e/e5/Stefano_Sorrentino.JPG",
  "00dbc8e458ecc405": "https://upload.wikimedia.org/wikipedia/commons/f/f2/LucaCigarini_%28cropped%29.JPG",
  "e33bb63e44803a9f": "https://upload.wikimedia.org/wikipedia/commons/3/30/Trenza_Palacio_%28cropped%29.jpg",
  "c890401a002d5910": "https://upload.wikimedia.org/wikipedia/commons/3/35/20150616_-_Portugal_-_Italie_-_Gen%C3%A8ve_-_Ciro_Immobile_1.jpg",
  "37afe0eea36214d8": "https://upload.wikimedia.org/wikipedia/commons/9/9c/Manuel_Pasqual.jpg",
  "e4512ccfa5fb86eb": "https://upload.wikimedia.org/wikipedia/commons/e/e1/Coppa_Italia_2009_premiazione.jpg",
  "d9582ecc106a1f58": "https://upload.wikimedia.org/wikipedia/commons/a/a1/Stefano_Mauri_2009.jpg",
  "a0aa709c5e67c26c": "https://upload.wikimedia.org/wikipedia/commons/4/46/Pavel_Nedv%C4%9Bd.jpg",
  "87ee9124e92deb2c": "https://upload.wikimedia.org/wikipedia/commons/5/57/Italy_national_football_team_-_2021_%28Andrea_Belotti%29_%28cropped%29.jpg",
  "df0d4dc39a6d932b": "https://upload.wikimedia.org/wikipedia/commons/7/79/Davide_Biondini.JPG",
  "4127e55acf2ff0c7": "https://upload.wikimedia.org/wikipedia/commons/1/1a/Dnepr-Lazio_%286%29.jpg",
  "7fc7b8295c391f0f": "https://upload.wikimedia.org/wikipedia/commons/0/0f/Cristante_CSKA-Roma18.jpg",
  "b4c5893590d9ba07": "https://upload.wikimedia.org/wikipedia/commons/c/c7/Balleri_Livorno.jpg",
  "9bc4a06256a71e92": "https://upload.wikimedia.org/wikipedia/commons/b/b9/20150616_-_Portugal_-_Italie_-_Gen%C3%A8ve_-_Alessandro_Matri_%28cropped%29.jpg",
  "11943c99df060031": "https://upload.wikimedia.org/wikipedia/commons/4/46/FC_Zenit_Saint_Petersburg_vs._Juventus%2C_20_October_2021_33_%28Luca_Toni%29.jpg",
  "a2552f9e45414356": "https://upload.wikimedia.org/wikipedia/it/1/18/Giuseppe_Signori_-_SS_Lazio_1995-96.jpg",
  "c0ee31e9c96fc8f1": "https://upload.wikimedia.org/wikipedia/commons/7/7e/Marco_Di_Vaio_Montreal_Impact.jpg",
  "ac66f6b7f3fe54b0": "https://upload.wikimedia.org/wikipedia/commons/c/ca/Cristiano_Biraghi_Fiorentina_%28cropped%29.jpg",
  "70893a2f6487c672": "https://upload.wikimedia.org/wikipedia/commons/b/b8/Marco_Borriello.jpg",
  "63e6466ba27deeff": "https://upload.wikimedia.org/wikipedia/it/3/3a/Coppa_UEFA_1998-99_-_Parma_vs_Bordeaux_-_Hern%C3%A1n_Crespo.jpg",
  "294d52eb0cf72be0": "https://upload.wikimedia.org/wikipedia/commons/7/7d/Eugenio-corini_%28cropped%29.jpg",
  "d918734f9493a0db": "https://upload.wikimedia.org/wikipedia/commons/3/3b/Josip_Ilicic_2021.jpg",
  "4d90c6a76df5cf7f": "https://upload.wikimedia.org/wikipedia/commons/f/f9/Giovanni_Simeone_2016-17.jpg",
  "97e61c0dce4be10e": "https://upload.wikimedia.org/wikipedia/commons/c/c7/2018_Max_Tonetto.jpg",
  "f5f367d832d5b67f": "https://upload.wikimedia.org/wikipedia/commons/e/e1/DanieleConti_2013.jpg",
  "758e5e33c057f35e": "https://upload.wikimedia.org/wikipedia/commons/6/60/Lorenzo_Insigne_2021.jpg",
  "3dbce2248c317aba": "https://upload.wikimedia.org/wikipedia/it/2/28/Fabio_Pecchia_-_SSC_Napoli_1996-97.jpg",
  "1f5b01155e7247ba": "https://upload.wikimedia.org/wikipedia/commons/d/db/Ivan_Radovanovic_%28cropped%29.JPG",
  "87b61ed3d0b43f81": "https://upload.wikimedia.org/wikipedia/commons/3/35/Amauri.jpg",
  "e1d1974c00257ee8": "https://upload.wikimedia.org/wikipedia/commons/4/4d/Christian_Abbiati_2008.jpg",
  "fcdf5654c0b2b78a": "https://upload.wikimedia.org/wikipedia/commons/a/a5/Martin_Jorgensen.jpg",
  "d5c01df6a719ec94": "https://upload.wikimedia.org/wikipedia/it/8/84/Roberto_Muzzi_-_Cagliari_Calcio.jpg",
  "637527eb09b05cfe": "https://upload.wikimedia.org/wikipedia/commons/2/2f/Christian_Maggio_BGR-ITA_2012.jpg",
  "db825d8b8e31b341": "https://upload.wikimedia.org/wikipedia/commons/b/b2/Mesto_Napoli.jpg",
  "fea1d6219474b5f5": "https://upload.wikimedia.org/wikipedia/commons/f/f3/Daniele_Dessena_2012.jpg",
  "8fad9e62e48cd6d9": "https://upload.wikimedia.org/wikipedia/it/c/cd/Dino_Baggio_-_Coppa_UEFA_1994-1995.jpg",
  "ef63b6d1b222faf6": "https://upload.wikimedia.org/wikipedia/commons/2/2b/Demetrio_Albertini_Padova.jpg",
  "40d14c3cda64531c": "https://upload.wikimedia.org/wikipedia/commons/2/23/FWC_2018_-_Round_of_16_-_COL_v_ENG_-_Luis_Muriel.jpg",
  "5366ddb191e4c82c": "https://upload.wikimedia.org/wikipedia/commons/9/97/Marcos_Rojo_%28L%29%2C_Nicol%C3%A1s_Burdisso_%28M%29%2C_Angel_di_Maria_%28R%29_%E2%80%93_Portugal_vs._Argentina%2C_9th_February_2011_%28cropped%29.jpg",
  "258290b826afb5c2": "https://upload.wikimedia.org/wikipedia/commons/9/97/Lukaszskorupski.jpg",
  "999db54bed23054f": "https://upload.wikimedia.org/wikipedia/commons/3/36/Ivan_Cordoba_-_Inter_Mailand_%281%29.jpg",
  "95d1d382b9719af4": "https://upload.wikimedia.org/wikipedia/commons/8/88/Rocchi_Tommaso.jpg",
  "6dc5fea1520aac67": "https://upload.wikimedia.org/wikipedia/it/a/a4/Fabio_Galante_-_Torino_Calcio_1999-2000.jpg",
  "e90e6b7c96c91d77": "https://upload.wikimedia.org/wikipedia/commons/e/ef/Stefano_Fiore_2.jpg",
  "4effb82c84ad75c5": "https://upload.wikimedia.org/wikipedia/commons/6/65/Daniele_Bonera_%E2%80%93_A.C._Milan.jpg",
  "8c87b8416ff5ed13": "https://upload.wikimedia.org/wikipedia/commons/d/dc/Albin_Ekdal_2018.jpg",
  "db922b0252235861": "https://upload.wikimedia.org/wikipedia/commons/1/13/Alfred_Duncan.jpg",
  "e7dbfe2e6831aa89": "https://upload.wikimedia.org/wikipedia/commons/8/85/Mattia_Destro_-_AS_Roma_-_Ritiro_2014_%28Bad_Waltersdorf%29_-_Edited.jpg",
  "da6ac5ef98741455": "https://upload.wikimedia.org/wikipedia/commons/f/fa/Luciano_Zauri.jpg",
  "5af8e4fc2880b9f1": "https://upload.wikimedia.org/wikipedia/commons/1/1e/Giuseppe_Pancaro%2C_2005.jpg",
  "ad7271709e7ddeb4": "https://upload.wikimedia.org/wikipedia/it/7/76/Batistuta_nel_1992-93.jpg",
  "5870c14b97cb871b": "https://upload.wikimedia.org/wikipedia/commons/a/a9/Matias_Silvestre_%28cropped%29.jpg",
  "e42bb4ca1ce8a2c3": "https://upload.wikimedia.org/wikipedia/commons/2/26/MANUEL_LOCATELLI_-_ZENIT_vs_JUVENTUS.jpg",
  "7c62815a044fe147": "https://upload.wikimedia.org/wikipedia/commons/e/eb/Papu_Gomez_02.jpg",
  "63d2c40c8cea12d0": "https://upload.wikimedia.org/wikipedia/commons/0/08/Esteban_Cambiasso_FC_Internazionale.jpg",
  "8020d0277af131cc": "https://upload.wikimedia.org/wikipedia/it/7/77/Sinisa_Mihajlovic%2C_Sampdoria_1994-95.jpg",
  "1f920e46b4bafbc0": "https://upload.wikimedia.org/wikipedia/commons/b/b9/Elseid_Hysaj.jpg",
  "2048e3a0879a4f4c": "https://upload.wikimedia.org/wikipedia/commons/1/13/CesareNatali.jpg",
  "7d4725c2140f5bb2": "https://upload.wikimedia.org/wikipedia/commons/7/7a/Dnepr-Inter_%284%29.jpg",
  "972199bbd4124ddb": "https://upload.wikimedia.org/wikipedia/commons/4/40/FWC_2018_-_Round_of_16_-_COL_v_ENG_-_Photo_104_%28cropped%29.jpg",
  "97f84851c697efbf": "https://upload.wikimedia.org/wikipedia/commons/6/60/20171114_AUT_URU_4555_%28cropped%29.jpg",
  "8f0e25d7a970466a": "https://upload.wikimedia.org/wikipedia/commons/3/35/Daniele_Gastaldello_2.jpg",
  "eda742efc190db99": "https://upload.wikimedia.org/wikipedia/it/d/d1/Alessandro_Calori_-_Udinese_Calcio_1996-97.jpg",
  "d06f5b01ce28ff4b": "https://upload.wikimedia.org/wikipedia/commons/8/8e/Mirko_Vucinic_2012_MNE.jpg",
  "0a2468b0ede2959a": "https://upload.wikimedia.org/wikipedia/commons/1/14/Simone_Padoin_2012_%28edited%29.jpg",
  "41e772bc410931cf": "https://upload.wikimedia.org/wikipedia/it/5/5b/Antonio_Filippini.jpg",
  "b6ef6abe07141bf5": "https://upload.wikimedia.org/wikipedia/commons/8/8a/Luca_Rigoni.jpg",
  "c82dbe3b1ab9c5b0": "https://upload.wikimedia.org/wikipedia/commons/4/47/Capitano.jpg",
  "dd07e1652ccf25d3": "https://upload.wikimedia.org/wikipedia/it/a/a0/David_Di_Michele_-_Salernitana_Sport_1998-99.jpg",
  "91b39fc9ecbe7f2f": "https://upload.wikimedia.org/wikipedia/commons/2/25/Cristiano_Lucarelli_2026_%28headshot%29.jpg",
  "adee010320c5a430": "https://upload.wikimedia.org/wikipedia/it/f/f1/Luigigarzya.jpg",
  "07524f7e4123bc2c": "https://upload.wikimedia.org/wikipedia/commons/2/2d/20150616_-_Portugal_-_Italie_-_Gen%C3%A8ve_-_Matteo_Darmian_1.jpg",
  "8daf3bf87323ac8b": "https://upload.wikimedia.org/wikipedia/commons/f/f0/AUT_vs._SUI_2015-11-17_-_Stephan_Lichtsteiner_%282%29.jpg",
  "9f6489b8e7bce584": "https://upload.wikimedia.org/wikipedia/commons/d/d8/Stefano_Morrone.jpg",
  "0ad0b64eac1fdaf9": "https://upload.wikimedia.org/wikipedia/commons/6/64/FC_Salzburg_gegen_Inter_Mailand_%28Testspiel_2023-08-09%29_67_-_Stefan_de_Vrij_%28cropped%29.jpg",
  "225ad240d7885b10": "https://upload.wikimedia.org/wikipedia/commons/a/a1/P%C3%ABrparim_Hetemaj.jpg",
  "1f0a8c23d56203e7": "https://upload.wikimedia.org/wikipedia/commons/5/57/Andrea_Poli_at_Yeni_Malatyaspor_vs_Antalyaspor_20220219_6_%28cropped%29.jpg",
  "5185133428009c8c": "https://upload.wikimedia.org/wikipedia/it/b/b3/Tomas_Locatelli_Udinese.jpg",
  "56fb2a58e19fc088": "https://upload.wikimedia.org/wikipedia/commons/0/05/KL-2018_%2816%29_%28cpped%29.jpg",
  "21d216ceeee4a57d": "https://upload.wikimedia.org/wikipedia/it/9/98/Luca_Bucci_-_Torino_Calcio_1998-99.jpg",
  "4a6a732978871cb1": "https://upload.wikimedia.org/wikipedia/it/d/d5/Luigi_Sala.jpg",
  "e3155a2b5c842777": "https://upload.wikimedia.org/wikipedia/commons/f/f1/Claudio_Marchisio%2C_2019_%28cropped%29.jpg",
  "2998bc81db6a7281": "https://upload.wikimedia.org/wikipedia/commons/b/be/Darko_Lazovic.jpg",
  "8f3c054364f010ac": "https://upload.wikimedia.org/wikipedia/commons/0/03/Mertens_2018_%28cropped%29.jpg",
  "c274910ba2bd9594": "https://upload.wikimedia.org/wikipedia/commons/d/d7/FC_Salzburg_gegen_AS_Roma_Pellegrini.jpg",
  "9d7e65301f44cc05": "https://upload.wikimedia.org/wikipedia/it/6/64/Angelo_Di_Livio_-_Juventus_FC_1993-94.jpg",
  "cb7bd935163fb994": "https://upload.wikimedia.org/wikipedia/commons/0/09/Stefano_Lucchini_%28Bogliasco_2010%29.JPG",
  "22c31ef8aa88d2b2": "https://upload.wikimedia.org/wikipedia/commons/c/c6/RemoFreuler.jpg",
  "d387b4352cc53e6e": "https://upload.wikimedia.org/wikipedia/commons/2/28/Pasalic_6459_%28cropped%29.jpg",
  "56c9da30cacd0c10": "https://upload.wikimedia.org/wikipedia/it/c/cd/Massimo_Taibi_-_Piacenza_FC_1993-94.jpg",
  "e24bd253fd100ce8": "https://upload.wikimedia.org/wikipedia/commons/9/93/Ignazio_Abate_and_Jordi_Alba_Euro_2012_final_%28cropped%29.JPG",
  "bcebe361f25e58c5": "https://upload.wikimedia.org/wikipedia/commons/a/a8/FC_Salzburg_gegen_AS_Roma_%28UEFA_Euroleague_play-off%2C_2023-02-16%29_15_%28cropped%29.jpg",
  "8ea702fc8a196aa6": "https://upload.wikimedia.org/wikipedia/commons/b/b7/Walter_Samuel_-_Inter_Mailand_%281%29.jpg",
  "4543b688cb85b236": "https://upload.wikimedia.org/wikipedia/commons/d/d7/AUT_vs._TUR_2016-03-29_%28342%29.jpg",
  "0d05107c2ed448a0": "https://upload.wikimedia.org/wikipedia/commons/5/50/Gianluca_Caprari_TV_SEI%2C_2017_%28cropped%29.png",
  "1d8c4eef5f2dbec7": "https://upload.wikimedia.org/wikipedia/commons/f/f6/Franco_Brienza.JPG",
  "48f74db1373e7de9": "https://upload.wikimedia.org/wikipedia/commons/c/c8/Jasmin_Kurti%C4%8701.jpg",
  "0fb5cc352831db7b": "https://upload.wikimedia.org/wikipedia/commons/9/9f/Giulio_Migliaccio.jpg",
  "753edcd4af39a306": "https://upload.wikimedia.org/wikipedia/commons/3/35/20150616_-_Portugal_-_Italie_-_Gen%C3%A8ve_-_Davide_Astori.jpg",
  "0e2d8d53c8e88f10": "https://upload.wikimedia.org/wikipedia/commons/f/fd/Fabio_Liverani_2.jpg",
  "bfa821dc83c6b1f3": "https://upload.wikimedia.org/wikipedia/commons/f/fb/USAvVEN_2019-06-09_-_Tom%C3%A1s_Rinc%C3%B3n_%2851171362490%29_%28cropped%29.jpg",
  "20ae6e6cd22319e0": "https://upload.wikimedia.org/wikipedia/commons/a/ab/Vincenzo_Montella_2015.jpg",
  "8e657b35db586e07": "https://upload.wikimedia.org/wikipedia/commons/e/ef/BROCCHI_%281%29.png",
  "0130ab207eaced34": "https://upload.wikimedia.org/wikipedia/commons/d/d6/Florenzi%2C_Roma-Udinese_17_marzo_2014.jpg",
  "4990a4ebc20c462e": "https://upload.wikimedia.org/wikipedia/commons/5/5c/Roberto_Guana_%28cropped%29.jpg",
  "f1decb611fc3bbf4": "https://upload.wikimedia.org/wikipedia/commons/9/9b/Andrea_Masiello_03.jpg",
  "041ac4a2d46ea1be": "https://upload.wikimedia.org/wikipedia/it/f/f5/Francesco_Moriero_-_US_Lecce_1991-92.jpg",
  "0e3b3a2b6f2e03df": "https://upload.wikimedia.org/wikipedia/commons/8/86/Norway_Italy_-_June_2025_A_20_-_Giovanni_Di_Lorenzo.jpg",
  "bf260ff11a3d7393": "https://upload.wikimedia.org/wikipedia/commons/b/bd/Maurizio_Domizzi.jpg",
  "1c3882dde78ee0b5": "https://upload.wikimedia.org/wikipedia/commons/c/c1/Sculli_%28cropped%29.JPG",
  "391272c5ccc8ab79": "https://upload.wikimedia.org/wikipedia/commons/c/c2/Riccardo_Orsolini.jpg",
  "55d8707d3395312e": "https://upload.wikimedia.org/wikipedia/commons/2/2f/Mandragora_Udinese_%28cropped%29.png",
  "230e570ab978d47f": "https://upload.wikimedia.org/wikipedia/commons/a/ab/Giuseppe_Biava_01.JPG",
  "71eceac8a51c27d1": "https://upload.wikimedia.org/wikipedia/commons/0/09/Zlatan_Ibrahimovi%C4%87_June_2018.jpg",
  "b12965639700a684": "https://upload.wikimedia.org/wikipedia/commons/f/f8/Salvatore_Lanna.jpg",
  "07e74367cb870904": "https://upload.wikimedia.org/wikipedia/commons/6/6f/Berat_Djimsiti_01_%28cropped%29.JPG",
  "6e422ccd1c7216f8": "https://upload.wikimedia.org/wikipedia/commons/5/5f/KL-2018_%2816%29_Cristian_Zenoni.jpg",
  "6812ac5f822eb53a": "https://upload.wikimedia.org/wikipedia/commons/0/06/FC_Salzburg_gegen_S.S._Lazio_Rom_Euroleague-Viertelfinale_%2812._April_2018%29_04.jpg",
  "32645769b42c8bda": "https://upload.wikimedia.org/wikipedia/it/c/cf/Domenico_Morfeo_-_Atalanta_BC_1996-97.jpg",
  "6894d8a4d9b3929a": "https://upload.wikimedia.org/wikipedia/commons/7/7a/14_06_2019_Abertura_da_Copa_Am%C3%A9rica_Brasil_2019_%2848064408836%29_%28cropped%29.jpg",
  "8b0e76dbf5faa623": "https://upload.wikimedia.org/wikipedia/commons/1/16/Oddo_Perugia_%28cropped%29.jpg",
  "d39eb68d2513a78e": "https://upload.wikimedia.org/wikipedia/commons/a/aa/Juan_Jesus_Inter_%282%29.jpg",
  "bae1b0f02f84a0e8": "https://upload.wikimedia.org/wikipedia/commons/d/d4/20150331_2025_AUT_BIH_2130_Miralem_Pjani%C4%87.jpg",
  "e4b145f0596f4bb8": "https://upload.wikimedia.org/wikipedia/it/3/30/Giuliano_Giannichedda_-_Udinese_Calcio_2000-01.jpg",
  "ad2afebf83ed3241": "https://upload.wikimedia.org/wikipedia/commons/d/d0/Blerim_Dzemaili_2018.jpg",
  "f7f3fa4f7c4ab9f4": "https://upload.wikimedia.org/wikipedia/it/7/7c/Marcello_Castellini_-_AC_Perugia_1996-97.jpg",
  "883f058a0f201590": "https://upload.wikimedia.org/wikipedia/commons/8/8c/20150616_-_Portugal_-_Italie_-_Gen%C3%A8ve_-_Roberto_Soriano.jpg",
  "9eb37c3fd5017ad9": "https://upload.wikimedia.org/wikipedia/commons/a/a5/20150331_2026_AUT_BIH_2177_Edin_D%C5%BEeko.jpg",
  "20f76bd9226d1f9f": "https://upload.wikimedia.org/wikipedia/commons/7/78/Mattia_Cassani.jpg",
  "1c45205ae98bc057": "https://upload.wikimedia.org/wikipedia/commons/6/65/Kwadwo_Asamoah_20140816_%28cropped%29_%282%29.jpg",
  "51a27cb58871f180": "https://upload.wikimedia.org/wikipedia/commons/b/be/Gianpaolo_Bellini_01.JPG",
  "5f43447cd05ce350": "https://upload.wikimedia.org/wikipedia/commons/4/43/Southampton_FC_versus_Sevilla_%2835994679430%29_-_Manolo_Gabbiadini_%28head_shot%29.jpg",
  "92e94da5203a51c0": "https://upload.wikimedia.org/wikipedia/commons/9/92/Gianluca_Comotto_%282007%29.jpg",
  "003e61e1f12146da": "https://upload.wikimedia.org/wikipedia/commons/f/f9/Mariano_Julio_Izco.jpg",
  "d929d216b8ddae2f": "https://upload.wikimedia.org/wikipedia/commons/d/df/20150616_-_Portugal_-_Italie_-_Gen%C3%A8ve_-_Nicola_Sansone.jpg",
  "7518b2cee81ddd64": "https://upload.wikimedia.org/wikipedia/commons/f/fe/Floro_Flores_UDI-CAT_4-2.jpg",
  "43aff05ddd6434f4": "https://upload.wikimedia.org/wikipedia/it/b/bd/Gianluca_Pessotto_-_1995_-_Juventus_FC.jpg",
  "d58629eb805ade79": "https://upload.wikimedia.org/wikipedia/commons/1/18/FedericoPeluso.JPG",
  "f39bbedf6ccb3902": "https://upload.wikimedia.org/wikipedia/it/b/b5/Aldo_Firicano_-_Udinese_Calcio_1987-88.jpg",
  "880ef7f67ca9daed": "https://upload.wikimedia.org/wikipedia/commons/d/d1/Manuele_Blasi_-_SSC_Neapel_%281%29.jpg",
  "0bf93f686d8fab44": "https://upload.wikimedia.org/wikipedia/commons/0/09/Rodrigo_Taddei_%28cropped%29.jpg",
  "7ae2551428a420c7": "https://upload.wikimedia.org/wikipedia/commons/4/4d/Wojciech_Szcz%C4%99sny.png",
  "60d384f6e6cd2eb8": "https://upload.wikimedia.org/wikipedia/commons/1/19/Massimo_Maccarone.jpg",
  "b80814ae282df57c": "https://upload.wikimedia.org/wikipedia/commons/2/2b/Adrian_Mutu_2.jpg",
  "00b3eff3c892b6df": "https://upload.wikimedia.org/wikipedia/it/5/54/Luigi_Turci_-_Udinese_Calcio_2000-01.jpg",
  "9a25828f3422572e": "https://upload.wikimedia.org/wikipedia/commons/a/a1/Michele_Pazienza_-_SSC_Neapel_%281%29.jpg",
  "8ba12f5bf68b0299": "https://upload.wikimedia.org/wikipedia/commons/6/6e/Alessio_Tacchinardi.jpg",
  "54a07114e10284db": "https://upload.wikimedia.org/wikipedia/commons/8/8e/Sulley_Muntari.jpg",
  "9c512497243c4a52": "https://upload.wikimedia.org/wikipedia/commons/2/29/Vincenzo_Iaquinta_2010.jpg",
  "b64fa4d97db6fcad": "https://upload.wikimedia.org/wikipedia/commons/d/da/Sebastiano_Siviglia.jpg",
  "18f99fc7f9502429": "https://upload.wikimedia.org/wikipedia/it/d/df/Attilio_Lombardo.jpg",
  "89bcf7ef35ca9f74": "https://upload.wikimedia.org/wikipedia/commons/c/c2/Alberto_Paloschi01.jpg",
  "7ae6904fe2ed822a": "https://upload.wikimedia.org/wikipedia/commons/a/a4/Philippe_Mex%C3%A8s_2012-06-11.jpg",
  "0c91c99319b6698e": "https://upload.wikimedia.org/wikipedia/it/e/e5/Claudio_Bellucci_-_UC_Sampdoria_1995-96.jpg",
  "11841d2af38fb44c": "https://upload.wikimedia.org/wikipedia/commons/f/f3/Borja_Valero_2026.jpg",
  "4d7a85e1f70c093e": "https://upload.wikimedia.org/wikipedia/commons/4/42/RC_Lens_-_Calcio_Padova_Bisoli.jpg",
  "b7f061e77c2e939b": "https://upload.wikimedia.org/wikipedia/commons/3/3a/AmedeoCarboni.jpg",
  "7e5d804570c4e400": "https://upload.wikimedia.org/wikipedia/commons/e/e5/Vincent_Candela.jpeg",
  "d5cf01f9f02ad512": "https://upload.wikimedia.org/wikipedia/it/3/3e/Paolo_Montero_-_Juventus_FC_1996-97.jpg",
  "e25ca38340f2f93b": "https://upload.wikimedia.org/wikipedia/commons/e/e8/Mattia_Perin_2016.jpg",
  "6b9ad0a507a2dacb": "https://upload.wikimedia.org/wikipedia/commons/6/69/Manuel_Lazzari02_%28cropped%29.jpg",
  "0f294aedcce3f434": "https://upload.wikimedia.org/wikipedia/commons/1/16/KL-2018_%2815%29_%28cropped%29.jpg",
  "675b5b6c2e6398d5": "https://upload.wikimedia.org/wikipedia/commons/a/a9/Salvatore_Aronica_-_SSC_Neapel_%281%29.jpg",
  "a38925bda6b61990": "https://upload.wikimedia.org/wikipedia/it/e/e6/Inter_FC_2002-12-01_Christian_Vieri.webp",
  "a152245242408e49": "https://upload.wikimedia.org/wikipedia/commons/8/8d/Meggiorini69_%28cropped%29.jpg",
  "f965eb2815664c2b": "https://upload.wikimedia.org/wikipedia/commons/7/77/Nicola_Legrottaglie.JPG",
  "61a6b2200c47562b": "https://upload.wikimedia.org/wikipedia/commons/a/a8/De_Ascentis_UDI-ATA_1-3.jpg",
  "72b57b431b77c7a6": "https://upload.wikimedia.org/wikipedia/commons/c/c8/G%C3%B6khan_%C4%B0nler_20231109_%28cropped%29.jpg",
  "509dea3898e28ddc": "https://upload.wikimedia.org/wikipedia/commons/0/05/FabrizioMiccoli.jpg",
  "ad7fa92da93366ad": "https://upload.wikimedia.org/wikipedia/commons/1/10/Valon_Behrami_2018.jpg",
  "ff81c07666ccf8c5": "https://upload.wikimedia.org/wikipedia/it/4/45/Serie_A_1995-96_-_Fiorentina_vs_Inter_-_Maurizio_Ganz.jpg",
  "b02106979ebe574e": "https://upload.wikimedia.org/wikipedia/commons/4/46/Cyril_Thereau.JPG",
  "92c33d1962a176f7": "https://upload.wikimedia.org/wikipedia/commons/7/76/Giovanni_Tedesco_West_Ham_Vs_Birkrikara_%2819946611611%29_%28cropped%29.jpg",
  "6bb5af10169dec8e": "https://upload.wikimedia.org/wikipedia/it/b/b3/Antonio_Benarrivo.jpg",
  "cb702db100ce065c": "https://upload.wikimedia.org/wikipedia/commons/0/0f/Rafael_Tol%C3%B3i_01.JPG",
  "cc87923e5c63c2cc": "https://upload.wikimedia.org/wikipedia/it/4/44/Lu%C3%ADs_Oliveira_-_Cagliari_Calcio_1992-93.jpg",
  "c9ad33149c43b80b": "https://upload.wikimedia.org/wikipedia/commons/e/e8/Andrea_cossu.jpg",
  "65c65075b6a62790": "https://upload.wikimedia.org/wikipedia/commons/7/71/Massimo_Paganin_2007byFigiu.jpg",
  "50cfc18774654728": "https://upload.wikimedia.org/wikipedia/it/8/8b/Luigi_Apolloni.jpg",
  "56cb5f876bf00f02": "https://upload.wikimedia.org/wikipedia/it/b/b7/Giovanni_Piacentini.jpg",
  "b4083e29debdae47": "https://upload.wikimedia.org/wikipedia/commons/c/c7/Gian_Marco_Ferrari_Match_Football_Spezia_Calcio_x_US_Sassuolo_Calcio_Stade_Alberto_Picco_-_La_Spezia_%28IT42%29_-_2022-08-27_-_2_%28cropped%29.jpg",
  "8f740f24fc61e214": "https://upload.wikimedia.org/wikipedia/it/a/ac/Mario_Alberto_Santana.jpeg",
  "e10e6e934582d9b0": "https://upload.wikimedia.org/wikipedia/commons/6/68/Andrrea_Sottil_Udinese_2023_2024.jpg",
  "71d54e49818c0c78": "https://upload.wikimedia.org/wikipedia/commons/2/22/AndreaPetagna_02.jpg",
  "e4d25ec1b61f9df5": "https://upload.wikimedia.org/wikipedia/commons/1/14/Ukrain-Slovakia_%285%29.jpg",
  "e6f4fe5e80ca7bcc": "https://upload.wikimedia.org/wikipedia/it/b/b0/Fabio_Petruzzi_-_AS_Roma_1996-97.jpg",
  "ce45d53355372a55": "https://upload.wikimedia.org/wikipedia/commons/6/64/SimonePepe.JPG",
  "dd104a6d3fdf9ef2": "https://upload.wikimedia.org/wikipedia/it/c/c1/Abel_Balbo_-_AS_Roma_1995-96.jpg",
  "fcfcf509d8003f38": "https://upload.wikimedia.org/wikipedia/it/e/e2/Moreno_Torricelli_-_Juventus_FC_1996-97.jpg",
  "cae6be8fe47d784e": "https://upload.wikimedia.org/wikipedia/commons/0/08/CSKA-Roma18_%287%29.jpg",
  "25194b5c6c20ecaa": "https://upload.wikimedia.org/wikipedia/commons/3/32/RobertoPereyra.jpg",
  "fdad46f79c4054e2": "https://upload.wikimedia.org/wikipedia/commons/5/5f/Emiliano_Viviano.jpg",
  "3fa8248bf4697ff7": "https://upload.wikimedia.org/wikipedia/commons/4/4f/Felipe_Anderson_2021.jpg",
  "f71d84be5b8c209d": "https://upload.wikimedia.org/wikipedia/commons/1/11/Nenad_Tomovi%C4%87.jpg",
  "43a22de006bb51da": "https://upload.wikimedia.org/wikipedia/commons/7/78/Norway_Italy_-_June_2025_A_26_%28cropped%29.jpg",
  "b9f38b5128234c9b": "https://upload.wikimedia.org/wikipedia/commons/0/0d/Marco_Materazzi_2020.jpg",
  "714cd5febf044f8a": "https://upload.wikimedia.org/wikipedia/commons/6/65/Simone_Barone.jpg",
  "a9d097d4a092e6b6": "https://upload.wikimedia.org/wikipedia/commons/5/5e/FC_Salzburg_versus_SSC_Napoli_%28UEFA_Euroleague_Achtelfinalr%C3%BCckspiel_14._M%C3%A4rz_2019%29_08_%28cropped%29_2.jpg",
  "1d9618d737cce341": "https://upload.wikimedia.org/wikipedia/it/f/fd/Carlo_Nervo_-_1997-98.jpg",
  "c58a12fc69766551": "https://upload.wikimedia.org/wikipedia/commons/8/8a/20150616_-_Portugal_-_Italie_-_Gen%C3%A8ve_-_Salvatore_Sirigu_1_%28cropped%29.jpg",
  "3df871dd3adc080b": "https://upload.wikimedia.org/wikipedia/commons/9/9b/Mark_Bresciano_2.jpg",
  "cccf06cc17148fcf": "https://upload.wikimedia.org/wikipedia/it/4/4e/Fernando_Couto_-_Parma_1994.JPG",
  "e01ffd7ec37ad05b": "https://upload.wikimedia.org/wikipedia/commons/8/8a/Antonio_Nocerino_warming_up_with_AC_Milan%2C_2012.jpg",
  "565be7c58190ef09": "https://upload.wikimedia.org/wikipedia/commons/a/a7/Leonardo_Pavoletti%2C_2016.png",
  "abae42b2aff5f169": "https://upload.wikimedia.org/wikipedia/commons/2/25/Bernardo_Corradi.jpg",
  "b59f40e2ea3ec105": "https://upload.wikimedia.org/wikipedia/commons/3/39/Paolo_Di_Canio_Upton_Park_11_September_2010_%28cropped%29.jpg",
  "2763ec6cd9301af0": "https://upload.wikimedia.org/wikipedia/it/3/30/Paolo_Poggi_Roma.jpg",
  "ebefbe872f71f270": "https://upload.wikimedia.org/wikipedia/commons/9/96/Eder-Sao-Paulo-Juventude-jun-2022.jpg",
  "850d0d81b480442c": "https://upload.wikimedia.org/wikipedia/commons/3/3a/Marco_Donadel_CF_Montreal_NYCFC_6.28.25-012_%28cropped%29.jpg",
  "1e0b67f2b87fdb92": "https://upload.wikimedia.org/wikipedia/commons/2/2e/Fabio_Simplicio.jpg",
  "989ed7e47deeeacf": "https://upload.wikimedia.org/wikipedia/it/c/c0/Julio_Cruz_-_Bologna_FC_1909_2002-03.jpg",
  "329c73617f41c8ef": "https://upload.wikimedia.org/wikipedia/commons/c/c0/Camoranesi_2016.jpg",
  "344808561092b63f": "https://upload.wikimedia.org/wikipedia/commons/b/ba/Luis_Su%C3%A1rez_NE_Revolution_Inter_Miami_7.9.25-053_%28cropped%29.jpg",
  "2260289a9b312f87": "https://upload.wikimedia.org/wikipedia/commons/c/ca/Germ%C3%A1n_Denis_-_SSC_Neapel_%281%29.jpg",
  "c7691c87b5960dcc": "https://upload.wikimedia.org/wikipedia/commons/6/63/Aleandro_Rosi.jpg",
  "5d89c36d28ef3cb6": "https://upload.wikimedia.org/wikipedia/commons/6/6a/Paolo_Sammarco.png",
  "3e27dce40d35797a": "https://upload.wikimedia.org/wikipedia/commons/e/e2/Mattia_Zaccagni_2021.jpg",
  "23e923585c70cd62": "https://upload.wikimedia.org/wikipedia/commons/1/11/FC_Zenit_Saint_Petersburg_vs._Juventus%2C_20_October_2021_17_%28Federico_Bernardeschi%29.jpg",
  "9e3da6194cc71b81": "https://upload.wikimedia.org/wikipedia/commons/1/1d/Torino-Zenit_%287%29.jpg",
  "a4bf5831ff340b6d": "https://upload.wikimedia.org/wikipedia/it/6/62/Giorgio_Venturin.jpg",
  "7f52e8f7ae4b0f31": "https://upload.wikimedia.org/wikipedia/it/1/1c/Thomas_Helveg_-_Udinese_Calcio_1996-97.jpg",
  "d51139d2d74bf8df": "https://upload.wikimedia.org/wikipedia/commons/8/87/Alberto_Fontana.jpg",
  "4018941a690b85ce": "https://upload.wikimedia.org/wikipedia/commons/f/fc/Federico_Marchetti_%28cropped%29.jpg",
  "8da6dfb375d81ce9": "https://upload.wikimedia.org/wikipedia/it/6/6e/Gianfranco_Zola_-_Parma_1993.jpg",
  "5673aec06c649b4f": "https://upload.wikimedia.org/wikipedia/commons/b/bf/Zebina_2_cropped.JPG",
  "d65deaa08a4352a5": "https://upload.wikimedia.org/wikipedia/it/e/ef/Marco_Lanna.jpg",
  "1c6690c84419db5f": "https://upload.wikimedia.org/wikipedia/it/9/99/Filippo_Maniero_-_AC_Venezia_1999-2000.jpg",
  "f7e79e0fd55e1128": "https://upload.wikimedia.org/wikipedia/commons/1/15/Michele_Marcolini_01.jpg",
  "275529a4788a5f12": "https://upload.wikimedia.org/wikipedia/commons/f/f4/Gaetano_D%27Agostino.jpg",
  "2d59f2dda592a769": "https://upload.wikimedia.org/wikipedia/commons/6/62/Marco_Amelia_2008.jpg",
  "4d2bba9c7d1be606": "https://upload.wikimedia.org/wikipedia/commons/0/04/Guglielmo_Stendardo.jpg",
  "49caaec94e8ee53d": "https://upload.wikimedia.org/wikipedia/commons/3/31/Joueur_de_foot.jpg",
  "2610c6572051cac9": "https://upload.wikimedia.org/wikipedia/commons/f/f6/Ousmane_Dabo.jpg",
  "c42f3437107d100b": "https://upload.wikimedia.org/wikipedia/commons/4/4b/Matteo_Ferrari_Impact_Montreal_2013-05-04.jpg",
  "4c918a45ba431dee": "https://upload.wikimedia.org/wikipedia/it/3/34/Mirko_Pieri_-_AC_Perugia_2000-01.jpg",
  "b13aa861226364cb": "https://upload.wikimedia.org/wikipedia/commons/2/29/Federico_Chiesa_vs_Zenit_2021-10-20_%28cropped2%29.jpg",
  "1f2016d1c158d93f": "https://upload.wikimedia.org/wikipedia/it/b/b2/Cristiano_Zanetti_-_AS_Roma_2000-01.jpg",
  "c2bd753c36dcf2db": "https://upload.wikimedia.org/wikipedia/commons/c/cb/Luca_Castellazzi_FC_Internazionale.jpg",
  "1d8ec91c3372f844": "https://upload.wikimedia.org/wikipedia/it/d/df/Gennaro_Ruotolo_-_Genoa_1893_1991-92.jpg",
  "a05cc37ccb99fcf0": "https://upload.wikimedia.org/wikipedia/commons/3/3f/Andrea_Caracciolo.png",
  "7f8c14a3e0a6d698": "https://upload.wikimedia.org/wikipedia/commons/d/db/Zenit-Torino_%283%29.jpg",
  "1e36f5e2d9d1a99b": "https://upload.wikimedia.org/wikipedia/commons/a/a8/PisanoCA.jpg",
  "5036d30eab9fb11d": "https://upload.wikimedia.org/wikipedia/commons/1/13/SVK_vs._SMR_2024_Slovakia_Nr._14_Skriniar_%283%29_%28cropped%29.jpg",
  "57298e8eb562ef7b": "https://upload.wikimedia.org/wikipedia/it/5/5f/Michele_Serena.jpg",
  "5ad380a018792982": "https://upload.wikimedia.org/wikipedia/commons/1/1d/Valerio_Fiori%2C_August_2012_%282%29.jpg",
  "b8128891c4dc0ca5": "https://upload.wikimedia.org/wikipedia/it/0/0c/Carmine_Gautieri_-_AC_Perugia_1996-97.jpg",
  "6f658c56ad06c7b0": "https://upload.wikimedia.org/wikipedia/commons/a/ae/Criscito_Genoa.jpg",
  "9f95c464d8aff355": "https://upload.wikimedia.org/wikipedia/commons/f/ff/Marek_Jankulovski.jpg",
  "1d04b77a64c1de1e": "https://upload.wikimedia.org/wikipedia/commons/9/9f/Cristiano_Del_Grosso.JPG",
  "06867f0811ac1286": "https://upload.wikimedia.org/wikipedia/it/a/a0/Alessandro_Grandoni_-_UC_Sampdoria_1998-99.jpg",
  "59e6edbc5bea0859": "https://upload.wikimedia.org/wikipedia/commons/f/fe/Kevin_Lasagna_Udinese.JPG",
  "5350914237862768": "https://upload.wikimedia.org/wikipedia/it/6/68/Mauro_Milanese_-_SSC_Napoli_1996-97.jpg",
  "02d01bce3d9ca251": "https://upload.wikimedia.org/wikipedia/commons/2/25/%D0%90%D0%BD%D0%B4%D1%80%D1%96%D0%B9_%D0%A8%D0%B5%D0%B2%D1%87%D0%B5%D0%BD%D0%BA%D0%BE_2024_%28cropped%29.png",
  "2ce259eea467353b": "https://upload.wikimedia.org/wikipedia/commons/9/90/Saponara_nel_2013.jpg",
  "be26fbc2675c2370": "https://upload.wikimedia.org/wikipedia/commons/1/1d/Roberto_Baronio_cropped.jpg",
  "b9dcc42f5eee89df": "https://upload.wikimedia.org/wikipedia/commons/e/ec/CSKA-Roma_%281%29.jpg",
  "7b8242b67063867a": "https://upload.wikimedia.org/wikipedia/commons/6/64/Sergio_Almiron.jpg",
  "8b8dfe5f96143e0e": "https://upload.wikimedia.org/wikipedia/it/1/17/Fabio_Rossitto.jpg",
  "31d82f18d47cc32a": "https://upload.wikimedia.org/wikipedia/commons/b/bf/CSKA-Roma_%284%29.jpg",
  "31afed3def5756ea": "https://upload.wikimedia.org/wikipedia/commons/f/fe/Higua%C3%ADn_20180626.jpg",
  "49cec9b97ec28240": "https://upload.wikimedia.org/wikipedia/commons/6/6d/Kak%C3%A1_visited_Stadium_St._Petersburg.jpg",
  "1f3a4b7d0552b87d": "https://upload.wikimedia.org/wikipedia/commons/5/5f/Guillermo_Giacomazzi.jpg",
  "a72def8a2ca6f530": "https://upload.wikimedia.org/wikipedia/commons/a/af/Federico_Ceccherini.jpg",
  "69647ffecf39dfdf": "https://upload.wikimedia.org/wikipedia/commons/0/0e/Valter_Birsa_2013.jpg",
  "d68e1908de529b24": "https://upload.wikimedia.org/wikipedia/it/3/33/Davide_Baiocco_-_AC_Perugia_2000-01.jpg",
  "10cdbd0f4317a87f": "https://upload.wikimedia.org/wikipedia/commons/4/4d/Calabria2022Salzburg.jpg",
  "c6c9ec88df6a0983": "https://upload.wikimedia.org/wikipedia/commons/d/d2/Federico_Balzaretti_Udinese_Wikipedia.jpg",
  "452dd9a55c31e45c": "https://upload.wikimedia.org/wikipedia/commons/5/56/Alessandro_Gazzi_in_Torino-Zenit.jpg",
  "6e32d380761cf1bf": "https://upload.wikimedia.org/wikipedia/commons/2/23/Oliver_Bierhoff%2C_Germany_national_football_team_%2802%29.jpg",
  "1ee59b6ab43acfb7": "https://upload.wikimedia.org/wikipedia/it/2/21/Marco_Di_Loreto_-_AC_Perugia_2000-01.jpg",
  "ad735568ae7b14d0": "https://upload.wikimedia.org/wikipedia/commons/1/14/Mauro_Icardi_en_2025.jpg",
  "1952aa08ab94f598": "https://upload.wikimedia.org/wikipedia/it/3/3c/Pasquale_Padalino_Foggia_1994.jpg",
  "4772664ce914180c": "https://upload.wikimedia.org/wikipedia/commons/8/88/Hugo_Campagnaro_-_SSC_Neapel_%281%29.jpg",
  "536e8a89da1fe1fc": "https://upload.wikimedia.org/wikipedia/commons/4/4e/Andrea_Ranocchia_FC_Internazionale.jpg",
  "6a8b3e2a724fa0f7": "https://upload.wikimedia.org/wikipedia/commons/c/ca/JoaoPedro2022_%28cropped%29.png",
  "8149e842da11fcd1": "https://upload.wikimedia.org/wikipedia/it/e/e3/Daniel_Fonseca_%28Cagliari_Calcio%29.jpg",
  "7e141d57423c4ba9": "https://upload.wikimedia.org/wikipedia/commons/b/b2/Coda_UDI-ATA_1-3.jpg",
  "3caf18ab3dfc3175": "https://upload.wikimedia.org/wikipedia/commons/4/41/Henrikh_Mkhitaryan_2017.jpg",
  "29bc2d9f111b8328": "https://upload.wikimedia.org/wikipedia/commons/b/b2/Alvaro_Recoba.jpg",
  "3a762f55e94d9024": "https://upload.wikimedia.org/wikipedia/commons/1/13/Nicolas_frey.JPG",
  "f0c8068245804de3": "https://upload.wikimedia.org/wikipedia/commons/7/75/Michele_Canini.JPG",
  "e596b68b19d1f8de": "https://upload.wikimedia.org/wikipedia/commons/e/ea/Maxi_Lopez_Catania.jpg",
  "3129e1451f560c88": "https://upload.wikimedia.org/wikipedia/commons/f/f4/Norway_Italy_-_June_2025_B_33_-_Gianluigi_Donnarumma_%28close-up%29.jpg",
  "99019767e03414b2": "https://upload.wikimedia.org/wikipedia/commons/6/6c/LucaAntonelli_%28cropped%29.jpg",
  "7675fc81194f38d0": "https://upload.wikimedia.org/wikipedia/commons/3/3f/Rolando_Bianchi_01_%28edited%29.jpg",
  "3a38904844add672": "https://upload.wikimedia.org/wikipedia/commons/d/dd/Cesar.JPG",
  "c1ddc44f2a513890": "https://upload.wikimedia.org/wikipedia/commons/5/51/Dusan_Vlahovic_%28cropped%29.jpg",
  "8cec75de6098255f": "https://upload.wikimedia.org/wikipedia/commons/9/9f/DK-Porto15_%2810%29.jpg",
  "d81e2ff9e7eb8d82": "https://upload.wikimedia.org/wikipedia/commons/6/6d/Thomas_manfredini.JPG",
  "8db5976d13606536": "https://upload.wikimedia.org/wikipedia/commons/9/95/David_Trezeguet_became_Save_the_Dream_Ambassador%2C_2017.jpg",
  "896c687bab523dc2": "https://upload.wikimedia.org/wikipedia/commons/4/49/Matteo_Sereni.jpg",
  "91f0654ead398e55": "https://upload.wikimedia.org/wikipedia/it/9/96/Marco_Simone_-_Milan_AC_1993-94.jpg",
  "302acb82959b3729": "https://upload.wikimedia.org/wikipedia/it/a/a0/Arturo_Di_Napoli_-_SSC_Napoli_1996-97.jpg",
  "30fa90927835c0ec": "https://upload.wikimedia.org/wikipedia/commons/9/9f/Edinson_Cavani_2018_%28cropped%29.jpg",
  "90383d43dae6ef15": "https://upload.wikimedia.org/wikipedia/it/6/62/Per_Kr%C3%B8ldrup_-_Udinese_Calcio_2003-04.jpg",
  "afa48dc10ab0a259": "https://upload.wikimedia.org/wikipedia/commons/7/79/20150616_-_Portugal_-_Italie_-_Gen%C3%A8ve_-_Andrea_Bertolacci_1_%28cropped%29.jpg",
  "a1621460f3077aa6": "https://upload.wikimedia.org/wikipedia/it/9/93/Champions_League_1997-98_-_Juventus_vs_Manchester_Utd_-_Mark_Iuliano.jpg",
  "7346def336ab1a20": "https://upload.wikimedia.org/wikipedia/it/3/33/Daniele_Delli_Carri_-_1994_-_Genoa.png",
  "28969a60d32f542b": "https://upload.wikimedia.org/wikipedia/commons/6/6b/Robin_Gosens_01_%28cropped%29.jpg",
  "3886679867384786": "https://upload.wikimedia.org/wikipedia/commons/1/1b/IMG_Palladino_Atalanta.jpg",
  "350e0c7f4e5e5b6a": "https://upload.wikimedia.org/wikipedia/commons/b/bc/Semioli_%282%29.jpg",
  "5d6e39102c8f4633": "https://upload.wikimedia.org/wikipedia/commons/d/db/Davide_Faraoni.jpg",
  "eaafc935dab32d2a": "https://upload.wikimedia.org/wikipedia/commons/5/50/Alexis_S%C3%A1nchez_2017.jpg",
  "b936104b9bdf948a": "https://upload.wikimedia.org/wikipedia/commons/9/9a/Russia-Moldova_%2816%29.jpg",
  "92037e14ea1662b0": "https://upload.wikimedia.org/wikipedia/commons/9/92/Luperto2024.png",
  "4fb062621975b63f": "https://upload.wikimedia.org/wikipedia/commons/1/13/AlessioCerci_FInotti.jpg",
  "02b738ef16e91b6a": "https://upload.wikimedia.org/wikipedia/commons/4/43/Franck_Yannick_Kessi%C3%A9.jpg",
  "77b37f93bcb06d0d": "https://upload.wikimedia.org/wikipedia/commons/8/85/Ivan_Peri%C5%A1i%C4%87_%28cropped%29.jpg",
  "1649fe34232aab23": "https://upload.wikimedia.org/wikipedia/it/9/90/Mauro_Bressan_Fiorentina.png",
  "5a199c30ce8d52f7": "https://upload.wikimedia.org/wikipedia/commons/2/2c/20150616_-_Portugal_-_Italie_-_Gen%C3%A8ve_-_Mattia_De_Sciglio_1.jpg",
  "46cc360202df2d4d": "https://upload.wikimedia.org/wikipedia/commons/c/cd/Bartosz_Bereszy%C5%84ski.jpg",
  "653fe352f21e7519": "https://upload.wikimedia.org/wikipedia/it/c/c4/Associazione_Calcio_Fiorentina_2000-01.jpg",
  "f52800354ca59a4d": "https://upload.wikimedia.org/wikipedia/commons/b/b6/Emil_Audero%2C_2023_%28cropped%29.png",
  "75ed0c4e8e23a45c": "https://upload.wikimedia.org/wikipedia/commons/e/e1/Fabio_Grosso_-_Frosinone_Calcio_-_DSC_2731_AF_%28cropped%29.jpg",
  "d074427f33bb3b7d": "https://upload.wikimedia.org/wikipedia/commons/2/25/Jonathan_Biabiany.jpg",
  "a0883adb026c549d": "https://upload.wikimedia.org/wikipedia/commons/9/91/Caputo_%28crop%29.jpg",
  "e094efed1dc08ec1": "https://upload.wikimedia.org/wikipedia/commons/5/51/Castellini_%282%29.jpg",
  "5ec226e0842bfe8d": "https://upload.wikimedia.org/wikipedia/commons/0/0c/Dida-wikipedia_%28cropped_2%29.png",
  "80534053b7616e66": "https://upload.wikimedia.org/wikipedia/commons/f/f0/Omar_Milanetto.jpg",
  "035a5948fdc71868": "https://upload.wikimedia.org/wikipedia/commons/5/5f/Ighli_Vannucchi_1.jpg",
  "9d13186517377861": "https://upload.wikimedia.org/wikipedia/it/a/ac/Em%C3%ADlson_Cribari_-_Empoli_FC_2002-03.jpg",
  "904375eb8907555a": "https://upload.wikimedia.org/wikipedia/it/f/fa/Emanuele_Filippini.JPG",
  "5b7394e5545d1f8f": "https://upload.wikimedia.org/wikipedia/it/8/80/Massimo_Tarantino.jpg",
  "a8ad49e27048fdb5": "https://upload.wikimedia.org/wikipedia/commons/a/ad/AlexisSaelemaekers2022Salzburg.jpg",
  "04c7ad836328e7fd": "https://upload.wikimedia.org/wikipedia/commons/5/52/Pepe_Reina_2017.jpg",
  "251fa0bc56552293": "https://upload.wikimedia.org/wikipedia/it/e/e6/Vladimir_Jugovi%C4%87_-_UC_Sampdoria_1994-95.jpg",
  "72c52eaebbff56de": "https://upload.wikimedia.org/wikipedia/it/4/48/Jos%C3%A8_Chamot_Lazio_1994-1995.jpg",
  "611dd7c650679b78": "https://upload.wikimedia.org/wikipedia/commons/f/ff/Alessandro_Diamanti_2012_%28cropped%29_-_2.jpg",
  "a3615f96d4da99db": "https://upload.wikimedia.org/wikipedia/commons/b/b1/Gennaro_Sardo.jpg",
  "3af079334efabf23": "https://upload.wikimedia.org/wikipedia/commons/e/e6/Basta_UDI-ATA_1-3.jpg",
  "6e8f7cdbe61d2275": "https://upload.wikimedia.org/wikipedia/commons/9/99/Emerson_2005.jpg",
  "c86e816f05fc7aef": "https://upload.wikimedia.org/wikipedia/commons/b/b5/Francesco_Lodi_con_la_maglia_del_FC_Messina.jpg",
  "fa82571a47c82312": "https://upload.wikimedia.org/wikipedia/commons/4/4c/Acquafresca.png",
  "61b6fffd39a8b8a4": "https://upload.wikimedia.org/wikipedia/commons/3/3e/Augello2024.png",
  "2c1ac5fe0718621a": "https://upload.wikimedia.org/wikipedia/commons/0/03/Keita_Bald%C3%A9_2022.jpg",
  "2315b19a713e20ff": "https://upload.wikimedia.org/wikipedia/commons/e/e6/Spolli_UDI-CAT_4-2.jpg",
  "d2a71e6e62cb6625": "https://upload.wikimedia.org/wikipedia/commons/9/9e/Antonio_Busc%C3%A8_%28cropped%29.jpg",
  "6a1480dd6a3f6006": "https://upload.wikimedia.org/wikipedia/it/5/51/Christian_Obodo_-_AC_Perugia_2003-04.jpg",
  "a68bd9c51913079e": "https://upload.wikimedia.org/wikipedia/commons/f/fd/Ricardo_Rodr%C3%ADguez_2018.jpg",
  "3e6d725ff1f8abe7": "https://upload.wikimedia.org/wikipedia/commons/2/2e/Elif_Elmas_2021.jpg",
  "293949978078b6af": "https://upload.wikimedia.org/wikipedia/it/9/9a/Giovanni_Bia_-_Bologna_FC_1909_1999-2000.jpg",
  "91e9f922ae1dbd8c": "https://upload.wikimedia.org/wikipedia/commons/3/39/FC_Salzburg_vs._AC_Mailand_%28UEFA_Championsleague_2022-09-06%29_Th%C3%A9o_Hernandez.jpg",
  "0b04a054bdb077cf": "https://upload.wikimedia.org/wikipedia/commons/c/cb/Zvonimir_Boban_in_2018.jpg",
  "5dad5c1d7674fa1e": "https://upload.wikimedia.org/wikipedia/it/c/c6/Daniele_Adani_-_Brescia_Calcio_1998-99.jpg",
  "16629667dd4d2ed6": "https://upload.wikimedia.org/wikipedia/commons/5/51/Galloppa.JPG",
  "fc0f3c54b7cfcded": "https://upload.wikimedia.org/wikipedia/commons/3/3f/Joaqu%C3%ADn_Correa_2020.jpg",
  "b030795e64522746": "https://upload.wikimedia.org/wikipedia/commons/f/fa/Fenerbah%C3%A7e_-_Cagliari_Calcio_20170807_%28227%29.jpg",
  "276607f85583cb08": "https://upload.wikimedia.org/wikipedia/commons/4/42/Matteo_Contini.JPG",
  "d07c015fc77aa84b": "https://upload.wikimedia.org/wikipedia/commons/3/32/Jose_Luis_Palomino.jpg",
  "155b5847d8cb1780": "https://upload.wikimedia.org/wikipedia/commons/5/59/20150331_Mali_vs_Ghana_024_%28cropped%29.jpg",
  "13c184ddf25dac45": "https://upload.wikimedia.org/wikipedia/commons/2/2c/Edgar_Davids.jpg",
  "4c4d5ccff8619c2d": "https://upload.wikimedia.org/wikipedia/commons/3/39/Sebastian_Giovinco_2015-05-23_Toronto_FC_%28edited%29.jpg",
  "35c7439b7ba0e5f7": "https://upload.wikimedia.org/wikipedia/commons/0/07/Aleksandar_Kolarov_2018.jpg",
  "2b225272a77223e7": "https://upload.wikimedia.org/wikipedia/commons/5/51/AC_Monza_2022_Serie_A_celebration_30_%28Paletta%29.jpg",
  "9324d9ceb9829873": "https://upload.wikimedia.org/wikipedia/commons/5/5e/FC_Nordsj%C3%A6lland_-_Juventus_FC%2C_23_October_2012_%28Mauricio_Isla%29.jpg",
  "12060e8c2e3107d4": "https://upload.wikimedia.org/wikipedia/commons/3/37/Igor_Budan.JPG",
  "9339d25666092cf8": "https://upload.wikimedia.org/wikipedia/commons/1/15/Marco_Storari_2012_%28edited%29_%28cropped%29.jpg",
  "81325a24b685852f": "https://upload.wikimedia.org/wikipedia/commons/9/98/Kimenti.png",
  "33522c563b81d5fd": "https://upload.wikimedia.org/wikipedia/it/5/5c/Serie_A_1998-99_-_Salernitana_vs_Bari_-_Gaetano_De_Rosa%2C_Gennaro_Gattuso.jpg",
  "21e3ab82e0c7986a": "https://upload.wikimedia.org/wikipedia/commons/0/0a/FC_Salzburg_gegen_SSC_Napoli_%28Championsleague_3._Runde_23._Oktober_2019%29_78.jpg",
  "124e0465596759f5": "https://upload.wikimedia.org/wikipedia/commons/5/5a/Rabiot_asse_om_2425.png",
  "e4af26b5363cc257": "https://upload.wikimedia.org/wikipedia/it/1/17/Nicola_Ventola_-_FC_Inter_1998-99.jpg",
  "5c0beedf3efa1c76": "https://upload.wikimedia.org/wikipedia/it/5/55/Nicola_Caccia_-_SSC_Napoli_1996-97.jpg",
  "3f2586b598cac435": "https://upload.wikimedia.org/wikipedia/commons/5/59/Gary_Medel_Footballteam_of_Chile_-_Spain_vs._Chile%2C_10th_September_2013_%28cropped%29.jpg",
  "afa6ecf94666152a": "https://upload.wikimedia.org/wikipedia/commons/5/53/FC_Salzburg_gegen_Inter_Mailand_%28Testspiel_2023-08-09%29_48.jpg",
  "413d592ca9164cfe": "https://upload.wikimedia.org/wikipedia/commons/4/49/UEFA_EURO_qualifiers_Sweden_vs_Spain_20191015_136_%28cropped%29.jpg",
  "087b5a9c3495ee6b": "https://upload.wikimedia.org/wikipedia/commons/8/8e/Gianluca_Curci.jpg",
  "d32fa6046c6a4347": "https://upload.wikimedia.org/wikipedia/commons/e/e1/Deiola2024.png",
  "42eadcc65ce8a47b": "https://upload.wikimedia.org/wikipedia/commons/c/c3/Matteo_Pessina_%28cropped%29.jpg",
  "8277268e21cb851b": "https://upload.wikimedia.org/wikipedia/commons/c/c5/Serginho.jpg",
  "388431eede5c925f": "https://upload.wikimedia.org/wikipedia/commons/c/c0/AUT_vs._MDA_2015-09-05_%28026%29.jpg",
  "a3f79a7c786265a8": "https://upload.wikimedia.org/wikipedia/commons/7/79/Marcelo_Zalayeta.jpg",
  "ba454dd88749f47d": "https://upload.wikimedia.org/wikipedia/commons/d/d9/Mascara_tifosi.jpg",
  "d46594e0debd103e": "https://upload.wikimedia.org/wikipedia/commons/7/72/Monaco-Zenit_%282%29.jpg",
  "a2e3cf4724990375": "https://upload.wikimedia.org/wikipedia/it/2/27/Federico_Giunti_-_1996_-_AC_Perugia.jpg",
  "0a189b7586e0dfe0": "https://upload.wikimedia.org/wikipedia/commons/2/2e/Massimo_Paci..jpg",
  "d7b505d5d35d2162": "https://upload.wikimedia.org/wikipedia/commons/1/1d/Jo%C3%A3o_Pedro%2C_2025_FIFA_Club_World_Cup_final_%2854654843615%29.jpg",
  "34af5ae657af8c99": "https://upload.wikimedia.org/wikipedia/commons/1/19/%D0%A0%D1%83%D1%81%D0%BB%D0%B0%D0%BD_%D0%9C%D0%B0%D0%BB%D1%96%D0%BD%D0%BE%D0%B2%D1%81%D1%8C%D0%BA%D0%B8%D0%B9_%28cropped%29.jpg",
  "8c951accdd41c9b5": "https://upload.wikimedia.org/wikipedia/commons/7/77/Hernanes_%282010%29.JPG",
  "2b07a25e8546c1b6": "https://upload.wikimedia.org/wikipedia/it/2/2f/Stefano_Eranio_-_Genoa_1893_1991-92.jpg",
  "9461a4372c2d51a8": "https://upload.wikimedia.org/wikipedia/commons/d/dc/Igli_Tare_%28cropped%29.JPG",
  "7e73c11a72fd93a4": "https://upload.wikimedia.org/wikipedia/commons/4/4c/William_Viali_coach_Reggiana.jpg",
  "60a12e67def80e25": "https://upload.wikimedia.org/wikipedia/commons/b/b7/Kamil_Glik_2018.jpg",
  "8b3b89122eeb8b45": "https://upload.wikimedia.org/wikipedia/commons/c/ce/Chelsea_Legends_1_Inter_Forever_4_%2828453497528%29_-_Francesco_Colonnese_%28cropped%29.jpg",
  "e7ce87a8ac1f1a15": "https://upload.wikimedia.org/wikipedia/commons/3/34/Obiang_West_Ham_2015.jpg",
  "7da4be29e497e338": "https://upload.wikimedia.org/wikipedia/commons/e/eb/Hidetoshi_Nakata_in_Okinawa.jpg",
  "d9a4e9be548aa4c5": "https://upload.wikimedia.org/wikipedia/commons/0/00/Andrea_Costa_%282%29.jpg",
  "8df99b24fe1f2e34": "https://upload.wikimedia.org/wikipedia/commons/3/37/Bruno_Cirillo.jpg",
  "41f6d8bced4ebc6a": "https://upload.wikimedia.org/wikipedia/commons/7/7e/PA110032Seitaridis.jpg",
  "867f4de8e0ace594": "https://upload.wikimedia.org/wikipedia/commons/7/72/Luca_Antonini.jpg",
  "4f4534c2c076756e": "https://upload.wikimedia.org/wikipedia/commons/5/5e/20140905_U21_AUT_BIH_BIH23_1036.jpg",
  "cfabe901a68b879e": "https://upload.wikimedia.org/wikipedia/commons/6/6e/Sevilla-SM_%284%29_%28cropped%29.jpg",
  "0137bf46f0aa1d38": "https://upload.wikimedia.org/wikipedia/commons/8/8a/Mart%C3%ADn_C%C3%A1ceres_against_Chile.jpg",
  "90e4553633e68ffa": "https://upload.wikimedia.org/wikipedia/commons/d/d3/Andrea_Dossena.jpg",
  "96602893e8db4651": "https://upload.wikimedia.org/wikipedia/it/e/e2/Salvatore_Fresi.jpg",
  "c36d2ae7b914e54e": "https://upload.wikimedia.org/wikipedia/commons/3/37/20150331_Mali_vs_Ghana_148.jpg",
  "b80dedd262542ad7": "https://upload.wikimedia.org/wikipedia/commons/5/5e/USAvVEN_2019-06-09_-_Weston_McKennie_%2851170534993%29_%28close-up%29.jpg",
  "61f083108fac5262": "https://upload.wikimedia.org/wikipedia/commons/b/bc/Simone_Zaza.jpg",
  "738f3c0d433d9dc3": "https://upload.wikimedia.org/wikipedia/commons/c/ca/Fabrizio_Cacciatore.jpg",
  "77836fafbca423ef": "https://upload.wikimedia.org/wikipedia/commons/f/fe/Andrea_Mantovani_09-2018.jpg",
  "e6b977659eb243a2": "https://upload.wikimedia.org/wikipedia/commons/d/da/Emmanuel_Gyasi_Match_Football_Spezia_Calcio_x_US_Sassuolo_Calcio_Stade_Alberto_Picco_-_La_Spezia_%28IT42%29_-_2022-08-27_-_8_%28cropped%29.jpg",
  "58cf36ae5e7680c3": "https://upload.wikimedia.org/wikipedia/commons/8/8e/Stefano_Okaka.jpg",
  "80b0625dbd466570": "https://upload.wikimedia.org/wikipedia/it/1/10/Fabio_Moro_-_AC_ChievoVerona_2002-03.jpg",
  "cf0beee22696dcab": "https://upload.wikimedia.org/wikipedia/commons/5/5d/Iceland_national_football_team_World_Cup_2018_%28cropped%29.jpg",
  "e11f4f154a3dfe5f": "https://upload.wikimedia.org/wikipedia/commons/6/6b/Norway_Italy_-_June_2025_A_27_%28Daniele_Rugani%29.jpg",
  "96bbdebf2de69e45": "https://upload.wikimedia.org/wikipedia/commons/4/48/Iago_Falque.jpg",
  "4bc9a511e24024c2": "https://upload.wikimedia.org/wikipedia/it/5/50/Gianluca_Festa_-_Cagliari_Calcio_1991-92.jpg",
  "4a4901e13c1cf26e": "https://upload.wikimedia.org/wikipedia/commons/9/9b/Marco_Motta.jpg",
  "3b492eca47b1422b": "https://upload.wikimedia.org/wikipedia/commons/2/22/Albano_Bizzarri.jpg",
  "e6ddd5434f809f47": "https://upload.wikimedia.org/wikipedia/commons/c/cd/DK-Lazio_%285%29.jpg",
  "9b40a64cdcd889fd": "https://upload.wikimedia.org/wikipedia/commons/0/00/Patrick_Cutrone_2021.png",
  "79d917dd647aea22": "https://upload.wikimedia.org/wikipedia/commons/0/0b/FC_Zenit_Saint_Petersburg_vs._Juventus%2C_20_October_2021_64_-_Moise_Kean_%28cropped%29.jpg",
  "7ff3b7b09bcfdcc1": "https://upload.wikimedia.org/wikipedia/commons/c/c2/Lens_-_Torino_FC_%2802-08-2023%29_14.jpg",
  "def6d843997c72dd": "https://upload.wikimedia.org/wikipedia/commons/2/24/Milan_Lecce_2023_Falcone.jpg",
  "0ca0d66a49871a18": "https://upload.wikimedia.org/wikipedia/commons/a/a2/Chile_VS._Australia_%2813%29_2017-6-25_Arturo_Vidal.jpg",
  "9bf55cd288107527": "https://upload.wikimedia.org/wikipedia/commons/1/11/Federico_Bonazzoli_20140802.jpg",
  "0faa29972b44c940": "https://upload.wikimedia.org/wikipedia/it/4/44/Riccardo_Maspero.jpg",
  "7b90a65cd1a46e87": "https://upload.wikimedia.org/wikipedia/commons/a/a9/Marco_Biagianti_a_Massannunziata.JPG",
  "09c2984d04e45ae2": "https://upload.wikimedia.org/wikipedia/commons/2/22/Davide_Mandelli.JPG",
  "9477f7c620794e32": "https://upload.wikimedia.org/wikipedia/commons/8/86/Federico_Fazio_%28cropped%29.jpg",
  "7e187dcedd2bedeb": "https://upload.wikimedia.org/wikipedia/commons/2/2c/BennacerLeB2022.jpg",
  "4bae41aa941b3741": "https://upload.wikimedia.org/wikipedia/commons/6/63/Francesco_%22CICCIO%22_Tavano.jpg",
  "cd7304391bbcde5b": "https://upload.wikimedia.org/wikipedia/commons/7/7a/Calai%C3%B2.jpg",
  "eb1f5e74d3725ff3": "https://upload.wikimedia.org/wikipedia/commons/f/ff/Vanja_Milinkovic_Savic_WC2022.jpg",
  "eb5c5883bb88e660": "https://upload.wikimedia.org/wikipedia/it/1/14/Serie_B_1994-95_-_Perugia_vs_Fidelis_Andria_-_Giacomo_Dicara.jpg",
  "a41ec05b487dbbc6": "https://upload.wikimedia.org/wikipedia/commons/e/e7/Vince_Grella_%28cropped%29.jpg",
  "030028bf724c6674": "https://upload.wikimedia.org/wikipedia/commons/c/cd/Giuseppe_Vives_in_Zenit-Torino.jpg",
  "40de04699d607d8e": "https://upload.wikimedia.org/wikipedia/commons/d/da/Luigi_Sepe_2015_%28cropped%29.jpg",
  "69e47c5f4dc052bf": "https://upload.wikimedia.org/wikipedia/it/6/6e/Giuseppe_Taglialatela_-_SSC_Napoli_1996-97.jpg",
  "721fe6aa341e8999": "https://upload.wikimedia.org/wikipedia/commons/4/4e/Jakub_Jankto%2C_Czech_Rp.-Montenegro_EURO_2020_QR_10-06-2019.jpg",
  "0a6ed936701eb51f": "https://upload.wikimedia.org/wikipedia/commons/7/7e/Gast%C3%B3n_Ram%C3%ADrez_against_Chile.jpg",
  "60df6fb0ca18bf01": "https://upload.wikimedia.org/wikipedia/commons/f/f2/Johan_V%C3%A1squez.jpg",
  "c808e11e320fbe61": "https://upload.wikimedia.org/wikipedia/it/e/ec/Marco_Ferrante_-_Torino_Calcio_1999-2000.jpg",
  "46ba5ea378c21735": "https://upload.wikimedia.org/wikipedia/it/9/95/Massimiliano_Esposito.JPG",
  "244ff32197f1b990": "https://upload.wikimedia.org/wikipedia/commons/8/8d/Dinamo-Napoli_%288%29.jpg",
  "2f69f563fdd73e88": "https://upload.wikimedia.org/wikipedia/it/a/a3/Serie_A_2001-02_-_Chievo_vs_Lecce_-_Perrotta_e_Conticchio.jpg",
  "b6435d690671bd6b": "https://upload.wikimedia.org/wikipedia/commons/b/b3/Gilletbologna.png",
  "fd1dfcb7339f4c4f": "https://upload.wikimedia.org/wikipedia/commons/e/e7/Cristian_Ansaldi_6777.jpg",
  "a3e8b37640db745b": "https://upload.wikimedia.org/wikipedia/commons/9/9f/Fenerbah%C3%A7e_-_Cagliari_Calcio_20170807_%28104%29.jpg",
  "7913bc43c0715da6": "https://upload.wikimedia.org/wikipedia/commons/7/7e/Musso_Udinese.png",
  "c23ca6f5dcc41322": "https://upload.wikimedia.org/wikipedia/commons/5/5a/%D0%9C%D0%B0%D1%82%D1%87_%C2%AB%D0%94%D0%B8%D0%BD%D0%B0%D0%BC%D0%BE%C2%BB_-_%C2%AB%D0%A8%D0%B0%D1%85%D1%82%D0%B0%D1%80%C2%BB_0-0._3_%D0%B6%D0%BE%D0%B2%D1%82%D0%BD%D1%8F_2021_%D1%80%D0%BE%D0%BA%D1%83_%E2%80%94_1279025_%28cropped%29.jpg",
  "28b49e7ee87c63f5": "https://upload.wikimedia.org/wikipedia/commons/8/89/Jaime_Valdes_UDI-ATA_1-3.jpg",
  "2250f77f081f0972": "https://upload.wikimedia.org/wikipedia/commons/3/3b/Fenerbah%C3%A7e_-_Cagliari_Calcio_20170807_%28221%29_%28cropped2%29.jpg",
  "ed185e21cbbdd14b": "https://upload.wikimedia.org/wikipedia/commons/0/07/Pasquale_Foggia_at_Auronzo.JPG",
  "3a56871989f41054": "https://upload.wikimedia.org/wikipedia/commons/7/76/Marco_Pisano_%28cropped%29.jpg",
  "f2aa06fbe411261a": "https://upload.wikimedia.org/wikipedia/commons/4/43/Razvan_Marin_%28cropped%29_-_Sweden_vs_Romaina_23_March_2019.jpg",
  "f4e73224cc9dbcf7": "https://upload.wikimedia.org/wikipedia/commons/9/95/Raspadori_Nazionale.jpg",
  "3531d72968b62dec": "https://upload.wikimedia.org/wikipedia/commons/e/e9/Charis_Lykogiannis_%28cropped%29.jpg",
  "f7e03ab2e270adcc": "https://upload.wikimedia.org/wikipedia/commons/8/8a/Gennaro_Delvecchio.jpg",
  "f4e5fb23b7378e71": "https://upload.wikimedia.org/wikipedia/commons/1/13/Enzo_Maresca_20042025_%282%29.jpg",
  "30eba128d406550f": "https://upload.wikimedia.org/wikipedia/commons/3/32/Lucas_Biglia.jpg",
  "2e95a652bd73061d": "https://upload.wikimedia.org/wikipedia/commons/c/c7/Veretout_asse_ol_2425.png",
  "93197d5fa0972d56": "https://upload.wikimedia.org/wikipedia/commons/1/10/AlessRosina.jpg",
  "289454f29794fe9a": "https://upload.wikimedia.org/wikipedia/commons/e/e1/Mike_Maignan_2022_Salzburg_vs_AC_Milan_2022-09-06.jpg",
  "fad963330a935cdb": "https://upload.wikimedia.org/wikipedia/commons/f/fa/Konko_%28cropped%29.jpg",
  "c9df02464977d810": "https://upload.wikimedia.org/wikipedia/commons/5/5a/Universidad_de_Chile_-_Deportes_Antofagasta%2C_2018-03-04_-_Mauricio_Pinilla_-_03_%28cropped%29.jpg",
  "569c090db554c43a": "https://upload.wikimedia.org/wikipedia/it/f/f6/Marco_Schenardi_-_Ternana_Calcio.jpg",
  "ca0685223f04dca9": "https://upload.wikimedia.org/wikipedia/it/a/a2/Lorenzo_D%27Anna_-_AC_ChievoVerona_2002-03.jpg",
  "9c73e09b106d1f9b": "https://upload.wikimedia.org/wikipedia/commons/e/ee/Adam_Masina_Udinese.jpg",
  "4d32b471dba6a8dd": "https://upload.wikimedia.org/wikipedia/it/d/db/Francesco_Statuto_-_AS_Roma_1994-95.png",
  "501e4417842b3a94": "https://upload.wikimedia.org/wikipedia/it/2/2a/Vittorio_Tosto_-_Salernitana_Sport_1998-99.jpg",
  "e9003f4fe0abb8f2": "https://upload.wikimedia.org/wikipedia/commons/4/47/Babacar_khouma_%282%29_%28cropped%29.JPG",
  "133748904acd2e86": "https://upload.wikimedia.org/wikipedia/commons/f/fd/%C3%81lvaro_Morata.jpg",
  "3e9336c1fcc43b9d": "https://upload.wikimedia.org/wikipedia/commons/7/72/Gabriele_Zappa%2C_2021_%28cropped%29.jpg",
  "a9fbef0c87d59396": "https://upload.wikimedia.org/wikipedia/commons/d/de/Igor_Kolyvanov_2017.jpg",
  "1149be054bf2b3df": "https://upload.wikimedia.org/wikipedia/commons/8/84/Thomas_Strakosha01.jpg",
  "10f5a3418a43c0aa": "https://upload.wikimedia.org/wikipedia/commons/1/11/Norway_Italy_-_June_2025_E_24_%28cropped%29.jpg",
  "88d70dbd0d5c7285": "https://upload.wikimedia.org/wikipedia/commons/3/39/Daniele_Mannini.jpg",
  "533d7229fd33b469": "https://upload.wikimedia.org/wikipedia/commons/a/af/Emanuele_Giaccherini_BGR-ITA_2012.jpg",
  "b26935fe127787de": "https://upload.wikimedia.org/wikipedia/it/3/3f/Fabrizio_Ficini_-_Empoli_FC_1997-98.jpg",
  "ffea761e3429dfd5": "https://upload.wikimedia.org/wikipedia/commons/3/35/Alberto-valentim-palmeiras-2016_%28cropped%29.png",
  "ddc2af135d5f8bae": "https://upload.wikimedia.org/wikipedia/commons/3/3c/Filip_%C4%90uri%C4%8Di%C4%87.jpg",
  "d24b0cf0897a73c0": "https://upload.wikimedia.org/wikipedia/commons/1/1a/Daniel.Andersson.png",
  "d93ac9afe4ff9341": "https://upload.wikimedia.org/wikipedia/it/3/33/Fausto_Rossini_-_Atalanta_BC_2000-01.jpg",
  "6cc101cb405e4f00": "https://upload.wikimedia.org/wikipedia/commons/6/66/Mattia_Bani.jpg",
  "bcd38b362b2063ff": "https://upload.wikimedia.org/wikipedia/commons/7/72/Juan_Camilo_Z%C3%BA%C3%B1iga_-_SSC_Neapel_%281%29.jpg",
  "954ece79bf836289": "https://upload.wikimedia.org/wikipedia/commons/3/36/Fernando_Tissone.jpg",
  "e7947a4bcbcfafc7": "https://upload.wikimedia.org/wikipedia/it/6/6b/Renato_Olive_-_AC_Perugia_1998-99.jpg",
  "4bf21f18c6bb5d70": "https://upload.wikimedia.org/wikipedia/commons/7/78/Alg%C3%A9rie_-_Arm%C3%A9nie_-_20140531_-_Saphir_Taider.jpg",
  "0d70cdb7e0ec4775": "https://upload.wikimedia.org/wikipedia/it/e/e4/Massimiliano_Cappellini_-_Empoli_FC_1997-98.jpg",
  "d94b5702de1c9748": "https://upload.wikimedia.org/wikipedia/commons/6/66/FC_Salzburg_vs._AC_Mailand_%28UEFA_Championsleague_2022-09-06%29_42.jpg",
  "e3658d1ec9f7d16b": "https://upload.wikimedia.org/wikipedia/commons/4/4b/Lens_-_Torino_FC_%2802-08-2023%29_35_%28cropped%29.jpg",
  "880801201cfb84f0": "https://upload.wikimedia.org/wikipedia/commons/7/72/PierreKalulu2022.jpg",
  "f436356f96b667e9": "https://upload.wikimedia.org/wikipedia/commons/c/c3/Ivan_Franceschini.jpg",
  "d2590e4963d99700": "https://upload.wikimedia.org/wikipedia/commons/2/24/Rus-Arg_2017_%285%29.jpg",
  "983d3578f1dacbfe": "https://upload.wikimedia.org/wikipedia/commons/8/86/Lapadula2024.png",
  "2079273c39b2c97c": "https://upload.wikimedia.org/wikipedia/commons/a/a3/20130814_AT-GR_Panagiotis_Kone_2371.jpg",
  "cdec7cd301a40fbf": "https://upload.wikimedia.org/wikipedia/commons/4/4b/Alg%C3%A9rie_-_Arm%C3%A9nie_-_20140531_-_Faouzi_Ghoulam_%28cropped%29.jpg",
  "7d2da4f9ec0b5876": "https://upload.wikimedia.org/wikipedia/it/1/17/Michele_Paramatti_-_Bologna_FC_1909_1996-97.jpg",
  "f3b80c72704fb7c5": "https://upload.wikimedia.org/wikipedia/commons/2/2a/Walace_Souza_Silva_-_Rio_2016.jpg",
  "29fd6383fb8b6707": "https://upload.wikimedia.org/wikipedia/it/9/92/Fabio_Gallo_-_Atalanta_BC_2000-01.jpg",
  "562963d294fc6e6b": "https://upload.wikimedia.org/wikipedia/it/d/d6/Stephen_Appiah_-_Udinese_Calcio_1997-98.jpg",
  "93afd7697a75f46e": "https://upload.wikimedia.org/wikipedia/commons/6/63/Diego_Milito_%2822677058983%29_%28cropped%29.jpg",
  "926adaa22abc2e54": "https://upload.wikimedia.org/wikipedia/commons/7/72/Chelsea-Roma_%284%29_%28cropped%29.jpg",
  "96e7f16c52f0c0bd": "https://upload.wikimedia.org/wikipedia/commons/2/2a/Luca_Vigiani.jpg",
  "50c2742978d6ad55": "https://upload.wikimedia.org/wikipedia/commons/b/b6/Colombia_and_Ivory_Coast_match_at_the_FIFA_World_Cup_2014-06-19_%2815%29.jpg",
  "8be27f6f932009d0": "https://upload.wikimedia.org/wikipedia/it/f/fe/David_Suazo_-_Cagliari_Calcio_2000-01.jpg",
  "88f9ab1f1519c172": "https://upload.wikimedia.org/wikipedia/commons/5/54/Massimo_Marazzina.jpg",
  "9c18b75d04f912eb": "https://upload.wikimedia.org/wikipedia/it/6/6b/Claudio_Rivalta_-_AC_Perugia_2000-01.jpg",
  "7b7bd70176785dd4": "https://upload.wikimedia.org/wikipedia/commons/f/fe/20160604_AUT_NED_8930_Kevin_Strootman.jpg",
  "ff4bbe3b1c156b80": "https://upload.wikimedia.org/wikipedia/commons/9/95/Valeri_bozhinov_in_levski.jpg",
  "47bb3ed4da5a6775": "https://upload.wikimedia.org/wikipedia/commons/0/04/20130814_AT-GR_Panagiotis_Tachtsidis_2455_%28cropped%29.jpg",
  "59eb1504726aeea2": "https://upload.wikimedia.org/wikipedia/commons/a/af/Ezequiel_Lavezzi_-_SSC_Neapel_%282%29_%28cropped%29.jpg",
  "b8a3eb95e0afb40d": "https://upload.wikimedia.org/wikipedia/commons/8/85/FC_Salzburg_gegen_Inter_Mailand_%28UEFA_Championsleague_2023-11-08%29_14_%28cropped%29.jpg",
  "9350f8a500bac83b": "https://upload.wikimedia.org/wikipedia/commons/7/76/Frosinone_Calcio_-_Stadio_Matusa_-_vs_Juventus_7_2_2016_0-2_-_DSC_8609_-_Stefano_Sturaro_%28cropped%29.jpg",
  "04257408ffcaccc1": "https://upload.wikimedia.org/wikipedia/commons/0/0f/Lucas_Leiva-2013.jpg",
  "e34e17f062475732": "https://upload.wikimedia.org/wikipedia/commons/e/ef/FC_Salzburg_gegen_Inter_Mailand_%28Testspiel_2023-08-09%29_88.jpg",
  "44fc124c562683be": "https://upload.wikimedia.org/wikipedia/commons/f/fa/Pelizzoli.jpg",
  "48b450ddfd7cd5f8": "https://upload.wikimedia.org/wikipedia/commons/b/bd/Carlos_Carmona_01.JPG",
  "1ab9ed35cef584a1": "https://upload.wikimedia.org/wikipedia/commons/3/3c/Schelotto_BHA_Pre_Season.jpg",
  "ca4f9ad97c3d9145": "https://upload.wikimedia.org/wikipedia/commons/1/12/Reginaldo_Fiorentina_2007.jpg",
  "e9489953ad072e68": "https://upload.wikimedia.org/wikipedia/it/8/8d/Francesco_Coco_Milan.png",
  "eff28b07c2f4fc65": "https://upload.wikimedia.org/wikipedia/commons/d/d3/Jacopo_Sala_2012.jpg",
  "cbf3dce5f7e120bf": "https://upload.wikimedia.org/wikipedia/commons/7/70/Hamed_Traor%C3%A8_%28cropped%29_WWFC_and_Bournemouth_AFC_players_lining_up.jpg",
  "fdcc8aa8d23b231f": "https://upload.wikimedia.org/wikipedia/commons/8/81/Nicol%C3%B2_Zaniolo_con_l%27Italia_U19.jpg",
  "e788664ffe588599": "https://upload.wikimedia.org/wikipedia/commons/e/ec/Fabrizio_Ravanelli_2011.jpg",
  "ae14b8c324d467a7": "https://upload.wikimedia.org/wikipedia/commons/d/de/Lens_-_Marseille_%2803-02-2021%29_39.jpg",
  "18df3f823ea08a5e": "https://upload.wikimedia.org/wikipedia/commons/a/a2/Medhi_Benatia.jpg",
  "ca080d5651116296": "https://upload.wikimedia.org/wikipedia/commons/5/5a/Michele_Fini.JPG",
  "7f94d225a517d091": "https://upload.wikimedia.org/wikipedia/it/3/3a/Alain_Boghossian_-_SSC_Napoli_1996-97.jpg",
  "7fa74e123abc77f2": "https://upload.wikimedia.org/wikipedia/it/3/39/Dario_marcolin_1993.jpg",
  "731cb335b248a479": "https://upload.wikimedia.org/wikipedia/commons/7/7b/Bram_Nuytinck2016.jpg",
  "15c038e5d9ac9b71": "https://upload.wikimedia.org/wikipedia/commons/3/3c/Arkadiusz_Milik_2016_%28cropped%29.jpg",
  "fcbcfab779d4a672": "https://upload.wikimedia.org/wikipedia/commons/6/60/Jorginho%2C_2021_%28cropped%29.jpg",
  "d0d9050f17f3dd9c": "https://upload.wikimedia.org/wikipedia/commons/f/f3/Zinedine_Zidane_by_Tasnim_03.jpg",
  "08e8df24e49bb0ac": "https://upload.wikimedia.org/wikipedia/commons/3/34/Sa%C5%A1a_Luki%C4%87_with_a_fan_110502024_%28cropped%29.jpg",
  "48664de23141485b": "https://upload.wikimedia.org/wikipedia/commons/f/f0/Lens_-_Torino_FC_%2802-08-2023%29_47_%28cropped%29.jpg",
  "d1d7cd8a91c96aa0": "https://upload.wikimedia.org/wikipedia/it/1/12/Antonino_Bernardini_-_Vicenza_Calcio_1999-2000.jpg",
  "26f212dbf3d49b65": "https://upload.wikimedia.org/wikipedia/commons/2/21/Edgard_Alvarez_28.JPG",
  "27e21e72c2801264": "https://upload.wikimedia.org/wikipedia/it/e/e4/Sean_Sogliano.jpg",
  "8aa6e7aecaf4c696": "https://upload.wikimedia.org/wikipedia/it/e/e4/Francesco_Pedone_-_AS_Bari_1993-94.jpg",
  "bedce551543a695c": "https://upload.wikimedia.org/wikipedia/commons/c/c1/Valerio_Verre_of_AS_Roma_%28cropped%29.jpg",
  "c5014b151280ed86": "https://upload.wikimedia.org/wikipedia/it/e/e3/Beno%C3%AEt_Cauet_-_FC_Internazionale_Milano_1997-98.jpg",
  "244bfa041b0f3d51": "https://upload.wikimedia.org/wikipedia/it/5/51/Francisco_Govinho_Lima_-_AS_Roma_2001-02.jpg",
  "70c0b7ec730d58a0": "https://upload.wikimedia.org/wikipedia/commons/d/db/Manuel_Belleri_Milan.jpg",
  "d7ccfe7f6788494d": "https://upload.wikimedia.org/wikipedia/it/e/e8/Paolo_Foglio_1997.JPG",
  "c096a9714b7b0d4f": "https://upload.wikimedia.org/wikipedia/commons/4/41/Igor_Tudor_2018.jpg",
  "fa6ced7640955f0b": "https://upload.wikimedia.org/wikipedia/it/9/95/Jonathan_Bachini_-_Udinese_Calcio_1998-99.jpg",
  "ad51dedc863fa89f": "https://upload.wikimedia.org/wikipedia/commons/6/6b/Dario_%C5%A0imi%C4%87.jpg",
  "96b919e6fe8c17b4": "https://upload.wikimedia.org/wikipedia/commons/d/d1/Jeda-rimini.jpg",
  "d6114d540d0b8f94": "https://upload.wikimedia.org/wikipedia/commons/5/56/CristianRaimondi.JPG",
  "e18534ced2b7755b": "https://upload.wikimedia.org/wikipedia/commons/4/4e/Rogerio-Ceni-Sao-Paulo-Juventude-jun-2022_%28cropped%29.jpg",
  "6fb749f11c5172ac": "https://upload.wikimedia.org/wikipedia/commons/6/6f/Tiribocchi_UDI-ATA_1-3.jpg",
  "302314add3821dcf": "https://upload.wikimedia.org/wikipedia/commons/7/72/Mauro_Zarate_at_Auronzo.JPG",
  "a3152c0508696cc8": "https://upload.wikimedia.org/wikipedia/commons/a/a2/Dolazak_igra%C4%8Da_Srbije_na_utakmicu_protiv_CG_2_%28cropped%29.jpg",
  "8130baa09328fc45": "https://upload.wikimedia.org/wikipedia/commons/0/05/Iran_vs._Montenegro_2014-05-26_%28161%29.jpg",
  "bf8bba85336ef9d6": "https://upload.wikimedia.org/wikipedia/commons/f/f9/Mario_Balotelli_Euro_2012_vs_England_02.JPG",
  "f19498c8213a4fbe": "https://upload.wikimedia.org/wikipedia/it/0/0b/Marco_Franceschetti_-_1993_-_Calcio_Padova.jpg",
  "5a2b5ffcf9decd9a": "https://upload.wikimedia.org/wikipedia/commons/6/6c/Giangiacomo_Magnani2017-2018.jpg",
  "ce96a4094848d0c6": "https://upload.wikimedia.org/wikipedia/commons/c/ce/PedroGon%C3%A7alves_2021.jpg",
  "ff37dd615e312ec8": "https://upload.wikimedia.org/wikipedia/commons/6/64/Loco-SM2018_%2812%29_%28cropped%29.jpg",
  "68e1eed7d426bd88": "https://upload.wikimedia.org/wikipedia/it/8/84/Lamberto_Zauli_-_Vicenza_Calcio_1998-99.jpg",
  "7257a34cd7b86a6a": "https://upload.wikimedia.org/wikipedia/commons/d/d2/Lens_-_Torino_FC_%2802-08-2023%29_49.jpg",
  "517271aec9192b72": "https://upload.wikimedia.org/wikipedia/commons/0/0f/Walukiewicz_%28cropped%29.png",
  "671757abeaa8926b": "https://upload.wikimedia.org/wikipedia/commons/f/fa/Antonino_Gallo_-_2023.jpg",
  "3d7714d4bbe9b6f1": "https://upload.wikimedia.org/wikipedia/commons/d/dc/Nikola_Vla%C5%A1i%C4%87_%28CSKA_Moscow%2C_19.08.2019%29.jpg",
  "c7ca6e7e2c6c493f": "https://upload.wikimedia.org/wikipedia/commons/b/b7/Ante_Rebic_playing_for_Be%C5%9Fikta%C5%9F_-_2_%28cropped%29.jpg",
  "9d3d8531cb9b4093": "https://upload.wikimedia.org/wikipedia/commons/b/b1/Reto_Ziegler_2012.jpg",
  "7b584c595c80ce7d": "https://upload.wikimedia.org/wikipedia/commons/e/eb/Suso_%2831931880485%29.jpg",
  "e49f35807162b98c": "https://upload.wikimedia.org/wikipedia/it/2/26/Fabio_Viviani_-_Estate_1996_-_Ritiro_ad_Enego_%28Vicenza%29_-_Annata_1996-1997.png",
  "967d2db29818f7f1": "https://upload.wikimedia.org/wikipedia/commons/9/9f/Riccardo_Sottil.jpg",
  "6df9fd4b7dbc78f2": "https://upload.wikimedia.org/wikipedia/commons/e/e9/Portrait_Paolo_De_Ceglie.jpg",
  "4f4eceb2fddacce6": "https://upload.wikimedia.org/wikipedia/it/a/af/Igor_Protti_-_AS_Bari_1995-1996.jpg",
  "aa204b91e739d103": "https://upload.wikimedia.org/wikipedia/commons/6/60/Fenerbah%C3%A7e_-_Cagliari_Calcio_20170807_%28117%29.jpg",
  "7f9ca13180ee0608": "https://upload.wikimedia.org/wikipedia/commons/4/45/Entrainement_SRFC_Dinan_20150902_-_J%C3%A9r%C3%A9mie_Boga_%28cropped%29.JPG",
  "708d81868621653b": "https://upload.wikimedia.org/wikipedia/commons/c/c0/Charles_De_Ketelaere_2022_Salzburg_vs_AC_Milan_2022-09-06.jpg",
  "d92c728607d024e1": "https://upload.wikimedia.org/wikipedia/commons/2/27/FC_Salzburg_gegen_Inter_Mailand_%28UEFA_Championsleague_2023-11-08%29_15.jpg",
  "da3dd2580b53d10d": "https://upload.wikimedia.org/wikipedia/commons/b/be/%C3%96FB-Cup_Halbfinale_FC_Salzburg_gegen_FK_Austria_Wien_44.JPG",
  "d03715af8fbb7dd4": "https://upload.wikimedia.org/wikipedia/commons/6/64/Davide_Santon_-_Inter_Mailand_%281%29.jpg",
  "8e8bc5605df226dd": "https://upload.wikimedia.org/wikipedia/it/f/fc/Dario_H%C3%BCbner_-_AC_Cesena_1992-93.jpg",
  "c4393faeef21907a": "https://upload.wikimedia.org/wikipedia/commons/d/dd/Ibrahima_Mbaye_2.jpg",
  "39b8fd8e253aa8da": "https://upload.wikimedia.org/wikipedia/commons/d/d0/Joel_Chukwuma_Obi_FC_Internazionale.jpg",
  "3192b699dcdd515d": "https://upload.wikimedia.org/wikipedia/commons/c/cf/Maximoralez.jpg",
  "447af101049bef04": "https://upload.wikimedia.org/wikipedia/commons/b/b8/US_Sassuolo_Calcio_v_Torino_FC%2C_22_December_2018_06.jpg",
  "ebe72ee2cfa809a0": "https://upload.wikimedia.org/wikipedia/it/a/a6/Pierluigi_Orlandini.jpg",
  "edeab5b06051bdb6": "https://upload.wikimedia.org/wikipedia/it/b/b9/Anselmo_Robbiati_-_AC_Fiorentina_1997-98.webp",
  "b1c00f6a0c810b43": "https://upload.wikimedia.org/wikipedia/it/2/29/Christian_Manfredini_-_Genoa_CFC_1999-2000.jpeg",
  "1ed078763ecf0ae0": "https://upload.wikimedia.org/wikipedia/it/3/37/Giovanni_Piacentini_e_Giampiero_Maini_Vicenza-Fiorentina_1-0_10_settembre_1995_Serie_A_1995-1996.png",
  "8a28474b902bc6e4": "https://upload.wikimedia.org/wikipedia/it/7/79/Klas_Ingesson_-_AS_Bari_1997-98.png",
  "b4c07fc7f2229a09": "https://upload.wikimedia.org/wikipedia/commons/8/8c/2016209185719_2016-07-27_Champions_for_Charity_-_Sven_-_1D_X_-_0149_-_DV3P4742_mod.jpg",
  "eea6b6f44e07510a": "https://upload.wikimedia.org/wikipedia/commons/a/ac/Dawidowicz.jpg",
  "9bcf32a1b0c1c3f6": "https://upload.wikimedia.org/wikipedia/commons/2/20/Junior_Messias.jpg",
  "e8d7f64505f507db": "https://upload.wikimedia.org/wikipedia/commons/c/c2/Miguel_Britos.jpg",
  "23fa011511e57831": "https://upload.wikimedia.org/wikipedia/commons/3/38/Giovanni_Marchese%2C_10_June_2023.jpg",
  "7eb35961d8813215": "https://upload.wikimedia.org/wikipedia/it/0/0a/Roberto_Maltagliati_-_Torino_Calcio_1994-95.jpg",
  "e6d0b1e3a4d96ca9": "https://upload.wikimedia.org/wikipedia/commons/0/0d/UEFA_Youth_League_FC_Salzburg_gegen_AS_Roma_11_%28cropped%29.jpg",
  "c73e129cc1afdad2": "https://upload.wikimedia.org/wikipedia/commons/f/f1/Norway_Italy_-_June_2025_D_48_%28cropped%29.jpg",
  "883d3be1f3d5dc27": "https://upload.wikimedia.org/wikipedia/commons/e/e8/Zortea_Cagliari_2024_%28cropped%29.jpg",
  "ef3a3a879b7c4e29": "https://upload.wikimedia.org/wikipedia/it/7/71/Alen_Bok%C5%A1i%C4%87_-_Juventus_FC_1996-97.jpg",
  "a7aa6b10968030eb": "https://upload.wikimedia.org/wikipedia/it/b/b1/Marcel_Desailly_-_Milan_AC_1993-94.jpg",
  "b5b0537278d051ab": "https://upload.wikimedia.org/wikipedia/commons/9/91/Juventus_-_2010_-_Alexander_Manninger.jpg",
  "88e6cd98e024c0bd": "https://upload.wikimedia.org/wikipedia/it/6/6f/Oscar_Magoni.jpg",
  "ebd1c54ca485b204": "https://upload.wikimedia.org/wikipedia/commons/3/38/Norway_Italy_-_June_2025_A_19_%28cropped%29.jpg",
  "8e22a8f6810f2f54": "https://upload.wikimedia.org/wikipedia/commons/4/4b/Nicola_Pozzi_Sampdoria.jpg",
  "cadc1e48a0bd9af9": "https://upload.wikimedia.org/wikipedia/commons/a/a1/Michael_Agazzi.jpg",
  "ec25a97d2bc6b8c2": "https://upload.wikimedia.org/wikipedia/commons/e/e6/Paolo_Vanoli_in_2022_%28cropped%29.jpg",
  "8c096f962b001491": "https://upload.wikimedia.org/wikipedia/commons/f/f7/Bellusci_UDI-CAT_4-2.jpg",
  "d6acfb274fdfb67a": "https://upload.wikimedia.org/wikipedia/commons/3/34/FC_Salzburg_vs._AC_Mailand_%28UEFA_Championsleague_2022-09-06%29_60_%28cropped%29.jpg",
  "a063a720beddebe7": "https://upload.wikimedia.org/wikipedia/it/5/54/Fabian_Valtolina_1998.jpg",
  "ae6a3dcd9b00e0ae": "https://upload.wikimedia.org/wikipedia/commons/4/47/Mauro_Esposito_%28Atletico_Roma%29.jpg",
  "878f33297f066b06": "https://upload.wikimedia.org/wikipedia/it/f/f1/Francesco_Flachi_-_AC_Fiorentina_1997-98.webp",
  "4a5154b3745846ee": "https://upload.wikimedia.org/wikipedia/commons/c/cc/Boukary_Dram%C3%A9.jpg",
  "15dedd8b9a8fa1ac": "https://upload.wikimedia.org/wikipedia/it/f/f9/Roberto_Sosa_-_Udinese_Calcio_1998-99.jpg",
  "7b56ccd9abd6c10d": "https://upload.wikimedia.org/wikipedia/commons/f/f9/Norway_Italy_-_June_2025_A_22_%28cropped%29.jpg",
  "349470465f700e21": "https://upload.wikimedia.org/wikipedia/commons/c/c8/20171114_AUT_URU_4518_-_Rodrigo_Bentancur_%28cropped%29_2.jpg",
  "238dbb917877da7d": "https://upload.wikimedia.org/wikipedia/commons/1/16/20150331_2025_AUT_BIH_2147.jpg",
  "34c2efd431afc73a": "https://upload.wikimedia.org/wikipedia/commons/f/f7/Primer_Cl%C3%A1sico_en_el_Campe%C3%B3n_del_Siglo_190512-6690-jikatu_%2847048356474%29_%28cropped%29.jpg",
  "d2423e5d64e0ea59": "https://upload.wikimedia.org/wikipedia/commons/c/cc/FRA-ARG_%2811%29_-_Paul_Pogba_%28cropped_2%29.jpg",
  "fdf8b449e9399f2d": "https://upload.wikimedia.org/wikipedia/commons/f/fc/Gaetano_Castrovilli.jpg",
  "a4b4031fc692bde5": "https://upload.wikimedia.org/wikipedia/commons/f/f4/Luca_Ariatti%2C_2005.jpg",
  "3b8ba509bee99ec9": "https://upload.wikimedia.org/wikipedia/commons/a/ae/%D0%9C%D0%B0%D1%82%D1%87_%C2%AB%D0%94%D0%B8%D0%BD%D0%B0%D0%BC%D0%BE%C2%BB_-_%C2%AB%D0%A8%D0%B0%D1%85%D1%82%D0%B0%D1%80%C2%BB_0-0._3_%D0%B6%D0%BE%D0%B2%D1%82%D0%BD%D1%8F_2021_%D1%80%D0%BE%D0%BA%D1%83_%E2%80%94_1278777_%28Paolo_Bianco%29.jpg",
  "361a8ddf796837aa": "https://upload.wikimedia.org/wikipedia/commons/d/dd/AUT_vs._SUI_2015-11-17_%28173%29_Silvan_Widmer.jpg",
  "40dfbc5693eda25a": "https://upload.wikimedia.org/wikipedia/commons/7/71/Germ%C3%A1n_Pezzella.jpg",
  "bf1cbbd5a6711bd2": "https://upload.wikimedia.org/wikipedia/commons/9/9c/V%C3%ADctor_Ibarbo.jpg",
  "52a266eff65fabba": "https://upload.wikimedia.org/wikipedia/commons/e/e0/Norway_Italy_-_June_2025_A_30_%28cropped%29.jpg",
  "c5a00dd6bedc3c34": "https://upload.wikimedia.org/wikipedia/commons/f/f3/M%27Bala_Nzola_in_2017.jpg",
  "9eed6f13c3fbfea4": "https://upload.wikimedia.org/wikipedia/commons/4/46/Omar_Colley_%28cropped%29.jpg",
  "a56a771efab13cc4": "https://upload.wikimedia.org/wikipedia/commons/1/15/Eldor_Shomurodov_14_%C4%B0stanbul_Ba%C5%9Fak%C5%9Fehir_FK_20250731_%2810%29_%28cropped%29.jpg",
  "fce7e070b5a86222": "https://upload.wikimedia.org/wikipedia/commons/4/46/Almeyda_foto_.jpg",
  "964facd0f6458030": "https://upload.wikimedia.org/wikipedia/commons/7/78/U-19_EC-Qualifikation_Austria_vs._France_2013-06-10_%28117%29.jpg",
  "ec30339de1ea256b": "https://upload.wikimedia.org/wikipedia/commons/7/7d/Bart%C5%82omiej_Dr%C4%85gowski_Match_Football_Spezia_Calcio_x_US_Sassuolo_Calcio_Stade_Alberto_Picco_-_La_Spezia_%28IT42%29_-_2022-08-27_-_10_%28cropped%29.jpg",
  "ded8d76823cf13f4": "https://upload.wikimedia.org/wikipedia/it/e/e5/M%C3%A1rcio_Amoroso_-_Udinese_Calcio_1996-97.jpg",
  "e38776c7b7c5a8d5": "https://upload.wikimedia.org/wikipedia/commons/4/4a/Lorenzo_Venuti.jpg",
  "df235b87f5db7204": "https://upload.wikimedia.org/wikipedia/commons/b/b6/Jhon_Lucum%C3%AD_September_2019.jpg",
  "717d663a131e09af": "https://upload.wikimedia.org/wikipedia/commons/0/0a/Rahman_Rezaei_1399062015571652821180604.jpg",
  "2ae53e39f6bb5d39": "https://upload.wikimedia.org/wikipedia/commons/4/47/Mario_Mand%C5%BEuki%C4%87_in_2018.jpg",
  "464c251736df8372": "https://upload.wikimedia.org/wikipedia/commons/2/21/FC_RB_Salzburg_gegen_FK_Austria_Wien_%2818._M%C3%A4rz_2018%29_21.jpg",
  "ecc1753769f3b4ba": "https://upload.wikimedia.org/wikipedia/it/7/70/Massimo_Brambilla_-_Torino_Calcio_1999-2000.jpg",
  "f147073d3e93c24b": "https://upload.wikimedia.org/wikipedia/commons/4/49/Mattia_Caldara_01_%28edited%29.jpg",
  "2e18565966604dd0": "https://upload.wikimedia.org/wikipedia/commons/6/6b/Ferreira_Pinto_Varese.png",
  "942f8d9828ecc0cf": "https://upload.wikimedia.org/wikipedia/commons/0/00/J%C3%A9r%C3%A9my_M%C3%A9nez.jpg",
  "7de3eeb7d4595f8c": "https://upload.wikimedia.org/wikipedia/commons/7/75/Amadoudiawara2.jpg",
  "71ab1411580333d3": "https://upload.wikimedia.org/wikipedia/it/0/09/Mohamed_Kallon_-_Reggina_Calcio_1999-2000.jpg",
  "fc7dd8193b14afcd": "https://upload.wikimedia.org/wikipedia/commons/b/b2/Mozartspartak.jpg",
  "8694468ce12300f5": "https://upload.wikimedia.org/wikipedia/it/e/e4/Gabriele_Ambrosetti_-_Autunno_1996_-_Annata_1996-1997.png",
  "1ccf035f82b6aa3a": "https://upload.wikimedia.org/wikipedia/commons/7/7f/C%C3%A9sar_Azpilicueta%2C_Al_Hilal_SFC_vs_Chelsea_F.C.%2C_9_February_2022.jpg",
  "5b95a666ed230669": "https://upload.wikimedia.org/wikipedia/commons/2/20/FBBP01_-_FCN_-_20151028_-_Coupe_de_la_Ligue_-_Koffi_Djidji.jpg",
  "dd6976afd43b9318": "https://upload.wikimedia.org/wikipedia/commons/e/e5/UEFA_EURO_qualifiers_Sweden_vs_Spain_20191015_Fabian_Ruiz_6_%28cropped%29.jpg",
  "12298ab11ec15595": "https://upload.wikimedia.org/wikipedia/commons/a/a9/Martin-Erlic.png",
  "b76b0a778717cde7": "https://upload.wikimedia.org/wikipedia/commons/8/86/Kevin_Bonifazi.jpg",
  "f6d4e9c9cff8c78b": "https://upload.wikimedia.org/wikipedia/commons/d/d7/Gilberto_Mart%C3%ADnez_Vidal.jpg",
  "bfb1d53c342f2171": "https://upload.wikimedia.org/wikipedia/commons/4/46/Sa%C5%A1a_Bjelanovi%C4%87_%282007%29.jpg",
  "f0238328585c63d2": "https://upload.wikimedia.org/wikipedia/commons/a/ae/Didier_Deschamps_in_2018.jpg",
  "758725d0f121ddae": "https://upload.wikimedia.org/wikipedia/commons/8/8f/Rubenolivera_cropped.jpg",
  "016933c1fbda3339": "https://upload.wikimedia.org/wikipedia/commons/d/d2/Pablo_Daniel_Osvaldo_BGR-ITA_2012.jpg",
  "6751331800bfb977": "https://upload.wikimedia.org/wikipedia/commons/7/7b/Guardalben.JPG",
  "18f0ead6656d8eec": "https://upload.wikimedia.org/wikipedia/commons/f/f6/TomasUjfalusiAntalyaspor.JPG",
  "97cfa93bc807b902": "https://upload.wikimedia.org/wikipedia/commons/0/05/Leandro_Rinaudo.jpg",
  "933349092887c727": "https://upload.wikimedia.org/wikipedia/commons/d/db/Entrenamiento_Argentina_Sub20_previo_al_mundial_-_BugWarp_%2849%29_-_Mat%C3%ADas_Soul%C3%A9_%28cropped%29.jpg",
  "149767e84195c823": "https://upload.wikimedia.org/wikipedia/commons/7/77/Alex_Pinardi.jpg",
  "19350a3dc01495b1": "https://upload.wikimedia.org/wikipedia/commons/4/43/Grigoris_Kastanos_%28crop%29.jpg",
  "57b564be85d835a9": "https://upload.wikimedia.org/wikipedia/it/f/fc/Francesco_Baldini_-_SSC_Napoli_1996-97.jpg",
  "f2b66618a59b8530": "https://upload.wikimedia.org/wikipedia/commons/8/8c/Nicolas_N%27Koulou.jpg",
  "b17f438b25f6942e": "https://upload.wikimedia.org/wikipedia/it/3/31/Davide_Dionigi_-_Reggina_Calcio_1996-97.jpg",
  "467a98f593ea0a7b": "https://upload.wikimedia.org/wikipedia/it/0/0d/Andrea_Gasbarroni_-_Juventus_FC_%28Primavera%29_2000-01.jpg",
  "0283959d989cdbe2": "https://upload.wikimedia.org/wikipedia/commons/3/36/Pietro_Terracciano.jpg",
  "ed94f7182db32df1": "https://upload.wikimedia.org/wikipedia/commons/5/56/Real_Valladolid_-_CD_Legan%C3%A9s_2018-12-01_%2828%29_%28cropped%29.jpg",
  "5d5d860cf3404979": "https://upload.wikimedia.org/wikipedia/commons/a/ae/DavideBrivio_02.JPG",
  "9ee5c1e906410dba": "https://upload.wikimedia.org/wikipedia/commons/7/71/Urug_tren_%283%29_-_%D0%BA%D0%BE%D0%BF%D0%B8%D1%8F.jpg",
  "3a2fdec5e08b2cef": "https://upload.wikimedia.org/wikipedia/commons/b/b4/M%27Baye_Niang.jpg",
  "174ce6b177137704": "https://upload.wikimedia.org/wikipedia/commons/c/cc/Dennis_Praet2016.jpg",
  "d73075c1df5e0c7d": "https://upload.wikimedia.org/wikipedia/commons/f/f4/Bruno_Alves_2018.jpg",
  "7f911e768ed3ac0d": "https://upload.wikimedia.org/wikipedia/it/0/0e/Gustavo_Mendez_e_Stefano_Eranio_Vicenza-Milan_22_ottobre_1995_Serie_A_1995-1996.png",
  "8064e66d91ebf3cf": "https://upload.wikimedia.org/wikipedia/it/0/01/Serie_A_2001-02_-_Roma_vs_Perugia_-_Bazzani_e_Samuel.jpg",
  "cfa0f374f22f36f8": "https://upload.wikimedia.org/wikipedia/commons/d/d7/GianniMunari.png",
  "6b7dd1fe627f8bae": "https://upload.wikimedia.org/wikipedia/commons/9/93/Spartak_-_Napoli_%2816%29.jpg",
  "a2cdb103d82bd03e": "https://upload.wikimedia.org/wikipedia/it/2/2e/Jonatan_Binotto_-_Bologna_FC_1909_1999-2000.jpg",
  "32217e10d2b1a6f9": "https://upload.wikimedia.org/wikipedia/commons/e/ee/Thomas_H%C3%A4%C3%9Fler_%282%29_%28cropped%29.JPG",
  "e25809315bcecfc9": "https://upload.wikimedia.org/wikipedia/it/b/be/Andrea_Zanchetta_-_AC_ChievoVerona_2003-04.jpg",
  "0eeb20da6af77962": "https://upload.wikimedia.org/wikipedia/commons/2/2f/SS_Lazio_v_ACF_Fiorentina%2C_24_September_2008_%28Stephen_Makinwa%29.jpg",
  "3d343d7500bcc625": "https://upload.wikimedia.org/wikipedia/commons/a/a8/Scamacca_%28cropped%29.jpeg",
  "6148629c96bc1423": "https://upload.wikimedia.org/wikipedia/commons/3/33/Ricardo_Gabriel_%C3%81lvarez_2011.jpg",
  "0492468d8418e9e9": "https://upload.wikimedia.org/wikipedia/commons/6/69/FC_Salzburg_versus_Konyaspor_%282._November_2017%29_26.jpg",
  "1bd671c9698a5e68": "https://upload.wikimedia.org/wikipedia/it/a/a0/Vincenzo_Sommese_-_Torino_Calcio_1999-2000.jpg",
  "f717b077d8b499fd": "https://upload.wikimedia.org/wikipedia/commons/7/74/Ghezzal.jpg",
  "e1a43e47acb115dc": "https://upload.wikimedia.org/wikipedia/commons/c/cb/2018_FIFA_World_Cup_Group_B_march_IRN-MAR_28_%28cropped%29.jpg",
  "d1c25019f71c7f61": "https://upload.wikimedia.org/wikipedia/commons/e/ee/Bruno_Fernandes_Portugal%2C_2018.jpg",
  "8adcc36e260c8aef": "https://upload.wikimedia.org/wikipedia/commons/8/8b/Isaac_Cofie.jpg",
  "cb98ef62718235c4": "https://upload.wikimedia.org/wikipedia/commons/2/29/Thomas_heurtaux.jpg",
  "73b61fae0ef241ea": "https://upload.wikimedia.org/wikipedia/commons/9/9b/Rui_Modesto_%28AIK%2C_2023%2C_cropped%29.jpg",
  "e959da377a80c96a": "https://upload.wikimedia.org/wikipedia/commons/2/2a/Cos-Serb_%285%29_%28cropped%29.jpg",
  "6836cd2125a52592": "https://upload.wikimedia.org/wikipedia/commons/d/d7/Mattias_Svanberg.jpg",
  "da1e99f85d08867a": "https://upload.wikimedia.org/wikipedia/commons/8/88/Leandro_Greco_2.jpg",
  "982ce08e6b169c28": "https://upload.wikimedia.org/wikipedia/commons/f/f5/Dod%C3%B4_2024.jpg",
  "d8cddf9b324747f5": "https://upload.wikimedia.org/wikipedia/commons/9/95/Houssine_Kharja_2009.jpg",
  "3a28b6a5aab5c04b": "https://upload.wikimedia.org/wikipedia/commons/3/33/Alexandre_Pato_Real_Madrid-Milan.jpg",
  "722ca625f2c39b19": "https://upload.wikimedia.org/wikipedia/commons/6/64/Nico_Pulzetti_%28cropped%29.jpg",
  "898cef3c1b5efa52": "https://upload.wikimedia.org/wikipedia/commons/5/58/Alvaro_gonzalez.jpg",
  "b7d8e57de133956f": "https://upload.wikimedia.org/wikipedia/commons/b/b3/20130814_AT-GR_Orestis_Karnezis_2402.jpg",
  "b4e1fa398a569a25": "https://upload.wikimedia.org/wikipedia/commons/e/ed/Felipe_Caicedo_2015.jpg",
  "461a9cddcafc41cc": "https://upload.wikimedia.org/wikipedia/commons/5/5e/Mirko_Valdifiori_%28cropped%29.jpg",
  "3330a052b05cf3c0": "https://upload.wikimedia.org/wikipedia/commons/b/b9/Nwankwo_Simy_%282019%29.jpg",
  "06e548a037724a42": "https://upload.wikimedia.org/wikipedia/it/8/8c/Ada%C3%ADlton_-_Hellas_Verona_FC_1999-2000.jpg",
  "609f372747505ec8": "https://upload.wikimedia.org/wikipedia/it/c/c8/Alberto_Malusci.jpg",
  "c8ed38275df328f6": "https://upload.wikimedia.org/wikipedia/commons/b/b5/Leali1.png",
  "9deb7442e5aedf27": "https://upload.wikimedia.org/wikipedia/it/b/bd/Fabi%C3%A1n_O%27Neill_-_Cagliari_Calcio_1999-2000.jpg",
  "10d383f897874f80": "https://upload.wikimedia.org/wikipedia/commons/b/bd/Pisacane2425.png",
  "995760bfa8ee0d90": "https://upload.wikimedia.org/wikipedia/commons/f/f5/Mohamed_Far%C3%A8s_2020.jpg",
  "0bfb8c7ecdd93a80": "https://upload.wikimedia.org/wikipedia/commons/5/58/Maxime_Lopez_2017.jpg",
  "19f008771aeb6679": "https://upload.wikimedia.org/wikipedia/it/3/3d/AS_Bari_-_2000_-_Gionatha_Spinesi.jpg",
  "399437712375a7ce": "https://upload.wikimedia.org/wikipedia/commons/6/6e/Next_Generation_Trophy_34.JPG",
  "d1ee959966eb36ae": "https://upload.wikimedia.org/wikipedia/commons/a/a2/Sweden-Slovenia_Nations_League_2022-09-27_32_%28cropped_v2%29.jpg",
  "fd05aa82a700e29d": "https://upload.wikimedia.org/wikipedia/commons/5/57/Metalist-Inter_%2812%29.jpg",
  "32cb575feab99445": "https://upload.wikimedia.org/wikipedia/commons/d/d7/Lorenzo_ariaudo_frosinone_%28cropped%29.jpg",
  "dce63b24a2b78fd9": "https://upload.wikimedia.org/wikipedia/it/0/0d/Serie_A_2001-02_-_Roma_vs_Lecce_-_Totti_e_Savino.jpg",
  "86099c35e8ff1fce": "https://upload.wikimedia.org/wikipedia/commons/5/57/Nando_Coppola.jpg",
  "2d715f2b1679864f": "https://upload.wikimedia.org/wikipedia/commons/9/95/Marek_Kozminski.jpg",
  "442e9af0c4e1a67b": "https://upload.wikimedia.org/wikipedia/commons/e/ed/SVK_vs._SMR_2024_Slovakia_Nr._6_Gy%C3%B6mb%C3%A9r.jpg",
  "ce9f301e45946d3f": "https://upload.wikimedia.org/wikipedia/commons/6/6a/Palermo_FC_v_Spezia_Calcio%2C_1_December_2024_05_%28Arkadiusz_Reca%29.jpg",
  "b2fc20b47c0f2460": "https://upload.wikimedia.org/wikipedia/commons/8/8f/Marius_Stankevi%C4%8Dius.jpg",
  "cb57157b5cf3f8d0": "https://upload.wikimedia.org/wikipedia/commons/6/65/CSKA-MU_2017_%2815%29.jpg",
  "383141101699a189": "https://upload.wikimedia.org/wikipedia/commons/8/83/Silgardi.andrea.jpg",
  "6ce88c941b818926": "https://upload.wikimedia.org/wikipedia/commons/d/d2/Brazil_and_Colombia_match_at_the_FIFA_World_Cup_2014-07-04_%289%29_Recorte.jpg",
  "8c9a2158c533a3af": "https://upload.wikimedia.org/wikipedia/commons/4/4c/UEFA_Europa_Conference_League_CSKA_Sofia_-_Roma%2C_2021-12-09_%28Karsdorp%29.jpg",
  "66a24320bccc0719": "https://upload.wikimedia.org/wikipedia/commons/5/5f/Zeki_%C3%A7elik_2020.jpg",
  "a4ce76139a9bdf9a": "https://upload.wikimedia.org/wikipedia/commons/0/05/Nikola_Krstovi%C4%87_%28cropped%29.jpg",
  "2adb17bb8f41d068": "https://upload.wikimedia.org/wikipedia/commons/a/af/Jaap_Stam_met_fan_cropped.jpg",
  "55ce722bd6a4fed1": "https://upload.wikimedia.org/wikipedia/commons/e/ed/Prince_Boateng_%28cropped%29.jpg",
  "a940c04dc0ebfeaa": "https://upload.wikimedia.org/wikipedia/commons/c/cf/Hernani_Azevedo_J%C3%BAnior_2017.jpg",
  "6de4921bbf102616": "https://upload.wikimedia.org/wikipedia/commons/8/8f/FC_Salzburg_gegen_AS_Roma_%28UEFA_Euroleague_play-off%2C_2023-02-16%29_39_%28cropped2%29.jpg",
  "44096d9f7383bb49": "https://upload.wikimedia.org/wikipedia/commons/c/c8/Seko_Fofana.jpg",
  "67def9d95b7f1425": "https://upload.wikimedia.org/wikipedia/commons/f/f5/Math%C3%ADas_Olivera_WC2022.jpg",
  "a951abe7e7f3a348": "https://upload.wikimedia.org/wikipedia/commons/2/2c/Roberto_Ayala_y_Javier_Zanetti_-_07FEB2007_-_Francia_-_presidencia-govar.jpg",
  "70dcbd9e82fe4130": "https://upload.wikimedia.org/wikipedia/commons/a/a9/1nicolasviola2015.jpg",
  "ee4782c87bebea25": "https://upload.wikimedia.org/wikipedia/commons/e/e7/Mario_Frick_%28footballer%29.jpg",
  "9f276944275678bf": "https://upload.wikimedia.org/wikipedia/commons/0/03/Andr%C3%A9_Gon%C3%A7alves_Dias_%282010%29.JPG",
  "985b613e7ed9d104": "https://upload.wikimedia.org/wikipedia/commons/5/53/Anthony_%C5%A0eri%C4%87.JPG",
  "877870c51bbd0e54": "https://upload.wikimedia.org/wikipedia/commons/a/a7/2016-17_Serie_A_-_AC_Milan_v_FC_Crotone_-_Alex_Cordaz.jpg",
  "1a8eecb258146416": "https://upload.wikimedia.org/wikipedia/commons/4/40/Accardi.jpg",
  "c081601f52d98de6": "https://upload.wikimedia.org/wikipedia/commons/b/ba/MicheleFerri.JPG",
  "4b961b914aa30fa6": "https://upload.wikimedia.org/wikipedia/commons/1/14/Akpa-Akpro_cropped.JPG",
  "a9a5aad0d9862ca6": "https://upload.wikimedia.org/wikipedia/it/5/53/Cl%C3%A1udio_Taffarel_-_1993_-_Parma_AC.jpg",
  "4443f09a53186bf1": "https://upload.wikimedia.org/wikipedia/commons/9/98/Alessandro_Parisi_2024_%2847_years%29.jpeg",
  "9c38050fee3cb904": "https://upload.wikimedia.org/wikipedia/commons/0/04/Cherubin.png",
  "cdc55a7d0be2e94e": "https://upload.wikimedia.org/wikipedia/commons/8/87/Matias_Fernandez_2015.jpg",
  "e60f8a08db1b21b4": "https://upload.wikimedia.org/wikipedia/commons/5/53/ISL-HRV_%2820%29.jpg",
  "2b4b7aa86bc899b0": "https://upload.wikimedia.org/wikipedia/commons/0/08/Robinho061115-2.jpg",
  "0321710d9bc80fb4": "https://upload.wikimedia.org/wikipedia/commons/0/0d/Omar_El_Kaddouri_%2814-8-2018%29.jpg",
  "e5602a6a4b1bd97f": "https://upload.wikimedia.org/wikipedia/commons/2/29/Calcio_Catania_09-11-05.jpg",
  "ffffc7ebb014605d": "https://upload.wikimedia.org/wikipedia/commons/3/34/Victor-osimhen-nigeria-2024-3-4.jpg",
  "3e4281e039c718c5": "https://upload.wikimedia.org/wikipedia/commons/e/ee/Michel_Morganella.jpg",
  "56e5e72492c78ef4": "https://upload.wikimedia.org/wikipedia/commons/4/47/Thiago_Cionek.jpg",
  "74fafa98dc4e8db1": "https://upload.wikimedia.org/wikipedia/commons/c/cb/AC_Monza_2022_Serie_A_celebration_16_%28Valoti%29.jpg",
  "4b0f004e3a0a7e98": "https://upload.wikimedia.org/wikipedia/commons/4/47/Boulaye_Dia_Reims.jpg",
  "32bd8982f43da4d2": "https://upload.wikimedia.org/wikipedia/it/a/aa/Milan_Rapai%C4%87_-_AC_Perugia_1996-97.jpg",
  "2bc7908b7940b048": "https://upload.wikimedia.org/wikipedia/commons/8/82/FC_Salzburg_gegen_AS_Roma_%28UEFA_Euroleague_play-off%2C_2023-02-16%29_73_%28cropped%29.jpg",
  "3fac74a08e4dceb2": "https://upload.wikimedia.org/wikipedia/commons/0/02/Andrea_Conti_01_%28edited%29.jpg",
  "5d4a5222ec762cab": "https://upload.wikimedia.org/wikipedia/it/e/e0/AC_Perugia_2000-09-16_Zisis_Vryzas.jpg",
  "07a1bd01ea9df64e": "https://upload.wikimedia.org/wikipedia/it/f/fd/Antonio_Marasco.png",
  "c1abbf80b7935011": "https://upload.wikimedia.org/wikipedia/commons/e/e6/Ant%C3%B4nio_Carlos_Zago_%282010%29.JPG",
  "2561fbd7e63fdc72": "https://upload.wikimedia.org/wikipedia/commons/1/15/Aleksandar_Lukovic.jpg",
  "641a7c3abbf19b4b": "https://upload.wikimedia.org/wikipedia/it/5/56/Yksel_Osmanovski_-_AS_Bari_1998-99.jpg",
  "9f857467f5c3a1cd": "https://upload.wikimedia.org/wikipedia/commons/f/f7/Diamoutene_Giulianova_2019-2020.jpg",
  "9d86543f92c17fb5": "https://upload.wikimedia.org/wikipedia/commons/6/61/Albert_Gu%C3%B0mundsson_%28cropped%29.jpg",
  "01efa964ed53b531": "https://upload.wikimedia.org/wikipedia/it/5/5d/Raffaele_Ametrano_-_1996_-_Juventus_FC.jpg",
  "e2ec092d100759a8": "https://upload.wikimedia.org/wikipedia/commons/7/71/DK-Lazio_%2812%29.jpg",
  "3dbfa5282b8aaeae": "https://upload.wikimedia.org/wikipedia/it/b/b0/Claudio_L%C3%B3pez_-_SS_Lazio_%282000%29.jpg",
  "427b99f66418d54b": "https://upload.wikimedia.org/wikipedia/commons/8/82/L._Figo_2017_%28cropped%29.jpg",
  "fc472ed1aaff5884": "https://upload.wikimedia.org/wikipedia/commons/e/ef/Metallist-Trabzonspor_%284%29.jpg",
  "9c4e2b07e9a5e5ec": "https://upload.wikimedia.org/wikipedia/it/b/b0/Rachid_Neqrouz_-_AS_Bari_1998-99.jpg",
  "e39d6ae9dfa8fccf": "https://upload.wikimedia.org/wikipedia/commons/3/3f/Bentivoglio.jpg",
  "46a2aea0fef649d5": "https://upload.wikimedia.org/wikipedia/commons/5/5a/U15_Diego_P%C3%A9rez_7558.jpg",
  "b6c3c38366ab9c50": "https://upload.wikimedia.org/wikipedia/commons/1/11/Marco_Capuano.jpg",
  "5e09bcb4d9df105a": "https://upload.wikimedia.org/wikipedia/it/4/40/Andr%C3%A9s_Guglielminpietro_%28Milan_AC%29_-_Scudetto_1998-99.jpg",
  "526887d4d48dd72d": "https://upload.wikimedia.org/wikipedia/it/b/be/Gianluca_Colonnello_-_AC_Perugia_1998-99.jpg",
  "87266913b850e335": "https://upload.wikimedia.org/wikipedia/commons/2/24/Frosinone_Calcio_-_Benito_Stirpe_-_vs_Genoa_14_5_2023_-_ANT_7399_-_Caleb_Ekuban_%28cropped%29.jpg",
  "b6b1a47fb72d3b5d": "https://upload.wikimedia.org/wikipedia/commons/2/28/FC_Liefering_gegen_SV_Horn_%2822._Juli_2016%29_50.jpg",
  "f631ee7b599741d6": "https://upload.wikimedia.org/wikipedia/commons/a/a8/Morimoto_UDI-CAT_4-2.jpg",
  "98e18fa70ba178e6": "https://upload.wikimedia.org/wikipedia/commons/1/10/Daniel_Bessa.JPG",
  "baa74da8dc679cd9": "https://upload.wikimedia.org/wikipedia/commons/9/97/12-06-05-aut-rom-freundschaftsspiel-269.jpg",
  "1979d1b9967b07cc": "https://upload.wikimedia.org/wikipedia/commons/7/7f/20130814_AT-GR_Vassilis_Torosidis_2361_%28cropped%29.jpg",
  "00fe043071e126c1": "https://upload.wikimedia.org/wikipedia/commons/0/0b/ChristianPuggioni1.jpg",
  "5f16d4175325d8d1": "https://upload.wikimedia.org/wikipedia/commons/7/7b/%D0%A3%D0%BA%D1%80%D0%B0%D0%B8%D0%BD%D0%B0_U-21_-_%D0%A8%D0%BE%D1%82%D0%BB%D0%B0%D0%BD%D0%B4%D0%B8%D1%8F_U-21_4-0._6_%D1%81%D0%B5%D0%BD%D1%82%D1%8F%D0%B1%D1%80%D1%8F_2016_%D0%B3%D0%BE%D0%B4%D0%B0_%E2%80%94_708243_%28cropped%29.jpg",
  "6e1b7d6ecc131217": "https://upload.wikimedia.org/wikipedia/commons/b/b7/Ademola_Lookman_%282019%29_%28cropped%29.jpg",
  "74e4a5ded8f46fad": "https://upload.wikimedia.org/wikipedia/commons/4/4b/Marko_Rog_2024.jpg",
  "e548110c0ed41a71": "https://upload.wikimedia.org/wikipedia/commons/4/41/FC_Admira_Wacker_M%C3%B6dling_vs._FC_Red_Bull_Salzburg_2018-04-15_%28071%29.jpg",
  "d596410bc85c79d8": "https://upload.wikimedia.org/wikipedia/commons/7/77/Jerdy_schouten-1772637173_%28cropped%29.JPG",
  "6618887289bf7913": "https://upload.wikimedia.org/wikipedia/commons/f/f3/USMNT_vs._Trinidad_and_Tobago_%2848125059622%29_%28cropped%29.jpg",
  "a84b7de7ef14a44b": "https://upload.wikimedia.org/wikipedia/commons/6/62/20150616_-_Portugal_-_Italie_-_Gen%C3%A8ve_-_Franco_Vazquez_%28cropped%29.jpg",
  "5793dda9fa1587b4": "https://upload.wikimedia.org/wikipedia/commons/f/f6/20180610_FIFA_Friendly_Match_Austria_vs._Brazil_Marko_Arnautovi%C4%87_850_1633.jpg",
  "4ed6f593db88098b": "https://upload.wikimedia.org/wikipedia/it/5/57/Jorge_Bola%C3%B1o_-_Parma_AC_2000-01.jpg",
  "9927476b6e82e2d2": "https://upload.wikimedia.org/wikipedia/commons/e/eb/Krzysztof_Pi%C4%85tek_2022.jpg",
  "910a84d401d1f0a3": "https://upload.wikimedia.org/wikipedia/commons/e/e9/Lucas_Torreira.jpg",
  "8921c768e0d588ee": "https://upload.wikimedia.org/wikipedia/it/1/10/J%C3%BCrgen_Kohler_-_1992_-_Juventus_FC.jpg",
  "adad95987afed2a4": "https://upload.wikimedia.org/wikipedia/commons/6/69/Marcus_Thuram_in_2023.jpg",
  "e47e7f351c63454e": "https://upload.wikimedia.org/wikipedia/commons/4/4b/Iv%C3%A1n_Zamorano.jpg",
  "005dc455ae7ba9ee": "https://upload.wikimedia.org/wikipedia/commons/3/36/Roberto_stellone_allenatore_frosinone_c.jpg",
  "d15f5fe1e098e0b6": "https://upload.wikimedia.org/wikipedia/commons/7/7f/Daniel_ciofani_-_frosinone.jpg",
  "5415c6a600db7f34": "https://upload.wikimedia.org/wikipedia/it/5/5a/Angelo_Paradiso_-_SSC_Napoli_1998-99.jpg",
  "c9517e6a83804c4e": "https://upload.wikimedia.org/wikipedia/commons/f/f0/Domenico_Maietta.jpg",
  "3ae5f4ca5b5e5d9e": "https://upload.wikimedia.org/wikipedia/it/d/dc/Maurizio_Rossi_Vicenza-Padova_24_settembre_1995_Serie_A_1995-1996.png",
  "ac2fb7279dc710b1": "https://upload.wikimedia.org/wikipedia/commons/c/ca/Fenerbah%C3%A7e_-_Cagliari_Calcio_20170807_%28170%29_%28cropped%29.jpg",
  "ad3fcd2601917614": "https://upload.wikimedia.org/wikipedia/commons/2/21/Daniele_Capelli_01.JPG",
  "9ddfc8109f270994": "https://upload.wikimedia.org/wikipedia/commons/a/ad/Nikola_Moro_2020.jpg",
  "d5fba0ab3edbff9a": "https://upload.wikimedia.org/wikipedia/commons/3/31/Gianluca_Gaetano_2017.png",
  "77beb977c57850f9": "https://upload.wikimedia.org/wikipedia/commons/a/ae/Leandro_Cufr%C3%A9.jpg",
  "05793f50fc048b9d": "https://upload.wikimedia.org/wikipedia/commons/f/f4/Dal_Canto.jpg",
  "9c69ccfc3491a438": "https://upload.wikimedia.org/wikipedia/commons/0/0c/Rangers_v_Tottenham_Hotspur_-_54202812415_%28Nedim_Bajrami%29.jpg",
  "dcf91bc3fe8db4bc": "https://upload.wikimedia.org/wikipedia/commons/d/d3/Leandro_Cast%C3%A1n_As_Roma_2012.jpg",
  "b187f9d865d5b689": "https://upload.wikimedia.org/wikipedia/commons/6/6c/Patrick_Vieira_NYCFC_%28cropped%29.JPG",
  "c584cea5b767e13b": "https://upload.wikimedia.org/wikipedia/it/a/aa/Marco_Nappi_-_Genoa_1893_1988-89.jpg",
  "989e99366143ca35": "https://upload.wikimedia.org/wikipedia/it/8/83/Duccio_Innocenti_-_AS_Bari_2000-01.jpg",
  "7edd44330f184206": "https://upload.wikimedia.org/wikipedia/commons/f/fc/Lameck_Banda_2019.jpg",
  "07cfc601863d7e5c": "https://upload.wikimedia.org/wikipedia/commons/9/9e/Agudelo_Spezia_%28cropped%29.jpg",
  "6b05542da1ae3979": "https://upload.wikimedia.org/wikipedia/commons/f/f8/Caldirola%2C_Luca_Werder_17-18_WP_%28cropped%29.jpg",
  "7a3af981ff2e7548": "https://upload.wikimedia.org/wikipedia/commons/8/83/PSV_Eindhoven%2C_Teamcamp_Bad_Erlach%2C_July_2014_%28085%29.jpg",
  "feb91b7026905b08": "https://upload.wikimedia.org/wikipedia/commons/6/61/Damiano_Ferronetti_%28cropped%29.jpg",
  "66956745d0f5f98f": "https://upload.wikimedia.org/wikipedia/commons/9/98/1fabioceravolo2015.jpg",
  "a00cfc9883550f98": "https://upload.wikimedia.org/wikipedia/commons/4/4f/20180602_FIFA_Friendly_Match_Austria_vs._Germany_Sami_Khedira_850_0707.jpg",
  "ccde1ed526fca189": "https://upload.wikimedia.org/wikipedia/commons/0/0c/Estudiantesdelaplata-2011.jpg",
  "953f8ef97cd16c36": "https://upload.wikimedia.org/wikipedia/commons/e/e2/PSG-Shakhter15_%2812%29.jpg",
  "7a1b45588c1850db": "https://upload.wikimedia.org/wikipedia/commons/b/bf/Luca_Mazzitelli_36_a_-_Frosinone_Calcio_-_DSC_8153_AF_crop.jpg",
  "fe7cd8fa0e22bd5b": "https://upload.wikimedia.org/wikipedia/commons/9/9f/FC_Salzburg_gegen_AS_Roma_%28UEFA_Euroleague_play-off%2C_2023-02-16%29_63.jpg",
  "96eb4d9a798ab208": "https://upload.wikimedia.org/wikipedia/commons/d/d1/John_Arne_Riise.JPG",
  "b5b5fb6340fd7576": "https://upload.wikimedia.org/wikipedia/commons/5/5a/FC_Salzburg_gegen_Inter_Mailand_%28Testspiel_2023-08-09%29_69.jpg",
  "48df252cd8240569": "https://upload.wikimedia.org/wikipedia/commons/e/e0/Kenan_Y%C4%B1ld%C4%B1z_in_the_international_match_%28March_2025%29_%28cropped%29.jpg",
  "99acfbaf2fcb4241": "https://upload.wikimedia.org/wikipedia/commons/2/29/2022128151247_2022-05-08_Fussball_Eintracht_Frankfurt_vs_Borussia_M%C3%B6nchengladbach_-_Sven_-_1D_X_MK_II_-_0370_-_B70I6481_%28Evan_N%E2%80%99Dicka_cropped%29.jpg",
  "301945a8f27cf8b1": "https://upload.wikimedia.org/wikipedia/commons/f/f5/Lens_-_Torino_FC_%2802-08-2023%29_34.jpg",
  "1dde7bcd0f80988e": "https://upload.wikimedia.org/wikipedia/commons/0/07/Matuidi_PSG.jpg",
  "ea9b825a2f5952be": "https://upload.wikimedia.org/wikipedia/it/c/cd/Marcelo_Otero_Fiorentina-Vicenza_2-4_8_Settembre_1996_Serie_A_1996-1997.png",
  "91493de5914b66d7": "https://upload.wikimedia.org/wikipedia/commons/2/2b/Olivier_Giroud_2018.jpg",
  "42ec1e98570eecb2": "https://upload.wikimedia.org/wikipedia/commons/0/09/Alessandro_Rosina_and_Paolo_Zanetti_%28Paolo_Zanetti%29.jpg",
  "b92edf561aed0fcf": "https://upload.wikimedia.org/wikipedia/commons/6/61/Marcelo_Salas_2015.jpg",
  "38224f7106e6b453": "https://upload.wikimedia.org/wikipedia/commons/5/5c/Leonardo_Nascimento_de_Ara%C3%BAjo_2013-01-01_%28cropped%29.jpg",
  "63e48826b066b804": "https://upload.wikimedia.org/wikipedia/commons/a/a8/Urby_Emanuelson_2017.jpg",
  "a4bbbd1caba3f85a": "https://upload.wikimedia.org/wikipedia/it/0/0e/Francesco_Bega_-_Alzano_1909_Virescit_FC_1999-2000.jpg",
  "524abc7465bdd46f": "https://upload.wikimedia.org/wikipedia/commons/f/f0/Frosinone_Calcio_-_Federico_Gatti_-_MS_1_cut.jpg",
  "432e764e3b9f5c6e": "https://upload.wikimedia.org/wikipedia/commons/3/36/Koni_De_Winter_USMNT_v_Belgium_Mar_28_2026-36_%28cropped%29.jpg",
  "d73fcb3aada66f0d": "https://upload.wikimedia.org/wikipedia/commons/f/f6/Lens_-_Nice_%2823-01-2021%29_51.jpg",
  "26d1f6bfee735828": "https://upload.wikimedia.org/wikipedia/commons/b/b7/Steve_von_Bergen_-_Hertha_BSC_Berlin_%282%29.jpg",
  "76225d74e162c992": "https://upload.wikimedia.org/wikipedia/commons/f/f1/Fernando_Muslera_2021.jpg",
  "8fc5ac90eba39ec5": "https://upload.wikimedia.org/wikipedia/commons/b/b0/Frosinone_Calcio_-_Stadio_Matusa_-_vs_Portogruaro_11_9_2010_Vincenzo_Sicignano_1_Ant_0569.jpg",
  "498310982284cefd": "https://upload.wikimedia.org/wikipedia/commons/d/dd/Roberto-d-aversa.jpg",
  "bc679ecfee4d429d": "https://upload.wikimedia.org/wikipedia/commons/e/e5/Florin_Raducioiu_-_16_June_2018_%28cropped%29.jpg",
  "60711d29012581cc": "https://upload.wikimedia.org/wikipedia/commons/7/7a/Mathieu_Flamini_Arsenal_Members%27_Day_2015_%2819929864949%29.jpg",
  "64352e82177d16e1": "https://upload.wikimedia.org/wikipedia/commons/e/e1/Tolgay_Arslan.jpg",
  "2483e280049a5d45": "https://upload.wikimedia.org/wikipedia/it/a/ab/Andrea_Mazzantini_-_AC_Perugia_1998-99.jpg",
  "5680d18431f0826d": "https://upload.wikimedia.org/wikipedia/commons/6/61/Joaqu%C3%ADn_Larrivey.jpg",
  "d0ced7105c9c15e8": "https://upload.wikimedia.org/wikipedia/it/0/04/Johan_Walem_-_Udinese_Calcio_1998-99.jpg",
  "b9b3ae3da760a9f5": "https://upload.wikimedia.org/wikipedia/commons/2/2b/Lorenzo_Lucca_high_five_%28cropped%2C_head_shot%29.jpg",
  "fd7c37af896a108b": "https://upload.wikimedia.org/wikipedia/commons/b/b0/Rigan%C3%B2.jpg",
  "02a4ad721a0d8db7": "https://upload.wikimedia.org/wikipedia/commons/4/44/Michele_Paolucci_2022.jpg",
  "dd141d7aec4a892f": "https://upload.wikimedia.org/wikipedia/commons/d/dc/UEFA_Youth_League_Zenit-Juventus%2C_2021-10-20_03_%28cropped%29.jpg",
  "19ce4d376df9c4ea": "https://upload.wikimedia.org/wikipedia/commons/2/2f/Sweden-Slovenia_Nations_League_2022-09-27_17_Kulusevski_%28cropped%29.jpg",
  "b0df33146748d649": "https://upload.wikimedia.org/wikipedia/commons/a/af/Francesco_Benussi.jpg",
  "50eefe002d9c6bc4": "https://upload.wikimedia.org/wikipedia/commons/f/f2/Lens_-_Girondins_de_Bordeaux_%2819-09-2020%29_61_%28cropped%29.jpg",
  "ef1affb46f81119f": "https://upload.wikimedia.org/wikipedia/commons/0/0c/Juan_Iturbe_AS_Roma_%28cropped%29.jpg",
  "3d64d7ce323a961c": "https://upload.wikimedia.org/wikipedia/commons/a/a6/Austria_national_under-21_football_team_-_Teamcamp_June_2017_%28110%29.jpg",
  "e722299b09af705c": "https://upload.wikimedia.org/wikipedia/commons/3/3a/Football_against_poverty_2014_-_Paulo_Sousa_%28cropped%29_-_2.jpg",
  "fbe862c844b6acb9": "https://upload.wikimedia.org/wikipedia/commons/4/40/Catrinel_Menghia_%2820168605818%29_%28cropped%29.jpg",
  "7b31f7a9dbddd5e7": "https://upload.wikimedia.org/wikipedia/it/2/29/Alessio_Scarchilli.jpg",
  "e187e533da314436": "https://upload.wikimedia.org/wikipedia/commons/c/c8/20180610_FIFA_Friendly_Match_Austria_vs._Brazil_Thiago_Silva_850_1582.jpg",
  "14e0428021cba0cf": "https://upload.wikimedia.org/wikipedia/commons/0/0d/Aston_Villa-FH_173.jpg",
  "9aa6f711824aeaaf": "https://upload.wikimedia.org/wikipedia/commons/b/ba/Nehu%C3%A9n_P%C3%A9rez.jpeg",
  "2567188184eee4ec": "https://upload.wikimedia.org/wikipedia/commons/0/0d/Andrea_Campagnolo.jpg",
  "894873cbda23328a": "https://upload.wikimedia.org/wikipedia/commons/0/0c/AC_Monza_2022_Serie_A_celebration_32_%28Brescianini%29.jpg",
  "7e2d73969b7a6fa4": "https://upload.wikimedia.org/wikipedia/commons/7/75/Demiral_in_the_international_match_in_September_2020_%28Cropped%29.jpg",
  "b7b1a00dfb61659c": "https://upload.wikimedia.org/wikipedia/commons/f/f1/Jeison_Murillo_USA_vs_COL_%2845272402752%29_%28cropped%29.jpg",
  "6dc238ac2a7b0e1c": "https://upload.wikimedia.org/wikipedia/commons/d/dd/Brahim_Diaz_2_vs_Niger_%28cropped%29_%28cropped%29.jpg",
  "c0688b66b0bfece8": "https://upload.wikimedia.org/wikipedia/commons/8/83/Frosinone_Calcio_-_Francesco_Zampano_ANF_8887_AF.jpg",
  "473d30ed42651104": "https://upload.wikimedia.org/wikipedia/commons/8/87/Davide_Moscardelli_Arezzo%2C_2017_%28cropped%29.png",
  "73e8d81119e9ad14": "https://upload.wikimedia.org/wikipedia/commons/c/c6/Samuele_Dalla_Bona_2009.jpg",
  "a303815161c2dadc": "https://upload.wikimedia.org/wikipedia/commons/f/f8/Gast%C3%B3n_Brugman_Revolution_Nashville_6.25.25-046_%28cropped%29.jpg",
  "14db1da3b2b892c6": "https://upload.wikimedia.org/wikipedia/commons/f/fe/Fabiano_Santacroce_-_SSC_Neapel_%282%29_%28cropped%29.jpg",
  "e28512dace076188": "https://upload.wikimedia.org/wikipedia/it/f/f7/Pierre_Laigle_-_UC_Sampdoria_1996-97.jpg",
  "ba2bff32aa5acd23": "https://upload.wikimedia.org/wikipedia/it/1/13/Jocelyn_Angloma_-_Torino_Calcio_1994-95.jpg",
  "63d4dd34ec3c6812": "https://upload.wikimedia.org/wikipedia/commons/1/1c/Jaka_Bijol_2025.png",
  "fd74f06e22713e5d": "https://upload.wikimedia.org/wikipedia/commons/2/2c/Estigarribia.jpg",
  "61160c8dc8d40ce3": "https://upload.wikimedia.org/wikipedia/commons/1/19/Antonsson.png",
  "e89e161a759e51a7": "https://upload.wikimedia.org/wikipedia/commons/e/e5/IshakBelfodil2_%28cropped%29.jpg",
  "e9cd1b786f37310c": "https://upload.wikimedia.org/wikipedia/commons/9/91/Tomas_Repka_2010.jpg",
  "8a84755a68230f21": "https://upload.wikimedia.org/wikipedia/commons/3/32/Agliardi_ritaglio.jpg",
  "c7e157f920011582": "https://upload.wikimedia.org/wikipedia/it/c/cb/Daniele_Amerini_-_Estate_1996_-_Ritiro_ad_Enego_%28Vicenza%29_-_Annata_1996-1997.png",
  "1007e7f716f7a19c": "https://upload.wikimedia.org/wikipedia/it/1/17/Lorenzo_Amoruso.jpg",
  "15fc32390f984c9c": "https://upload.wikimedia.org/wikipedia/commons/5/55/%C5%A0ime_Vrsaljko_2018.jpg",
  "f10c7b0110842730": "https://upload.wikimedia.org/wikipedia/commons/2/20/A%C3%A1ron_-_Espanyol_-_WMES_%28cropped%29.jpg",
  "76d60e9de76b003f": "https://upload.wikimedia.org/wikipedia/commons/3/3b/2019-07-12_Fu%C3%9Fball%3B_Freundschaftsspiel_RB_Leipzig_-_FC_Z%C3%BCrich_1DX_1009_by_Stepro_%28headshot%29.jpg",
  "8e0c9acc7aa49baa": "https://upload.wikimedia.org/wikipedia/commons/3/33/Obafemi_Martins_vs_LA_Galaxy_2_%28cropped%29.jpg",
  "6bf1e2f61f3d96b2": "https://upload.wikimedia.org/wikipedia/commons/1/14/LeonardoTalamonti.jpg",
  "c06559285e9b8085": "https://upload.wikimedia.org/wikipedia/it/b/bf/FC_Inter_-_1997_-_Ronaldo.jpeg",
  "5263c9ba127ba1b9": "https://upload.wikimedia.org/wikipedia/it/e/e9/Gianluca_Berti_-_Genoa_1893_1991-92.jpg",
  "fd3911d340fd31f3": "https://upload.wikimedia.org/wikipedia/commons/b/b3/Cristian_Gabriel_Romero_%28cropped_2%29.png",
  "ffc7ca52a0b7d4ec": "https://upload.wikimedia.org/wikipedia/commons/5/53/Simone_Scuffet_-_CFR_Cluj_-_Lazio_0-0_%2852708030789%29_%28cropped%29.png",
  "8f394e1c1281a882": "https://upload.wikimedia.org/wikipedia/commons/8/8f/Adam_Obert.jpg",
  "c77753edfa5f1e30": "https://upload.wikimedia.org/wikipedia/commons/3/30/Zdenek_Grygera.jpg",
  "26d107bee981a30f": "https://upload.wikimedia.org/wikipedia/commons/3/35/Matthijs_de_Ligt_2018.jpg",
  "6b3d6dd1158ec675": "https://upload.wikimedia.org/wikipedia/commons/3/37/Iv%C3%A1n_Rodrigo_Piris.jpg",
  "61b240306e194edd": "https://upload.wikimedia.org/wikipedia/commons/0/07/Mirco_Antenucci05.jpg",
  "e986965e62fc9ab7": "https://upload.wikimedia.org/wikipedia/it/f/f2/Youri_Djorkaeff_-_FC_Internazionale_Milano_1998-99.jpg",
  "3ea785e669da946e": "https://upload.wikimedia.org/wikipedia/it/3/35/Emiliano_Bigica.JPG",
  "ec0927eeadb2be49": "https://upload.wikimedia.org/wikipedia/it/6/6b/AS_Roma_-_5_dicembre_2001.webp",
  "3f1d29b0f981131f": "https://upload.wikimedia.org/wikipedia/commons/8/8d/Frosinone_Calcio_-_Alessio_Zerbin_FRO_1282_AF.jpg",
  "398faeb0eed1a862": "https://upload.wikimedia.org/wikipedia/commons/6/6f/Pablo_Cesar_Barrientos.jpg",
  "9c883597c697b0f4": "https://upload.wikimedia.org/wikipedia/commons/7/70/Chelsea_1_Atletico_Madrid_1_%28Stefan_Savi%C4%87%29.jpg",
  "31d455a74416cb17": "https://upload.wikimedia.org/wikipedia/commons/b/b3/1_Matt%C3%A9o_Guendouzi_2018_%28cropped%29.jpg",
  "310df8ea3cedf8c6": "https://upload.wikimedia.org/wikipedia/commons/8/8f/Pierre_Wome_5dec2006.jpg",
  "1546195d476fecdc": "https://upload.wikimedia.org/wikipedia/commons/2/25/Ivan_Juri%C4%87_Crotone%2C_2016_%28cropped%29.png",
  "4109b138b90afcfe": "https://upload.wikimedia.org/wikipedia/commons/1/16/Hertha_BSC_vs._West_Ham_United_20190731_%28172%29.jpg",
  "85a805ab511dc795": "https://upload.wikimedia.org/wikipedia/commons/c/c2/Liberato_Cacace_30082025_%281%29.jpg",
  "b372b4228312fd71": "https://upload.wikimedia.org/wikipedia/commons/e/ec/Fabio_Bilica.JPG",
  "b9ac9107b9a500b4": "https://upload.wikimedia.org/wikipedia/it/b/b5/Gianmatteo_Mareggini.jpg",
  "88d14fa6de49ecb1": "https://upload.wikimedia.org/wikipedia/commons/6/64/%D0%96%D0%B5%D0%BB%D1%8C%D0%BA%D0%BE_%D0%91%D1%80%D0%BA%D0%B8%D1%87.jpg",
  "06b1c084b5ff55d1": "https://upload.wikimedia.org/wikipedia/commons/3/3c/Abdou_Harroui.jpg",
  "7c0b285f24daa0b4": "https://upload.wikimedia.org/wikipedia/commons/3/3c/Santiago_Castro.jpg",
  "49d44d87ff278dd7": "https://upload.wikimedia.org/wikipedia/commons/4/4a/Kvaratskhelia_asse_psg_2425.png",
  "8c3ffb949e5c5916": "https://upload.wikimedia.org/wikipedia/it/6/64/Roberto_Goretti_-_AC_Perugia_1996-97.jpg",
  "87b4ea015203956b": "https://upload.wikimedia.org/wikipedia/commons/6/6f/Adri%C3%A1n_Ricchiuti_Rimini-Juventus_2006.jpg",
  "4b40660473b10639": "https://upload.wikimedia.org/wikipedia/commons/2/25/Mourad_Meghni_2011.jpg",
  "1836c51918743d93": "https://upload.wikimedia.org/wikipedia/commons/0/01/SM-RV_%281%29.jpg",
  "a2bd21e773bb0a3d": "https://upload.wikimedia.org/wikipedia/commons/f/fb/Samuel_2011.jpg",
  "f486d8000d003b00": "https://upload.wikimedia.org/wikipedia/commons/a/a7/Jesper_Karlstr%C3%B6m_%28Djurg%C3%A5rden%2C_2020%2C_cropped%29.jpg",
  "3f5620a2968b6055": "https://upload.wikimedia.org/wikipedia/it/2/2c/Emiliano_Salvetti_-_Hellas_Verona_FC_2000-01.jpg",
  "a662c05d23079509": "https://upload.wikimedia.org/wikipedia/commons/a/aa/Marc_Pfertzel_beim_Antritt_%2810317305515%29.jpg",
  "563b6f416a435612": "https://upload.wikimedia.org/wikipedia/it/2/29/Ernesto_Chevant%C3%B3n_-_US_Lecce_2001-02.jpg",
  "31e3c7c5cff80426": "https://upload.wikimedia.org/wikipedia/it/2/24/Guerino_Gottardi.JPG",
  "fe98ea6b14dd56f7": "https://upload.wikimedia.org/wikipedia/commons/c/ca/Fabio_Firmani_at_Auronzo.JPG",
  "cb7eb41638c81531": "https://upload.wikimedia.org/wikipedia/commons/4/42/Marcello_Trotta_2014_%28cropped%29.jpg",
  "1b520070730eb63f": "https://upload.wikimedia.org/wikipedia/commons/1/19/Filip_Helander_in_July_2015.jpg",
  "f20812a130449106": "https://upload.wikimedia.org/wikipedia/commons/0/01/Norway_Italy_-_June_2025_A_06_%28cropped%29.jpg",
  "57b18b5b2987d32a": "https://upload.wikimedia.org/wikipedia/commons/6/68/David_de_Gea_2017.jpg",
  "24abc781bf87f4b9": "https://upload.wikimedia.org/wikipedia/commons/5/52/Abel_Hern%C3%A1ndez.jpg",
  "34e66bef2ac34a8e": "https://upload.wikimedia.org/wikipedia/commons/5/57/Nicola_Rigoni%2C_2020.jpg",
  "9f9db2059fd8d847": "https://upload.wikimedia.org/wikipedia/commons/9/95/Pedro_Neto_%28cropped%29_WWFC_vs_Brighton_%26_Hove_Albion_4.3.2022_%281%29_%28cropped%29.jpg",
  "39c9da5fb74297d5": "https://upload.wikimedia.org/wikipedia/commons/d/dc/2022_FIFA_World_Cup_United_States_1%E2%80%931_Wales_-_%2813%29_%28cropped%29.jpg",
  "1d7d8329d19d54a9": "https://upload.wikimedia.org/wikipedia/commons/9/9b/FC_Salzburg_gegen_GNK_Dinamo_Zagreb_%28UEFA_Championsleague_2022-10-05%29_52_%28cropped%29.jpg",
  "b4b6bbcc7e4eb18f": "https://upload.wikimedia.org/wikipedia/commons/c/c3/FBBP01_-_FCN_-_20151028_-_Coupe_de_la_Ligue_-_Lorik_Cana.jpg",
  "ec9f21d210e8ab24": "https://upload.wikimedia.org/wikipedia/it/d/d6/Giovanni_Lopez_Fiorentina-Vicenza_2-4_8_Settembre_1996_Serie_A_1996-1997.png",
  "540ed4d7ac4d6757": "https://upload.wikimedia.org/wikipedia/commons/f/f4/Thiago_Motta_Bologna_2023.jpg",
  "d3c5637385760c6b": "https://upload.wikimedia.org/wikipedia/commons/c/c9/Erminio_Rullo_Avezzano_2017.jpg",
  "d74d9d46c3be1e30": "https://upload.wikimedia.org/wikipedia/commons/1/1a/Marcus_Holmgren_Pedersen_2022_FC_RB_Salzburg_gegen_Feyenoord_Rotterdam_%28cropped%29.jpg",
  "a842f4ed80a66d40": "https://upload.wikimedia.org/wikipedia/commons/e/ea/Mohamed_Salah_2021_CAN_Final.jpg",
  "aee831b25818db7b": "https://upload.wikimedia.org/wikipedia/commons/8/88/Lorenzo_crisetig_%2854474019709%29.jpg",
  "fd8887938b5f9f73": "https://upload.wikimedia.org/wikipedia/commons/c/c3/Carmine_Coppola_%28cropped%29.jpg",
  "e6eab13322677784": "https://upload.wikimedia.org/wikipedia/commons/b/b7/Carboni_Ezequiel_UDI-CAT_4-2.jpg",
  "abc9b173b18dcfeb": "https://upload.wikimedia.org/wikipedia/commons/4/43/Ladislav_Krej%C4%8D%C3%AD_01112025_%283%29.jpg",
  "1b6eb9b99a8bc0c8": "https://upload.wikimedia.org/wikipedia/it/4/40/Marco_Zamboni_-_Udinese_Calcio_2000-01.jpg",
  "603a20c48d2c21cb": "https://upload.wikimedia.org/wikipedia/commons/b/b3/Filip_Djordjevic.jpg",
  "c17e1f277eff536d": "https://upload.wikimedia.org/wikipedia/commons/7/79/Keisuke_Honda_2018_%28cropped%29_%28cropped%29.jpg",
  "fc148c509acd7c0f": "https://upload.wikimedia.org/wikipedia/commons/6/69/Mario_Sampirisi_31_A_-_Frosinone_Calcio_-_DSC_8835_AF_%28cropped%29.jpg",
  "b631df900a703361": "https://upload.wikimedia.org/wikipedia/commons/e/e0/Loftus-Cheek_20180624.jpg",
  "0f1f55be22956ba1": "https://upload.wikimedia.org/wikipedia/commons/d/d2/Tijjani_Noslin.jpg",
  "e09fb2f8790f156e": "https://upload.wikimedia.org/wikipedia/commons/3/39/Alessandro_Del_Grosso_Avezzano_Calcio.jpg",
  "291e0757ed5a1805": "https://upload.wikimedia.org/wikipedia/commons/d/d9/Chelsea_vs._Arsenal%2C_29_May_2019_18_Kovacic.jpg",
  "63589dccb3579bfd": "https://upload.wikimedia.org/wikipedia/commons/e/e4/Shunsuke2_20080622.png",
  "8e93d6f701c08c4f": "https://upload.wikimedia.org/wikipedia/commons/1/17/Joakim_M%C3%A6hle_September_2019.jpg",
  "025de3a360dd838a": "https://upload.wikimedia.org/wikipedia/commons/4/46/Danilo_Avelar.JPG",
  "255485d3c2caa557": "https://upload.wikimedia.org/wikipedia/commons/7/79/SC_Wiener_Neustadt_vs._SKN_St._P%C3%B6lten_2018-05-31_%28044%29.jpg",
  "05c6bfdf245cb4a5": "https://upload.wikimedia.org/wikipedia/commons/a/a7/Deulofeu_Wikipedia_Udinese_%28cropped%29.JPG",
  "c11fb2be46f37172": "https://upload.wikimedia.org/wikipedia/commons/8/82/Bakayoko_2018.jpg",
  "8583815728515183": "https://upload.wikimedia.org/wikipedia/commons/0/09/Guberti.jpg",
  "9bf8577a3369cd0d": "https://upload.wikimedia.org/wikipedia/commons/9/93/Okoye_2026.jpg",
  "2caf7b7785d5abf1": "https://upload.wikimedia.org/wikipedia/commons/a/aa/Maxwell_PSG_2015.jpg",
  "5403f7ffb03791d6": "https://upload.wikimedia.org/wikipedia/commons/0/0c/Nigel_de_Jong_2011_%282%29.jpg",
  "f98ee88d52618e3e": "https://upload.wikimedia.org/wikipedia/commons/0/07/Elvis_Abbruscato.jpg",
  "145bec595a142e83": "https://upload.wikimedia.org/wikipedia/commons/9/98/Adama-soumaoro-genoa-1590399946-39455_%28cropped%29.jpg",
  "0475e41ac5791b31": "https://upload.wikimedia.org/wikipedia/commons/7/76/Emre_in_national_team_%2811.08.2010%29_%28cropped%29.JPG",
  "e183d1f527e08b1e": "https://upload.wikimedia.org/wikipedia/commons/c/cb/Chelsea_Legends_1_Inter_Forever_4_%2827457025407%29.jpg",
  "8d6b251da022a052": "https://upload.wikimedia.org/wikipedia/commons/a/a4/CSKA-CZ_%282%29.jpg",
  "720d483ed460ba34": "https://upload.wikimedia.org/wikipedia/commons/8/89/Portugal_national_football_team_0866_%28Vitinha%29.jpg",
  "aa5c51678190b5ae": "https://upload.wikimedia.org/wikipedia/commons/b/b6/Federico_Casarini.jpg",
  "511e51f8e55f96c6": "https://upload.wikimedia.org/wikipedia/it/8/84/Stefan_Schwarz_-_AC_Fiorentina_1996-97.jpg",
  "a4d6451a20294c09": "https://upload.wikimedia.org/wikipedia/commons/3/34/Filippo_cristante.jpg",
  "4a7b5ac226a68ee3": "https://upload.wikimedia.org/wikipedia/commons/2/2c/Nicola_Mingazzini.jpg",
  "dd11fb322ec85532": "https://upload.wikimedia.org/wikipedia/it/7/71/Fabio_Macellari_Inter.jpg",
  "66e0db477805be98": "https://upload.wikimedia.org/wikipedia/commons/8/88/Andreas_Cornelius_cropped.jpg",
  "4a003036b2dd0c53": "https://upload.wikimedia.org/wikipedia/commons/7/71/2020-03-10_Fu%C3%9Fball%2C_M%C3%A4nner%2C_UEFA_Champions_League_Achtelfinale%2C_RB_Leipzig_-_Tottenham_Hotspur_1DX_3672_by_Stepro.jpg",
  "d5fe14edd0e1289b": "https://upload.wikimedia.org/wikipedia/commons/3/3d/Mariusz_Stepinski_FCN_2013-2.jpg",
  "11be1a385dbb6a98": "https://upload.wikimedia.org/wikipedia/commons/5/54/2022128173937_2022-05-08_Fussball_Eintracht_Frankfurt_vs_Borussia_M%C3%B6nchengladbach_-_Sven_-_1D_X_MK_II_-_2399_-_B70I8510_%28Filip_Kosti%C4%87_cropped%29.jpg",
  "48299eacf7444fc9": "https://upload.wikimedia.org/wikipedia/commons/b/b5/Ionu%C8%9B_Radu_2023.jpg",
  "febf71305a5513ab": "https://upload.wikimedia.org/wikipedia/commons/4/40/Tomas_Doll_%E2%80%93_Tag_der_Legenden_2016_01.jpg",
  "cad7e8f656d963e8": "https://upload.wikimedia.org/wikipedia/commons/c/cb/Che_Adams.jpg",
  "f4556442a42a5121": "https://upload.wikimedia.org/wikipedia/commons/b/b5/UEFA_Europa_Conference_League_CSKA_Sofia_-_Roma%2C_2021-12-09_%28Kumbulla%29.jpg",
  "7515bb56e1121020": "https://upload.wikimedia.org/wikipedia/commons/e/e6/Mario_Stanic.jpg",
  "7046c6775e3411f4": "https://upload.wikimedia.org/wikipedia/commons/c/cd/UEFA_Europa_Conference_League_CSKA_Sofia_-_Roma%2C_2021-12-09_%28Bove%29.jpg",
  "794e88514a7f4346": "https://upload.wikimedia.org/wikipedia/it/d/d6/Riccardo_Zampagna_-_US_Brescello_%282000%29.png",
  "09548d1cc3860456": "https://upload.wikimedia.org/wikipedia/commons/d/dd/Luigi_Giorgi.JPG",
  "533c79ef29afc639": "https://upload.wikimedia.org/wikipedia/it/c/c5/Attilio_Gregori_-_Verona_FC_1991-92.jpg",
  "8c1be3ec6c2aab18": "https://upload.wikimedia.org/wikipedia/commons/d/dc/RB_Salzburg_gegen_AS_Monaco_%28Testspiel%2C_3._Juli_2021%29_48_%28cropped%29.jpg",
  "6c7cdc7231864cef": "https://upload.wikimedia.org/wikipedia/commons/1/10/Dino_Fava_all%E2%80%99udinese.jpg",
  "15b64b1813cd461a": "https://upload.wikimedia.org/wikipedia/commons/4/4c/Emil_Holm_%28Sweden_vs_Moldova%2C_12_October_2023%29.jpg",
  "ca1ace7851ab17ff": "https://upload.wikimedia.org/wikipedia/commons/f/f7/Gaetano_Oristanio_%28cropped%29.png",
  "e6b3232bf302aad0": "https://upload.wikimedia.org/wikipedia/commons/3/36/Dnepr-Lazio_%284%29.jpg",
  "8e4f9977db4cfe8a": "https://upload.wikimedia.org/wikipedia/commons/9/96/SM-Rangers18_%288%29_%28cropped%29.jpg",
  "b2797292a439043b": "https://upload.wikimedia.org/wikipedia/commons/8/89/Austria_vs._USA_2013-11-19_%28080%29.jpg",
  "188b65c4b7ddb0f4": "https://upload.wikimedia.org/wikipedia/commons/d/d2/Mohamed_Sissoko_in_2005.jpg",
  "0d61b74d49de211e": "https://upload.wikimedia.org/wikipedia/commons/4/42/Wesley_Sneijder_%2815487233555%29_%28cropped%29.jpg",
  "6b7d4bf36fc92340": "https://upload.wikimedia.org/wikipedia/commons/f/fe/Federico_Viviani.jpg",
  "22afa76146059f88": "https://upload.wikimedia.org/wikipedia/commons/a/aa/A._Da_Costa.jpg",
  "2c73350353f8d8b0": "https://upload.wikimedia.org/wikipedia/commons/7/77/FC_Zenit_Saint_Petersburg_vs._Juventus%2C_20_October_2021_52_%28Arthur_Melo%29.jpg",
  "0b8ffec327dfe6c2": "https://upload.wikimedia.org/wikipedia/commons/c/c8/Timothy_Castagne_01.jpg",
  "f990f5bfdff54ede": "https://upload.wikimedia.org/wikipedia/commons/3/3a/Edeilson_%28cropped%29.jpg",
  "6c3b4871ebad6237": "https://upload.wikimedia.org/wikipedia/commons/c/c5/Venezia_-_Empoli_Serie_A_04012025_Stadio_Pier_Luigi_Penzo_3_%28Mattia_Viti%29.jpg",
  "32d0f92aa295a003": "https://upload.wikimedia.org/wikipedia/commons/b/b7/Taty_Castellanos_NYCvATL-06.12.25-041_%28cropped%29.jpg",
  "49d2ed65226e219e": "https://upload.wikimedia.org/wikipedia/commons/b/b4/Chochev.jpg",
  "ba2b7b8095bb9244": "https://upload.wikimedia.org/wikipedia/it/3/30/Phil_Masinga_-_AS_Bari_1997-98.jpg",
  "6c23440e980f7ad2": "https://upload.wikimedia.org/wikipedia/commons/b/b6/Levan_Mchedlidze_%28cropped%29.jpg",
  "1d705fb917585306": "https://upload.wikimedia.org/wikipedia/commons/9/95/Met-legia_%287%29.jpg",
  "7859c9ea362f87d7": "https://upload.wikimedia.org/wikipedia/commons/e/e6/Dahl_Thomasson_2021_%28cropped%29.jpg",
  "999e54b49940f773": "https://upload.wikimedia.org/wikipedia/commons/6/6a/Go_Ahead_Eagles_-_FC_Volendam_-_52915157035.jpg",
  "7d1257bad008740f": "https://upload.wikimedia.org/wikipedia/commons/3/3f/Scott_McTominay_2021.jpg",
  "586f8744635d4855": "https://upload.wikimedia.org/wikipedia/commons/b/bc/Franck_Ribery_2019_%28cropped%29.jpg",
  "9f14185e3389d948": "https://upload.wikimedia.org/wikipedia/commons/6/69/AC_Monza_2022_Serie_A_celebration_21_%28Marrone%29.jpg",
  "6d65ee6131c563e7": "https://upload.wikimedia.org/wikipedia/commons/4/40/Bryan_Dabo_2013.JPG",
  "9e7b2720d30d2eab": "https://upload.wikimedia.org/wikipedia/commons/7/7c/0K8A7941_%2853451622784%29_%28cropped%29.jpg",
  "2d0b553c69fb4fec": "https://upload.wikimedia.org/wikipedia/commons/5/5a/Norway_Italy_-_June_2025_A_37_%28cropped%29.jpg",
  "95b00fe12f2c27bc": "https://upload.wikimedia.org/wikipedia/commons/3/3b/Mitchell_Dijks_%282017%29.jpg",
  "13fc4196780470ba": "https://upload.wikimedia.org/wikipedia/commons/c/c7/Ridgeciano_haps-1447005938.JPG",
  "adc49d18bb3f833c": "https://upload.wikimedia.org/wikipedia/commons/5/5b/Reijnders_arriva_in_albergo_%28cropped%29.jpg",
  "043c8141d4f88b37": "https://upload.wikimedia.org/wikipedia/commons/e/ed/Zor%C3%B2.JPG",
  "192d633242783149": "https://upload.wikimedia.org/wikipedia/it/7/7a/Claudio_Bonomi_-_Castel_di_Sangro_Calcio_1996-97.jpg",
  "cdd23140752fc5d5": "https://upload.wikimedia.org/wikipedia/it/2/29/Giampiero_Maini_e_Pierluigi_Brivio_Vicenza-Milan_27_Novembre_1996_Quarti_di_Finale_di_Ritorno_Coppa_Italia_1996-1997.png",
  "624f97de10780d0e": "https://upload.wikimedia.org/wikipedia/commons/d/d5/Lens_-_Girondins_de_Bordeaux_%2819-09-2020%29_65.jpg",
  "9f0105b5a62b7bae": "https://upload.wikimedia.org/wikipedia/commons/e/e6/20180610_FIFA_Friendly_Match_Austria_vs._Brazil_Douglas_Costa_%28BRA%29_850_1486_%28cropped%29.jpg",
  "cc3b45ba948cdce2": "https://upload.wikimedia.org/wikipedia/commons/2/2b/Fabio_Vignaroli.jpg",
  "0b4c05294d192419": "https://upload.wikimedia.org/wikipedia/commons/9/91/Marc-Oliver_Kempf.jpg",
  "2dc990bc31ac8f3b": "https://upload.wikimedia.org/wikipedia/commons/d/dc/FC_Salzburg_gegen_Paris_Saint-Germain_UEFA_Champions_League_49_%28cropped%29.jpg",
  "86e8fcc33fbd5b96": "https://upload.wikimedia.org/wikipedia/commons/6/65/Entrenamiento_Argentina_Sub20_previo_al_mundial_-_BugWarp_%2814%29_%28cropped%29.jpg",
  "6a684c985cd6baec": "https://upload.wikimedia.org/wikipedia/commons/c/cb/KL_2015_Final_%2814%29.jpg",
  "65b7d4402bac5887": "https://upload.wikimedia.org/wikipedia/it/d/d3/Marco_Piovanelli.JPG",
  "bad1e4cc84d34f8d": "https://upload.wikimedia.org/wikipedia/commons/b/b1/Maya_Yoshida.jpg",
  "01801a552cd0f433": "https://upload.wikimedia.org/wikipedia/commons/f/f7/Cipriani_ritaglio.jpg",
  "45c7d4a1e4fb7516": "https://upload.wikimedia.org/wikipedia/commons/b/bf/FWC_2018_-_Round_of_16_-_COL_v_ENG_-_Photo_103_%28cropped%29.jpg",
  "4a81bfa33c3924d9": "https://upload.wikimedia.org/wikipedia/commons/d/d3/Rasmus_H%C3%B8jlund_with_a_fan.jpg",
  "034e36a394c8e674": "https://upload.wikimedia.org/wikipedia/commons/6/6f/20130814_AT-GR_Lazaros_Christodoulopoulos_2368_%28cropped%29.jpg",
  "09afa4e36782994f": "https://upload.wikimedia.org/wikipedia/commons/d/db/Alessandro_Murgia.jpg",
  "297770b2e0c4ec80": "https://upload.wikimedia.org/wikipedia/commons/1/14/Matteo_Prati_2024_%28cropped%29.jpg",
  "3811ff58e64ede59": "https://upload.wikimedia.org/wikipedia/commons/c/c1/Kouadio_Manu_Kon%C3%A9_%282019-08-31%29_%28cropped%29.jpg",
  "09123306855ea0d3": "https://upload.wikimedia.org/wikipedia/commons/b/b0/Carlos_Bacca%2C_2012-07-17.jpg",
  "82994b1a571d4b9b": "https://upload.wikimedia.org/wikipedia/commons/4/44/FRA-ARG_%286%29.jpg",
  "79af93fd43698031": "https://upload.wikimedia.org/wikipedia/commons/8/82/Gianluca_Grava_-_SSC_Neapel_%281%29.jpg",
  "e4a41f795bab0a08": "https://upload.wikimedia.org/wikipedia/commons/e/e1/Marvin_Zeegelaar_2.jpg",
  "4d7bd9ef94dccbf8": "https://upload.wikimedia.org/wikipedia/commons/5/5d/Mariga.jpg",
  "77bf71ddc750d3b4": "https://upload.wikimedia.org/wikipedia/commons/c/c2/Cengiz_%C3%9Cnder_2018.jpg",
  "cc9d478803da9a31": "https://upload.wikimedia.org/wikipedia/it/3/36/Pivotto_matteo.jpg",
  "18c846a6d99ead7f": "https://upload.wikimedia.org/wikipedia/commons/3/3c/Go_Ahead_Eagles_-_AZ_%28Jens_Odgaard%29.jpg",
  "f14a948f98f9e9a7": "https://upload.wikimedia.org/wikipedia/commons/e/e3/Lens_-_Nice_%2823-01-2021%29_36_%28cropped%29.jpg",
  "f64985c3c62e9336": "https://upload.wikimedia.org/wikipedia/commons/f/f3/Roberto_Vitiello.jpg",
  "01424532523b8539": "https://upload.wikimedia.org/wikipedia/commons/7/73/Guillermo_Daniel_Rodr%C3%ADguez.jpg",
  "817218bbfd790f55": "https://upload.wikimedia.org/wikipedia/commons/2/2f/Frederik_Hillesborg_S%C3%B8rensen.JPG",
  "fba170bdcf0bdd0d": "https://upload.wikimedia.org/wikipedia/commons/6/64/FWC_2018_-_Group_E_-_SRB_v_BRA_-_Photo_113_%28cropped%29.jpg",
  "9c0696288c56f1c6": "https://upload.wikimedia.org/wikipedia/commons/1/11/Victor_Obinna_2011.jpg",
  "60080ca396b6c71e": "https://upload.wikimedia.org/wikipedia/commons/6/66/20180610_FIFA_Friendly_Match_Austria_vs._Brazil_Paulinho_850_1696.jpg",
  "21703e1cb05bc8e1": "https://upload.wikimedia.org/wikipedia/commons/d/d7/Achraf_Lazaar.jpg",
  "3115994a10abedf9": "https://upload.wikimedia.org/wikipedia/commons/a/a2/Viktor_Kovalenko_132316.jpg",
  "2f875b46a520056f": "https://upload.wikimedia.org/wikipedia/commons/4/46/Vid_Belec_%28cropped%29.jpg",
  "bc02cd800c2ebf8c": "https://upload.wikimedia.org/wikipedia/commons/f/f6/Zito_Luvumbo_2024_%28cropped%29.jpg",
  "ad942da5503a9b5d": "https://upload.wikimedia.org/wikipedia/commons/4/4c/Martin_Jir%C3%A1nek2014.jpg",
  "db5b94e21caa4ff8": "https://upload.wikimedia.org/wikipedia/commons/6/68/Ali_Adnan_2019_AFC_Asian_Cup.jpg",
  "30e833733d5fcb96": "https://upload.wikimedia.org/wikipedia/commons/6/66/Gianluca_Busio.jpg",
  "f334e6ba4f128a0a": "https://upload.wikimedia.org/wikipedia/commons/6/65/Youssouf_Fofana_%28footballer%2C_born_1999%29_%28cropped%29.jpg",
  "5ccbea58d815398b": "https://upload.wikimedia.org/wikipedia/commons/0/05/FC_Red_Bull_Salzburg_gegen_SK_Austria_Klagenfurt_%282024-03-03%29_57.jpg",
  "01e2a872fc411e2a": "https://upload.wikimedia.org/wikipedia/it/e/e0/Luca_Mondini_-_SSC_Napoli_2000-01.jpg",
  "c201357e1bdf7b7d": "https://upload.wikimedia.org/wikipedia/commons/9/9f/Rene_Krhin_-_Inter_Mailand_%281%29.jpg",
  "de99a56be2d14c6f": "https://upload.wikimedia.org/wikipedia/commons/d/dc/Diego_Demme.JPG",
  "6a38f569569a404c": "https://upload.wikimedia.org/wikipedia/commons/1/12/Musacchio_Vila-real.jpg",
  "d8708d0c756fdd30": "https://upload.wikimedia.org/wikipedia/commons/e/ed/Ferdinand_Coly.jpg",
  "7b1a13535f7364e8": "https://upload.wikimedia.org/wikipedia/it/8/82/Luis_Helguera_Buj%C3%ADa_-_Udinese_Calcio_2000-01.jpg",
  "381627923c791d9b": "https://upload.wikimedia.org/wikipedia/commons/7/7c/Lionel_Scaloni_-_2022.jpg",
  "de44c57417710c0d": "https://upload.wikimedia.org/wikipedia/commons/c/c5/Federico_Santander.jpg",
  "19850e1d56fbc89b": "https://upload.wikimedia.org/wikipedia/commons/d/d3/Jordan_Lukaku.jpg",
  "f2dd976cffe19bba": "https://upload.wikimedia.org/wikipedia/commons/d/d2/Alessio_Sestu.jpg",
  "888c22c87101d323": "https://upload.wikimedia.org/wikipedia/commons/b/bf/AUT_vs._LIE_2015-10-12_%28183%29_Marcel_B%C3%BCchel.jpg",
  "b9797fb04d28e2e6": "https://upload.wikimedia.org/wikipedia/commons/d/d4/Robin_Quaison_%28Sweden_starting_XI_vs_Moldova%2C_12_October_2023%29.jpg",
  "550bfabc06b6e1c9": "https://upload.wikimedia.org/wikipedia/commons/a/a4/Bartosz_Salamon01.jpg",
  "4f2af164d0cf13d2": "https://upload.wikimedia.org/wikipedia/commons/a/a1/Edwin_van_der_Sar_2015.jpg",
  "9d143541d6042a72": "https://upload.wikimedia.org/wikipedia/commons/a/ae/SM_Caen_vs_UNFP%2C_July_30th_2016_-_Jean-Victor_Makengo_1.jpg",
  "a534bd34e708fe3e": "https://upload.wikimedia.org/wikipedia/commons/3/31/Carlos_Tevez_with_Argentina_November_2014_%28cropped%29.jpg",
  "9fc4860b640ed22c": "https://upload.wikimedia.org/wikipedia/commons/4/42/Cheddira_%28cropped%29.jpg",
  "3a64383599c80d25": "https://upload.wikimedia.org/wikipedia/commons/2/27/Milan_Cagliari_2025_-_06_%28Antoine_Makoumbou%29.jpg",
  "786e0622ee7a8822": "https://upload.wikimedia.org/wikipedia/commons/d/d6/Wesley_Hoedt_2017-08-22_1.jpg",
  "a310017f428a53d4": "https://upload.wikimedia.org/wikipedia/commons/d/d6/Norway_Italy_-_June_2025_A_21_%28cropped%29.jpg",
  "586bd623586f8ed0": "https://upload.wikimedia.org/wikipedia/commons/4/4b/Leon_Dailey_Julio_Cesar.jpg",
  "1f14a966eff2c2a2": "https://upload.wikimedia.org/wikipedia/commons/7/71/Lucas_Beltran.jpg",
  "cd5e05511afe42e8": "https://upload.wikimedia.org/wikipedia/it/b/b9/Federico_Magallanes_-_Atalanta_BC_1996-97.jpg",
  "a6333f85bf4f78ca": "https://upload.wikimedia.org/wikipedia/commons/6/61/Alieu_Fadera_%28cropped%29.jpg",
  "736c08de50f7c102": "https://upload.wikimedia.org/wikipedia/commons/5/53/Jean_Butez_%28cropped%29.jpg",
  "15cb200894f31a4d": "https://upload.wikimedia.org/wikipedia/commons/0/0c/Ancien_du_PSG_Patrick_Mboma.jpg",
  "5224dd2b81e78ffd": "https://upload.wikimedia.org/wikipedia/commons/c/c8/Thiago_ribeiro.jpg",
  "d3fa0da791869cff": "https://upload.wikimedia.org/wikipedia/it/e/e0/Pietro_parente.png",
  "6970b2a0a95add3a": "https://upload.wikimedia.org/wikipedia/commons/8/8d/Gerson_Santos_da_Silva_2016.jpg",
  "a6e1706187181ee4": "https://upload.wikimedia.org/wikipedia/commons/0/03/Joan_Gonz%C3%A1lez_2024.jpg",
  "8bee27ffb66b165f": "https://upload.wikimedia.org/wikipedia/commons/6/64/RC_Lens_-_Lille_OSC_%2808-10-2023%29_2.jpg",
  "bbbb074a227c8f50": "https://upload.wikimedia.org/wikipedia/it/8/87/Julio_C%C3%A9sar_Dely_Vald%C3%A9s_-_Cagliari_Calcio_1993-94.jpg",
  "dbc6255809408f84": "https://upload.wikimedia.org/wikipedia/commons/b/b6/Fenerbah%C3%A7e_-_Cagliari_Calcio_20170807_%28233%29.jpg",
  "527a30850d7584eb": "https://upload.wikimedia.org/wikipedia/commons/c/c2/Rostov-Ufa18_%2813%29.jpg",
  "df38f24f7d660b80": "https://upload.wikimedia.org/wikipedia/commons/c/c2/Luk%C3%A1%C5%A1_Jarol%C3%ADm_2014.JPG",
  "49024c51baf9ae27": "https://upload.wikimedia.org/wikipedia/commons/1/1c/GAE_-_Ajax_-_52788521318_%28cropped%29.jpg",
  "e1eac718a4e935b6": "https://upload.wikimedia.org/wikipedia/it/5/5c/Alex_Calderoni_-_Alzano_1909_Virescit_FC_1999-2000.jpg",
  "9ba7130cda4d1de3": "https://upload.wikimedia.org/wikipedia/commons/6/66/Milan_Lecce_2023_Thiaw.jpg",
  "d88b2c6c2138eadf": "https://upload.wikimedia.org/wikipedia/commons/9/93/SWE-SWI_%2813%29_%28cropped%29_2.jpg",
  "3bf93c2881657174": "https://upload.wikimedia.org/wikipedia/commons/1/1c/SVK_vs._SMR_2024_Slovakia_Nr._7_Suslov_%28cropped%29.jpg",
  "97b4363535765b13": "https://upload.wikimedia.org/wikipedia/commons/f/ff/Tore_Andre_Flo_2006_06_06.jpg",
  "24202d1669fdb170": "https://upload.wikimedia.org/wikipedia/commons/d/d8/Davide_Lanzafame_Catania_%28cropped%29.jpg",
  "57f4cb440b6e2243": "https://upload.wikimedia.org/wikipedia/commons/9/9c/Lens_-_Nice_%2823-01-2021%29_52.jpg",
  "8259aeafb90ac4a4": "https://upload.wikimedia.org/wikipedia/commons/b/be/Giuseppe_Rossi01_%28cropped%29.jpg",
  "9c0eccfd8bab6c63": "https://upload.wikimedia.org/wikipedia/it/1/14/Robert_Jarni.jpg",
  "88fda999e0b72c62": "https://upload.wikimedia.org/wikipedia/commons/9/9e/Cicinho%2713.JPG",
  "6913fc67d80f16e7": "https://upload.wikimedia.org/wikipedia/commons/4/4b/Artur_Boruc_2014.jpg",
  "bf53febde1e4c10b": "https://upload.wikimedia.org/wikipedia/it/0/03/Dar%C3%ADo_Silva_-_Cagliari_Calcio_1995-96.png",
  "679cef727beef057": "https://upload.wikimedia.org/wikipedia/commons/0/0a/2020-03-10_Fu%C3%9Fball%2C_M%C3%A4nner%2C_UEFA_Champions_League_Achtelfinale%2C_RB_Leipzig_-_Tottenham_Hotspur_1DX_3690_by_Stepro_%28cropped%29.jpg",
  "37c7ec99833399c5": "https://upload.wikimedia.org/wikipedia/commons/2/2a/Gen%C3%A8ve_Indoors_2014_-_20140114_-_Christian_Karembeu_2.jpg",
  "a2dc1f10da683a39": "https://upload.wikimedia.org/wikipedia/commons/c/c6/Diego_God%C3%ADn_2018_%28cropped%29.jpg",
  "ff5076125f9e80b9": "https://upload.wikimedia.org/wikipedia/commons/4/4e/Suat_Serdar.jpg",
  "6452af272a9bb132": "https://upload.wikimedia.org/wikipedia/commons/7/7b/Kristian_kabasele.jpg",
  "a4009e1dfa13971f": "https://upload.wikimedia.org/wikipedia/commons/4/42/Anastasios_Douvikas_2_%2806-09-2022%29.jpg",
  "12065c36efd33734": "https://upload.wikimedia.org/wikipedia/commons/d/d5/Domenico_Giamp%C3%A0_Nola_2025.jpg",
  "44b5f5175d78c892": "https://upload.wikimedia.org/wikipedia/commons/9/96/The_Liverpool_team_line-up_before_the_game_v_Spartak_Moskva%2C_December_2017_%28cropped%29_%28cropped%29.jpg",
  "1cbff02e9b4fd3c2": "https://upload.wikimedia.org/wikipedia/it/8/8c/Hasan_Salihamid%C5%BEi%C4%87_%28Bayern_Monaco%29_-_UEFA_Champions_League_2000-01.jpg",
  "39fba44b04633fa3": "https://upload.wikimedia.org/wikipedia/commons/0/0f/20160824_RBS_DIN_7250.jpg",
  "55b587cb53bbf219": "https://upload.wikimedia.org/wikipedia/commons/2/28/Fabio_Rustico.jpg",
  "bac9e420239be8ee": "https://upload.wikimedia.org/wikipedia/commons/9/95/Francesco_Vicari.jpg",
  "5533f10259bafe2b": "https://upload.wikimedia.org/wikipedia/commons/f/f0/Takehiro_Tomiyasu%2C_2019_AFC_Asian_Cup_1.jpg",
  "fc6b698907d2cea5": "https://upload.wikimedia.org/wikipedia/commons/9/94/Carlos_Alcaraz_US_Open_2025_%28cropped%29.jpg",
  "27936257207b923a": "https://upload.wikimedia.org/wikipedia/commons/c/c1/FC_RB_Salzburg_gegen_WSG_Tirol_%28_mit_Meisterteller%C3%BCbergabe_22._Mai_2021%29_05.jpg",
  "de7e06d8e375357e": "https://upload.wikimedia.org/wikipedia/commons/3/37/Marcus_Rohd%C3%A9n_7_B_-_Frosinone_Calcio_-_DSC_3194_AF.jpg",
  "eee6561c09fc2caa": "https://upload.wikimedia.org/wikipedia/commons/0/05/Pesce_UDI-CAT_4-2.jpg",
  "c652757c262e2098": "https://upload.wikimedia.org/wikipedia/commons/9/9e/2022_FIFA_World_Cup_United_States_1%E2%80%931_Wales_-_%2817%29_%28cropped%29.jpg",
  "18361ddd3617bf99": "https://upload.wikimedia.org/wikipedia/commons/2/22/Ethan_Ampadu_With_Wales_2020_%28cropped%29.jpg",
  "11a7cffedee261e6": "https://upload.wikimedia.org/wikipedia/commons/5/51/DG10.png",
  "9fa4a7e260180b0a": "https://upload.wikimedia.org/wikipedia/it/e/eb/Carmine_Esposito_-_Empoli_FC_1997-98.jpg",
  "b5ee83f689b75740": "https://upload.wikimedia.org/wikipedia/commons/1/1a/Lens_-_Nice_%2823-01-2021%29_47.jpg",
  "2b5c194677e5ede7": "https://upload.wikimedia.org/wikipedia/commons/d/d2/Jordan_Zemura_2020.png",
  "25478b62af27cc47": "https://upload.wikimedia.org/wikipedia/commons/a/a1/Marco_Rigoni.jpg",
  "a9a721bb75329dbe": "https://upload.wikimedia.org/wikipedia/commons/3/3c/2020-03-10_Fu%C3%9Fball%2C_M%C3%A4nner%2C_UEFA_Champions_League_Achtelfinale%2C_RB_Leipzig_-_Tottenham_Hotspur_1DX_3678_by_Stepro.jpg",
  "6685df6b6247aad7": "https://upload.wikimedia.org/wikipedia/commons/c/cf/Igor_Simutenkov.jpg",
  "84ca03e0bf7f2dd9": "https://upload.wikimedia.org/wikipedia/it/9/9d/Cristian_Bucchi_-_AC_Perugia_2000-01.jpg",
  "94de2d6e8563a9b7": "https://upload.wikimedia.org/wikipedia/commons/b/b8/Lyanco_Evangelista_Silveira_Neves_Vojnovi%C4%87_2017.jpg",
  "3bf66535d72cb03a": "https://upload.wikimedia.org/wikipedia/commons/b/b5/Alberto_Dossena_Como_2024.jpg",
  "626225e5a177682a": "https://upload.wikimedia.org/wikipedia/commons/8/82/Sergio_Romero_Manchester_United_v_Zorya_Luhansk%2C_September_2016.jpg",
  "9756c5b34fc78ae9": "https://upload.wikimedia.org/wikipedia/it/8/8b/Massimiliano_Fusani_-_AC_Perugia_2003-04.jpg",
  "7a1a5884bbed6e36": "https://upload.wikimedia.org/wikipedia/commons/0/08/Massimo-loviso.jpg",
  "f6402847e150308d": "https://upload.wikimedia.org/wikipedia/commons/c/c4/SantiagoMoreroNocerinaLive.jpg",
  "f1837e75bc0ad117": "https://upload.wikimedia.org/wikipedia/commons/d/dd/In%C3%A1cio_Pi%C3%A1_-_SSC_Neapel_%281%29.jpg",
  "35351070be9ffe7d": "https://upload.wikimedia.org/wikipedia/commons/8/8a/Libor_Koz%C3%A1k%2C_Czech_Rp.-Montenegro_EURO_2020_QR_10-06-2019.jpg",
  "023eae8969cd0b24": "https://upload.wikimedia.org/wikipedia/commons/3/3b/Manuel_Coppola.jpg",
  "6fa01a9a454ea26b": "https://upload.wikimedia.org/wikipedia/commons/c/cc/Diomansy_Kamara.png",
  "424c88b34bfb0fbf": "https://upload.wikimedia.org/wikipedia/commons/7/76/Marcos_Alonso_Mendoza.jpg",
  "94ea0eb0fefbd944": "https://upload.wikimedia.org/wikipedia/commons/f/f8/Julio_Sergio_Bertagnoli.jpg",
  "975fce16c135404e": "https://upload.wikimedia.org/wikipedia/commons/6/6b/Josef_Mart%C3%ADnez_Atlanta_United_2017.jpg",
  "5c3b544eaddc8abe": "https://upload.wikimedia.org/wikipedia/it/e/e1/Generoso_Rossi_%28Bari%2C_2000-2001%29.jpg",
  "957e94800a9babfa": "https://upload.wikimedia.org/wikipedia/commons/1/1d/Ivica_Iliev.jpg",
  "f0600ad81626f2e0": "https://upload.wikimedia.org/wikipedia/commons/f/f1/CacqueretComo2025.jpg",
  "281dd2fb697dbf0e": "https://upload.wikimedia.org/wikipedia/it/c/ca/Nenad_Saki%C4%87_-_UC_Sampdoria_1998-99.jpg",
  "64031ef182dec9f6": "https://upload.wikimedia.org/wikipedia/commons/d/d0/Loum_Tchaouna_29112025_%286%29.jpg",
  "11795e9f90b49ff3": "https://upload.wikimedia.org/wikipedia/commons/c/c7/Delta_-_Gol_Copa_America_Centenario_%2826958100643%29.jpg",
  "d0374836d329f520": "https://upload.wikimedia.org/wikipedia/commons/e/e2/Joshua_Zirkzee_2019.jpg",
  "6c978087757cb56e": "https://upload.wikimedia.org/wikipedia/commons/b/bc/2019-06-11_Fu%C3%9Fball%2C_M%C3%A4nner%2C_L%C3%A4nderspiel%2C_Deutschland-Estland_StP_2060_LR10_by_Stepro.jpg",
  "29d5d5023f654c66": "https://upload.wikimedia.org/wikipedia/commons/b/ba/SVK_vs._SMR_2024_San_Marino_Coach_Cevoli_%284%29.jpg",
  "6d5d722cc1219728": "https://upload.wikimedia.org/wikipedia/commons/8/8e/090815_J.Heinrich_Harzmann164.jpg",
  "c94e81dabb42e994": "https://upload.wikimedia.org/wikipedia/commons/7/79/Ferm%C3%ADn_L%C3%B3pez.jpg",
  "46e06622bf3cf444": "https://upload.wikimedia.org/wikipedia/commons/d/d7/RC_Lens_-_Montpellier_HSC_%2812-12-2020%29_17.jpg",
  "9281537df4284f53": "https://upload.wikimedia.org/wikipedia/commons/7/7b/ZION_SUZUKI_-_JPN_vs_THA_-_Friendly_Match_-_2024.01.01.jpg",
  "96bca9e6b8e61ce6": "https://upload.wikimedia.org/wikipedia/commons/8/8a/Nuno_Tavares_2019.png",
  "db19b7dd58dea3b9": "https://upload.wikimedia.org/wikipedia/commons/8/8a/GastonPereiro2022.jpeg",
  "104ac47e461a6fa6": "https://upload.wikimedia.org/wikipedia/commons/1/10/Tomas_danilevicius_zemynos_stadionas_%28cropped%29.JPG",
  "7ca7eb56689c07e6": "https://upload.wikimedia.org/wikipedia/commons/3/3e/20180602_FIFA_Friendly_Match_Austria_vs._Germany_Antonio_R%C3%BCdiger_850_0711.jpg",
  "03e96fe6d15e600e": "https://upload.wikimedia.org/wikipedia/commons/d/dc/Zajc_asse_tfc_2425.png",
  "030aaac8176ea94a": "https://upload.wikimedia.org/wikipedia/commons/2/27/Universidad_de_Chile_v_Uni%C3%B3n_La_Calera_20200227_11.jpg",
  "11f16210d3298cfe": "https://upload.wikimedia.org/wikipedia/it/3/3d/De_Franceschi%2C_Del_Piero%2C_Boscolo_-_Calcio_Padova_%281990s%29.jpg",
  "6eec413c5738923e": "https://upload.wikimedia.org/wikipedia/commons/a/a0/Lens_-_Girondins_de_Bordeaux_%2819-09-2020%29_53_%28cropped%29.jpg",
  "dded86e522a32dd2": "https://upload.wikimedia.org/wikipedia/commons/7/76/1_Sokratis_Papastathopoulos.jpg",
  "be4646d0aa8d355b": "https://upload.wikimedia.org/wikipedia/it/4/4d/Luca_Tognozzi_-_US_Colligiana_1997-98.jpg",
  "b77dd7bc9fdafedf": "https://upload.wikimedia.org/wikipedia/commons/1/1f/Oier_zarraga_%28cropped%29.jpg",
  "4afc760751b39e7e": "https://upload.wikimedia.org/wikipedia/commons/4/40/GAE_-_Sparta_Rotterdam_-_53278021348_%28_Jonathan_de_Guzm%C3%A1n%29.jpg",
  "befb0b0d00741daa": "https://upload.wikimedia.org/wikipedia/it/1/1f/Gianni_Comandini_-_Milan_AC_2000-01.jpg",
  "071f315d95db0c68": "https://upload.wikimedia.org/wikipedia/commons/f/fa/Marcos_Assun%C3%A7%C3%A3o.JPG",
  "38cff8e8adce28f2": "https://upload.wikimedia.org/wikipedia/commons/1/12/Gennaro_Iezzo_-_SSC_Neapel_%282%29.jpg",
  "4701fb73077a3f58": "https://upload.wikimedia.org/wikipedia/commons/4/46/Antonio_Rosati.jpg",
  "cc8d9dbf7c7340ff": "https://upload.wikimedia.org/wikipedia/commons/9/96/Andrea_Ardito.jpg",
  "6cdad3ed9d8cac9a": "https://upload.wikimedia.org/wikipedia/commons/4/43/Ghilardi_ASRoma_%28cropped%29.jpeg",
  "ddeabc11b4567792": "https://upload.wikimedia.org/wikipedia/it/6/62/Darko_Kova%C4%8Devi%C4%87_-_Juventus_FC_%281999%29.jpg",
  "b76549eb21d0ad06": "https://upload.wikimedia.org/wikipedia/commons/6/63/Frosinone_Calcio_-_Stadio_Matusa_-_vs_Lecce_0-4_6_2_2010_DSC_4508.jpg",
  "090efa58d115f013": "https://upload.wikimedia.org/wikipedia/commons/8/8e/Edmundo.jpg",
  "64557f74e79bf6a7": "https://upload.wikimedia.org/wikipedia/commons/c/cb/Lorenzo_Pirola%2C_Milan_-_Salernitana_13-03-2023_%28cropped%29.jpg",
  "cd515623c2eea97c": "https://upload.wikimedia.org/wikipedia/commons/1/1e/Ferran_Torres_2019.png",
  "3595502ac6c2aa07": "https://upload.wikimedia.org/wikipedia/commons/5/5e/Frosinone_Calcio_-_Stadio_Matusa_-_vs_Portogruaro_11_9_2010_Antonio_Bocchetti_25_Ant_0370.jpg",
  "6fc73145faa83027": "https://upload.wikimedia.org/wikipedia/commons/4/41/Paul_Ince.jpg",
  "ca8a2dee7c7cfd64": "https://upload.wikimedia.org/wikipedia/commons/9/9f/FC_Internazionale_Milano_v_US_Sassuolo_Calcio%2C_21_September_2025_-_08_%28Cristian_Volpato%29.jpg",
  "288f86f36f4604c1": "https://upload.wikimedia.org/wikipedia/commons/6/6b/Pawe%C5%82_Wszo%C5%82ek_2011.jpg",
  "24a762bf340bbdad": "https://upload.wikimedia.org/wikipedia/commons/9/98/Patrice_Evra_Euro_2012.jpg",
  "59c647b9d11634ce": "https://upload.wikimedia.org/wikipedia/commons/0/01/Patrick_Dorgu_Como-Lecce_30_Dec_2024.jpg",
  "05a08df4811ec906": "https://upload.wikimedia.org/wikipedia/commons/4/4f/Justin_Kluivert_2023.jpg",
  "98c1a3a3d5126e62": "https://upload.wikimedia.org/wikipedia/commons/0/06/Memushaj.png",
  "657b0cfea3bdaea1": "https://upload.wikimedia.org/wikipedia/commons/2/2f/Pau_Lopez_2019.jpg",
  "65238999bfbe4cad": "https://upload.wikimedia.org/wikipedia/commons/0/02/Web_Summit_2016_-_SportsTrade_-_Nov_8_-_Day_1_ws_%2867_of_79%29_%2830860213285%29_%28cropped%29.jpg",
  "2b10e671802a1e6b": "https://upload.wikimedia.org/wikipedia/commons/7/7d/Gaetano_Berardi_Leeds_%28cropped%29.jpg",
  "f0528f7b17b3ddba": "https://upload.wikimedia.org/wikipedia/commons/7/75/Dennis_Bergkamp_2014_%28cropped%29.jpg",
  "ce2d91191b3cbce5": "https://upload.wikimedia.org/wikipedia/commons/2/28/Palestino_-_Universidad_de_Concepci%C3%B3n_20190309_18.jpg",
  "3a49e79f76033100": "https://upload.wikimedia.org/wikipedia/commons/0/08/Photo_of_Bojan_Krkic.jpg",
  "97248876b12ad74a": "https://upload.wikimedia.org/wikipedia/commons/d/dc/Austria_U21_vs._Turkey_U21_20131114_%28071%29.jpg",
  "cd5768adf68856b8": "https://upload.wikimedia.org/wikipedia/commons/9/9c/Dellas_2008.jpg",
  "4040c2a6549b74a5": "https://upload.wikimedia.org/wikipedia/commons/9/9a/Padalino.JPG",
  "cb99faa2e79e5e0e": "https://upload.wikimedia.org/wikipedia/it/7/75/Jos%C3%A9_Mari_-_Milan_AC_2000-01.jpg",
  "2586cff47bdb7e82": "https://upload.wikimedia.org/wikipedia/commons/f/fa/Kily_Gonzalez.jpg",
  "bd684ba63781250f": "https://upload.wikimedia.org/wikipedia/commons/a/ae/CanceloCity23.jpg",
  "7115227c74b44896": "https://upload.wikimedia.org/wikipedia/it/6/68/R%C3%A9gis_Herv%C3%A9_Genaux_-_Udinese_Calcio_1999-2000.jpg",
  "9e6d1f233e5bbf50": "https://upload.wikimedia.org/wikipedia/commons/9/93/Christian_Gytkjaer_Lech_Pozna%C5%84_2017_%28cropped%29.jpg",
  "fea59532531cd320": "https://upload.wikimedia.org/wikipedia/commons/7/77/Birkir_Bjarnason_2018.jpg",
  "c11723b8ae4e5f9f": "https://upload.wikimedia.org/wikipedia/it/b/b8/GrassadoniaCagliari.jpg",
  "4de404c30d89f2cc": "https://upload.wikimedia.org/wikipedia/commons/9/91/Joachim_Bjorklund.jpg",
  "faab41a0e25ad64e": "https://upload.wikimedia.org/wikipedia/commons/6/63/20160326_AUT_ALB_0017.jpg",
  "ba60ea5dd166f8e8": "https://upload.wikimedia.org/wikipedia/commons/d/d7/Nicol%C3%A1s_L%C3%B3pez2.jpg",
  "3f794007de851a68": "https://upload.wikimedia.org/wikipedia/commons/6/61/1_%C3%81d%C3%A1m_Nagy_%28cropped%29.jpg",
  "84767b8fff0cf65a": "https://upload.wikimedia.org/wikipedia/commons/0/0f/Savini.JPG",
  "13c5230e52db13ba": "https://upload.wikimedia.org/wikipedia/commons/e/e1/2012_2013_-_37_Cristian_Tello.jpg",
  "0bfac17c9401d71a": "https://upload.wikimedia.org/wikipedia/commons/6/6c/Lukas_Lerager_%28cropped%29.jpg",
  "a2cffac33d7e8a04": "https://upload.wikimedia.org/wikipedia/commons/6/6c/Jannik_Vestergaard%2C_Mart%C3%AD_Cifuentes_and_Caleb_Okoli_23082025_%282%29_%28cropped%29.jpg",
  "b45a649304e6fef7": "https://upload.wikimedia.org/wikipedia/it/e/ee/Massimo_Margiotta_-_Udinese_Calcio_2000-01.jpg",
  "fd8a1d72336bab2f": "https://upload.wikimedia.org/wikipedia/commons/5/5a/Benjamin_Pavard_20180709.jpg",
  "f6a49c79e96e4c84": "https://upload.wikimedia.org/wikipedia/commons/3/36/Artem_Dovbyk.jpg",
  "c696c6f05d4ade31": "https://upload.wikimedia.org/wikipedia/commons/b/bf/Radu_Dragusin_-_Frosinone_vs_Genoa_14_May_2023.jpg",
  "917e577f0cfe4511": "https://upload.wikimedia.org/wikipedia/commons/d/dd/Norway_Italy_-_June_2025_A_28_%28cropped%29.jpg",
  "9c1b40a9be07af23": "https://upload.wikimedia.org/wikipedia/commons/0/00/Alex_Valle_ACCI_FCBARCELONA_Turisme_Catalunya_gira_pretemporada.jpg",
  "58aab439b439dca6": "https://upload.wikimedia.org/wikipedia/commons/2/28/Samir_Ujkani.JPG",
  "d956aea5e99bf114": "https://upload.wikimedia.org/wikipedia/it/a/a7/Bryan_Roy.jpg",
  "e880c9cbe7a0cce5": "https://upload.wikimedia.org/wikipedia/commons/e/e9/1_Shkodran_Mustafi_2018_%28cropped%29.jpg",
  "de42d33a51639508": "https://upload.wikimedia.org/wikipedia/commons/9/93/Kristoffer_Askildsen_19_Viking_FK_UECL_20250813_%281%29.jpg",
  "50af3717b730efad": "https://upload.wikimedia.org/wikipedia/commons/1/19/Alexander_Farnerud_bei_einem_Testspiel_in_Wernau.JPG",
  "dc7496355ebcf6db": "https://upload.wikimedia.org/wikipedia/it/5/55/Bruno_N%27Gotty.jpg",
  "8f89722e406b8246": "https://upload.wikimedia.org/wikipedia/commons/3/30/Kondogbia_asse_om_2425.png",
  "b08c8fc3a941564b": "https://upload.wikimedia.org/wikipedia/commons/e/e0/Farin%C3%B3s_en_el_ayuntamiento_de_Alicante_tras_el_ascenso_en_2010_cropped.JPG",
  "7f770b26c46948ca": "https://upload.wikimedia.org/wikipedia/commons/1/11/Samuel_Di_Carmine.jpg",
  "f5d005cc2fc20ac9": "https://upload.wikimedia.org/wikipedia/commons/f/f8/Josip_brekalo.jpg",
  "260a88f135de97d6": "https://upload.wikimedia.org/wikipedia/commons/7/7a/Domen_%C4%8Crnigoj%2C_Milan_-_Salernitana_13-03-2023_%28cropped%29.jpg",
  "ebbedaa804be4292": "https://upload.wikimedia.org/wikipedia/commons/a/ac/Leo_%C5%A0tulac.jpg",
  "763200f4bf5143a7": "https://upload.wikimedia.org/wikipedia/commons/8/81/Massimo_Volta.jpg",
  "ba9f51dea06cdfff": "https://upload.wikimedia.org/wikipedia/commons/2/27/S%C3%89RIE_A_-_PALMEIRAS_0_X_2_ATHLETICO_PARANAENSE_-_Vitor_Roque.jpg",
  "07d9d3f35803454c": "https://upload.wikimedia.org/wikipedia/commons/c/ca/Aaron_Ramsey_26042025_%281%29.jpg",
  "dfe221c2edaaa23e": "https://upload.wikimedia.org/wikipedia/commons/f/ff/Joaquin_2022_%28cropped%29.jpg",
  "4ac22a8d43896210": "https://upload.wikimedia.org/wikipedia/commons/1/16/Uni%C3%B3n_La_Calera_-_Colo-Colo_20190506_36.jpg",
  "d8d56317bce56512": "https://upload.wikimedia.org/wikipedia/it/f/f9/Fabio_Gatti_-_AC_Perugia_2001-02.jpg",
  "c35b1a55ff742ea4": "https://upload.wikimedia.org/wikipedia/commons/b/bd/Jesper_Blomqvist.jpg",
  "52693921a05cec6f": "https://upload.wikimedia.org/wikipedia/commons/7/7a/Schalke_Poulsen02.jpg",
  "d4cdc5debb4381d9": "https://upload.wikimedia.org/wikipedia/commons/0/09/Micka%C3%ABl_Ciani_2.jpg",
  "7fc805fc0b6a77f7": "https://upload.wikimedia.org/wikipedia/commons/4/4f/Gabriele_Angella_150124_Watford_v_Blackpool-96_%2816364032972%29.jpg",
  "18a5a54b5afe3f0d": "https://upload.wikimedia.org/wikipedia/commons/4/4c/Valentin_Carboni_%28cropped%29.jpg",
  "a19486762cb86c2e": "https://upload.wikimedia.org/wikipedia/commons/d/d6/Oikonomou_with_AEK.jpg",
  "6fbab31e523acad3": "https://upload.wikimedia.org/wikipedia/commons/7/77/Luigi_Vitale_-_SSC_Neapel_%282%29.jpg",
  "36b70ca2cc37822f": "https://upload.wikimedia.org/wikipedia/it/1/18/Taribo_West_1997.JPG",
  "80746c2d5230bcdc": "https://upload.wikimedia.org/wikipedia/it/a/af/Associazione_Calcio_Perugia_1999-2000.jpg",
  "b2eead1e437d2f7c": "https://upload.wikimedia.org/wikipedia/commons/0/03/GAE_-_Ajax_-_52788476880_%28Maarten_Stekelenburg%29.jpg",
  "3cfdc55939fbed4c": "https://upload.wikimedia.org/wikipedia/commons/3/35/Dalmat.jpg",
  "d2910b392d3cd33a": "https://upload.wikimedia.org/wikipedia/commons/0/09/Saliou_Lassissi.jpg",
  "22ac5f93b74facb2": "https://upload.wikimedia.org/wikipedia/commons/b/b3/Juan_Pablo_Carrizo.jpg",
  "7bab9bfdc9aed9c3": "https://upload.wikimedia.org/wikipedia/commons/0/03/Leonardo_Semplici_%28cropped%29.jpg",
  "b0f4f4eaf2d43bb8": "https://upload.wikimedia.org/wikipedia/commons/e/e4/Roque_J%C3%BAnior_em_2002.jpg",
  "9f2ffec90410204c": "https://upload.wikimedia.org/wikipedia/commons/4/40/Samuele_longo.jpg",
  "b7f2aa14941200d7": "https://upload.wikimedia.org/wikipedia/commons/3/39/Club_Brugge_x_SL_Benfica_07.png",
  "79294830521e5c04": "https://upload.wikimedia.org/wikipedia/commons/d/d0/Dennis_Man_-_23_November_2017.jpg",
  "30e65f6f7edda984": "https://upload.wikimedia.org/wikipedia/commons/4/4f/Innocent_Emeghara_-_Switzerland_vs._Argentina%2C_29th_February_2012.jpg",
  "dd95659bd2a2ed3f": "https://upload.wikimedia.org/wikipedia/commons/9/98/Jmicoud_%28cropped%29.jpg",
  "80ca8ae831d61fda": "https://upload.wikimedia.org/wikipedia/it/a/a7/Davide_Micillo.jpg",
  "dfa6cbfb8587ef9c": "https://upload.wikimedia.org/wikipedia/commons/9/90/Uni%C3%B3n_Espa%C3%B1ola_-_Mushuc_Runa_20190320_01.jpg",
  "849d52e4a49293b1": "https://upload.wikimedia.org/wikipedia/commons/e/e2/Aaron_Hickey_02082025_%281%29.jpg",
  "0c4c86497e5cfd12": "https://upload.wikimedia.org/wikipedia/commons/b/bf/De_Lucia.jpg",
  "a2db0ac25ac822a7": "https://upload.wikimedia.org/wikipedia/commons/4/49/Tete_Morente_2025.jpg",
  "875914ed4706afab": "https://upload.wikimedia.org/wikipedia/commons/3/36/Saba_Goglichidze_03042026_%282%29.jpg",
  "3e6cfc45c5d7b80f": "https://upload.wikimedia.org/wikipedia/commons/4/42/Alex_Rodrigo_Dias_da_Costa.jpg",
  "add92ea5ebc1ce7d": "https://upload.wikimedia.org/wikipedia/commons/a/a1/Rey_Manaj.jpg",
  "ff0531c261db70ea": "https://upload.wikimedia.org/wikipedia/commons/7/77/Lens_-_Dijon_%2815-08-2020%29_28_%28cropped%29.jpg",
  "050eb28d374ce90c": "https://upload.wikimedia.org/wikipedia/commons/c/c4/Karel_Poborsk%C3%BD_%282012%29.jpg",
  "571b4219eb815aba": "https://upload.wikimedia.org/wikipedia/commons/c/c7/Paolo_Orlandoni_-_Inter_Mailand_%282%29.jpg",
  "b52fd36357a3eccf": "https://upload.wikimedia.org/wikipedia/commons/0/05/Giulio-Donati.jpg",
  "ba2398f85380e0aa": "https://upload.wikimedia.org/wikipedia/commons/7/72/Vladimir_Koman.jpg",
  "10901d47a25249c3": "https://upload.wikimedia.org/wikipedia/commons/e/e5/Raffaele_maiello_frosinone.jpg",
  "e5cda9306a050983": "https://upload.wikimedia.org/wikipedia/commons/0/0f/Mikkel_Damsgaard_29112025_%282%29_%28cropped%29.jpg",
  "7e1e25ab19ebcecc": "https://upload.wikimedia.org/wikipedia/commons/b/b5/Vratislav_Gresko.jpg",
  "9eaa5b76ab2f575a": "https://upload.wikimedia.org/wikipedia/commons/6/6a/Keita_August_2008_Joan_Gamper_Trophy.jpg",
  "606ffffd363a31cd": "https://upload.wikimedia.org/wikipedia/commons/f/ff/Hamza_Rafia_%28cropped%29.jpg",
  "5c7e01d6d305a9bd": "https://upload.wikimedia.org/wikipedia/commons/4/4e/FC_Red_Bull_Salzburg_gegen_SKN_St._P%C3%B6lten_%2826._Mai_2019%29_25.jpg",
  "1fff2f16db57a464": "https://upload.wikimedia.org/wikipedia/commons/4/45/Fantini.jpg",
  "2213671d51b97439": "https://upload.wikimedia.org/wikipedia/it/2/2a/Vasari_1997.jpg",
  "bd7a117116f9ab9a": "https://upload.wikimedia.org/wikipedia/commons/b/b0/Dionisi_frosinone.jpg",
  "181f24fb46f07655": "https://upload.wikimedia.org/wikipedia/commons/c/c5/David_Sesa.jpg",
  "66f81056864b3766": "https://upload.wikimedia.org/wikipedia/commons/c/c6/RiccardoCazzola.JPG",
  "15481eb576d64dcf": "https://upload.wikimedia.org/wikipedia/commons/0/00/Gelson_Fernandes.JPG",
  "f766009212163bb3": "https://upload.wikimedia.org/wikipedia/commons/6/61/Vittorio_Parigini_%28cropped%29.jpg",
  "f1226411b2c7ce96": "https://upload.wikimedia.org/wikipedia/commons/a/a0/Lens_-_Torino_FC_%2802-08-2023%29_21.jpg",
  "a1ea02404ebabbb5": "https://upload.wikimedia.org/wikipedia/commons/d/d6/Federico_Fern%C3%A1ndez.jpg",
  "324d7efd13ea47de": "https://upload.wikimedia.org/wikipedia/commons/f/fd/Dominique_Malonga.jpg",
  "7df9e3f0d7e82fd7": "https://upload.wikimedia.org/wikipedia/commons/2/2f/Kewullay_Conteh_01.jpg",
  "ad3a46593fa4cd2c": "https://upload.wikimedia.org/wikipedia/commons/e/e3/Federico_Giampaolo_Avezzano_Calcio_%28cropped%29.jpg",
  "e2fc5618bc3d6add": "https://upload.wikimedia.org/wikipedia/commons/b/bf/Ashley_Young_2018-06-13_1.jpg",
  "d49fb6e960bc464c": "https://upload.wikimedia.org/wikipedia/commons/f/f2/Matteo_Scozzarella_%28cropped%29.jpg",
  "24945b656b38cb1e": "https://upload.wikimedia.org/wikipedia/commons/8/83/Squizzi_lorenzo.JPG",
  "a7c7286884bb8dea": "https://upload.wikimedia.org/wikipedia/commons/9/9e/Hakan.jpg",
  "131cbded1a142823": "https://upload.wikimedia.org/wikipedia/commons/4/4d/Frosinone_Calcio_-_Benito_Stirpe_-_vs_Ascoli_10_4_2023_-_Lucioni_5_AFF_0126frosinone_ascolifrosinone_ascoli.jpg",
  "add520597fab340c": "https://upload.wikimedia.org/wikipedia/commons/4/45/Jeff_Chabot_%282018%29.jpg",
  "7ad0905efabbc19b": "https://upload.wikimedia.org/wikipedia/commons/2/25/Paponi.png",
  "6a9b25835a681ff6": "https://upload.wikimedia.org/wikipedia/commons/b/b5/Mat%C3%ADas_Vi%C3%B1a.jpg",
  "f92521537d625573": "https://upload.wikimedia.org/wikipedia/commons/9/94/SWE-SWI_%288%29_%28cropped%29.jpg",
  "418a4d839efbb0a1": "https://upload.wikimedia.org/wikipedia/commons/9/93/John_Yeboah_2020.png",
  "05d101a3aae2254d": "https://upload.wikimedia.org/wikipedia/commons/c/c3/Ivan_Strini%C4%87_2018.jpg",
  "92bf94b3ecfd4373": "https://upload.wikimedia.org/wikipedia/commons/d/d5/Filippo_Melegoni_2018.jpg",
  "b34613b1b55957c6": "https://upload.wikimedia.org/wikipedia/commons/8/83/Aleksandar_Tonev.JPG",
  "c9233715b19797e9": "https://upload.wikimedia.org/wikipedia/commons/d/df/Ukro-Maki_%2819%29.jpg",
  "584ca0b084bd9cb4": "https://upload.wikimedia.org/wikipedia/commons/f/f4/FC_Salzburg_gegen_SSC_Napoli_%28Championsleague_3._Runde_23._Oktober_2019%29_38.jpg",
  "6411b68a35614129": "https://upload.wikimedia.org/wikipedia/commons/4/4d/Chelsea_vs._Arsenal%2C_29_May_2019_28_%28cropped%29.jpg",
  "a9d4aaeaefd210d5": "https://upload.wikimedia.org/wikipedia/commons/e/e2/2024_Emirates_Cup_-_Riccardo_Calafiori_%282%29_%28cropped%29.jpg",
  "2245eecea9fb100d": "https://upload.wikimedia.org/wikipedia/commons/7/7f/CSKA-AEK_%283%29.jpg",
  "c5574d38ebd17415": "https://upload.wikimedia.org/wikipedia/it/7/7f/Pietro_Strada_-_Parma_AC_1996-97.jpg",
  "2dec1946211acdfd": "https://upload.wikimedia.org/wikipedia/commons/2/22/FC_RB_Salzburg_gegen_FK_Austria_Wien_%282022-04-24%29_68.jpg",
  "2b1e628f27f2f2a4": "https://upload.wikimedia.org/wikipedia/commons/1/1a/20140904_-_Christian_Eriksen_%28cropped%29.jpg",
  "e713cddd4c83f0a1": "https://upload.wikimedia.org/wikipedia/commons/6/61/Samuel_Iling-Junior_12042025_%282%29.jpg",
  "c5fcac8b7d3f2dc6": "https://upload.wikimedia.org/wikipedia/commons/2/2a/Eugenio_Lamanna%2C_Bari_%282013%29.jpg",
  "e3a05d3939f85017": "https://upload.wikimedia.org/wikipedia/commons/7/7f/Marino_Defendi.jpg",
  "3e7cd8db529f532c": "https://upload.wikimedia.org/wikipedia/commons/9/9f/Arsenal_Tula_-_Lokomotiv_%281%29.jpg",
  "30291aeec26e6703": "https://upload.wikimedia.org/wikipedia/commons/3/3a/Lazio-Dnepr_%282%29_-_%D0%BA%D0%BE%D0%BF%D0%B8%D1%8F.jpg",
  "18222cee7bfb1057": "https://upload.wikimedia.org/wikipedia/it/7/74/Paul_Gascoigne_-_Inghilterra_-_Mondiali_1990.jpg",
  "8f05adae23afab35": "https://upload.wikimedia.org/wikipedia/commons/1/19/FC_Red_Bull_Salzburg_gegen_WSG_Tirol_%282023-08-06%29_19.jpg",
  "e826f4398cb57531": "https://upload.wikimedia.org/wikipedia/commons/9/90/Alberto_Moreno_%28cropped%29.jpg",
  "06d01a831f1faadc": "https://upload.wikimedia.org/wikipedia/commons/e/e5/Tiago_Mendes_-_01.jpg",
  "e6194735c8eb461e": "https://upload.wikimedia.org/wikipedia/commons/0/05/RC_Lens_-_Calcio_Padova_%2811-10-2018%29_7.jpg",
  "3a98e10579db1f25": "https://upload.wikimedia.org/wikipedia/commons/0/00/Bruno-Petkovic.png",
  "d1ae0209a457e860": "https://upload.wikimedia.org/wikipedia/commons/9/9a/Martin_Hongla.jpg",
  "7a0d4fe020065745": "https://upload.wikimedia.org/wikipedia/commons/3/35/Predrag_Mijatovi%C4%87_2007_b.jpg",
  "761ad89087fc9ced": "https://upload.wikimedia.org/wikipedia/commons/a/a8/Jos%C3%A9_Ernesto_Sosa_24_October_2021.png",
  "19e6694c0096f72e": "https://upload.wikimedia.org/wikipedia/commons/1/1e/Samuel_Souprayen.jpg",
  "b106b1e65facb02b": "https://upload.wikimedia.org/wikipedia/commons/c/cc/Emil_Krafth_%28cropped%29.jpg",
  "eb4c14494b4d10da": "https://upload.wikimedia.org/wikipedia/commons/f/f1/Danimo_soddimo_frosinone.jpg",
  "218d1ad01a57f2eb": "https://upload.wikimedia.org/wikipedia/commons/3/3e/Watford_v_Birmingham_%284%29.jpg",
  "53f3d3458bf2ce27": "https://upload.wikimedia.org/wikipedia/commons/5/52/Fernando_Forestieri.jpg",
  "511a4d9fe2c0412c": "https://upload.wikimedia.org/wikipedia/it/3/39/Salvatore_Miceli_-_SSC_Napoli_1999-2000.jpg",
  "c7e187ba3d66fcd3": "https://upload.wikimedia.org/wikipedia/commons/2/2f/Mex-Kor_%281%29_%28cropped%29.jpg",
  "60e169c762ee8da5": "https://upload.wikimedia.org/wikipedia/it/3/32/Cristian_Stellini_-_Ternana_Calcio_1998-99.jpg",
  "ad02d86791f76b72": "https://upload.wikimedia.org/wikipedia/commons/2/2c/Lucas_boye_celtic_aek.jpg",
  "db406a6389f01993": "https://upload.wikimedia.org/wikipedia/it/e/ed/Ottavio_Palladini.jpg",
  "eea20548e850b308": "https://upload.wikimedia.org/wikipedia/commons/a/a9/Abbagnato_pech.jpg",
  "f785c1ebe95025ed": "https://upload.wikimedia.org/wikipedia/it/2/2d/Marco_Roccati_-_AC_Perugia_1998-99.jpg",
  "e44695a9758274a2": "https://upload.wikimedia.org/wikipedia/commons/7/73/CSKA_Sporting_%288%29.jpg",
  "c75eb70e42d1ce0e": "https://upload.wikimedia.org/wikipedia/commons/a/a5/SwitzerlandU21_04_Arlind_Ajeti_130606_Sve-Sch_3-2_183733_6601.jpg",
  "d57278e7935e252b": "https://upload.wikimedia.org/wikipedia/commons/c/c2/Anthony_MOUNIER_1.JPG",
  "2d023f003ea876e9": "https://upload.wikimedia.org/wikipedia/commons/6/61/20160604_AUT_NED_8884_%28cropped%29.jpg",
  "5c7797eb574ba0f9": "https://upload.wikimedia.org/wikipedia/commons/4/4f/MilosKrasic.jpg",
  "918f31ab47db4648": "https://upload.wikimedia.org/wikipedia/commons/d/dc/20150331_Mali_vs_Ghana_216.jpg",
  "65e4b63f4e94d76d": "https://upload.wikimedia.org/wikipedia/commons/d/dd/Giann%C4%ABs_Fetfatzid%C4%ABs.jpg",
  "41a5538937548fc0": "https://upload.wikimedia.org/wikipedia/it/7/71/Joseph_Dayo_Oshadogan_-_Reggina_Calcio_2000-01.jpg",
  "d429c3a006d879e3": "https://upload.wikimedia.org/wikipedia/commons/4/4b/Jonathan_dos_Santos.jpg",
  "3cc9a27cb9e6bd25": "https://upload.wikimedia.org/wikipedia/it/1/11/Ballarin%2C_Novellino_-_AC_Venezia_1997-98.jpg",
  "a48968dce886722e": "https://upload.wikimedia.org/wikipedia/commons/e/ec/Geovanni_at_Union_at_Earthquakes_2010-09-15_1_%28cropped%29.JPG",
  "9579159a3ab436ca": "https://upload.wikimedia.org/wikipedia/commons/9/97/BudVik.JPG",
  "3edf2fd64d1017dc": "https://upload.wikimedia.org/wikipedia/commons/1/1a/Filippo_Porcari.png",
  "68a783179dcdee0e": "https://upload.wikimedia.org/wikipedia/commons/8/8c/Christian_Ziege.jpg",
  "86383850ce313ab0": "https://upload.wikimedia.org/wikipedia/commons/b/b5/Lobont_12_agosto_2014.jpg",
  "a97542bffc0db571": "https://upload.wikimedia.org/wikipedia/commons/2/2c/Maicosuel_7.jpg",
  "3ad9df16222bee68": "https://upload.wikimedia.org/wikipedia/commons/1/11/Yebda2.jpg",
  "5ecfeda3fb359c12": "https://upload.wikimedia.org/wikipedia/commons/7/71/Asamoah_Gyan_%282014%29.jpg",
  "5ffe0878d7ddb475": "https://upload.wikimedia.org/wikipedia/commons/d/df/Hidde_Ter_Avest_Udinese.png",
  "94ab62434b62776c": "https://upload.wikimedia.org/wikipedia/commons/1/17/Adil_Rami_World_Cup_Trophy.jpg",
  "bb45c9711284782f": "https://upload.wikimedia.org/wikipedia/commons/4/42/Ebrima_Colley_%28cropped%29.jpg",
  "933f0336fb792730": "https://upload.wikimedia.org/wikipedia/commons/2/2a/Gianvito_Plasmati.JPG",
  "cc23066643501da2": "https://upload.wikimedia.org/wikipedia/commons/b/b3/Santiago_Solari_%28cropped%29.jpg",
  "0aa34d46c9fe7745": "https://upload.wikimedia.org/wikipedia/commons/e/ef/Dimas_Teixeira.jpg",
  "db7b5f3094b792a4": "https://upload.wikimedia.org/wikipedia/commons/3/3f/FabioDaprel%C3%A0.JPG",
  "d1b26b7995b632bb": "https://upload.wikimedia.org/wikipedia/commons/8/86/2010_Mark_van_Bommel.jpg_%28cropped%29.jpg",
  "7d8723986dce0f58": "https://upload.wikimedia.org/wikipedia/commons/e/e6/Lens_-_Torino_FC_%2802-08-2023%29_16.jpg",
  "2d8a9ec2c46e615c": "https://upload.wikimedia.org/wikipedia/commons/2/23/Alessandro_frare_frosinone_calcio.jpg",
  "b37c45a76ce16449": "https://upload.wikimedia.org/wikipedia/commons/7/75/Filippo_Costa.jpg",
  "cb9bf27a0b1b0ee7": "https://upload.wikimedia.org/wikipedia/commons/b/bd/Samuel-Kuffour.jpg",
  "05a74de89da48a2a": "https://upload.wikimedia.org/wikipedia/commons/0/0c/Joachim_Andersen_22122024_%283%29.jpg",
  "41ac7beca78df2de": "https://upload.wikimedia.org/wikipedia/commons/e/ed/Lens_-_Stade_Rennais_%2820-08-2023%29_16.jpg",
  "5fd83655576a2ad0": "https://upload.wikimedia.org/wikipedia/it/0/08/Cammarata2000.jpg",
  "8427b05f25488609": "https://upload.wikimedia.org/wikipedia/commons/c/c3/Only_david.jpg",
  "ef701710f8367a67": "https://upload.wikimedia.org/wikipedia/commons/c/c7/Real_Sociedad_-_Red_Bull_Salzburgo_62_%2826433581918%29_%28cropped%29.jpg",
  "63741df63dd02bcd": "https://upload.wikimedia.org/wikipedia/it/1/15/Grigoris_Georgatos_-_FC_Inter_1999-2000.jpg",
  "6e6cd4297d163e7f": "https://upload.wikimedia.org/wikipedia/commons/4/44/Mirko_gori_frosinone.jpg",
  "3d9ccc4cc1b4cf33": "https://upload.wikimedia.org/wikipedia/commons/f/f1/Simone_Edera_2019.jpg",
  "71fecb23a264a609": "https://upload.wikimedia.org/wikipedia/commons/5/57/GonzaloMartinez20080719_004.JPG",
  "5aca3da1f3f3eba1": "https://upload.wikimedia.org/wikipedia/commons/3/39/FC_Red_Bull_Salzburg_gegen_%C3%87aykur_Rizespor_%28Muriqi%29_05.jpg",
  "f438bcf955ddcd27": "https://upload.wikimedia.org/wikipedia/commons/2/2f/2022-08-21_European_Championships_2022_%E2%80%93_Men%27s_10%2C000_Metres_by_Sandro_Halank%E2%80%93019.jpg",
  "c4a9124a54cf1836": "https://upload.wikimedia.org/wikipedia/it/d/db/Marco_Negri_-_AC_Perugia_1996-97.jpg",
  "362e98959d89daff": "https://upload.wikimedia.org/wikipedia/commons/1/17/Audi-_quattro-Cup_02.JPG",
  "9fea36cf8012c5de": "https://upload.wikimedia.org/wikipedia/commons/d/dc/Lucas_Paquet%C3%A1_of_West_Ham.jpeg",
  "2f07fe46447291ee": "https://upload.wikimedia.org/wikipedia/commons/7/78/SPROCATI.jpg",
  "265be96e6abac91b": "https://upload.wikimedia.org/wikipedia/commons/1/17/Ciro_Polito.JPG",
  "973c8abb8c0bb44f": "https://upload.wikimedia.org/wikipedia/it/1/1a/Sunday_Oliseh_-_Juventus_FC_1999-2000.jpg",
  "0d078f19101d6a00": "https://upload.wikimedia.org/wikipedia/commons/e/e7/Olivier_Ntcham_%28cropped%29.jpg",
  "292b5e006d0e6622": "https://upload.wikimedia.org/wikipedia/commons/3/38/Jose_Machin%2C_2020_%28cropped%29.png",
  "21b53941ee55d36a": "https://upload.wikimedia.org/wikipedia/commons/2/2d/Eduardo_Quaresma_2021.png",
  "f5a0ad3a3884dfe3": "https://upload.wikimedia.org/wikipedia/commons/b/b9/2023-08-12_TSV_Schott_Mainz_gegen_Borussia_Dortmund_%28DFB-Pokal_2023-24%29_by_Sandro_Halank%E2%80%93148_%28cropped%29.jpg",
  "a20b7c45d235bd1b": "https://upload.wikimedia.org/wikipedia/commons/d/da/RC_Lens_-_Calcio_Padova_%2811-10-2018%29_50.jpg",
  "17fe2db7b9735084": "https://upload.wikimedia.org/wikipedia/it/b/b8/Jason_May%C3%A9l%C3%A9_-_Cagliari_Calcio_1999-2000.jpg",
  "00d8ca0abee7e490": "https://upload.wikimedia.org/wikipedia/commons/f/f1/Achraf_Hakimi_vs_Niger%2C_5_Sept_2025.jpg",
  "8204aa717c086251": "https://upload.wikimedia.org/wikipedia/commons/b/ba/Schalke04_07_079-2_ausschnitt.jpg",
  "e36e219aeb1677b2": "https://upload.wikimedia.org/wikipedia/commons/7/75/Vlada_Avramov.jpg",
  "e94b5c3fe462d85a": "https://upload.wikimedia.org/wikipedia/commons/b/be/Carsten_Jancker_-_SV_Mattersburg_%28Bild2%29.jpg",
  "3d32878e02514484": "https://upload.wikimedia.org/wikipedia/it/8/86/Ljubi%C5%A1a_Dun%C4%91erski_-_Atalanta_BC_2000-01.jpg",
  "199235a18c9b4f25": "https://upload.wikimedia.org/wikipedia/commons/2/20/Ignacio_Piatti_%2819006413039%29.jpg",
  "196cdba42b96d6e8": "https://upload.wikimedia.org/wikipedia/commons/4/40/Rolando_2011-02-09_POR_vs_ARG.jpg",
  "6b62c4cc843d5dec": "https://upload.wikimedia.org/wikipedia/it/0/00/Martino_Traversa_-_AC_Perugia_1996-97.jpg",
  "fffb31dc6db3ddfe": "https://upload.wikimedia.org/wikipedia/commons/4/41/Joe_Hart_69775.jpg",
  "cdbb815984c38308": "https://upload.wikimedia.org/wikipedia/commons/a/a8/Yoann_Gourcuff_2015.jpg",
  "4d72f6b746c689c6": "https://upload.wikimedia.org/wikipedia/commons/7/71/MortenBisgaard08.jpg",
  "cf2769325bfffd69": "https://upload.wikimedia.org/wikipedia/commons/8/8c/Carlos_Carbonero_2014.jpg",
  "fe9cb6af41f554f5": "https://upload.wikimedia.org/wikipedia/commons/c/c6/Ola_Solbakken_%28cropped%29.jpg",
  "0dfc1e647c54554e": "https://upload.wikimedia.org/wikipedia/it/c/c2/Mirko_Cudini_-_Torino_Calcio_1999-2000.jpg",
  "d03df2485f81d449": "https://upload.wikimedia.org/wikipedia/commons/5/50/Jo%C3%A3o_Ferreira_2020.png",
  "c9ec755294a6b49f": "https://upload.wikimedia.org/wikipedia/commons/7/7f/Kasper_Hjulmand_2013_Norsh-Zen.jpg",
  "08bf8d0f4dd052d4": "https://upload.wikimedia.org/wikipedia/commons/8/8e/Poland_vs_Colombia_2018_World_Cup_33_%28cropped%29.jpg",
  "80e11f688430223a": "https://upload.wikimedia.org/wikipedia/commons/f/fb/Fernando_Francisco_Reges_%2814885160941%29.jpg",
  "652151732c41654e": "https://upload.wikimedia.org/wikipedia/commons/c/c0/G._De_Luca.png",
  "ce82f78a66a0e946": "https://upload.wikimedia.org/wikipedia/commons/c/cf/A-Eremenko-2.jpg",
  "bd5d33ab9a30d552": "https://upload.wikimedia.org/wikipedia/commons/2/26/Rafael_M%C3%A1rquez_2014.jpg",
  "c1715f4c2c4acc1d": "https://upload.wikimedia.org/wikipedia/commons/a/a5/Botheim_01.jpg",
  "fc8ca04903f10677": "https://upload.wikimedia.org/wikipedia/commons/8/80/FC_Red_Bull_Salzburg_gegen_Bayern_M%C3%BCnchen_%282025-01-06_Testspiel%29_26.jpg",
  "87e5114e2ff082fe": "https://upload.wikimedia.org/wikipedia/commons/d/d2/2019-07-12_Fu%C3%9Fball%3B_Freundschaftsspiel_RB_Leipzig_-_FC_Z%C3%BCrich_1DX_0964_by_Stepro.jpg",
  "b4cfaac6b1d65fd1": "https://upload.wikimedia.org/wikipedia/commons/5/5a/Serge_Gakp%C3%A9_2016.jpg",
  "9bc64e93a0837c48": "https://upload.wikimedia.org/wikipedia/it/2/2b/Alessandro_Cucciari_-_Ternana_Calcio_1998-99.jpg",
  "8ffaf7aacb30fefd": "https://upload.wikimedia.org/wikipedia/commons/e/e6/David_Zima_CZE-KUW_2021-11-11_%28cropped%29.jpg",
  "55068087e1d89f9e": "https://upload.wikimedia.org/wikipedia/commons/f/f7/Gent-Zenit_%2816%29.jpg",
  "319f86d993be7ee3": "https://upload.wikimedia.org/wikipedia/commons/3/32/Beghetto_al_Treviso_2005.jpg",
  "b68c018a76a8aa7f": "https://upload.wikimedia.org/wikipedia/commons/0/0a/Ederson.png",
  "66d882bbd2acf1f2": "https://upload.wikimedia.org/wikipedia/commons/5/57/Naples_vs_Barcelone_-_Gen%C3%A8ve_-_aout_2014_-_Rafael_Cabral.jpg",
  "867138cbf034f6ef": "https://upload.wikimedia.org/wikipedia/commons/b/b7/Pablo_Galdames.jpg",
  "d9a37ce0cd95411f": "https://upload.wikimedia.org/wikipedia/commons/c/c2/RC_Lens_-_FC_Nantes_%2828-10-2023%29_13_%28cropped%29.jpg",
  "83399b70f4430856": "https://upload.wikimedia.org/wikipedia/commons/2/2b/Cagliari2425_%28Mattia_Felici%29.png",
  "e9f84cecd03435be": "https://upload.wikimedia.org/wikipedia/commons/1/18/Lucas_Digne_Everton.jpg",
  "8ba8e9697b1e9443": "https://upload.wikimedia.org/wikipedia/commons/1/14/Tiziano_Polenghi.png",
  "3bc51c3c7f718d7f": "https://upload.wikimedia.org/wikipedia/commons/f/f5/RC_Lens_-_Grenoble_Foot_38_%2810-02-2020%29_60.jpg",
  "ebf30dc746a81809": "https://upload.wikimedia.org/wikipedia/commons/9/9c/Photo_5985650300301722426_y.jpg",
  "98c116c42ed9aa04": "https://upload.wikimedia.org/wikipedia/commons/2/29/U06_%C3%81lvaro_Pereira_3372.jpg",
  "a7b80c261505c43a": "https://upload.wikimedia.org/wikipedia/commons/c/cf/Oscar_Brevi%2C_2007_%28cropped%29.jpg",
  "ed9122e9f77a3a11": "https://upload.wikimedia.org/wikipedia/commons/0/0d/Bruno-henrique-palmeiras-out2019.png",
  "6e272cdbe6908fe1": "https://upload.wikimedia.org/wikipedia/it/8/84/Antonino_Asta_-_Torino_Calcio_1999-2000.jpg",
  "3f1e31cf13f0b394": "https://upload.wikimedia.org/wikipedia/commons/8/81/Sergei-gurenko.jpg",
  "4a8e25bdabf119b2": "https://upload.wikimedia.org/wikipedia/commons/c/c2/Luiz_Adriano_at_Be%C5%9Fikta%C5%9F_vs_Antalyaspor_20220206.jpg",
  "c890a33bf12a502a": "https://upload.wikimedia.org/wikipedia/commons/e/e0/Anthony_Vanden_Borre.jpg",
  "2a9d0256dc0df682": "https://upload.wikimedia.org/wikipedia/commons/6/6d/Frosinone_Calcio_-_Camillo_Ciano_FRO_1443_AF_%28cropped%29.jpg",
  "28e76fc6b5e0dbb8": "https://upload.wikimedia.org/wikipedia/commons/7/7c/F_YWwXCXsAAs_Ei.jpg",
  "0bef20e064f67002": "https://upload.wikimedia.org/wikipedia/commons/2/29/Victor_Kristiansen_24082024_%283%29_%28cropped%29.jpg",
  "8edc7c5fb7d1b71d": "https://upload.wikimedia.org/wikipedia/commons/d/d2/Frosinone_Calcio_-_Luca_Garritano_FRO_0917_cut_AF.jpg",
  "0645926181ba3518": "https://upload.wikimedia.org/wikipedia/commons/2/2c/Nelson_Rivas_-_Inter_Mailand_%281%29.jpg",
  "b5b8a7ec262527c2": "https://upload.wikimedia.org/wikipedia/commons/6/63/Andy_Van_Der_Meyde.jpg",
  "6add3a1cb57fa02b": "https://upload.wikimedia.org/wikipedia/commons/5/56/Ludovic_GIULY_-_AS_Monaco_%28cropped%29.jpg",
  "39d61481da68b8a1": "https://upload.wikimedia.org/wikipedia/commons/3/37/20140904_-_Lasse_Sch%C3%B6ne_%28cropped%29_2.jpg",
  "43ffd54fb7e934e4": "https://upload.wikimedia.org/wikipedia/it/a/a0/Giancarlo_Filippini_-_AC_Venezia_1992-93.jpg",
  "55289b80865392b4": "https://upload.wikimedia.org/wikipedia/commons/c/cd/Andrey_Galabinov.jpg",
  "6a49b9bf3f4764ba": "https://upload.wikimedia.org/wikipedia/commons/3/3b/UEFA_EURO_qualifiers_Sweden_vs_Spain_20191015_52_%28Ken_Sema%29.jpg",
  "8de9813bb2805acd": "https://upload.wikimedia.org/wikipedia/commons/5/52/1712914641852_20190605_ZAGORAKIS_Theodoros_EL_4.jpg",
  "9ce0f673eaa9a10f": "https://upload.wikimedia.org/wikipedia/it/3/3f/Hil%C3%A1rio_Leal_-_AC_Perugia_2000-01.jpg",
  "dc4145e8817872e7": "https://upload.wikimedia.org/wikipedia/commons/c/c0/Samuele_Vignato%2C_Brescia_v_Monza_2021_01_%28cropped%29.jpg",
  "94f572d7af897bbd": "https://upload.wikimedia.org/wikipedia/commons/3/36/Frosinone_Calcio_-_Daniel_Boloca_ANF_9026.A_cut_AF.jpg",
  "beca42b03a3e13bf": "https://upload.wikimedia.org/wikipedia/commons/8/8a/Tom%C3%A1%C5%A1_Z%C3%A1poto%C4%8Dn%C3%BD.jpg",
  "6a7bdeb9deabfcdd": "https://upload.wikimedia.org/wikipedia/commons/4/45/20180505_AUSADM_8617.jpg",
  "7d9a458550f5ced5": "https://upload.wikimedia.org/wikipedia/commons/b/bb/FC_Salzburg_vs._Club_Br%C3%BCgge_Denswil.jpg",
  "b0ed37c7176bc06c": "https://upload.wikimedia.org/wikipedia/commons/a/ad/Frosinone_Calcio_-_Federico_Ravaglia_DSC_1069_AF.jpg",
  "10a6b55ede653bbf": "https://upload.wikimedia.org/wikipedia/commons/c/ce/Savo_Milosevic_%28cropped%29.jpg",
  "2a1c91781ba41d4d": "https://upload.wikimedia.org/wikipedia/commons/6/61/Adolfo_Gaich_2022.jpg",
  "1924df1f58a924eb": "https://upload.wikimedia.org/wikipedia/commons/8/84/Ramos_Borges_Emerson.jpg",
  "4d738b9e91f408a9": "https://upload.wikimedia.org/wikipedia/commons/5/5e/Lucafusco.png",
  "47ef2a631748b166": "https://upload.wikimedia.org/wikipedia/commons/b/b3/Kamil_Vacek.jpg",
  "e8fa9b4d507c4fe3": "https://upload.wikimedia.org/wikipedia/commons/9/9f/Pam%C3%A1tn%C3%ADk_Pavla_Srni%C4%8Dka_na_h%C5%99i%C5%A1ti_FK_Bospor_Bohum%C3%ADn_%28cropped%29.jpg",
  "566d182d3156e7a1": "https://upload.wikimedia.org/wikipedia/commons/c/c5/Paulo_Azzi_%28cropped_2%29.jpg",
  "ea078a0f4990a8ee": "https://upload.wikimedia.org/wikipedia/commons/5/53/Kubilay_T%C3%BCrky%C4%B1lmaz.jpg",
  "b527c9db1326ea94": "https://upload.wikimedia.org/wikipedia/commons/7/70/Rub%C3%A9n_Botta.jpg",
  "6ec2725c93c5a94b": "https://upload.wikimedia.org/wikipedia/commons/8/80/Nastasic_Schalke_2015.jpg",
  "44869e767bda83a7": "https://upload.wikimedia.org/wikipedia/commons/6/67/Haitam_Aleesami_2021.jpg",
  "94685e2bb518027b": "https://upload.wikimedia.org/wikipedia/commons/6/6e/Giorgio.Corona.jpg",
  "6f50f13f1e064990": "https://upload.wikimedia.org/wikipedia/commons/4/4d/Jonathan_Rossini.jpg",
  "96339a76c5aea759": "https://upload.wikimedia.org/wikipedia/commons/d/db/Andrea_La_Mantia03.jpg",
  "a8d0f83a7acbe012": "https://upload.wikimedia.org/wikipedia/it/8/88/Dario_Baccin_-_Ternana_Calcio_1998-99.jpg",
  "9a0302bd50905e4f": "https://upload.wikimedia.org/wikipedia/it/e/e4/Alex_Brunner.JPG",
  "4d919720945a0ae2": "https://upload.wikimedia.org/wikipedia/it/1/1a/Sergio_Maron.jpg",
  "f2ccb48110e31f19": "https://upload.wikimedia.org/wikipedia/it/8/8c/Ahn_Jung-hwan_-_AC_Perugia_2000-2001.jpg",
  "d0d78070d9da7f88": "https://upload.wikimedia.org/wikipedia/commons/6/6d/Daniele_Portanova.jpg",
  "eb5f0d21da8bd7d7": "https://upload.wikimedia.org/wikipedia/commons/4/40/%C5%81ukasz_Teodorczyk%2C_Mecz_towarzyski%2C_Polska_-_KPS_%28cropped%29.jpg",
  "effeb828fa8b49b7": "https://upload.wikimedia.org/wikipedia/it/0/0c/Maurizio_D%27Angelo.jpg",
  "120c4ffcc5d7e231": "https://upload.wikimedia.org/wikipedia/commons/5/53/Roberto_Carlos_2011.jpg",
  "025227d6cde20521": "https://upload.wikimedia.org/wikipedia/commons/b/bd/Steven_Nzonzi_2018.jpg",
  "38f59ba17ab8b71c": "https://upload.wikimedia.org/wikipedia/commons/1/17/Gabriel_Heinze_2022_Newell%27s.png",
  "595bd9cb15c9c1ca": "https://upload.wikimedia.org/wikipedia/commons/7/7f/GiuseppeCozzolino2019.png",
  "b54c6e94fcb4e680": "https://upload.wikimedia.org/wikipedia/commons/5/5f/12-06-05-aut-rom-freundschaftsspiel-259.jpg",
  "2f7f2528c420459b": "https://upload.wikimedia.org/wikipedia/commons/4/40/Massimiliano_Benassi_-_Lecce-Roma_4-2_-_7_aprile_2012.jpg",
  "e79d60ffee6d0f13": "https://upload.wikimedia.org/wikipedia/it/a/a6/Felice_Piccolo_-_AS_Lucchese_Libertas_2002-03.jpg",
  "198cf8f21c0c7291": "https://upload.wikimedia.org/wikipedia/commons/4/45/Paul_Okon_managing_Young_Socceroos.jpg",
  "38d292dbbea82ffb": "https://upload.wikimedia.org/wikipedia/it/d/dc/Stefan_Effenberg.jpg",
  "c62150928977295f": "https://upload.wikimedia.org/wikipedia/commons/9/9c/Tanguy_Ndombele_2024.png",
  "d927a1ab702ca028": "https://upload.wikimedia.org/wikipedia/commons/4/42/Fernando_Gago_%28Roda_de_premsa%29.jpg",
  "9ef7aabba3d6ba24": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-anfield_447b3937.jpg",
  "45fd0f3c80fcafdd": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-emirates-stadium_753a46f5.jpg",
  "8fe449d972a8252d": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-tottenham-hotspur-stadium_1fc467c1.jpg",
  "dd9f22097c07907b": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-london-stadium_9dc85037.jpg",
  "a8aca89c7a71c162": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-villa-park_063ed91b.jpg",
  "c44ced2fce12ed46": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-st-james-park_78d396bd.jpg",
  "3a6033b7aa1bf0ec": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-goodison-park_89ba0456.jpg",
  "20b6ae1109c2d624": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-st-marys-stadium_fb2eaca9.jpg",
  "018e7cbfbbfc157b": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-molineux-stadium_422e4e87.jpg",
  "033bbab08cc82883": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-falmer-stadium_9bdc8aa6.jpg",
  "1079bbf2ac0c7a30": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-selhurst-park_2e5784e0.jpg",
  "823ac73403e4e466": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-craven-cottage_1f02d871.jpg",
  "d1581f37988db69f": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-king-power-stadium_22b7c6a9.jpg",
  "11bff2cddb9de793": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-city-ground_5fb32db8.jpg",
  "1f24fe2181eaadb9": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-portman-road_a5dac6dc.jpg",
  "fa4b8e5242368a49": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-old-trafford_6f9820fe.jpg",
  "3b7065ce57fdbfe0": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-san-siro_93fc1009.jpg",
  "1fbc7527c76e3078": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-stadio-olimpico_eaee5f4a.jpg",
  "65119938f29b6f04": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-stadio-diego-armando-maradona_63268db8.jpg",
  "f8435cca3d574f4c": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-stadio-artemio-franchi_a7cbd442.jpg",
  "c43c45d58a96c54a": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-stadio-renato-dallara_180fc562.jpg",
  "0babc004ffceb7b9": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-stadio-luigi-ferraris_fc527492.jpg",
  "67698eb3d0caf7f8": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-stadio-olimpico-grande-torino_cf11f37a.jpg",
  "e71ededba6edc8a5": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-stadio-marcantonio-bentegodi_9960f03c.jpg",
  "13c894cf93271e7d": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-stadio-ennio-tardini_fce4ccd0.jpg",
  "7c4c8e7258d1dc37": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-stadio-friuli_3fa75ded.jpg",
  "4d1c383a1add6339": "https://files.manuscdn.com/user_upload_by_module/session_file/310519663236579785/LbyIYSMwlKfnTWHd.jpg",
  "49d1dba1775edd46": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-stadio-carlo-castellani_bf8742a4.jpg",
  "073a13336bc9652f": "https://files.manuscdn.com/user_upload_by_module/session_file/310519663236579785/RChsUdWGutTujjVQ.webp",
  "25ca5a85a774b8a2": "https://files.manuscdn.com/user_upload_by_module/session_file/310519663236579785/wSqkQajILIJKnRzi.jpg",
  "476dac251bd73525": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-stadio-renzo-barbera_8e6264e1.jpg",
  "a7333914b17e7991": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-santiago-bernabeu_32b6760e.jpg",
  "ec899080f6ab191e": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-camp-nou_a5652c80.jpg",
  "ffa5deadbc895854": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-rcde-stadium_ec9add42.jpg",
  "0db5a07f7f31c641": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-estadio-de-la-cermica_a49ff0df.jpg",
  "6afc833f1fba017c": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-estadi-mallorca-son-moix_9c352ab4.jpg",
  "b72d0410f851baab": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-jose-zorrilla_a4295fe2.jpg",
  "a4961cb47bcc17f7": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-butarque_1d40914c.webp",
  "b62b7925207f8387": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-allianz-arena_be54f164.jpg",
  "fc3d096d54d212d9": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-mhparena_0c06edab.jpg",
  "aaa9f895e42f779d": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-volksparkstadion_ebe05478.jpg",
  "14a339165ba2e2a0": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-borussia-park_32ab3d8c.jpg",
  "fabdf336b7dee776": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-merkur-spiel-arena_331ed123.jpg",
  "aaf5e4804266ac4c": "https://files.manuscdn.com/user_upload_by_module/session_file/310519663236579785/dycSCNmOChuDskCm.jpg",
  "d90ebce9fb2ee053": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-weserstadion_8fa3bbc4.jpg",
  "16830baa052760a2": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-europa-park-stadion_db5aef30.jpg",
  "acb976041c9a086d": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-mewa-arena_9c42caa3.jpg",
  "7a2278fd087292ed": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-bayarena_fdc743c3.jpg",
  "93cc2b610a5fd7ab": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-volkswagen-arena_30874dd2.jpg",
  "cd81719d31e1e326": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-stadion-an-der-alten-frsterei_dd77dd63.jpg",
  "06b18414c12f8dca": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-parc-olympique-lyonnais_d42980e1.jpg",
  "e1cb7cff4e430f66": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-stade-pierre-mauroy_d6fff59c.jpg",
  "3362de27b2737a54": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-parc-des-princes_b9619ac6.jpg",
  "acd21f2a4ef23b7d": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-stade-geoffroy-guichard_a764a0ff.jpg",
  "ce6c2d015744f3be": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-stade-bollaert-delelis_5daaef06.jpg",
  "cb6806013a398707": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-stade-de-la-beaujoire_212f32ee.jpg",
  "74434a35b26b2f7b": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-allianz-riviera_a0670bf3.jpg",
  "1d4fda65d053a9a4": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-stade-de-la-mosson_ece7da68.jpg",
  "0b1d22a4c2dad1d1": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-roazhon-park_ce6e7ba7.jpg",
  "8743584d66a9230b": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-stade-de-la-meinau_f1d32fa1.jpg",
  "4e2e9fc9a6677a2f": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-stade-auguste-delaune_2ee58e87.jpg",
  "7e5fa50c6ef89db2": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-stade-louis-ii_5880dcce.jpg",
  "fb946798c1d93f44": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-stade-ocane_4a267bcc.jpg",
  "da61b941df99da31": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-stade-raymond-kopa_d0dae414.jpg",
  "a77c72f58a56e4b3": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-stade-francis-le-bl_3a6f1d92.jpg",
  "0cde913d22a9e326": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-stade-de-labb-deschamps_664d1339.jpg",
  "e6adc8a780b5a0fd": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-la-bombonera_384e28d3.jpg",
  "c7fb78d0e396c964": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-estadio-azteca_ccd9e1ed.jpg",
  "34940cefc6b001f4": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-estadio-centenario_4edad47f.jpg",
  "fa2ef9571535e541": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-estdio-da-luz_be0ededa.jpg",
  "0dd6b4154bc9c64c": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-estdio-do-drago_3e7038b0.jpg",
  "68edf76eb7ff92ed": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-estdio-jos-alvalade_dee16628.jpg",
  "93b74de899e228fb": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-celtic-park_4114fb66.jpg",
  "3fe157da270237c0": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-ibrox-stadium_78d65145.jpg",
  "f9b4a29be0bb432f": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-johan-cruyff-arena_39c9ec72.jpg",
  "38cf9a59e72fff54": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-de-kuip_ec1946f5.jpg",
  "71608ac34aa20906": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-philips-stadion_374f5d37.jpg",
  "fff474936bfb9e40": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-sukru-saracoglu_327adcd5.jpg",
  "f456e11d5d01027e": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-beikta-park_35a72fa3.jpg",
  "e9712f7a4e994870": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-karaiskakis-stadium_7884d872.jpg",
  "523824406b928b17": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-fnb-stadium_9cdc97c6.jpg",
  "e014f8390889b309": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-cairo-international-stadium_f99b6ae0.jpg",
  "e315466698d5213e": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-saitama-stadium-2002_e5b3b94d.jpg",
  "da6d09e276a5bab6": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-mercedes-benz-stadium_842efcd3.jpg",
  "fdc8bac46bff5b3f": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-luzhniki-stadium_a2c42b0e.jpg",
  "ec9a77d512842bc3": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-gasprom-arena_1a6470dc.jpg",
  "47054bb703b9938a": "https://d2xsxph8kpxj0f.cloudfront.net/310519663236579785/HKJjpicXDVEpHh2tJJ84LZ/stadio-estdio-do-morumbi_6ed1c617.jpg",
  "0eb229c5bed3a8b1": "/stadi/allianz-stadium.jpg",
  "05eafd4d7048365f": "/stadi/gewiss-stadium.jpg",
  "92e12b3da2700e8b": "/stadi/stadio-via-del-mare.jpg",
  "8c5d20fb25e7ca89": "/stadi/mapei-stadium.jpg",
  "5b0dc2e8ed396f36": "/stadi/u-power-stadium.jpg",
  "ff33d3d0a322e93e": "/stadi/stamford-bridge.jpg",
  "1e3943cb12e4ea6b": "/stadi/etihad-stadium.jpg",
  "bdf9642f93c5d4ea": "/stadi/gtech-community-stadium.jpg",
  "718ef8ac205c42d5": "/stadi/vitality-stadium.jpg",
  "ebfabc30e723ffa6": "/stadi/civitas-metropolitano.jpg",
  "13292776908927c2": "/stadi/benito-villamarin.jpg",
  "6ff89bc6cda01552": "/stadi/san-mames.jpg",
  "cebafb06645bb007": "/stadi/estadio-mestalla.jpg",
  "53286172c43a8b09": "/stadi/ramon-sanchez-pizjuan.jpg",
  "a718bdb842aa8fea": "/stadi/reale-arena.jpg",
  "28c3572e25f9c456": "/stadi/balaidos.jpg",
  "1fa07f7ea0110d1c": "/stadi/el-sadar.jpg",
  "e6feb5ab3710ed41": "/stadi/coliseum-getafe.jpg",
  "fe92ff93428ab9de": "/stadi/estadio-de-vallecas.jpg",
  "834972767d52672a": "/stadi/estadi-montilivi.jpg",
  "ae0fd2d5018c2d06": "/stadi/mendizorrotza.jpg",
  "710e7523bb55c339": "/stadi/estadio-gran-canaria.jpg",
  "05556a9df149ac62": "/stadi/signal-iduna-park.jpg",
  "b53e346f158fe3a8": "/stadi/olympiastadion-berlin.jpg",
  "a8707e2a5cda8dfa": "/stadi/veltins-arena.jpg",
  "66c7d328d711401a": "/stadi/deutsche-bank-park.jpg",
  "6bf325baa612be6a": "/stadi/red-bull-arena-leipzig.jpg",
  "0f07c2de83f6efaf": "/stadi/wwk-arena.jpg",
  "db24d36a88420d68": "/stadi/prezero-arena.jpg",
  "dbafbdc664f9d846": "/stadi/millerntor-stadion.jpg",
  "65e0b220288903a2": "/stadi/stade-velodrome.jpg",
  "bcb7e4f3089eb160": "/stadi/stadium-de-toulouse.jpg",
  "dc7909fffe87eaf5": "/stadi/matmut-atlantique.jpg",
  "471d8e4062c01d2c": "/stadi/stade-saint-symphorien.jpg"
};

// server/_core/imageProxy.ts
function registerImageProxyRoutes(app2) {
  app2.get("/api/img", async (req, res) => {
    try {
      const id = typeof req.query.id === "string" ? req.query.id.trim() : "";
      if (!id) {
        res.status(400).send("Missing id");
        return;
      }
      const targetUrl = IMAGE_MAP[id];
      if (!targetUrl) {
        res.status(404).send("Not found");
        return;
      }
      res.setHeader(
        "Cache-Control",
        "public, max-age=31536000, s-maxage=31536000, immutable"
      );
      res.setHeader("Content-Disposition", 'inline; filename="card.jpg"');
      res.setHeader("X-Content-Type-Options", "nosniff");
      if (targetUrl.startsWith("/")) {
        const localCandidates = [
          path.join(process.cwd(), "client", "public", targetUrl),
          path.join(process.cwd(), "dist", "public", targetUrl),
          path.join(process.cwd(), "public", targetUrl)
        ];
        for (const candidate of localCandidates) {
          if (fs.existsSync(candidate)) {
            const ext = path.extname(candidate).toLowerCase();
            const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
            res.setHeader("Content-Type", mime);
            res.send(fs.readFileSync(candidate));
            return;
          }
        }
        const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
        const host = req.get("host") || "www.kickoff-trivia.com";
        const originUrl = `${proto}://${host}${targetUrl}`;
        const upstream2 = await fetch(originUrl);
        if (!upstream2.ok) {
          res.status(upstream2.status).end();
          return;
        }
        const contentType2 = upstream2.headers.get("content-type") || "image/jpeg";
        res.setHeader("Content-Type", contentType2);
        const buf2 = Buffer.from(await upstream2.arrayBuffer());
        res.send(buf2);
        return;
      }
      const upstream = await fetch(targetUrl, {
        headers: {
          "User-Agent": "KickOffTrivia/1.0 (https://www.kickoff-trivia.com; info@kickoff-trivia.com) Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
        }
      });
      if (!upstream.ok) {
        res.status(upstream.status).end();
        return;
      }
      const contentType = upstream.headers.get("content-type") || "image/jpeg";
      res.setHeader("Content-Type", contentType);
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.send(buf);
    } catch (error) {
      console.error("[ImageProxy] Error serving image:", error);
      res.status(500).end();
    }
  });
}

// server/routers/achievements.ts
import { z } from "zod";
import { eq as eq2, and, desc, sql } from "drizzle-orm";

// server/_core/trpc.ts
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// shared/achievements.ts
var ACHIEVEMENTS = [
  // ─── FORMAZIONI ──────────────────────────────────────────────────────────
  {
    id: "overthinker",
    name: "Overthinker",
    game: "formazioni",
    icon: "\u{1F50D}",
    tiers: [
      { tier: 1, label: "Bronzo", description: "Scova tutti e 22 i giocatori in una partita di Formazioni" },
      { tier: 2, label: "Argento", description: "Scova tutti e 22 i giocatori in modalit\xE0 Sfida (max 2 errori)" },
      { tier: 3, label: "Oro", description: "Scova tutti e 22 i giocatori in modalit\xE0 Sfida senza mai perdere una vita" }
    ]
  },
  {
    id: "scout",
    name: "Scout",
    game: "formazioni",
    icon: "\u26BD",
    tiers: [
      { tier: 1, label: "Bronzo", description: "Gioca una partita online classificata", threshold: 1 },
      { tier: 2, label: "Argento", description: "Gioca 10 partite online classificate", threshold: 10 },
      { tier: 3, label: "Oro", description: "Gioca 50 partite online classificate", threshold: 50 }
    ]
  },
  // ─── CARRIERA ────────────────────────────────────────────────────────────
  {
    id: "maratoneta",
    name: "Maratoneta",
    game: "carriera",
    icon: "\u{1F3C3}",
    tiers: [
      { tier: 1, label: "Bronzo", description: "Indovina la carriera di 2 giocatori consecutivi in Maratona", threshold: 2 },
      { tier: 2, label: "Argento", description: "Indovina la carriera di 5 giocatori consecutivi in Maratona", threshold: 5 },
      { tier: 3, label: "Oro", description: "Indovina la carriera di 10 giocatori consecutivi in Maratona", threshold: 10 }
    ]
  },
  // ─── LINK ─────────────────────────────────────────────────────────────────
  {
    id: "mercato-invernale",
    name: "Mercato Invernale",
    game: "link",
    icon: "\u2744\uFE0F",
    tiers: [
      { tier: 1, label: "Bronzo", description: "Entra nella classifica globale di Link (facile, 2 squadre)" },
      { tier: 2, label: "Argento", description: "Entra nella classifica di Link (facile) sotto i 10:00", threshold: 600 },
      { tier: 3, label: "Oro", description: "Entra nella classifica di Link (facile) sotto i 7:00", threshold: 420 }
    ]
  },
  {
    id: "mercato-estivo",
    name: "Mercato Estivo",
    game: "link",
    icon: "\u2600\uFE0F",
    tiers: [
      { tier: 1, label: "Bronzo", description: "Entra nella classifica globale di Link (difficile, 3 squadre)" },
      { tier: 2, label: "Argento", description: "Entra nella classifica di Link (difficile) sotto i 10:00", threshold: 600 },
      { tier: 3, label: "Oro", description: "Entra nella classifica di Link (difficile) sotto i 7:00", threshold: 420 }
    ]
  },
  // ─── PROGRESSIONE ─────────────────────────────────────────────────────────
  {
    id: "progressione-master",
    name: "Progressione Master",
    game: "progressione",
    icon: "\u{1F4C8}",
    tiers: [
      { tier: 1, label: "Bronzo", description: "Entra nella classifica globale di Progressione in tutte le categorie" },
      { tier: 2, label: "Argento", description: "Entra nella classifica di Progressione in tutte le categorie sotto i 3:00", threshold: 180 },
      { tier: 3, label: "Oro", description: "Entra nella classifica di Progressione in tutte le categorie sotto i 2:00", threshold: 120 }
    ]
  },
  // ─── CARTOLINE ────────────────────────────────────────────────────────────
  {
    id: "collezionista",
    name: "Collezionista",
    game: "cartoline",
    icon: "\u{1F5FA}\uFE0F",
    tiers: [
      { tier: 1, label: "Bronzo", description: "Completa almeno 1 pagina dell'album Cartoline", threshold: 1 },
      { tier: 2, label: "Argento", description: "Completa almeno 3 pagine dell'album Cartoline", threshold: 3 },
      { tier: 3, label: "Oro", description: "Completa tutte le pagine dell'album Cartoline", threshold: 6 }
    ]
  },
  // ─── AARONS-ZURKOWSKI ─────────────────────────────────────────────────────
  {
    id: "aarons-zurkowski",
    name: "Aarons-Zurkowski",
    game: "aarons-zurkowski",
    icon: "\u{1F524}",
    tiers: [
      { tier: 1, label: "Bronzo", description: "Indovina il nome di 1 giocatore in Aarons-Zurkowski", threshold: 1 },
      { tier: 2, label: "Argento", description: "Indovina il nome di 10 giocatori in Aarons-Zurkowski", threshold: 10 },
      { tier: 3, label: "Oro", description: "Indovina il nome di 50 giocatori in Aarons-Zurkowski", threshold: 50 }
    ]
  },
  // ─── DREAM TEAM ───────────────────────────────────────────────────────────
  {
    id: "dream-team-campione",
    name: "Campione del Mondo",
    game: "dream-team",
    icon: "\u{1F3C6}",
    tiers: [
      { tier: 1, label: "Bronzo", description: "Vinci il mondiale in un torneo Dream Team single player" },
      { tier: 2, label: "Argento", description: "Vinci il mondiale in un torneo Dream Team multiplayer" },
      { tier: 3, label: "Oro", description: "Vinci il mondiale con tutti i moduli disponibili in single player" }
    ]
  },
  // ─── GENERALE (extra) ─────────────────────────────────────────────────────
  {
    id: "habitue",
    name: "Habitu\xE9",
    game: "generale",
    icon: "\u{1F4C5}",
    tiers: [
      { tier: 1, label: "Bronzo", description: "Accedi al sito per 3 giorni consecutivi", threshold: 3 },
      { tier: 2, label: "Argento", description: "Accedi al sito per 7 giorni consecutivi", threshold: 7 },
      { tier: 3, label: "Oro", description: "Accedi al sito per 30 giorni consecutivi", threshold: 30 }
    ]
  },
  {
    id: "poliglotta",
    name: "Poliglotta",
    game: "generale",
    icon: "\u{1F30D}",
    tiers: [
      { tier: 1, label: "Bronzo", description: "Gioca almeno una partita in 3 giochi diversi", threshold: 3 },
      { tier: 2, label: "Argento", description: "Gioca almeno una partita in 5 giochi diversi", threshold: 5 },
      { tier: 3, label: "Oro", description: "Gioca almeno una partita in tutti i giochi disponibili", threshold: 8 }
    ]
  }
];
var ACHIEVEMENT_MAP = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

// server/routers/achievements.ts
var achievementsRouter = router({
  /**
   * Get all achievements for the current user (with their unlocked tiers).
   */
  getMyAchievements: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { achievements: ACHIEVEMENTS, unlocked: [] };
    const unlocked = await db.select().from(userAchievements).where(eq2(userAchievements.userId, ctx.user.id)).orderBy(desc(userAchievements.unlockedAt));
    return { achievements: ACHIEVEMENTS, unlocked };
  }),
  /**
   * Get achievements for a specific user (public profile).
   */
  getUserAchievements: publicProcedure.input(z.object({ userId: z.number().int().positive() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { achievements: ACHIEVEMENTS, unlocked: [] };
    const unlocked = await db.select().from(userAchievements).where(eq2(userAchievements.userId, input.userId)).orderBy(desc(userAchievements.unlockedAt));
    return { achievements: ACHIEVEMENTS, unlocked };
  }),
  /**
   * Unlock an achievement tier for the current user.
   * Called from game pages when an objective is reached.
   * Idempotent: if already unlocked at this tier or higher, no-op.
   */
  unlock: protectedProcedure.input(
    z.object({
      achievementId: z.string(),
      tier: z.number().int().min(1).max(3)
    })
  ).mutation(async ({ ctx, input }) => {
    const achievement = ACHIEVEMENT_MAP.get(input.achievementId);
    if (!achievement) throw new Error(`Unknown achievement: ${input.achievementId}`);
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const existing = await db.select().from(userAchievements).where(
      and(
        eq2(userAchievements.userId, ctx.user.id),
        eq2(userAchievements.achievementId, input.achievementId),
        eq2(userAchievements.tier, input.tier)
      )
    );
    if (existing.length > 0) {
      return { alreadyUnlocked: true, achievementId: input.achievementId, tier: input.tier };
    }
    await db.insert(userAchievements).values({
      userId: ctx.user.id,
      achievementId: input.achievementId,
      tier: input.tier
    });
    return { alreadyUnlocked: false, achievementId: input.achievementId, tier: input.tier };
  }),
  /**
   * Bulk-check and unlock multiple achievements at once.
   * Returns newly unlocked achievements (for toast notifications).
   */
  checkAndUnlock: protectedProcedure.input(
    z.array(
      z.object({
        achievementId: z.string(),
        tier: z.number().int().min(1).max(3)
      })
    )
  ).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return { newlyUnlocked: [] };
    const existing = await db.select().from(userAchievements).where(eq2(userAchievements.userId, ctx.user.id));
    const existingSet = new Set(
      existing.map((u) => `${u.achievementId}:${u.tier}`)
    );
    const newlyUnlocked = [];
    for (const item of input) {
      const key = `${item.achievementId}:${item.tier}`;
      if (existingSet.has(key)) continue;
      if (!ACHIEVEMENT_MAP.has(item.achievementId)) continue;
      await db.insert(userAchievements).values({
        userId: ctx.user.id,
        achievementId: item.achievementId,
        tier: item.tier
      });
      newlyUnlocked.push(item);
      existingSet.add(key);
    }
    return { newlyUnlocked };
  }),
  /**
   * Record that the user played an online ranked match (Scout achievement).
   * Called server-side from challenges.submitTurn when a game ends.
   * Returns newly unlocked Scout tiers.
   */
  recordRankedMatch: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { newlyUnlocked: [] };
    await db.insert(userStats).values({ userId: ctx.user.id, rankedMatchesPlayed: 1, gamesPlayedSet: "[]" }).onDuplicateKeyUpdate({
      set: { rankedMatchesPlayed: sql`ranked_matches_played + 1` }
    });
    const [stat] = await db.select().from(userStats).where(eq2(userStats.userId, ctx.user.id));
    const count = stat?.rankedMatchesPlayed ?? 0;
    const candidates = [];
    if (count >= 1) candidates.push({ achievementId: "scout", tier: 1 });
    if (count >= 10) candidates.push({ achievementId: "scout", tier: 2 });
    if (count >= 50) candidates.push({ achievementId: "scout", tier: 3 });
    if (candidates.length === 0) return { newlyUnlocked: [] };
    const existing = await db.select().from(userAchievements).where(eq2(userAchievements.userId, ctx.user.id));
    const existingSet = new Set(existing.map((u) => `${u.achievementId}:${u.tier}`));
    const newlyUnlocked = [];
    for (const item of candidates) {
      const key = `${item.achievementId}:${item.tier}`;
      if (existingSet.has(key)) continue;
      await db.insert(userAchievements).values({ userId: ctx.user.id, achievementId: item.achievementId, tier: item.tier });
      newlyUnlocked.push(item);
      existingSet.add(key);
    }
    return { newlyUnlocked };
  }),
  /**
   * Record a daily login for the Habitué achievement.
   * Should be called once per day when the user logs in.
   */
  recordDailyLogin: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { newlyUnlocked: [] };
    const today = /* @__PURE__ */ new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();
    const [stat] = await db.select().from(userStats).where(eq2(userStats.userId, ctx.user.id));
    const lastLoginMs = stat?.lastLoginDate ?? 0;
    const streak = stat?.loginStreak ?? 0;
    const lastLoginDay = new Date(lastLoginMs);
    lastLoginDay.setHours(0, 0, 0, 0);
    const diffDays = Math.round((todayMs - lastLoginDay.getTime()) / 864e5);
    let newStreak = streak;
    if (diffDays === 1) {
      newStreak = streak + 1;
    } else if (diffDays > 1) {
      newStreak = 1;
    } else {
      return { newlyUnlocked: [] };
    }
    await db.insert(userStats).values({ userId: ctx.user.id, loginStreak: newStreak, lastLoginDate: todayMs, gamesPlayedSet: "[]" }).onDuplicateKeyUpdate({ set: { loginStreak: newStreak, lastLoginDate: todayMs } });
    const candidates = [];
    if (newStreak >= 3) candidates.push({ achievementId: "habitue", tier: 1 });
    if (newStreak >= 7) candidates.push({ achievementId: "habitue", tier: 2 });
    if (newStreak >= 30) candidates.push({ achievementId: "habitue", tier: 3 });
    if (candidates.length === 0) return { newlyUnlocked: [] };
    const existing = await db.select().from(userAchievements).where(eq2(userAchievements.userId, ctx.user.id));
    const existingSet = new Set(existing.map((u) => `${u.achievementId}:${u.tier}`));
    const newlyUnlocked = [];
    for (const item of candidates) {
      const key = `${item.achievementId}:${item.tier}`;
      if (existingSet.has(key)) continue;
      await db.insert(userAchievements).values({ userId: ctx.user.id, achievementId: item.achievementId, tier: item.tier });
      newlyUnlocked.push(item);
      existingSet.add(key);
    }
    return { newlyUnlocked };
  }),
  /**
   * Record that the user played a game (Poliglotta achievement).
   * gameType: one of the 8 game types.
   */
  recordGamePlayed: protectedProcedure.input(z.object({ gameType: z.string() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return { newlyUnlocked: [] };
    const validGames = ["formazioni", "carriera", "link", "progressione", "cartoline", "aarons-zurkowski", "dream-team", "sfida"];
    if (!validGames.includes(input.gameType)) return { newlyUnlocked: [] };
    const [stat] = await db.select().from(userStats).where(eq2(userStats.userId, ctx.user.id));
    const gamesPlayed = JSON.parse(stat?.gamesPlayedSet || "[]");
    if (!gamesPlayed.includes(input.gameType)) {
      gamesPlayed.push(input.gameType);
    }
    const gamesPlayedJson = JSON.stringify(gamesPlayed);
    await db.insert(userStats).values({ userId: ctx.user.id, gamesPlayedSet: gamesPlayedJson }).onDuplicateKeyUpdate({ set: { gamesPlayedSet: gamesPlayedJson } });
    const count = gamesPlayed.length;
    const candidates = [];
    if (count >= 3) candidates.push({ achievementId: "poliglotta", tier: 1 });
    if (count >= 5) candidates.push({ achievementId: "poliglotta", tier: 2 });
    if (count >= 8) candidates.push({ achievementId: "poliglotta", tier: 3 });
    if (candidates.length === 0) return { newlyUnlocked: [] };
    const existing = await db.select().from(userAchievements).where(eq2(userAchievements.userId, ctx.user.id));
    const existingSet = new Set(existing.map((u) => `${u.achievementId}:${u.tier}`));
    const newlyUnlocked = [];
    for (const item of candidates) {
      const key = `${item.achievementId}:${item.tier}`;
      if (existingSet.has(key)) continue;
      await db.insert(userAchievements).values({ userId: ctx.user.id, achievementId: item.achievementId, tier: item.tier });
      newlyUnlocked.push(item);
      existingSet.add(key);
    }
    return { newlyUnlocked };
  })
});

// server/_core/systemRouter.ts
init_notification();
import { z as z2 } from "zod";
var systemRouter = router({
  health: publicProcedure.input(
    z2.object({
      timestamp: z2.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z2.object({
      title: z2.string().min(1, "title is required"),
      content: z2.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers.ts
import { z as z3 } from "zod";
import nodemailer from "nodemailer";
import fs2 from "fs";
import path2 from "path";
import { and as and2, eq as eq3, desc as desc2, sql as sql2 } from "drizzle-orm";
init_env();
var RECIPIENT_EMAIL = "alessandro.centra10401@manus.bot";
function xorshift32(s) {
  let x = s | 0;
  if (x === 0) x = 1;
  x ^= x << 13;
  x ^= x >> 17;
  x ^= x << 5;
  return x | 0;
}
function hashSeed(s) {
  let x = s | 0;
  x = (x >>> 16 ^ x) * 73244475 | 0;
  x = (x >>> 16 ^ x) * 73244475 | 0;
  x = x >>> 16 ^ x | 0;
  return x || 1;
}
function dtShuffle(arr, seed) {
  const a = [...arr];
  let s = hashSeed(seed);
  for (let i = a.length - 1; i > 0; i--) {
    s = xorshift32(s);
    const j = (s >>> 0) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function dtSimulateMatch(myOvr, oppOvr, myPlayers, _oppPlayers, seed) {
  let s = hashSeed(seed);
  const nextR = () => {
    s = xorshift32(s);
    return (s >>> 0) / 4294967295;
  };
  const winProb = Math.min(0.75, Math.max(0.1, 0.45 + (myOvr - oppOvr) * 0.015));
  const drawProb = 0.22;
  const r = nextR();
  const win = r < winProb;
  const draw = !win && r < winProb + drawProb;
  const myGoals = win ? Math.floor(nextR() * 4) + 1 : draw ? Math.floor(nextR() * 3) : Math.floor(nextR() * 3);
  const oppGoals = win ? Math.max(0, myGoals - 1 - Math.floor(nextR() * myGoals)) : draw ? myGoals : myGoals + 1 + Math.floor(nextR() * 3);
  const scorers = [];
  const fwPlayers = myPlayers.filter((p) => p.role === "FW" || p.roles && (p.roles.includes("ST") || p.roles.includes("CF") || p.roles.includes("LW") || p.roles.includes("RW")));
  const mfPlayers = myPlayers.filter((p) => p.role === "MF");
  const dfPlayers = myPlayers.filter((p) => p.role === "DF");
  const allScorers = [...fwPlayers, ...fwPlayers, ...mfPlayers, ...dfPlayers];
  for (let i = 0; i < myGoals; i++) {
    const scorer = allScorers[Math.floor(nextR() * allScorers.length)];
    if (scorer) scorers.push(scorer.name.split(" ").pop() || scorer.name);
  }
  return { win, draw, score: `${myGoals}-${oppGoals}`, scorers, oppGoals, myGoals };
}
function dtSimulatePenalties(seed) {
  let s = hashSeed(seed);
  const nextR = () => {
    s = xorshift32(s);
    return (s >>> 0) / 4294967295;
  };
  let myPens = 0, oppPens = 0;
  const sequence = [];
  for (let i = 0; i < 5; i++) {
    const ms = nextR() < 0.75;
    if (ms) myPens++;
    sequence.push({ isHome: true, scored: ms });
    const os = nextR() < 0.75;
    if (os) oppPens++;
    sequence.push({ isHome: false, scored: os });
  }
  let round = 0;
  while (myPens === oppPens && round < 10) {
    const ms = nextR() < 0.75;
    if (ms) myPens++;
    sequence.push({ isHome: true, scored: ms });
    const os = nextR() < 0.75;
    if (os) oppPens++;
    sequence.push({ isHome: false, scored: os });
    round++;
  }
  return { win: myPens > oppPens, myPens, oppPens, sequence };
}
function dtLoadTeams() {
  try {
    const dbPath = path2.join(process.cwd(), "client", "public", "dreamteam_db.d7d8b7b0.json");
    const raw = fs2.readFileSync(dbPath, "utf-8");
    return JSON.parse(raw).teams;
  } catch {
    return [];
  }
}
function dtNextSeed(s) {
  return xorshift32(s);
}
function dtGenerateTournament(players, roomId) {
  if (!players.length) return {};
  const squads = players.map((player) => {
    const myPlayers = [];
    try {
      const picks = JSON.parse(player.pickData || "[]");
      picks.forEach((p) => {
        if (p.player) myPlayers.push(p.player);
      });
    } catch {
    }
    return { ...player, myPlayers, ovrCalc: player.teamOverall || 70 };
  });
  const BRACKET_SIZE = 16;
  const roundLabels = {
    2: "Finale",
    4: "Semifinale",
    8: "Quarti di Finale",
    16: "Ottavi di Finale"
  };
  const allTeams = dtLoadTeams();
  const baseSeed = roomId * 31337 | 0;
  const realParticipants = squads.map((s) => ({
    displayName: s.displayName,
    ovrCalc: s.ovrCalc,
    myPlayers: s.myPlayers,
    userId: s.userId,
    isAI: false
  }));
  const usedTeamNames = new Set(squads.flatMap((s) => s.myPlayers.map((p) => p.name)));
  const availableAITeams = dtShuffle(
    allTeams.filter((t2) => !usedTeamNames.has(t2.name)),
    baseSeed ^ 3735928559
  );
  const aiFillerCount = BRACKET_SIZE - realParticipants.length;
  const aiParticipants = availableAITeams.slice(0, aiFillerCount).map((team) => ({
    displayName: team.name,
    ovrCalc: team.overall,
    myPlayers: team.players,
    userId: null,
    isAI: true
  }));
  const seeded = [...realParticipants, ...aiParticipants].sort((a, b) => b.ovrCalc - a.ovrCalc);
  const interleaved = new Array(BRACKET_SIZE).fill(0);
  for (let i = 0; i < BRACKET_SIZE / 2; i++) {
    interleaved[i * 2] = i;
    interleaved[i * 2 + 1] = BRACKET_SIZE - 1 - i;
  }
  const knockoutRoundsMap = /* @__PURE__ */ new Map();
  squads.forEach((p) => knockoutRoundsMap.set(p.userId, []));
  let currentSlots = interleaved;
  let roundSize = BRACKET_SIZE;
  while (roundSize > 1) {
    const label = roundLabels[roundSize] ?? `Round ${roundSize}`;
    const nextSlots = [];
    for (let i = 0; i < currentSlots.length; i += 2) {
      const aIdx = currentSlots[i];
      const bIdx = currentSlots[i + 1];
      const playerA = seeded[aIdx];
      const playerB = seeded[bIdx];
      const idA = playerA.userId ?? -(aIdx + 1);
      const idB = playerB.userId ?? -(bIdx + 1);
      let matchSeed = dtNextSeed(baseSeed ^ idA * 7919 ^ idB * 1234567);
      const { win: aWins, draw, score, scorers: aScorers, oppGoals: bGoals, myGoals: aGoals } = dtSimulateMatch(playerA.ovrCalc, playerB.ovrCalc, playerA.myPlayers, playerB.myPlayers, matchSeed);
      matchSeed = dtNextSeed(matchSeed);
      const bScorers = [];
      for (let j = 0; j < bGoals; j++) {
        const p = playerB.myPlayers[Math.abs(dtNextSeed(matchSeed + j)) % Math.max(1, playerB.myPlayers.length)];
        if (p) bScorers.push(p.name.split(" ").pop() || p.name);
      }
      let finalAWins = aWins;
      let penalties;
      if (draw) {
        penalties = dtSimulatePenalties(dtNextSeed(matchSeed ^ 65535));
        finalAWins = penalties.win;
      }
      const reverseScore = `${bGoals}-${aGoals}`;
      const reversePenalties = penalties ? { myPens: penalties.oppPens, oppPens: penalties.myPens, win: !penalties.win, sequence: penalties.sequence.map((s) => ({ ...s, isHome: !s.isHome })) } : void 0;
      if (!playerA.isAI && playerA.userId !== null) {
        knockoutRoundsMap.get(playerA.userId).push({
          label,
          opp: playerB.displayName,
          myOvr: playerA.ovrCalc,
          oppOvr: playerB.ovrCalc,
          win: finalAWins,
          score,
          scorers: aScorers,
          oppScorers: bScorers,
          penalties
        });
      }
      if (!playerB.isAI && playerB.userId !== null) {
        knockoutRoundsMap.get(playerB.userId).push({
          label,
          opp: playerA.displayName,
          myOvr: playerB.ovrCalc,
          oppOvr: playerA.ovrCalc,
          win: !finalAWins,
          score: reverseScore,
          scorers: bScorers,
          oppScorers: aScorers,
          penalties: reversePenalties
        });
      }
      nextSlots.push(finalAWins ? aIdx : bIdx);
    }
    currentSlots = nextSlots;
    roundSize = roundSize / 2;
  }
  const result = {};
  squads.forEach((player) => {
    const rounds = knockoutRoundsMap.get(player.userId) ?? [];
    result[player.userId] = {
      groupMatches: [],
      // no group phase in multiplayer
      groupPoints: 18,
      // always qualified
      qualified: true,
      knockoutRounds: rounds
    };
  });
  return result;
}
var appRouter = router({
  system: systemRouter,
  achievements: achievementsRouter,
  // Leaderboard for Link and Progressione games
  leaderboard: router({
    // Save a new score
    saveScore: publicProcedure.input(z3.object({
      gameType: z3.enum(["link", "progressione"]),
      playerName: z3.string().min(1).max(100),
      timeSeconds: z3.number().int().positive(),
      competition: z3.string().max(50),
      difficulty: z3.string().max(20).optional()
    })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }
      const result = await db.insert(leaderboard).values({
        gameType: input.gameType,
        playerName: input.playerName,
        timeSeconds: input.timeSeconds,
        competition: input.competition,
        difficulty: input.difficulty || null
      });
      return { success: true, id: result[0].insertId };
    }),
    // Get top scores for a specific game type and competition
    getTopScores: publicProcedure.input(z3.object({
      gameType: z3.enum(["link", "progressione"]),
      competition: z3.string().max(50),
      difficulty: z3.string().max(20).optional(),
      limit: z3.number().int().positive().default(10)
    })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        return [];
      }
      const conditions = [
        eq3(leaderboard.gameType, input.gameType),
        eq3(leaderboard.competition, input.competition)
      ];
      if (input.difficulty) {
        conditions.push(eq3(leaderboard.difficulty, input.difficulty));
      }
      const results = await db.select().from(leaderboard).where(and2(...conditions)).orderBy(leaderboard.timeSeconds).limit(input.limit);
      return results;
    }),
    // Get Maratona record (best score)
    getMaratonaRecord: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database connection failed");
      }
      const records = await db.select({
        playerName: users.name,
        score: gameScores.score
      }).from(gameScores).innerJoin(users, eq3(gameScores.userId, users.id)).where(and2(
        eq3(gameScores.gameType, "carriere"),
        eq3(gameScores.difficulty, "maratona")
      )).orderBy(desc2(gameScores.score)).limit(1);
      if (records.length === 0) {
        return null;
      }
      return records[0];
    })
  }),
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true
      };
    })
  }),
  // Feedback endpoint
  feedback: router({
    send: publicProcedure.input(z3.object({
      message: z3.string().min(1).max(5e3)
    })).mutation(async ({ input }) => {
      const { message } = input;
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
            pass: smtpPass
          }
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
          text: body
        });
        console.log("[Email] Feedback sent successfully");
        return { success: true };
      } catch (error) {
        console.error("[Email] Failed to send feedback:", error);
        return { success: false, error: "Failed to send email" };
      }
    })
  }),
  // Error reporting endpoint
  report: router({
    sendError: publicProcedure.input(z3.object({
      matchId: z3.string(),
      homeTeam: z3.string(),
      awayTeam: z3.string(),
      date: z3.string(),
      description: z3.string()
    })).mutation(async ({ input }) => {
      const { matchId, homeTeam, awayTeam, date, description } = input;
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
            pass: smtpPass
          }
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
          text: body
        });
        console.log(`[Email] Error report sent for match ${matchId}`);
        try {
          const { execSync } = __require("child_process");
          const timestamp2 = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
          const reportLine = `${timestamp2} | ID: ${matchId} | ${homeTeam} vs ${awayTeam} (${date}) | ${description}
`;
          execSync(
            `echo '${reportLine.replace(/'/g, "'\\''")}' >> /tmp/gdrive_report.txt && rclone copy /tmp/gdrive_report.txt "manus_google_drive:Calcio d'Inizio/errori_segnalati.txt" --config /home/ubuntu/.gdrive-rclone.ini --append`,
            { encoding: "utf-8" }
          );
          console.log(`[Google Drive] Report saved for match ${matchId}`);
        } catch (driveError) {
          console.error("[Google Drive] Failed to save report:", driveError);
        }
        return { success: true };
      } catch (error) {
        console.error("[Email] Failed to send:", error);
        return { success: false, error: "Failed to send email" };
      }
    })
  }),
  // Donations - PayPal pool scraping
  donations: router({
    getProgress: publicProcedure.query(async () => {
      try {
        const response = await fetch("https://www.paypal.com/pools/c/9lCKCiF8hN");
        const html = await response.text();
        const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
        if (jsonLdMatch) {
          const data = JSON.parse(jsonLdMatch[1]);
          const raised = parseFloat(data.amountRaised?.value || "0");
          const goal = parseFloat(data.targetAmount?.value || "1000");
          const currency = data.amountRaised?.currency || "EUR";
          return {
            raised,
            goal,
            currency,
            percentage: Math.round(raised / goal * 100)
          };
        }
        const raisedMatch = html.match(/"amountRaised"[^}]*"value"[^"]*"([0-9.]+)"/i);
        const goalMatch = html.match(/"targetAmount"[^}]*"value"[^"]*"([0-9.]+)"/i);
        if (raisedMatch && goalMatch) {
          const raised = parseFloat(raisedMatch[1]);
          const goal = parseFloat(goalMatch[1]);
          return {
            raised,
            goal,
            currency: "EUR",
            percentage: Math.round(raised / goal * 100)
          };
        }
        return {
          raised: 0,
          goal: 1e3,
          currency: "EUR",
          percentage: 0
        };
      } catch (error) {
        console.error("[Donations] Failed to fetch PayPal data:", error);
        return {
          raised: 0,
          goal: 1e3,
          currency: "EUR",
          percentage: 0
        };
      }
    })
  }),
  // Game scores tracking for user profiles
  gameScores: router({
    // Save a new score (protected - requires authentication)
    saveScore: protectedProcedure.input(z3.object({
      gameType: z3.enum(["formazioni", "carriere", "link", "progressione"]),
      score: z3.number().int(),
      timeSeconds: z3.number().int().optional(),
      competition: z3.string().max(50).optional(),
      difficulty: z3.string().max(20).optional(),
      metadata: z3.string().optional()
      // JSON string with additional data
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }
      if (input.gameType === "carriere" && input.difficulty === "maratona") {
        const existingBest = await db.select({ score: gameScores.score }).from(gameScores).where(and2(
          eq3(gameScores.userId, ctx.user.id),
          eq3(gameScores.gameType, "carriere"),
          eq3(gameScores.difficulty, "maratona")
        )).orderBy(desc2(gameScores.score)).limit(1);
        if (existingBest.length > 0 && existingBest[0].score >= input.score) {
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
        metadata: input.metadata || null
      });
      return { success: true, id: result[0].insertId, improved: true };
    }),
    // Get all scores for the current user
    getUserScores: protectedProcedure.input(z3.object({
      gameType: z3.enum(["formazioni", "carriere", "link", "progressione"]).optional(),
      limit: z3.number().int().positive().default(50)
    })).query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }
      const conditions = [eq3(gameScores.userId, ctx.user.id)];
      if (input.gameType) {
        conditions.push(eq3(gameScores.gameType, input.gameType));
      }
      const scores = await db.select().from(gameScores).where(and2(...conditions)).orderBy(gameScores.createdAt).limit(input.limit);
      return scores;
    }),
    // Get aggregated stats for the current user
    getUserStats: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }
      const allScores = await db.select().from(gameScores).where(eq3(gameScores.userId, ctx.user.id));
      const statsByGame = {};
      for (const score of allScores) {
        if (!statsByGame[score.gameType]) {
          statsByGame[score.gameType] = {
            totalGames: 0,
            bestScore: score.score,
            averageScore: 0,
            bestTime: score.timeSeconds,
            averageTime: null
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
      for (const gameType in statsByGame) {
        const gameScoresFiltered = allScores.filter((s) => s.gameType === gameType);
        const totalScore = gameScoresFiltered.reduce((sum, s) => sum + s.score, 0);
        statsByGame[gameType].averageScore = Math.round(totalScore / gameScoresFiltered.length);
        const timesFiltered = gameScoresFiltered.filter((s) => s.timeSeconds !== null).map((s) => s.timeSeconds);
        if (timesFiltered.length > 0) {
          const totalTime = timesFiltered.reduce((sum, t2) => sum + t2, 0);
          statsByGame[gameType].averageTime = Math.round(totalTime / timesFiltered.length);
        }
      }
      return {
        totalGames: allScores.length,
        statsByGame
      };
    })
  }),
  // Friends system
  friends: router({
    // Search users by name
    searchUsers: protectedProcedure.input(z3.object({
      query: z3.string().min(1).max(100)
    })).query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }
      const searchPattern = `%${input.query}%`;
      const foundUsers = await db.select({
        id: users.id,
        name: users.name,
        username: users.username,
        email: users.email
      }).from(users).limit(20);
      const searchLower = input.query.toLowerCase();
      const filteredUsers = foundUsers.filter(
        (u) => u.id !== ctx.user.id && (u.name?.toLowerCase().includes(searchLower) || u.email?.toLowerCase().includes(searchLower))
      );
      return filteredUsers;
    }),
    // Send friend request
    sendFriendRequest: protectedProcedure.input(z3.object({
      receiverId: z3.number().int().positive()
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }
      const existingFriendship = await db.select().from(friendships).where(
        and2(
          eq3(friendships.userId1, Math.min(ctx.user.id, input.receiverId)),
          eq3(friendships.userId2, Math.max(ctx.user.id, input.receiverId))
        )
      ).limit(1);
      if (existingFriendship.length > 0) {
        throw new Error("Already friends");
      }
      const existingRequest = await db.select().from(friendRequests).where(
        and2(
          eq3(friendRequests.senderId, ctx.user.id),
          eq3(friendRequests.receiverId, input.receiverId),
          eq3(friendRequests.status, "pending")
        )
      ).limit(1);
      if (existingRequest.length > 0) {
        throw new Error("Request already sent");
      }
      const result = await db.insert(friendRequests).values({
        senderId: ctx.user.id,
        receiverId: input.receiverId,
        status: "pending"
      });
      return { success: true, id: result[0].insertId };
    }),
    // Accept friend request
    acceptFriendRequest: protectedProcedure.input(z3.object({
      requestId: z3.number().int().positive()
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }
      const request = await db.select().from(friendRequests).where(
        and2(
          eq3(friendRequests.id, input.requestId),
          eq3(friendRequests.receiverId, ctx.user.id),
          eq3(friendRequests.status, "pending")
        )
      ).limit(1);
      if (request.length === 0) {
        throw new Error("Request not found");
      }
      await db.update(friendRequests).set({ status: "accepted" }).where(eq3(friendRequests.id, input.requestId));
      await db.insert(friendships).values({
        userId1: Math.min(ctx.user.id, request[0].senderId),
        userId2: Math.max(ctx.user.id, request[0].senderId)
      });
      return { success: true };
    }),
    // Reject friend request
    rejectFriendRequest: protectedProcedure.input(z3.object({
      requestId: z3.number().int().positive()
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }
      await db.update(friendRequests).set({ status: "rejected" }).where(
        and2(
          eq3(friendRequests.id, input.requestId),
          eq3(friendRequests.receiverId, ctx.user.id)
        )
      );
      return { success: true };
    }),
    // Get friends list
    getFriends: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }
      const friendshipsList = await db.select().from(friendships);
      const filteredFriendships = friendshipsList.filter(
        (f) => f.userId1 === ctx.user.id || f.userId2 === ctx.user.id
      );
      const friendIds = filteredFriendships.map(
        (f) => f.userId1 === ctx.user.id ? f.userId2 : f.userId1
      );
      const friendsDetails = await db.select({
        id: users.id,
        name: users.name,
        username: users.username,
        email: users.email,
        eloRating: users.eloRating
      }).from(users);
      const friends = friendsDetails.filter((u) => friendIds.includes(u.id));
      return friends;
    }),
    // Get pending friend requests (received)
    getPendingRequests: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }
      const requests = await db.select().from(friendRequests).where(
        and2(
          eq3(friendRequests.receiverId, ctx.user.id),
          eq3(friendRequests.status, "pending")
        )
      );
      const senderIds = requests.map((r) => r.senderId);
      const sendersDetails = await db.select({
        id: users.id,
        name: users.name,
        username: users.username,
        email: users.email
      }).from(users);
      const senders = sendersDetails.filter((u) => senderIds.includes(u.id));
      const requestsWithSenders = requests.map((r) => ({
        ...r,
        sender: senders.find((s) => s.id === r.senderId)
      }));
      return requestsWithSenders;
    }),
    // Remove friend
    removeFriend: protectedProcedure.input(z3.object({
      friendId: z3.number().int().positive()
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }
      await db.delete(friendships).where(
        and2(
          eq3(friendships.userId1, Math.min(ctx.user.id, input.friendId)),
          eq3(friendships.userId2, Math.max(ctx.user.id, input.friendId))
        )
      );
      return { success: true };
    })
  }),
  // Async challenges system for Formazioni game
  challenges: router({
    // Create a new challenge
    createChallenge: protectedProcedure.input(z3.object({
      opponentId: z3.number(),
      competition: z3.string(),
      period: z3.string(),
      matchData: z3.string(),
      gameMode: z3.enum(["standard", "rapid"]).default("standard")
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }
      const friendship = await db.select().from(friendships).where(
        and2(
          eq3(friendships.userId1, Math.min(ctx.user.id, input.opponentId)),
          eq3(friendships.userId2, Math.max(ctx.user.id, input.opponentId))
        )
      ).limit(1);
      if (friendship.length === 0) {
        throw new Error("Can only challenge friends");
      }
      const isRapid = input.gameMode === "rapid";
      const result = await db.insert(asyncChallenges).values({
        challengerId: ctx.user.id,
        opponentId: input.opponentId,
        status: "pending",
        competition: input.competition,
        period: input.period,
        matchData: input.matchData,
        gameMode: input.gameMode,
        currentTurn: "opponent",
        // Opponent starts
        attemptsInCurrentTurn: 0,
        challengerLives: isRapid ? 0 : 5,
        // Rapid non usa vite
        opponentLives: isRapid ? 0 : 5,
        challengerHints: 5,
        opponentHints: 5,
        challengerScore: 0,
        opponentScore: 0,
        challengerTimeRemaining: isRapid ? 600 : null,
        // 10 minuti per Rapid
        opponentTimeRemaining: isRapid ? 600 : null,
        lastMoveAt: isRapid ? /* @__PURE__ */ new Date() : null
      });
      return { success: true, challengeId: result[0].insertId };
    }),
    // Accept challenge
    acceptChallenge: protectedProcedure.input(z3.object({
      challengeId: z3.number().int().positive()
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }
      await db.update(asyncChallenges).set({ status: "active" }).where(
        and2(
          eq3(asyncChallenges.id, input.challengeId),
          eq3(asyncChallenges.opponentId, ctx.user.id),
          eq3(asyncChallenges.status, "pending")
        )
      );
      return { success: true };
    }),
    // Reject challenge
    rejectChallenge: protectedProcedure.input(z3.object({
      challengeId: z3.number().int().positive()
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }
      await db.update(asyncChallenges).set({ status: "rejected" }).where(
        and2(
          eq3(asyncChallenges.id, input.challengeId),
          eq3(asyncChallenges.opponentId, ctx.user.id),
          eq3(asyncChallenges.status, "pending")
        )
      );
      return { success: true };
    }),
    // Submit a turn (guess a player)
    submitTurn: protectedProcedure.input(z3.object({
      challengeId: z3.number().int().positive(),
      playerName: z3.string().max(100),
      isCorrect: z3.boolean(),
      hintsUsed: z3.number().int().min(0).default(0),
      matchCount: z3.number().int().min(1).default(1)
      // Numero di giocatori trovati con questa risposta
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }
      const challenges = await db.select().from(asyncChallenges).where(
        and2(
          eq3(asyncChallenges.id, input.challengeId),
          eq3(asyncChallenges.status, "active")
        )
      ).limit(1);
      if (challenges.length === 0) {
        throw new Error("Challenge not found or not active");
      }
      const challenge = challenges[0];
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
      await db.insert(challengeTurns).values({
        challengeId: input.challengeId,
        userId: ctx.user.id,
        playerName: input.playerName,
        isCorrect: input.isCorrect ? 1 : 0,
        hintsUsed: input.hintsUsed
      });
      const updates = {};
      if (input.isCorrect) {
        const pointsToAdd = input.matchCount || 1;
        if (isChallenger) {
          updates.challengerScore = challenge.challengerScore + pointsToAdd;
        } else {
          updates.opponentScore = challenge.opponentScore + pointsToAdd;
        }
      } else {
        if (isChallenger) {
          updates.challengerLives = challenge.challengerLives - 1;
        } else {
          updates.opponentLives = challenge.opponentLives - 1;
        }
      }
      if (input.hintsUsed > 0) {
        const currentHints = isChallenger ? challenge.challengerHints : challenge.opponentHints;
        const hintsUsedSoFar = 5 - currentHints;
        if (hintsUsedSoFar >= 5) {
          throw new Error("Hai gi\xE0 usato tutti i 5 indizi disponibili");
        }
        if (isChallenger) {
          updates.challengerHints = Math.max(0, challenge.challengerHints - input.hintsUsed);
        } else {
          updates.opponentHints = Math.max(0, challenge.opponentHints - input.hintsUsed);
        }
      }
      const attemptsPerTurn = challenge.gameMode === "rapid" ? 1 : 3;
      const newAttempts = challenge.attemptsInCurrentTurn + 1;
      if (newAttempts >= attemptsPerTurn) {
        updates.currentTurn = challenge.currentTurn === "challenger" ? "opponent" : "challenger";
        updates.attemptsInCurrentTurn = 0;
        if (challenge.gameMode === "rapid" && challenge.lastMoveAt) {
          const timeElapsed = Math.floor((Date.now() - new Date(challenge.lastMoveAt).getTime()) / 1e3);
          if (isChallenger) {
            updates.challengerTimeRemaining = Math.max(0, (challenge.challengerTimeRemaining || 600) - timeElapsed);
          } else {
            updates.opponentTimeRemaining = Math.max(0, (challenge.opponentTimeRemaining || 600) - timeElapsed);
          }
        }
        updates.lastMoveAt = /* @__PURE__ */ new Date();
      } else {
        updates.attemptsInCurrentTurn = newAttempts;
      }
      const challengerLives = isChallenger ? updates.challengerLives ?? challenge.challengerLives : challenge.challengerLives;
      const opponentLives = isOpponent ? updates.opponentLives ?? challenge.opponentLives : challenge.opponentLives;
      const challengerScore = updates.challengerScore ?? challenge.challengerScore;
      const opponentScore = updates.opponentScore ?? challenge.opponentScore;
      const challengerTime = updates.challengerTimeRemaining ?? challenge.challengerTimeRemaining ?? 600;
      const opponentTime = updates.opponentTimeRemaining ?? challenge.opponentTimeRemaining ?? 600;
      if (challenge.gameMode === "rapid") {
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
          updates.status = "completed";
          if (challengerScore > opponentScore) {
            updates.winnerId = challenge.challengerId;
          } else if (opponentScore > challengerScore) {
            updates.winnerId = challenge.opponentId;
          } else {
            updates.winnerId = null;
          }
        }
      } else {
        const matchData = JSON.parse(challenge.matchData);
        const homePlayersCount = matchData.match?.homeFormation?.players?.length || 11;
        const awayPlayersCount = matchData.match?.awayFormation?.players?.length || 11;
        const totalPlayers = homePlayersCount + awayPlayersCount;
        const totalGuessed = challengerScore + opponentScore;
        if (challengerLives <= 0 || opponentLives <= 0 || totalGuessed >= totalPlayers) {
          updates.status = "completed";
          if (challengerScore > opponentScore) {
            updates.winnerId = challenge.challengerId;
          } else if (opponentScore > challengerScore) {
            updates.winnerId = challenge.opponentId;
          } else {
            updates.winnerId = null;
          }
        }
      }
      await db.update(asyncChallenges).set(updates).where(eq3(asyncChallenges.id, input.challengeId));
      let eloChange = null;
      let newEloRating = null;
      if (updates.status === "completed") {
        const [challengerData, opponentData] = await Promise.all([
          db.select({ eloRating: users.eloRating }).from(users).where(eq3(users.id, challenge.challengerId)).limit(1),
          db.select({ eloRating: users.eloRating }).from(users).where(eq3(users.id, challenge.opponentId)).limit(1)
        ]);
        const challengerElo = challengerData[0]?.eloRating || 1200;
        const opponentElo = opponentData[0]?.eloRating || 1200;
        const expectedChallenger = 1 / (1 + Math.pow(10, (opponentElo - challengerElo) / 400));
        const expectedOpponent = 1 / (1 + Math.pow(10, (challengerElo - opponentElo) / 400));
        let challengerResult = 0.5;
        let opponentResult = 0.5;
        if (updates.winnerId === challenge.challengerId) {
          challengerResult = 1;
          opponentResult = 0;
        } else if (updates.winnerId === challenge.opponentId) {
          challengerResult = 0;
          opponentResult = 1;
        }
        const K = 32;
        const newChallengerElo = Math.round(challengerElo + K * (challengerResult - expectedChallenger));
        const newOpponentElo = Math.round(opponentElo + K * (opponentResult - expectedOpponent));
        const challengerEloChange = newChallengerElo - challengerElo;
        const opponentEloChange = newOpponentElo - opponentElo;
        await Promise.all([
          db.update(users).set({ eloRating: newChallengerElo }).where(eq3(users.id, challenge.challengerId)),
          db.update(users).set({ eloRating: newOpponentElo }).where(eq3(users.id, challenge.opponentId)),
          db.update(asyncChallenges).set({
            challengerEloChange,
            opponentEloChange,
            challengerNewElo: newChallengerElo,
            opponentNewElo: newOpponentElo
          }).where(eq3(asyncChallenges.id, challenge.id))
        ]);
        if (isChallenger) {
          eloChange = challengerEloChange;
          newEloRating = newChallengerElo;
        } else {
          eloChange = opponentEloChange;
          newEloRating = newOpponentElo;
        }
      }
      if (updates.status !== "completed") {
        const opponentId = isChallenger ? challenge.opponentId : challenge.challengerId;
        const opponentDetails = await db.select({ name: users.name }).from(users).where(eq3(users.id, opponentId)).limit(1);
        if (opponentDetails.length > 0 && opponentId === parseInt(ENV.ownerOpenId || "0")) {
          const { notifyOwner: notifyOwner2 } = await Promise.resolve().then(() => (init_notification(), notification_exports));
          await notifyOwner2({
            title: "\xC8 il tuo turno!",
            content: `${ctx.user.name || "Un avversario"} ha completato il suo turno nella sfida Formazioni. Vai su https://kickoff-trivia.com/sfide per giocare!`
          }).catch((err) => console.error("Errore invio notifica:", err));
        }
      }
      return {
        success: true,
        gameOver: updates.status === "completed",
        winnerId: updates.winnerId,
        eloChange,
        newEloRating
      };
    }),
    // Get challenge details
    getChallenge: protectedProcedure.input(z3.object({
      challengeId: z3.number().int().positive()
    })).query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }
      const challenges = await db.select().from(asyncChallenges).where(eq3(asyncChallenges.id, input.challengeId)).limit(1);
      if (challenges.length === 0) {
        throw new Error("Challenge not found");
      }
      const challenge = challenges[0];
      if (challenge.challengerId !== ctx.user.id && challenge.opponentId !== ctx.user.id) {
        throw new Error("Not a participant in this challenge");
      }
      if (challenge.status === "active" && challenge.lastMoveAt) {
        const now = /* @__PURE__ */ new Date();
        const lastMove = new Date(challenge.lastMoveAt);
        const minutesSinceLastMove = (now.getTime() - lastMove.getTime()) / 1e3 / 60;
        const timeoutMinutes = challenge.gameMode === "rapid" ? 5 : 24 * 60;
        if (minutesSinceLastMove > timeoutMinutes) {
          const isChallenger = ctx.user.id === challenge.challengerId;
          const winnerId = isChallenger ? challenge.challengerId : challenge.opponentId;
          await db.update(asyncChallenges).set({
            status: "completed",
            winnerId,
            updatedAt: now
          }).where(eq3(asyncChallenges.id, input.challengeId));
          challenge.status = "completed";
          challenge.winnerId = winnerId;
        }
      }
      const turns = await db.select().from(challengeTurns).where(eq3(challengeTurns.challengeId, input.challengeId));
      const opponentId = challenge.challengerId === ctx.user.id ? challenge.opponentId : challenge.challengerId;
      const opponentDetails = await db.select({
        id: users.id,
        name: users.name,
        username: users.username
      }).from(users).where(eq3(users.id, opponentId)).limit(1);
      let myEloChange = null;
      let myNewEloRating = null;
      if (challenge.status === "completed") {
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
        newEloRating: myNewEloRating
      };
    }),
    // Get pending challengesfor current user
    getMyChallenges: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }
      const allChallenges = await db.select().from(asyncChallenges);
      const myChallenges = allChallenges.filter(
        (c) => c.challengerId === ctx.user.id || c.opponentId === ctx.user.id
      );
      const challengesWithOpponents = await Promise.all(
        myChallenges.map(async (challenge) => {
          const opponentId = challenge.challengerId === ctx.user.id ? challenge.opponentId : challenge.challengerId;
          const opponentDetails = await db.select({
            id: users.id,
            name: users.name,
            username: users.username,
            eloRating: users.eloRating
          }).from(users).where(eq3(users.id, opponentId)).limit(1);
          return {
            ...challenge,
            opponent: opponentDetails[0],
            isMyTurn: challenge.challengerId === ctx.user.id && challenge.currentTurn === "challenger" || challenge.opponentId === ctx.user.id && challenge.currentTurn === "opponent"
          };
        })
      );
      return challengesWithOpponents;
    }),
    // Get pending challenges (received)
    getPendingChallenges: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }
      const pendingChallenges = await db.select().from(asyncChallenges).where(
        and2(
          eq3(asyncChallenges.opponentId, ctx.user.id),
          eq3(asyncChallenges.status, "pending")
        )
      );
      const challengesWithChallengers = await Promise.all(
        pendingChallenges.map(async (challenge) => {
          const challengerDetails = await db.select({
            id: users.id,
            name: users.name,
            username: users.username
          }).from(users).where(eq3(users.id, challenge.challengerId)).limit(1);
          return {
            ...challenge,
            challenger: challengerDetails[0]
          };
        })
      );
      return challengesWithChallengers;
    }),
    // Use hint in challenge
    useHint: protectedProcedure.input(z3.object({
      challengeId: z3.number().int().positive(),
      hintType: z3.enum(["nationality", "number"]),
      team: z3.enum(["home", "away"]),
      playerIndex: z3.number().int().min(0)
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }
      const challenges = await db.select().from(asyncChallenges).where(eq3(asyncChallenges.id, input.challengeId)).limit(1);
      if (challenges.length === 0) {
        throw new Error("Challenge not found");
      }
      const challenge = challenges[0];
      const isChallenger = challenge.challengerId === ctx.user.id;
      const isOpponent = challenge.opponentId === ctx.user.id;
      if (!isChallenger && !isOpponent) {
        throw new Error("Not authorized");
      }
      const currentTurnUser = challenge.currentTurn === "challenger" ? "challenger" : "opponent";
      const userRole = isChallenger ? "challenger" : "opponent";
      if (currentTurnUser !== userRole) {
        throw new Error("Not your turn");
      }
      const currentHints = isChallenger ? challenge.challengerHints : challenge.opponentHints;
      if (currentHints <= 0) {
        throw new Error("No hints remaining");
      }
      const updates = {};
      if (isChallenger) {
        updates.challengerHints = challenge.challengerHints - 1;
      } else {
        updates.opponentHints = challenge.opponentHints - 1;
      }
      await db.update(asyncChallenges).set(updates).where(eq3(asyncChallenges.id, input.challengeId));
      return {
        success: true,
        hintsRemaining: currentHints - 1
      };
    }),
    // Forfeit challenge (abbandona partita)
    forfeitChallenge: protectedProcedure.input(z3.object({
      challengeId: z3.number().int().positive()
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }
      const challenges = await db.select().from(asyncChallenges).where(eq3(asyncChallenges.id, input.challengeId)).limit(1);
      if (challenges.length === 0) {
        throw new Error("Challenge not found");
      }
      const challenge = challenges[0];
      const isChallenger = challenge.challengerId === ctx.user.id;
      const isOpponent = challenge.opponentId === ctx.user.id;
      if (!isChallenger && !isOpponent) {
        throw new Error("Not authorized");
      }
      if (challenge.status !== "active") {
        throw new Error("Challenge is not active");
      }
      const winnerId = isChallenger ? challenge.opponentId : challenge.challengerId;
      await db.update(asyncChallenges).set({
        status: "completed",
        winnerId,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq3(asyncChallenges.id, input.challengeId));
      const challengerUser = await db.select().from(users).where(eq3(users.id, challenge.challengerId)).limit(1);
      const opponentUser = await db.select().from(users).where(eq3(users.id, challenge.opponentId)).limit(1);
      if (challengerUser.length > 0 && opponentUser.length > 0) {
        const challengerElo = challengerUser[0].eloRating ?? 1200;
        const opponentElo = opponentUser[0].eloRating ?? 1200;
        const expectedChallenger = 1 / (1 + Math.pow(10, (opponentElo - challengerElo) / 400));
        const expectedOpponent = 1 / (1 + Math.pow(10, (challengerElo - opponentElo) / 400));
        const actualChallenger = winnerId === challenge.challengerId ? 1 : 0;
        const actualOpponent = winnerId === challenge.opponentId ? 1 : 0;
        const K = 32;
        const newChallengerElo = Math.round(challengerElo + K * (actualChallenger - expectedChallenger));
        const newOpponentElo = Math.round(opponentElo + K * (actualOpponent - expectedOpponent));
        await db.update(users).set({ eloRating: newChallengerElo }).where(eq3(users.id, challenge.challengerId));
        await db.update(users).set({ eloRating: newOpponentElo }).where(eq3(users.id, challenge.opponentId));
      }
      return {
        success: true,
        winnerId
      };
    }),
    // Time expired (tempo scaduto)
    timeExpired: protectedProcedure.input(z3.object({
      challengeId: z3.number().int().positive()
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }
      const challenges = await db.select().from(asyncChallenges).where(eq3(asyncChallenges.id, input.challengeId)).limit(1);
      if (challenges.length === 0) {
        throw new Error("Challenge not found");
      }
      const challenge = challenges[0];
      const isChallenger = challenge.challengerId === ctx.user.id;
      const isOpponent = challenge.opponentId === ctx.user.id;
      if (!isChallenger && !isOpponent) {
        throw new Error("Not authorized");
      }
      if (challenge.status !== "active") {
        throw new Error("Challenge is not active");
      }
      const myTimeRemaining = isChallenger ? challenge.challengerTimeRemaining : challenge.opponentTimeRemaining;
      if (myTimeRemaining === null || myTimeRemaining > 0) {
        throw new Error("Time has not expired");
      }
      const winnerId = isChallenger ? challenge.opponentId : challenge.challengerId;
      await db.update(asyncChallenges).set({
        status: "completed",
        winnerId,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq3(asyncChallenges.id, input.challengeId));
      const challengerUser = await db.select().from(users).where(eq3(users.id, challenge.challengerId)).limit(1);
      const opponentUser = await db.select().from(users).where(eq3(users.id, challenge.opponentId)).limit(1);
      if (challengerUser.length > 0 && opponentUser.length > 0) {
        const challengerElo = challengerUser[0].eloRating ?? 1200;
        const opponentElo = opponentUser[0].eloRating ?? 1200;
        const expectedChallenger = 1 / (1 + Math.pow(10, (opponentElo - challengerElo) / 400));
        const expectedOpponent = 1 / (1 + Math.pow(10, (challengerElo - opponentElo) / 400));
        const actualChallenger = winnerId === challenge.challengerId ? 1 : 0;
        const actualOpponent = winnerId === challenge.opponentId ? 1 : 0;
        const K = 32;
        const newChallengerElo = Math.round(challengerElo + K * (actualChallenger - expectedChallenger));
        const newOpponentElo = Math.round(opponentElo + K * (actualOpponent - expectedOpponent));
        await db.update(users).set({ eloRating: newChallengerElo }).where(eq3(users.id, challenge.challengerId));
        await db.update(users).set({ eloRating: newOpponentElo }).where(eq3(users.id, challenge.opponentId));
      }
      return {
        success: true,
        winnerId
      };
    }),
    // Delete challenge
    deleteChallenge: protectedProcedure.input(z3.object({
      challengeId: z3.number().int().positive()
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }
      const challenges = await db.select().from(asyncChallenges).where(eq3(asyncChallenges.id, input.challengeId)).limit(1);
      if (challenges.length === 0) {
        throw new Error("Challenge not found");
      }
      const challenge = challenges[0];
      if (challenge.challengerId !== ctx.user.id && challenge.opponentId !== ctx.user.id) {
        throw new Error("Not authorized to delete this challenge");
      }
      await db.delete(challengeTurns).where(eq3(challengeTurns.challengeId, input.challengeId));
      await db.delete(asyncChallenges).where(eq3(asyncChallenges.id, input.challengeId));
      return { success: true };
    }),
    // Matchmaking for Live mode
    enterMatchmaking: protectedProcedure.input(z3.object({
      timeLimit: z3.number().int().positive(),
      // Tempo in secondi (180, 300, 600, 1200, 1800)
      competition: z3.string().max(50)
      // Campionato selezionato
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }
      await db.update(matchmakingQueue).set({ status: "cancelled" }).where(and2(
        eq3(matchmakingQueue.userId, ctx.user.id),
        eq3(matchmakingQueue.status, "searching")
      ));
      const result = await db.insert(matchmakingQueue).values({
        userId: ctx.user.id,
        timeLimit: input.timeLimit,
        competition: input.competition,
        status: "searching"
      });
      return { success: true, queueId: result[0].insertId };
    }),
    checkMatchmaking: protectedProcedure.input(z3.object({
      queueId: z3.number().int().positive()
    })).query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }
      const entries = await db.select().from(matchmakingQueue).where(eq3(matchmakingQueue.id, input.queueId)).limit(1);
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
      const opponents = await db.select().from(matchmakingQueue).where(and2(
        eq3(matchmakingQueue.timeLimit, entry.timeLimit),
        eq3(matchmakingQueue.competition, entry.competition),
        // Stesso campionato
        eq3(matchmakingQueue.status, "searching")
      )).limit(10);
      const opponent = opponents.find((o) => o.userId !== ctx.user.id);
      if (opponent) {
        const fs3 = await import("fs");
        const path3 = await import("path");
        const matchesPath = path3.join(process.cwd(), "client/src/data/matches_verified_100.json");
        const matchesData = JSON.parse(fs3.readFileSync(matchesPath, "utf-8"));
        let filteredMatches = matchesData.filter((match) => {
          const comp = (match.competition || "").toLowerCase();
          switch (entry.competition) {
            case "serie-a":
              return comp.includes("serie a");
            case "premier-league":
              return comp.includes("premier league");
            case "la-liga":
              return comp.includes("la liga") || comp.includes("liga");
            case "ligue-1":
              return comp.includes("ligue 1");
            case "bundesliga":
              return comp.includes("bundesliga");
            case "international":
              return comp.includes("world cup") || comp.includes("euro") || comp.includes("international") || comp.includes("mondiali") || comp.includes("europei");
            case "european-cups":
              return comp.includes("champions") || comp.includes("europa") || comp.includes("uefa");
            default:
              return true;
          }
        });
        if (filteredMatches.length === 0) {
          throw new Error(`Nessuna partita disponibile per il campionato ${entry.competition}`);
        }
        const randomMatch = filteredMatches[Math.floor(Math.random() * filteredMatches.length)];
        const matchData = JSON.stringify({ match: randomMatch });
        const challengeResult = await db.insert(asyncChallenges).values({
          challengerId: ctx.user.id,
          opponentId: opponent.userId,
          status: "active",
          competition: entry.competition,
          // Campionato selezionato
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
          lastMoveAt: /* @__PURE__ */ new Date()
        });
        const challengeId = challengeResult[0].insertId;
        await db.update(matchmakingQueue).set({ status: "matched", matchedChallengeId: challengeId }).where(eq3(matchmakingQueue.id, entry.id));
        await db.update(matchmakingQueue).set({ status: "matched", matchedChallengeId: challengeId }).where(eq3(matchmakingQueue.id, opponent.id));
        return { matched: true, challengeId };
      }
      return { matched: false };
    }),
    cancelMatchmaking: protectedProcedure.input(z3.object({
      queueId: z3.number().int().positive()
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }
      await db.update(matchmakingQueue).set({ status: "cancelled" }).where(and2(
        eq3(matchmakingQueue.id, input.queueId),
        eq3(matchmakingQueue.userId, ctx.user.id)
      ));
      return { success: true };
    })
  }),
  // Global and Friends Leaderboards
  rankings: router({
    // Get global leaderboard (top 30 + user position)
    getGlobalLeaderboard: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }
      const topUsers = await db.select({
        id: users.id,
        name: users.name,
        username: users.username,
        eloRating: users.eloRating
      }).from(users).orderBy(desc2(users.eloRating)).limit(30);
      const userRank = await db.select({
        rank: sql2`(SELECT COUNT(*) + 1 FROM users WHERE eloRating > ${ctx.user.eloRating})`,
        eloRating: users.eloRating
      }).from(users).where(eq3(users.id, ctx.user.id)).limit(1);
      return {
        topUsers: topUsers.map((u, index) => ({
          ...u,
          rank: index + 1
        })),
        currentUser: userRank[0] ? {
          id: ctx.user.id,
          name: ctx.user.name,
          eloRating: userRank[0].eloRating,
          rank: userRank[0].rank
        } : null
      };
    }),
    // Get friends leaderboard
    getFriendsLeaderboard: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }
      const friendIds = await db.select({
        friendId: sql2`CASE WHEN userId1 = ${ctx.user.id} THEN userId2 ELSE userId1 END`
      }).from(friendships).where(
        sql2`userId1 = ${ctx.user.id} OR userId2 = ${ctx.user.id}`
      );
      if (friendIds.length === 0) {
        return {
          friendsRanking: [{
            id: ctx.user.id,
            name: ctx.user.name,
            eloRating: ctx.user.eloRating,
            rank: 1
          }]
        };
      }
      const allIds = [ctx.user.id, ...friendIds.map((f) => f.friendId)];
      const friendsRanking = await db.select({
        id: users.id,
        name: users.name,
        username: users.username,
        eloRating: users.eloRating
      }).from(users).where(sql2`id IN (${sql2.join(allIds.map((id) => sql2`${id}`), sql2`, `)})`).orderBy(desc2(users.eloRating));
      return {
        friendsRanking: friendsRanking.map((u, index) => ({
          ...u,
          rank: index + 1
        }))
      };
    })
  }),
  username: router({
    // Controlla disponibilità username
    checkAvailable: publicProcedure.input(z3.object({ username: z3.string().min(1).max(10) })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { available: false };
      const normalized = input.username.trim().toLowerCase();
      const existing = await db.select({ id: users.id }).from(users).where(eq3(users.username, normalized)).limit(1);
      return { available: existing.length === 0 };
    }),
    // Imposta username per la prima volta (onboarding)
    setUsername: protectedProcedure.input(z3.object({ username: z3.string().min(2).max(10).regex(/^[a-zA-Z0-9_]+$/, "Solo lettere, numeri e underscore") })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database non disponibile");
      const normalized = input.username.trim().toLowerCase();
      const existing = await db.select({ id: users.id }).from(users).where(eq3(users.username, normalized)).limit(1);
      if (existing.length > 0) throw new Error("USERNAME_TAKEN");
      await db.update(users).set({ username: normalized }).where(eq3(users.id, ctx.user.id));
      return { success: true, username: normalized };
    }),
    // Richiede cambio username: salva pendingUsername e invia email di conferma
    requestChange: protectedProcedure.input(z3.object({ newUsername: z3.string().min(2).max(10).regex(/^[a-zA-Z0-9_]+$/, "Solo lettere, numeri e underscore") })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database non disponibile");
      const normalized = input.newUsername.trim().toLowerCase();
      const existing = await db.select({ id: users.id }).from(users).where(eq3(users.username, normalized)).limit(1);
      if (existing.length > 0) throw new Error("USERNAME_TAKEN");
      const crypto2 = await import("crypto");
      const token = crypto2.randomBytes(32).toString("hex");
      const expiry = new Date(Date.now() + 24 * 60 * 60 * 1e3);
      await db.update(users).set({
        pendingUsername: normalized,
        usernameChangeToken: token,
        usernameChangeTokenExpiry: expiry
      }).where(eq3(users.id, ctx.user.id));
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
        auth: { user: smtpUser, pass: smtpPass }
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
          `
      });
      return { success: true, email: ctx.user.email };
    }),
    // Conferma cambio username tramite token
    confirmChange: publicProcedure.input(z3.object({ token: z3.string().length(64) })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database non disponibile");
      const result = await db.select().from(users).where(eq3(users.usernameChangeToken, input.token)).limit(1);
      if (result.length === 0) throw new Error("TOKEN_INVALID");
      const user = result[0];
      if (!user.usernameChangeTokenExpiry || user.usernameChangeTokenExpiry < /* @__PURE__ */ new Date()) {
        throw new Error("TOKEN_EXPIRED");
      }
      if (!user.pendingUsername) throw new Error("NO_PENDING_USERNAME");
      const existing = await db.select({ id: users.id }).from(users).where(eq3(users.username, user.pendingUsername)).limit(1);
      if (existing.length > 0 && existing[0].id !== user.id) throw new Error("USERNAME_TAKEN");
      await db.update(users).set({
        username: user.pendingUsername,
        pendingUsername: null,
        usernameChangeToken: null,
        usernameChangeTokenExpiry: null
      }).where(eq3(users.id, user.id));
      return { success: true, username: user.pendingUsername };
    })
  }),
  // Cartoline game
  cartoline: router({
    // Get all progress for current user
    getProgress: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const progress = await db.select().from(cartolinesProgress).where(eq3(cartolinesProgress.userId, ctx.user.id));
      const pointsRow = await db.select().from(cartolinesPoints).where(eq3(cartolinesPoints.userId, ctx.user.id)).limit(1);
      return {
        progress,
        points: pointsRow[0]?.points ?? 0,
        totalEarned: pointsRow[0]?.totalEarned ?? 0
      };
    }),
    // Solve a stadium (correct answer)
    solveStadium: protectedProcedure.input(z3.object({ stadiumId: z3.string().max(100) })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const existing = await db.select().from(cartolinesProgress).where(
        and2(
          eq3(cartolinesProgress.userId, ctx.user.id),
          eq3(cartolinesProgress.stadiumId, input.stadiumId)
        )
      ).limit(1);
      if (existing.length > 0 && existing[0].solved === 1) {
        return { alreadySolved: true, points: 0 };
      }
      if (existing.length > 0) {
        await db.update(cartolinesProgress).set({ solved: 1, solvedAt: /* @__PURE__ */ new Date() }).where(eq3(cartolinesProgress.id, existing[0].id));
      } else {
        await db.insert(cartolinesProgress).values({
          userId: ctx.user.id,
          stadiumId: input.stadiumId,
          solved: 1,
          hintsUsed: JSON.stringify([]),
          solvedAt: /* @__PURE__ */ new Date()
        });
      }
      const pointsRow = await db.select().from(cartolinesPoints).where(eq3(cartolinesPoints.userId, ctx.user.id)).limit(1);
      if (pointsRow.length > 0) {
        await db.update(cartolinesPoints).set({
          points: pointsRow[0].points + 1,
          totalEarned: pointsRow[0].totalEarned + 1
        }).where(eq3(cartolinesPoints.userId, ctx.user.id));
      } else {
        await db.insert(cartolinesPoints).values({
          userId: ctx.user.id,
          points: 1,
          totalEarned: 1
        });
      }
      return { alreadySolved: false, points: 1 };
    }),
    // Use a hint (spend points)
    useHint: protectedProcedure.input(z3.object({
      stadiumId: z3.string().max(100),
      hintType: z3.enum(["nome", "capienza", "anno"])
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const cost = input.hintType === "nome" ? 3 : 1;
      const pointsRow = await db.select().from(cartolinesPoints).where(eq3(cartolinesPoints.userId, ctx.user.id)).limit(1);
      const currentPoints = pointsRow[0]?.points ?? 0;
      if (currentPoints < cost) {
        throw new Error("INSUFFICIENT_POINTS");
      }
      if (pointsRow.length > 0) {
        await db.update(cartolinesPoints).set({ points: currentPoints - cost }).where(eq3(cartolinesPoints.userId, ctx.user.id));
      } else {
        await db.insert(cartolinesPoints).values({
          userId: ctx.user.id,
          points: -cost,
          totalEarned: 0
        });
      }
      const existing = await db.select().from(cartolinesProgress).where(
        and2(
          eq3(cartolinesProgress.userId, ctx.user.id),
          eq3(cartolinesProgress.stadiumId, input.stadiumId)
        )
      ).limit(1);
      if (existing.length > 0) {
        const hints = JSON.parse(existing[0].hintsUsed ?? "[]");
        if (!hints.includes(input.hintType)) hints.push(input.hintType);
        await db.update(cartolinesProgress).set({ hintsUsed: JSON.stringify(hints) }).where(eq3(cartolinesProgress.id, existing[0].id));
      } else {
        await db.insert(cartolinesProgress).values({
          userId: ctx.user.id,
          stadiumId: input.stadiumId,
          solved: 0,
          hintsUsed: JSON.stringify([input.hintType])
        });
      }
      return { success: true, newPoints: currentPoints - cost };
    })
  }),
  // Figurine album (Raccoglitore di Figurine Virtuali)
  figurine: router({
    getProgress: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.execute(sql2.raw(`CREATE TABLE IF NOT EXISTS figurineProgress (id INT AUTO_INCREMENT PRIMARY KEY, userId INT NOT NULL, playerId VARCHAR(100) NOT NULL, solved INT NOT NULL DEFAULT 0, hintsUsed TEXT, solvedAt TIMESTAMP NULL, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`));
      const progress = await db.select().from(figurineProgress).where(eq3(figurineProgress.userId, ctx.user.id));
      const pointsRow = await db.select().from(cartolinesPoints).where(eq3(cartolinesPoints.userId, ctx.user.id)).limit(1);
      return {
        progress,
        points: pointsRow[0]?.points ?? 0,
        totalEarned: pointsRow[0]?.totalEarned ?? 0
      };
    }),
    solvePlayer: protectedProcedure.input(z3.object({ playerId: z3.string().max(100) })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const existing = await db.select().from(figurineProgress).where(
        and2(
          eq3(figurineProgress.userId, ctx.user.id),
          eq3(figurineProgress.playerId, input.playerId)
        )
      ).limit(1);
      if (existing.length > 0 && existing[0].solved === 1) {
        return { alreadySolved: true, points: 0 };
      }
      if (existing.length > 0) {
        await db.update(figurineProgress).set({ solved: 1, solvedAt: /* @__PURE__ */ new Date() }).where(eq3(figurineProgress.id, existing[0].id));
      } else {
        await db.insert(figurineProgress).values({
          userId: ctx.user.id,
          playerId: input.playerId,
          solved: 1,
          hintsUsed: JSON.stringify([]),
          solvedAt: /* @__PURE__ */ new Date()
        });
      }
      const pointsRow = await db.select().from(cartolinesPoints).where(eq3(cartolinesPoints.userId, ctx.user.id)).limit(1);
      if (pointsRow.length > 0) {
        await db.update(cartolinesPoints).set({
          points: pointsRow[0].points + 1,
          totalEarned: pointsRow[0].totalEarned + 1
        }).where(eq3(cartolinesPoints.userId, ctx.user.id));
      } else {
        await db.insert(cartolinesPoints).values({
          userId: ctx.user.id,
          points: 1,
          totalEarned: 1
        });
      }
      return { alreadySolved: false, points: 1 };
    }),
    useHint: protectedProcedure.input(z3.object({
      playerId: z3.string().max(100),
      hintType: z3.enum(["anno_ruolo", "nazionalita_presenze", "iniziali"])
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const cost = input.hintType === "iniziali" ? 3 : 1;
      const pointsRow = await db.select().from(cartolinesPoints).where(eq3(cartolinesPoints.userId, ctx.user.id)).limit(1);
      const currentPoints = pointsRow[0]?.points ?? 0;
      if (currentPoints < cost) {
        throw new Error("INSUFFICIENT_POINTS");
      }
      await db.update(cartolinesPoints).set({ points: currentPoints - cost }).where(eq3(cartolinesPoints.userId, ctx.user.id));
      const existing = await db.select().from(figurineProgress).where(
        and2(
          eq3(figurineProgress.userId, ctx.user.id),
          eq3(figurineProgress.playerId, input.playerId)
        )
      ).limit(1);
      if (existing.length > 0) {
        const hints = JSON.parse(existing[0].hintsUsed ?? "[]");
        if (!hints.includes(input.hintType)) hints.push(input.hintType);
        await db.update(figurineProgress).set({ hintsUsed: JSON.stringify(hints) }).where(eq3(figurineProgress.id, existing[0].id));
      } else {
        await db.insert(figurineProgress).values({
          userId: ctx.user.id,
          playerId: input.playerId,
          solved: 0,
          hintsUsed: JSON.stringify([input.hintType])
        });
      }
      return { success: true, newPoints: currentPoints - cost };
    })
  }),
  // ─── Dream Team Multiplayer ──────────────────────────────────────────────────
  dreamTeam: router({
    // Create a new room
    createRoom: protectedProcedure.input(z3.object({
      displayName: z3.string().min(1).max(50),
      formation: z3.string().max(20).optional()
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let code = "";
      for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
      const [room] = await db.insert(dreamTeamRooms).values({
        code,
        hostUserId: ctx.user.id,
        status: "lobby",
        formation: input.formation || null,
        maxPlayers: 16
      });
      const roomId = room.insertId;
      await db.insert(dreamTeamRoomPlayers).values({
        roomId,
        userId: ctx.user.id,
        displayName: input.displayName,
        isReady: 0
      });
      return { code, roomId };
    }),
    // Join an existing room
    joinRoom: protectedProcedure.input(z3.object({
      code: z3.string().length(6),
      displayName: z3.string().min(1).max(50)
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [room] = await db.select().from(dreamTeamRooms).where(eq3(dreamTeamRooms.code, input.code.toUpperCase()));
      if (!room) throw new Error("Stanza non trovata");
      if (room.status !== "lobby") throw new Error("La stanza non \xE8 pi\xF9 in fase di attesa");
      const players = await db.select().from(dreamTeamRoomPlayers).where(eq3(dreamTeamRoomPlayers.roomId, room.id));
      if (players.length >= room.maxPlayers) throw new Error("Stanza piena");
      const existing = players.find((p) => p.userId === ctx.user.id);
      if (!existing) {
        await db.insert(dreamTeamRoomPlayers).values({
          roomId: room.id,
          userId: ctx.user.id,
          displayName: input.displayName,
          isReady: 0
        });
      }
      return { roomId: room.id, code: room.code };
    }),
    // Get room state (polling)
    getRoom: publicProcedure.input(z3.object({ code: z3.string() })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [room] = await db.select().from(dreamTeamRooms).where(eq3(dreamTeamRooms.code, input.code.toUpperCase()));
      if (!room) return null;
      const players = await db.select({
        id: dreamTeamRoomPlayers.id,
        userId: dreamTeamRoomPlayers.userId,
        displayName: dreamTeamRoomPlayers.displayName,
        isReady: dreamTeamRoomPlayers.isReady,
        teamOverall: dreamTeamRoomPlayers.teamOverall,
        bracketSeed: dreamTeamRoomPlayers.bracketSeed,
        pickData: dreamTeamRoomPlayers.pickData
      }).from(dreamTeamRoomPlayers).where(eq3(dreamTeamRoomPlayers.roomId, room.id));
      return {
        id: room.id,
        code: room.code,
        status: room.status,
        formation: room.formation,
        hostUserId: room.hostUserId,
        maxPlayers: room.maxPlayers,
        tournamentData: room.tournamentData,
        players
      };
    }),
    // Set formation (host only)
    setFormation: protectedProcedure.input(z3.object({ code: z3.string(), formation: z3.string().max(20) })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [room] = await db.select().from(dreamTeamRooms).where(eq3(dreamTeamRooms.code, input.code.toUpperCase()));
      if (!room) throw new Error("Stanza non trovata");
      if (room.hostUserId !== ctx.user.id) throw new Error("Solo l'host pu\xF2 impostare il modulo");
      await db.update(dreamTeamRooms).set({ formation: input.formation }).where(eq3(dreamTeamRooms.id, room.id));
      return { success: true };
    }),
    // Start picking phase (host only) — all players enter picking simultaneously
    startPicking: protectedProcedure.input(z3.object({ code: z3.string(), formation: z3.string().max(20) })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [room] = await db.select().from(dreamTeamRooms).where(eq3(dreamTeamRooms.code, input.code.toUpperCase()));
      if (!room) throw new Error("Stanza non trovata");
      if (room.hostUserId !== ctx.user.id) throw new Error("Solo l'host pu\xF2 avviare il pick");
      if (room.status !== "lobby") throw new Error("La stanza non \xE8 in fase lobby");
      const players = await db.select().from(dreamTeamRoomPlayers).where(eq3(dreamTeamRoomPlayers.roomId, room.id));
      if (players.length < 2) throw new Error("Servono almeno 2 giocatori");
      await db.update(dreamTeamRoomPlayers).set({ isReady: 0 }).where(eq3(dreamTeamRoomPlayers.roomId, room.id));
      await db.update(dreamTeamRooms).set({ status: "picking", formation: input.formation }).where(eq3(dreamTeamRooms.id, room.id));
      return { success: true };
    }),
    // Mark player as ready (pick complete)
    setReady: protectedProcedure.input(z3.object({
      code: z3.string(),
      pickData: z3.string(),
      // JSON
      teamOverall: z3.number().int()
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [room] = await db.select().from(dreamTeamRooms).where(eq3(dreamTeamRooms.code, input.code.toUpperCase()));
      if (!room) throw new Error("Stanza non trovata");
      await db.update(dreamTeamRoomPlayers).set({ isReady: 1, pickData: input.pickData, teamOverall: input.teamOverall }).where(and2(eq3(dreamTeamRoomPlayers.roomId, room.id), eq3(dreamTeamRoomPlayers.userId, ctx.user.id)));
      const players = await db.select().from(dreamTeamRoomPlayers).where(eq3(dreamTeamRoomPlayers.roomId, room.id));
      const allReady = players.length >= 2 && players.every((p) => p.isReady === 1);
      let tournamentDataStr;
      if (allReady) {
        const sorted = [...players].sort((a, b) => (b.teamOverall ?? 0) - (a.teamOverall ?? 0));
        for (let i = 0; i < sorted.length; i++) {
          await db.update(dreamTeamRoomPlayers).set({ bracketSeed: i + 1 }).where(eq3(dreamTeamRoomPlayers.id, sorted[i].id));
        }
        const tournamentData = dtGenerateTournament(
          players.map((p) => ({ userId: p.userId, displayName: p.displayName, teamOverall: p.teamOverall ?? 70, pickData: p.pickData })),
          room.id
        );
        const tournamentKeys = Object.keys(tournamentData);
        console.log(`[DreamTeam] Tournament generated for room ${room.id}: keys=${tournamentKeys.join(",")}, players=${players.map((p) => p.userId).join(",")}`);
        tournamentDataStr = JSON.stringify(tournamentData);
        await db.update(dreamTeamRooms).set({ status: "tournament", tournamentData: tournamentDataStr }).where(eq3(dreamTeamRooms.id, room.id));
      }
      return { success: true, allReady, tournamentData: tournamentDataStr, myUserId: ctx.user.id };
    }),
    // Save tournament result
    saveTournament: protectedProcedure.input(z3.object({
      code: z3.string(),
      tournamentData: z3.string()
      // JSON
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [room] = await db.select().from(dreamTeamRooms).where(eq3(dreamTeamRooms.code, input.code.toUpperCase()));
      if (!room) throw new Error("Stanza non trovata");
      if (room.hostUserId !== ctx.user.id) throw new Error("Solo l'host pu\xF2 salvare il torneo");
      await db.update(dreamTeamRooms).set({ status: "finished", tournamentData: input.tournamentData }).where(eq3(dreamTeamRooms.id, room.id));
      return { success: true };
    }),
    // Leave room
    leaveRoom: protectedProcedure.input(z3.object({ code: z3.string() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [room] = await db.select().from(dreamTeamRooms).where(eq3(dreamTeamRooms.code, input.code.toUpperCase()));
      if (!room) return { success: true };
      await db.delete(dreamTeamRoomPlayers).where(and2(eq3(dreamTeamRoomPlayers.roomId, room.id), eq3(dreamTeamRoomPlayers.userId, ctx.user.id)));
      return { success: true };
    }),
    // Segnala errore nella rosa di una squadra
    reportError: publicProcedure.input(z3.object({
      teamName: z3.string(),
      season: z3.string(),
      description: z3.string().min(3).max(1e3)
    })).mutation(async ({ input }) => {
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
          auth: { user: smtpUser, pass: smtpPass }
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
          text: body
        });
        console.log(`[DreamTeam] Error report sent for ${input.teamName} ${input.season}`);
        return { success: true };
      } catch (error) {
        console.error("[DreamTeam] Failed to send error report:", error);
        return { success: false };
      }
    })
  })
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/vercel-entry.ts
var app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
registerOAuthRoutes(app);
registerImageProxyRoutes(app);
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext
  })
);
var vercel_entry_default = app;
export {
  vercel_entry_default as default
};
