import { describe, it, expect } from 'vitest';
import { appRouter } from './routers';
import { getDb } from './db';
import { leaderboard } from '../drizzle/schema';
import { eq, and } from 'drizzle-orm';

describe('Leaderboard System', () => {
  it('should save a Link game score', async () => {
    const caller = appRouter.createCaller({
      req: {} as any,
      res: {} as any,
      user: null,
    });

    const result = await caller.leaderboard.save({
      gameType: 'link',
      playerName: 'Test Player',
      timeSeconds: 120,
      competition: 'serie-a',
      difficulty: 'easy',
    });

    expect(result.success).toBe(true);
    expect(result.id).toBeTypeOf('number');
  });

  it('should save a Progressione game score', async () => {
    const caller = appRouter.createCaller({
      req: {} as any,
      res: {} as any,
      user: null,
    });

    const result = await caller.leaderboard.save({
      gameType: 'progressione',
      playerName: 'Test Player 2',
      timeSeconds: 180,
      competition: 'premier-league',
      difficulty: 'height',
    });

    expect(result.success).toBe(true);
    expect(result.id).toBeTypeOf('number');
  });

  it('should retrieve top scores for Link game', async () => {
    const caller = appRouter.createCaller({
      req: {} as any,
      res: {} as any,
      user: null,
    });

    // Save multiple scores
    await caller.leaderboard.save({
      gameType: 'link',
      playerName: 'Fast Player',
      timeSeconds: 90,
      competition: 'serie-a',
      difficulty: 'easy',
    });

    await caller.leaderboard.save({
      gameType: 'link',
      playerName: 'Slow Player',
      timeSeconds: 200,
      competition: 'serie-a',
      difficulty: 'easy',
    });

    // Get top scores
    const results = await caller.leaderboard.getTop({
      gameType: 'link',
      competition: 'serie-a',
      difficulty: 'easy',
      limit: 10,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].timeSeconds).toBeLessThanOrEqual(results[results.length - 1].timeSeconds);
  });

  it('should filter scores by competition and difficulty', async () => {
    const caller = appRouter.createCaller({
      req: {} as any,
      res: {} as any,
      user: null,
    });

    // Save score for Serie A easy
    await caller.leaderboard.save({
      gameType: 'link',
      playerName: 'Serie A Player',
      timeSeconds: 100,
      competition: 'serie-a',
      difficulty: 'easy',
    });

    // Save score for Premier League hard
    await caller.leaderboard.save({
      gameType: 'link',
      playerName: 'Premier Player',
      timeSeconds: 150,
      competition: 'premier-league',
      difficulty: 'hard',
    });

    // Get Serie A easy scores
    const serieAResults = await caller.leaderboard.getTop({
      gameType: 'link',
      competition: 'serie-a',
      difficulty: 'easy',
      limit: 10,
    });

    // Get Premier League hard scores
    const premierResults = await caller.leaderboard.getTop({
      gameType: 'link',
      competition: 'premier-league',
      difficulty: 'hard',
      limit: 10,
    });

    // Verify filtering
    expect(serieAResults.every(r => r.competition === 'serie-a' && r.difficulty === 'easy')).toBe(true);
    expect(premierResults.every(r => r.competition === 'premier-league' && r.difficulty === 'hard')).toBe(true);
  });
});
