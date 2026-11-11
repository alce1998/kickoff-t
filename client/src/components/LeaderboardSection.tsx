import { trpc } from '@/lib/trpc';

interface LeaderboardSectionProps {
  gameType: 'link' | 'progressione';
  competition: string;
  difficulty?: string;
}

export function LeaderboardSection({ gameType, competition, difficulty }: LeaderboardSectionProps) {
  const { data: scores, isLoading } = trpc.leaderboard.getTopScores.useQuery({
    gameType,
    competition,
    difficulty,
  });

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="bg-card border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-4">
        <p className="text-center text-muted-foreground">Caricamento classifica...</p>
      </div>
    );
  }

  if (!scores || scores.length === 0) {
    return (
      <div className="bg-card border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-4">
        <p className="text-center text-muted-foreground">Nessun punteggio ancora. Sii il primo!</p>
      </div>
    );
  }

  return (
    <div className="bg-card border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-4">
      <div className="space-y-2">
        {scores.map((score, index) => (
          <div
            key={score.id}
            className="flex items-center justify-between p-3 bg-background border-2 border-black"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl font-display font-bold text-primary">
                #{index + 1}
              </span>
              <span className="font-mono font-bold">{score.playerName}</span>
            </div>
            <span className="text-xl font-display font-bold text-accent-foreground">
              {formatTime(score.timeSeconds)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
