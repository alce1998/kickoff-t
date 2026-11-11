import React, { useState, useEffect, useRef } from 'react';
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
import { trpc } from '../lib/trpc';
import { useTranslation } from 'react-i18next';
import { useAchievements } from '@/hooks/useAchievements';

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
};

type Competition = 'serie-a' | 'serie-b' | 'premier-league' | 'la-liga' | 'bundesliga' | 'ligue-1';

const competitions: { value: Competition; label: string }[] = [
  { value: 'serie-a', label: 'Serie A' },
  { value: 'premier-league', label: 'Premier League' },
  { value: 'la-liga', label: 'La Liga' },
  { value: 'bundesliga', label: 'Bundesliga' },
  { value: 'ligue-1', label: 'Ligue 1' },
];

// Mappa squadre per campionato
const teamsByCompetition: Record<Competition, string[]> = {
  'serie-a': ['Inter', 'Milan', 'Juventus', 'Roma', 'Napoli', 'Lazio', 'Fiorentina', 'Atalanta', 'Bologna', 'Torino', 'Udinese', 'Empoli', 'Cagliari', 'Genoa', 'Lecce', 'Parma', 'Como', 'Monza', 'Palermo', 'Sampdoria', 'Catania', 'Barcelona', 'Real Madrid', 'Man Utd', 'Bayern', 'Chelsea', 'Liverpool', 'Arsenal', 'PSG', 'Atletico Madrid'],
  'serie-b': [],
  'premier-league': ['Arsenal', 'Liverpool', 'Man City', 'Man Utd', 'Chelsea', 'Tottenham', 'Newcastle', 'Brighton', 'Aston Villa', 'West Ham', 'Crystal Palace', 'Fulham', 'Wolves', 'Everton', 'Brentford', 'Nottingham', 'Bournemouth', 'Leicester', 'Ipswich', 'Southampton'],
  'la-liga': ['Real Madrid', 'Barcelona', 'Atletico Madrid', 'Sevilla', 'Real Sociedad', 'Villarreal', 'Athletic Bilbao', 'Real Betis', 'Valencia', 'Celta Vigo', 'Osasuna', 'Rayo Vallecano', 'Mallorca', 'Getafe', 'Girona', 'Espanyol', 'Alaves', 'Las Palmas', 'Leganes', 'Valladolid'],
  'bundesliga': ['Bayern', 'Dortmund', 'Lipsia', 'Leverkusen', 'Eintracht', 'Friburgo', 'Union Berlino', 'Wolfsburg', 'Stoccarda', 'Hoffenheim', 'Mainz', 'Borussia M\'gladbach', 'Colonia', 'Augsburg', 'Werder Brema', 'Bochum', 'Heidenheim', 'St. Pauli'],
  'ligue-1': ['PSG', 'Monaco', 'Marsiglia', 'Lione', 'Lille', 'Nizza', 'Lens', 'Rennes', 'Strasburgo', 'Brest', 'Montpellier', 'Nantes', 'Reims', 'Tolosa', 'Auxerre', 'Angers', 'Le Havre', 'St Etienne'],
};

function normalizeTeamName(name: string): string {
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Rimuove accenti
    .replace(/[^a-z0-9\s]/g, '') // Rimuove caratteri speciali
    .trim();
}

function findCommonPlayers(teams: string[]): Player[] {
  const normalizedTeams = teams.map(normalizeTeamName);
  
  return playersData.filter((player: Player) => {
    const playerTeams = player.career_teams
      .map(t => normalizeTeamName(t.name))
      .filter(name => {
        // Escludi squadre giovanili, nazionali, riserve
        return !name.includes('u19') && 
               !name.includes('u21') && 
               !name.includes('u23') && 
               !name.includes('u17') &&
               !name.includes('primavera') &&
               !name.includes('youth') &&
               !name.includes(' ii') &&
               !name.includes(' b ') &&
               name.length > 2;
      });
    
    // Verifica che il giocatore abbia giocato in TUTTE le squadre richieste
    return normalizedTeams.every(reqTeam => 
      playerTeams.some(playerTeam => 
        playerTeam.includes(reqTeam) || reqTeam.includes(playerTeam)
      )
    );
  });
}

function extractSurname(fullName: string): string {
  // Rimuove numero maglia se presente (es. "#10 Messi" -> "Messi")
  const withoutNumber = fullName.replace(/^#\d+\s+/, '');
  const parts = withoutNumber.trim().split(' ');
  return parts[parts.length - 1];
}

function normalizeName(name: string): string {
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '');
}

