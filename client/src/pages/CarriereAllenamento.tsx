import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Trophy, Eye, EyeOff } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useSound } from "@/hooks/useSound";
import { NavigationBar } from "@/components/NavigationBar";
import { FeedbackModal } from "@/components/FeedbackModal";
import { DonationProgress } from "@/components/DonationProgress";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import carriereData from "@/data/verified_careers_wiki.json";
import { useTranslation } from "react-i18next";
import { useAchievements } from "@/hooks/useAchievements";

interface CareerEntry {
  years: string;
  team: string;
  apps: number;
  goals: number;
}

interface PlayerCareer {
  url?: string;
  found: boolean;
  reason?: string;
  career: CareerEntry[];
  nationality?: string;
  position?: string;
  birth_year?: number;
}

interface GroupedTeam {
  name: string;
  period: string;
  appearances: number;
  goals: number;
}

type CarriereDatabase = Record<string, PlayerCareer>;

export default function CarriereAllenamento() {
  const { playCorrect, playWrong } = useSound();
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { unlock } = useAchievements();
  const recordGamePlayed = trpc.achievements.recordGamePlayed.useMutation();
  const saveScoreMutation = trpc.gameScores.saveScore.useMutation();

  // Poliglotta: record that the user played this game
  useEffect(() => {
    if (user) recordGamePlayed.mutate({ gameType: 'carriera' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [currentPlayer, setCurrentPlayer] = useState<{ name: string; data: PlayerCareer } | null>(null);
  const [groupedCareer, setGroupedCareer] = useState<GroupedTeam[]>([]);
  const [userGuess, setUserGuess] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredPlayers, setFilteredPlayers] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showNationality, setShowNationality] = useState(false);
  const [showPosition, setShowPosition] = useState(false);
  const [showBirthYear, setShowBirthYear] = useState(false);
  const [revealedPlayer, setRevealedPlayer] = useState(false);
  const [gameState, setGameState] = useState<"playing" | "won" | "lost">("playing");
  const [score, setScore] = useState(0);
  const [gamesPlayed, setGamesPlayed] = useState(0);

  // Raggruppa la carriera per squadra
  const groupCareer = (career: CareerEntry[]): GroupedTeam[] => {
    const filtered = career.filter(entry => entry.team && entry.years);
    
    // Rimuovi freccia prestito e pulisci nome squadra
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

  // Filtra le voci di carriera valide (stesso criterio di groupCareer)
  const getValidClubs = (career: CareerEntry[]): CareerEntry[] => {
    return career.filter(entry => entry.team && entry.team.trim() !== '' && entry.years && entry.years.trim() !== '');
  };

  // Seleziona giocatore casuale con almeno 2 squadre valide
  const selectRandomPlayer = () => {
    const database = carriereData as unknown as CarriereDatabase;
    const playerNames = Object.keys(database);
    
    // Filtra solo giocatori con almeno 2 squadre valide
    const validPlayerNames = playerNames.filter(name => {
      const playerData = database[name];
      if (!playerData?.career || !Array.isArray(playerData.career)) return false;
      const validClubs = getValidClubs(playerData.career);
      return validClubs.length >= 2;
    });
    
    if (validPlayerNames.length === 0) return;
    
    const randomName = validPlayerNames[Math.floor(Math.random() * validPlayerNames.length)];
    const playerData = database[randomName];
    
    setCurrentPlayer({ name: randomName, data: playerData });
    setGroupedCareer(groupCareer(playerData.career));
    resetGame();
  };

  const resetGame = () => {
    setUserGuess("");
    setShowNationality(false);
    setShowPosition(false);
    setShowBirthYear(false);
    setRevealedPlayer(false);
    setGameState("playing");
  };

  useEffect(() => {
    selectRandomPlayer();
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

    // Estrai cognome (ultima parola)
    const surnameParts = playerName.split(' ');
    const surname = surnameParts[surnameParts.length - 1];
    const normalizedSurname = normalizeString(surname);

    // Verifica match esatto
    if (normalizedGuess === normalizedAnswer || normalizedGuess === normalizedSurname) {
      setGameState("won");
      playCorrect();
      setRevealedPlayer(true);
      setScore(prev => prev + 1);
      setGamesPlayed(prev => prev + 1);
      toast.success(`🎉 ${t('carriere.corretto')} ${playerName}`);
      return;
    }

    // Verifica similarità (tolleranza errori di battitura)
    const distanceFull = levenshteinDistance(normalizedGuess, normalizedAnswer);
    const distanceSurname = levenshteinDistance(normalizedGuess, normalizedSurname);
    const minDistance = Math.min(distanceFull, distanceSurname);
    const maxLength = Math.max(normalizedGuess.length, Math.min(normalizedAnswer.length, normalizedSurname.length));
    
    if (minDistance <= Math.floor(maxLength * 0.2)) {
      setGameState("won");
      playCorrect();
      setRevealedPlayer(true);
      setScore(prev => prev + 1);
      setGamesPlayed(prev => prev + 1);
      toast.success(`🎉 ${t('carriere.corretto')} ${playerName}`);
      return;
    }

    // Risposta errata - MARATONA: azzera punteggio e rivela giocatore
    playWrong();
    setRevealedPlayer(true);
    setGameState("lost");
    
    if (score > 0) {
      toast.error(`❌ ${t('carriere.sbagliato')} ${currentPlayer.name}. ${t('carriere.punteggio')}: ${score}`);
    } else {
      toast.error(`❌ ${t('carriere.sbagliato')} ${currentPlayer.name}`);
    }
    
    setUserGuess("");
  };

  const handleNextPlayer = () => {
    // Reset punteggio solo se era in stato lost
    if (gameState === "lost") {
      setScore(0);
      setGamesPlayed(0);
    }
    selectRandomPlayer();
  };



  const toggleHint = (hint: 'nationality' | 'position' | 'birthYear') => {
    if (hint === 'nationality') setShowNationality(!showNationality);
    if (hint === 'position') setShowPosition(!showPosition);
    if (hint === 'birthYear') setShowBirthYear(!showBirthYear);
  };

  if (!currentPlayer) {
    return (
      <>
        <NavigationBar onFeedbackClick={() => setIsFeedbackOpen(true)} />
        <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
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
              Torna alla Home
            </Button>

          </div>

          {/* Punteggio */}
          <div className="text-center mb-6">
            <p className="text-xl font-bold flex items-center justify-center gap-2">
              Punteggio: {score}/{gamesPlayed} <Trophy className="w-5 h-5 text-yellow-500" />
            </p>
          </div>

          {/* Card principale */}
          <Card className="p-6 md:p-8 bg-card border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <h1 className="text-3xl md:text-4xl font-display font-bold uppercase text-center mb-2 text-primary">
              INDOVINA IL GIOCATORE
            </h1>


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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
              <Button
                variant="outline"
                onClick={() => toggleHint('nationality')}
                className="gap-2 justify-start"
              >
                {showNationality ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                🌍 Nazionalità: {showNationality ? currentPlayer.data.nationality : '???'}
              </Button>
              <Button
                variant="outline"
                onClick={() => toggleHint('position')}
                className="gap-2 justify-start"
              >
                {showPosition ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                ⚽ Ruolo: {showPosition ? currentPlayer.data.position : '???'}
              </Button>
              <Button
                variant="outline"
                onClick={() => toggleHint('birthYear')}
                className="gap-2 justify-start"
              >
                {showBirthYear ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                📅 Anno: {showBirthYear ? currentPlayer.data.birth_year : '???'}
              </Button>
            </div>



            {/* Risposta rivelata */}
            {revealedPlayer && (
              <div className={`p-4 rounded-lg mb-6 text-center ${
                gameState === 'won' ? 'bg-green-100 border-2 border-green-500' : 'bg-red-100 border-2 border-red-500'
              }`}>
                <p className="text-2xl font-bold">
                  {gameState === 'won' ? '🎉 ' : ''}
                  {currentPlayer.name}
                </p>
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
                      const allPlayers = Object.keys(carriereData as unknown as CarriereDatabase);
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

            {/* Prossimo giocatore o Salva Punteggio */}
            {revealedPlayer && gameState === 'won' && (
              <Button
                onClick={handleNextPlayer}
                className="w-full"
                size="lg"
                variant="default"
              >
                Prossimo Giocatore
              </Button>
            )}
            
            {/* Salva Punteggio quando perde */}
            {revealedPlayer && gameState === 'lost' && score > 0 && (
              <div className="space-y-3">
                {user ? (
                  <Button
                    onClick={() => {
                      saveScoreMutation.mutate({
                        gameType: "carriere",
                        score: score,
                        difficulty: "maratona"
                      }, {
                        onSuccess: (data) => {
                          if (data.improved) {
                            toast.success(`🏆 ${t('carriere.nuovoRecord')}`);
                          } else {
                            toast.success(`✅ ${t('carriere.punteggioRegistrato')} ${data.bestScore}`);
                          }
                          // Maratoneta achievement based on consecutive correct guesses
                          const candidates: { achievementId: string; tier: 1 | 2 | 3 }[] = [];
                          if (score >= 2) candidates.push({ achievementId: 'maratoneta', tier: 1 });
                          if (score >= 5) candidates.push({ achievementId: 'maratoneta', tier: 2 });
                          if (score >= 10) candidates.push({ achievementId: 'maratoneta', tier: 3 });
                          if (candidates.length > 0) unlock(candidates);
                          handleNextPlayer();
                        },
                        onError: () => {
                          toast.error(`❌ ${t('carriere.erroreSalvataggio')}`);
                        }
                      });
                    }}
                    className="w-full"
                    size="lg"
                    variant="default"
                    disabled={saveScoreMutation.isPending}
                  >
                    💾 Salva Punteggio ({score})
                  </Button>
                ) : (
                  <div className="bg-yellow-100 border-2 border-yellow-500 rounded-lg p-4 text-center">
                    <p className="text-yellow-800 font-bold mb-2">
                      ⚠️ Accedi per salvare il punteggio nella classifica globale
                    </p>
                  </div>
                )}
                <Button
                  onClick={handleNextPlayer}
                  className="w-full"
                  size="lg"
                  variant="outline"
                >
                  Continua Senza Salvare
                </Button>
              </div>
            )}
            
            {/* Se perde con score 0, solo pulsante continua */}
            {revealedPlayer && gameState === 'lost' && score === 0 && (
              <Button
                onClick={handleNextPlayer}
                className="w-full"
                size="lg"
                variant="default"
              >
                Prossimo Giocatore
              </Button>
            )}
          </Card>

          <DonationProgress />
        </div>
      </div>
    </>
  );
}
