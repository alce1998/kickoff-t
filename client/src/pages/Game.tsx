import { useState, useEffect, useRef } from "react";
import { getRandomMatch, getMatchOfTheDay, Match, checkAnswer, checkAnswerWithScore } from "@/lib/game-logic";
import { PlayerList } from "@/components/PlayerList";
import { SetupGame } from "@/components/SetupGame";
import { Button } from "@/components/ui/button";
import { RefreshCw, Users, Trophy, AlertTriangle, Loader2, Heart } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useSound } from "@/hooks/useSound";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { NavigationBar } from "@/components/NavigationBar";
import { FeedbackModal } from "@/components/FeedbackModal";
import { useTranslation } from "react-i18next";
import { useAchievements } from "@/hooks/useAchievements";
import { useAuth } from "@/_core/hooks/useAuth";
import { useMatchGuard } from "@/contexts/MatchGuardContext";

// Helper per estrarre i giocatori dalla formazione (gestisce sia array diretto che oggetto con .players)
const getFormationPlayers = (formation: any) => {
  if (Array.isArray(formation)) {
    return formation; // Array diretto (Champions/Premier/Nazionali)
  }
  return formation?.players || []; // Oggetto con .players (Serie A)
};

type GameState = 'setup' | 'playing' | 'finished' | 'gameover' | 'transition';

const MAX_LIVES = 5;
const MAX_HINTS = 5;

interface PlayerScore {
  name: string;
  score: number;
  errors: number;
  lives: number;
  eliminated: boolean;
}

