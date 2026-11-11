import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Trophy, Eye, EyeOff } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { NavigationBar } from "@/components/NavigationBar";
import { FeedbackModal } from "@/components/FeedbackModal";
import { DonationProgress } from "@/components/DonationProgress";
import serieAData from "@/data/serie_a_100_to_299_apps.json";
import { useTranslation } from "react-i18next";

interface SeasonStats {
  season: string;
  competition_name: string;
  competition_id: string | null;
  goals: number;
  apps: number;
}

interface CareerTeam {
  name: string;
  id: string;
  season: string;
}

interface PlayerData {
  player_id: string;
  name: string;
  nationality: string;
  position: string;
  birth_date: string;
  height: string;
  career_teams: CareerTeam[];
  goals: {
    by_season: SeasonStats[];
    career_total: number;
  };
  cards: {
    yellow: number;
    red: number;
    yellow_red: number;
    total_sent_off: number;
  };
}

interface GroupedTeam {
  name: string;
  period: string;
  appearances: number;
  goals: number;
}

export default function CarriereGame() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [currentPlayer, setCurrentPlayer] = useState<PlayerData | null>(null);
  const [groupedCareer, setGroupedCareer] = useState<GroupedTeam[]>([]);
  const [userGuess, setUserGuess] = useState("");
  const [hintsUsed, setHintsUsed] = useState(0);
  const [showNationality, setShowNationality] = useState(false);
  const [showPosition, setShowPosition] = useState(false);
  const [showBirthDate, setShowBirthDate] = useState(false);
  const [revealedPlayer, setRevealedPlayer] = useState(false);
  const [gameState, setGameState] = useState<"playing" | "won" | "lost">("playing");
  const [score, setScore] = useState(0);
  const [gamesPlayed, setGamesPlayed] = useState(0);

  // Raggruppa le stagioni per squadra e calcola periodi CONSECUTIVI
  const groupCareer = (player: PlayerData): GroupedTeam[] => {
    // Crea mappa anno -> squadra e statistiche
    const yearMap = new Map<number, { team: string; goals: number; apps: number }>();

    // Filtra squadre giovanili (Primavera, U19, U17, U21, B)
    const isYouthTeam = (teamName: string): boolean => {
      const lowerName = teamName.toLowerCase();
      return lowerName.includes('primavera') || 
             lowerName.includes(' u19') || lowerName.includes(' u17') || 
             lowerName.includes(' u21') || lowerName.includes(' u20') ||
             lowerName.includes(' u18') || lowerName.includes(' u16') ||
             lowerName.endsWith(' b') || lowerName.includes(' ii');
    };

    // Espandi range di stagioni in anni individuali
    const expandSeasonRange = (season: string): number[] => {
      if (season.includes('-')) {
        const parts = season.split('-');
        const start = parseInt(parts[0]);
        const end = parseInt(parts[1]);
        const years: number[] = [];
        for (let y = start; y <= end; y++) {
          years.push(y);
        }
        return years;
      }
      return [parseSeasonYear(season)];
    };

    // Popola mappa con dati da career_teams (escluse squadre giovanili)
    player.career_teams.forEach(careerTeam => {
      if (isYouthTeam(careerTeam.name)) return; // Salta squadre giovanili
      const years = expandSeasonRange(careerTeam.season);
      years.forEach(year => {
        if (!yearMap.has(year)) {
          yearMap.set(year, { team: careerTeam.name, goals: 0, apps: 0 });
        }
      });
    });

    // Aggiungi statistiche (distribuisci equamente tra gli anni del range)
    player.goals.by_season.forEach(season => {
      const matchingCareerTeam = player.career_teams.find(ct => ct.season === season.season);
      if (matchingCareerTeam) {
        const years = expandSeasonRange(season.season);
        const goalsPerYear = season.goals / years.length;
        const appsPerYear = season.apps / years.length;
        years.forEach(year => {
          if (yearMap.has(year)) {
            const data = yearMap.get(year)!;
            data.goals += goalsPerYear;
            data.apps += appsPerYear;
          }
        });
      }
    });

    // Converti in array e ordina per anno decrescente
    const seasons = Array.from(yearMap.entries())
      .map(([year, data]) => ({ year, ...data }))
      .sort((a, b) => b.year - a.year);

    // Raggruppa periodi CONSECUTIVI per la stessa squadra
    const grouped: GroupedTeam[] = [];
    let currentGroup: { team: string; years: number[]; goals: number; apps: number } | null = null as { team: string; years: number[]; goals: number; apps: number } | null;

    seasons.forEach(s => {
      if (!currentGroup || currentGroup.team !== s.team || currentGroup.years[currentGroup.years.length - 1] - s.year !== 1) {
        // Nuovo gruppo (squadra diversa o anno non consecutivo)
        if (currentGroup) {
          grouped.push({
            name: currentGroup.team,
            period: formatPeriod(currentGroup.years),
            appearances: Math.round(currentGroup.apps),
            goals: Math.round(currentGroup.goals)
          });
        }
        currentGroup = { team: s.team, years: [s.year], goals: s.goals, apps: s.apps };
      } else {
        // Stesso gruppo (anno consecutivo)
        currentGroup.years.push(s.year);
        currentGroup.goals += s.goals;
        currentGroup.apps += s.apps;
      }
    });

    // Aggiungi ultimo gruppo
    if (currentGroup) {
      grouped.push({
        name: currentGroup.team,
        period: formatPeriod(currentGroup.years),
        appearances: Math.round(currentGroup.apps),
        goals: Math.round(currentGroup.goals)
      });
    }

    return grouped;
  };

  // Helper: converte stagione in anno (es. '24/25' -> 2024, '1987-1989' -> 1987)
  const parseSeasonYear = (season: string): number => {
    // Gestisci range (es. '1987-1989')
    if (season.includes('-')) {
      const parts = season.split('-');
      return parseInt(parts[0]);
    }
    // Gestisci formato slash (es. '24/25')
    const parts = season.split('/');
    if (parts.length === 1) return parseInt(season);
    const firstYear = parseInt(parts[0]);
    if (firstYear < 100) {
      return firstYear > 50 ? 1900 + firstYear : 2000 + firstYear;
    }
    return firstYear;
  };

  // Helper: formatta periodo da array di anni
  const formatPeriod = (years: number[]): string => {
    if (years.length === 1) return `'${years[0]}`;
    const sorted = [...years].sort((a, b) => a - b);
    return `'${sorted[0]}-'${sorted[sorted.length - 1]}`;
  };

  // Seleziona giocatore casuale
  const selectRandomPlayer = () => {
    const players = serieAData as PlayerData[];
    const randomPlayer = players[Math.floor(Math.random() * players.length)];
    setCurrentPlayer(randomPlayer);
    setGroupedCareer(groupCareer(randomPlayer));
    resetGame();
  };

  const resetGame = () => {
    setUserGuess("");
    setHintsUsed(0);
    setShowNationality(false);
    setShowPosition(false);
    setShowBirthDate(false);
    setRevealedPlayer(false);
    setGameState("playing");
  };

  useEffect(() => {
    selectRandomPlayer();
  }, []);

  const extractPlayerName = (fullName: string): string => {
    return fullName.replace(/^#\d+\s+/, "").trim();
  };

  const normalizeString = (str: string): string => {
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, "")
      .trim();
  };

  const levenshteinDistance = (str1: string, str2: string): number => {
    const matrix: number[][] = [];
    for (let i = 0; i <= str2.length; i++) matrix[i] = [i];
    for (let j = 0; j <= str1.length; j++) matrix[0][j] = j;
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  };

  const checkGuess = () => {
    if (!currentPlayer || userGuess.trim() === "") return;

    const playerName = extractPlayerName(currentPlayer.name);
    const normalizedGuess = normalizeString(userGuess);
    const normalizedName = normalizeString(playerName);

    const nameParts = normalizedName.split(" ");
    const surname = nameParts[nameParts.length - 1];

    if (normalizedGuess === surname || normalizedGuess === normalizedName) {
      handleCorrectGuess();
      return;
    }

    const distance = levenshteinDistance(normalizedGuess, surname);
    if (distance <= 1) {
      handleCorrectGuess();
      return;
    }

    toast.error("Risposta errata! Riprova.");
  };

  const handleCorrectGuess = () => {
    setGameState("won");
    setScore(score + 1);
    setGamesPlayed(gamesPlayed + 1);
    toast.success(`${t('carriere.corretto')} ${extractPlayerName(currentPlayer!.name)}`);
  };

  const showHint = (type: "nationality" | "position" | "birthDate") => {
    setHintsUsed(hintsUsed + 1);
    
    if (type === "nationality") {
      setShowNationality(true);
      toast.info(`Nazionalità: ${currentPlayer?.nationality}`);
    } else if (type === "position") {
      setShowPosition(true);
      toast.info(`Ruolo: ${currentPlayer?.position}`);
    } else if (type === "birthDate") {
      setShowBirthDate(true);
      const year = currentPlayer?.birth_date.split('/')[2]?.split(' ')[0];
      toast.info(`${t('carriere.annoNascita')}: ${year || 'N/A'}`);
    }
  };

  const toggleRevealPlayer = () => {
    setRevealedPlayer(!revealedPlayer);
    if (!revealedPlayer) {
      toast.info(`${t('carriere.ilGiocatoreE')}: ${extractPlayerName(currentPlayer!.name)}`);
    }
  };

  const nextPlayer = () => {
    selectRandomPlayer();
  };

  return (
    <>
      <NavigationBar onFeedbackClick={() => setIsFeedbackOpen(true)} />
      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
      <div className="bg-background text-foreground p-4 pt-20 font-mono">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="text-sm font-medium">
              Punteggio: {score}/{gamesPlayed}
            </div>
            <Trophy className="w-5 h-5 text-yellow-500" />
          </div>
        </div>

        {/* Game Card */}
        <Card className="p-8 bg-card border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <h1 className="text-3xl font-display font-bold uppercase text-center mb-2 text-primary">Indovina il Giocatore</h1>
          <p className="text-center text-muted-foreground mb-6 font-bold uppercase tracking-widest text-sm">Dalla sua carriera</p>

          {currentPlayer && (
            <>
              {/* Career Table */}
              <div className="mb-6 overflow-x-auto">
                <table className="w-full border-collapse border-2 border-black">
                  <thead>
                    <tr className="bg-primary text-primary-foreground">
                      <th className="border-2 border-black px-4 py-2 text-left font-bold uppercase">Squadra</th>
                      <th className="border-2 border-black px-4 py-2 text-center font-bold uppercase">Periodo</th>
                      <th className="border-2 border-black px-4 py-2 text-center font-bold uppercase">Presenze</th>
                      <th className="border-2 border-black px-4 py-2 text-center font-bold uppercase">Gol</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedCareer.map((team, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? "bg-card" : "bg-muted"}>
                        <td className="border-2 border-black px-4 py-2 font-bold">{team.name}</td>
                        <td className="border-2 border-black px-4 py-2 text-center">{team.period}</td>
                        <td className="border-2 border-black px-4 py-2 text-center font-bold">{team.appearances}</td>
                        <td className="border-2 border-black px-4 py-2 text-center font-bold">{team.goals}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Hints */}
              <div className="mb-6 flex flex-wrap gap-3 justify-center">
                <Button
                  onClick={() => showHint("nationality")}
                  disabled={showNationality}
                  variant="outline"
                  size="sm"
                >
                  🌍 Nazionalità: {showNationality ? currentPlayer.nationality : "???"}
                </Button>
                <Button
                  onClick={() => showHint("position")}
                  disabled={showPosition}
                  variant="outline"
                  size="sm"
                >
                  ⚽ Ruolo: {showPosition ? currentPlayer.position : "???"}
                </Button>
                <Button
                  onClick={() => showHint("birthDate")}
                  disabled={showBirthDate}
                  variant="outline"
                  size="sm"
                >
                  📅 Anno: {showBirthDate ? currentPlayer.birth_date.split('/')[2]?.split(' ')[0] : "???"}
                </Button>
              </div>

              {/* Reveal Player Button */}
              <div className="mb-6 flex justify-center">
                <Button
                  onClick={toggleRevealPlayer}
                  variant="destructive"
                  className="gap-2"
                >
                  {revealedPlayer ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {revealedPlayer ? "Nascondi Giocatore" : "Mostra Giocatore"}
                </Button>
              </div>

              {revealedPlayer && (
                <div className="mb-6 p-4 bg-accent border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-center">
                  <p className="text-xl font-display font-bold uppercase text-accent-foreground">
                    {extractPlayerName(currentPlayer.name)}
                  </p>
                </div>
              )}

              {/* Input */}
              {gameState === "playing" && (
                <div className="space-y-2 mb-4">
                  <div className="flex gap-2">
                    <Input
                      value={userGuess}
                      onChange={(e) => setUserGuess(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && checkGuess()}
                      placeholder={t('carriere.indovinaGiocatore')}
                      className="flex-1"
                    />
                    <Button onClick={checkGuess}>{t('carriere.verifica')}</Button>
                  </div>
                  <div className="text-center">
                    <Button onClick={nextPlayer} variant="outline" className="w-full">
                      {t('carriere.nuovoGiocatore')}
                    </Button>
                  </div>
                </div>
              )}

              {/* Next Player */}
              {gameState === "won" && (
                <div className="text-center">
                  <Button onClick={nextPlayer} className="mt-4">
                    {t('carriere.nuovoGiocatore')}
                  </Button>
                </div>
              )}

              {/* Stats */}
              <div className="mt-6 text-center text-sm text-muted-foreground font-bold">
                <p>{t('carriere.indiziUsati')}: {hintsUsed}</p>
                <p className="mt-2">PRESENZE TOTALI: {groupedCareer.reduce((sum, team) => sum + team.appearances, 0)}</p>
              </div>
            </>
          )}
        </Card>

        {/* Pulsante Supporta il Progetto */}
        <div className="flex justify-center mt-8">
          <a 
            href="https://www.paypal.com/pool/9lCKCiF8hN?sr=wccr" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-block"
          >
            <Button 
              size="lg"
              className="py-6 px-12 text-xl font-display font-bold uppercase bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] transition-all"
            >
              ❤️ Supporta il Progetto
            </Button>
          </a>
        </div>

        {/* Donation Progress */}
        <DonationProgress />
      </div>
    </div>
    </>
  );
}
