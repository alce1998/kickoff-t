import { describe, it, expect } from 'vitest';

describe('Challenge Timer System - Frontend Logic', () => {
  it('dovrebbe decrementare il tempo locale ogni secondo', () => {
    // Simula il comportamento del countdown locale nel frontend
    let localTime = 600; // 10 minuti
    
    // Simula 5 secondi di countdown
    for (let i = 0; i < 5; i++) {
      if (localTime > 0) {
        localTime -= 1;
      }
    }
    
    expect(localTime).toBe(595);
  });

  it('dovrebbe fermarsi a 0 quando il tempo scade', () => {
    let localTime = 2;
    
    // Simula 5 secondi di countdown (ma si ferma a 0)
    for (let i = 0; i < 5; i++) {
      if (localTime > 0) {
        localTime -= 1;
      }
    }
    
    expect(localTime).toBe(0);
  });

  it('dovrebbe formattare correttamente il tempo in mm:ss', () => {
    const formatTime = (seconds: number): string => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    
    expect(formatTime(600)).toBe('10:00');
    expect(formatTime(595)).toBe('9:55');
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(5)).toBe('0:05');
    expect(formatTime(0)).toBe('0:00');
  });

  it('dovrebbe identificare correttamente quando il tempo è scaduto', () => {
    const isTimeExpired = (time: number | null): boolean => {
      return time !== null && time <= 0;
    };
    
    expect(isTimeExpired(0)).toBe(true);
    expect(isTimeExpired(-1)).toBe(true);
    expect(isTimeExpired(1)).toBe(false);
    expect(isTimeExpired(null)).toBe(false);
  });

  it('dovrebbe decrementare solo il tempo del giocatore di turno', () => {
    let myTime = 600;
    let opponentTime = 600;
    let isMyTurn = true;
    
    // Simula 5 secondi quando è il mio turno
    for (let i = 0; i < 5; i++) {
      if (isMyTurn && myTime > 0) {
        myTime -= 1;
      } else if (!isMyTurn && opponentTime > 0) {
        opponentTime -= 1;
      }
    }
    
    expect(myTime).toBe(595);
    expect(opponentTime).toBe(600); // Non cambiato
    
    // Cambia turno
    isMyTurn = false;
    
    // Simula altri 3 secondi quando è il turno dell'avversario
    for (let i = 0; i < 3; i++) {
      if (isMyTurn && myTime > 0) {
        myTime -= 1;
      } else if (!isMyTurn && opponentTime > 0) {
        opponentTime -= 1;
      }
    }
    
    expect(myTime).toBe(595); // Non cambiato
    expect(opponentTime).toBe(597); // Decrementato
  });
});
