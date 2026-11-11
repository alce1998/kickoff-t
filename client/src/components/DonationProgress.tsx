import { trpc } from "@/lib/trpc";

export function DonationProgress() {
  const { data, isLoading } = trpc.donations.getProgress.useQuery(undefined, {
    refetchInterval: 30 * 60 * 1000, // Refresh every 30 minutes
    staleTime: 30 * 60 * 1000,
  });

  if (isLoading || !data) {
    return null;
  }

  const { raised, goal, currency, percentage } = data;

  // Don't show if no data
  if (raised === 0 && goal === 1000) {
    return null;
  }

  return (
    <div className="w-full max-w-md mx-auto mt-4">
      {/* Progress Bar */}
      <div className="bg-card border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4">
        {/* Amount Text */}
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-mono font-bold text-foreground">
            Raccolti: {currency} {raised.toFixed(2)}
          </span>
          <span className="text-sm font-mono font-bold text-muted-foreground">
            Obiettivo: {currency} {goal.toFixed(2)}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="relative w-full h-8 bg-muted border-2 border-black overflow-hidden">
          <div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-green-500 to-emerald-600 transition-all duration-1000 ease-out"
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-display font-bold text-black mix-blend-difference">
              {percentage}%
            </span>
          </div>
        </div>

        {/* Thank You Message */}
        {percentage >= 100 && (
          <div className="mt-2 text-center text-sm font-bold text-green-600">
            🎉 Obiettivo raggiunto! Grazie a tutti! 🎉
          </div>
        )}
      </div>
    </div>
  );
}
