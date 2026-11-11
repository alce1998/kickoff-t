import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { NavigationBar } from "@/components/NavigationBar";
import { FeedbackModal } from "@/components/FeedbackModal";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Heart, Lightbulb, Trophy, Users, ArrowLeft, Target } from "lucide-react";
import { getRandomMatch, Match, checkAnswer, checkAnswerWithScore } from "@/lib/game-logic";
import { PlayerList } from "@/components/PlayerList";
import { toast } from "sonner";
import { useNotifications } from "@/hooks/useNotifications";
import { useTranslation } from "react-i18next";
import { useAchievements } from "@/hooks/useAchievements";

function ChallengeGame() {
  const [, params] = useRoute("/sfida/:id");
  const [, setLocation] = useLocation();
  const challengeId = params?.id ? parseInt(params.id) : null;
  const { t } = useTranslation();
  
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const { sendNotification, requestPermission } = useNotifications();
  const previousTurnRef = useRef<string | null>(null);

  const { unlock } = useAchievements();
  const recordRankedMatch = trpc.achievements.recordRankedMatch.useMutation();
  const recordGamePlayed = trpc.achievements.recordGamePlayed.useMutation();

  // Poliglotta: record that the user played this game
  useEffect(() => {
    if (user) recordGamePlayed.mutate({ gameType: 'sfida' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const [isRapidMode, setIsRapidMode] = useState(false);
  const [localMyTime, setLocalMyTime] = useState<number | null>(null);
  const [localOpponentTime, setLocalOpponentTime] = useState<number | null>(null);
  
  const { data: challengeData, refetch } = trpc.challenges.getChallenge.useQuery(
    { challengeId: challengeId! },
    { 
      enabled: !!challengeId,
      // Polling automatico: 0.5s per Rapid (real-time), 5s per Standard (aggiornamento turno)
      refetchInterval: isRapidMode ? 500 : 5000,
    }
  );
  
  // Aggiorna flag Rapid quando challenge viene caricata
  useEffect(() => {
    if (challengeData?.gameMode === 'rapid') {
      setIsRapidMode(true);
    }
  }, [challengeData?.gameMode]);

  // Richiedi permessi notifiche al mount
  useEffect(() => {
    requestPermission();
  }, [requestPermission]);
  
  // Rileva cambio turno e invia notifica
  useEffect(() => {
    if (!challengeData || !user) return;
    
    const currentTurn = challengeData.currentTurn;
    const isMyTurn = currentTurn === user.openId;
    
    // Se il turno è cambiato ed è diventato il mio turno
    if (previousTurnRef.current !== null && 
        previousTurnRef.current !== currentTurn && 
        isMyTurn) {
      // Invia notifica browser
      const opponentName = challengeData.opponent?.name || 'avversario';
      sendNotification('È il tuo turno!', {
        body: `La sfida contro ${opponentName} ti aspetta!`,
        tag: `challenge-${challengeData.id}`,
        requireInteraction: false,
      });
      
      // Toast di backup
      toast.success(t('sfida.tuoTurno'), {
        description: t('sfida.avversarioCompletato'),
      });
    }
    
    // Aggiorna ref con turno corrente
    previousTurnRef.current = currentTurn;
  }, [challengeData, user, sendNotification]);
  
  // Sincronizza tempo locale con database solo quando necessario
  const previousTurnForTimerRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (!challengeData || challengeData.gameMode !== 'rapid') return;
    
    const isChallenger = user?.id === challengeData.challengerId;
    const dbMyTime = isChallenger ? (challengeData.challengerTimeRemaining ?? 600) : (challengeData.opponentTimeRemaining ?? 600);
    const dbOpponentTime = isChallenger ? (challengeData.opponentTimeRemaining ?? 600) : (challengeData.challengerTimeRemaining ?? 600);
    
    // Sincronizza solo se:
    // 1. È la prima volta (localMyTime è null)
    // 2. Il turno è cambiato (per aggiornare il tempo dopo una mossa)
    const turnChanged = previousTurnForTimerRef.current !== null && previousTurnForTimerRef.current !== challengeData.currentTurn;
    
    if (localMyTime === null || localOpponentTime === null || turnChanged) {
      setLocalMyTime(dbMyTime);
      setLocalOpponentTime(dbOpponentTime);
    }
    
    previousTurnForTimerRef.current = challengeData.currentTurn;
  }, [challengeData, user, localMyTime, localOpponentTime]);
  
  // Countdown timer locale (decrementa ogni secondo)
  useEffect(() => {
    if (!isRapidMode || !challengeData) return;
    
    const isChallenger = user?.id === challengeData.challengerId;
    const currentTurn = challengeData.currentTurn;
    
    const interval = setInterval(() => {
      const isMyTurn = (isChallenger && currentTurn === 'challenger') || 
                       (!isChallenger && currentTurn === 'opponent');
      
      // Decrementa il tempo del giocatore di turno
      if (isMyTurn) {
        setLocalMyTime(prev => {
          if (prev === null || prev <= 0) return 0;
          return prev - 1;
        });
      } else {
        setLocalOpponentTime(prev => {
          if (prev === null || prev <= 0) return 0;
          return prev - 1;
        });
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isRapidMode, user, challengeData?.challengerId, challengeData?.currentTurn]);
  
  const submitTurnMutation = trpc.challenges.submitTurn.useMutation();

  const [currentMatch, setCurrentMatch] = useState<Match | null>(null);
  const [revealedHome, setRevealedHome] = useState<boolean[]>([]);
  const [revealedAway, setRevealedAway] = useState<boolean[]>([]);
  const [revealedHintsHome, setRevealedHintsHome] = useState<{[key: number]: {nationality?: boolean, number?: boolean}}>({}); 
  const [revealedHintsAway, setRevealedHintsAway] = useState<{[key: number]: {nationality?: boolean, number?: boolean}}>({}); 
  const [guess, setGuess] = useState("");
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | 'duplicate' | null>(null);
  const [hasError, setHasError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const useHintMutation = trpc.challenges.useHint.useMutation();
  const forfeitMutation = trpc.challenges.forfeitChallenge.useMutation();
  const timeExpiredMutation = trpc.challenges.timeExpired.useMutation();
  const [showForfeitConfirm, setShowForfeitConfirm] = useState(false);
  const [timeExpiredLocally, setTimeExpiredLocally] = useState(false);
  const [eloChange, setEloChange] = useState<number | null>(null);
  const [newEloRating, setNewEloRating] = useState<number | null>(null);

  // Recupera variazione ELO da getChallenge quando la partita è completata
  // (fallback per chi non ha fatto l'ultima mossa e non ha ricevuto eloChange da submitTurn)
  useEffect(() => {
    if (challengeData?.status === 'completed' && eloChange === null) {
      const change = (challengeData as any).eloChange;
      const newElo = (challengeData as any).newEloRating;
      if (change !== null && change !== undefined) {
        setEloChange(change);
      }
      if (newElo !== null && newElo !== undefined) {
        setNewEloRating(newElo);
      }
    }
  }, [challengeData?.status, challengeData, eloChange]);

  // Carica partita quando challenge è disponibile (solo prima volta)
  useEffect(() => {
    if (challengeData && !currentMatch) {
      try {
        const matchData = JSON.parse(challengeData.matchData);
        // Usa la partita salvata nel matchData
        if (matchData.match) {
          const match = matchData.match;
          // Valida struttura dati partita
          // Match ha homeFormation e awayFormation
          const homeFormation = (match as any).homeFormation;
          const awayFormation = (match as any).awayFormation;
          
          // Gestisci sia array diretti (Champions/Premier) che oggetti con players (Serie A)
          const homeIsValid = Array.isArray(homeFormation) || (homeFormation?.players && Array.isArray(homeFormation.players));
          const awayIsValid = Array.isArray(awayFormation) || (awayFormation?.players && Array.isArray(awayFormation.players));
          
          if (!homeIsValid || !awayIsValid) {
            console.error("Struttura partita non valida:", match);
            setHasError(true);
            return;
          }
          
          // Normalizza homeFormation/awayFormation: può essere array diretto o oggetto {players: [...]}
          const normalizeFormation = (formation: any) => {
            if (Array.isArray(formation)) {
              return { players: formation };
            }
            return formation;
          };
          
          const normalizedHomeFormation = normalizeFormation(homeFormation);
          const normalizedAwayFormation = normalizeFormation(awayFormation);
          
          // Applica correzione ruoli per ultimi giocatori
          const correctedMatch = {
            ...match,
            homeFormation: {
              ...normalizedHomeFormation,
              players: normalizedHomeFormation.players.map((p: any, index: number) => {
                // Usa il ruolo esattamente come presente nel JSON
                let role = p.role || p.position || 'MF';
                // Correzione: ultimi 2 giocatori (indice 9, 10) con ruolo MF/CM sono attaccanti
                if ((index === 9 || index === 10) && (role === 'MF' || role === 'CM' || role === 'FW')) {
                  role = 'FW';
                }
                return { ...p, role };
              })
            },
            awayFormation: {
              ...normalizedAwayFormation,
              players: normalizedAwayFormation.players.map((p: any, index: number) => {
                let role = p.role || p.position || 'MF';
                if ((index === 9 || index === 10) && (role === 'MF' || role === 'CM' || role === 'FW')) {
                  role = 'FW';
                }
                return { ...p, role };
              })
            }
          };
          
          setCurrentMatch(correctedMatch as Match);
        } else {
          console.error("Nessuna partita trovata in matchData");
          setHasError(true);
        }
      } catch (error) {
        console.error("Errore caricamento partita:", error);
        setHasError(true);
      }
    }
  }, [challengeData, currentMatch]);
  
  // Aggiorna formazioni rivelate quando i turni cambiano (condivise tra i due giocatori)
  useEffect(() => {
    if (challengeData && currentMatch) {
      const homeFormation = (currentMatch as any).homeFormation;
      const awayFormation = (currentMatch as any).awayFormation;
      
      const newRevealedHome = new Array(11).fill(false);
      const newRevealedAway = new Array(11).fill(false);
      
      // Se partita finita, mostra tutte le formazioni
      if (challengeData.status === 'completed') {
        setRevealedHome(new Array(11).fill(true));
        setRevealedAway(new Array(11).fill(true));
        return;
      }
      
      // Processa tutti i turni corretti (di entrambi i giocatori)
      if (challengeData.turns) {
        challengeData.turns.forEach((turn: any) => {
          if (turn.isCorrect === 1) {
            // Cerca il giocatore nelle formazioni
            homeFormation.players.forEach((player: any, index: number) => {
              if (checkAnswer(turn.playerName, player.name)) {
                newRevealedHome[index] = true;
              }
            });
            awayFormation.players.forEach((player: any, index: number) => {
              if (checkAnswer(turn.playerName, player.name)) {
                newRevealedAway[index] = true;
              }
            });
          }
        });
      }
      
      setRevealedHome(newRevealedHome);
      setRevealedAway(newRevealedAway);
    }
  }, [challengeData?.turns, currentMatch]);
  
  // Controlla se il tempo è scaduto (mio o avversario) e chiama timeExpired
  useEffect(() => {
    if (!isRapidMode || localMyTime === null || localOpponentTime === null || !challengeId) return;
    if (challengeData?.status !== 'active') return;
    if (timeExpiredLocally) return; // Già gestito
    
    // Controlla se il MIO tempo è scaduto
    if (localMyTime <= 0) {
      // Imposta flag locale IMMEDIATAMENTE per mostrare banner sconfitta
      setTimeExpiredLocally(true);
      
      // Chiama backend in background
      const handleTimeExpired = async () => {
        try {
          await timeExpiredMutation.mutateAsync({ challengeId });
          await refetch();
        } catch (error: any) {
          if (!error.message?.includes("not active")) {
            console.error("Errore durante terminazione per tempo scaduto:", error);
          }
        }
      };
      
      handleTimeExpired();
    }
    
    // Controlla se il tempo dell'AVVERSARIO è scaduto
    if (localOpponentTime <= 0) {
      // Imposta flag locale IMMEDIATAMENTE per mostrare banner vittoria
      setTimeExpiredLocally(true);
      
      // Refetch per aggiornare dati (il backend viene chiamato dall'avversario)
      refetch();
    }
  }, [localMyTime, localOpponentTime, isRapidMode, challengeData?.status, challengeId, timeExpiredMutation, refetch, timeExpiredLocally]);

  if (!user || !challengeId) {
    return (
      <>
        <NavigationBar onFeedbackClick={() => setIsFeedbackOpen(true)} />
        <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
        <div className="min-h-screen bg-background text-foreground p-4 md:p-8 font-mono pt-20">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl font-bold mb-4">Errore</h1>
            <p className="text-muted-foreground">Sfida non trovata o accesso non autorizzato.</p>
            <Button onClick={() => setLocation("/sfide")} className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Torna alle Sfide
            </Button>
          </div>
        </div>
      </>
    );
  }

  // Mostra errore se matchData è incompleto
  if (hasError) {
    return (
      <>
        <NavigationBar onFeedbackClick={() => setIsFeedbackOpen(true)} />
        <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
        <div className="min-h-screen bg-background text-foreground p-4 md:p-8 font-mono pt-20">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl font-bold mb-4 text-red-600">Sfida Non Valida</h1>
            <p className="text-muted-foreground mb-4">
              Questa sfida è stata creata con una versione precedente del sistema e non può essere giocata.
            </p>
            <p className="text-muted-foreground mb-6">
              Crea una nuova sfida per giocare con i tuoi amici!
            </p>
            <Button onClick={() => setLocation("/sfide")} className="bg-black text-white hover:bg-gray-800">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Torna alle Sfide
            </Button>
          </div>
        </div>
      </>
    );
  }

  if (!challengeData || !currentMatch) {
    return (
      <>
        <NavigationBar onFeedbackClick={() => setIsFeedbackOpen(true)} />
        <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
        <div className="min-h-screen bg-background text-foreground p-4 md:p-8 font-mono pt-20">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-muted-foreground">Caricamento sfida...</p>
          </div>
        </div>
      </>
    );
  }

  const isChallenger = challengeData.challengerId === user.id;
  const myLives = isChallenger ? challengeData.challengerLives : challengeData.opponentLives;
  const myScore = isChallenger ? challengeData.challengerScore : challengeData.opponentScore;
  const myHints = isChallenger ? challengeData.challengerHints : challengeData.opponentHints;
  // Usa tempo locale per countdown in tempo reale, fallback a database se non disponibile
  const myTimeRemaining = localMyTime !== null ? localMyTime : (isChallenger ? (challengeData.challengerTimeRemaining ?? 600) : (challengeData.opponentTimeRemaining ?? 600));
  const opponentLives = isChallenger ? challengeData.opponentLives : challengeData.challengerLives;
  const opponentScore = isChallenger ? challengeData.opponentScore : challengeData.challengerScore;
  const opponentTimeRemaining = localOpponentTime !== null ? localOpponentTime : (isChallenger ? (challengeData.opponentTimeRemaining ?? 600) : (challengeData.challengerTimeRemaining ?? 600));
  const isMyTurn = (isChallenger && challengeData.currentTurn === 'challenger') || 
                   (!isChallenger && challengeData.currentTurn === 'opponent');
  
  const isGameOver = challengeData.status === 'completed' || timeExpiredLocally;
  const iWon = challengeData.winnerId === user.id || (timeExpiredLocally && localOpponentTime !== null && localOpponentTime <= 0);
  const isDraw = challengeData.winnerId === null && !timeExpiredLocally;

  const handleGuess = async () => {
    if (!guess.trim() || !isMyTurn || isGameOver || isSubmitting) return;
    
    setIsSubmitting(true);

    let found = false;

    // Raccogli tutti i match possibili con il loro score
    const homeMatches: Array<{ index: number, player: any, score: number }> = [];
    const awayMatches: Array<{ index: number, player: any, score: number }> = [];

    // Cerca nella squadra di casa
    (currentMatch as any).homeFormation.players.forEach((player: any, index: number) => {
      const result = checkAnswerWithScore(guess, player.name);
      if (result.matches && !revealedHome[index]) {
        homeMatches.push({ index, player, score: result.score });
      }
    });

    // Cerca nella squadra ospite
    (currentMatch as any).awayFormation.players.forEach((player: any, index: number) => {
      const result = checkAnswerWithScore(guess, player.name);
      if (result.matches && !revealedAway[index]) {
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
      
      // Se ci sono match, considera trovato
      if (bestMatches.length > 0) {
        found = true;
        setFeedback('correct');
        if (allMatches.length > 1) {
          toast.success(`+${allMatches.length} punti! Trovati ${allMatches.length} giocatori!`);
        } else {
          toast.success("Risposta corretta!");
        }
      }
    }
    
    if (!found) {
      setFeedback('wrong');
      toast.error("Risposta errata!");
    }

    // Invia turno al backend
    try {
      const submitResult = await submitTurnMutation.mutateAsync({
        challengeId: challengeId!,
        playerName: guess,
        isCorrect: found,
        hintsUsed: 0,
        matchCount: found ? allMatches.length : 1, // Conta tutti i giocatori trovati con questa risposta
      });

      setGuess("");
      
      // Ricarica dati sfida
      await refetch();

        if (submitResult.gameOver) {
        // Salva variazione ELO
        if (submitResult.eloChange !== null && submitResult.eloChange !== undefined) {
          setEloChange(submitResult.eloChange);
        }
        if (submitResult.newEloRating !== null && submitResult.newEloRating !== undefined) {
          setNewEloRating(submitResult.newEloRating);
        }
        // Gioco terminato
        if (submitResult.winnerId === user.id) {
          toast.success(t('sfida.haiVinto'));
        } else if (submitResult.winnerId === null) {
          toast.info("Pareggio!");
        } else {
          toast.error(t('sfida.haiPerso'));
        }
        // Scout achievement: record ranked match
        recordRankedMatch.mutate();
      }
    } catch (error: any) {
      toast.error(error.message || "Errore durante l'invio della risposta");
    } finally {
      setIsSubmitting(false);
    }

    setTimeout(() => setFeedback(null), 2000);
  };

  const handleForfeit = async () => {
    if (!challengeId || isGameOver) return;
    
    try {
      await forfeitMutation.mutateAsync({ challengeId });
      toast.error(t('sfida.haiAbbandonato'));
      await refetch();
      setShowForfeitConfirm(false);
    } catch (error: any) {
      toast.error(error.message || "Errore durante l'abbandono");
    }
  };

  const handleRevealHint = async (type: 'nationality' | 'number', team: 'home' | 'away', index: number) => {
    if (myHints <= 0 || !isMyTurn || !challengeId) return;
    
    // Verifica se l'indizio è già stato rivelato
    const revealedHints = team === 'home' ? revealedHintsHome : revealedHintsAway;
    if (revealedHints[index]?.[type]) {
      toast.info("Indizio già rivelato!");
      return;
    }
    
    try {
      // Chiama backend per decrementare indizi
      await useHintMutation.mutateAsync({
        challengeId,
        hintType: type,
        team,
        playerIndex: index,
      });
      
      // Aggiorna stato locale indizi rivelati
      if (team === 'home') {
        setRevealedHintsHome(prev => ({
          ...prev,
          [index]: { ...prev[index], [type]: true }
        }));
      } else {
        setRevealedHintsAway(prev => ({
          ...prev,
          [index]: { ...prev[index], [type]: true }
        }));
      }
      
      // Refetch challenge per aggiornare contatore indizi
      await refetch();
      
      toast.success("Indizio rivelato!");
    } catch (error: any) {
      toast.error(error.message || "Errore nell'uso dell'indizio");
    }
  };

  return (
    <>
      <NavigationBar onFeedbackClick={() => setIsFeedbackOpen(true)} />
      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
      <div className="min-h-screen bg-background text-foreground p-4 md:p-8 font-mono pt-20">
        <div className="max-w-6xl mx-auto">
          {/* Header sfida */}
          <div className="mb-6">
            <div className="flex gap-2 mb-4">
              <Button
                onClick={() => setLocation("/sfide")}
                variant="outline"
                className="flex-1"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Torna alle Sfide
              </Button>
              <Button
                onClick={() => setShowForfeitConfirm(true)}
                variant="outline"
                className="bg-red-50 hover:bg-red-100 border-red-500 text-red-700"
                disabled={isGameOver}
              >
                X Abbandona
              </Button>
            </div>

            <div className="bg-card border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6">
              <h1 className="text-3xl font-bold uppercase mb-4 text-center">
                Sfida vs {challengeData.opponent?.name}
              </h1>
              
              {/* Stato sfida */}
              <div className="grid md:grid-cols-2 gap-6 mb-4">
                {/* Tu */}
                <div className={`p-4 border-2 border-black ${isMyTurn ? 'bg-green-50' : 'bg-background'}`}>
                  <h3 className="font-bold uppercase mb-2 flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Tu ({user.username ? `@${user.username}` : user.name})
                    {isMyTurn && <span className="text-green-600 text-sm animate-pulse">• TUO TURNO</span>}
                  </h3>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Heart className="h-4 w-4 text-red-500" />
                      <span className="font-bold">{myLives}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Lightbulb className="h-4 w-4 text-yellow-500" />
                      <span className="font-bold">{myHints}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Target className="h-4 w-4 text-blue-500" />
                      <span className="font-bold">{myScore}</span>
                    </div>
                    {challengeData.gameMode === 'rapid' && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold">Tempo:</span>
                        <span className={`font-bold ${myTimeRemaining < 60 ? 'text-red-600 animate-pulse' : ''}` }>
                          {Math.floor(myTimeRemaining / 60)}:{String(myTimeRemaining % 60).padStart(2, '0')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Avversario */}
                <div className={`p-4 border-2 border-black ${!isMyTurn ? 'bg-yellow-50' : 'bg-background'}`}>
                  <h3 className="font-bold uppercase mb-2 flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    {challengeData.opponent?.name}
                    {!isMyTurn && <span className="text-yellow-600 text-sm">• TURNO AVVERSARIO</span>}
                  </h3>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Heart className="h-4 w-4 text-red-500" />
                      <span className="font-bold">{opponentLives}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Target className="h-4 w-4 text-blue-500" />
                      <span className="font-bold">{opponentScore}</span>
                    </div>
                    {challengeData.gameMode === 'rapid' && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold">Tempo:</span>
                        <span className={`font-bold ${opponentTimeRemaining < 60 ? 'text-red-600 animate-pulse' : ''}`}>
                          {Math.floor(opponentTimeRemaining / 60)}:{String(opponentTimeRemaining % 60).padStart(2, '0')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Risultato finale */}
              {isGameOver && (
                isDraw ? (
                  <div className="p-4 border-2 border-black text-center animate-pulse" style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)' }}>
                    <div className="text-2xl mb-1">⭐🤝⭐</div>
                    <h2 className="text-2xl font-black uppercase text-black">
                      PAREGGIO!
                    </h2>
                    <p className="text-sm mt-2 font-bold text-black/80">
                      {myScore} — {opponentScore}
                    </p>
                  </div>
                ) : (
                  <div className={`p-4 border-2 border-black text-center ${
                    iWon ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    <Trophy className="h-8 w-8 mx-auto mb-2" />
                    <h2 className="text-2xl font-bold uppercase">
                      {iWon ? '🎉 Hai Vinto!' : '😔 Hai Perso'}
                    </h2>
                    <p className="text-sm mt-2">
                      Risultato finale: {myScore} - {opponentScore}
                    </p>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Banner risultato partita */}
          {isGameOver && (
            isDraw ? (
              /* Banner PAREGGIO animato */
              <div className="mb-6 relative overflow-hidden border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] animate-pulse" style={{ background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 40%, #fbbf24 60%, #f59e0b 100%)', backgroundSize: '200% 200%' }}>
                <div className="p-6 text-center">
                  {/* Stelle decorative */}
                  <div className="flex justify-center gap-2 mb-2 text-2xl">
                    <span>⭐</span><span>🤝</span><span>⭐</span>
                  </div>
                  <h2 className="text-5xl font-black uppercase tracking-tighter text-black mb-1" style={{ textShadow: '3px 3px 0px rgba(0,0,0,0.2)' }}>
                    PAREGGIO!
                  </h2>
                  <p className="text-xl font-bold text-black/80 uppercase tracking-widest mb-4">
                    Partita terminata in parità
                  </p>
                  <div className="inline-block bg-black text-yellow-400 font-black text-3xl px-6 py-2 border-2 border-black shadow-[4px_4px_0px_0px_rgba(255,255,255,0.3)]">
                    {myScore} — {opponentScore}
                  </div>
                  <p className="mt-3 text-sm font-bold text-black/70 uppercase">
                    Tutti i giocatori sono stati indovinati!
                  </p>
                </div>
              </div>
            ) : (
              <div className={`mb-6 p-6 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] ${
                iWon ? 'bg-green-100' : 'bg-red-100'
              }`}>
                <h2 className="text-3xl font-bold text-center mb-2">
                  {iWon ? '🏆 HAI VINTO!' : '❌ HAI PERSO'}
                </h2>
                <div className="mt-4 text-center">
                  <p className="font-bold text-xl">Punteggio finale: {myScore} - {opponentScore}</p>
                </div>
                {/* Variazione ELO */}
                {eloChange !== null && newEloRating !== null && (
                  <div className="mt-4 text-center">
                    <div className={`inline-block px-4 py-2 border-2 border-black font-black text-2xl ${
                      eloChange >= 0 ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                    }`}>
                      {eloChange >= 0 ? '+' : ''}{eloChange} ELO
                    </div>
                    <p className="mt-2 text-sm font-bold text-gray-600">Punteggio ELO: {newEloRating}</p>
                  </div>
                )}
                {/* Pulsante rivincita */}
                <div className="mt-4 flex gap-3 justify-center">
                  <Button
                    onClick={() => setLocation(`/sfide`)}
                    className="bg-black text-white hover:bg-gray-800 font-bold border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)]"
                  >
                    🔄 Rivincita
                  </Button>
                  <Button
                    onClick={() => setLocation('/formazioni')}
                    variant="outline"
                    className="border-2 border-black font-bold"
                  >
                    Menu Formazioni
                  </Button>
                </div>
              </div>
            )
          )}
          
          {/* Input guess */}
          {!isGameOver && (
            <div className="mb-6">
              <div className="bg-card border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold uppercase">Indovina un giocatore</h3>
                  {isMyTurn && challengeData.gameMode !== 'rapid' && (
                    <span className="text-xs font-bold uppercase bg-black text-white px-2 py-1">
                      Tentativo {(challengeData.attemptsInCurrentTurn ?? 0) + 1}/3
                    </span>
                  )}
                  {isMyTurn && challengeData.gameMode === 'rapid' && (
                    <span className="text-xs font-bold uppercase bg-orange-500 text-white px-2 py-1">
                      ⚡ RAPID — 1 tentativo
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    value={guess}
                    onChange={(e) => setGuess(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !isSubmitting && handleGuess()}
                    placeholder={t('link.placeholderGiocatore')}
                    disabled={!isMyTurn || isGameOver || isSubmitting}
                    className="flex-1 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold uppercase"
                  />
                  <Button
                    onClick={handleGuess}
                    disabled={!isMyTurn || !guess.trim() || isGameOver || isSubmitting}
                    className="bg-black text-white hover:bg-gray-800 font-bold"
                  >
                    {isSubmitting ? "Invio..." : "Invia"}
                  </Button>
                </div>
                {feedback && (
                  <div className={`mt-3 p-2 text-center font-bold uppercase ${
                    feedback === 'correct' ? 'bg-green-100 text-green-800' :
                    feedback === 'duplicate' ? 'bg-blue-100 text-blue-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {feedback === 'correct' ? '✓ Corretto!' :
                     feedback === 'duplicate' ? 'Già indovinato' :
                     '✗ Sbagliato'}
                  </div>
                )}
                {!isMyTurn && !isGameOver && (
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span>
                    <p className="text-center text-sm font-bold text-yellow-600">
                      {challengeData.opponent?.name} sta giocando...
                    </p>
                    <span className="inline-block w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Match Info Banner */}
          <div className="bg-card border-2 border-black p-4 mb-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden shrink-0">
            <div className="absolute top-0 right-0 bg-yellow-300 text-black px-2 py-1 text-xs font-bold border-l-2 border-b-2 border-black">
              {(currentMatch as any).competition || 'Serie A'}
            </div>
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
              <div className="flex-1">
                <h2 className="text-2xl md:text-3xl font-display font-bold">{(currentMatch as any).homeTeam || 'Casa'}</h2>
              </div>
              <div className="flex flex-col items-center px-8">
                <div className="text-4xl md:text-5xl font-bold font-display bg-black text-white px-4 py-2 rounded-sm">
                  {(currentMatch as any).score || '0-0'}
                </div>
                <div className="text-sm mt-2 font-bold uppercase tracking-widest">
                  {currentMatch.date === '01/01/2024' && currentMatch.season 
                    ? `Stagione ${currentMatch.season}` 
                    : (currentMatch.date || 'Data')}
                </div>
              </div>
              <div className="flex-1 text-right">
                <h2 className="text-2xl md:text-3xl font-display font-bold">{(currentMatch as any).awayTeam || 'Ospiti'}</h2>
              </div>
            </div>
          </div>

          {/* Formazioni */}
          <div className="grid grid-cols-2 gap-6">
            <PlayerList
              formation={(currentMatch as any).homeFormation?.players || []}
              teamName={(currentMatch as any).homeTeam || 'Casa'}
              revealedPlayers={revealedHome}
              align="left"
              onUseHint={(index: number, hintType: 'number' | 'nationality') => handleRevealHint(hintType, 'home', index)}
              hintsUsed={Array.from({ length: 11 }, (_, index) => ({
                number: revealedHintsHome[index]?.number || false,
                nationality: revealedHintsHome[index]?.nationality || false
              }))}
              canUseHint={myHints > 0 && isMyTurn && !isGameOver}
            />
            <PlayerList
              formation={(currentMatch as any).awayFormation?.players || []}
              teamName={(currentMatch as any).awayTeam || 'Ospiti'}
              revealedPlayers={revealedAway}
              align="right"
              onUseHint={(index: number, hintType: 'number' | 'nationality') => handleRevealHint(hintType, 'away', index)}
              hintsUsed={Array.from({ length: 11 }, (_, index) => ({
                number: revealedHintsAway[index]?.number || false,
                nationality: revealedHintsAway[index]?.nationality || false
              }))}
              canUseHint={myHints > 0 && isMyTurn && !isGameOver}
            />
          </div>

          {/* Info partita */}
          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>
              {(currentMatch as any).homeTeam || 'Casa'} vs {(currentMatch as any).awayTeam || 'Ospiti'}
            </p>
            <p>
              {currentMatch.date === '01/01/2024' && currentMatch.season 
                ? `Stagione ${currentMatch.season}` 
                : currentMatch.date} • {currentMatch.competition}
            </p>
          </div>
        </div>
      </div>
      
      {/* Dialog conferma abbandono */}
      {showForfeitConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="text-2xl font-bold mb-4 text-center">Abbandona Partita</h2>
            <p className="text-center mb-6">
              Sei sicuro di voler abbandonare questa sfida? 
              <br />
              <strong className="text-red-600">Perderai automaticamente</strong> e l'avversario vincerà.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => setShowForfeitConfirm(false)}
                variant="outline"
                className="flex-1"
              >
                Annulla
              </Button>
              <Button
                onClick={handleForfeit}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                Abbandona
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ChallengeGame;
