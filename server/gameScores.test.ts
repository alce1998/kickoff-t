import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { gameScores, users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("gameScores router", () => {
  let testUserId: number;
  let testContext: { user: { id: number; name: string; email: string; role: "user" | "admin" } };

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create a test user
    const result = await db.insert(users).values({
      openId: `test-${Date.now()}`,
      name: "Test User",
      email: "test@example.com",
      role: "user",
    });
    testUserId = result[0].insertId;

    testContext = {
      user: {
        id: testUserId,
        name: "Test User",
        email: "test@example.com",
        role: "user",
      },
    };
  });

  it("should save a game score", async () => {
    const caller = appRouter.createCaller(testContext);

    const result = await caller.gameScores.saveScore({
      gameType: "link",
      score: 10,
      timeSeconds: 120,
      competition: "serie-a",
      difficulty: "easy",
    });

    expect(result.success).toBe(true);
    expect(result.id).toBeGreaterThan(0);
  });

  it("should retrieve user scores", async () => {
    const caller = appRouter.createCaller(testContext);

    // Save a score first
    await caller.gameScores.saveScore({
      gameType: "link",
      score: 15,
      timeSeconds: 90,
      competition: "serie-a",
      difficulty: "hard",
    });

    const scores = await caller.gameScores.getUserScores({
      gameType: "link",
      limit: 10,
    });

    expect(scores.length).toBeGreaterThan(0);
    expect(scores[0].userId).toBe(testUserId);
    expect(scores[0].gameType).toBe("link");
  });

  it("should calculate user stats correctly", async () => {
    const caller = appRouter.createCaller(testContext);

    // Save multiple scores
    await caller.gameScores.saveScore({
      gameType: "progressione",
      score: 5,
      timeSeconds: 60,
    });
    await caller.gameScores.saveScore({
      gameType: "progressione",
      score: 8,
      timeSeconds: 45,
    });

    const stats = await caller.gameScores.getUserStats();

    expect(stats.totalGames).toBeGreaterThan(0);
    expect(stats.statsByGame.progressione).toBeDefined();
    expect(stats.statsByGame.progressione.totalGames).toBeGreaterThanOrEqual(2);
    expect(stats.statsByGame.progressione.bestScore).toBe(8);
    expect(stats.statsByGame.progressione.bestTime).toBe(45);
  });

  it("should filter scores by game type", async () => {
    const caller = appRouter.createCaller(testContext);

    const linkScores = await caller.gameScores.getUserScores({
      gameType: "link",
      limit: 10,
    });

    const allLink = linkScores.every(s => s.gameType === "link");
    expect(allLink).toBe(true);
  });
});
