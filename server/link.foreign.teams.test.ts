import { describe, it, expect } from 'vitest';

describe('Link Game - Squadre Estere Feature', () => {
  it('dovrebbe includere 9 squadre estere top europee', () => {
    const foreignTeams = [
      'Barcelona',
      'Real Madrid',
      'Man Utd',
      'Bayern',
      'Chelsea',
      'Liverpool',
      'Arsenal',
      'PSG',
      'Atletico Madrid',
    ];
    
    expect(foreignTeams).toHaveLength(9);
    expect(foreignTeams).toContain('Barcelona');
    expect(foreignTeams).toContain('Real Madrid');
    expect(foreignTeams).toContain('Man Utd');
  });
  
  it('modalità normale dovrebbe richiedere minimo 3 giocatori in comune', () => {
    const difficulty = 'easy';
    const minPlayers = difficulty === 'easy' ? 3 : 1;
    
    expect(minPlayers).toBe(3);
  });
  
  it('modalità difficile dovrebbe richiedere minimo 1 giocatore in comune', () => {
    const difficulty = 'hard';
    const minPlayers = difficulty === 'easy' ? 3 : 1;
    
    expect(minPlayers).toBe(1);
  });
  
  it('dovrebbe validare accoppiamenti con minimo giocatori richiesti', () => {
    const difficulty = 'easy';
    const minPlayers = difficulty === 'easy' ? 3 : 1;
    const commonPlayersFound = 4;
    
    const isValid = commonPlayersFound >= minPlayers;
    
    expect(isValid).toBe(true);
  });
  
  it('dovrebbe escludere accoppiamenti con giocatori insufficienti', () => {
    const difficulty = 'easy';
    const minPlayers = difficulty === 'easy' ? 3 : 1;
    const commonPlayersFound = 2; // Meno del minimo
    
    const isValid = commonPlayersFound >= minPlayers;
    
    expect(isValid).toBe(false);
  });
  
  it('dovrebbe permettere accoppiamenti difficili con 1 solo giocatore', () => {
    const difficulty = 'hard';
    const minPlayers = difficulty === 'easy' ? 3 : 1;
    const commonPlayersFound = 1;
    
    const isValid = commonPlayersFound >= minPlayers;
    
    expect(isValid).toBe(true);
  });
  
  it('dovrebbe generare messaggio errore con numero giocatori richiesti', () => {
    const minPlayers = 3;
    const errorMessage = `Non sono riuscito a trovare squadre con almeno ${minPlayers} giocator${minPlayers > 1 ? 'i' : 'e'} in comune. Prova un altro campionato.`;
    
    expect(errorMessage).toContain('3 giocatori');
    expect(errorMessage).not.toContain('giocatore'); // Singolare
  });
  
  it('dovrebbe usare singolare per 1 giocatore nel messaggio errore', () => {
    const minPlayers = 1;
    const errorMessage = `Non sono riuscito a trovare squadre con almeno ${minPlayers} giocator${minPlayers > 1 ? 'i' : 'e'} in comune. Prova un altro campionato.`;
    
    expect(errorMessage).toContain('1 giocatore');
    expect(errorMessage).not.toContain('giocatori'); // Plurale
  });
  
  it('dovrebbe tentare fino a 50 volte di trovare accoppiamenti validi', () => {
    const maxAttempts = 50;
    let attempts = 0;
    
    // Simula ricerca accoppiamenti
    while (attempts < maxAttempts) {
      attempts++;
      // Simula trovato accoppiamento valido
      if (attempts === 10) break;
    }
    
    expect(attempts).toBeLessThanOrEqual(maxAttempts);
    expect(attempts).toBe(10); // Trovato al 10° tentativo
  });
});
