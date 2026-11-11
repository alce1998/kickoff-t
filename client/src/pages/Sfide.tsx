import { useState } from "react";
import { NavigationBar } from "@/components/NavigationBar";
import { FeedbackModal } from "@/components/FeedbackModal";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Play, Trophy, Clock, Heart, Target } from "lucide-react";
import { useLocation } from "wouter";

function Sfide() {
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { t } = useTranslation();

  const { data: pendingChallenges, refetch: refetchPending } = trpc.challenges.getPendingChallenges.useQuery();
  const { data: myChallenges, refetch: refetchMy } = trpc.challenges.getMyChallenges.useQuery();
  
  const acceptChallengeMutation = trpc.challenges.acceptChallenge.useMutation();
  const rejectChallengeMutation = trpc.challenges.rejectChallenge.useMutation();
  const deleteChallengeMutation = trpc.challenges.deleteChallenge.useMutation();

  const handleDelete = async (challengeId: number) => {
    if (!confirm(t('sfide.confermaElimina'))) {
      return;
    }
    try {
      await deleteChallengeMutation.mutateAsync({ challengeId });
      refetchPending();
      refetchMy();
      alert(t('sfide.sfidaEliminata'));
    } catch (error: any) {
      alert(error.message || "Errore durante l'eliminazione della sfida");
    }
  };

  const handleAccept = async (challengeId: number) => {
    try {
      await acceptChallengeMutation.mutateAsync({ challengeId });
      refetchPending();
      refetchMy();
      alert(t('sfide.sfidaAccettata'));
    } catch (error: any) {
      alert(error.message || "Errore durante l'accettazione della sfida");
    }
  };

  const handleReject = async (challengeId: number) => {
    try {
      await rejectChallengeMutation.mutateAsync({ challengeId });
      refetchPending();
      alert(t('sfide.sfidaRifiutata'));
    } catch (error: any) {
      alert(error.message || "Errore durante il rifiuto della sfida");
    }
  };

  const handlePlayChallenge = (challengeId: number) => {
    setLocation(`/sfida/${challengeId}`);
  };

  if (!user) {
    return (
      <>
        <NavigationBar onFeedbackClick={() => setIsFeedbackOpen(true)} />
        <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
        <div className="min-h-screen bg-background text-foreground p-4 md:p-8 font-mono pt-24">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl font-bold mb-4">{t('sfide.accessoRichiesto')}</h1>
            <p className="text-muted-foreground">{t('sfide.loginRichiesto')}</p>
          </div>
        </div>
      </>
    );
  }

  const activeChallenges = myChallenges?.filter(c => c.status === 'active') || [];
  const completedChallenges = myChallenges?.filter(c => c.status === 'completed') || [];

  return (
    <>
      <NavigationBar onFeedbackClick={() => setIsFeedbackOpen(true)} />
      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
      <div className="min-h-screen bg-background text-foreground p-4 md:p-8 font-mono pt-20">
        <div className="max-w-6xl mx-auto">
          <header className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-display font-bold uppercase tracking-tighter text-primary mb-2">
              {t('sfide.titolo')}
            </h1>
            <p className="text-muted-foreground font-bold uppercase tracking-widest text-sm mb-4">
              {t('sfide.sottotitolo')}
            </p>
            <Button
              onClick={() => setLocation('/formazioni?tab=online')}
              className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-bold uppercase px-8 py-4 text-base shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all"
            >
              + {t('sfide.nuovaPartita')}
            </Button>
          </header>

          {/* Sfide in attesa di accettazione */}
          {pendingChallenges && pendingChallenges.length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-bold uppercase mb-4 flex items-center gap-2">
                <Clock className="h-6 w-6 text-red-600" />
                {t('sfide.sfideInAttesa')} ({pendingChallenges.length})
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {pendingChallenges.map((challenge: any) => (
                  <div
                    key={challenge.id}
                    className="bg-card border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-lg">
                        {t('sfide.sfidaDa')} {challenge.challenger?.username ? `@${challenge.challenger.username}` : challenge.challenger?.name}
                      </h3>
                      <span className="bg-red-100 text-red-800 text-xs font-bold px-2 py-1 rounded uppercase">
                        {t('sfide.nuova')}
                      </span>
                    </div>
                    <div className="space-y-2 text-sm mb-4">
                      <p><strong>{t('sfide.campionato')}:</strong> {challenge.competition}</p>
                      <p><strong>{t('sfide.periodo')}:</strong> {challenge.period}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('sfide.ricevutaIl')} {new Date(challenge.createdAt).toLocaleDateString('it-IT')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleAccept(challenge.id)}
                        disabled={acceptChallengeMutation.isPending}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold"
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        {t('amici.accetta')}
                      </Button>
                      <Button
                        onClick={() => handleReject(challenge.id)}
                        disabled={rejectChallengeMutation.isPending}
                        variant="outline"
                        className="flex-1 border-2 border-black hover:bg-red-50 font-bold"
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        {t('amici.rifiuta')}
                      </Button>
                      <Button
                        onClick={() => handleDelete(challenge.id)}
                        disabled={deleteChallengeMutation.isPending}
                        variant="outline"
                        className="border-2 border-red-500 hover:bg-red-100 text-red-700 font-bold"
                        title="Elimina sfida"
                      >
                        🗑️
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sfide attive */}
          {activeChallenges.length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-bold uppercase mb-4 flex items-center gap-2">
                <Play className="h-6 w-6 text-blue-600" />
                {t('sfide.sfideAttive')} ({activeChallenges.length})
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {activeChallenges.map((challenge: any) => (
                  <div
                    key={challenge.id}
                    className="bg-card border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg">
                          vs {challenge.opponent?.username ? `@${challenge.opponent.username}` : challenge.opponent?.name}
                        </h3>
                        <span className="px-2 py-0.5 bg-yellow-400 text-yellow-900 rounded-full text-xs font-bold">
                          ⭐ {challenge.opponent?.eloRating || 1200}
                        </span>
                      </div>
                        {challenge.isMyTurn && (
                        <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded uppercase animate-pulse">
                          {t('sfide.tuoTurno')}
                        </span>
                      )}
                    </div>
                    <div className="space-y-2 text-sm mb-4">
                      <p><strong>{t('sfide.campionato')}:</strong> {challenge.competition}</p>
                      <p><strong>{t('sfide.periodo')}:</strong> {challenge.period}</p>
                      <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t-2 border-black">
                        <div>
                          <p className="text-xs text-muted-foreground">{t('sfide.tu')}</p>
                          <p className="font-bold">
                            <Heart className="inline h-3 w-3 text-red-500" /> {challenge.challengerId === user.id ? challenge.challengerLives : challenge.opponentLives}
                            <span className="mx-2">•</span>
                            <Target className="inline h-3 w-3 text-blue-500" /> {challenge.challengerId === user.id ? challenge.challengerScore : challenge.opponentScore}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{challenge.opponent?.username ? `@${challenge.opponent.username}` : challenge.opponent?.name}</p>
                          <p className="font-bold">
                            <Heart className="inline h-3 w-3 text-red-500" /> {challenge.challengerId === user.id ? challenge.opponentLives : challenge.challengerLives}
                            <span className="mx-2">•</span>
                            <Target className="inline h-3 w-3 text-blue-500" /> {challenge.challengerId === user.id ? challenge.opponentScore : challenge.challengerScore}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handlePlayChallenge(challenge.id)}
                        className="flex-1 bg-black text-white hover:bg-gray-800 font-bold"
                      >
                        <Play className="mr-2 h-4 w-4" />
                        {challenge.isMyTurn ? t('sfide.giocaOra') : t('sfide.visualizza')}
                      </Button>
                      <Button
                        onClick={() => handleDelete(challenge.id)}
                        disabled={deleteChallengeMutation.isPending}
                        variant="outline"
                        className="border-2 border-red-500 hover:bg-red-100 text-red-700 font-bold"
                        title="Elimina sfida"
                      >
                        🗑️
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sfide completate */}
          {completedChallenges.length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-bold uppercase mb-4 flex items-center gap-2">
                <Trophy className="h-6 w-6 text-yellow-600" />
                {t('sfide.sfideCompletate')} ({completedChallenges.length})
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {completedChallenges.map((challenge: any) => {
                  const myScore = challenge.challengerId === user.id ? challenge.challengerScore : challenge.opponentScore;
                  const opponentScore = challenge.challengerId === user.id ? challenge.opponentScore : challenge.challengerScore;
                  const iWon = challenge.winnerId === user.id;
                  const isDraw = challenge.winnerId === null;

                  return (
                    <div
                      key={challenge.id}
                      className="bg-card border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-lg">
                            vs {challenge.opponent?.username ? `@${challenge.opponent.username}` : challenge.opponent?.name}
                          </h3>
                          <span className="px-2 py-0.5 bg-yellow-400 text-yellow-900 rounded-full text-xs font-bold">
                            ⭐ {challenge.opponent?.eloRating || 1200}
                          </span>
                        </div>
                        {iWon ? (
                          <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded uppercase">
                            {t('sfide.vittoria')}
                          </span>
                        ) : isDraw ? (
                          <span className="bg-gray-100 text-gray-800 text-xs font-bold px-2 py-1 rounded uppercase">
                            {t('sfide.pareggio')}
                          </span>
                        ) : (
                          <span className="bg-red-100 text-red-800 text-xs font-bold px-2 py-1 rounded uppercase">
                            {t('sfide.sconfitta')}
                          </span>
                        )}
                      </div>
                      <div className="space-y-2 text-sm mb-4">
                        <p><strong>{t('sfide.campionato')}:</strong> {challenge.competition}</p>
                        <p><strong>{t('sfide.risultato')}:</strong> {myScore} - {opponentScore}</p>
                        <p className="text-xs text-muted-foreground">
                          {t('sfide.completataIl')} {new Date(challenge.updatedAt || challenge.createdAt).toLocaleDateString('it-IT')}
                        </p>
                      </div>
                      <Button
                        onClick={() => handleDelete(challenge.id)}
                        disabled={deleteChallengeMutation.isPending}
                        variant="outline"
                        className="w-full border-2 border-red-500 hover:bg-red-100 text-red-700 font-bold"
                      >
                        🗑️ {t('sfide.eliminaSfida')}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Nessuna sfida */}
          {(!pendingChallenges || pendingChallenges.length === 0) &&
           activeChallenges.length === 0 &&
           completedChallenges.length === 0 && (
            <div className="text-center py-12">
              <Trophy className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-bold mb-2">{t('sfide.nessunaSfida')}</h3>
              <p className="text-muted-foreground mb-6">
                {t('sfide.nessunaSfidaDesc')}
              </p>
              <Button
                onClick={() => setLocation("/formazioni")}
                className="bg-black text-white hover:bg-gray-800 font-bold"
              >
                {t('sfide.creaSfida')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default Sfide;
