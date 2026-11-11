import { describe, it, expect } from "vitest";

// Logica di validazione record maratona (estratta dal router)
function shouldSaveScore(
  newScore: number,
  existingBestScore: number | null
): { save: boolean; improved: boolean } {
  if (existingBestScore === null) {
    // Nessun record precedente, salva sempre
    return { save: true, improved: true };
  }
  if (newScore > existingBestScore) {
    // Nuovo record! Salva
    return { save: true, improved: true };
  }
  // Punteggio non migliore, non salvare come nuovo record
  return { save: false, improved: false };
}

describe("Record Maratona - Logica Salvataggio", () => {
  it("dovrebbe salvare il primo punteggio (nessun record precedente)", () => {
    const result = shouldSaveScore(5, null);
    expect(result.save).toBe(true);
    expect(result.improved).toBe(true);
  });

  it("dovrebbe salvare se il nuovo punteggio è superiore al record", () => {
    const result = shouldSaveScore(10, 5);
    expect(result.save).toBe(true);
    expect(result.improved).toBe(true);
  });

  it("NON dovrebbe salvare se il nuovo punteggio è uguale al record", () => {
    const result = shouldSaveScore(5, 5);
    expect(result.save).toBe(false);
    expect(result.improved).toBe(false);
  });

  it("NON dovrebbe salvare se il nuovo punteggio è inferiore al record", () => {
    const result = shouldSaveScore(3, 10);
    expect(result.save).toBe(false);
    expect(result.improved).toBe(false);
  });

  it("dovrebbe salvare 1 risposta come primo record", () => {
    const result = shouldSaveScore(1, null);
    expect(result.save).toBe(true);
    expect(result.improved).toBe(true);
  });

  it("NON dovrebbe sovrascrivere 10 risposte con 1 risposta", () => {
    // Bug originale: Alessandro Centra (10) sovrascritto da gabriele.gualtieri03 (1)
    const result = shouldSaveScore(1, 10);
    expect(result.save).toBe(false);
    expect(result.improved).toBe(false);
  });
});

describe("Record Maratona - Ordinamento Query", () => {
  it("dovrebbe restituire il punteggio più alto tra tutti i record", () => {
    const scores = [
      { score: 1, playerName: "gabriele.gualtieri03" },
      { score: 10, playerName: "Alessandro Centra" },
      { score: 5, playerName: "altro_utente" },
      { score: 3, playerName: "terzo_utente" },
    ];
    
    // Simula ordinamento DESC (come ora nel backend con desc(gameScores.score))
    const sorted = [...scores].sort((a, b) => b.score - a.score);
    const topRecord = sorted[0];
    
    expect(topRecord.score).toBe(10);
    expect(topRecord.playerName).toBe("Alessandro Centra");
  });

  it("NON dovrebbe restituire il punteggio più basso (bug originale con ASC)", () => {
    const scores = [
      { score: 1, playerName: "gabriele.gualtieri03" },
      { score: 10, playerName: "Alessandro Centra" },
    ];
    
    // Bug originale: ordinamento ASC restituiva il più basso
    const sortedAsc = [...scores].sort((a, b) => a.score - b.score);
    const wrongRecord = sortedAsc[0];
    
    // Questo era il comportamento ERRATO
    expect(wrongRecord.score).toBe(1);
    expect(wrongRecord.playerName).toBe("gabriele.gualtieri03");
    
    // Il comportamento CORRETTO con DESC
    const sortedDesc = [...scores].sort((a, b) => b.score - a.score);
    const correctRecord = sortedDesc[0];
    expect(correctRecord.score).toBe(10);
    expect(correctRecord.playerName).toBe("Alessandro Centra");
  });
});
