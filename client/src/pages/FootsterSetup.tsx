import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function FootsterSetup() {
  const [, setLocation] = useLocation();
  const [numPlayers, setNumPlayers] = useState(2);
  const [playerNames, setPlayerNames] = useState<string[]>(
    Array.from({ length: 10 }, (_, i) => `Giocatore ${i + 1}`)
  );
  const [howToOpen, setHowToOpen] = useState(false);

  const handleNumChange = (n: number) => setNumPlayers(n);

  const handleNameChange = (idx: number, val: string) => {
    const updated = [...playerNames];
    updated[idx] = val;
    setPlayerNames(updated);
  };

  const handleStart = () => {
    const names = playerNames.slice(0, numPlayers).map((n, i) =>
      n.trim() || `Giocatore ${i + 1}`
    );
    const params = new URLSearchParams({ players: JSON.stringify(names) });
    setLocation(`/footster/game?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="bg-card border-b-4 border-black px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => setLocation("/")}
          className="font-bold text-sm hover:underline"
        >
          ← Home
        </button>
        <h1 className="font-display text-3xl font-black uppercase tracking-tight flex-1 text-center">
          ⚽ FOOTSTER
        </h1>
        <div className="w-16" />
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* Descrizione */}
        <div className="bg-card border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6 text-center">
          <p className="text-muted-foreground text-base leading-relaxed">
            Posiziona i calciatori in ordine cronologico di nascita nella tua timeline.
            Ruba le carte agli avversari con i <strong>Gettoni Furto</strong>!
          </p>
          <p className="mt-2 font-bold text-sm">
            🏆 Vince il primo a collezionare <span className="text-pink-600">7 cartellini</span>
          </p>
        </div>

        {/* Come si gioca (collapsible) */}
        <div className="bg-card border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <button
            onClick={() => setHowToOpen((v) => !v)}
            className="w-full px-6 py-4 flex items-center justify-between font-display font-black uppercase tracking-tight text-lg"
          >
            <span>Come si gioca</span>
            <span className="text-2xl">{howToOpen ? "▲" : "▼"}</span>
          </button>
          {howToOpen && (
            <div className="px-6 pb-5 border-t-4 border-black space-y-3 text-sm leading-relaxed">
              <p>🃏 Ogni turno viene mostrata la <strong>foto</strong> di un calciatore (nome e anno nascosti).</p>
              <p>📍 Scegli uno slot nella tua timeline: prima, dopo o tra i calciatori già presenti.</p>
              <p>⭐ Dopo il posizionamento, puoi tentare di indovinare il <strong>nome</strong> per guadagnare un Gettone Furto.</p>
              <p>🔥 Gli avversari con almeno 1 gettone possono <strong>contestare</strong> il tuo posizionamento scegliendo uno slot diverso sulla <em>tua</em> timeline. Se indovinano, rubano il cartellino. Se sbagliano, perdono il gettone.</p>
              <p>✅ Solo dopo le contestazioni vengono rivelati nome e anno di nascita del calciatore.</p>
              <p>🏆 Vince il primo giocatore a raggiungere <strong>7 cartellini</strong>.</p>
              <p className="text-muted-foreground text-xs">Ogni giocatore inizia con 2 Gettoni Furto e 1 calciatore già rivelato come punto di partenza.</p>
            </div>
          )}
        </div>

        {/* Configurazione */}
        <div className="bg-card border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
          <h2 className="font-display text-xl font-black uppercase tracking-tight mb-5 text-center">
            Configura la partita
          </h2>

          {/* Numero giocatori */}
          <div className="mb-6">
            <p className="text-sm font-bold uppercase tracking-wider mb-3">
              Numero di giocatori
            </p>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => handleNumChange(n)}
                  className={`w-10 h-10 border-2 border-black font-black text-sm transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                    numPlayers === n
                      ? "bg-pink-500 text-white"
                      : "bg-white text-black hover:bg-gray-100"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Nomi giocatori */}
          <div className="mb-6">
            <p className="text-sm font-bold uppercase tracking-wider mb-3">
              Nomi giocatori
            </p>
            <div className="space-y-2">
              {Array.from({ length: numPlayers }, (_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="font-black w-6 text-center text-sm border-2 border-black bg-black text-white h-6 flex items-center justify-center">
                    {i + 1}
                  </span>
                  <Input
                    value={playerNames[i]}
                    onChange={(e) => handleNameChange(i, e.target.value)}
                    className="border-2 border-black rounded-none focus:ring-0 focus:border-black"
                    placeholder={`Giocatore ${i + 1}`}
                    maxLength={20}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Pulsante Start */}
          <Button
            onClick={handleStart}
            className="w-full bg-black hover:bg-gray-900 text-white font-black text-lg py-6 rounded-none border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase tracking-wide"
          >
            INIZIA PARTITA
          </Button>
        </div>
      </div>
    </div>
  );
}