export default function Game() {
  const { playCorrect, playWrong } = useSound();
  const { t } = useTranslation();
  const { unlock } = useAchievements();
  const { isAuthenticated } = useAuth({});
  const { setMatchActive, confirmExit } = useMatchGuard();
  const recordGamePlayed = trpc.achievements.recordGamePlayed.useMutation();
  const saveScore = trpc.gameScores.saveScore.useMutation();
  const [scoreSaved, setScoreSaved] = useState(false);

  const [gameState, setGameState] = useState<GameState>('setup');
  const [players, setPlayers] = useState<PlayerScore[]>([]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);

  useEffect(() => {
    setMatchActive(gameState === 'playing');
  }, [gameState, setMatchActive]);

  // Poliglotta: record that the user played this game
  useEffect(() => {
    if (isAuthenticated) recordGamePlayed.mutate({ gameType: 'formazioni' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);
  const [winner, setWinner] = useState<string | null>(null);
  const [showFormations, setShowFormations] = useState(false);
  const [hintsUsedByPlayer, setHintsUsedByPlayer] = useState<Record<string, number>>({});
  const [gameMode, setGameMode] = useState<'challenge' | 'training'>('challenge');
  const [isMatchOfTheDay, setIsMatchOfTheDay] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  const getCurrentPlayerHintsUsed = () => {
    const currentPlayerName = players[currentPlayerIndex]?.name;
    return currentPlayerName ? (hintsUsedByPlayer[currentPlayerName] || 0) : 0;
  };

  const canUseHint = () => {
    if (gameMode === 'training') return true; // Indizi infiniti in modalità allenamento
    return getCurrentPlayerHintsUsed() < MAX_HINTS;
  };

  const handleUseHint = () => {
    const currentPlayerName = players[currentPlayerIndex]?.name;
    if (currentPlayerName && canUseHint()) {
      setHintsUsedByPlayer(prev => ({
        ...prev,
        [currentPlayerName]: (prev[currentPlayerName] || 0) + 1
      }));
    }
  };
  
  const [currentMatch, setCurrentMatch] = useState<Match | null>(null);
  const [revealedHome, setRevealedHome] = useState<boolean[]>([]);
  const [revealedAway, setRevealedAway] = useState<boolean[]>([]);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | 'duplicate' | null>(null);
  const [lastGuessedPlayer, setLastGuessedPlayer] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Salvataggio automatico punteggio a fine partita (solo modalità sfida, solo utenti autenticati)
  useEffect(() => {
    if (gameState === 'gameover' && isAuthenticated && gameMode === 'challenge' && !scoreSaved) {
      const totalScore = players.reduce((sum, p) => sum + p.score, 0);
      const totalRevealed = revealedHome.filter(Boolean).length + revealedAway.filter(Boolean).length;
      saveScore.mutate({
        gameType: 'formazioni',
        score: totalScore,
        competition: currentMatch?.competition ?? undefined,
        metadata: JSON.stringify({ playersFound: totalRevealed, totalPlayers: 22, players: players.map(p => ({ name: p.name, score: p.score })) }),
      });
      setScoreSaved(true);
    }
    if (gameState !== 'gameover') setScoreSaved(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

  const handleStartGame = (playerNames: string[], mode: 'challenge' | 'training') => {
    setGameMode(mode);
    setPlayers(playerNames.map(name => ({ name, score: 0, errors: 0, lives: MAX_LIVES, eliminated: false })));
    // Random starting player
    setCurrentPlayerIndex(Math.floor(Math.random() * playerNames.length));
    startNewMatch(playerNames.map(name => ({ name, score: 0, errors: 0, lives: MAX_LIVES, eliminated: false })));
    setGameState('playing');
  };

  const startNewMatch = (resetPlayers?: PlayerScore[]) => {
    try {
      // Se è la modalità "partita del giorno", usa getMatchOfTheDay invece di getRandomMatch
      const match = isMatchOfTheDay ? getMatchOfTheDay() : getRandomMatch();
      setCurrentMatch(match as unknown as Match);
    } catch (error) {
      // Nessuna partita disponibile per i filtri selezionati
      toast.error(error instanceof Error ? error.message : t('game.erroreCaricamento'));
      setGameState('setup');
      return;
    }
    setRevealedHome(new Array(11).fill(false));
    setRevealedAway(new Array(11).fill(false));
    setFeedback(null);
    setLastGuessedPlayer(null);
    setWinner(null);
    setShowFormations(false);
    // Reset indizi per tutti i giocatori
    setHintsUsedByPlayer({});
    // Reset punteggi ma mantieni le vite se non viene passato resetPlayers
    if (resetPlayers) {
      setPlayers(resetPlayers);
    } else {
      setPlayers(prev => prev.map(p => ({ ...p, score: 0, errors: 0, lives: MAX_LIVES, eliminated: false })));
    }
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.focus();
    }
  };

  const revealAllPlayers = () => {
    setRevealedHome(new Array(11).fill(true));
    setRevealedAway(new Array(11).fill(true));
  };

  const getActivePlayers = () => players.filter(p => !p.eliminated);

  const nextTurn = () => {
    const activePlayers = getActivePlayers();
    
    // Se c'è un solo giocatore (modalità solitario), non cambiare turno
    if (players.length === 1) {
      if (inputRef.current) {
        inputRef.current.value = '';
        inputRef.current.focus();
      }
      return;
    }
    
    // Multiplayer: se rimane un solo giocatore attivo, ha vinto
    if (activePlayers.length <= 1) {
      const winnerPlayer = activePlayers[0];
      if (winnerPlayer) {
        setWinner(winnerPlayer.name);
        revealAllPlayers();
        setGameState('gameover');
      }
      return;
    }

    // Trova il prossimo giocatore non eliminato
    let nextIndex = (currentPlayerIndex + 1) % players.length;
    while (players[nextIndex].eliminated) {
      nextIndex = (nextIndex + 1) % players.length;
    }
    setCurrentPlayerIndex(nextIndex);
    
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.focus();
    }
  };

  const checkGameOver = (updatedPlayers: PlayerScore[]) => {
    const activePlayers = updatedPlayers.filter(p => !p.eliminated);
    
    // Modalità solitario: game over quando il giocatore perde tutte le vite
    if (updatedPlayers.length === 1 && activePlayers.length === 0) {
      setWinner(null); // Nessun vincitore in solitario
      revealAllPlayers();
      setGameState('gameover');
      return true;
    }
    
    // Multiplayer: game over quando rimane un solo giocatore
    if (updatedPlayers.length > 1 && activePlayers.length <= 1) {
      const winnerPlayer = activePlayers[0];
      if (winnerPlayer) {
        setWinner(winnerPlayer.name);
        revealAllPlayers();
        setGameState('gameover');
      }
      return true;
    }
    return false;
  };

  const getPointsForRank = (rank: number) => {
    return 1;
  };

  const handleGlobalInput = (inputName: string) => {
    if (!currentMatch || !inputName.trim() || gameState === 'gameover') return;

    let found = false;
    let isDuplicate = false;
    let foundPlayerName = "";
    let pointsEarned = 0;

    // Copie locali per accumulare modifiche
    const newRevealedHome = [...revealedHome];
    const newRevealedAway = [...revealedAway];
    
    // Conteggi attuali per calcolo progressivo
    let homeCount = revealedHome.filter(Boolean).length;
    let awayCount = revealedAway.filter(Boolean).length;

    // Raccogli tutti i match possibili con il loro score
    const homeMatches: Array<{ index: number, player: any, score: number }> = [];
    const awayMatches: Array<{ index: number, player: any, score: number }> = [];

    // Cerca nella squadra di casa
    getFormationPlayers(currentMatch.homeFormation).forEach((player: any, index: number) => {
      const result = checkAnswerWithScore(inputName, player.name);
      if (result.matches && !newRevealedHome[index]) {
        homeMatches.push({ index, player, score: result.score });
      }
    });

    // Cerca nella squadra ospite
    getFormationPlayers(currentMatch.awayFormation).forEach((player: any, index: number) => {
      const result = checkAnswerWithScore(inputName, player.name);
      if (result.matches && !newRevealedAway[index]) {
        awayMatches.push({ index, player, score: result.score });
      }
    });
    
    // Combina tutti i match
    const allMatches = [...homeMatches, ...awayMatches];
    
    if (allMatches.length > 0) {
      // Trova il miglior score (0 = esatto, 1 = fuzzy)
      const bestScore = Math.min(...allMatches.map(m => m.score));
      
      // Filtra solo i match con il miglior score
      const bestMatches = allMatches.filter(m => m.score === bestScore);
      
      // Rivela tutti i match con il miglior score
      bestMatches.forEach(match => {
        if (homeMatches.includes(match)) {
          newRevealedHome[match.index] = true;
          homeCount++;
          pointsEarned += getPointsForRank(homeCount);
        } else {
          newRevealedAway[match.index] = true;
          awayCount++;
          pointsEarned += getPointsForRank(awayCount);
        }
        found = true;
        foundPlayerName = match.player.name;
      });
    }

    if (found) {
      playCorrect();
      setRevealedHome(newRevealedHome);
      setRevealedAway(newRevealedAway);
      setFeedback('correct');
      // Check Overthinker achievement: all 22 players found
      if (newRevealedHome.every(Boolean) && newRevealedAway.every(Boolean) && isAuthenticated) {
        const candidates: { achievementId: string; tier: 1 | 2 | 3 }[] = [
          { achievementId: 'overthinker', tier: 1 }, // Bronze: all 22 in any mode
        ];
        if (gameMode === 'challenge') {
          // Silver: all 22 in challenge mode with max 2 errors (lives >= MAX_LIVES - 2)
          const currentLives = players[currentPlayerIndex]?.lives ?? 0;
          const totalErrors = players[currentPlayerIndex]?.errors ?? 0;
          if (totalErrors <= 2) {
            candidates.push({ achievementId: 'overthinker', tier: 2 });
          }
          // Gold: all 22 in challenge mode with 0 errors (full lives)
          if (currentLives === MAX_LIVES) {
            candidates.push({ achievementId: 'overthinker', tier: 3 });
          }
        }
        unlock(candidates);
      }
      setPlayers(prev => {
        const newPlayers = [...prev];
        newPlayers[currentPlayerIndex].score += pointsEarned;
        return newPlayers;
      });
      setLastGuessedPlayer(foundPlayerName);
      if (inputRef.current) inputRef.current.value = '';
      // Cambio turno anche se indovina
      setTimeout(nextTurn, 1500);
    } else {
      playWrong();
      setFeedback('wrong');
      setPlayers(prev => {
        const newPlayers = [...prev];
        
        // In modalità allenamento, non togliere vite
        if (gameMode === 'challenge') {
          newPlayers[currentPlayerIndex].lives -= 1;
          newPlayers[currentPlayerIndex].errors += 1;
          
          // Controlla se il giocatore è eliminato
          if (newPlayers[currentPlayerIndex].lives <= 0) {
            newPlayers[currentPlayerIndex].eliminated = true;
          }
          
          // Controlla se il gioco è finito
          if (!checkGameOver(newPlayers)) {
            // Passa il turno se sbaglia
            setTimeout(nextTurn, 1500);
          }
        } else {
          // Modalità allenamento: conta gli errori ma non toglie vite
          newPlayers[currentPlayerIndex].errors += 1;
          // Passa il turno anche in allenamento
          setTimeout(nextTurn, 1500);
        }
        
        return newPlayers;
      });
      setLastGuessedPlayer(null);
    }

    // Reset feedback dopo un po'
    setTimeout(() => setFeedback(null), 2000);
  };

  const handleNewMatch = () => {
    if (gameState === 'gameover') {
      // Reset completo per nuova partita
      startNewMatch();
      setGameState('playing');
    } else {
      // Rivela tutti i giocatori prima di procedere
      revealAllPlayers();
      // Mostra schermata di transizione con banner pubblicitario
      setGameState('transition');
      setTimeout(() => {
        startNewMatch();
        setGameState('playing');
      }, 4000); // 4 secondi per visualizzare il banner
    }
  };

  if (gameState === 'setup') {
    return <SetupGame 
      onStartGame={handleStartGame}
      onStartMatchOfTheDay={(players, mode) => {
        setIsMatchOfTheDay(true);
        handleStartGame(players, mode);
      }}
    />;
  }

  // Schermata di transizione tra le partite con banner pubblicitario
  if (gameState === 'transition') {
    // Calcola statistiche della partita appena conclusa
    const totalRevealed = revealedHome.filter(Boolean).length + revealedAway.filter(Boolean).length;
    const totalPlayers = 22;
    const percentComplete = Math.round((totalRevealed / totalPlayers) * 100);
    
    return (
      <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <header className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-display font-bold text-primary mb-2">CALCIO D'INIZIO</h1>
            <p className="text-muted-foreground font-mono text-sm">Quiz Formazioni Serie A 2000-2024</p>
          </header>
          
          {/* Riepilogo partita precedente */}
          <div className="bg-card border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 mb-8">
            <h2 className="text-2xl font-display font-bold uppercase mb-4">Riepilogo Partita</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center p-3 bg-background border-2 border-black">
                <div className="text-2xl font-bold text-primary">{totalRevealed}</div>
                <div className="text-xs uppercase text-muted-foreground">Giocatori indovinati</div>
              </div>
              <div className="text-center p-3 bg-background border-2 border-black">
                <div className="text-2xl font-bold text-primary">{totalPlayers - totalRevealed}</div>
                <div className="text-xs uppercase text-muted-foreground">Mancati</div>
              </div>
              <div className="text-center p-3 bg-background border-2 border-black">
                <div className="text-2xl font-bold text-primary">{percentComplete}%</div>
                <div className="text-xs uppercase text-muted-foreground">Completamento</div>
              </div>
              <div className="text-center p-3 bg-background border-2 border-black">
                <div className="text-2xl font-bold text-primary">{players.reduce((sum, p) => sum + p.score, 0)}</div>
                <div className="text-xs uppercase text-muted-foreground">Punti totali</div>
              </div>
            </div>
            
            {/* Classifica giocatori */}
            {players.length > 1 && (
              <div className="mb-4">
                <h3 className="font-bold uppercase text-sm mb-2">Classifica attuale</h3>
                <div className="space-y-1">
                  {[...players].sort((a, b) => b.score - a.score).map((player, idx) => (
                    <div key={player.name} className="flex justify-between items-center text-sm p-2 bg-background border border-black">
                      <span className="font-mono">{idx + 1}. {player.name}</span>
                      <span className="font-bold">{player.score} pt</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Contenuto informativo + Banner */}
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div className="bg-card border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6">
              <h2 className="text-xl font-display font-bold uppercase mb-4">Lo sapevi che...</h2>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>Il nostro database contiene oltre <strong className="text-foreground">1345 partite</strong> della Serie A italiana, dalla stagione 2000/2001 fino ad oggi.</p>
                <p>{t('game.dbVerificata')}</p>
                <p>{t('game.dbSegnala')}</p>
              </div>
            </div>
            
          </div>
          
          {/* Loading indicator */}
          <div className="text-center">
            <div className="inline-flex items-center gap-3 bg-card border-4 border-black px-6 py-4">
              <Loader2 className="animate-spin h-6 w-6 text-primary" />
              <span className="text-lg font-display font-bold uppercase">Nuova partita in arrivo...</span>
            </div>
            <p className="text-muted-foreground text-sm font-mono mt-4">Preparati a indovinare una nuova formazione storica della Serie A!</p>
          </div>
        </div>
      </div>
    );
  }

  if (!currentMatch) return <div className="flex items-center justify-center h-screen">Caricamento...</div>;

  const currentPlayer = players[currentPlayerIndex];

  // Game Over Screen
  if (gameState === 'gameover') {
    // Se l'utente vuole vedere le formazioni complete
    if (showFormations && currentMatch) {
      return (
        <div className="min-h-screen bg-background text-foreground p-4 md:p-8 font-mono flex flex-col">
          {/* Header */}
          <header className="mb-6 border-b-4 border-black pb-4 shrink-0">
            <h1 className="text-3xl font-display font-bold text-center text-primary">FORMAZIONI COMPLETE</h1>
          </header>

          {/* Match Info Banner */}
          <div className="bg-card border-2 border-black p-4 mb-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden shrink-0">
            <div className="absolute top-0 right-0 bg-yellow-300 text-black px-2 py-1 text-xs font-bold border-l-2 border-b-2 border-black">
              {currentMatch.competition}
            </div>
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
              <div className="flex-1">
                <h2 className="text-2xl md:text-3xl font-display font-bold">{currentMatch.homeTeam}</h2>
              </div>
              <div className="flex flex-col items-center px-8">
                <div className="text-4xl md:text-5xl font-bold font-display bg-black text-white px-4 py-2 rounded-sm">
                  {currentMatch.score}
                </div>
                <div className="text-sm mt-2 font-bold uppercase tracking-widest">
                  {currentMatch.date === '01/01/2024' && currentMatch.season 
                    ? `Stagione ${currentMatch.season}` 
                    : currentMatch.date}
                </div>
              </div>
              <div className="flex-1 text-right">
                <h2 className="text-2xl md:text-3xl font-display font-bold">{currentMatch.awayTeam}</h2>
              </div>
            </div>
          </div>

          {/* Formazioni Complete */}
          <div className="flex flex-row gap-4 grow items-start overflow-hidden">
            <div className="flex-1">
              <PlayerList 
                formation={getFormationPlayers(currentMatch.homeFormation)}
                teamName={currentMatch.homeTeam}
                revealedPlayers={new Array(11).fill(true)}
                align="left"
                onRevealPlayer={() => {}}
              />
            </div>
            <div className="flex-1">
              <PlayerList 
                formation={getFormationPlayers(currentMatch.awayFormation)}
                teamName={currentMatch.awayTeam}
                revealedPlayers={new Array(11).fill(true)}
                align="right"
                onRevealPlayer={() => {}}
              />
            </div>
          </div>

          {/* Pulsanti */}
          <div className="mt-8 flex flex-col items-center gap-3 pb-8">
            <Button 
              onClick={() => setShowFormations(false)}
              size="lg"
              className="font-display text-xl px-8 py-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:shadow-none transition-all bg-white text-black hover:bg-gray-100"
            >
              ← Torna ai Risultati
            </Button>
            <Button 
              onClick={() => { setShowFormations(false); handleNewMatch(); }}
              size="lg"
              className="font-display text-xl px-8 py-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:shadow-none transition-all bg-primary text-primary-foreground"
            >
              <RefreshCw className="mr-2 h-6 w-6" />
              Nuova Partita
            </Button>
          </div>
        </div>
      );
    }

    // Modalità solitario: schermata game over senza vincitore
    const isSoloMode = players.length === 1;
    
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-8">
        <div className="bg-card border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8 max-w-lg w-full text-center animate-bounce-in">
          {isSoloMode ? (
            <>
              <div className="text-6xl mb-4">💔</div>
              <h1 className="text-4xl md:text-5xl font-display font-bold uppercase mb-4 text-destructive">
                Game Over!
              </h1>
              <p className="text-xl font-bold mb-6">
                Hai totalizzato {players[0]?.score || 0} punti!
              </p>
            </>
          ) : (
            <>
              <Trophy className="w-24 h-24 mx-auto text-yellow-500 mb-4 animate-pulse" />
              <h1 className="text-4xl md:text-5xl font-display font-bold uppercase mb-4 text-primary">
                Vittoria!
              </h1>
              <p className="text-2xl font-bold mb-6">
                🎉 {winner} ha vinto! 🎉
              </p>
            </>
          )}
          
          {/* Classifica finale */}
          <div className="bg-gray-100 border-2 border-black p-4 mb-6">
            <h3 className="font-display font-bold uppercase mb-3">
              {isSoloMode ? 'Risultato' : 'Classifica Finale'}
            </h3>
            {players
              .sort((a, b) => b.score - a.score)
              .map((p, i) => (
                <div key={i} className={cn(
                  "flex justify-between items-center py-2 border-b border-gray-300 last:border-0",
                  !isSoloMode && p.name === winner && "bg-yellow-100 -mx-2 px-2"
                )}>
                  <span className="font-bold">
                    {isSoloMode ? '⚽' : (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`)} {p.name}
                  </span>
                  <span className="font-mono">{p.score} punti</span>
                </div>
              ))}
          </div>

          {/* Condivisione social */}
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => {
                const score = isSoloMode ? players[0]?.score || 0 : players.reduce((s, p) => s + p.score, 0);
                const text = isSoloMode
                  ? `Ho totalizzato ${score} punti su Kickoff Trivia! Riesci a fare meglio? 🏆 kickoff-trivia.com`
                  : `${winner} ha vinto con ${players.find(p => p.name === winner)?.score || 0} punti su Kickoff Trivia! 🏆 kickoff-trivia.com`;
                window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
              }}
              className="flex-1 flex items-center justify-center gap-2 bg-green-500 text-white font-bold py-3 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all text-sm"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp
            </button>
            <button
              onClick={() => {
                const score = isSoloMode ? players[0]?.score || 0 : players.reduce((s, p) => s + p.score, 0);
                const text = isSoloMode
                  ? `Ho totalizzato ${score} punti su Kickoff Trivia! Riesci a fare meglio? 🏆 kickoff-trivia.com`
                  : `${winner} ha vinto su Kickoff Trivia! 🏆 kickoff-trivia.com`;
                window.open(`https://www.instagram.com/kickoff_trivia/`, '_blank');
                navigator.clipboard?.writeText(text).then(() => toast.success('Testo copiato! Incollalo su Instagram'));
              }}
              className="flex-1 flex items-center justify-center gap-2 text-white font-bold py-3 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all text-sm"
              style={{ background: 'linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)' }}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
              Instagram
            </button>
          </div>

          <div className="flex flex-col gap-3">
            <Button 
              onClick={() => setShowFormations(true)}
              size="lg"
              className="font-display text-lg px-8 py-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:shadow-none transition-all bg-secondary text-secondary-foreground"
            >
              👀 Vedi le Formazioni Complete
            </Button>
            <Button 
              onClick={handleNewMatch}
              size="lg"
              className="font-display text-xl px-8 py-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:shadow-none transition-all bg-primary text-primary-foreground"
            >
              <RefreshCw className="mr-2 h-6 w-6" />
              Nuova Partita
            </Button>
            <Button 
              onClick={() => setGameState('setup')}
              size="lg"
              className="font-display text-xl px-8 py-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:shadow-none transition-all bg-white text-black hover:bg-gray-100"
            >
              <Users className="mr-2 h-6 w-6" />
              Cambia Giocatori
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <NavigationBar onFeedbackClick={() => setIsFeedbackOpen(true)} />
      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
      <div className="min-h-screen bg-background text-foreground p-4 md:p-8 font-mono flex flex-col pt-20">
      
      {/* Match Info Banner */}
      <div className="bg-card border-2 border-black p-4 mb-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden shrink-0">
        <div className="absolute top-0 right-0 bg-yellow-300 text-black px-2 py-1 text-xs font-bold border-l-2 border-b-2 border-black">
          {currentMatch.competition}
        </div>
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
          <div className="flex-1">
            <h2 className="text-2xl md:text-3xl font-display font-bold">{currentMatch.homeTeam}</h2>
          </div>
          <div className="flex flex-col items-center px-8">
            <div className="text-4xl md:text-5xl font-bold font-display bg-black text-white px-4 py-2 rounded-sm">
              {currentMatch.score}
            </div>
            <div className="text-sm mt-2 font-bold uppercase tracking-widest">
              {currentMatch.date === '01/01/2024' && currentMatch.season 
                ? `Stagione ${currentMatch.season}` 
                : currentMatch.date}
            </div>
          </div>
          <div className="flex-1 text-right">
            <h2 className="text-2xl md:text-3xl font-display font-bold">{currentMatch.awayTeam}</h2>
          </div>
        </div>
      </div>

      {/* Scoreboard Multiplayer con Vite - Sotto la partita */}
      <div className="flex justify-center gap-4 overflow-x-auto max-w-full pb-4 mb-4 shrink-0">
        {players.map((p, i) => (
          <div 
            key={i} 
            className={cn(
              "border-2 border-black p-2 min-w-[100px] transition-all",
              p.eliminated && "opacity-40 bg-gray-300",
              !p.eliminated && i === currentPlayerIndex && "bg-black text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] -translate-y-1",
              !p.eliminated && i !== currentPlayerIndex && "bg-white text-black opacity-70"
            )}
          >
            <div className="text-xs font-bold uppercase truncate max-w-[120px]">{p.name}</div>
            <div className="text-xl font-bold">{p.score}</div>
            {/* Cuoricini per le vite (solo in modalità sfida) */}
            {gameMode === 'challenge' && (
              <div className="flex gap-0.5 mt-1 justify-center">
                {Array.from({ length: MAX_LIVES }).map((_, lifeIndex) => (
                  <Heart 
                    key={lifeIndex}
                    className={cn(
                      "w-3 h-3 transition-all",
                      lifeIndex < p.lives 
                        ? "text-red-500 fill-red-500" 
                        : "text-gray-300"
                    )}
                  />
                ))}
              </div>
            )}
            {/* Contatore indizi */}
            <div className="text-[10px] mt-1 text-center">
              <span className={cn(
                "font-mono",
                gameMode === 'training' ? "text-blue-500" : ((hintsUsedByPlayer[p.name] || 0) >= MAX_HINTS ? "text-red-500" : "text-blue-500")
              )}>
                💡 {gameMode === 'training' ? '∞' : `${MAX_HINTS - (hintsUsedByPlayer[p.name] || 0)}/${MAX_HINTS}`}
              </span>
            </div>
            {p.eliminated && (
              <div className="text-xs text-red-600 font-bold mt-1">ELIMINATO</div>
            )}
          </div>
        ))}
      </div>

      {/* Global Input Area - Sticky or Prominent */}
      <div className="mb-8 sticky top-4 z-10 shrink-0">
        <div className="max-w-2xl mx-auto relative">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const inputName = formData.get('playerName') as string;
              handleGlobalInput(inputName);
            }}
            className="relative"
          >
            <input
              ref={inputRef}
              type="text"
              name="playerName"
              autoFocus
              autoComplete="off"
              placeholder={`${currentPlayer?.name || 'Giocatore'}...`}
              disabled={currentPlayer?.eliminated}
              className={cn(
                "w-full h-16 px-6 text-2xl font-bold border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:translate-y-1 focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all uppercase placeholder:text-gray-400",
                feedback === 'correct' && "bg-green-100 border-green-600 text-green-800",
                feedback === 'wrong' && "bg-red-100 border-red-600 text-red-800 animate-shake",
                feedback === 'duplicate' && "bg-yellow-100 border-yellow-600 text-yellow-800"
              )}
            />
            <Button 
              type="submit"
              className="absolute right-2 top-2 bottom-2 px-6 font-display text-lg bg-black text-white hover:bg-gray-800"
              disabled={currentPlayer?.eliminated}
            >
              INVIA
            </Button>
          </form>
          
          {/* Feedback Message */}
          {feedback && (
            <div className={cn(
              "absolute -bottom-12 left-0 right-0 text-center font-bold text-lg animate-bounce",
              feedback === 'correct' && "text-green-600",
              feedback === 'wrong' && "text-red-600",
              feedback === 'duplicate' && "text-yellow-600"
            )}>
              {feedback === 'correct' && `GOAL! ${lastGuessedPlayer} inserito!`}
              {feedback === 'wrong' && (gameMode === 'challenge' ? `PALO! -1 ❤️ (${currentPlayer?.lives - 1} rimaste)` : 'PALO! Riprova!')}
              {feedback === 'duplicate' && "Giocatore già indovinato!"}
            </div>
          )}
        </div>
      </div>

      {/* Game Area - Lists Side by Side with Ad Banners */}
      <div className="flex flex-row gap-2 md:gap-4 grow items-start overflow-hidden">
        
        {/* Home Team List */}
        <div className="flex-1">
          <PlayerList 
            formation={getFormationPlayers(currentMatch.homeFormation)}
            teamName={currentMatch.homeTeam}
            revealedPlayers={revealedHome}
            align="left"
            onRevealPlayer={(index) => {
              if (canUseHint()) {
                handleUseHint();
                const newRevealed = [...revealedHome];
                newRevealed[index] = true;
                setRevealedHome(newRevealed);
              }
            }}
            onUseHint={() => {
              if (canUseHint()) {
                handleUseHint();
              }
            }}
            canUseHint={canUseHint()}
          />
        </div>

        {/* Away Team List */}
        <div className="flex-1">
          <PlayerList 
            formation={getFormationPlayers(currentMatch.awayFormation)}
            teamName={currentMatch.awayTeam}
            revealedPlayers={revealedAway}
            align="right"
            onRevealPlayer={(index) => {
              if (canUseHint()) {
                handleUseHint();
                const newRevealed = [...revealedAway];
                newRevealed[index] = true;
                setRevealedAway(newRevealed);
              }
            }}
            onUseHint={() => {
              if (canUseHint()) {
                handleUseHint();
              }
            }}
            canUseHint={canUseHint()}
          />
        </div>
        

      </div>

      {/* Footer Controls */}
      <div className="mt-12 flex flex-col items-center shrink-0 pb-8 gap-4">
        <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-4 w-full px-4">
          <Button 
            onClick={handleNewMatch} 
            size="lg" 
            className="font-display text-base sm:text-xl px-4 sm:px-8 py-4 sm:py-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:shadow-none transition-all bg-white text-black hover:bg-gray-100 w-full sm:w-auto"
          >
            <RefreshCw className="mr-2 h-5 w-5 sm:h-6 sm:w-6" />
            Nuova Partita
          </Button>
          <Button 
            onClick={() => confirmExit(() => setGameState('setup'))} 
            size="lg" 
            className="font-display text-base sm:text-xl px-4 sm:px-8 py-4 sm:py-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:shadow-none transition-all bg-white text-black hover:bg-gray-100 w-full sm:w-auto"
          >
            <Users className="mr-2 h-5 w-5 sm:h-6 sm:w-6" />
            Cambia Giocatori
          </Button>
        </div>

<ErrorReportDialog currentMatch={currentMatch} />
        
      </div>

    </div>
    </>
  );
}


// Error Report Dialog Component
function ErrorReportDialog({ currentMatch }: { currentMatch: Match }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const sendError = trpc.report.sendError.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(t('segnalaErrore.grazie'));
        setOpen(false);
        setDescription('');
      } else {
        toast.error(data.error || t('segnalaErrore.errore'));
      }
    },
    onError: () => {
      toast.error(t('game.erroreConnessione'));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendError.mutate({
      matchId: currentMatch.id,
      homeTeam: currentMatch.homeTeam,
      awayTeam: currentMatch.awayTeam,
      date: currentMatch.date,
      description,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="link" className="text-muted-foreground hover:text-destructive text-sm">
          <AlertTriangle className="mr-2 h-4 w-4" />
          Segnala Errore Partita
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase">Segnala Errore</DialogTitle>
          <DialogDescription>
            Hai trovato un errore nella formazione? Descrivilo qui sotto.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4 py-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="description" className="font-bold">Descrizione del problema</Label>
            <Textarea 
              id="description" 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('segnalaErrore.placeholder')} 
              className="border-2 border-black min-h-[100px]"
              required
            />
          </div>
          <Button 
            type="submit" 
            className="w-full font-display text-lg bg-black text-white hover:bg-gray-800"
            disabled={sendError.isPending}
          >
            {sendError.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> INVIO IN CORSO...</>
            ) : (
              'INVIA SEGNALAZIONE'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