export default function LinkGame() {
  const { playCorrect, playWrong } = useSound();
  const [, setLocation] = useLocation();
  const [dataLoaded, setDataLoaded] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  // Carica database dinamicamente
  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch('/data/serie_a_players_careers_2000_2025.json');
        playersData = await response.json();
        setDataLoaded(true);
      } catch (error) {
        console.error('Errore caricamento dati:', error);
      }
    };
    loadData();
  }, []);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [competition, setCompetition] = useState<Competition>('serie-a');
  const [difficulty, setDifficulty] = useState<'easy' | 'hard'>('easy');
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  
  const [currentTeams, setCurrentTeams] = useState<string[]>([]);
  const [validPlayers, setValidPlayers] = useState<Player[]>([]);
  const [userAnswer, setUserAnswer] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [score, setScore] = useState(0);
  const [globalTime, setGlobalTime] = useState(0); // Timer globale in secondi
  const [feedback, setFeedback] = useState('');
  const [gameOver, setGameOver] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [leaderboardSaved, setLeaderboardSaved] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const globalTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { user } = useAuth();
  const { t } = useTranslation();
  const { unlock } = useAchievements();
  const recordGamePlayed = trpc.achievements.recordGamePlayed.useMutation();
  const saveScoreMutation = trpc.leaderboard.saveScore.useMutation();
  const saveUserScoreMutation = trpc.gameScores.saveScore.useMutation();

  // Poliglotta: record that the user played this game
  useEffect(() => {
    if (user) recordGamePlayed.mutate({ gameType: 'link' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
  const { data: leaderboardData, refetch: refetchLeaderboard } = trpc.leaderboard.getTopScores.useQuery(
    {
      gameType: 'link',
      competition: competition,
      difficulty: difficulty,
      limit: 10,
    },
    { enabled: false } // Non eseguire automaticamente
  );



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



  const startGame = () => {
    const numTeams = difficulty === 'easy' ? 2 : 3;
    const availableTeams = teamsByCompetition[competition];
    const minPlayers = difficulty === 'easy' ? 3 : 1; // Minimo giocatori richiesti
    
    // Prova fino a 50 volte a trovare squadre con giocatori in comune
    let attempts = 0;
    let selectedTeams: string[] = [];
    let common: Player[] = [];
    
    while (attempts < 50) {
      const shuffled = [...availableTeams].sort(() => Math.random() - 0.5);
      selectedTeams = shuffled.slice(0, numTeams);
      common = findCommonPlayers(selectedTeams);
      
      // Valida che ci siano abbastanza giocatori in comune
      if (common.length >= minPlayers) break;
      attempts++;
    }
    
    if (common.length < minPlayers) {
      alert(`Non sono riuscito a trovare squadre con almeno ${minPlayers} giocator${minPlayers > 1 ? 'i' : 'e'} in comune. Prova un altro campionato.`);
      return;
    }
    
    setCurrentTeams(selectedTeams);
    setValidPlayers(common);
    setGameStarted(true);
    setScore(0);
    setGlobalTime(0);
    setGameOver(false);
    setUserAnswer('');
    // Porta la schermata di gioco in cima, allineata alla schermata di setup
    window.scrollTo({ top: 0, behavior: 'instant' });
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const generateNewTeams = () => {
    const numTeams = difficulty === 'easy' ? 2 : 3;
    const availableTeams = teamsByCompetition[competition];
    const minPlayers = difficulty === 'easy' ? 3 : 1; // Minimo giocatori richiesti
    
    // Prova fino a 50 volte a trovare squadre con giocatori in comune
    let attempts = 0;
    let selectedTeams: string[] = [];
    let common: Player[] = [];
    
    while (attempts < 50) {
      const shuffled = [...availableTeams].sort(() => Math.random() - 0.5);
      selectedTeams = shuffled.slice(0, numTeams);
      common = findCommonPlayers(selectedTeams);
      
      // Valida che ci siano abbastanza giocatori in comune
      if (common.length >= minPlayers) break;
      attempts++;
    }
    
    if (common.length < minPlayers) {
      // Fallback: termina il gioco se non trova più squadre valide
      setGameOver(true);
      setFeedback('⚠️ Non ci sono più combinazioni di squadre disponibili!');
      return;
    }
    
    setCurrentTeams(selectedTeams);
    setValidPlayers(common);
  };

  const handleWrongAnswer = (message: string) => {
    playWrong();
    setFeedback(message);
    setUserAnswer('');
    
    // Penalità +10 secondi
    setGlobalTime(prev => prev + 10);
    
    // Genera nuove squadre dopo risposta errata
    setTimeout(() => {
      generateNewTeams();
      setFeedback('');
    }, 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAnswer.trim() || gameOver) return;
    
    const normalizedAnswer = normalizeName(userAnswer.trim());
    
    // Verifica se il giocatore è valido
    const matchedPlayer = validPlayers.find(player => {
      if (!player.name) return false;
      const surname = extractSurname(player.name);
      const normalizedSurname = normalizeName(surname);
      const normalizedFullName = normalizeName(player.name);
      
      return normalizedAnswer === normalizedSurname || 
             normalizedAnswer === normalizedFullName;
    });
    
    if (!matchedPlayer) {
      handleWrongAnswer('❌ Giocatore non valido!');
      return;
    }
    
    // Controllo "già usato" rimosso - permetti stesso giocatore più volte
    
    // Risposta corretta!
    playCorrect();
    setScore(prev => prev + 1);
    setFeedback(`✅ Corretto! ${matchedPlayer.name ? extractSurname(matchedPlayer.name) : 'Giocatore'}`);
    setUserAnswer('');
    
    // Verifica vittoria
    const winCondition = difficulty === 'easy' ? 30 : 10;
    if (score + 1 === winCondition) {
      setGameOver(true);
      setShowLeaderboardModal(true);
      setFeedback(`🎉 HAI VINTO! ${winCondition}/${winCondition} link completati!`);
    } else {
      // Genera nuove squadre dopo risposta corretta
      setTimeout(() => {
        generateNewTeams();
        setFeedback('');
      }, 2000);
    }
  };

  if (!gameStarted) {
    return (
      <>
        <NavigationBar onFeedbackClick={() => setIsFeedbackOpen(true)} />
        <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
        <div className="min-h-screen bg-background text-foreground p-8 pt-24 font-mono">
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div className="bg-card border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8">
            <h1 className="text-4xl font-display font-bold uppercase text-center mb-4 text-primary">
              🔗 LINK
            </h1>
            
            <p className="text-center text-muted-foreground mb-8 font-bold uppercase tracking-widest text-sm">
              {t('link.sottotitolo')}
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
                    <h3 className="font-bold uppercase">{t('link.step1Titolo')}</h3>
                    <p className="text-muted-foreground">{t('link.step1Desc')}</p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">2</div>
                  <div>
                    <h3 className="font-bold uppercase">{t('link.step2Titolo')}</h3>
                    <p className="text-muted-foreground">{t('link.step2Desc')}</p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">3</div>
                  <div>
                    <h3 className="font-bold uppercase">{t('link.step3Titolo')}</h3>
                    <p className="text-muted-foreground">{t('link.step3Desc')}</p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">4</div>
                  <div>
                     <h3 className="font-bold uppercase">{t('link.step4Titolo')}</h3>
                    <p className="text-muted-foreground">{t('link.step4Desc')}</p>
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
                {t('link.difficolta')}:
              </label>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  onClick={() => setDifficulty('easy')}
                  style={{
                    flex: 1,
                    padding: '1rem',
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    border: `3px solid ${difficulty === 'easy' ? '#f5576c' : '#ddd'}`,
                    background: difficulty === 'easy' ? '#f5576c' : 'white',
                    color: difficulty === 'easy' ? 'white' : '#333',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  {t('link.facile')}<br/><small>({t('link.facile2squadre')})</small>
                </button>
                <button
                  onClick={() => setDifficulty('hard')}
                  style={{
                    flex: 1,
                    padding: '1rem',
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    border: `3px solid ${difficulty === 'hard' ? '#f5576c' : '#ddd'}`,
                    background: difficulty === 'hard' ? '#f5576c' : 'white',
                    color: difficulty === 'hard' ? 'white' : '#333',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  {t('link.difficile')}<br/><small>({t('link.difficile3squadre')})</small>
                </button>
              </div>
            </div>

            <button
              onClick={startGame}
              disabled={!dataLoaded}
              style={{
                width: '100%',
                padding: '1.5rem',
                fontSize: '1.5rem',
                fontWeight: 'bold',
                opacity: dataLoaded ? 1 : 0.5,
                background: '#000',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)'
              }}
            >
              ▶ {t('setup.iniziaPartita')}
            </button>
            
            {/* Leaderboard */}
            <div style={{ marginTop: '2rem' }}>
              <h3 className="text-2xl font-display font-bold uppercase text-center mb-4 text-primary">
                🏆 {t('common.classifica')}
              </h3>
              <LeaderboardSection gameType="link" competition={competition} difficulty={difficulty} />
            </div>
          </div>
        </div>
      </div>
      </>
    );
  }

  return (
    <>
      <NavigationBar onFeedbackClick={() => setIsFeedbackOpen(true)} />
      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
      
      <div className="min-h-screen bg-background text-foreground p-4 md:p-8 font-mono">
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Header con stats */}
        <div className="bg-card border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 mb-6 flex justify-between items-center flex-wrap gap-4">
          <div>
            <div className="text-xs text-muted-foreground font-bold uppercase">LINK COMPLETATI</div>
            <div className="text-3xl font-display font-bold text-primary">
              {score}/{difficulty === 'easy' ? 30 : 10}
            </div>
          </div>
          

          
          <div>
            <div className="text-xs text-muted-foreground font-bold uppercase">TEMPO TOTALE</div>
            <div className="text-3xl font-display font-bold text-accent-foreground">
              {Math.floor(globalTime / 60)}:{(globalTime % 60).toString().padStart(2, '0')}
            </div>
          </div>
        </div>

        {/* Squadre */}
        <div className="bg-card border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8 mb-6 text-center">
          <h2 className="text-2xl font-display font-bold uppercase mb-6 text-foreground">
            {t('link.trovaGiocatore')}
          </h2>
          
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            gap: '1.5rem',
            flexWrap: 'wrap',
            margin: '0 auto',
            maxWidth: '100%'
          }}>
            {currentTeams.map((team, idx) => (
              <React.Fragment key={idx}>
                <div className="bg-primary text-primary-foreground px-8 py-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-2xl font-display font-bold uppercase min-w-[120px] text-center">
                  {team}
                </div>
              </React.Fragment>
            ))}
          </div>
          
          <div style={{ 
            marginTop: '1rem', 
            fontSize: '0.9rem', 
            color: '#999'
          }}>
            {validPlayers.length} {t('link.giocatoriDisponibili')}
          </div>
        </div>

        {/* Input risposta */}
        <form onSubmit={handleSubmit} style={{
          background: 'white',
          borderRadius: '12px',
          padding: '2rem',
          boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
          border: '3px solid #333'
        }}>
          <div style={{ position: 'relative' }}>
          <input
            ref={inputRef}
            type="text"
            value={userAnswer}
            onChange={(e) => {
              const value = e.target.value;
              setUserAnswer(value);
              
              if (value.trim().length >= 2) {
                const normalizedInput = normalizeName(value);
                const matches = playersData
                  .filter(p => p.name && normalizeName(p.name).includes(normalizedInput))
                  .slice(0, 10);
                setFilteredPlayers(matches);
                setShowSuggestions(matches.length > 0);
                setSelectedIndex(-1);
              } else {
                setShowSuggestions(false);
                setFilteredPlayers([]);
              }
            }}
            onKeyDown={(e) => {
              if (!showSuggestions) return;
              
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => 
                  prev < filteredPlayers.length - 1 ? prev + 1 : prev
                );
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
              } else if (e.key === 'Enter' && selectedIndex >= 0) {
                e.preventDefault();
                const selected = filteredPlayers[selectedIndex];
                setUserAnswer(selected.name || '');
                setShowSuggestions(false);
              } else if (e.key === 'Escape') {
                setShowSuggestions(false);
              }
            }}
            onBlur={() => {
              setTimeout(() => setShowSuggestions(false), 200);
            }}
            onFocus={() => {
              if (userAnswer.trim().length >= 2 && filteredPlayers.length > 0) {
                setShowSuggestions(true);
              }
            }}
            placeholder={t('link.placeholderGiocatore')}
            disabled={gameOver}
            style={{
              width: '100%',
              padding: '1rem',
              fontSize: '1.2rem',
              border: '2px solid #667eea',
              borderRadius: '8px',
              marginBottom: '1rem',
              background: gameOver ? '#f5f5f5' : 'white'
            }}
          />
          
          {/* Dropdown autocompletamento */}
          {showSuggestions && filteredPlayers.length > 0 && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              background: 'white',
              border: '2px solid #667eea',
              borderTop: 'none',
              borderRadius: '0 0 8px 8px',
              maxHeight: '300px',
              overflowY: 'auto',
              zIndex: 1000,
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}>
              {filteredPlayers.map((player, index) => (
                <div
                  key={player.player_id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setUserAnswer(player.name || '');
                    setShowSuggestions(false);
                  }}
                  style={{
                    padding: '0.75rem 1rem',
                    cursor: 'pointer',
                    background: index === selectedIndex ? '#f0f0ff' : 'white',
                    borderBottom: index < filteredPlayers.length - 1 ? '1px solid #eee' : 'none',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div style={{ fontWeight: 'bold', color: '#333' }}>
                    {player.name?.replace(/^#\d+\s+/, '')}
                  </div>
                  {player.current_team && (
                    <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
                      {player.current_team.name}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          </div>
          
          <button
            type="submit"
            disabled={gameOver || !userAnswer.trim()}
            style={{
              width: '100%',
              padding: '1rem',
              fontSize: '1.2rem',
              fontWeight: 'bold',
              background: gameOver || !userAnswer.trim() ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: gameOver || !userAnswer.trim() ? 'not-allowed' : 'pointer',
              marginBottom: '1rem'
            }}
          >
            INVIA RISPOSTA
          </button>
          
          {!gameOver && (
            <button
              type="button"
              onClick={startGame}
              style={{
                width: '100%',
                padding: '0.5rem',
                fontSize: '0.9rem',
                fontWeight: 'bold',
                background: '#6c757d',
                color: 'white',
                border: '2px solid black',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              🔄 Ricomincia
            </button>
          )}
          
          {feedback && (
            <div style={{
              marginTop: '1rem',
              padding: '1rem',
              background: feedback.includes('✅') ? '#d4edda' : feedback.includes('🎉') ? '#d1ecf1' : '#f8d7da',
              color: feedback.includes('✅') ? '#155724' : feedback.includes('🎉') ? '#0c5460' : '#721c24',
              borderRadius: '8px',
              textAlign: 'center',
              fontSize: '1.1rem',
              fontWeight: 'bold'
            }}>
              {feedback}
            </div>
          )}
          
          {gameOver && (
            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
              <button
                onClick={startGame}
                style={{
                  flex: 1,
                  padding: '1rem',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                🔄 NUOVA PARTITA
              </button>
              <button
                onClick={() => setLocation('/')}
                style={{
                  flex: 1,
                  padding: '1rem',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                🏠 MENU
              </button>
            </div>
          )}
        </form>
      </div>
      
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
            <h2 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#667eea', textAlign: 'center' }}>
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
                        
                        // Salva nella leaderboard con username
                        saveScoreMutation.mutate({
                          gameType: 'link',
                          playerName: displayName,
                          timeSeconds: globalTime,
                          competition: competition,
                          difficulty: difficulty,
                        }, {
                          onSuccess: async () => {
                            setLeaderboardSaved(true);
                            setPlayerName(displayName);
                            await refetchLeaderboard();
                            
                            // Salva anche nello storico personale
                            saveUserScoreMutation.mutate({
                              gameType: 'link',
                              score: validPlayers.length,
                              timeSeconds: globalTime,
                              competition: competition,
                              difficulty: difficulty,
                            });

                            // Achievement: Mercato Invernale (easy) / Mercato Estivo (hard)
                            const achId = difficulty === 'easy' ? 'mercato-invernale' : 'mercato-estivo';
                            const candidates: { achievementId: string; tier: 1 | 2 | 3 }[] = [
                              { achievementId: achId, tier: 1 },
                            ];
                            if (globalTime <= 600) candidates.push({ achievementId: achId, tier: 2 });
                            if (globalTime <= 420) candidates.push({ achievementId: achId, tier: 3 });
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
                        background: '#667eea',
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
                    <p style={{ marginBottom: '1rem', textAlign: 'center' }}>{t('link.inserisciNomeClassifica')}</p>
                    <input
                      type="text"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      placeholder={t('link.tuoNome')}
                      maxLength={100}
                      style={{
                        width: '100%',
                        padding: '1rem',
                        fontSize: '1.1rem',
                        border: '2px solid #667eea',
                        borderRadius: '8px',
                        marginBottom: '1rem'
                      }}
                    />
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <button
                        onClick={async () => {
                          if (!playerName.trim()) {
                            alert('Inserisci un nome!');
                            return;
                          }
                          saveScoreMutation.mutate({
                            gameType: 'link',
                            playerName: playerName.trim(),
                            timeSeconds: globalTime,
                            competition: competition,
                            difficulty: difficulty,
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
                          background: '#667eea',
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
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', textAlign: 'center', color: '#667eea' }}>
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
                    background: '#667eea',
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
    </>
  );
}
