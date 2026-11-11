import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NavigationBar } from "@/components/NavigationBar";
import { FeedbackModal } from "@/components/FeedbackModal";

export default function Matchmaking() {
  const [, setLocation] = useLocation();
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [queueId, setQueueId] = useState<number | null>(null);
  const [searchTime, setSearchTime] = useState(0);

  const cancelMatchmakingMutation = trpc.challenges.cancelMatchmaking.useMutation();

  // Estrai queueId da URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("queueId");
    if (id) {
      setQueueId(Number(id));
    } else {
      // Nessun queueId, redirect a homepage
      setLocation("/");
    }
  }, [setLocation]);

  // Polling matchmaking ogni 2 secondi
  const { data: matchResult } = trpc.challenges.checkMatchmaking.useQuery(
    { queueId: queueId! },
    {
      enabled: !!queueId,
      refetchInterval: 2000, // Poll ogni 2 secondi
    }
  );

  // Timer ricerca
  useEffect(() => {
    const interval = setInterval(() => {
      setSearchTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Redirect quando trova match
  useEffect(() => {
    if (matchResult?.matched && matchResult.challengeId) {
      setLocation(`/sfida/${matchResult.challengeId}`);
    }
  }, [matchResult, setLocation]);

  const handleCancel = async () => {
    if (!queueId) return;
    
    try {
      await cancelMatchmakingMutation.mutateAsync({ queueId });
      setLocation("/formazioni");
    } catch (error) {
      console.error("Errore cancellazione matchmaking:", error);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <NavigationBar onFeedbackClick={() => setIsFeedbackOpen(true)} />
      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
      
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4 pt-24">
        <div className="max-w-md w-full bg-card border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8">
          <div className="text-center space-y-6">
            {/* Icona loading animata */}
            <div className="flex justify-center">
              <Loader2 className="h-16 w-16 animate-spin text-primary" />
            </div>

            {/* Titolo */}
            <h1 className="text-2xl font-display font-bold uppercase text-primary">
              Ricerca Avversario...
            </h1>

            {/* Tempo di ricerca */}
            <div className="text-4xl font-mono font-bold text-foreground">
              {formatTime(searchTime)}
            </div>

            {/* Messaggio */}
            <p className="text-sm text-muted-foreground">
              Stiamo cercando un avversario con lo stesso tempo selezionato. 
              Questo potrebbe richiedere alcuni secondi.
            </p>

            {/* Pulsante annulla */}
            <Button
              onClick={handleCancel}
              variant="outline"
              className="w-full h-12 font-bold bg-background hover:bg-gray-50 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:shadow-none transition-all"
              disabled={cancelMatchmakingMutation.isPending}
            >
              <X className="mr-2 h-5 w-5" />
              {cancelMatchmakingMutation.isPending ? "Annullamento..." : "Annulla Ricerca"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
