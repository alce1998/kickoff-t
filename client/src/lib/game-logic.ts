import matchesVerified from '../data/matches_verified_100.json';
import calendarioSerieA from '../data/calendario_seriea_2025_26.json';

// Usa solo il database matches_verified_100.json (868 Serie A + altre competizioni)
const allMatches = matchesVerified;

// Tipi per i filtri
export type SeasonRange = 'all' | '2000-05' | '2006-10' | '2011-15' | '2016-20' | '2021-26';
export type Competition = 'all' | 'serie-a' | 'premier-league' | 'la-liga' | 'ligue-1' | 'bundesliga' | 'international' | 'european-cups';

export interface MatchFilters {
  seasonRange?: SeasonRange;
  competition?: Competition;
}

// Funzione per filtrare le partite
function filterMatches(filters: MatchFilters): RawMatch[] {
  let filtered = allMatches as RawMatch[];

  // Filtro per intervallo stagioni
  if (filters.seasonRange && filters.seasonRange !== 'all') {
    // Converti "2000-05" → [2000, 2005], non [4000, 2005]!
    const parts = filters.seasonRange.split('-');
    const startYear = parseInt(parts[0]);
    const endYear = parseInt(parts[1]) < 100 ? 2000 + parseInt(parts[1]) : parseInt(parts[1]);
    filtered = filtered.filter(match => {
      const season = match.season || '';
      // Estrai TUTTI gli anni dalla stagione (es. "2020/2021" → [2020, 2021])
      const years = season.match(/\d{4}/g);
      if (years && years.length > 0) {
        // La stagione è valida se ALMENO UN anno rientra nell'intervallo
        return years.some(y => {
          const year = parseInt(y);
          return year >= startYear && year <= endYear;
        });
      }
      return false;
    });
  }

  // Filtro per campionato
  if (filters.competition && filters.competition !== 'all') {
    filtered = filtered.filter(match => {
      const comp = (match.competition || '').toLowerCase();
      
      switch (filters.competition) {
        case 'serie-a':
          return comp.includes('serie a');
        case 'premier-league':
          return comp.includes('premier league');
        case 'la-liga':
          return comp.includes('la liga') || comp.includes('liga');
        case 'ligue-1':
          return comp.includes('ligue 1');
        case 'bundesliga':
          return comp.includes('bundesliga');
        case 'international':
          return comp.includes('world cup') || comp.includes('euro') || comp.includes('international') || comp.includes('mondiali') || comp.includes('europei');
        case 'european-cups':
          return comp.includes('champions') || comp.includes('europa') || comp.includes('uefa');
        default:
          return true;
      }
    });
  }

  return filtered;
}

// Default: tutte le partite
let matches = allMatches;

// Mappa per abbreviare i nomi delle squadre
const teamAbbreviations: Record<string, string> = {
  'FC Internazionale Milano': 'Inter',
  'Football Club Internazionale Milano S.p.A.': 'Inter',
  'Inter Milan': 'Inter',
  'Internazionale': 'Inter',
  'AC Milan': 'Milan',
  'AC Mailand': 'Milan',
  'Juventus FC': 'Juve',
  'Juventus Turin': 'Juve',
  'AS Roma': 'Roma',
  'AS Rom': 'Roma',
  'SSC Napoli': 'Napoli',
  'SS Lazio': 'Lazio',
  'ACF Fiorentina': 'Fiorentina',
  'Atalanta BC': 'Atalanta',
  'Atalanta Bergamo': 'Atalanta',
  'Genoa CFC': 'Genoa',
  'UC Sampdoria': 'Sampdoria',
  'Torino FC': 'Torino',
  'Bologna FC 1909': 'Bologna',
  'Bologna FC': 'Bologna',
  'Udinese Calcio': 'Udinese',
  'Parma Calcio 1913': 'Parma',
  'Parma FC': 'Parma',
  'US Palermo': 'Palermo',
  'Cagliari Calcio': 'Cagliari',
  'Hellas Verona': 'Verona',
  'Hellas Verona FC': 'Verona',
  'US Sassuolo Calcio': 'Sassuolo',
  'Sassuolo Calcio': 'Sassuolo',
  'Empoli FC': 'Empoli',
  'AC Chievo Verona': 'Chievo',
  'Chievo Verona': 'Chievo',
  'US Città di Palermo': 'Palermo',
  'SPAL 2013': 'SPAL',
  'Benevento Calcio': 'Benevento',
  'Frosinone Calcio': 'Frosinone',
  'US Lecce': 'Lecce',
  'Brescia Calcio': 'Brescia',
  'Spezia Calcio': 'Spezia',
  'FC Crotone': 'Crotone',
  'Atalanta Bergamasca Calcio S.p.a.': 'Atalanta',
  'US Salernitana 1919': 'Salernitana',
  'Venezia FC': 'Venezia',
  'AC Monza': 'Monza',
  'US Cremonese': 'Cremonese',
  'Como 1907': 'Como',
  'Società Sportiva Calcio Napoli S.p.A.': 'Napoli',
  'Juventus Football Club S.p.A.': 'Juve',
  'AC Milan S.p.A.': 'Milan',
  'AS Roma S.p.A.': 'Roma',
  'SS Lazio S.p.A.': 'Lazio',
  'Unione Sportiva Lecce': 'Lecce',
};

