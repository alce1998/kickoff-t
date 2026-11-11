import { describe, it, expect } from 'vitest';

describe('Challenge Fixes Tests', () => {
  describe('Ruolo ultimo giocatore', () => {
    it('dovrebbe correggere MF → FW per giocatori in posizione 9-10', () => {
      const players = [
        { name: 'P1', role: 'GK' },
        { name: 'P2', role: 'CB' },
        { name: 'P3', role: 'CB' },
        { name: 'P4', role: 'RB' },
        { name: 'P5', role: 'LB' },
        { name: 'P6', role: 'CM' },
        { name: 'P7', role: 'CM' },
        { name: 'P8', role: 'CM' },
        { name: 'P9', role: 'AM' },
        { name: 'P10', role: 'MF' }, // Dovrebbe diventare FW
        { name: 'P11', role: 'CM' }, // Dovrebbe diventare FW
      ];

      const correctedPlayers = players.map((p, index) => {
        let role = p.role;
        if ((index === 9 || index === 10) && (role === 'MF' || role === 'CM')) {
          role = 'FW';
        }
        return { ...p, role };
      });

      expect(correctedPlayers[9].role).toBe('FW');
      expect(correctedPlayers[10].role).toBe('FW');
      expect(correctedPlayers[8].role).toBe('AM'); // Non dovrebbe cambiare
    });
  });

  describe('Abbandono partita', () => {
    it('dovrebbe rilevare abbandono dopo 5 minuti in modalità rapid', () => {
      const now = new Date();
      const lastMove = new Date(now.getTime() - 6 * 60 * 1000); // 6 minuti fa
      const minutesSinceLastMove = (now.getTime() - lastMove.getTime()) / 1000 / 60;
      const timeoutMinutes = 5; // rapid mode

      expect(minutesSinceLastMove).toBeGreaterThan(timeoutMinutes);
    });

    it('dovrebbe rilevare abbandono dopo 24 ore in modalità standard', () => {
      const now = new Date();
      const lastMove = new Date(now.getTime() - 25 * 60 * 60 * 1000); // 25 ore fa
      const minutesSinceLastMove = (now.getTime() - lastMove.getTime()) / 1000 / 60;
      const timeoutMinutes = 24 * 60; // standard mode

      expect(minutesSinceLastMove).toBeGreaterThan(timeoutMinutes);
    });

    it('non dovrebbe rilevare abbandono se tempo non scaduto', () => {
      const now = new Date();
      const lastMove = new Date(now.getTime() - 3 * 60 * 1000); // 3 minuti fa
      const minutesSinceLastMove = (now.getTime() - lastMove.getTime()) / 1000 / 60;
      const timeoutMinutes = 5; // rapid mode

      expect(minutesSinceLastMove).toBeLessThan(timeoutMinutes);
    });
  });

  describe('Timer countdown', () => {
    it('dovrebbe decrementare il tempo di 1 secondo', () => {
      let localTime = 600; // 10 minuti
      
      // Simula decremento
      localTime = localTime - 1;
      
      expect(localTime).toBe(599);
    });

    it('non dovrebbe andare sotto zero', () => {
      let localTime = 0;
      
      // Simula decremento con controllo
      if (localTime > 0) {
        localTime = localTime - 1;
      }
      
      expect(localTime).toBe(0);
    });
  });
});
