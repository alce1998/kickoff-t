import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Trophy, Eye, EyeOff, Flame } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useSound } from "@/hooks/useSound";
import { NavigationBar } from "@/components/NavigationBar";
import { FeedbackModal } from "@/components/FeedbackModal";
import { DonationProgress } from "@/components/DonationProgress";

// Import database unico (stesso di CarriereAllenamento)
import carriereDataRaw from "@/data/verified_careers_wiki.json";
import { useTranslation } from "react-i18next";

interface CareerEntry {
  years: string;
  team: string;
  apps: number;
  goals: number;
}
interface PlayerCareer {
  url: string;
  found: boolean;
  career: CareerEntry[];
  nationality: string;
  position: string;
  birth_year: number;
}

interface GroupedTeam {
  name: string;
  period: string;
  appearances: number;
  goals: number;
}

type CarriereDatabase = Record<string, PlayerCareer>;

// Converti database da oggetto a formato utilizzabile
const carriereData = carriereDataRaw as unknown as CarriereDatabase;

// Grandi squadre per calcolo livelli
const BIG_CLUBS = ["Inter", "Juventus", "Milan", "Roma", "Lazio", "Fiorentina"];

// Calcola presenze totali nelle grandi squadre
function calculateBigClubApps(career: CareerEntry[]): number {
  return career.reduce((total, period) => {
    if (BIG_CLUBS.includes(period.team)) {
      return total + Math.abs(period.apps); // Math.abs per gestire portieri con apps negativi
    }
    return total;
  }, 0);
}

// Determina livello in base a presenze grandi squadre
function getPlayerLevel(bigClubApps: number): number {
  if (bigClubApps >= 250) return 0; // Livello 1
  if (bigClubApps >= 175) return 1; // Livello 2
  if (bigClubApps >= 100) return 2; // Livello 3
  if (bigClubApps >= 30) return 3;  // Livello 4
  if (bigClubApps >= 1) return 4;   // Livello 5 (1-30 presenze grandi squadre)
  return 5; // Livello 6 e 7 (0 presenze grandi squadre)
}

// Filtra giocatori per livello
function getPlayersForLevel(level: number): string[] {
  return Object.entries(carriereData)
    .filter(([_, player]) => {
      const bigClubApps = calculateBigClubApps(player.career);
      return getPlayerLevel(bigClubApps) === level;
    })
    .map(([name]) => name);
}

const LEVEL_NAMES = [
  "Livello 1: Leggende (250+ presenze grandi squadre)",
  "Livello 2: Veterani (175-249 presenze grandi squadre)",
  "Livello 3: Esperti (100-174 presenze grandi squadre)",
  "Livello 4: Emergenti (30-99 presenze grandi squadre)",
  "Livello 5: Esordienti (1-29 presenze grandi squadre)",
  "Livello 6: Sconosciuti (0 presenze grandi squadre)",
  "Livello 7: Impossibile (0 presenze, no indizi)",
];