// Funzione per abbreviare il nome della squadra
export function abbreviateTeamName(fullName: string): string {
  return teamAbbreviations[fullName] || fullName;
}

export type Player = {
  role: string;
  name: string;
  correct: boolean;
  number?: number;
  nationality?: string;
  position?: string;  // Ruolo dettagliato (GK, CB, RB, LB, CDM, CM, RM, LM, RW, LW, AM, ST)
  hintNumberUsed?: boolean;
  hintNationalityUsed?: boolean;
};

export type Formation = {
  module?: string;
  players: Player[];
};

export type Match = {
  id: string;
  date: string;
  season?: string;
  competition: string;
  homeTeam: string;
  awayTeam: string;
  score: string;
  description?: string;
  homeFormation: Formation;
  awayFormation: Formation;
};

// Tipo per i dati raw dal JSON
type RawMatch = {
  id: string;
  date: string;
  competition?: string;
  season?: string;
  homeTeam: string;
  awayTeam: string;
  score: string;
  description?: string;
  homeFormation?: {
    module?: string;
    players: { role: string; name: string; number?: number; nationality?: string }[];
  };
  awayFormation?: {
    module?: string;
    players: { role: string; name: string; number?: number; nationality?: string }[];
  };
};

// Funzione per impostare i filtri
export function setMatchFilters(filters: MatchFilters) {
  matches = filterMatches(filters) as any;
  console.log(`Filtri applicati: ${matches.length} partite disponibili`);
}

// Funzione per ottenere il numero di partite disponibili
export function getAvailableMatchesCount(): number {
  return matches.length;
}

// Funzione helper per normalizzare i nomi delle squadre
function normalizeTeamName(name: string): string {
  // Rimuovi spazi, converti in minuscolo, rimuovi caratteri speciali
  return name.toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '')
    .replace('ac', '')
    .replace('fc', '')
    .replace('ssc', '')
    .replace('us', '');
}

// Funzione per trovare una partita storica tra due squadre
function findHistoricalMatch(team1: string, team2: string, dateString: string): RawMatch | null {
  const norm1 = normalizeTeamName(team1);
  const norm2 = normalizeTeamName(team2);
  
  // Cerca partite tra queste due squadre
  const matches = allMatches.filter(m => {
    const normHome = normalizeTeamName(m.homeTeam);
    const normAway = normalizeTeamName(m.awayTeam);
    
    return (normHome === norm1 && normAway === norm2) || 
           (normHome === norm2 && normAway === norm1);
  });
  
  if (matches.length === 0) {
    return null;
  }
  
  // Filtra solo partite con formazioni complete
  const validMatches = matches.filter(m => m.homeFormation && m.awayFormation);
  
  if (validMatches.length === 0) {
    return null;
  }
  
  // Seleziona una partita DETERMINISTICA basata sulla data
  // Usa la data come seed per garantire che la stessa data produca sempre lo stesso indice
  let seed = 0;
  for (let i = 0; i < dateString.length; i++) {
    seed += dateString.charCodeAt(i) * (i + 1);
  }
  // Aggiungi anche i nomi delle squadre al seed per variare tra diverse coppie
  const teamKey = norm1 + norm2;
  for (let i = 0; i < teamKey.length; i++) {
    seed += teamKey.charCodeAt(i) * (i + 1);
  }
  
  const deterministicIndex = seed % validMatches.length;
  return validMatches[deterministicIndex] as RawMatch;
}

