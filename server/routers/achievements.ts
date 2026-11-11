import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { userAchievements, userStats } from "../../drizzle/schema";
import { ACHIEVEMENTS, ACHIEVEMENT_MAP } from "../../shared/achievements";

export const achievementsRouter = router({
  /**
   * Get all achievements for the current user (with their unlocked tiers).
   */
  getMyAchievements: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { achievements: ACHIEVEMENTS, unlocked: [] };

    const unlocked = await db
      .select()
      .from(userAchievements)
      .where(eq(userAchievements.userId, ctx.user.id))
      .orderBy(desc(userAchievements.unlockedAt));

    return { achievements: ACHIEVEMENTS, unlocked };
  }),

  /**
   * Get achievements for a specific user (public profile).
   */
  getUserAchievements: publicProcedure
    .input(z.object({ userId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { achievements: ACHIEVEMENTS, unlocked: [] };

      const unlocked = await db
        .select()
        .from(userAchievements)
        .where(eq(userAchievements.userId, input.userId))
        .orderBy(desc(userAchievements.unlockedAt));

      return { achievements: ACHIEVEMENTS, unlocked };
    }),

  /**
   * Unlock an achievement tier for the current user.
   * Called from game pages when an objective is reached.
   * Idempotent: if already unlocked at this tier or higher, no-op.
   */
  unlock: protectedProcedure
    .input(
      z.object({
        achievementId: z.string(),
        tier: z.number().int().min(1).max(3),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const achievement = ACHIEVEMENT_MAP.get(input.achievementId);
      if (!achievement) throw new Error(`Unknown achievement: ${input.achievementId}`);

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Check if already unlocked at this tier or higher
      const existing = await db
        .select()
        .from(userAchievements)
        .where(
          and(
            eq(userAchievements.userId, ctx.user.id),
            eq(userAchievements.achievementId, input.achievementId),
            eq(userAchievements.tier, input.tier)
          )
        );

      if (existing.length > 0) {
        return { alreadyUnlocked: true, achievementId: input.achievementId, tier: input.tier };
      }

      // Insert new unlock
      await db.insert(userAchievements).values({
        userId: ctx.user.id,
        achievementId: input.achievementId,
        tier: input.tier,
      });

      return { alreadyUnlocked: false, achievementId: input.achievementId, tier: input.tier };
    }),

  /**
   * Bulk-check and unlock multiple achievements at once.
   * Returns newly unlocked achievements (for toast notifications).
   */
  checkAndUnlock: protectedProcedure
    .input(
      z.array(
        z.object({
          achievementId: z.string(),
          tier: z.number().int().min(1).max(3),
        })
      )
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { newlyUnlocked: [] };

      // Get all existing unlocks for this user
      const existing = await db
        .select()
        .from(userAchievements)
        .where(eq(userAchievements.userId, ctx.user.id));

      const existingSet = new Set(
        existing.map((u) => `${u.achievementId}:${u.tier}`)
      );

      const newlyUnlocked: { achievementId: string; tier: number }[] = [];

      for (const item of input) {
        const key = `${item.achievementId}:${item.tier}`;
        if (existingSet.has(key)) continue;
        if (!ACHIEVEMENT_MAP.has(item.achievementId)) continue;

        await db.insert(userAchievements).values({
          userId: ctx.user.id,
          achievementId: item.achievementId,
          tier: item.tier,
        });

        newlyUnlocked.push(item);
        existingSet.add(key); // prevent duplicates within same call
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

    // Increment ranked matches counter in userStats
    await db
      .insert(userStats)
      .values({ userId: ctx.user.id, rankedMatchesPlayed: 1, gamesPlayedSet: '[]' })
      .onDuplicateKeyUpdate({
        set: { rankedMatchesPlayed: sql`ranked_matches_played + 1` },
      });

    const [stat] = await db
      .select()
      .from(userStats)
      .where(eq(userStats.userId, ctx.user.id));

    const count = stat?.rankedMatchesPlayed ?? 0;
    const candidates: { achievementId: string; tier: 1 | 2 | 3 }[] = [];
    if (count >= 1) candidates.push({ achievementId: 'scout', tier: 1 });
    if (count >= 10) candidates.push({ achievementId: 'scout', tier: 2 });
    if (count >= 50) candidates.push({ achievementId: 'scout', tier: 3 });

    if (candidates.length === 0) return { newlyUnlocked: [] };

    const existing = await db
      .select()
      .from(userAchievements)
      .where(eq(userAchievements.userId, ctx.user.id));
    const existingSet = new Set(existing.map((u) => `${u.achievementId}:${u.tier}`));

    const newlyUnlocked: { achievementId: string; tier: number }[] = [];
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

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();

    const [stat] = await db
      .select()
      .from(userStats)
      .where(eq(userStats.userId, ctx.user.id));

    const lastLoginMs = stat?.lastLoginDate ?? 0;
    const streak = stat?.loginStreak ?? 0;
    const lastLoginDay = new Date(lastLoginMs);
    lastLoginDay.setHours(0, 0, 0, 0);
    const diffDays = Math.round((todayMs - lastLoginDay.getTime()) / 86400000);

    let newStreak = streak;
    if (diffDays === 1) {
      newStreak = streak + 1; // consecutive day
    } else if (diffDays > 1) {
      newStreak = 1; // streak broken
    } else {
      // Same day, no update needed
      return { newlyUnlocked: [] };
    }

    await db
      .insert(userStats)
      .values({ userId: ctx.user.id, loginStreak: newStreak, lastLoginDate: todayMs, gamesPlayedSet: '[]' })
      .onDuplicateKeyUpdate({ set: { loginStreak: newStreak, lastLoginDate: todayMs } });

    const candidates: { achievementId: string; tier: 1 | 2 | 3 }[] = [];
    if (newStreak >= 3) candidates.push({ achievementId: 'habitue', tier: 1 });
    if (newStreak >= 7) candidates.push({ achievementId: 'habitue', tier: 2 });
    if (newStreak >= 30) candidates.push({ achievementId: 'habitue', tier: 3 });

    if (candidates.length === 0) return { newlyUnlocked: [] };

    const existing = await db
      .select()
      .from(userAchievements)
      .where(eq(userAchievements.userId, ctx.user.id));
    const existingSet = new Set(existing.map((u) => `${u.achievementId}:${u.tier}`));

    const newlyUnlocked: { achievementId: string; tier: number }[] = [];
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
  recordGamePlayed: protectedProcedure
    .input(z.object({ gameType: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { newlyUnlocked: [] };

      const validGames = ['formazioni', 'carriera', 'link', 'progressione', 'cartoline', 'aarons-zurkowski', 'dream-team', 'sfida'];
      if (!validGames.includes(input.gameType)) return { newlyUnlocked: [] };

      const [stat] = await db
        .select()
        .from(userStats)
        .where(eq(userStats.userId, ctx.user.id));

      const gamesPlayed: string[] = JSON.parse(stat?.gamesPlayedSet || '[]');
      if (!gamesPlayed.includes(input.gameType)) {
        gamesPlayed.push(input.gameType);
      }
      const gamesPlayedJson = JSON.stringify(gamesPlayed);

      await db
        .insert(userStats)
        .values({ userId: ctx.user.id, gamesPlayedSet: gamesPlayedJson })
        .onDuplicateKeyUpdate({ set: { gamesPlayedSet: gamesPlayedJson } });

      const count = gamesPlayed.length;
      const candidates: { achievementId: string; tier: 1 | 2 | 3 }[] = [];
      if (count >= 3) candidates.push({ achievementId: 'poliglotta', tier: 1 });
      if (count >= 5) candidates.push({ achievementId: 'poliglotta', tier: 2 });
      if (count >= 8) candidates.push({ achievementId: 'poliglotta', tier: 3 });

      if (candidates.length === 0) return { newlyUnlocked: [] };

      const existing = await db
        .select()
        .from(userAchievements)
        .where(eq(userAchievements.userId, ctx.user.id));
      const existingSet = new Set(existing.map((u) => `${u.achievementId}:${u.tier}`));

      const newlyUnlocked: { achievementId: string; tier: number }[] = [];
      for (const item of candidates) {
        const key = `${item.achievementId}:${item.tier}`;
        if (existingSet.has(key)) continue;
        await db.insert(userAchievements).values({ userId: ctx.user.id, achievementId: item.achievementId, tier: item.tier });
        newlyUnlocked.push(item);
        existingSet.add(key);
      }
      return { newlyUnlocked };
    }),
});
