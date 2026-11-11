import { Button } from "@/components/ui/button";
import { Users, Trophy, Link2, TrendingUp, ChevronDown, ArrowUpDown } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { NavigationBar } from "@/components/NavigationBar";
import { FeedbackModal } from "@/components/FeedbackModal";
import { DonationProgress } from "@/components/DonationProgress";
import { Footer } from "@/components/Footer";
import { InstallAppButton } from "@/components/InstallAppButton";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/ThemeContext";

export default function GameSelection() {
  const [, setLocation] = useLocation();
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const { user } = useAuth();
  const { t } = useTranslation();
  const { isModern } = useTheme();
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [showDonationDropdown, setShowDonationDropdown] = useState(false);
  const donationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (donationRef.current && !donationRef.current.contains(e.target as Node)) {
        setShowDonationDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Query per sfide attive (sia quelle dove è il turno dell'utente che quelle dell'avversario)
  const { data: activeChallenges } = trpc.challenges.getMyChallenges.useQuery(
    undefined,
    { enabled: !!user }
  );
  
  // Filtra solo sfide attive e ordina: prima quelle dove è il turno dell'utente
  const sortedActiveChallenges = activeChallenges
    ?.filter(c => c.status === 'active')
    .sort((a, b) => {
      // Priorità a sfide dove è il turno dell'utente
      const aIsMyTurn = a.currentTurn === user?.openId;
      const bIsMyTurn = b.currentTurn === user?.openId;
      if (aIsMyTurn && !bIsMyTurn) return -1;
      if (!aIsMyTurn && bIsMyTurn) return 1;
      return 0;
    }) || [];
  
  // Query per record Maratona
  const { data: maratonaRecord } = trpc.leaderboard.getMaratonaRecord.useQuery();
  
  // Query per campioni Link (Facile e Difficile)
  const { data: linkLeadersEasy } = trpc.leaderboard.getTopScores.useQuery({
    gameType: 'link',
    competition: 'serie-a',
    difficulty: 'easy',
    limit: 1,
  });
  
  const { data: linkLeadersHard } = trpc.leaderboard.getTopScores.useQuery({
    gameType: 'link',
    competition: 'serie-a',
    difficulty: 'hard',
    limit: 1,
  });
  
  // Query per campioni Progressione (tutte le modalità)
  const { data: progressioneHeight } = trpc.leaderboard.getTopScores.useQuery({
    gameType: 'progressione',
    competition: 'serie-a',
    difficulty: 'height',
    limit: 1,
  });
  
  const { data: progressioneAge } = trpc.leaderboard.getTopScores.useQuery({
    gameType: 'progressione',
    competition: 'serie-a',
    difficulty: 'age',
    limit: 1,
  });
  
  const { data: progressioneTransfers } = trpc.leaderboard.getTopScores.useQuery({
    gameType: 'progressione',
    competition: 'serie-a',
    difficulty: 'transfers',
    limit: 1,
  });
  
  const { data: progressioneGoals } = trpc.leaderboard.getTopScores.useQuery({
    gameType: 'progressione',
    competition: 'serie-a',
    difficulty: 'gol-totali',
    limit: 1,
  });
  
  const { data: progressioneAppearances } = trpc.leaderboard.getTopScores.useQuery({
    gameType: 'progressione',
    competition: 'serie-a',
    difficulty: 'presenze-totali',
    limit: 1,
  });
  
  const currentChallenge = sortedActiveChallenges[currentChallengeIndex];
  const hasActiveChallenges = sortedActiveChallenges.length > 0;
  
  // Sfide Live (rapid) attive - solo quelle ancora in corso (status active)
  const activeLiveChallenges = sortedActiveChallenges.filter(c => c.gameMode === 'rapid' && c.status === 'active');
  const activeLiveChallenge = activeLiveChallenges[0] || null;
  
  const handlePrevChallenge = () => {
    setCurrentChallengeIndex(prev => 
      prev === 0 ? sortedActiveChallenges.length - 1 : prev - 1
    );
  };
  
  const handleNextChallenge = () => {
    setCurrentChallengeIndex(prev => 
      prev === sortedActiveChallenges.length - 1 ? 0 : prev + 1
    );
  };

  return (
    <>
      <NavigationBar onFeedbackClick={() => setIsFeedbackOpen(true)} />
      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
      
      {/* Banner Partita Live in corso */}
      {user && activeLiveChallenge && (
        <div className="fixed top-14 left-0 right-0 z-40 bg-gradient-to-r from-orange-500 to-red-500 border-b-4 border-black shadow-[0px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="container max-w-5xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <span className="animate-pulse text-lg">🔴</span>
              <span className="uppercase tracking-wide">{t('game.partitaInCorso')} {activeLiveChallenge.opponent?.name}</span>
            </div>
            <button
              onClick={() => setLocation(`/sfida/${activeLiveChallenge.id}`)}
              className="flex-shrink-0 bg-white text-black font-black text-xs uppercase px-3 py-1.5 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all active:scale-95"
            >
              {t('game.tornaPartita')}
            </button>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-background flex items-center justify-center p-4 pt-20">
      <div className="container max-w-5xl">
        {/* Header */}
        <header className="text-center mb-4">
          <h1 className={`text-6xl md:text-8xl font-bold uppercase tracking-tighter mb-2 ${
            isModern
              ? "font-sans bg-gradient-to-r from-green-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent"
              : "font-display text-primary"
          }`}>
            KICKOFF TRIVIA
          </h1>
          <p className="text-muted-foreground font-bold uppercase tracking-widest text-sm mb-6">
            {t('home.subtitle')}
          </p>
          
          {/* Carosello Sfide Attive o Pulsante Sfide Online - Solo Desktop */}
          <div className="hidden md:flex justify-center items-center gap-2 mb-6 px-4">
            {hasActiveChallenges && currentChallenge ? (
              <>
                {/* Freccia Sinistra */}
                {sortedActiveChallenges.length > 1 && (
                  <button
                    onClick={handlePrevChallenge}
                    className="flex-shrink-0 bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all p-3 min-w-[48px] min-h-[48px] flex items-center justify-center touch-manipulation active:scale-95"
                    aria-label="Sfida precedente"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                )}
                
                {/* Pulsante Sfida Corrente - Dimensioni fisse */}
                <button
                  onClick={() => setLocation(`/sfida/${currentChallenge.id}`)}
                  className="flex-1 max-w-[280px] bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold uppercase px-4 py-5 text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all truncate border-2 border-black touch-manipulation active:scale-95 min-h-[48px]"
                >
                  🏆 vs {currentChallenge.opponent.name}
                  {currentChallenge.currentTurn === user?.openId && " | " + t('home.sfideOnline')}
                </button>
                
                {/* Freccia Destra */}
                {sortedActiveChallenges.length > 1 && (
                  <button
                    onClick={handleNextChallenge}
                    className="flex-shrink-0 bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all p-3 min-w-[48px] min-h-[48px] flex items-center justify-center touch-manipulation active:scale-95"
                    aria-label="Sfida successiva"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                )}
              </>
            ) : (
              <Button
                onClick={() => setLocation('/sfide')}
                className="max-w-[280px] bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold uppercase px-6 py-5 text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all"
              >
                🏆 {t('home.sfideOnline')}
              </Button>
            )}
          </div>
        </header>

        {/* Selezione Gioco */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Card Calcio d'inizio (Formazioni) */}
          <div className={`bg-card transition-all duration-300 p-8 cursor-pointer group ${
            isModern
              ? "rounded-2xl border border-gray-800 hover:border-green-500/50 hover:shadow-xl hover:shadow-green-500/10"
              : "border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]"
          }`}
               onClick={() => setLocation('/formazioni')}>
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Users className="w-12 h-12 text-white" />
              </div>
              
              <div>
                <h2 className={`text-3xl font-bold uppercase mb-3 ${isModern ? 'font-sans' : 'font-display'}`}>
                  {t('home.formazioni')}
                </h2>
                <p className="text-muted-foreground text-lg">
                  {t('home.formazioniDesc')}
                </p>
                <div className="inline-block bg-green-500 text-white font-bold text-sm uppercase px-4 py-1 rounded-full mt-2">
                  {t('home.online')}
                </div>
              </div>

              <Button 
                variant="outline"
                className="w-full py-4 text-lg font-bold uppercase border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all bg-white hover:bg-pink-50"
                onClick={(e) => {
                  e.stopPropagation();
                  setLocation('/classifiche');
                }}
              >
                <Trophy className="mr-2 h-5 w-5" />
                {t('home.classifiche')}
              </Button>

              <Button 
                className="w-full py-6 text-xl font-bold uppercase bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600"
                onClick={(e) => {
                  e.stopPropagation();
                  setLocation('/formazioni');
                }}
              >
                {t('common.gioca', 'Gioca')}
              </Button>
            </div>
          </div>

          {/* Card Carriere */}
          <div className={`bg-card transition-all duration-300 p-8 cursor-pointer group ${
            isModern
              ? "rounded-2xl border border-gray-800 hover:border-cyan-500/50 hover:shadow-xl hover:shadow-cyan-500/10"
              : "border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]"
          }`}
               onClick={() => setLocation('/carriere')}>
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Trophy className="w-12 h-12 text-white" />
              </div>
              
              <div>
                <h2 className={`text-3xl font-bold uppercase mb-3 ${isModern ? 'font-sans' : 'font-display'}`}>
                  {t('home.carriere')}
                </h2>
                <p className="text-muted-foreground text-lg">
                  {t('home.carriereDesc')}
                </p>
                <div className="mt-3">
                  <span className="inline-block bg-green-500 text-white font-bold text-sm px-4 py-1 rounded-full uppercase">
                    {t('home.singlePlayer')}
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="font-bold text-base">
                  {t('home.recordMaratona')}: {maratonaRecord ? `${maratonaRecord.playerName} (${maratonaRecord.score} ${maratonaRecord.score === 1 ? t('home.giocatore', 'giocatore') : t('home.giocatori')})` : t('home.nessunRecord')}
                </p>
                <p>✓ Carriere complete con squadre</p>
                <p>✓ Sistema indizi progressivi</p>
              </div>

              <Button 
                className="w-full py-6 text-xl font-bold uppercase bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
                onClick={(e) => {
                  e.stopPropagation();
                  setLocation('/carriere');
                }}
              >
                {t('common.gioca', 'Gioca')}
              </Button>
            </div>
          </div>

          {/* Card Link */}
          <div className={`bg-card transition-all duration-300 p-8 cursor-pointer group ${
            isModern
              ? "rounded-2xl border border-gray-800 hover:border-purple-500/50 hover:shadow-xl hover:shadow-purple-500/10"
              : "border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]"
          }`}
               onClick={() => setLocation('/link')}>
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Link2 className="w-12 h-12 text-white" />
              </div>
              
              <div>
                <h2 className={`text-3xl font-bold uppercase mb-3 ${isModern ? 'font-sans' : 'font-display'}`}>
                  {t('home.link')}
                </h2>
                <p className="text-muted-foreground text-lg">
                  {t('home.linkDesc')}
                </p>
                <div className="mt-3">
                  <span className="inline-block bg-green-500 text-white font-bold text-sm px-4 py-1 rounded-full uppercase">
                    {t('home.classificheGlobali')}
                  </span>
                </div>
              </div>

              <div className="space-y-1 text-sm w-full text-left">
                <div className="font-bold text-sm text-foreground">{t('home.campioneEasy')}:</div>
                {linkLeadersEasy && linkLeadersEasy.length > 0 ? (
                  <div className="text-muted-foreground">
                    1. {linkLeadersEasy[0].playerName.split(' ')[0]} {Math.floor(linkLeadersEasy[0].timeSeconds / 60)}:{(linkLeadersEasy[0].timeSeconds % 60).toString().padStart(2, '0')}
                  </div>
                ) : (
                  <p className="text-muted-foreground">{t('home.nessunRecord')}</p>
                )}
                
                <div className="font-bold text-sm text-foreground mt-2">{t('home.campioneHard')}:</div>
                {linkLeadersHard && linkLeadersHard.length > 0 ? (
                  <div className="text-muted-foreground">
                    1. {linkLeadersHard[0].playerName.split(' ')[0]} {Math.floor(linkLeadersHard[0].timeSeconds / 60)}:{(linkLeadersHard[0].timeSeconds % 60).toString().padStart(2, '0')}
                  </div>
                ) : (
                  <p className="text-muted-foreground">{t('home.nessunRecord')}</p>
                )}
              </div>

              <Button 
                className="w-full py-6 text-xl font-bold uppercase bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600"
                onClick={(e) => {
                  e.stopPropagation();
                  setLocation('/link');
                }}
              >
                {t('common.gioca', 'Gioca')}
              </Button>
            </div>
          </div>

          {/* Card Progressione */}
          <div className={`bg-card transition-all duration-300 p-8 cursor-pointer group ${
            isModern
              ? "rounded-2xl border border-gray-800 hover:border-orange-500/50 hover:shadow-xl hover:shadow-orange-500/10"
              : "border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]"
          }`}
               onClick={() => setLocation('/progressione')}>
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                <TrendingUp className="w-12 h-12 text-white" />
              </div>
              
              <div>
                <h2 className={`text-3xl font-bold uppercase mb-3 ${isModern ? 'font-sans' : 'font-display'}`}>
                  {t('home.progressione')}
                </h2>
                <p className="text-muted-foreground text-lg">
                  {t('home.progressioneDesc')}
                </p>
                <div className="mt-3">
                  <span className="inline-block bg-green-500 text-white font-bold text-sm px-4 py-1 rounded-full uppercase">
                    {t('home.classificheGlobali')}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm w-full text-left">
                {/* Colonna Sinistra */}
                <div className="space-y-1">
                  <div className="font-bold text-xs text-foreground">{t('home.campioneAltezza')}:</div>
                  {progressioneHeight && progressioneHeight.length > 0 ? (
                    <div className="text-muted-foreground text-xs">
                      1. {progressioneHeight[0].playerName.split(' ')[0]} {Math.floor(progressioneHeight[0].timeSeconds / 60)}:{(progressioneHeight[0].timeSeconds % 60).toString().padStart(2, '0')}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-xs">{t('home.nessunRecord')}</p>
                  )}
                  
                  <div className="font-bold text-xs text-foreground mt-2">{t('home.campioneEta')}:</div>
                  {progressioneAge && progressioneAge.length > 0 ? (
                    <div className="text-muted-foreground text-xs">
                      1. {progressioneAge[0].playerName.split(' ')[0]} {Math.floor(progressioneAge[0].timeSeconds / 60)}:{(progressioneAge[0].timeSeconds % 60).toString().padStart(2, '0')}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-xs">{t('home.nessunRecord')}</p>
                  )}
                  
                  <div className="font-bold text-xs text-foreground mt-2">{t('home.campioneTrasferimenti')}:</div>
                  {progressioneTransfers && progressioneTransfers.length > 0 ? (
                    <div className="text-muted-foreground text-xs">
                      1. {progressioneTransfers[0].playerName.split(' ')[0]} {Math.floor(progressioneTransfers[0].timeSeconds / 60)}:{(progressioneTransfers[0].timeSeconds % 60).toString().padStart(2, '0')}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-xs">{t('home.nessunRecord')}</p>
                  )}
                </div>
                
                {/* Colonna Destra */}
                <div className="space-y-1">
                  <div className="font-bold text-xs text-foreground">{t('home.campioneGol')}:</div>
                  {progressioneGoals && progressioneGoals.length > 0 ? (
                    <div className="text-muted-foreground text-xs">
                      1. {progressioneGoals[0].playerName.split(' ')[0]} {Math.floor(progressioneGoals[0].timeSeconds / 60)}:{(progressioneGoals[0].timeSeconds % 60).toString().padStart(2, '0')}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-xs">{t('home.nessunRecord')}</p>
                  )}
                  
                  <div className="font-bold text-xs text-foreground mt-2">{t('home.campionePresenze')}:</div>
                  {progressioneAppearances && progressioneAppearances.length > 0 ? (
                    <div className="text-muted-foreground text-xs">
                      1. {progressioneAppearances[0].playerName.split(' ')[0]} {Math.floor(progressioneAppearances[0].timeSeconds / 60)}:{(progressioneAppearances[0].timeSeconds % 60).toString().padStart(2, '0')}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-xs">{t('home.nessunRecord')}</p>
                  )}
                </div>
              </div>

              <Button 
                className="w-full py-6 text-xl font-bold uppercase bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                onClick={(e) => {
                  e.stopPropagation();
                  setLocation('/progressione');
                }}
              >
                {t('common.gioca', 'Gioca')}
              </Button>
            </div>
          </div>

          {/* Card Aarons-Żurkowski */}
          <div className={`bg-card transition-all duration-300 p-8 cursor-pointer group ${
            isModern
              ? "rounded-2xl border border-gray-800 hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/10"
              : "border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]"
          }`}
               onClick={() => setLocation('/aarons-zurkowski')}>
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                <ArrowUpDown className="w-12 h-12 text-white" />
              </div>

              <div>
                <h2 className="text-3xl font-display font-bold uppercase mb-3">
                  {t('home.aaronsZurkowski', 'AARONS-ŻURKOWSKI')}
                </h2>
                <p className="text-muted-foreground text-lg">
                  {t('home.aaronsZurkowskiDesc', 'Indovina il cognome del calciatore misterioso restringendo il range alfabetico')}
                </p>
                <div className="mt-3">
                  <span className="inline-block bg-green-500 text-white font-bold text-sm px-4 py-1 rounded-full uppercase">
                    {t('home.multigiocatore', 'Multigiocatore')}
                  </span>
                </div>
              </div>

              <div className="space-y-1 text-sm text-muted-foreground w-full text-center">
                <p className="font-bold text-base"></p>
                <p className="text-xs">{t('home.aaronsZurkowskiInfo', '4.135 calciatori nel database')}</p>
              </div>

              <Button
                className="w-full py-6 text-xl font-bold uppercase bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
                onClick={(e) => {
                  e.stopPropagation();
                  setLocation('/aarons-zurkowski');
                }}
              >
                {t('common.gioca', 'Gioca')}
              </Button>
            </div>
          </div>

          {/* Card Dream Team */}
          <div className={`bg-card transition-all duration-300 p-8 cursor-pointer group ${
            isModern
              ? "rounded-2xl border border-gray-800 hover:border-yellow-500/50 hover:shadow-xl hover:shadow-yellow-500/10"
              : "border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]"
          }`}
               onClick={() => setLocation('/dream-team')}>
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-4xl">⭐</span>
              </div>

              <div className="space-y-3">
                <h2 className="font-display text-3xl font-black uppercase tracking-tight">
                  Dream Team
                </h2>
                <p className="text-muted-foreground text-lg">
                  Costruisci il tuo Dream Team scegliendo 1 campione per ogni grande squadra storica e domina il torneo!
                </p>
                <div className="mt-3">
                  <span className="inline-block text-white font-bold text-sm px-4 py-1 rounded-full uppercase" style={{backgroundColor: '#48db39'}}>
                    Anche Online
                  </span>
                </div>
              </div>

              <div className="space-y-1 text-sm text-muted-foreground w-full text-center">
                <p className="font-bold text-base">🎲 Estrai · Scegli · Simula</p>
                <p className="text-xs">150 squadre storiche · Overall nascosto · Torneo finale</p>
              </div>

              <Button
                className="w-full py-6 text-xl font-bold uppercase bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700"
                onClick={(e) => {
                  e.stopPropagation();
                  setLocation('/dream-team');
                }}
              >
                Gioca
              </Button>
            </div>
          </div>

          {/* Card Footster */}
          <div className={`bg-card transition-all duration-300 p-8 cursor-pointer group ${
            isModern
              ? "rounded-2xl border border-gray-800 hover:border-green-600/50 hover:shadow-xl hover:shadow-green-600/10"
              : "border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]"
          }`}
               onClick={() => setLocation('/footster')}>
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-700 to-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-4xl">⚽</span>
              </div>

              <div className="space-y-3">
                <h2 className="font-display text-3xl font-black uppercase tracking-tight">
                  FOOTSTER
                </h2>
                <p className="text-muted-foreground text-lg">
                  Posiziona i calciatori in ordine cronologico di nascita. Ruba le carte agli avversari!
                </p>
                <div className="mt-3">
                  <span className="inline-block text-white font-bold text-sm px-4 py-1 rounded-full uppercase" style={{backgroundColor: '#48db39'}}>
                    Board Game
                  </span>
                </div>
              </div>

              <div className="space-y-1 text-sm text-muted-foreground w-full text-center">
                <p className="font-bold text-base">🃏 Timeline</p>
                <p className="text-xs">1-10 giocatori · 7 cartellini per vincere</p>
              </div>

              <Button
                className="w-full py-6 text-xl font-bold uppercase bg-gradient-to-r from-green-700 to-emerald-600 hover:from-green-800 hover:to-emerald-700"
                onClick={(e) => {
                  e.stopPropagation();
                  setLocation('/footster');
                }}
              >
                Gioca
              </Button>
            </div>
          </div>
        </div>

        {/* Pulsante Supporta il Progetto con Dropdown */}
        <div className="flex justify-center mt-12" ref={donationRef}>
          <div className="relative">
            <Button 
              size="lg"
              onClick={() => setShowDonationDropdown(prev => !prev)}
              className={`py-6 px-12 text-xl font-bold uppercase bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 transition-all flex items-center gap-2 ${
                isModern
                  ? 'rounded-xl border border-green-500/50 shadow-lg shadow-green-500/20 font-sans'
                  : 'font-display border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]'
              }`}
            >
              ❤️ {t('home.donazione', 'Supporta il Progetto')}
              <ChevronDown className={`w-5 h-5 transition-transform ${showDonationDropdown ? 'rotate-180' : ''}`} />
            </Button>

            {showDonationDropdown && (
              <div className={`absolute top-full left-0 right-0 mt-2 z-50 overflow-hidden ${
                isModern
                  ? 'bg-gray-900 border border-gray-700 rounded-xl shadow-xl'
                  : 'bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none'
              }`}>
                <a
                  href="https://www.paypal.com/pool/9lCKCiF8hN?sr=ancr"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowDonationDropdown(false)}
                  className="flex items-center gap-3 px-6 py-4 hover:bg-blue-50 transition-colors border-b-2 border-black"
                >
                  <span className="text-2xl">🅿️</span>
                  <div className="text-left">
                    <div className="font-bold text-black uppercase text-sm">PayPal</div>
                    <div className="text-xs text-gray-600">{t('home.donaPaypal')}</div>
                  </div>
                </a>
                <a
                  href="https://buy.stripe.com/eVqeVfddDa3O7yD8MXeME00"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowDonationDropdown(false)}
                  className="flex items-center gap-3 px-6 py-4 hover:bg-purple-50 transition-colors"
                >
                  <span className="text-2xl">💳</span>
                  <div className="text-left">
                    <div className="font-bold text-black uppercase text-sm">Carta / Stripe</div>
                    <div className="text-xs text-gray-600">{t('home.donaStripe')}</div>
                  </div>
                </a>
              </div>
            )}
          </div>
        </div>
        
        {/* Pulsante Scarica App */}
        <InstallAppButton />

        {/* Donation Progress */}
        <DonationProgress />

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-muted-foreground">
          <p>{t('home.footer')}</p>
        </div>
      </div>
    </div>
    <Footer />
    </>
  );
}
