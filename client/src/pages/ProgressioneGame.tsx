import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { NavigationBar } from '@/components/NavigationBar';
import { FeedbackModal } from '@/components/FeedbackModal';
import { LeaderboardSection } from '@/components/LeaderboardSection';
import { DonationProgress } from "@/components/DonationProgress";
import { useSound } from '@/hooks/useSound';
import { useAuth } from '@/_core/hooks/useAuth';
import { HelpCircle } from 'lucide-react';
// Database caricato dinamicamente
let playersData: Player[] = [];
let careerPlayersData: Player[] = []; // Database con dati carriera dettagliati
import { trpc } from '../lib/trpc';
import { useTranslation } from 'react-i18next';
import { useAchievements } from '@/hooks/useAchievements';
import { useMatchGuard } from '@/contexts/MatchGuardContext';

type CareerPeriod = {
  years: string;
  team: string;
  apps: number;
  goals: number;
};

type BestPeriod = {
  team: string;
  years: string;
  value: number; // gol o presenze
};

type Player = {
  player_id: string;
  name: string | null;
  current_team: { name: string; url: string } | null;
  nationality: string | null;
  position: string | null;
  birth_date: string | null;
  height: string | null;
  is_active: boolean;
  career_teams: { name: string; id: string }[];
  career?: CareerPeriod[]; // Dati carriera dettagliati per gol-totali e presenze-totali
  bestPeriod?: BestPeriod; // Miglior periodo singolo per gol o presenze
};

type Competition = 'serie-a' | 'premier-league' | 'la-liga' | 'bundesliga' | 'ligue-1';
type GameMode = 'height' | 'age' | 'transfers' | 'gol-totali' | 'presenze-totali';

type Transfer = {
  player_id: string;
  transfer_date: string;
  from_club: string;
  to_club: string;
  transfer_fee: string;
  transfer_fee_numeric: number;
  player_name: string;
};



const competitions: { value: Competition; label: string }[] = [
  { value: 'serie-a', label: 'Serie A' },
  { value: 'premier-league', label: 'Premier League' },
  { value: 'la-liga', label: 'La Liga' },
  { value: 'bundesliga', label: 'Bundesliga' },
  { value: 'ligue-1', label: 'Ligue 1' },
];

// Mappa squadre per campionato
const teamsByCompetition: Record<Competition, string[]> = {
  'serie-a': ['Inter', 'Milan', 'Juventus', 'Roma', 'Napoli', 'Lazio', 'Fiorentina', 'Atalanta', 'Bologna', 'Torino'],
  'premier-league': ['Arsenal', 'Liverpool', 'Man City', 'Man Utd', 'Chelsea', 'Tottenham', 'Newcastle', 'Brighton', 'Aston Villa', 'West Ham'],
  'la-liga': ['Real Madrid', 'Barcelona', 'Atletico Madrid', 'Sevilla', 'Real Sociedad', 'Villarreal', 'Athletic Bilbao', 'Real Betis', 'Valencia', 'Celta Vigo'],
  'bundesliga': ['Bayern', 'Dortmund', 'Lipsia', 'Leverkusen', 'Eintracht', 'Friburgo', 'Union Berlino', 'Wolfsburg', 'Stoccarda', 'Hoffenheim'],
  'ligue-1': ['PSG', 'Monaco', 'Marsiglia', 'Lione', 'Lille', 'Nizza', 'Lens', 'Rennes', 'Strasburgo', 'Brest'],
};