// Funzione per ottenere "La Partita del Giorno"
// LOGICA FISSA: Italia vs Francia, Finale Mondiale 2006 (9/7/2006)
export function getMatchOfTheDay(): Match {
  // ID della partita Italia-Francia del 9/7/2006
  const MATCH_ID = '53491';
  
  // Cerca la partita nel database
  const matchData = allMatches.find(m => {
    const raw = m as RawMatch;
    return raw.id === MATCH_ID;
  }) as RawMatch | undefined;
  
  if (!matchData) {
    throw new Error(`Partita del Giorno non trovata (ID: ${MATCH_ID})`);
  }
  
  console.log(`[Match of the Day] Italia vs Francia - Finale Mondiale 2006 (9/7/2006)`);
  
  return convertToMatch(matchData);
}

// Funzione helper per convertire RawMatch in Match
function convertToMatch(matchData: RawMatch): Match {
  if (!matchData.homeFormation || !matchData.awayFormation) {
    throw new Error('Partita senza formazioni');
  }
  
  // Gestisci formazioni: possono essere array diretti o oggetti con players
  const homeIsArray = Array.isArray(matchData.homeFormation);
  const awayIsArray = Array.isArray(matchData.awayFormation);
  
  const homePlayers = (homeIsArray ? matchData.homeFormation : matchData.homeFormation.players) as any[];
  const awayPlayers = (awayIsArray ? matchData.awayFormation : matchData.awayFormation.players) as any[];
  const homeModule = homeIsArray ? '4-4-2' : (matchData.homeFormation.module || '4-4-2');
  const awayModule = awayIsArray ? '4-4-2' : (matchData.awayFormation.module || '4-4-2');
  
  return {
    id: matchData.id,
    date: matchData.date,
    season: matchData.season,
    competition: matchData.competition || matchData.season || 'Serie A',
    homeTeam: abbreviateTeamName(matchData.homeTeam),
    awayTeam: abbreviateTeamName(matchData.awayTeam),
    score: matchData.score,
    description: matchData.description,
    homeFormation: {
      module: homeModule,
      players: homePlayers.map((p, index) => {
        // Usa il ruolo esattamente come presente nel JSON
        let role = (p as any).role || (p as any).position || 'MF';
        // Correzione: ultimi 2 giocatori (indice 9, 10) con ruolo MF/CM/FW sono attaccanti
        if ((index === 9 || index === 10) && (role === 'MF' || role === 'CM' || role === 'FW')) {
          role = 'FW';
        }
        return {
          ...p,
          role,
          correct: false
        };
      })
    },
    awayFormation: {
      module: awayModule,
      players: awayPlayers.map((p, index) => {
        let role = (p as any).role || (p as any).position || 'MF';
        if ((index === 9 || index === 10) && (role === 'MF' || role === 'CM' || role === 'FW')) {
          role = 'FW';
        }
        return {
          ...p,
          role,
          correct: false
        };
      })
    }
  };
}

// Funzione per ottenere una partita casuale
export function getRandomMatch(): Match {
  // Controllo: se non ci sono partite disponibili, lancia un errore
  if (!matches || matches.length === 0) {
    throw new Error('Nessuna partita disponibile per i filtri selezionati. Prova a cambiare i filtri.');
  }
  
  const randomIndex = Math.floor(Math.random() * matches.length);
  const matchData = matches[randomIndex] as RawMatch;
  
  // Verifica che la partita abbia le formazioni
  if (!matchData.homeFormation || !matchData.awayFormation) {
    // Se non ha formazioni, prova con un'altra partita
    return getRandomMatch();
  }
  
  return convertToMatch(matchData);
}

