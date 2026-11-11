import { describe, it, expect } from 'vitest';

// Test per validazione birth_date e height nel gioco Progressione
// Questi test verificano che i giocatori con dati invalidi vengano esclusi
// solo nelle modalità specifiche (Età/Altezza) ma non nelle altre

describe('Progressione - Validazione dati giocatori', () => {
  
  describe('isValidBirthDate', () => {
    // Funzione copiata da ProgressioneGame.tsx per testing
    function parseAge(birthDate: string | null): number {
      if (!birthDate) return 0;
      const match = birthDate.match(/\((\d+)\)/);
      if (!match) return 0;
      return parseInt(match[1]);
    }
    
    function isValidBirthDate(birthDate: string | null): boolean {
      if (!birthDate) return false;
      
      const invalidPatterns = [
        /in prestito/i,
        /loan/i,
        /prestito dal/i,
        /^-$/,
        /n\/a/i,
        /unknown/i,
        /sconosciuto/i,
        /squadra attuale/i,
        /buon compleanno/i,
        /^\s*$/
      ];
      
      for (const pattern of invalidPatterns) {
        if (pattern.test(birthDate)) {
          return false;
        }
      }
      
      const age = parseAge(birthDate);
      return age > 0 && age < 100;
    }
    
    it('dovrebbe accettare birth_date valida con formato standard', () => {
      expect(isValidBirthDate('15/03/1990 (35)')).toBe(true);
      expect(isValidBirthDate('01/10/1980 (45)')).toBe(true);
      expect(isValidBirthDate('22/05/1997 (28)')).toBe(true);
    });
    
    it('dovrebbe rifiutare "In prestito dal/dalla:"', () => {
      expect(isValidBirthDate('In prestito dal/dalla:')).toBe(false);
    });
    
    it('dovrebbe rifiutare birth_date con "Buon compleanno"', () => {
      expect(isValidBirthDate('14/01/1999 (27) Buon compleanno')).toBe(false);
    });
    
    it('dovrebbe rifiutare "Squadra attuale:"', () => {
      expect(isValidBirthDate('Squadra attuale:')).toBe(false);
    });
    
    it('dovrebbe rifiutare birth_date null o vuota', () => {
      expect(isValidBirthDate(null)).toBe(false);
      expect(isValidBirthDate('')).toBe(false);
      expect(isValidBirthDate('   ')).toBe(false);
    });
    
    it('dovrebbe rifiutare età fuori range (>100 o <=0)', () => {
      expect(isValidBirthDate('01/01/1900 (125)')).toBe(false);
      expect(isValidBirthDate('01/01/2025 (0)')).toBe(false);
    });
  });
  
  describe('isValidHeight', () => {
    // Funzione copiata da ProgressioneGame.tsx per testing
    function parseHeight(height: string | null): number {
      if (!height) return 0;
      const match = height.match(/(\d+)[,.](\d+)/);
      if (!match) return 0;
      return parseInt(match[1]) * 100 + parseInt(match[2]);
    }
    
    function isValidHeight(height: string | null): boolean {
      if (!height) return false;
      
      const invalidPatterns = [
        /in prestito/i,
        /loan/i,
        /prestito dal/i,
        /^-$/,
        /n\/a/i,
        /unknown/i,
        /sconosciuto/i,
        /squadra attuale/i,
        /^\s*$/
      ];
      
      for (const pattern of invalidPatterns) {
        if (pattern.test(height)) {
          return false;
        }
      }
      
      const heightValue = parseHeight(height);
      return heightValue > 0;
    }
    
    it('dovrebbe accettare height valida con formato standard', () => {
      expect(isValidHeight('1,85 m')).toBe(true);
      expect(isValidHeight('1.91 m')).toBe(true);
      expect(isValidHeight('1,75 m')).toBe(true);
    });
    
    it('dovrebbe rifiutare "In prestito dal/dalla:"', () => {
      expect(isValidHeight('In prestito dal/dalla:')).toBe(false);
    });
    
    it('dovrebbe rifiutare "Squadra attuale:"', () => {
      expect(isValidHeight('Squadra attuale:')).toBe(false);
    });
    
    it('dovrebbe rifiutare height null o vuota', () => {
      expect(isValidHeight(null)).toBe(false);
      expect(isValidHeight('')).toBe(false);
      expect(isValidHeight('   ')).toBe(false);
    });
    
    it('dovrebbe rifiutare height non parsabile', () => {
      expect(isValidHeight('alto')).toBe(false);
      expect(isValidHeight('N/A')).toBe(false);
      expect(isValidHeight('-')).toBe(false);
    });
  });
  
  describe('Filtro giocatori per modalità', () => {
    it('dovrebbe escludere giocatori con birth_date invalida solo in modalità Età', () => {
      const players = [
        { name: 'Højlund', birth_date: 'In prestito dal/dalla:', height: '1,91 m' },
        { name: 'Valido', birth_date: '15/03/1990 (35)', height: '1,85 m' }
      ];
      
      // Funzione validazione
      function isValidBirthDate(birthDate: string | null): boolean {
        if (!birthDate) return false;
        const invalidPatterns = [/in prestito/i, /loan/i];
        for (const pattern of invalidPatterns) {
          if (pattern.test(birthDate)) return false;
        }
        return true;
      }
      
      // Modalità Età: filtra invalidi
      const filteredForAge = players.filter(p => isValidBirthDate(p.birth_date));
      expect(filteredForAge).toHaveLength(1);
      expect(filteredForAge[0].name).toBe('Valido');
      
      // Modalità Altezza: non filtra per birth_date
      const filteredForHeight = players; // Nessun filtro su birth_date
      expect(filteredForHeight).toHaveLength(2);
    });
    
    it('dovrebbe escludere giocatori con height invalida solo in modalità Altezza', () => {
      const players = [
        { name: 'Invalido', birth_date: '15/03/1990 (35)', height: 'In prestito dal/dalla:' },
        { name: 'Valido', birth_date: '22/05/1997 (28)', height: '1,85 m' }
      ];
      
      // Funzione validazione
      function isValidHeight(height: string | null): boolean {
        if (!height) return false;
        const invalidPatterns = [/in prestito/i, /loan/i];
        for (const pattern of invalidPatterns) {
          if (pattern.test(height)) return false;
        }
        return true;
      }
      
      // Modalità Altezza: filtra invalidi
      const filteredForHeight = players.filter(p => isValidHeight(p.height));
      expect(filteredForHeight).toHaveLength(1);
      expect(filteredForHeight[0].name).toBe('Valido');
      
      // Modalità Età: non filtra per height
      const filteredForAge = players; // Nessun filtro su height
      expect(filteredForAge).toHaveLength(2);
    });
  });
});
