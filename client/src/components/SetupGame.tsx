import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Play, Plus, Trash2, Trophy, Target, Clock, HelpCircle, Calendar, Globe, Heart, Swords } from "lucide-react";
import { SeasonRange, Competition, setMatchFilters, getAvailableMatchesCount } from "@/lib/game-logic";
import { cn } from "@/lib/utils";
import { NavigationBar } from "@/components/NavigationBar";
import { FeedbackModal } from "@/components/FeedbackModal";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "react-i18next";

interface SetupGameProps {
  onStartGame: (players: string[], gameMode: 'challenge' | 'training') => void;
  onStartMatchOfTheDay?: (players: string[], gameMode: 'challenge' | 'training') => void;
  onStartAsyncChallenge?: (challengeId: number) => void;
}

const seasonRanges: { value: SeasonRange; label: string }[] = [
  { value: 'all', label: 'Tutte' },
  { value: '2000-05', label: '2000-2005' },
  { value: '2006-10', label: '2006-2010' },
  { value: '2011-15', label: '2011-2015' },
  { value: '2016-20', label: '2016-2020' },
  { value: '2021-26', label: '2021-2026' },
];

const competitions: { value: Competition; label: string }[] = [
  { value: 'all', label: 'Tutti' },
  { value: 'serie-a', label: 'Serie A' },
  { value: 'la-liga', label: 'La Liga' },
  { value: 'ligue-1', label: 'Ligue 1' },
  { value: 'bundesliga', label: 'Bundesliga' },
  { value: 'premier-league', label: 'Premier League' },
  { value: 'international', label: 'Nazionali' },
  { value: 'european-cups', label: 'Coppe Europee' },
];