// Funzione per generare opzioni di risposta (giocatori corretti + distrattori)
export function generatePlayerOptions(correctPlayer: Player, allMatches: Match[], count: number = 4): string[] {
  const options = new Set<string>();
  options.add(correctPlayer.name);

  // Raccogli tutti i giocatori di tutte le squadre per usarli come distrattori
  const allPlayers = allMatches.flatMap(m => 
    [...m.homeFormation.players, ...m.awayFormation.players]
  ).map(p => p.name);

  while (options.size < count) {
    const randomPlayer = allPlayers[Math.floor(Math.random() * allPlayers.length)];
    // Evita duplicati e cerca di mantenere coerenza di ruolo se possibile (opzionale per ora)
    if (randomPlayer !== correctPlayer.name) {
      options.add(randomPlayer);
    }
  }

  return Array.from(options).sort(() => Math.random() - 0.5);
}

/**
 * Rimuove gli accenti da una stringa
 * Es: "Müller" -> "Muller", "Çalhanoğlu" -> "Calhanoglu"
 */
function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Calcola la distanza di Levenshtein tra due stringhe
 * Restituisce il numero minimo di operazioni (inserimento, cancellazione, sostituzione)
 * necessarie per trasformare una stringa nell'altra
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  // Inizializza la prima colonna
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  // Inizializza la prima riga
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Riempi la matrice
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // sostituzione
          matrix[i][j - 1] + 1,     // inserimento
          matrix[i - 1][j] + 1      // cancellazione
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Giocatori noti per il solo nome (moniker) invece del cognome
 * Formato: nome completo -> [alias accettati]
 */
const MONIKER_PLAYERS: Record<string, string[]> = {
  'keita balde': ['keita'],
  'keita baldé': ['keita'],
  'saul niguez': ['saul'],
  'saúl ñíguez': ['saul'],
  'saul': ['saul'],
};

/**
 * Estrae tutti i possibili alias accettabili per un nome
 * Gestisce: cognomi con prefissi multi-parola, moniker, qualsiasi parola del nome
 */
