import { describe, it, expect } from 'vitest';

/**
 * Test per il sistema ELO
 * Verifica che il calcolo del rating ELO funzioni correttamente
 */

describe('Sistema ELO', () => {
  it('dovrebbe calcolare correttamente il nuovo rating ELO per una vittoria', () => {
    // Setup: giocatore con ELO 1200 vince contro giocatore con ELO 1200
    const playerElo = 1200;
    const opponentElo = 1200;
    const K = 32;
    
    // Calcola probabilità attesa
    const expected = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
    expect(expected).toBe(0.5); // Probabilità 50% per rating uguali
    
    // Calcola nuovo rating (vittoria = 1)
    const result = 1;
    const newElo = Math.round(playerElo + K * (result - expected));
    
    // Verifica: vincendo contro avversario uguale, guadagna 16 punti
    expect(newElo).toBe(1216);
  });
  
  it('dovrebbe calcolare correttamente il nuovo rating ELO per una sconfitta', () => {
    // Setup: giocatore con ELO 1200 perde contro giocatore con ELO 1200
    const playerElo = 1200;
    const opponentElo = 1200;
    const K = 32;
    
    // Calcola probabilità attesa
    const expected = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
    
    // Calcola nuovo rating (sconfitta = 0)
    const result = 0;
    const newElo = Math.round(playerElo + K * (result - expected));
    
    // Verifica: perdendo contro avversario uguale, perde 16 punti
    expect(newElo).toBe(1184);
  });
  
  it('dovrebbe calcolare correttamente il nuovo rating ELO per un pareggio', () => {
    // Setup: giocatore con ELO 1200 pareggia contro giocatore con ELO 1200
    const playerElo = 1200;
    const opponentElo = 1200;
    const K = 32;
    
    // Calcola probabilità attesa
    const expected = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
    
    // Calcola nuovo rating (pareggio = 0.5)
    const result = 0.5;
    const newElo = Math.round(playerElo + K * (result - expected));
    
    // Verifica: pareggiando contro avversario uguale, rating rimane invariato
    expect(newElo).toBe(1200);
  });
  
  it('dovrebbe dare più punti vincendo contro avversario più forte', () => {
    // Setup: giocatore con ELO 1200 vince contro giocatore con ELO 1400
    const playerElo = 1200;
    const opponentElo = 1400;
    const K = 32;
    
    // Calcola probabilità attesa
    const expected = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
    
    // Calcola nuovo rating (vittoria = 1)
    const result = 1;
    const newElo = Math.round(playerElo + K * (result - expected));
    
    // Verifica: vincendo contro avversario più forte, guadagna più di 16 punti
    expect(newElo).toBeGreaterThan(1216);
    expect(newElo).toBe(1224); // Circa 24 punti
  });
  
  it('dovrebbe togliere meno punti perdendo contro avversario più forte', () => {
    // Setup: giocatore con ELO 1200 perde contro giocatore con ELO 1400
    const playerElo = 1200;
    const opponentElo = 1400;
    const K = 32;
    
    // Calcola probabilità attesa
    const expected = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
    
    // Calcola nuovo rating (sconfitta = 0)
    const result = 0;
    const newElo = Math.round(playerElo + K * (result - expected));
    
    // Verifica: perdendo contro avversario più forte, perde meno di 16 punti
    expect(newElo).toBeGreaterThan(1184);
    expect(newElo).toBe(1192); // Circa 8 punti
  });
});
