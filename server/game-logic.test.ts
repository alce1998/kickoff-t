import { describe, it, expect } from 'vitest';
import { checkAnswerWithScore } from '../client/src/lib/game-logic';

describe('checkAnswerWithScore - Validazione Nomi', () => {
  it('should match exact surname with score 0', () => {
    const result = checkAnswerWithScore('Zanetti', 'Javier Zanetti');
    expect(result.matches).toBe(true);
    expect(result.score).toBe(0); // Match esatto
  });
  
  it('should match both homonyms with score 0', () => {
    // Omonimi: Cristiano Zanetti e Javier Zanetti
    const result1 = checkAnswerWithScore('Zanetti', 'Cristiano Zanetti');
    const result2 = checkAnswerWithScore('Zanetti', 'Javier Zanetti');
    
    expect(result1.matches).toBe(true);
    expect(result1.score).toBe(0); // Match esatto
    expect(result2.matches).toBe(true);
    expect(result2.score).toBe(0); // Match esatto
  });
  
  it('should match Mauri exactly with score 0', () => {
    const result = checkAnswerWithScore('Mauri', 'Stefano Mauri');
    expect(result.matches).toBe(true);
    expect(result.score).toBe(0); // Match esatto
  });
  
  it('should match Zauri with fuzzy match (score 1) when input is Mauri', () => {
    const result = checkAnswerWithScore('Mauri', 'Luciano Zauri');
    expect(result.matches).toBe(true);
    expect(result.score).toBe(1); // Match fuzzy (1 errore)
  });
  
  it('should prefer exact match over fuzzy match', () => {
    // Se ci sono sia Mauri che Zauri, "Mauri" deve matchare solo Mauri (score 0)
    const mauriResult = checkAnswerWithScore('Mauri', 'Stefano Mauri');
    const zauriResult = checkAnswerWithScore('Mauri', 'Luciano Zauri');
    
    expect(mauriResult.score).toBe(0); // Esatto
    expect(zauriResult.score).toBe(1); // Fuzzy
    expect(mauriResult.score).toBeLessThan(zauriResult.score); // Mauri ha priorità
  });
  
  it('should match Zauri exactly when only Zauri exists', () => {
    const result = checkAnswerWithScore('Zauri', 'Luciano Zauri');
    expect(result.matches).toBe(true);
    expect(result.score).toBe(0); // Match esatto
  });
  
  it('should not match if input is too short', () => {
    const result = checkAnswerWithScore('Ma', 'Stefano Mauri');
    expect(result.matches).toBe(false);
    expect(result.score).toBe(999);
  });
  
  it('should handle typos with score 1', () => {
    // "Maldini" con 1 typo → "Moldini"
    const result = checkAnswerWithScore('Moldini', 'Paolo Maldini');
    expect(result.matches).toBe(true);
    expect(result.score).toBe(1); // Fuzzy match
  });
  
  it('should reject if distance is > 1', () => {
    // "Maldini" con 2 typo → "Moldani"
    const result = checkAnswerWithScore('Moldani', 'Paolo Maldini');
    expect(result.matches).toBe(false);
    expect(result.score).toBe(999);
  });
});
