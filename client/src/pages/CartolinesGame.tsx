import React, { useState, useEffect } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import { NavigationBar } from "@/components/NavigationBar";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ChevronLeft, Star, Check, X, Trophy, Lock } from "lucide-react";
import { useRef } from "react";

interface Stadio {
  id: string;
  nome: string;
  capienza: string;
  anno: string;
  campionato: string;
  squadre: string[];
  foto: string;
}

interface ProgressoStadio {
  stadiumId: string;
  solved: number;
  hintsUsed: string | null;
}

// Normalizza stringa per confronto (rimuove accenti, lowercase, trim)
function normalizeStr(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

export default function CartolinesGame() {
  const params = useParams<{ id: string }>();
  const stadiumId = params.id;
  const [, setLocation] = useLocation();
  const search = useSearch();
  // Legge il campionato di provenienza per tornare alla tab corretta
  const fromCampionato = new URLSearchParams(search).get("from") ?? "";
  const backUrl = fromCampionato
    ? `/cartoline?campionato=${encodeURIComponent(fromCampionato)}`
    : "/cartoline";
  const { user } = useAuth();
  const { t } = useTranslation();

  const [stadi, setStadi] = useState<Stadio[]>([]);
  const [stadio, setStadio] = useState<Stadio | null>(null);
  const [loadingStadi, setLoadingStadi] = useState(true);
  const [guess, setGuess] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [attempts, setAttempts] = useState<{ value: string; correct: boolean }[]>([]);
  const [isSolved, setIsSolved] = useState(false);
  const [revealedHints, setRevealedHints] = useState<string[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [allSquadre, setAllSquadre] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Carica dati stadi
  useEffect(() => {
    fetch("/data/stadi_cartoline.65c9338a.json")
      .then((r) => r.json())
      .then((data: Stadio[]) => {
        setStadi(data);
        const found = data.find((s: Stadio) => s.id === stadiumId);
        setStadio(found ?? null);
        setLoadingStadi(false);
        // Estrai tutte le squadre uniche dal database, ordinate alfabeticamente
        const squadreSet = new Set<string>();
        data.forEach((s) => s.squadre.forEach((sq) => squadreSet.add(sq)));
        setAllSquadre(Array.from(squadreSet).sort((a, b) => a.localeCompare(b)));
      })
      .catch(() => {
        toast.error("Errore nel caricamento degli stadi");
        setLoadingStadi(false);
      });
  }, [stadiumId]);

  // Carica progressi utente
  const { data: progressData, refetch: refetchProgress } =
    trpc.cartoline.getProgress.useQuery(undefined, { enabled: !!user });

  // Aggiorna stato locale in base ai progressi
  useEffect(() => {
    if (!progressData || !stadiumId) return;
    const prog = progressData.progress.find(
      (p: ProgressoStadio) => p.stadiumId === stadiumId
    );
    if (prog?.solved === 1) {
      setIsSolved(true);
      setShowSuccess(true);
    }
    if (prog?.hintsUsed) {
      try {
        setRevealedHints(JSON.parse(prog.hintsUsed));
      } catch {
        setRevealedHints([]);
      }
    }
  }, [progressData, stadiumId]);

  // Mutations
  const solveStadiumMutation = trpc.cartoline.solveStadium.useMutation({
    onSuccess: (data) => {
      if (!data.alreadySolved) {
        toast.success(
          `🏆 ${t("cartoline.stadiSbloccato", "Stadio sbloccato!")} +1 ${t("cartoline.puntoIndizio", "punto indizio")}`,
          { duration: 4000 }
        );
      }
      refetchProgress();
    },
    onError: () => {
      toast.error(t("cartoline.errore", "Errore nel salvataggio"));
    },
  });

  const useHintMutation = trpc.cartoline.useHint.useMutation({
    onSuccess: (data) => {
      toast.success(
        `${t("cartoline.indiziUsato", "Indizio svelato!")} (${t("cartoline.puntiRimasti", "Punti rimasti")}: ${data.newPoints})`,
        { duration: 3000 }
      );
      refetchProgress();
    },
    onError: (err) => {
      if (err.message.includes("INSUFFICIENT_POINTS")) {
        toast.error(t("cartoline.puntiInsufficienti", "Punti indizio insufficienti!"));
      } else {
        toast.error(t("cartoline.errore", "Errore nel salvataggio"));
      }
    },
  });

  const handleGuess = () => {
    if (!guess.trim() || !stadio) return;
    const normalizedGuess = normalizeStr(guess.trim());

    // Controlla se la risposta è corretta (una delle squadre dello stadio)
    const isCorrect = stadio.squadre.some(
      (sq) => normalizeStr(sq) === normalizedGuess
    );

    const newAttempt = { value: guess.trim(), correct: isCorrect };
    setAttempts((prev) => [newAttempt, ...prev]);
    setGuess("");
    setShowDropdown(false);

    if (isCorrect) {
      setIsSolved(true);
      setShowSuccess(true);
      if (user) {
        solveStadiumMutation.mutate({ stadiumId: stadio.id });
      }
    } else {
      toast.error(t("cartoline.rispostaErrata", "Risposta errata, riprova!"), {
        duration: 2000,
      });
    }
  };

  const handleUseHint = (hintType: "nome" | "capienza" | "anno") => {
    if (!user) {
      toast.error(t("cartoline.loginRichiesto", "Accedi per usare gli indizi"));
      return;
    }
    if (!stadio) return;
    if (revealedHints.includes(hintType)) return;

    const cost = hintType === "nome" ? 3 : 1;
    const currentPoints = progressData?.points ?? 0;
    if (currentPoints < cost) {
      toast.error(
        `${t("cartoline.puntiInsufficienti", "Punti insufficienti")} (${t("cartoline.necessari", "necessari")}: ${cost})`
      );
      return;
    }

    setRevealedHints((prev) => [...prev, hintType]);
    useHintMutation.mutate({ stadiumId: stadio.id, hintType });
  };

  if (loadingStadi) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-xl font-bold animate-pulse">
          {t("common.caricamento", "Caricamento...")}
        </div>
      </div>
    );
  }

  if (!stadio) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-xl font-bold">
          {t("cartoline.stadioNonTrovato", "Stadio non trovato")}
        </p>
        <Button onClick={() => setLocation(backUrl)}>
          {t("cartoline.tornaAlbum", "Torna all'Album")}
        </Button>
      </div>
    );
  }

  const currentPoints = progressData?.points ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <NavigationBar onFeedbackClick={() => {}} />

      <div className="container max-w-3xl pt-20 pb-12 px-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="outline"
            onClick={() => setLocation(backUrl)}
            className="border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            {t("cartoline.album", "Album")}
          </Button>

          <div className="flex-1">
            <h1 className="text-2xl font-display font-bold uppercase tracking-tighter text-primary">
              {isSolved ? stadio.nome : "???"}
            </h1>
            <p className="text-muted-foreground text-sm font-bold uppercase">
              {stadio.campionato}
            </p>
          </div>

          {/* Punti indizio */}
          {user && (
            <div className="flex items-center gap-1 bg-amber-100 border-2 border-black px-3 py-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span className="font-bold">{currentPoints}</span>
            </div>
          )}
        </div>

        {/* Foto stadio */}
        <div className="relative border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden mb-6">
          <img
            src={stadio.foto}
            alt={isSolved ? stadio.nome : "???"}
            className={`w-full aspect-video object-cover transition-all duration-700 ${
              isSolved ? "" : "grayscale brightness-75"
            }`}
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                "https://via.placeholder.com/800x450?text=Stadio";
            }}
          />
          {!isSolved && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white font-black text-5xl drop-shadow-lg">???</span>
            </div>
          )}
          {isSolved && (
            <div className="absolute top-3 right-3 bg-green-500 text-white px-3 py-1 font-bold uppercase text-sm border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1">
              <Trophy className="w-4 h-4" />
              {t("cartoline.sbloccato", "Sbloccato!")}
            </div>
          )}
        </div>

        {/* Schermata successo */}
        {showSuccess && (
          <div className="mb-6 bg-green-50 border-4 border-green-500 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6">
            <h2 className="text-2xl font-display font-bold uppercase text-green-700 mb-4 flex items-center gap-2">
              <Trophy className="w-6 h-6" />
              {t("cartoline.bravo", "Bravo! Stadio indovinato!")}
            </h2>

            {/* Info stadio sbloccate */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-white border-2 border-black p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <div className="text-xs font-bold uppercase text-muted-foreground mb-1">
                  {t("cartoline.nomeStadio", "Nome Stadio")}
                </div>
                <div className="font-bold text-lg">{stadio.nome}</div>
              </div>
              <div className="bg-white border-2 border-black p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <div className="text-xs font-bold uppercase text-muted-foreground mb-1">
                  {t("cartoline.capienza", "Capienza")}
                </div>
                <div className="font-bold text-lg">{stadio.capienza}</div>
              </div>
              <div className="bg-white border-2 border-black p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <div className="text-xs font-bold uppercase text-muted-foreground mb-1">
                  {t("cartoline.annoCostruzione", "Anno di costruzione")}
                </div>
                <div className="font-bold text-lg">{stadio.anno}</div>
              </div>
              <div className="bg-white border-2 border-black p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <div className="text-xs font-bold uppercase text-muted-foreground mb-1">
                  {t("cartoline.squadre", "Squadre")}
                </div>
                <div className="font-bold">{stadio.squadre[0]}</div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => setLocation("/cartoline")}
                className="flex-1 bg-black text-white font-bold uppercase border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all"
              >
                {t("cartoline.tornaAlbum", "Torna all'Album")}
              </Button>
            </div>
          </div>
        )}

        {/* Sezione gioco (se non ancora risolto) */}
        {!isSolved && (
          <>
            {/* Indizi acquistabili */}
            <div className="mb-6 bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-5">
              <h3 className="font-display font-bold uppercase text-lg mb-3 flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                {t("cartoline.indizi", "Indizi")}
                {!user && (
                  <span className="ml-auto flex items-center gap-1 text-sm text-muted-foreground font-normal">
                    <Lock className="w-4 h-4" />
                    {t("cartoline.loginPerIndizi", "Accedi per usare gli indizi")}
                  </span>
                )}
              </h3>

              <div className="grid grid-cols-3 gap-3">
                {/* Indizio Nome */}
                <div
                  className={`border-2 border-black p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                    revealedHints.includes("nome") ? "bg-amber-50" : "bg-white"
                  }`}
                >
                  <div className="text-xs font-bold uppercase text-muted-foreground mb-1">
                    {t("cartoline.nomeStadio", "Nome Stadio")}
                  </div>
                  {revealedHints.includes("nome") ? (
                    <div className="font-bold text-sm">{stadio.nome}</div>
                  ) : (
                    <div className="font-bold text-sm text-muted-foreground">???</div>
                  )}
                  {!revealedHints.includes("nome") && (
                    <Button
                      size="sm"
                      onClick={() => handleUseHint("nome")}
                      disabled={!user || useHintMutation.isPending}
                      className="mt-2 w-full bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50"
                    >
                      <Star className="w-3 h-3 mr-1 fill-white" />
                      3 {t("cartoline.punti", "pt")}
                    </Button>
                  )}
                </div>

                {/* Indizio Capienza */}
                <div
                  className={`border-2 border-black p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                    revealedHints.includes("capienza") ? "bg-amber-50" : "bg-white"
                  }`}
                >
                  <div className="text-xs font-bold uppercase text-muted-foreground mb-1">
                    {t("cartoline.capienza", "Capienza")}
                  </div>
                  {revealedHints.includes("capienza") ? (
                    <div className="font-bold text-sm">{stadio.capienza}</div>
                  ) : (
                    <div className="font-bold text-sm text-muted-foreground">???</div>
                  )}
                  {!revealedHints.includes("capienza") && (
                    <Button
                      size="sm"
                      onClick={() => handleUseHint("capienza")}
                      disabled={!user || useHintMutation.isPending}
                      className="mt-2 w-full bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50"
                    >
                      <Star className="w-3 h-3 mr-1 fill-white" />
                      1 {t("cartoline.punti", "pt")}
                    </Button>
                  )}
                </div>

                {/* Indizio Anno */}
                <div
                  className={`border-2 border-black p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                    revealedHints.includes("anno") ? "bg-amber-50" : "bg-white"
                  }`}
                >
                  <div className="text-xs font-bold uppercase text-muted-foreground mb-1">
                    {t("cartoline.annoCostruzione", "Anno")}
                  </div>
                  {revealedHints.includes("anno") ? (
                    <div className="font-bold text-sm">{stadio.anno}</div>
                  ) : (
                    <div className="font-bold text-sm text-muted-foreground">???</div>
                  )}
                  {!revealedHints.includes("anno") && (
                    <Button
                      size="sm"
                      onClick={() => handleUseHint("anno")}
                      disabled={!user || useHintMutation.isPending}
                      className="mt-2 w-full bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50"
                    >
                      <Star className="w-3 h-3 mr-1 fill-white" />
                      1 {t("cartoline.punti", "pt")}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Input risposta */}
            <div className="mb-6 bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-5">
              <h3 className="font-display font-bold uppercase text-lg mb-3">
                {t("cartoline.indovinaSquadra", "Indovina la squadra")}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t(
                  "cartoline.istruzioni",
                  "Inserisci il nome di una delle squadre che gioca in questo stadio"
                )}
              </p>

              <div className="relative flex gap-2">
                <div className="relative flex-1">
                  <input
                    ref={inputRef}
                    type="text"
                    value={guess}
                    onChange={(e) => {
                      setGuess(e.target.value);
                      setShowDropdown(e.target.value.trim().length > 0);
                    }}
                    onFocus={() => {
                      if (guess.trim().length > 0) setShowDropdown(true);
                    }}
                    onBlur={() => {
                      // Ritarda la chiusura per permettere il click sulle opzioni
                      setTimeout(() => setShowDropdown(false), 150);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleGuess();
                      if (e.key === "Escape") setShowDropdown(false);
                    }}
                    placeholder={t("cartoline.placeholder", "Scrivi il nome della squadra...")}
                    className="w-full border-2 border-black px-4 py-3 font-bold text-base focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] bg-white"
                    autoComplete="off"
                  />
                  {/* Dropdown filtrato */}
                  {showDropdown && (() => {
                    const filtered = allSquadre.filter((sq) =>
                      normalizeStr(sq).includes(normalizeStr(guess))
                    );
                    return filtered.length > 0 ? (
                      <div
                        ref={dropdownRef}
                        className="absolute z-50 top-full left-0 right-0 border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] max-h-56 overflow-y-auto"
                      >
                        {filtered.map((sq) => (
                          <button
                            key={sq}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setGuess(sq);
                              setShowDropdown(false);
                              inputRef.current?.focus();
                            }}
                            className="w-full text-left px-4 py-2 font-bold text-sm hover:bg-amber-50 border-b border-gray-100 last:border-b-0 cursor-pointer"
                          >
                            {sq}
                          </button>
                        ))}
                      </div>
                    ) : null;
                  })()}
                </div>
                <Button
                  onClick={handleGuess}
                  disabled={!guess.trim() || solveStadiumMutation.isPending}
                  className="bg-black text-white font-bold uppercase px-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50"
                >
                  {t("common.conferma", "Conferma")}
                </Button>
              </div>

              {/* Storico tentativi */}
              {attempts.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="text-xs font-bold uppercase text-muted-foreground">
                    {t("cartoline.tentativi", "Tentativi")}
                  </div>
                  {attempts.map((a, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-2 px-3 py-2 border-2 border-black font-bold text-sm ${
                        a.correct
                          ? "bg-green-100 text-green-800"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {a.correct ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <X className="w-4 h-4 text-red-500" />
                      )}
                      {a.value}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Info stadio già sbloccato (senza schermata successo) */}
        {isSolved && !showSuccess && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white border-2 border-black p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <div className="text-xs font-bold uppercase text-muted-foreground mb-1">
                {t("cartoline.nomeStadio", "Nome Stadio")}
              </div>
              <div className="font-bold">{stadio.nome}</div>
            </div>
            <div className="bg-white border-2 border-black p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <div className="text-xs font-bold uppercase text-muted-foreground mb-1">
                {t("cartoline.capienza", "Capienza")}
              </div>
              <div className="font-bold">{stadio.capienza}</div>
            </div>
            <div className="bg-white border-2 border-black p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <div className="text-xs font-bold uppercase text-muted-foreground mb-1">
                {t("cartoline.annoCostruzione", "Anno di costruzione")}
              </div>
              <div className="font-bold">{stadio.anno}</div>
            </div>
            <div className="bg-white border-2 border-black p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <div className="text-xs font-bold uppercase text-muted-foreground mb-1">
                {t("cartoline.squadre", "Squadre")}
              </div>
              <div className="font-bold">{stadio.squadre[0]}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
