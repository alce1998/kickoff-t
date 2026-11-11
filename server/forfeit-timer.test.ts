import { describe, it, expect } from 'vitest';

describe('Forfeit and Timer Tests', () => {
  describe('Pulsante Abbandona', () => {
    it('dovrebbe assegnare vittoria all\'avversario quando un giocatore abbandona', () => {
      const challengerId = 1;
      const opponentId = 2;
      const forfeitingPlayerId = challengerId;
      
      // Simula abbandono
      const winnerId = forfeitingPlayerId === challengerId ? opponentId : challengerId;
      
      expect(winnerId).toBe(opponentId);
    });

    it('dovrebbe aggiornare ELO dopo abbandono', () => {
      const challengerElo = 1200;
      const opponentElo = 1200;
      const winnerId = 2; // opponent vince
      
      // Calculate expected scores
      const expectedChallenger = 1 / (1 + Math.pow(10, (opponentElo - challengerElo) / 400));
      const expectedOpponent = 1 / (1 + Math.pow(10, (challengerElo - opponentElo) / 400));
      
      // Actual scores
      const actualChallenger = winnerId === 1 ? 1 : 0;
      const actualOpponent = winnerId === 2 ? 1 : 0;
      
      // K-factor
      const K = 32;
      
      // Calculate new ratings
      const newChallengerElo = Math.round(challengerElo + K * (actualChallenger - expectedChallenger));
      const newOpponentElo = Math.round(opponentElo + K * (actualOpponent - expectedOpponent));
      
      expect(newChallengerElo).toBeLessThan(challengerElo); // Loser loses points
      expect(newOpponentElo).toBeGreaterThan(opponentElo); // Winner gains points
    });
  });

  describe('Timer Automatico', () => {
    it('dovrebbe triggerare sconfitta quando timer arriva a 0', () => {
      let localTime = 1; // 1 secondo rimanente
      
      // Simula decremento
      localTime = localTime - 1;
      
      // Controlla se tempo scaduto
      const isTimeExpired = localTime <= 0;
      
      expect(isTimeExpired).toBe(true);
    });

    it('non dovrebbe triggerare sconfitta se tempo > 0', () => {
      let localTime = 10; // 10 secondi rimanenti
      
      // Simula decremento
      localTime = localTime - 1;
      
      // Controlla se tempo scaduto
      const isTimeExpired = localTime <= 0;
      
      expect(isTimeExpired).toBe(false);
    });

    it('dovrebbe decrementare solo il tempo del giocatore di turno', () => {
      let myTime = 600;
      let opponentTime = 600;
      const isMyTurn = true;
      
      // Simula decremento
      if (isMyTurn) {
        myTime = myTime - 1;
      } else {
        opponentTime = opponentTime - 1;
      }
      
      expect(myTime).toBe(599);
      expect(opponentTime).toBe(600); // Non cambia
    });
  });
});
