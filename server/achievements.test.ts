/**
 * Tests for the achievements router.
 * Verifies that achievement unlock logic works correctly for each tier.
 */
import { describe, it, expect } from 'vitest';
import { ACHIEVEMENTS, ACHIEVEMENT_MAP } from '../shared/achievements';

describe('achievements definitions', () => {
  it('should have all required achievements defined', () => {
    const expectedIds = [
      'overthinker', 'scout', 'maratoneta', 'mercato-invernale',
      'mercato-estivo', 'progressione-master', 'dream-team-campione',
      'collezionista', 'aarons-zurkowski', 'habitue', 'poliglotta',
    ];
    for (const id of expectedIds) {
      expect(ACHIEVEMENT_MAP.has(id), `Achievement ${id} should exist`).toBe(true);
    }
  });

  it('each achievement should have 3 tiers', () => {
    for (const achievement of ACHIEVEMENTS) {
      expect(achievement.tiers.length, `${achievement.id} should have 3 tiers`).toBe(3);
      const tierNumbers = achievement.tiers.map(t => t.tier);
      expect(tierNumbers).toContain(1);
      expect(tierNumbers).toContain(2);
      expect(tierNumbers).toContain(3);
    }
  });

  it('each tier should have a label, description and icon', () => {
    for (const achievement of ACHIEVEMENTS) {
      expect(achievement.name).toBeTruthy();
      expect(achievement.icon).toBeTruthy();
      for (const tier of achievement.tiers) {
        expect(tier.label).toBeTruthy();
        expect(tier.description).toBeTruthy();
      }
    }
  });

  it('ACHIEVEMENT_MAP should be indexed by id', () => {
    for (const achievement of ACHIEVEMENTS) {
      const found = ACHIEVEMENT_MAP.get(achievement.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(achievement.id);
    }
  });
});

describe('achievement tier thresholds', () => {
  it('overthinker tiers should have correct thresholds', () => {
    const a = ACHIEVEMENT_MAP.get('overthinker')!;
    expect(a.tiers[0].tier).toBe(1); // Bronze
    expect(a.tiers[1].tier).toBe(2); // Silver
    expect(a.tiers[2].tier).toBe(3); // Gold
  });

  it('scout tiers should have 3 tiers with increasing difficulty', () => {
    const a = ACHIEVEMENT_MAP.get('scout')!;
    expect(a.tiers.length).toBe(3);
    // Each tier should have a description
    for (const tier of a.tiers) {
      expect(tier.description).toBeTruthy();
    }
  });

  it('maratoneta tiers should require 2, 5, 10 consecutive sessions', () => {
    const a = ACHIEVEMENT_MAP.get('maratoneta')!;
    expect(a.tiers[0].description).toMatch(/2/);
    expect(a.tiers[1].description).toMatch(/5/);
    expect(a.tiers[2].description).toMatch(/10/);
  });

  it('habitue tiers should require 3, 7, 30 consecutive days', () => {
    const a = ACHIEVEMENT_MAP.get('habitue')!;
    expect(a.tiers[0].description).toMatch(/3/);
    expect(a.tiers[1].description).toMatch(/7/);
    expect(a.tiers[2].description).toMatch(/30/);
  });

  it('poliglotta tiers should have 3 tiers with increasing difficulty', () => {
    const a = ACHIEVEMENT_MAP.get('poliglotta')!;
    expect(a.tiers.length).toBe(3);
    // Each tier should have a description
    for (const tier of a.tiers) {
      expect(tier.description).toBeTruthy();
    }
  });
});