export default function CarriereSfida() {
  const { playCorrect, playWrong, playVictory } = useSound();
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  
  // Stato gioco
  const [currentLevel, setCurrentLevel] = useState(0); // 0-6 (7 livelli)
  const [currentPlayer, setCurrentPlayer] = useState<{ name: string; data: PlayerCareer } | null>(null);
  const [groupedCareer, setGroupedCareer] = useState<GroupedTeam[]>([]);
  const [userGuess, setUserGuess] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredPlayers, setFilteredPlayers] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  // Sistema indizi (5 totali per tutto il gioco)
  const [totalHintsUsed, setTotalHintsUsed] = useState(0);
  const [showNationality, setShowNationality] = useState(false);
  const [showPosition, setShowPosition] = useState(false);
  const [showBirthYear, setShowBirthYear] = useState(false);
  
  // Stato UI
  const [revealedPlayer, setRevealedPlayer] = useState(false);
  const [gameState, setGameState] = useState<"playing" | "won" | "lost">("playing");
  const [gameStarted, setGameStarted] = useState(false);

  // Raggruppa la carriera per squadra
  const groupCareer = (career: CareerEntry[]): GroupedTeam[] => {
    const filtered = career.filter(entry => entry.team && entry.years);
    
    const cleaned = filtered.map(entry => ({
      ...entry,
      team: entry.team.replace('→', '').trim()
    }));

    return cleaned.map(entry => ({
      name: entry.team,
      period: entry.years,
      appearances: entry.apps,
      goals: entry.goals
    }));
  };

  // Seleziona giocatore casuale dal livello corrente
  const selectRandomPlayer = (level: number) => {
    // Livello 7 (indice 6) usa lo stesso pool del livello 6 (indice 5)
    const poolLevel = level === 6 ? 5 : level;
    const playersForLevel = getPlayersForLevel(poolLevel);
    if (playersForLevel.length === 0) {
      console.error(`Nessun giocatore trovato per livello ${level}`);
      return;
    }
    const randomIndex = Math.floor(Math.random() * playersForLevel.length);
    const playerName = playersForLevel[randomIndex];
    const playerData = carriereData[playerName];
    
    setCurrentPlayer({ name: playerName, data: playerData });
    setGroupedCareer(groupCareer(playerData.career));
    resetPlayerState();
  };

  const resetPlayerState = () => {
    setUserGuess("");
    setShowNationality(false);
    setShowPosition(false);
    setShowBirthYear(false);
    setRevealedPlayer(false);
    setGameState("playing");
  };

  const startGame = () => {
    setGameStarted(true);
    setCurrentLevel(0);
    setTotalHintsUsed(0);
    selectRandomPlayer(0);
  };

  const restartGame = () => {
    setGameStarted(false);
    setCurrentLevel(0);
    setTotalHintsUsed(0);
    setCurrentPlayer(null);
    setGameState("playing");
  };

  // Avvia automaticamente il gioco quando il componente si monta
  useEffect(() => {
    startGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const extractPlayerName = (fullName: string): string => {
    return fullName.trim();
  };

  const normalizeString = (str: string): string => {
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, "")
      .trim();
  };

  const levenshteinDistance = (str1: string, str2: string): number => {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
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
    
    return matrix[str2.length][str1.length];
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userGuess.trim() || !currentPlayer) return;

    const playerName = extractPlayerName(currentPlayer.name);
    const normalizedGuess = normalizeString(userGuess);
    const normalizedAnswer = normalizeString(playerName);

    const surnameParts = playerName.split(' ');
    const surname = surnameParts[surnameParts.length - 1];
    const normalizedSurname = normalizeString(surname);

    // Verifica match esatto
    if (normalizedGuess === normalizedAnswer || normalizedGuess === normalizedSurname) {
      handleCorrectAnswer();
      return;
    }

    // Verifica similarità
    const distanceFull = levenshteinDistance(normalizedGuess, normalizedAnswer);
    const distanceSurname = levenshteinDistance(normalizedGuess, normalizedSurname);
    const minDistance = Math.min(distanceFull, distanceSurname);
    const maxLength = Math.max(normalizedGuess.length, Math.min(normalizedAnswer.length, normalizedSurname.length));
    
    if (minDistance <= Math.floor(maxLength * 0.2)) {
      handleCorrectAnswer();
      return;
    }

    // Risposta errata - GAME OVER
    handleWrongAnswer();
  };

  const handleCorrectAnswer = () => {
    if (!currentPlayer) return;
    
    playCorrect();
    setRevealedPlayer(true);
    toast.success(`🎉 ${t('carriere.corretto')} ${currentPlayer.name}`);
    
    // Verifica se ha completato tutti i 7 livelli
    if (currentLevel === 6) {
      playVictory();
      setGameState("won");
      toast.success(`🏆 ${t('carriereSfida.haiVinto')} ${totalHintsUsed}/5`);
    } else {
      // Passa al livello successivo
      setTimeout(() => {
        const nextLevel = currentLevel + 1;
        setCurrentLevel(nextLevel);
        selectRandomPlayer(nextLevel);
        toast.info(`📈 ${LEVEL_NAMES[nextLevel]}`);
      }, 2000);
    }
  };

  const handleWrongAnswer = () => {
    if (!currentPlayer) return;
    
    playWrong();
    setRevealedPlayer(true);
    setGameState("lost");
    toast.error(`❌ ${t('carriere.sbagliato')} ${currentPlayer.name}. ${t('carriereSfida.ricomincia')}`);
  };

  const toggleHint = (hint: 'nationality' | 'position' | 'birthYear') => {
    if (totalHintsUsed >= 5) {
      toast.error(`❌ ${t('carriereSfida.indiziEsauriti')}`);
      return;
    }
    
    if (hint === 'nationality' && !showNationality) {
      setShowNationality(true);
      setTotalHintsUsed(prev => prev + 1);
    } else if (hint === 'position' && !showPosition) {
      setShowPosition(true);
      setTotalHintsUsed(prev => prev + 1);
    } else if (hint === 'birthYear' && !showBirthYear) {
      setShowBirthYear(true);
      setTotalHintsUsed(prev => prev + 1);
    }
  };

  if (!gameStarted) {
    return (
      <>
        <NavigationBar onFeedbackClick={() => setIsFeedbackOpen(true)} />
        <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
        
        <div className="min-h-screen bg-background text-foreground p-4 md:p-8 pt-20">
          <div className="max-w-4xl mx-auto">
            <Button
              variant="outline"
              onClick={() => setLocation('/carriere')}
              className="gap-2 mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              Torna al Setup
            </Button>

            <Card className="p-6 md:p-8 bg-card border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <h1 className="text-3xl md:text-4xl font-display font-bold uppercase text-center mb-2 text-primary flex items-center justify-center gap-3">
                <Flame className="w-10 h-10 text-orange-500" />
                MODALITÀ SFIDA
              </h1>
              <p className="text-center text-muted-foreground mb-6 font-bold uppercase tracking-widest text-sm">
                5 LIVELLI DI DIFFICOLTÀ PROGRESSIVA
              </p>

              <div className="space-y-4 mb-8">
                <div className="bg-orange-100 border-2 border-orange-500 rounded-lg p-4">
                  <h3 className="font-bold text-lg mb-2 text-orange-700">🎯 Obiettivo</h3>
                  <p className="text-gray-700">
                    Indovina <strong>7 giocatori</strong> in <strong>7 livelli</strong> di difficoltà crescente.
                    Ogni livello presenta giocatori con meno presenze in Serie A!
                  </p>
                </div>

                <div className="bg-red-100 border-2 border-red-500 rounded-lg p-4">
                  <h3 className="font-bold text-lg mb-2 text-red-700">⚠️ Regole</h3>
                  <ul className="list-disc pl-5 space-y-1 text-gray-700">
                    <li>{t('carriereSfida.regola1')}</li>
                    <li>{t('carriereSfida.regola2')}</li>
                    <li>{t('carriereSfida.regola3')}</li>
                  </ul>
                </div>

                <div className="bg-blue-100 border-2 border-blue-500 rounded-lg p-4">
                  <h3 className="font-bold text-lg mb-2 text-blue-700">📊 Livelli</h3>
                  <ol className="list-decimal pl-5 space-y-1 text-gray-700">
                    <li>Leggende (250+ presenze grandi squadre) - 54 giocatori</li>
                    <li>Veterani (175-249 presenze grandi squadre) - 45 giocatori</li>
                    <li>Esperti (100-174 presenze grandi squadre) - 86 giocatori</li>
                    <li>Emergenti (30-99 presenze grandi squadre) - 209 giocatori</li>
                    <li>Esordienti (&lt;30 presenze grandi squadre) - 862 giocatori</li>
                  </ol>
                  <p className="text-sm text-gray-600 mt-2 italic">Grandi squadre: Inter, Juventus, Milan, Roma, Lazio, Fiorentina</p>
                </div>
              </div>

              <Button
                onClick={startGame}
                className="w-full"
                size="lg"
                variant="default"
              >
                <Flame className="w-5 h-5 mr-2" />
                Inizia la Sfida
              </Button>
            </Card>

            <DonationProgress />
          </div>
        </div>
      </>
    );
  }

  if (!currentPlayer) {
    return (
      <>
        <NavigationBar onFeedbackClick={() => setIsFeedbackOpen(true)} />
        <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center pt-16">
          <p>Caricamento...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <NavigationBar onFeedbackClick={() => setIsFeedbackOpen(true)} />
      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
      
      <div className="bg-background text-foreground p-4 md:p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <Button
              variant="outline"
              onClick={() => setLocation('/carriere')}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Esci
            </Button>
            <div className="flex gap-4 items-center">
              <div className="text-lg font-bold">
                Indizi: <span className={totalHintsUsed >= 5 ? 'text-red-500' : 'text-primary'}>{totalHintsUsed}/5</span>
              </div>
              <div className="text-lg font-bold">
                Livello: {currentLevel + 1}/7
              </div>
            </div>
          </div>

          {/* Progress bar livelli */}
          <div className="mb-6">
            <div className="flex gap-2">
              {[0, 1, 2, 3, 4, 5, 6].map((level) => (
                <div
                  key={level}
                  className={`flex-1 h-3 rounded-full ${
                    level < currentLevel
                      ? 'bg-green-500'
                      : level === currentLevel
                      ? 'bg-orange-500'
                      : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
            <p className="text-center mt-2 font-bold text-sm">
              {LEVEL_NAMES[currentLevel]}
            </p>
          </div>

          {/* Card principale */}
          <Card className="p-6 md:p-8 bg-card border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <h1 className="text-3xl md:text-4xl font-display font-bold uppercase text-center mb-2 text-primary">
              INDOVINA IL GIOCATORE
            </h1>
            <p className="text-center text-muted-foreground mb-6 font-bold uppercase tracking-widest text-sm">
              DALLA SUA CARRIERA
            </p>

            {/* Tabella carriera */}
            <div className="overflow-x-auto mb-6">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-primary text-primary-foreground">
                    <th className="border-2 border-black p-1.5 sm:p-2 text-left font-bold uppercase text-xs sm:text-sm">Club</th>
                    <th className="border-2 border-black p-1.5 sm:p-2 text-center font-bold uppercase text-xs sm:text-sm">ANNI</th>
                    <th className="border-2 border-black p-1.5 sm:p-2 text-center font-bold uppercase text-xs sm:text-sm">Pres.</th>
                    <th className="border-2 border-black p-1.5 sm:p-2 text-center font-bold uppercase text-xs sm:text-sm">Gol</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedCareer.map((team, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-muted/50' : 'bg-background'}>
                      <td className="border-2 border-border p-1.5 sm:p-2 font-semibold text-xs sm:text-sm">{team.name}</td>
                      <td className="border-2 border-border p-1.5 sm:p-2 text-center text-xs sm:text-sm">{team.period}</td>
                      <td className="border-2 border-border p-1.5 sm:p-2 text-center text-xs sm:text-sm">{team.appearances}</td>
                      <td className="border-2 border-border p-1.5 sm:p-2 text-center text-xs sm:text-sm">{team.goals}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Indizi */}
            {gameStarted && currentPlayer && currentLevel !== 6 && (
              <div className="space-y-2">
                <Button
                  variant="outline"
                  onClick={() => toggleHint('nationality')}
                  className="gap-2 justify-start"
                  disabled={showNationality || totalHintsUsed >= 5}
                >
                  {showNationality ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  🌍 Nazionalità: {showNationality ? currentPlayer.data.nationality : '???'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => toggleHint('position')}
                  className="gap-2 justify-start"
                  disabled={showPosition || totalHintsUsed >= 5}
                >
                  {showPosition ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  ⚽ Ruolo: {showPosition ? currentPlayer.data.position : '???'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => toggleHint('birthYear')}
                  className="gap-2 justify-start"
                  disabled={showBirthYear || totalHintsUsed >= 5}
                >
                  {showBirthYear ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  📅 Anno: {showBirthYear ? currentPlayer.data.birth_year : '???'}
                </Button>
              </div>
            )}
            {gameStarted && currentPlayer && currentLevel === 6 && (
              <div className="bg-red-100 border-2 border-red-500 rounded-lg p-3 text-center">
                <p className="font-bold text-red-700">⚠️ LIVELLO 7: NESSUN INDIZIO DISPONIBILE</p>
              </div>
            )}

            {/* Risposta rivelata */}
            {revealedPlayer && (
              <div className={`p-4 rounded-lg mb-6 text-center ${
                gameState === 'won' 
                  ? 'bg-green-100 border-2 border-green-500' 
                  : gameState === 'lost'
                  ? 'bg-red-100 border-2 border-red-500'
                  : 'bg-blue-100 border-2 border-blue-500'
              }`}>
                <p className="text-2xl font-bold">
                  {gameState === 'won' && '🏆 '}
                  {gameState === 'lost' && '❌ '}
                  {currentPlayer.name}
                </p>
                {gameState === 'won' && (
                  <p className="mt-2 text-lg">
                    Completati tutti i 7 livelli! Indizi usati: {totalHintsUsed}/5
                  </p>
                )}
              </div>
            )}

            {/* Input risposta */}
            {!revealedPlayer && (
              <form onSubmit={handleSubmit} className="space-y-4 mb-6">
                <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={userGuess}
                  onChange={(e) => {
                    const value = e.target.value;
                    setUserGuess(value);
                    
                    if (value.trim().length >= 2) {
                      const normalizedInput = value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
                      const allPlayers = Object.keys(carriereData);
                      const matches = allPlayers
                        .filter(name => name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '').includes(normalizedInput))
                        .slice(0, 10);
                      setFilteredPlayers(matches);
                      setShowSuggestions(matches.length > 0);
                      setSelectedIndex(-1);
                    } else {
                      setShowSuggestions(false);
                      setFilteredPlayers([]);
                    }
                  }}
                  placeholder={t('carriere.indovinaGiocatore')}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-lg ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  autoFocus
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
                      setUserGuess(selected);
                      setShowSuggestions(false);
                    } else if (e.key === 'Escape') {
                      setShowSuggestions(false);
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowSuggestions(false), 200);
                  }}
                  onFocus={() => {
                    if (userGuess.trim().length >= 2 && filteredPlayers.length > 0) {
                      setShowSuggestions(true);
                    }
                  }}
                />
                
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
                    {filteredPlayers.map((playerName, index) => (
                      <div
                        key={playerName}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setUserGuess(playerName);
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
                          {playerName}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                </div>
                
                <Button type="submit" className="w-full" size="lg">
                  Verifica
                </Button>
              </form>
            )}

            {/* Azioni post-risposta */}
            {revealedPlayer && gameState === 'lost' && (
              <Button
                onClick={restartGame}
                className="w-full"
                size="lg"
                variant="destructive"
              >
                Ricomincia da Capo
              </Button>
            )}

            {revealedPlayer && gameState === 'won' && (
              <div className="space-y-3">
                <Button
                  onClick={restartGame}
                  className="w-full"
                  size="lg"
                  variant="default"
                >
                  Gioca Ancora
                </Button>
                <Button
                  onClick={() => setLocation('/carriere')}
                  className="w-full"
                  size="lg"
                  variant="outline"
                >
                  Torna al Menu
                </Button>
              </div>
            )}
          </Card>

          <DonationProgress />
        </div>
      </div>
    </>
  );
}
