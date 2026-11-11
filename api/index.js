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
import fs from "fs";
import path from "path";
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
    const dbPath = path.join(process.cwd(), "client", "public", "dreamteam_db.d7d8b7b0.json");
    const raw = fs.readFileSync(dbPath, "utf-8");
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
        const fs2 = await import("fs");
        const path2 = await import("path");
        const matchesPath = path2.join(process.cwd(), "client/src/data/matches_verified_100.json");
        const matchesData = JSON.parse(fs2.readFileSync(matchesPath, "utf-8"));
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
