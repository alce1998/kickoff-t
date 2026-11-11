import { describe, it, expect } from 'vitest';

describe('Progressione Game - Top 3 Periodi Feature', () => {
  it('dovrebbe selezionare top 3 periodi con più gol', () => {
    const career = [
      { team: 'Inter', years: '2010-2015', goals: 50, apps: 100 },
      { team: 'Milan', years: '2015-2018', goals: 30, apps: 80 },
      { team: 'Juventus', years: '2018-2020', goals: 40, apps: 60 },
      { team: 'Roma', years: '2020-2022', goals: 10, apps: 40 },
    ];
    
    const sortedPeriods = [...career]
      .map(period => ({ ...period, goals: Math.max(0, period.goals || 0) }))
      .sort((a, b) => b.goals - a.goals)
      .slice(0, 3);
    
    expect(sortedPeriods).toHaveLength(3);
    expect(sortedPeriods[0].goals).toBe(50); // Inter - migliore
    expect(sortedPeriods[1].goals).toBe(40); // Juventus - secondo
    expect(sortedPeriods[2].goals).toBe(30); // Milan - terzo
  });
  
  it('dovrebbe selezionare top 3 periodi con più presenze', () => {
    const career = [
      { team: 'Inter', years: '2010-2015', goals: 50, apps: 100 },
      { team: 'Milan', years: '2015-2018', goals: 30, apps: 80 },
      { team: 'Juventus', years: '2018-2020', goals: 40, apps: 60 },
      { team: 'Roma', years: '2020-2022', goals: 10, apps: 40 },
    ];
    
    const sortedPeriods = [...career]
      .sort((a, b) => (b.apps || 0) - (a.apps || 0))
      .slice(0, 3);
    
    expect(sortedPeriods).toHaveLength(3);
    expect(sortedPeriods[0].apps).toBe(100); // Inter - migliore
    expect(sortedPeriods[1].apps).toBe(80); // Milan - secondo
    expect(sortedPeriods[2].apps).toBe(60); // Juventus - terzo
  });
  
  it('dovrebbe richiedere minimo 3 squadre diverse', () => {
    const career = [
      { team: 'Inter', years: '2010-2015', goals: 50, apps: 100 },
      { team: 'Inter', years: '2015-2018', goals: 30, apps: 80 }, // Stessa squadra
    ];
    
    const uniqueTeams = new Set(career.map(period => period.team));
    const hasMinimumTeams = uniqueTeams.size >= 3;
    
    expect(hasMinimumTeams).toBe(false);
    expect(uniqueTeams.size).toBe(1); // Solo Inter
  });
  
  it('dovrebbe accettare giocatori con 3+ squadre diverse', () => {
    const career = [
      { team: 'Inter', years: '2010-2015', goals: 50, apps: 100 },
      { team: 'Milan', years: '2015-2018', goals: 30, apps: 80 },
      { team: 'Juventus', years: '2018-2020', goals: 40, apps: 60 },
    ];
    
    const uniqueTeams = new Set(career.map(period => period.team));
    const hasMinimumTeams = uniqueTeams.size >= 3;
    
    expect(hasMinimumTeams).toBe(true);
    expect(uniqueTeams.size).toBe(3);
  });
  
  it('dovrebbe scegliere casualmente uno dei top 3 periodi', () => {
    const sortedPeriods = [
      { team: 'Inter', years: '2010-2015', goals: 50, apps: 100 },
      { team: 'Juventus', years: '2018-2020', goals: 40, apps: 60 },
      { team: 'Milan', years: '2015-2018', goals: 30, apps: 80 },
    ];
    
    // Simula selezione casuale
    const randomIndex = Math.floor(Math.random() * sortedPeriods.length);
    const randomPeriod = sortedPeriods[randomIndex];
    
    expect(randomIndex).toBeGreaterThanOrEqual(0);
    expect(randomIndex).toBeLessThan(3);
    expect(randomPeriod).toBeDefined();
    expect(randomPeriod.team).toBeDefined();
  });
  
  it('dovrebbe filtrare giocatori senza bestPeriod', () => {
    const players = [
      { name: 'Player 1', bestPeriod: { team: 'Inter', years: '2010-2015', value: 50 } },
      { name: 'Player 2', bestPeriod: undefined },
      { name: 'Player 3', bestPeriod: { team: 'Milan', years: '2015-2018', value: 30 } },
    ];
    
    const filtered = players.filter(p => p.bestPeriod !== undefined);
    
    expect(filtered).toHaveLength(2);
    expect(filtered[0].name).toBe('Player 1');
    expect(filtered[1].name).toBe('Player 3');
  });
  
  it('dovrebbe gestire periodi con gol negativi', () => {
    const career = [
      { team: 'Inter', years: '2010-2015', goals: -5, apps: 100 }, // Gol negativi
      { team: 'Milan', years: '2015-2018', goals: 30, apps: 80 },
    ];
    
    const sortedPeriods = [...career]
      .map(period => ({ ...period, goals: Math.max(0, period.goals || 0) }))
      .sort((a, b) => b.goals - a.goals);
    
    expect(sortedPeriods[0].goals).toBe(30); // Milan
    expect(sortedPeriods[1].goals).toBe(0); // Inter (negativo -> 0)
  });
  
  it('dovrebbe aumentare varietà con 3 periodi invece di 1', () => {
    const career = [
      { team: 'Inter', years: '2010-2015', goals: 50, apps: 100 },
      { team: 'Juventus', years: '2018-2020', goals: 40, apps: 60 },
      { team: 'Milan', years: '2015-2018', goals: 30, apps: 80 },
    ];
    
    const top3 = [...career]
      .sort((a, b) => b.goals - a.goals)
      .slice(0, 3);
    
    // Con logica vecchia: solo 1 periodo (Inter 50 gol)
    // Con logica nuova: 3 periodi possibili (Inter 50, Juventus 40, Milan 30)
    const varietyFactor = top3.length;
    
    expect(varietyFactor).toBe(3);
    expect(varietyFactor).toBeGreaterThan(1); // Più varietà rispetto a prima
  });
});
