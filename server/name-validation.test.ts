import { describe, it, expect } from "vitest";

// Reimplementazione delle funzioni per il test (lato server)
function removeAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

const MONIKER_PLAYERS: Record<string, string[]> = {
  'keita balde': ['keita'],
  'keita baldé': ['keita'],
  'saul niguez': ['saul'],
  'saúl ñíguez': ['saul'],
  'saul': ['saul'],
};

function extractAllAliases(fullName: string): string[] {
  const normalized = removeAccents(fullName.trim().toLowerCase());
  const parts = normalized.split(/\s+/);
  const aliases = new Set<string>();
  
  aliases.add(normalized);
  
  if (MONIKER_PLAYERS[normalized]) {
    MONIKER_PLAYERS[normalized].forEach(alias => aliases.add(alias));
  }
  
  const singlePrefixes = ['de', 'di', 'da', 'del', 'della', 'van', 'von', 'dos', 'das', 'el', 'al', 'le', 'la', 'los', 'las'];
  const multiPrefixes = ['van der', 'van de', 'van den', 'de la', 'de los'];
  
  for (const mp of multiPrefixes) {
    const mpIdx = normalized.indexOf(' ' + mp + ' ');
    if (mpIdx !== -1) {
      const surnameWithPrefix = normalized.slice(mpIdx + 1);
      aliases.add(surnameWithPrefix);
    }
  }
  
  if (parts.length === 1) {
    aliases.add(parts[0]);
    return Array.from(aliases);
  }
  
  parts.forEach(part => {
    if (part.length >= 4 && !singlePrefixes.includes(part)) {
      aliases.add(part);
    }
  });
  
  const lastPart = parts[parts.length - 1];
  const secondLast = parts.length >= 2 ? parts[parts.length - 2] : '';
  
  if (singlePrefixes.includes(secondLast)) {
    const surnameWithPrefix = parts.slice(-2).join(' ');
    aliases.add(surnameWithPrefix);
    aliases.add(lastPart);
    
    if (parts.length >= 3) {
      const thirdLast = parts[parts.length - 3];
      if (singlePrefixes.includes(thirdLast)) {
        aliases.add(parts.slice(-3).join(' '));
      }
    }
  } else {
    aliases.add(lastPart);
  }
  
  const firstName = parts[0];
  if (firstName.length >= 4 && !singlePrefixes.includes(firstName)) {
    const surname = singlePrefixes.includes(secondLast) ? parts.slice(-2).join(' ') : lastPart;
    if (firstName.length >= surname.length - 2) {
      aliases.add(firstName);
    }
  }
  
  return Array.from(aliases);
}

function checkAnswerWithScore(inputName: string, correctName: string): { matches: boolean, score: number } {
  const normalizedInput = removeAccents(inputName.trim().toLowerCase());
  if (normalizedInput.length < 3) return { matches: false, score: 999 };
  
  const aliases = extractAllAliases(correctName);
  
  for (const alias of aliases) {
    if (normalizedInput === alias) return { matches: true, score: 0 };
  }
  
  for (const alias of aliases) {
    if (alias.length >= 3 && levenshteinDistance(normalizedInput, alias) <= 1) {
      return { matches: true, score: 1 };
    }
  }
  
  for (const alias of aliases) {
    if (alias.includes(normalizedInput) && normalizedInput.length >= 4) {
      return { matches: true, score: 1 };
    }
  }
  
  for (const alias of aliases) {
    if (normalizedInput.includes(alias) && alias.length >= 4) {
      return { matches: true, score: 1 };
    }
  }
  
  return { matches: false, score: 999 };
}

function checkAnswer(inputName: string, correctName: string): boolean {
  return checkAnswerWithScore(inputName, correctName).matches;
}

describe("Validazione nomi giocatori - Formazioni", () => {
  
  describe("Keita Baldé - moniker", () => {
    it('accetta "Keita" come nome moniker', () => {
      expect(checkAnswer("Keita", "Keita Baldé")).toBe(true);
    });
    it('accetta "Balde" come cognome', () => {
      expect(checkAnswer("Balde", "Keita Baldé")).toBe(true);
    });
    it('accetta "Baldé" con accento', () => {
      expect(checkAnswer("Baldé", "Keita Baldé")).toBe(true);
    });
    it('accetta nome completo "Keita Balde"', () => {
      expect(checkAnswer("Keita Balde", "Keita Baldé")).toBe(true);
    });
  });

  describe("Saúl Ñíguez - moniker", () => {
    it('accetta "Saul" come nome moniker', () => {
      expect(checkAnswer("Saul", "Saúl Ñíguez")).toBe(true);
    });
    it('accetta "Niguez" come cognome', () => {
      expect(checkAnswer("Niguez", "Saúl Ñíguez")).toBe(true);
    });
  });

  describe("José Ángel Cote - nomi multipli", () => {
    it('accetta "Angel" come parte del nome', () => {
      expect(checkAnswer("Angel", "José Ángel Cote")).toBe(true);
    });
    it('accetta "Cote" come cognome', () => {
      expect(checkAnswer("Cote", "José Ángel Cote")).toBe(true);
    });
  });

  describe("Particelle nobiliari - De, Di, Van, El", () => {
    it('accetta "De Rossi" per "Daniele De Rossi"', () => {
      expect(checkAnswer("De Rossi", "Daniele De Rossi")).toBe(true);
    });
    it('accetta "Rossi" per "Daniele De Rossi"', () => {
      expect(checkAnswer("Rossi", "Daniele De Rossi")).toBe(true);
    });
    it('accetta "Di Lorenzo" per "Giovanni Di Lorenzo"', () => {
      expect(checkAnswer("Di Lorenzo", "Giovanni Di Lorenzo")).toBe(true);
    });
    it('accetta "Lorenzo" per "Giovanni Di Lorenzo"', () => {
      expect(checkAnswer("Lorenzo", "Giovanni Di Lorenzo")).toBe(true);
    });
    it('accetta "El Shaarawy" per "Stephan El Shaarawy"', () => {
      expect(checkAnswer("El Shaarawy", "Stephan El Shaarawy")).toBe(true);
    });
    it('accetta "Shaarawy" per "Stephan El Shaarawy"', () => {
      expect(checkAnswer("Shaarawy", "Stephan El Shaarawy")).toBe(true);
    });
    it('accetta "Van der Sar" per "Edwin Van der Sar"', () => {
      expect(checkAnswer("Van der Sar", "Edwin Van der Sar")).toBe(true);
    });
    it('accetta "Van de Ven" per "Micky Van de Ven"', () => {
      expect(checkAnswer("Van de Ven", "Micky Van de Ven")).toBe(true);
    });
  });

  describe("Nomi standard - non devono essere rotti", () => {
    it('accetta "Ronaldo" per "Cristiano Ronaldo"', () => {
      expect(checkAnswer("Ronaldo", "Cristiano Ronaldo")).toBe(true);
    });
    it('accetta "Baggio" per "Roberto Baggio"', () => {
      expect(checkAnswer("Baggio", "Roberto Baggio")).toBe(true);
    });
    it('rifiuta nomi completamente sbagliati', () => {
      expect(checkAnswer("Messi", "Cristiano Ronaldo")).toBe(false);
    });
    it('accetta con 1 typo "Ronlado" per "Cristiano Ronaldo"', () => {
      expect(checkAnswer("Ronlado", "Cristiano Ronaldo")).toBe(true);
    });
  });
});