export function SetupGame({ onStartGame, onStartMatchOfTheDay, onStartAsyncChallenge }: SetupGameProps) {
  const [players, setPlayers] = useState<string[]>(["Giocatore 1", "Giocatore 2"]);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [gameMode, setGameMode] = useState<'challenge' | 'training'>('challenge');
  const [seasonRange, setSeasonRange] = useState<SeasonRange>('all');
  const [competition, setCompetition] = useState<Competition>('serie-a');
  const [availableMatches, setAvailableMatches] = useState(0);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const [setupMode, setSetupMode] = useState<'local' | 'online' | 'live'>('local');
  const [selectedFriendId, setSelectedFriendId] = useState<number | null>(null);
  const [challengeMode, setChallengeMode] = useState<'standard' | 'rapid'>('standard');
  const [selectedTimeLimit, setSelectedTimeLimit] = useState<number>(600); // Default 10 minuti
  const [liveCompetition, setLiveCompetition] = useState<Competition>('serie-a'); // Campionato per Live

  const { user } = useAuth();
  const { t } = useTranslation();
  const { data: friends } = trpc.friends.getFriends.useQuery(undefined, { enabled: !!user });
  const createChallengeMutation = trpc.challenges.createChallenge.useMutation();
  const enterMatchmakingMutation = trpc.challenges.enterMatchmaking.useMutation();

  // Aggiorna i filtri quando cambiano stagione o campionato
  useEffect(() => {
    setMatchFilters({ seasonRange, competition });
    setAvailableMatches(getAvailableMatchesCount());
  }, [seasonRange, competition]);

  const addPlayer = () => {
    if (players.length >= 8) return;
    const name = newPlayerName.trim() || `Giocatore ${players.length + 1}`;
    setPlayers([...players, name]);
    setNewPlayerName("");
  };

  const removePlayer = (index: number) => {
    if (players.length <= 1) return;
    const newPlayers = players.filter((_, i) => i !== index);
    setPlayers(newPlayers);
  };

  const updatePlayerName = (index: number, name: string) => {
    const newPlayers = [...players];
    newPlayers[index] = name;
    setPlayers(newPlayers);
  };

  const handleCreateChallenge = async () => {
    if (!selectedFriendId) {
      alert("Seleziona un amico da sfidare!");
      return;
    }

    try {
      // Get a random match with current filters
      setMatchFilters({ seasonRange, competition });
      const { getRandomMatch } = await import('@/lib/game-logic');
      const match = getRandomMatch();
      
      const matchData = {
        competition,
        period: seasonRange,
        match: match, // Save complete match data
      };

      const result = await createChallengeMutation.mutateAsync({
        opponentId: selectedFriendId,
        competition,
        period: seasonRange,
        matchData: JSON.stringify(matchData),
        gameMode: challengeMode,
      });

      alert("Sfida inviata con successo!");
      // Reset selection
      setSelectedFriendId(null);
    } catch (error: any) {
      alert(error.message || "Errore durante la creazione della sfida");
    }
  };

  const handleStartLive = async () => {
    if (!selectedTimeLimit || !liveCompetition) return;
    
    try {
      // TODO: Se selectedFriendId è impostato, creare sfida diretta
      // Altrimenti, entrare in matchmaking
      const result = await enterMatchmakingMutation.mutateAsync({
        timeLimit: selectedTimeLimit,
        competition: liveCompetition, // Passa campionato selezionato
      });
      
      // Redirect a schermata ricerca avversario
      window.location.href = `/matchmaking?queueId=${result.queueId}`;
    } catch (error: any) {
      alert(error.message || "Errore durante l'avvio della modalità Live");
    }
  };

  return (
    <>
      <NavigationBar onFeedbackClick={() => setIsFeedbackOpen(true)} />
      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
      <div className="min-h-screen bg-background text-foreground p-4 md:p-8 font-mono pt-24">
      <div className="max-w-4xl mx-auto">
        {/* Header con titolo e descrizione */}
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-display font-bold uppercase tracking-tighter text-primary mb-2">
            KICKOFF Trivia
          </h1>
          <p className="text-muted-foreground font-bold uppercase tracking-widest text-sm mb-4">
            {t('setup.title', 'KICKOFF Trivia')}
          </p>

        </header>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Colonna sinistra: Come si gioca */}
          <div className="bg-card border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6">
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
                  <h3 className="font-bold uppercase">{t('setup.step1Titolo')}</h3>
                  <p className="text-muted-foreground">{t('setup.step1Desc')}</p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">2</div>
                <div>
                  <h3 className="font-bold uppercase">{t('setup.step2Titolo')}</h3>
                  <p className="text-muted-foreground">{t('setup.step2Desc')}</p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">3</div>
                <div>
                  <h3 className="font-bold uppercase">{t('setup.step3Titolo')}</h3>
                  <p className="text-muted-foreground">{t('setup.step3Desc')}</p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">4</div>
                <div>
                  <h3 className="font-bold uppercase">{t('setup.step4Titolo')}</h3>
                  <p className="text-muted-foreground">{t('setup.step4Desc')}</p>
                </div>
              </div>
            </div>
            )}

            {/* Statistiche del database */}
            <div className="mt-6 pt-6 border-t-2 border-black">
              <h3 className="font-bold uppercase mb-3 flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                {t('setup.ilNostroDatabase')}
              </h3>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="bg-background p-3 border-2 border-black">
                  <div className="text-sm md:text-lg font-bold text-primary leading-tight">{t('setup.datiTransfermarkt')}</div>
                  <div className="text-xs uppercase text-muted-foreground">{t('setup.partiteStoriche')}</div>
                </div>
                <div className="bg-background p-3 border-2 border-black">
                  <div className="text-2xl font-bold text-primary">{t('setup.periodo')}</div>
                  <div className="text-xs uppercase text-muted-foreground">{t('setup.stagioni')}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Colonna destra: Setup giocatori */}
          <div className="bg-card border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6">
            <h2 className="text-2xl font-display font-bold uppercase mb-6 flex items-center gap-2">
              <Users className="h-6 w-6" />
              {t('setup.configurazione')}
            </h2>

            {/* Tab selector: Locale vs Online vs Live */}
            <div className="mb-6 grid grid-cols-3 gap-2">
              <button
                onClick={() => setSetupMode('local')}
                className={cn(
                  "p-3 border-2 border-black text-center transition-all font-bold uppercase text-sm",
                  setupMode === 'local'
                    ? "bg-pink-400 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                    : "bg-white hover:bg-gray-50"
                )}
              >
                <Users className="h-5 w-5 mx-auto mb-1" />
                {t('setup.locale')}
              </button>
              <button
                onClick={() => setSetupMode('online')}
                className={cn(
                  "p-3 border-2 border-black text-center transition-all font-bold uppercase text-sm",
                  setupMode === 'online'
                    ? "bg-pink-400 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                    : "bg-white hover:bg-gray-50"
                )}
                disabled={!user}
              >
                <Swords className="h-5 w-5 mx-auto mb-1" />
                {t('setup.sfidaAmicoTab')}
              </button>
              <button
                onClick={() => setSetupMode('live')}
                className={cn(
                  "p-3 border-2 border-black text-center transition-all font-bold uppercase text-sm",
                  setupMode === 'live'
                    ? "bg-pink-400 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                    : "bg-white hover:bg-gray-50"
                )}
                disabled={!user}
              >
                <Clock className="h-5 w-5 mx-auto mb-1" />
                {t('setup.live')}
              </button>
            </div>

            {setupMode === 'local' ? (
              <>
                {/* Setup locale (esistente) */}
                <div className="space-y-4 mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <label className="font-bold uppercase text-sm">{t('setup.giocatori')} ({players.length}/8)</label>
                  </div>
                  
                  <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2">
                    {players.map((player, index) => (
                      <div key={index} className="flex gap-2">
                        <div className="flex-1 relative">
                          <div className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-xs text-muted-foreground">
                            P{index + 1}
                          </div>
                          <Input
                            value={player}
                            onChange={(e) => updatePlayerName(index, e.target.value)}
                            className="pl-10 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus-visible:ring-0 focus-visible:border-primary font-bold uppercase"
                          />
                        </div>
                        {players.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removePlayer(index)}
                            className="hover:bg-red-100 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>

                  {players.length < 8 && (
                    <Button
                      onClick={addPlayer}
                      variant="outline"
                      className="w-full border-2 border-dashed border-black hover:bg-gray-50 font-bold uppercase"
                    >
                      <Plus className="mr-2 h-4 w-4" /> {t('setup.aggiungiGiocatore')}
                    </Button>
                  )}
                </div>

                {/* Filtri Stagioni */}
                <div className="mb-6">
                  <h3 className="font-bold uppercase text-sm mb-3 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {t('setup.intervalloStagioni')}
                  </h3>
                  <select
                    value={seasonRange}
                    onChange={(e) => setSeasonRange(e.target.value as SeasonRange)}
                    className="w-full p-3 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold uppercase text-sm bg-background focus:outline-none focus:border-primary"
                  >
                    {seasonRanges.map(range => (
                      <option key={range.value} value={range.value}>{range.label}</option>
                    ))}
                  </select>
                </div>

                {/* Filtri Campionato */}
                <div className="mb-6">
                  <h3 className="font-bold uppercase text-sm mb-3 flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Campionato
                  </h3>
                  <select
                    value={competition}
                    onChange={(e) => setCompetition(e.target.value as Competition)}
                    className="w-full p-3 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold uppercase text-sm bg-background focus:outline-none focus:border-primary"
                  >
                    {competitions.map(comp => (
                      <option key={comp.value} value={comp.value}>{comp.label}</option>
                    ))}
                  </select>
                  {availableMatches > 0 && (
                    <div className="mt-2 text-xs text-muted-foreground text-center">
                      {availableMatches} {t('setup.partiteDisponibili')}
                    </div>
                  )}
                </div>

                {/* Selezione modalità */}
                <div className="mb-6">
                  <h3 className="font-bold uppercase text-sm mb-3 flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    {t('setup.modalitaSelezionata')}
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setGameMode('challenge')}
                      className={cn(
                        "p-4 border-2 border-black text-left transition-all",
                        gameMode === 'challenge'
                          ? "bg-primary text-primary-foreground shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                          : "bg-background hover:bg-gray-50"
                      )}
                    >
                      <div className="font-bold uppercase text-sm mb-1">🔥 {t('setup.sfida')}</div>
                      <div className={cn(
                        "text-xs",
                        gameMode === 'challenge' ? "text-primary-foreground/80" : "text-muted-foreground"
                      )}>
                        {t('setup.sfida5vite')}
                      </div>
                    </button>
                    <button
                      onClick={() => setGameMode('training')}
                      className={cn(
                        "p-4 border-2 border-black text-left transition-all",
                        gameMode === 'training'
                          ? "bg-primary text-primary-foreground shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                          : "bg-background hover:bg-gray-50"
                      )}
                    >
                      <div className="font-bold uppercase text-sm mb-1">📚 {t('setup.allenamento')}</div>
                      <div className={cn(
                        "text-xs",
                        gameMode === 'training' ? "text-primary-foreground/80" : "text-muted-foreground"
                      )}>
                        {t('setup.allenamentoInfinito')}
                      </div>
                    </button>
                  </div>
                </div>

                <Button
                  onClick={() => onStartGame(players, gameMode)}
                  className="w-full h-14 text-xl font-display font-bold bg-black text-white hover:bg-gray-800 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:shadow-none transition-all"
                >
                  <Play className="mr-2 h-6 w-6" /> {t('setup.iniziaPartita')}
                </Button>
              </>
            ) : setupMode === 'online' ? (
              <>
                {/* Setup online - Sfida un amico */}
                {!user ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">{t('setup.loginOnline')}</p>
                  </div>
                ) : (
                  <>
                    <div className="mb-4 p-3 bg-blue-50 border-2 border-blue-300 text-sm text-blue-900">
                      <strong>{t('setup.sfidaAmico')}:</strong> {t('setup.sfidaAsincrona')}
                    </div>

                    {/* Selezione modalità Standard / Rapid */}
                    <div className="mb-6">
                      <h3 className="font-bold uppercase text-sm mb-3 flex items-center gap-2">
                        <Swords className="h-4 w-4" />
                        Modalità di Gioco
                      </h3>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setChallengeMode('standard')}
                          className={`p-3 border-2 border-black font-bold uppercase text-sm transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-y-0.5 ${
                            challengeMode === 'standard'
                              ? 'bg-pink-500 text-white'
                              : 'bg-white text-black'
                          }`}
                        >
                          📋 Standard
                          <div className="text-xs font-normal mt-1 normal-case">3 tentativi/turno</div>
                        </button>
                        <button
                          onClick={() => setChallengeMode('rapid')}
                          className={`p-3 border-2 border-black font-bold uppercase text-sm transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-y-0.5 ${
                            challengeMode === 'rapid'
                              ? 'bg-pink-500 text-white'
                              : 'bg-white text-black'
                          }`}
                        >
                          ⚡ Rapid
                          <div className="text-xs font-normal mt-1 normal-case">1 tentativo, timer 10min</div>
                        </button>
                      </div>
                    </div>

                    {/* Selezione amico */}
                    <div className="mb-6">
                      <h3 className="font-bold uppercase text-sm mb-3 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        {t('setup.selezionaAmico')}
                      </h3>
                      <select
                        value={selectedFriendId || ''}
                        onChange={(e) => setSelectedFriendId(Number(e.target.value) || null)}
                        className="w-full p-3 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold uppercase text-sm bg-background focus:outline-none focus:border-primary"
                      >
                        <option value="">{t('setup.scegliAmico')}</option>
                        {friends?.map((friend: any) => (
                          <option key={friend.id} value={friend.id}>
                            {friend.name}
                          </option>
                        ))}
                      </select>
                      {(!friends || friends.length === 0) && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {t('setup.nessunAmico')} <a href="/amici" className="underline">{t('setup.aggiungiAmici')}</a>
                        </p>
                      )}
                    </div>

                    {/* Filtri Stagioni */}
                    <div className="mb-6">
                      <h3 className="font-bold uppercase text-sm mb-3 flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Intervallo Stagioni
                      </h3>
                      <select
                        value={seasonRange}
                        onChange={(e) => setSeasonRange(e.target.value as SeasonRange)}
                        className="w-full p-3 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold uppercase text-sm bg-background focus:outline-none focus:border-primary"
                      >
                        {seasonRanges.map(range => (
                          <option key={range.value} value={range.value}>{range.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Filtri Campionato */}
                    <div className="mb-6">
                      <h3 className="font-bold uppercase text-sm mb-3 flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        {t('setup.campionato')}
                      </h3>
                      <select
                        value={competition}
                        onChange={(e) => setCompetition(e.target.value as Competition)}
                        className="w-full p-3 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold uppercase text-sm bg-background focus:outline-none focus:border-primary"
                      >
                        {competitions.map(comp => (
                          <option key={comp.value} value={comp.value}>{comp.label}</option>
                        ))}
                      </select>
                      {availableMatches > 0 && (
                        <div className="mt-2 text-xs text-muted-foreground text-center">
                          {availableMatches} {t('setup.partiteDisponibili')}
                        </div>
                      )}
                    </div>

                    <Button
                      onClick={handleCreateChallenge}
                      disabled={!selectedFriendId || createChallengeMutation.isPending}
                      className="w-full h-14 text-xl font-display font-bold bg-black text-white hover:bg-gray-800 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Swords className="mr-2 h-6 w-6" /> 
                      {createChallengeMutation.isPending ? t('setup.invioSfida') : t('setup.inviaSfida')}
                    </Button>
                  </>
                )}
              </>
            ) : setupMode === 'live' ? (
              <>
                {/* Setup Live - Matchmaking Rapid */}
                {!user ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">{t('setup.loginLive')}</p>
                  </div>
                ) : (
                  <>
                    <div className="mb-4 p-3 bg-purple-50 border-2 border-purple-300 text-sm text-purple-900">
                      <strong>{t('setup.live')}:</strong> {t('setup.liveInfo')}
                    </div>

                    {/* Selezione campionato */}
                    <div className="mb-6">
                      <h3 className="font-bold uppercase text-sm mb-3 flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        {t('setup.campionato')}
                      </h3>
                      <div className="grid grid-cols-2 gap-2">
                        {competitions.filter(c => c.value !== 'all').map((comp) => (
                          <button
                            key={comp.value}
                            onClick={() => setLiveCompetition(comp.value)}
                            className={cn(
                              "p-3 border-2 border-black text-center transition-all font-bold text-xs",
                              liveCompetition === comp.value
                                ? "bg-pink-400 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                                : "bg-white hover:bg-gray-50"
                            )}
                          >
                            {comp.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Selezione tempo */}
                    <div className="mb-6">
                      <h3 className="font-bold uppercase text-sm mb-3 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Tempo Partita
                      </h3>
                      <div className="grid grid-cols-5 gap-2">
                        {[3, 5, 10, 20, 30].map((minutes) => (
                          <button
                            key={minutes}
                            onClick={() => setSelectedTimeLimit(minutes * 60)}
                            className={cn(
                              "p-3 border-2 border-black text-center transition-all font-bold text-sm",
                              selectedTimeLimit === minutes * 60
                                ? "bg-pink-400 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                                : "bg-white hover:bg-gray-50"
                            )}
                          >
                            {minutes}'
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Selezione amico (facoltativo) */}
                    <div className="mb-6">
                      <h3 className="font-bold uppercase text-sm mb-3 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        {t('setup.sfidaAmicoFacoltativo')}
                      </h3>
                      <select
                        value={selectedFriendId || ''}
                        onChange={(e) => setSelectedFriendId(Number(e.target.value) || null)}
                        className="w-full p-3 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold uppercase text-sm bg-background focus:outline-none focus:border-primary"
                      >
                        <option value="">{t('setup.matchmakingCasuale')}</option>
                        {friends?.map((friend: any) => (
                          <option key={friend.id} value={friend.id}>
                            {friend.name}
                          </option>
                        ))}
                      </select>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {t('setup.matchmakingDesc')}
                      </p>
                    </div>

                    <Button
                      onClick={handleStartLive}
                      disabled={!selectedTimeLimit || enterMatchmakingMutation.isPending}
                      className="w-full h-14 text-xl font-display font-bold bg-black text-white hover:bg-gray-800 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Clock className="mr-2 h-6 w-6" /> 
                      {enterMatchmakingMutation.isPending ? t('setup.ricercaAvversario') : t('setup.iniziaLive')}
                    </Button>
                  </>
                )}
              </>
            ) : null}

            {/* Pulsante Donazioni PayPal */}
            <a
              href="https://www.paypal.com/pool/9lCKCiF8hN?sr=wccr"
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-4"
            >
              <Button
                variant="outline"
                className="w-full h-12 font-bold bg-background hover:bg-gray-50 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:shadow-none transition-all"
              >
                <Heart className="mr-2 h-5 w-5 text-red-500" />
                {t('setup.supportaProgetto')}
              </Button>
            </a>
          </div>
        </div>

        {/* Footer con informazioni aggiuntive */}
        <footer className="mt-8 text-center text-sm text-muted-foreground space-y-3">
          <p>
            {t('setup.footerDesc')}
          </p>
          <p>
            {t('setup.footerErrore')}
          </p>
          <div className="pt-4 border-t border-border">
            <p className="text-xs font-bold uppercase tracking-wider">
              {t('common.tuttiDiritti')}
            </p>
          </div>
        </footer>
      </div>
    </div>
    </>
  );
}