function normalizeTeamName(name: string): string {
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

function getPlayersByCompetition(competition: Competition, gameMode?: GameMode): Player[] {
  const teams = teamsByCompetition[competition];
  const normalizedTeams = teams.map(normalizeTeamName);
  
  return playersData.filter((player: Player) => {
    if (!player.current_team) return false;
    const currentTeam = normalizeTeamName(player.current_team.name);
    return normalizedTeams.some(team => 
      currentTeam.includes(team) || team.includes(currentTeam)
    );
  }).filter((player: Player) => {
    // Filtra giocatori con dati validi
    if (player.height === null || player.birth_date === null) return false;
    // Esclude giocatori con N/A come valore
    if (player.height === 'N/A' || player.birth_date === 'N/A') return false;
    return true;
  });
}

function parseHeight(height: string | null): number {
  if (!height) return 0;
  // Formato: "1,85 m" -> 185
  const match = height.match(/(\d+)[,.](\d+)/);
  if (!match) return 0;
  return parseInt(match[1]) * 100 + parseInt(match[2]);
}

function parseAge(birthDate: string | null): number {
  if (!birthDate) return 0;
  // Formato: "15/03/1990 (35)" -> estrae età dalla parentesi
  const match = birthDate.match(/\((\d+)\)/);
  if (!match) return 0;
  return parseInt(match[1]);
}

// Funzione per validare birth_date
function isValidBirthDate(birthDate: string | null): boolean {
  if (!birthDate) return false;
  
  // Pattern per date invalide
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
  
  // Prova a parsare l'età
  const age = parseAge(birthDate);
  return age > 0 && age < 100;
}

// Funzione per validare height
function isValidHeight(height: string | null): boolean {
  if (!height) return false;
  
  // Pattern per altezze invalide
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
  
  // Prova a parsare l'altezza
  const heightValue = parseHeight(height);
  return heightValue > 0;
}

function extractSurname(fullName: string | null): string {
  if (!fullName) return 'Sconosciuto';
  // Rimuove il numero di maglia (#37) se presente e restituisce il nome completo
  const withoutNumber = fullName.replace(/^#\d+\s+/, '');
  return withoutNumber.trim();
}

function calculateTotalGoals(player: Player): number {
  if (!player.career) return 0;
  return player.career.reduce((sum, period) => sum + Math.abs(period.goals || 0), 0);
}

function calculateTotalApps(player: Player): number {
  if (!player.career) return 0;
  return player.career.reduce((sum, period) => sum + (period.apps || 0), 0);
}

export default function ProgressioneGame() {
  const { playCorrect, playWrong } = useSound();
  const [dataLoaded, setDataLoaded] = useState(false);
  
  // Carica database giocatori
  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch('/data/serie_a_players_careers_2000_2025.json');
        playersData = await response.json();
        
         // Carica anche dati carriera dettagliati per gol-totali e presenze-totali
        const careerResponse = await fetch('/data/verified_careers_wiki.json');
        const careerDataRaw = await careerResponse.json();
        
        // Trasforma oggetto in array e aggiungi campo name
        careerPlayersData = Object.entries(careerDataRaw).map(([name, data]: [string, any]) => ({
          name,
          player_id: name, // Usa nome come ID temporaneo
          ...data,
        }));
        
        setDataLoaded(true);
      } catch (error) {
        console.error('Errore caricamento dati:', error);
      }
    };
    loadData();
  }, []);
  
  const [, setLocation] = useLocation();
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [competition, setCompetition] = useState<Competition>('serie-a');
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const { t } = useTranslation();
  
  // Leggi parametri URL per modalità preselezionata e avvio automatico
  const urlParams = new URLSearchParams(window.location.search);
  const modeParam = urlParams.get('mode') as GameMode | null;
  const autostartParam = urlParams.get('autostart') === 'true';
  
  const [gameMode, setGameMode] = useState<GameMode>('height');
  
  // Aggiorna modalità quando cambia parametro URL
  useEffect(() => {
    if (modeParam) {
      setGameMode(modeParam);
    }
  }, [modeParam]);
  
  // Avvio automatico quando richiesto da URL
  useEffect(() => {
    if (autostartParam && playersData.length > 0 && gameMode) {
      startGame();
    }
  }, [autostartParam, gameMode]);
  
  const [players, setPlayers] = useState<Player[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [previousPlayer, setPreviousPlayer] = useState<Player | null>(null);
  const [previousTransfer, setPreviousTransfer] = useState<Transfer | null>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(20); // Timer per risposta singola
  const [globalTime, setGlobalTime] = useState(0); // Timer globale in secondi
  const [feedback, setFeedback] = useState('');
  const [gameOver, setGameOver] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [leaderboardSaved, setLeaderboardSaved] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const globalTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const { user } = useAuth();
  const { unlock } = useAchievements();
  const { setMatchActive } = useMatchGuard();
  const recordGamePlayed = trpc.achievements.recordGamePlayed.useMutation();
  const saveScoreMutation = trpc.leaderboard.saveScore.useMutation();
  const saveUserScoreMutation = trpc.gameScores.saveScore.useMutation();

  useEffect(() => {
    setMatchActive(gameStarted && !gameOver);
  }, [gameStarted, gameOver, setMatchActive]);

  // Poliglotta: record that the user played this game
  useEffect(() => {
    if (user) recordGamePlayed.mutate({ gameType: 'progressione' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
  const { data: leaderboardData, refetch: refetchLeaderboard } = trpc.leaderboard.getTopScores.useQuery(
    {
      gameType: 'progressione',
      competition: 'serie-a',
      difficulty: gameMode,
      limit: 10,
    }
  );

  // Timer countdown per risposta
  useEffect(() => {
    if (!gameStarted || gameOver || timeLeft === 0 || showAnswer) return;
    
    timerRef.current = setTimeout(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [timeLeft, gameStarted, gameOver, showAnswer]);

  // Timer globale
  useEffect(() => {
    if (!gameStarted || gameOver) return;
    
    globalTimerRef.current = setTimeout(() => {
      setGlobalTime(prev => prev + 1);
    }, 1000);
    
    return () => {
      if (globalTimerRef.current) clearTimeout(globalTimerRef.current);
    };
  }, [globalTime, gameStarted, gameOver]);

  // Tempo scaduto
  useEffect(() => {
    if (timeLeft === 0 && gameStarted && !gameOver && !showAnswer) {
      handleWrongAnswer('⏰ Tempo scaduto!');
    }
  }, [timeLeft]);

  const startGame = async () => {
    if (gameMode === 'gol-totali' || gameMode === 'presenze-totali') {
      // Modalità carriera: usa careerPlayersData
      let availablePlayers = careerPlayersData.filter(p => 
        p.career && p.career.length > 0
      );
      
      // Per gol-totali, filtra solo giocatori con almeno 10 gol (esclude portieri)
      if (gameMode === 'gol-totali') {
        availablePlayers = availablePlayers.filter(p => {
          if (!p.career) return false;
          const totalGoals = p.career.reduce((sum: number, period: any) => sum + Math.max(0, period.goals || 0), 0);
          return totalGoals >= 10;
        });
      }
      
      if (availablePlayers.length < 30) {
        alert('Non ci sono abbastanza giocatori con dati carriera. Riprova più tardi.');
        return;
      }
      
      // Calcola bestPeriod per ogni giocatore
      const playersWithBestPeriod = availablePlayers.map(p => {
        if (!p.career || p.career.length === 0) return p;
        
        // Filtra solo periodi con squadre diverse (almeno 3 per varietà)
        const uniqueTeams = new Set(p.career.map(period => period.team));
        if (uniqueTeams.size < 3) return p; // Escludi giocatori con meno di 3 squadre
        
        let bestPeriod: BestPeriod | undefined;
        
        if (gameMode === 'gol-totali') {
          // Trova top 3 periodi con più gol
          const sortedPeriods = [...p.career]
            .map(period => ({
              ...period,
              goals: Math.max(0, period.goals || 0)
            }))
            .sort((a, b) => b.goals - a.goals)
            .slice(0, 3); // Top 3 periodi
          
          // Scegli casualmente uno dei top 3 periodi
          if (sortedPeriods.length > 0) {
            const randomPeriod = sortedPeriods[Math.floor(Math.random() * sortedPeriods.length)];
            bestPeriod = {
              team: randomPeriod.team,
              years: randomPeriod.years,
              value: randomPeriod.goals
            };
          }
        } else if (gameMode === 'presenze-totali') {
          // Trova top 3 periodi con più presenze
          const sortedPeriods = [...p.career]
            .sort((a, b) => (b.apps || 0) - (a.apps || 0))
            .slice(0, 3); // Top 3 periodi
          
          // Scegli casualmente uno dei top 3 periodi
          if (sortedPeriods.length > 0) {
            const randomPeriod = sortedPeriods[Math.floor(Math.random() * sortedPeriods.length)];
            bestPeriod = {
              team: randomPeriod.team,
              years: randomPeriod.years,
              value: randomPeriod.apps || 0
            };
          }
        }
        
        return { ...p, bestPeriod };
      }).filter(p => p.bestPeriod !== undefined); // Filtra giocatori senza periodi validi
      
      // Mescola e prendi 100 giocatori per permettere errori
      const shuffled = [...playersWithBestPeriod].sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, Math.min(100, shuffled.length));
      
      setPlayers(selected);
      setPreviousPlayer(selected[0]);
      setCurrentIndex(1);
    } else if (gameMode === 'transfers') {
      // Carica trasferimenti dal CSV
      try {
        const response = await fetch('/data/transfers.csv');
        const text = await response.text();
        const lines = text.split('\n').slice(1); // Salta header
        
        // Parser CSV che gestisce virgolette e virgole nei valori
        const parseCSVLine = (line: string): string[] => {
          const result: string[] = [];
          let current = '';
          let inQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        };
        
        const parsedTransfers: Transfer[] = lines
          .filter(line => line.trim())
          .map(line => {
            const parts = parseCSVLine(line);
            const feeString = parts[5] || ''; // Colonna F (transfer_fee)
            // Rimuovi simboli e converti in numero (es. "€ 180.000.000,00" -> 180)
            const feeNumeric = parseFloat(feeString.replace(/[^0-9,]/g, '').replace(',', '.')) / 1000000; // Converti in milioni
            
            return {
              player_id: parts[0],
              transfer_date: parts[1],
              from_club: parts[2],
              to_club: parts[3],
              transfer_fee: feeString,
              transfer_fee_numeric: feeNumeric,
              player_name: parts[6] || '', // Colonna G (Player_name)
            };
          })
          .filter(t => t.transfer_fee_numeric > 0); // Solo trasferimenti con costo valido
        
        if (parsedTransfers.length < 20) {
          alert('Non ci sono abbastanza trasferimenti nel database.');
          return;
        }
        
        // Mescola e prendi 100 trasferimenti per permettere errori
        const shuffled = [...parsedTransfers].sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, Math.min(100, shuffled.length));
        
        setTransfers(selected);
        setPreviousTransfer(selected[0]);
        setCurrentIndex(1);
      } catch (error) {
        console.error('Errore caricamento trasferimenti:', error);
        alert('Errore nel caricamento dei trasferimenti.');
        return;
      }
    } else {
      // Modalità giocatori (height/age)
      let availablePlayers = getPlayersByCompetition(competition);
      
      // Filtra giocatori con dati invalidi solo per modalità specifiche
      if (gameMode === 'age') {
        availablePlayers = availablePlayers.filter(p => isValidBirthDate(p.birth_date));
      } else if (gameMode === 'height') {
        availablePlayers = availablePlayers.filter(p => isValidHeight(p.height));
      }
      
      if (availablePlayers.length < 20) {
        alert('Non ci sono abbastanza giocatori con dati validi per questa modalità. Scegli un altro campionato o modalità.');
        return;
      }
      
      // Mescola e prendi 100 giocatori per permettere errori
      const shuffled = [...availablePlayers].sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, Math.min(100, shuffled.length));
      
      setPlayers(selected);
      setPreviousPlayer(selected[0]);
      setCurrentIndex(1);
    }
    
    setGameStarted(true);
    setScore(0);
    setTimeLeft(20);
    setGlobalTime(0);
    setFeedback('');
    setGameOver(false);
    setShowAnswer(false);
    // Porta la schermata di gioco in cima, allineata alla schermata di setup
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleWrongAnswer = (message: string) => {
    playWrong();
    setFeedback(message);
    setShowAnswer(true);
    
    // Penalità +5 secondi
    setGlobalTime(prev => prev + 5);
    
    setTimeout(() => {
      nextPlayer();
    }, 3000);
  };

  const handleCorrectAnswer = () => {
    playCorrect();
    const newScore = score + 1;
    setScore(newScore);
    setFeedback('✅ Corretto!');
    setShowAnswer(true);
    
    if (newScore === 30) {
      // Vittoria: ferma timer e mostra modale classifica
      setGameOver(true);
      setShowLeaderboardModal(true);
      setFeedback('🎉 HAI VINTO! 30/30 risposte corrette!');
      if (globalTimerRef.current) clearInterval(globalTimerRef.current);
    } else {
      setTimeout(() => {
        nextPlayer();
      }, 2000);
    }
  };

  const nextPlayer = () => {
    // Verifica vittoria (30 risposte corrette)
    if (score >= 30) {
      setGameOver(true);
      setShowLeaderboardModal(true);
      setFeedback(`🎉 HAI VINTO! 30/30 risposte corrette!`);
      if (globalTimerRef.current) clearInterval(globalTimerRef.current);
      return;
    }
    
    if (gameMode === 'transfers') {
      // Verifica se ci sono ancora trasferimenti disponibili
      if (currentIndex >= transfers.length - 1) {
        // Ricarica nuovi trasferimenti per continuare il gioco
        fetch('/data/transfers.csv')
          .then(res => res.text())
          .then(text => {
            const lines = text.split('\n').slice(1);
            const parseCSVLine = (line: string): string[] => {
              const result: string[] = [];
              let current = '';
              let inQuotes = false;
              for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                  inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                  result.push(current.trim());
                  current = '';
                } else {
                  current += char;
                }
              }
              result.push(current.trim());
              return result;
            };
            
            const parsedTransfers: Transfer[] = lines
              .filter(line => line.trim())
              .map(line => {
                const parts = parseCSVLine(line);
                const feeString = parts[5] || '';
                const feeNumeric = parseFloat(feeString.replace(/[^0-9,]/g, '').replace(',', '.')) / 1000000;
                return {
                  player_id: parts[0],
                  transfer_date: parts[1],
                  from_club: parts[2],
                  to_club: parts[3],
                  transfer_fee: feeString,
                  transfer_fee_numeric: feeNumeric,
                  player_name: parts[6] || '',
                };
              })
              .filter(t => t.transfer_fee_numeric > 0);
            
            const shuffled = [...parsedTransfers].sort(() => Math.random() - 0.5);
            const newTransfers = shuffled.slice(0, Math.min(100, shuffled.length));
            
            setTransfers(newTransfers);
            setPreviousTransfer(newTransfers[0]);
            setCurrentIndex(1);
            setTimeLeft(20);
            setFeedback('');
            setShowAnswer(false);
          });
        return;
      }
      
      setPreviousTransfer(transfers[currentIndex]);
    } else {
      // Verifica se ci sono ancora giocatori disponibili
      if (currentIndex >= players.length - 1) {
        // Ricarica nuovi giocatori per continuare il gioco
        let availablePlayers = gameMode === 'gol-totali' || gameMode === 'presenze-totali' 
          ? careerPlayersData 
          : getPlayersByCompetition(competition);
        
        // Se modalità carriera, calcola bestPeriod
        if (gameMode === 'gol-totali' || gameMode === 'presenze-totali') {
          availablePlayers = availablePlayers.map(p => {
            if (!p.career || p.career.length === 0) return p;
            
            // Filtra solo periodi con squadre diverse (almeno 3 per varietà)
            const uniqueTeams = new Set(p.career.map(period => period.team));
            if (uniqueTeams.size < 3) return p; // Escludi giocatori con meno di 3 squadre
            
            let bestPeriod: BestPeriod | undefined;
            
            if (gameMode === 'gol-totali') {
              // Trova top 3 periodi con più gol
              const sortedPeriods = [...p.career]
                .map(period => ({
                  ...period,
                  goals: Math.max(0, period.goals || 0)
                }))
                .sort((a, b) => b.goals - a.goals)
                .slice(0, 3); // Top 3 periodi
              
              // Scegli casualmente uno dei top 3 periodi
              if (sortedPeriods.length > 0) {
                const randomPeriod = sortedPeriods[Math.floor(Math.random() * sortedPeriods.length)];
                bestPeriod = {
                  team: randomPeriod.team,
                  years: randomPeriod.years,
                  value: randomPeriod.goals
                };
              }
            } else if (gameMode === 'presenze-totali') {
              // Trova top 3 periodi con più presenze
              const sortedPeriods = [...p.career]
                .sort((a, b) => (b.apps || 0) - (a.apps || 0))
                .slice(0, 3); // Top 3 periodi
              
              // Scegli casualmente uno dei top 3 periodi
              if (sortedPeriods.length > 0) {
                const randomPeriod = sortedPeriods[Math.floor(Math.random() * sortedPeriods.length)];
                bestPeriod = {
                  team: randomPeriod.team,
                  years: randomPeriod.years,
                  value: randomPeriod.apps || 0
                };
              }
            }
            
            return { ...p, bestPeriod };
          }).filter(p => p.bestPeriod !== undefined); // Filtra giocatori senza periodi validi
        }
        
        const shuffled = [...availablePlayers].sort(() => Math.random() - 0.5);
        const newPlayers = shuffled.slice(0, Math.min(100, shuffled.length));
        
        setPlayers(newPlayers);
        setPreviousPlayer(newPlayers[0]);
        setCurrentIndex(1);
        setTimeLeft(20);
        setFeedback('');
        setShowAnswer(false);
        return;
      }
      
      setPreviousPlayer(players[currentIndex]);
    }
    
    setCurrentIndex(prev => prev + 1);
    setTimeLeft(20);
    setFeedback('');
    setShowAnswer(false);
  };

  const handleGuess = (guess: 'higher' | 'lower') => {
    if (gameOver || showAnswer) return;
    
    if (gameMode === 'transfers') {
      const current = transfers[currentIndex];
      const previous = previousTransfer;
      
      if (!current || !previous) return;
      
      const currentValue = current.transfer_fee_numeric;
      const previousValue = previous.transfer_fee_numeric;
      
      const isHigher = currentValue > previousValue;
      const isEqual = currentValue === previousValue;
      
      const isCorrect = isEqual || (guess === 'higher' && isHigher) || (guess === 'lower' && !isHigher);
      
      if (isCorrect) {
        handleCorrectAnswer();
      } else {
        handleWrongAnswer('❌ Sbagliato!');
      }
    } else {
      const current = players[currentIndex];
      const previous = previousPlayer;
      
      if (!current || !previous) return;
      
      let currentValue: number;
      let previousValue: number;
      
      if (gameMode === 'height') {
        currentValue = parseHeight(current.height);
        previousValue = parseHeight(previous.height);
      } else if (gameMode === 'age') {
        currentValue = parseAge(current.birth_date);
        previousValue = parseAge(previous.birth_date);
      } else if (gameMode === 'gol-totali') {
        currentValue = current.bestPeriod?.value || 0;
        previousValue = previous.bestPeriod?.value || 0;
      } else if (gameMode === 'presenze-totali') {
        currentValue = current.bestPeriod?.value || 0;
        previousValue = previous.bestPeriod?.value || 0;
      } else {
        return; // Modalità non supportata
      }
      
      const isHigher = currentValue > previousValue;
      const isEqual = currentValue === previousValue;
      
      // Gestione parità: se i valori sono uguali, entrambe le risposte sono corrette
      const isCorrect = isEqual || (guess === 'higher' && isHigher) || (guess === 'lower' && !isHigher);
      
      if (isCorrect) {
        handleCorrectAnswer();
      } else {
        handleWrongAnswer('❌ Sbagliato!');
      }
    }
  };

  const getCurrentPlayer = () => players[currentIndex];
  
  const getDisplayValue = (player: Player | null) => {
    if (!player) return '';
    if (gameMode === 'height') {
      return player.height || 'N/A';
    } else if (gameMode === 'age') {
      const age = parseAge(player.birth_date);
      return age ? `${age} anni` : 'N/A';
    } else if (gameMode === 'gol-totali') {
      if (player.bestPeriod) {
        return `${player.bestPeriod.team} (${player.bestPeriod.years}) - ${player.bestPeriod.value} gol`;
      }
      return 'N/A';
    } else if (gameMode === 'presenze-totali') {
      if (player.bestPeriod) {
        return `${player.bestPeriod.team} (${player.bestPeriod.years}) - ${player.bestPeriod.value} presenze`;
      }
      return 'N/A';
    }
    return 'N/A';
  };

  // Restituisce nome + squadra + periodo per gol/presenze totali (domanda)
  const getPlayerContext = (player: Player | null) => {
    if (!player) return '';
    if (gameMode === 'gol-totali' || gameMode === 'presenze-totali') {
      if (player.bestPeriod) {
        return `${extractSurname(player.name)} - ${player.bestPeriod.team} (${player.bestPeriod.years})`;
      }
    }
    return extractSurname(player.name);
  };

  // Restituisce solo il valore numerico per gol/presenze totali (risposta)
  const getNumericValue = (player: Player | null) => {
    if (!player) return '';
    if (gameMode === 'gol-totali') {
      return player.bestPeriod ? `${player.bestPeriod.value} gol` : 'N/A';
    } else if (gameMode === 'presenze-totali') {
      return player.bestPeriod ? `${player.bestPeriod.value} presenze` : 'N/A';
    }
    return getDisplayValue(player);
  };

  if (!gameStarted) {
    return (
      <>
        <NavigationBar onFeedbackClick={() => setIsFeedbackOpen(true)} />
        <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
        <div className="min-h-screen bg-background text-foreground p-8 font-mono pt-24">
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div className="bg-card border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8">
            <h1 className="text-4xl font-display font-bold uppercase text-center mb-4 text-primary">
              📈 PROGRESSIONE
            </h1>
            
            <p className="text-center text-muted-foreground mb-8 font-bold uppercase tracking-widest text-sm">
              {t('progressione.sottotitolo')}
            </p>

              {/* Come si gioca */}
            <div className="bg-card border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 mb-6">
              <button
                onClick={() => setIsHowToPlayOpen(!isHowToPlayOpen)}
                className="w-full text-left"
              >
                <h2 className="text-2xl font-display font-bold uppercase mb-6 flex items-center gap-2 hover:text-primary transition-colors cursor-pointer">
                  <HelpCircle className="h-6 w-6" />
                  {t('setup.comeSiGioca')}
                  <span className="ml-auto text-xl">{isHowToPlayOpen ? '▲' : '▼'}</span>
                </h2>
              </button>
              
              {isHowToPlayOpen && (
              <div className="space-y-4 text-sm">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">1</div>
                  <div>
                    <h3 className="font-bold uppercase">{t('progressione.step1Titolo')}</h3>
                    <p className="text-muted-foreground">{t('progressione.step1Desc')}</p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">2</div>
                  <div>
                    <h3 className="font-bold uppercase">{t('progressione.step2Titolo')}</h3>
                    <p className="text-muted-foreground">{t('progressione.step2Desc')}</p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">3</div>
                  <div>
                    <h3 className="font-bold uppercase">{t('progressione.step3Titolo')}</h3>
                    <p className="text-muted-foreground">{t('progressione.step3Desc')}</p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">4</div>
                  <div>
                    <h3 className="font-bold uppercase">{t('progressione.step4Titolo')}</h3>
                    <p className="text-muted-foreground">{t('progressione.step4Desc')}</p>
                  </div>
                </div>
              </div>
              )}
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                fontWeight: 'bold',
                color: '#333'
              }}>
                {t('setup.modalitaSelezionata')}:
              </label>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setGameMode('gol-totali')}
                  style={{
                    flex: '1 1 calc(50% - 0.5rem)',
                    padding: '1rem',
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    border: `3px solid ${gameMode === 'gol-totali' ? '#f5576c' : '#ddd'}`,
                    background: gameMode === 'gol-totali' ? '#f5576c' : 'white',
                    color: gameMode === 'gol-totali' ? 'white' : '#333',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  ⚽ {t('progressione.golTotali')}
                </button>
                <button
                  onClick={() => setGameMode('presenze-totali')}
                  style={{
                    flex: '1 1 calc(50% - 0.5rem)',
                    padding: '1rem',
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    border: `3px solid ${gameMode === 'presenze-totali' ? '#f5576c' : '#ddd'}`,
                    background: gameMode === 'presenze-totali' ? '#f5576c' : 'white',
                    color: gameMode === 'presenze-totali' ? 'white' : '#333',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  📊 {t('progressione.presenzeTotali')}
                </button>
                <button
                  onClick={() => setGameMode('height')}
                  style={{
                    flex: '1 1 calc(50% - 0.5rem)',
                    padding: '1rem',
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    border: `3px solid ${gameMode === 'height' ? '#f5576c' : '#ddd'}`,
                    background: gameMode === 'height' ? '#f5576c' : 'white',
                    color: gameMode === 'height' ? 'white' : '#333',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  📏 {t('progressione.altezza')}
                </button>
                <button
                  onClick={() => setGameMode('age')}
                  style={{
                    flex: '1 1 calc(50% - 0.5rem)',
                    padding: '1rem',
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    border: `3px solid ${gameMode === 'age' ? '#f5576c' : '#ddd'}`,
                    background: gameMode === 'age' ? '#f5576c' : 'white',
                    color: gameMode === 'age' ? 'white' : '#333',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  🎂 {t('progressione.eta')}
                </button>
                <button
                  onClick={() => setGameMode('transfers')}
                  style={{
                    flex: '1 1 100%',
                    padding: '1rem',
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    border: `3px solid ${gameMode === 'transfers' ? '#f5576c' : '#ddd'}`,
                    background: gameMode === 'transfers' ? '#f5576c' : 'white',
                    color: gameMode === 'transfers' ? 'white' : '#333',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  💰 {t('progressione.trasferimenti')}
                </button>
              </div>
            </div>

            <button
              onClick={startGame}
              style={{
                width: '100%',
                padding: '1.5rem',
                fontSize: '1.5rem',
                fontWeight: 'bold',
                background: '#000',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)',
                marginTop: '1.5rem'
              }}
            >
              ▶ {t('setup.iniziaPartita')}
            </button>
            
            {/* Leaderboard */}
            <div style={{ marginTop: '2rem' }}>
              <h3 className="text-2xl font-display font-bold uppercase text-center mb-4 text-primary">
                🏆 {t('common.classifica')}
              </h3>
              <LeaderboardSection 
                gameType="progressione" 
                competition="serie-a" 
                difficulty={gameMode} 
              />
            </div>
          </div>
        </div>
      </div>
      </>
    );
  }

  const currentPlayer = getCurrentPlayer();

  return (
    <>
      <NavigationBar onFeedbackClick={() => setIsFeedbackOpen(true)} />
      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
      
      <div className="min-h-screen bg-background text-foreground p-4 md:p-8 font-mono">
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Header con stats */}
        <div className="bg-card border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 mb-6 flex justify-between items-center flex-wrap gap-4">
          <div>
            <div className="text-xs text-muted-foreground font-bold uppercase">PUNTEGGIO</div>
            <div className="text-3xl font-display font-bold text-primary">
              {score}/30
            </div>
          </div>
          
          <div>
            <div className="text-xs text-muted-foreground font-bold uppercase">TEMPO RISPOSTA</div>
            <div className={`text-3xl font-display font-bold ${timeLeft <= 3 ? 'text-destructive' : 'text-primary'}`}>
              {timeLeft}s
            </div>
          </div>
          
          <div>
            <div className="text-xs text-muted-foreground font-bold uppercase">TEMPO TOTALE</div>
            <div className="text-3xl font-display font-bold text-accent-foreground">
              {Math.floor(globalTime / 60)}:{(globalTime % 60).toString().padStart(2, '0')}
            </div>
          </div>
        </div>

        {/* Modalità Trasferimenti */}
        {gameMode === 'transfers' && previousTransfer && (
          <div className="bg-card border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 mb-4 text-center">
            <div className="text-xs text-muted-foreground font-bold uppercase mb-2">
              TRASFERIMENTO A
            </div>
            <div className="text-2xl font-display font-bold text-foreground mb-2">
              {previousTransfer.player_name}
            </div>
            <div className="text-sm text-muted-foreground mb-2">
              DA {previousTransfer.from_club} → {previousTransfer.to_club}
            </div>
            <div className="text-3xl font-display font-bold text-primary">
              € {(previousTransfer.transfer_fee_numeric).toLocaleString('it-IT')}M
            </div>
          </div>
        )}

        {gameMode === 'transfers' && transfers[currentIndex] && (
          <div className="bg-card border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8 mb-6 text-center">
            <div className="text-xs text-muted-foreground font-bold uppercase mb-2">
              TRASFERIMENTO B
            </div>
            <div className="text-3xl font-display font-bold text-foreground mb-4">
              {transfers[currentIndex].player_name}
            </div>
            <div className="text-sm text-muted-foreground mb-4">
              DA {transfers[currentIndex].from_club} → {transfers[currentIndex].to_club}
            </div>
            
            {showAnswer && (
              <div className="text-4xl font-display font-bold text-primary mb-4">
                € {(transfers[currentIndex].transfer_fee_numeric).toLocaleString('it-IT')}M
              </div>
            )}
            
            {!showAnswer && !gameOver && (
              <div className="text-4xl font-display font-bold text-muted-foreground mb-6">
                ???
              </div>
            )}
          </div>
        )}

        {/* Modalità Giocatori (Altezza/Età/Gol/Presenze) */}
        {gameMode !== 'transfers' && previousPlayer && (
          <div className="bg-card border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 mb-4 text-center">
            <div className="text-xs text-muted-foreground font-bold uppercase mb-2">
              GIOCATORE PRECEDENTE
            </div>
            <div className="text-2xl font-display font-bold text-foreground mb-2">
              {getPlayerContext(previousPlayer)}
            </div>
            <div className="text-3xl font-display font-bold text-primary">
              {getNumericValue(previousPlayer)}
            </div>
          </div>
        )}

        {gameMode !== 'transfers' && currentPlayer && (
          <div className="bg-card border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8 mb-6 text-center">
            <div className="text-xs text-muted-foreground font-bold uppercase mb-2">
              GIOCATORE CORRENTE
            </div>
            <div className="text-3xl font-display font-bold text-foreground mb-4">
              {getPlayerContext(currentPlayer)}
            </div>
            
            {showAnswer && (
              <div className="text-4xl font-display font-bold text-primary mb-4">
                {getNumericValue(currentPlayer)}
              </div>
            )}
            
            {!showAnswer && !gameOver && (
              <div className="text-xl text-muted-foreground mb-6">
                {gameMode === 'height' && 'È più alto o più basso?'}
                {gameMode === 'age' && 'È più vecchio o più giovane?'}
                {gameMode === 'gol-totali' && 'Ha segnato più gol o meno gol?'}
                {gameMode === 'presenze-totali' && 'Ha più presenze o meno presenze?'}
              </div>
            )}
          </div>
        )}

        {/* Pulsanti risposta */}
        {!showAnswer && !gameOver && (
          <>
            <div className="flex gap-3 mb-4 justify-center items-stretch">
              <button
                onClick={() => handleGuess('higher')}
                className="flex-1 max-w-[200px] p-4 md:p-6 text-base md:text-xl font-display font-bold uppercase bg-secondary text-secondary-foreground border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all text-center leading-tight"
              >
                {gameMode === 'transfers' ? 'MAGGIORE' : gameMode === 'height' ? 'PIÙ ALTO' : gameMode === 'age' ? 'PIÙ VECCHIO' : gameMode === 'gol-totali' ? 'PIÙ GOL' : 'PIÙ PRESENZE'}
              </button>
              <button
                onClick={() => handleGuess('lower')}
                className="flex-1 max-w-[200px] p-4 md:p-6 text-base md:text-xl font-display font-bold uppercase bg-primary text-primary-foreground border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all text-center leading-tight"
              >
                {gameMode === 'transfers' ? 'MINORE' : gameMode === 'height' ? 'PIÙ BASSO' : gameMode === 'age' ? 'PIÙ GIOVANE' : gameMode === 'gol-totali' ? 'MENO GOL' : 'MENO PRESENZE'}
              </button>
            </div>
            <div className="flex justify-center mb-6">
              <button
                onClick={startGame}
                className="px-6 py-2 text-sm font-bold bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors border-2 border-black"
              >
                🔄 Ricomincia
              </button>
            </div>
          </>
        )}

        {/* Feedback */}
        {feedback && (
          <div className="bg-card border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 mb-4 text-center">
            <div className={`text-2xl font-display font-bold uppercase ${feedback.includes('✅') || feedback.includes('🎉') ? 'text-secondary' : 'text-destructive'}`}>
              {feedback}
            </div>
          </div>
        )}

        {/* Pulsanti fine gioco */}
        {gameOver && (
          <div className="flex gap-4">
            <button
              onClick={startGame}
              className="flex-1 p-4 text-lg font-display font-bold uppercase bg-primary text-primary-foreground border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
            >
              🔄 NUOVA PARTITA
            </button>
            <button
              onClick={() => setLocation('/')}
              className="flex-1 p-4 text-lg font-display font-bold uppercase bg-muted text-muted-foreground border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
            >
              🏠 MENU
            </button>
          </div>
        )}
        
        {/* Modale Classifica */}
        {showLeaderboardModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '2rem',
            maxWidth: '500px',
            width: '90%',
            border: '3px solid #333',
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
          }}>
            <h2 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#f5576c', textAlign: 'center' }}>
              🏆 Vittoria!
            </h2>
            <p style={{ fontSize: '1.2rem', textAlign: 'center', marginBottom: '1.5rem' }}>
              Tempo totale: <strong>{Math.floor(globalTime / 60)}:{(globalTime % 60).toString().padStart(2, '0')}</strong>
            </p>
            
            {!leaderboardSaved ? (
              <>
                {user ? (
                  <>
                    <p style={{ marginBottom: '1rem', textAlign: 'center', fontSize: '1.1rem' }}>
                      Salvataggio automatico come <strong>{user.username ? `@${user.username}` : user.name}</strong>...
                    </p>
                    <button
                      onClick={async () => {
                        const displayName = user.username ? `@${user.username}` : (user.name || 'Utente');
                        
                        saveScoreMutation.mutate({
                          gameType: 'progressione',
                          playerName: displayName,
                          timeSeconds: globalTime,
                          competition: 'serie-a',
                          difficulty: gameMode,
                        }, {
                          onSuccess: async () => {
                            setLeaderboardSaved(true);
                            setPlayerName(displayName);
                            await refetchLeaderboard();
                            
                            // Salva anche nello storico personale
                            saveUserScoreMutation.mutate({
                              gameType: 'progressione',
                              score: currentIndex, // Numero di giocatori indovinati
                              timeSeconds: globalTime,
                              competition: competition,
                              difficulty: gameMode,
                            });

                            // Achievement: Progressione Master
                            const candidates: { achievementId: string; tier: 1 | 2 | 3 }[] = [
                              { achievementId: 'progressione-master', tier: 1 },
                            ];
                            if (globalTime <= 180) candidates.push({ achievementId: 'progressione-master', tier: 2 });
                            if (globalTime <= 120) candidates.push({ achievementId: 'progressione-master', tier: 3 });
                            unlock(candidates);
                          },
                          onError: (error) => {
                            console.error('Errore salvataggio:', error);
                            alert('Errore nel salvataggio. Riprova.');
                          }
                        });
                      }}
                      style={{
                        width: '100%',
                        padding: '1rem',
                        fontSize: '1.1rem',
                        fontWeight: 'bold',
                        background: '#f5576c',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        marginBottom: '0.5rem'
                      }}
                    >
                      💾 Salva Tempo
                    </button>
                    <button
                      onClick={() => setShowLeaderboardModal(false)}
                      style={{
                        width: '100%',
                        padding: '1rem',
                        fontSize: '1.1rem',
                        fontWeight: 'bold',
                        background: '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer'
                      }}
                    >
                      ❌ Salta
                    </button>
                  </>
                ) : (
                  <>
                    <p style={{ marginBottom: '1rem', textAlign: 'center' }}>{t('progressione.inserisciNomeClassifica')}</p>
                    <input
                      type="text"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      placeholder={t('progressione.tuoNome')}
                      maxLength={100}
                      style={{
                        width: '100%',
                        padding: '1rem',
                        fontSize: '1.1rem',
                        border: '2px solid #f5576c',
                        borderRadius: '8px',
                        marginBottom: '1rem'
                      }}
                    />
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <button
                        onClick={() => {
                          if (!playerName.trim()) {
                            alert('Inserisci un nome!');
                            return;
                          }
                          saveScoreMutation.mutate({
                            gameType: 'progressione',
                            playerName: playerName.trim(),
                            timeSeconds: globalTime,
                            competition: 'serie-a',
                            difficulty: gameMode,
                          }, {
                            onSuccess: async () => {
                              setLeaderboardSaved(true);
                              await refetchLeaderboard();
                            },
                            onError: (error) => {
                              console.error('Errore salvataggio classifica:', error);
                              alert('Errore nel salvataggio. Riprova.');
                            }
                          });
                        }}
                        style={{
                          flex: 1,
                          padding: '1rem',
                          fontSize: '1.1rem',
                          fontWeight: 'bold',
                          background: '#f5576c',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer'
                        }}
                      >
                        💾 Salva
                      </button>
                      <button
                        onClick={() => setShowLeaderboardModal(false)}
                        style={{
                          flex: 1,
                          padding: '1rem',
                          fontSize: '1.1rem',
                          fontWeight: 'bold',
                          background: '#6c757d',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer'
                        }}
                      >
                        ❌ Salta
                      </button>
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                <p style={{ fontSize: '1.2rem', textAlign: 'center', marginBottom: '1rem', color: '#27ae60' }}>
                  ✅ Tempo salvato nella classifica!
                </p>
                
                {/* Top 10 Classifica */}
                <div style={{ 
                  background: '#f8f9fa', 
                  borderRadius: '8px', 
                  padding: '1rem', 
                  marginBottom: '1rem',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}>
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', textAlign: 'center', color: '#f5576c' }}>
                    🏆 Top 10 Classifica
                  </h3>
                  {leaderboardData && leaderboardData.length > 0 ? (
                    <div style={{ fontSize: '0.9rem' }}>
                      {leaderboardData.map((entry, index) => (
                        <div key={entry.id} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '0.5rem',
                          borderBottom: index < leaderboardData.length - 1 ? '1px solid #dee2e6' : 'none',
                          background: entry.playerName === playerName.trim() ? '#fff3cd' : 'transparent'
                        }}>
                          <span style={{ fontWeight: index < 3 ? 'bold' : 'normal' }}>
                            {index + 1}. {entry.playerName}
                          </span>
                          <span style={{ fontWeight: index < 3 ? 'bold' : 'normal' }}>
                            {Math.floor(entry.timeSeconds / 60)}:{(entry.timeSeconds % 60).toString().padStart(2, '0')}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ textAlign: 'center', color: '#6c757d', margin: '1rem 0' }}>Nessun record disponibile</p>
                  )}
                </div>
                
                <button
                  onClick={() => setShowLeaderboardModal(false)}
                  style={{
                    width: '100%',
                    padding: '1rem',
                    fontSize: '1.1rem',
                    fontWeight: 'bold',
                    background: '#f5576c',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  ✅ OK
                </button>
              </>
            )}
          </div>
        </div>
        )}

        {/* Pulsante Supporta il Progetto */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem', paddingBottom: '2rem' }}>
          <a 
            href="https://www.paypal.com/pool/9lCKCiF8hN?sr=wccr" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ textDecoration: 'none' }}
          >
            <button
              style={{
                padding: '1.5rem 3rem',
                fontSize: '1.25rem',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                background: 'linear-gradient(to right, #10b981, #059669)',
                color: 'white',
                border: '4px solid black',
                boxShadow: '8px 8px 0px 0px rgba(0,0,0,1)',
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '12px 12px 0px 0px rgba(0,0,0,1)';
                e.currentTarget.style.background = 'linear-gradient(to right, #059669, #047857)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '8px 8px 0px 0px rgba(0,0,0,1)';
                e.currentTarget.style.background = 'linear-gradient(to right, #10b981, #059669)';
              }}
            >
              ❤️ Supporta il Progetto
          </button>
        </a>
      </div>

      {/* Donation Progress */}
      <div style={{ maxWidth: '28rem', margin: '0 auto' }}>
        <DonationProgress />
      </div>
      </div>
    </div>
    </>
  );
}