function extractAllAliases(fullName: string): string[] {
  const normalized = removeAccents(fullName.trim().toLowerCase());
  const parts = normalized.split(/\s+/);
  const aliases = new Set<string>();
  
  // Aggiungi nome completo normalizzato
  aliases.add(normalized);
  
  // Controlla se è un giocatore moniker
  if (MONIKER_PLAYERS[normalized]) {
    MONIKER_PLAYERS[normalized].forEach(alias => aliases.add(alias));
  }
  
  // Prefissi nobiliari/particelle (singoli e multi-parola)
  const singlePrefixes = ['de', 'di', 'da', 'del', 'della', 'van', 'von', 'dos', 'das', 'el', 'al', 'le', 'la', 'los', 'las'];
  const multiPrefixes = ['van der', 'van de', 'van den', 'de la', 'de los'];
  
  // Controlla prefissi multi-parola all'inizio del nome
  for (const mp of multiPrefixes) {
    if (normalized.startsWith(mp + ' ')) {
      // Es: "van der sar" -> alias "van der sar" (nome completo già aggiunto)
      aliases.add(normalized);
    }
    // Controlla se il cognome inizia con un prefisso multi-parola
    // Es: "Edwin van der Sar" -> cognome = "van der sar"
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
  
  // Aggiungi ogni singola parola del nome come alias (per nomi tipo "Angel Cote")
  // Solo se la parola è sufficientemente lunga (>=4 lettere) per evitare falsi positivi
  parts.forEach(part => {
    if (part.length >= 4 && !singlePrefixes.includes(part)) {
      aliases.add(part);
    }
  });
  
  // Gestione cognome con prefisso singolo
  const lastPart = parts[parts.length - 1];
  const secondLast = parts.length >= 2 ? parts[parts.length - 2] : '';
  
  if (singlePrefixes.includes(secondLast)) {
    // Es: "De Rossi" -> alias "de rossi"
    const surnameWithPrefix = parts.slice(-2).join(' ');
    aliases.add(surnameWithPrefix);
    // Aggiungi anche solo la parte dopo il prefisso
    aliases.add(lastPart);
    
    // Controlla anche prefisso doppio (van der, van de)
    if (parts.length >= 3) {
      const thirdLast = parts[parts.length - 3];
      if (singlePrefixes.includes(thirdLast)) {
        aliases.add(parts.slice(-3).join(' '));
      }
    }
  } else {
    // Cognome normale (ultima parola)
    aliases.add(lastPart);
  }
  
  // Aggiungi anche il nome (prima parola) se è un moniker noto
  const firstName = parts[0];
  if (firstName.length >= 4 && !singlePrefixes.includes(firstName)) {
    // Per giocatori con nome moniker come Keita, Saúl
    // Verifica se il nome è più corto del cognome (potrebbe essere un moniker)
    const surname = singlePrefixes.includes(secondLast) ? parts.slice(-2).join(' ') : lastPart;
    if (firstName.length >= surname.length - 2) {
      aliases.add(firstName);
    }
  }
  
  return Array.from(aliases);
}

/**
 * Estrae il cognome da un nome completo (legacy - usata internamente)
 * Es: "Cristiano Ronaldo" -> "Ronaldo"
 * Es: "De Rossi" -> "De Rossi" (mantiene prefissi comuni)
 */
function extractSurname(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  
  // Prefissi comuni nei cognomi italiani/europei
  const singlePrefixes = ['de', 'di', 'da', 'del', 'della', 'van', 'von', 'dos', 'das', 'el', 'al', 'le', 'la'];
  
  // Controlla prefisso doppio (van der, van de)
  if (parts.length >= 3) {
    const thirdLast = parts[parts.length - 3].toLowerCase();
    const secondLast = parts[parts.length - 2].toLowerCase();
    if (singlePrefixes.includes(thirdLast) && singlePrefixes.includes(secondLast)) {
      return parts.slice(-3).join(' ');
    }
  }
  
  // Se il penultimo elemento è un prefisso, includi anche quello
  if (parts.length >= 2) {
    const secondLast = parts[parts.length - 2].toLowerCase();
    if (singlePrefixes.includes(secondLast)) {
      return parts.slice(-2).join(' ');
    }
  }
  
  // Altrimenti restituisci solo l'ultimo elemento (cognome)
  return parts[parts.length - 1];
}

/**
 * Verifica se l'input corrisponde al nome corretto
 * - Ignora accenti
 * - Ignora nomi propri (accetta solo cognome)
 * - Tollera 1 typo massimo
 */
/**
 * Verifica se l'input corrisponde al nome corretto e restituisce un punteggio di match
 * Restituisce: { matches: boolean, score: number }
 * - score 0 = match esatto (cognome identico)
 * - score 1 = match fuzzy (1 errore di battitura)
 * - score 999 = no match
 */
export function checkAnswerWithScore(inputName: string, correctName: string): { matches: boolean, score: number } {
  // Normalizza: minuscolo, rimuovi spazi extra, rimuovi accenti
  const normalizedInput = removeAccents(inputName.trim().toLowerCase());
  
  // Se l'input è troppo corto, rifiuta
  if (normalizedInput.length < 3) return { matches: false, score: 999 };
  
  // Ottieni tutti gli alias validi per il nome corretto
  const aliases = extractAllAliases(correctName);
  
  // 1. Controllo esatto su qualsiasi alias (priorità massima)
  for (const alias of aliases) {
    if (normalizedInput === alias) return { matches: true, score: 0 };
  }
  
  // 2. Controllo con tolleranza typo (1 errore massimo) su qualsiasi alias
  for (const alias of aliases) {
    if (alias.length >= 3 && levenshteinDistance(normalizedInput, alias) <= 1) {
      return { matches: true, score: 1 };
    }
  }
  
  // 3. L'input è contenuto in qualsiasi alias (es. "Baggio" in "Roberto Baggio")
  for (const alias of aliases) {
    if (alias.includes(normalizedInput) && normalizedInput.length >= 4) {
      return { matches: true, score: 1 };
    }
  }
  
  // 4. Qualsiasi alias è contenuto nell'input
  for (const alias of aliases) {
    if (normalizedInput.includes(alias) && alias.length >= 4) {
      return { matches: true, score: 1 };
    }
  }
  
  return { matches: false, score: 999 };
}

/**
 * Versione legacy di checkAnswer per retrocompatibilità
 */
export function checkAnswer(inputName: string, correctName: string): boolean {
  return checkAnswerWithScore(inputName, correctName).matches;
}
