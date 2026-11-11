/**
 * Achievement definitions for Kickoff Trivia.
 * Each achievement has 3 tiers: bronze (1), silver (2), gold (3).
 * The `check` function is evaluated server-side when a relevant event occurs.
 */

export type AchievementTier = {
  tier: 1 | 2 | 3;
  label: "Bronzo" | "Argento" | "Oro";
  description: string;
  /** Threshold value used for progress display (optional) */
  threshold?: number;
};

export type Achievement = {
  id: string;
  name: string;
  game: string; // e.g. "formazioni", "carriera", "link", "progressione", "cartoline", "aarons-zurkowski", "dream-team", "generale"
  icon: string; // emoji
  tiers: [AchievementTier, AchievementTier, AchievementTier]; // [bronze, silver, gold]
};

export const ACHIEVEMENTS: Achievement[] = [
  // ─── FORMAZIONI ──────────────────────────────────────────────────────────
  {
    id: "overthinker",
    name: "Overthinker",
    game: "formazioni",
    icon: "🔍",
    tiers: [
      { tier: 1, label: "Bronzo", description: "Scova tutti e 22 i giocatori in una partita di Formazioni" },
      { tier: 2, label: "Argento", description: "Scova tutti e 22 i giocatori in modalità Sfida (max 2 errori)" },
      { tier: 3, label: "Oro", description: "Scova tutti e 22 i giocatori in modalità Sfida senza mai perdere una vita" },
    ],
  },
  {
    id: "scout",
    name: "Scout",
    game: "formazioni",
    icon: "⚽",
    tiers: [
      { tier: 1, label: "Bronzo", description: "Gioca una partita online classificata", threshold: 1 },
      { tier: 2, label: "Argento", description: "Gioca 10 partite online classificate", threshold: 10 },
      { tier: 3, label: "Oro", description: "Gioca 50 partite online classificate", threshold: 50 },
    ],
  },

  // ─── CARRIERA ────────────────────────────────────────────────────────────
  {
    id: "maratoneta",
    name: "Maratoneta",
    game: "carriera",
    icon: "🏃",
    tiers: [
      { tier: 1, label: "Bronzo", description: "Indovina la carriera di 2 giocatori consecutivi in Maratona", threshold: 2 },
      { tier: 2, label: "Argento", description: "Indovina la carriera di 5 giocatori consecutivi in Maratona", threshold: 5 },
      { tier: 3, label: "Oro", description: "Indovina la carriera di 10 giocatori consecutivi in Maratona", threshold: 10 },
    ],
  },

  // ─── LINK ─────────────────────────────────────────────────────────────────
  {
    id: "mercato-invernale",
    name: "Mercato Invernale",
    game: "link",
    icon: "❄️",
    tiers: [
      { tier: 1, label: "Bronzo", description: "Entra nella classifica globale di Link (facile, 2 squadre)" },
      { tier: 2, label: "Argento", description: "Entra nella classifica di Link (facile) sotto i 10:00", threshold: 600 },
      { tier: 3, label: "Oro", description: "Entra nella classifica di Link (facile) sotto i 7:00", threshold: 420 },
    ],
  },
  {
    id: "mercato-estivo",
    name: "Mercato Estivo",
    game: "link",
    icon: "☀️",
    tiers: [
      { tier: 1, label: "Bronzo", description: "Entra nella classifica globale di Link (difficile, 3 squadre)" },
      { tier: 2, label: "Argento", description: "Entra nella classifica di Link (difficile) sotto i 10:00", threshold: 600 },
      { tier: 3, label: "Oro", description: "Entra nella classifica di Link (difficile) sotto i 7:00", threshold: 420 },
    ],
  },

  // ─── PROGRESSIONE ─────────────────────────────────────────────────────────
  {
    id: "progressione-master",
    name: "Progressione Master",
    game: "progressione",
    icon: "📈",
    tiers: [
      { tier: 1, label: "Bronzo", description: "Entra nella classifica globale di Progressione in tutte le categorie" },
      { tier: 2, label: "Argento", description: "Entra nella classifica di Progressione in tutte le categorie sotto i 3:00", threshold: 180 },
      { tier: 3, label: "Oro", description: "Entra nella classifica di Progressione in tutte le categorie sotto i 2:00", threshold: 120 },
    ],
  },

  // ─── CARTOLINE ────────────────────────────────────────────────────────────
  {
    id: "collezionista",
    name: "Collezionista",
    game: "cartoline",
    icon: "🗺️",
    tiers: [
      { tier: 1, label: "Bronzo", description: "Completa almeno 1 pagina dell'album Cartoline", threshold: 1 },
      { tier: 2, label: "Argento", description: "Completa almeno 3 pagine dell'album Cartoline", threshold: 3 },
      { tier: 3, label: "Oro", description: "Completa tutte le pagine dell'album Cartoline", threshold: 6 },
    ],
  },

  // ─── AARONS-ZURKOWSKI ─────────────────────────────────────────────────────
  {
    id: "aarons-zurkowski",
    name: "Aarons-Zurkowski",
    game: "aarons-zurkowski",
    icon: "🔤",
    tiers: [
      { tier: 1, label: "Bronzo", description: "Indovina il nome di 1 giocatore in Aarons-Zurkowski", threshold: 1 },
      { tier: 2, label: "Argento", description: "Indovina il nome di 10 giocatori in Aarons-Zurkowski", threshold: 10 },
      { tier: 3, label: "Oro", description: "Indovina il nome di 50 giocatori in Aarons-Zurkowski", threshold: 50 },
    ],
  },

  // ─── DREAM TEAM ───────────────────────────────────────────────────────────
  {
    id: "dream-team-campione",
    name: "Campione del Mondo",
    game: "dream-team",
    icon: "🏆",
    tiers: [
      { tier: 1, label: "Bronzo", description: "Vinci il mondiale in un torneo Dream Team single player" },
      { tier: 2, label: "Argento", description: "Vinci il mondiale in un torneo Dream Team multiplayer" },
      { tier: 3, label: "Oro", description: "Vinci il mondiale con tutti i moduli disponibili in single player" },
    ],
  },

  // ─── GENERALE (extra) ─────────────────────────────────────────────────────
  {
    id: "habitue",
    name: "Habitué",
    game: "generale",
    icon: "📅",
    tiers: [
      { tier: 1, label: "Bronzo", description: "Accedi al sito per 3 giorni consecutivi", threshold: 3 },
      { tier: 2, label: "Argento", description: "Accedi al sito per 7 giorni consecutivi", threshold: 7 },
      { tier: 3, label: "Oro", description: "Accedi al sito per 30 giorni consecutivi", threshold: 30 },
    ],
  },
  {
    id: "poliglotta",
    name: "Poliglotta",
    game: "generale",
    icon: "🌍",
    tiers: [
      { tier: 1, label: "Bronzo", description: "Gioca almeno una partita in 3 giochi diversi", threshold: 3 },
      { tier: 2, label: "Argento", description: "Gioca almeno una partita in 5 giochi diversi", threshold: 5 },
      { tier: 3, label: "Oro", description: "Gioca almeno una partita in tutti i giochi disponibili", threshold: 8 },
    ],
  },
];

/** Map from achievementId to Achievement for fast lookup */
export const ACHIEVEMENT_MAP = new Map(ACHIEVEMENTS.map(a => [a.id, a]));

/** All game categories */
export const ACHIEVEMENT_GAMES = [
  { id: "formazioni", label: "Formazioni" },
  { id: "carriera", label: "Carriera" },
  { id: "link", label: "Link" },
  { id: "progressione", label: "Progressione" },
  { id: "cartoline", label: "Cartoline" },
  { id: "aarons-zurkowski", label: "Aarons-Zurkowski" },
  { id: "dream-team", label: "Dream Team" },
  { id: "generale", label: "Generale" },
];
