import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'wouter';
import { NavigationBar } from '@/components/NavigationBar';
import { FeedbackModal } from '@/components/FeedbackModal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { useAchievements } from '@/hooks/useAchievements';

// ─── Tipi ────────────────────────────────────────────────────────────────────

interface Player {
  player_id: string;
  name: string;
  serie_a_apps: number;
}

interface InputPlayer {
  player_id: string;
  name: string;
}

// ─── Utilità alfabetica ───────────────────────────────────────────────────────

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // rimuove accenti
    .replace(/[^a-zA-Z\s]/g, '')       // rimuove caratteri non-lettera
    .trim()
    .toLowerCase();
}

/**
 * Prefissi nobiliari/particelle che fanno parte del cognome.
 * Vengono riconosciuti in modo case-insensitive.
 */
const SURNAME_PREFIXES = [
  "de", "di", "da", "dal", "dall", "dalla", "del", "della", "degli", "dei",
  "lo", "la", "van", "van den", "van der", "van de",
  "o", "el", "al",
  "dos", "das", "do", "du", "d",
  "de la", "de los", "de las",
];

/** Estrae il cognome (con eventuali prefissi composti) rimuovendo prefissi tipo "#17 " */
function extractLastName(fullName: string): string {
  const clean = fullName.replace(/^#\d+\s*/, '').trim();
  const parts = clean.split(/\s+/);
  if (parts.length <= 1) return clean;

  // Scorre da destra verso sinistra: se la parola precedente all'ultima è un prefisso,
  // la include nel cognome. Continua finché trova prefissi consecutivi.
  let surnameStart = parts.length - 1;
  for (let i = parts.length - 2; i >= 0; i--) {
    // Normalizza rimuovendo apostrofi finali per confronto (dall' → dall, o' → o)
    const word = parts[i].toLowerCase().replace(/[''`]$/, '');
    if (SURNAME_PREFIXES.includes(word)) {
      surnameStart = i;
    } else {
      break;
    }
  }

  return parts.slice(surnameStart).join(' ') || clean;
}

/** Confronto alfabetico normalizzato: -1 se a<b, 0 se uguale, 1 se a>b */
function cmpNorm(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na < nb) return -1;
  if (na > nb) return 1;
  return 0;
}

// ─── Componente principale ────────────────────────────────────────────────────

export default function AaronsZurkowskiGame() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth({});
  const { unlock } = useAchievements();
  const recordGamePlayed = trpc.achievements.recordGamePlayed.useMutation();
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  // Poliglotta: record that the user played this game
  useEffect(() => {
    if (isAuthenticated) recordGamePlayed.mutate({ gameType: 'aarons-zurkowski' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Dati database
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);       // per estrazione
  const [dataLoaded, setDataLoaded] = useState(false);
  const [inputDataLoaded, setInputDataLoaded] = useState(false);

  // Lista cognomi ordinati (normalizzati per confronto, originali per display)
  const [sortedLastNames, setSortedLastNames] = useState<string[]>([]); // originali ordinati (dal db grande)

  // Giocatori (turni)
  const [players, setPlayers] = useState<string[]>(['Giocatore 1']);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);

  // Stato gioco
  const [secretLastName, setSecretLastName] = useState('');       // cognome da indovinare
  const [secretFullName, setSecretFullName] = useState('');       // nome completo (per la resa)
  const [lowBound, setLowBound] = useState('Aarons');             // limite basso corrente
  const [highBound, setHighBound] = useState('Żurkowski');        // limite alto corrente
  const [guess, setGuess] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [history, setHistory] = useState<{ player: string; guess: string; direction: 'up' | 'down' | 'hit' }[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [surrendered, setSurrendered] = useState(false);
  const [scores, setScores] = useState<Record<string, number>>({});

  const inputRef = useRef<HTMLInputElement>(null);

  // ─── Caricamento database ───────────────────────────────────────────────────

  // DB 1: giocatori estraibili (2.209 con >= 30 presenze Serie A 2000-2027)
  useEffect(() => {
    fetch('/data/player_serie_a_apps_only.b7bc76ba.json?v=202627')
      .then(r => r.json())
      .then((data: Player[]) => {
        setAllPlayers(data);
        setDataLoaded(true);
      })
      .catch(() => toast.error(t('az.erroreCaricamento', 'Errore nel caricamento del database')));
  }, [t]);

  // DB 2: giocatori inseribili dall'utente (6.330 dal database completo 2000-2027)
  useEffect(() => {
    fetch('/data/serie_a_input_players.eb6552ce.json?v=202627')
      .then(r => r.json())
      .then((data: InputPlayer[]) => {
        // Costruisce lista cognomi unici ordinati alfabeticamente
        const lastNames = data
          .filter(p => p.name)
          .map(p => extractLastName(p.name));

        // Deduplica (case-insensitive normalizzato) mantenendo forma originale
        const seen = new Set<string>();
        const unique: string[] = [];
        for (const ln of lastNames) {
          const key = normalize(ln);
          if (!seen.has(key)) {
            seen.add(key);
            unique.push(ln);
          }
        }

        // Ordina alfabeticamente per cognome normalizzato
        unique.sort((a, b) => cmpNorm(a, b));
        setSortedLastNames(unique);
        setInputDataLoaded(true);
      })
      .catch(() => toast.error(t('az.erroreCaricamento', 'Errore nel caricamento del database nomi')));
  }, [t]);

  // ─── Lettura parametri URL (giocatori) ─────────────────────────────────────

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('players');
    if (raw) {
      try {
        const parsed = JSON.parse(decodeURIComponent(raw));
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPlayers(parsed);
          const init: Record<string, number> = {};
          parsed.forEach((p: string) => { init[p] = 0; });
          setScores(init);
        }
      } catch { /* usa default */ }
    }
  }, []);

  // ─── Avvio nuova partita ────────────────────────────────────────────────────

  const startNewGame = useCallback(() => {
    if (!dataLoaded || !inputDataLoaded || allPlayers.length === 0) return;

    // Estrae un giocatore casuale
    const randomPlayer = allPlayers[Math.floor(Math.random() * allPlayers.length)];
    const lastName = extractLastName(randomPlayer.name);

    setSecretLastName(lastName);
    setSecretFullName(randomPlayer.name.replace(/^#\d+\s*/, '').trim());
    setLowBound('Aarons');
    setHighBound('Żurkowski');
    setGuess('');
    setAttempts(0);
    setHistory([]);
    setGameOver(false);
    setSurrendered(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [dataLoaded, inputDataLoaded, allPlayers]);

  useEffect(() => {
    if (dataLoaded && inputDataLoaded) startNewGame();
  }, [dataLoaded, inputDataLoaded, startNewGame]);

  // ─── Logica tentativo ───────────────────────────────────────────────────────

  const handleGuess = () => {
    const raw = guess.trim();
    if (!raw) return;

    // 1. Verifica che il cognome esista nel database
    const matchedName = sortedLastNames.find(ln => normalize(ln) === normalize(raw));
    if (!matchedName) {
      toast.error(t('az.cognomeNonTrovato', 'Cognome non trovato nel database!'), { duration: 2000 });
      return;
    }

    // 2. Verifica che sia dentro il range corrente
    const cmpLow = cmpNorm(matchedName, lowBound);
    const cmpHigh = cmpNorm(matchedName, highBound);

    if (cmpLow < 0 || cmpHigh > 0) {
      toast.error(t('az.fuoriRange', 'Cognome fuori dal range corrente!'), { duration: 2000 });
      setGuess('');
      return;
    }

    const currentPlayer = players[currentPlayerIndex];
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);

    // 3. Confronta con il cognome segreto
    const cmpSecret = cmpNorm(matchedName, secretLastName);

    if (cmpSecret === 0) {
      // VITTORIA
      const newHistory = [...history, { player: currentPlayer, guess: matchedName, direction: 'hit' as const }];
      setHistory(newHistory);
      setGameOver(true);
      setScores(prev => ({ ...prev, [currentPlayer]: (prev[currentPlayer] || 0) + 1 }));
      toast.success(`🎉 ${currentPlayer} ${t('az.haIndovinato', 'ha indovinato!')}`, { duration: 3000 });
      // Aarons-Zurkowski achievement
      if (isAuthenticated) {
        const candidates: { achievementId: string; tier: 1 | 2 | 3 }[] = [
          { achievementId: 'aarons-zurkowski', tier: 1 }, // Bronze: win in 1-5 attempts
        ];
        if (newAttempts <= 5) candidates.push({ achievementId: 'aarons-zurkowski', tier: 2 }); // Silver: win in ≤5
        if (newAttempts <= 3) candidates.push({ achievementId: 'aarons-zurkowski', tier: 3 }); // Gold: win in ≤3
        unlock(candidates);
      }
    } else if (cmpSecret > 0) {
      // guess > segreto: il segreto è PRIMA del guess → guess diventa nuovo limite ALTO
      const newHistory = [...history, { player: currentPlayer, guess: matchedName, direction: 'down' as const }];
      setHistory(newHistory);
      setHighBound(matchedName);
      toast.info(`⬇️ ${matchedName} → ${t('az.cercaPrima', 'cerca prima')}`, { duration: 1500 });
    } else {
      // guess < segreto: il segreto è DOPO il guess → guess diventa nuovo limite BASSO
      const newHistory = [...history, { player: currentPlayer, guess: matchedName, direction: 'up' as const }];
      setHistory(newHistory);
      setLowBound(matchedName);
      toast.info(`⬆️ ${matchedName} → ${t('az.cercareDopo', 'cerca dopo')}`, { duration: 1500 });
    }

    setGuess('');

    // Passa al giocatore successivo (se non è game over)
    if (cmpSecret !== 0) {
      setCurrentPlayerIndex(prev => (prev + 1) % players.length);
    }

    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleSurrender = () => {
    setSurrendered(true);
    setGameOver(true);
  };

  // Autocomplete rimosso per non facilitare il gioco

  // ─── Render ─────────────────────────────────────────────────────────────────

  const currentPlayer = players[currentPlayerIndex];

  return (
    <>
      <NavigationBar onFeedbackClick={() => setIsFeedbackOpen(true)} />
      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />

      <div className="min-h-screen bg-background text-foreground p-4 font-mono">
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>

          {/* Header */}
          <div className="bg-card border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 mb-4">
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => setLocation('/aarons-zurkowski')}
                className="text-sm font-bold uppercase hover:text-primary transition-colors"
              >
                ← {t('common.indietro', 'Indietro')}
              </button>
              <h1 className="text-2xl font-display font-bold uppercase text-primary">
                AARONS-ŻURKOWSKI
              </h1>
              <div className="text-sm font-bold text-muted-foreground">
                #{attempts}
              </div>
            </div>

            {/* Punteggi giocatori */}
            {players.length > 1 && (
              <div className="flex gap-2 flex-wrap justify-center mt-2">
                {players.map((p, i) => (
                  <div
                    key={i}
                    className={`px-3 py-1 border-2 border-black text-xs font-bold uppercase ${
                      i === currentPlayerIndex && !gameOver
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background text-foreground'
                    }`}
                  >
                    {p}: {scores[p] || 0}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Schermata di gioco */}
          {!dataLoaded ? (
            <div className="bg-card border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8 text-center">
              <div className="text-xl font-bold animate-pulse">{t('az.caricamento', 'Caricamento database...')}</div>
            </div>
          ) : (
            <div className="bg-card border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 mb-4">

              {/* Range alfabetico */}
              <div className="text-center mb-6">
                <div
                  className="inline-block px-6 py-3 border-4 border-black font-display font-bold text-2xl uppercase mb-3 w-full"
                  style={{ background: '#e8f5e9', color: '#2e7d32' }}
                >
                  {lowBound}
                </div>

                <div className="text-4xl font-bold text-muted-foreground my-2">↕</div>

                {/* Campo input */}
                {!gameOver && (
                  <div className="relative mb-3">
                    {players.length > 1 && (
                      <div className="text-sm font-bold text-primary uppercase mb-2">
                        🎯 {t('az.turno', 'Turno di')} {currentPlayer}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          ref={inputRef}
                          value={guess}
                          onChange={e => setGuess(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleGuess();
                          }}
                          placeholder={t('az.inserisciCognome', 'Inserisci un cognome...')}
                          className="border-4 border-black font-mono text-lg text-center uppercase"
                          autoComplete="off"
                          disabled={gameOver}
                        />
                      </div>
                      <Button
                        onClick={handleGuess}
                        disabled={!guess.trim()}
                        className="border-2 border-black bg-primary text-primary-foreground font-bold uppercase px-6"
                      >
                        {t('az.prova', 'Prova')}
                      </Button>
                    </div>
                  </div>
                )}

                <div
                  className="inline-block px-6 py-3 border-4 border-black font-display font-bold text-2xl uppercase w-full"
                  style={{ background: '#fce4ec', color: '#c62828' }}
                >
                  {highBound}
                </div>
              </div>

              {/* Storico tentativi */}
              {history.length > 0 && (
                <div className="border-t-2 border-black pt-4 mb-4">
                  <h3 className="font-bold uppercase text-sm mb-2">{t('az.tentativi', 'Tentativi')}:</h3>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {[...history].reverse().map((h, i) => (
                      <div
                        key={i}
                        className={`flex items-center justify-between px-3 py-1 border-2 border-black text-sm font-mono ${
                          h.direction === 'hit'
                            ? 'bg-green-100 text-green-800'
                            : h.direction === 'up'
                            ? 'bg-blue-50 text-blue-800'
                            : 'bg-orange-50 text-orange-800'
                        }`}
                      >
                        <span className="font-bold">{h.guess}</span>
                        <span>
                          {h.direction === 'hit' ? '✅' : h.direction === 'up' ? '⬆️' : '⬇️'}
                        </span>
                        {players.length > 1 && (
                          <span className="text-xs text-muted-foreground">{h.player}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Schermata fine partita */}
              {gameOver && (
                <div className={`border-4 border-black p-6 text-center mb-4 ${surrendered ? 'bg-red-50' : 'bg-green-50'}`}>
                  {surrendered ? (
                    <>
                      <div className="text-4xl mb-2">🏳️</div>
                      <h2 className="text-2xl font-display font-bold uppercase mb-2 text-red-700">
                        {t('az.resa', 'Resa!')}
                      </h2>
                      <p className="text-lg font-bold mb-1">
                        {t('az.eraCognome', 'Il cognome era:')}
                      </p>
                      <p className="text-3xl font-display font-bold uppercase text-red-700 mb-1">
                        {secretLastName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        ({secretFullName})
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="text-4xl mb-2">🎉</div>
                      <h2 className="text-2xl font-display font-bold uppercase mb-2 text-green-700">
                        {players.length > 1
                          ? `${players[currentPlayerIndex]} ${t('az.haVinto', 'ha vinto!')}`
                          : t('az.vittoria', 'Hai indovinato!')}
                      </h2>
                      <p className="text-3xl font-display font-bold uppercase text-green-700 mb-1">
                        {secretLastName}
                      </p>
                      <p className="text-sm text-muted-foreground mb-2">
                        ({secretFullName})
                      </p>
                      <p className="text-sm font-bold">
                        {t('az.tentativiUsati', 'Tentativi usati')}: <strong>{attempts}</strong>
                      </p>
                    </>
                  )}

                  {/* Punteggi finali */}
                  {players.length > 1 && (
                    <div className="mt-4 border-t-2 border-black pt-4">
                      <h3 className="font-bold uppercase text-sm mb-2">{t('az.punteggi', 'Punteggi')}:</h3>
                      <div className="flex gap-2 flex-wrap justify-center">
                        {players
                          .slice()
                          .sort((a, b) => (scores[b] || 0) - (scores[a] || 0))
                          .map((p, i) => (
                            <div key={i} className="px-3 py-1 border-2 border-black text-sm font-bold">
                              {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} {p}: {scores[p] || 0}
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Pulsanti azione */}
              <div className="flex gap-3 flex-wrap">
                {!gameOver && (
                  <Button
                    onClick={handleSurrender}
                    variant="outline"
                    className="flex-1 border-2 border-black font-bold uppercase text-red-600 hover:bg-red-50"
                  >
                    🏳️ {t('az.arrenditi', 'Arrenditi')}
                  </Button>
                )}
                <Button
                  onClick={startNewGame}
                  className="flex-1 border-2 border-black font-bold uppercase bg-primary text-primary-foreground hover:opacity-90"
                >
                  🔄 {t('az.nuovaPartita', 'Nuova Partita')}
                </Button>
                <Button
                  onClick={() => setLocation('/aarons-zurkowski')}
                  variant="outline"
                  className="flex-1 border-2 border-black font-bold uppercase"
                >
                  🏠 {t('common.menu', 'Menu')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
