import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { ACHIEVEMENTS, ACHIEVEMENT_GAMES, type Achievement } from "../../../shared/achievements";
import { useState } from "react";
import { Trophy, Lock, ChevronRight, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";

// ─── Tier helpers ─────────────────────────────────────────────────────────────

const TIER_COLORS = {
  1: { bg: "bg-amber-700", border: "border-amber-800", text: "text-amber-900", label: "Bronzo", ring: "ring-amber-600" },
  2: { bg: "bg-gray-400", border: "border-gray-500", text: "text-gray-700", label: "Argento", ring: "ring-gray-400" },
  3: { bg: "bg-yellow-400", border: "border-yellow-500", text: "text-yellow-800", label: "Oro", ring: "ring-yellow-400" },
} as const;

const TIER_GRADIENT = {
  1: "from-amber-600 to-amber-800",
  2: "from-gray-300 to-gray-500",
  3: "from-yellow-300 to-yellow-500",
} as const;

const TIER_GRADIENT_MODERN = {
  1: "from-amber-700 to-amber-900",
  2: "from-gray-500 to-gray-700",
  3: "from-yellow-400 to-yellow-600",
} as const;

function TrophyIcon({ tier, size = "md", isModern = false }: { tier: 1 | 2 | 3; size?: "sm" | "md" | "lg"; isModern?: boolean }) {
  const sizeClass = size === "sm" ? "w-8 h-8 text-xl" : size === "lg" ? "w-16 h-16 text-4xl" : "w-12 h-12 text-2xl";
  const gradient = isModern ? TIER_GRADIENT_MODERN[tier] : TIER_GRADIENT[tier];
  return (
    <div
      className={`${sizeClass} rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center shadow-md border-2 ${TIER_COLORS[tier].border}`}
    >
      🏆
    </div>
  );
}

function LockedTrophyIcon({ size = "md", isModern = false }: { size?: "sm" | "md" | "lg"; isModern?: boolean }) {
  const sizeClass = size === "sm" ? "w-8 h-8 text-xl" : size === "lg" ? "w-16 h-16 text-4xl" : "w-12 h-12 text-2xl";
  return (
    <div className={`${sizeClass} rounded-full flex items-center justify-center shadow-inner border-2 ${
      isModern ? "bg-gray-800 border-gray-700" : "bg-gray-200 border-gray-300"
    }`}>
      <Lock className={`w-1/2 h-1/2 ${isModern ? "text-gray-600" : "text-gray-400"}`} />
    </div>
  );
}

// ─── Achievement Card ─────────────────────────────────────────────────────────

function AchievementCard({
  achievement,
  unlockedTiers,
  isModern,
}: {
  achievement: Achievement;
  unlockedTiers: Set<number>;
  isModern: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const maxTier = Math.max(0, ...Array.from(unlockedTiers)) as 0 | 1 | 2 | 3;
  const isFullyUnlocked = unlockedTiers.has(3);
  const hasAny = unlockedTiers.size > 0;

  return (
    <div
      className={`transition-all duration-200 cursor-pointer ${
        isModern
          ? `rounded-xl border ${
              isFullyUnlocked
                ? "border-yellow-500/50 bg-gray-900/80 shadow-lg shadow-yellow-500/10"
                : "border-gray-800 bg-gray-900/60 hover:border-gray-700"
            } hover:bg-gray-900`
          : `border-2 border-black rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 ${
              isFullyUnlocked ? "ring-2 ring-yellow-400 ring-offset-1" : ""
            }`
      }`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="p-4 flex items-center gap-4">
        {/* Trophy icon showing highest unlocked tier */}
        <div className="flex-shrink-0">
          {maxTier > 0 ? (
            <TrophyIcon tier={maxTier as 1 | 2 | 3} isModern={isModern} />
          ) : (
            <LockedTrophyIcon isModern={isModern} />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">{achievement.icon}</span>
            <h3 className={`font-black text-sm uppercase tracking-wide truncate ${
              isModern ? "text-gray-100" : "text-gray-900"
            }`}>
              {achievement.name}
            </h3>
            {hasAny && (
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${
                  maxTier === 3
                    ? "bg-yellow-500"
                    : maxTier === 2
                    ? "bg-gray-500"
                    : "bg-amber-700"
                }`}
              >
                {TIER_COLORS[maxTier as 1 | 2 | 3]?.label}
              </span>
            )}
          </div>
          <p className={`text-xs mt-0.5 truncate ${isModern ? "text-gray-500" : "text-gray-500"}`}>
            {hasAny
              ? achievement.tiers[maxTier - 1]?.description
              : achievement.tiers[0].description}
          </p>
        </div>

        {/* Tier dots */}
        <div className="flex gap-1 flex-shrink-0">
          {([1, 2, 3] as const).map((t) => (
            <div
              key={t}
              className={`w-3 h-3 rounded-full border ${
                unlockedTiers.has(t)
                  ? `${TIER_COLORS[t].bg} ${TIER_COLORS[t].border}`
                  : isModern ? "bg-gray-800 border-gray-700" : "bg-gray-200 border-gray-300"
              }`}
            />
          ))}
        </div>

        <ChevronRight
          className={`w-4 h-4 flex-shrink-0 transition-transform ${expanded ? "rotate-90" : ""} ${
            isModern ? "text-gray-600" : "text-gray-400"
          }`}
        />
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className={`border-t px-4 py-3 ${
          isModern ? "border-gray-800 bg-gray-950/50" : "border-t-2 border-black bg-gray-50"
        }`}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {achievement.tiers.map((tier) => (
              <div
                key={tier.tier}
                className={`p-3 ${
                  isModern
                    ? `rounded-lg border ${
                        unlockedTiers.has(tier.tier)
                          ? "border-gray-700 bg-gray-900"
                          : "border-gray-800 bg-gray-900/40 opacity-50"
                      }`
                    : `border-2 rounded-none ${
                        unlockedTiers.has(tier.tier)
                          ? "border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                          : "border-gray-300 bg-gray-100 opacity-60"
                      }`
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {unlockedTiers.has(tier.tier) ? (
                    <TrophyIcon tier={tier.tier} size="sm" isModern={isModern} />
                  ) : (
                    <LockedTrophyIcon size="sm" isModern={isModern} />
                  )}
                  <span
                    className={`text-xs font-black uppercase ${
                      unlockedTiers.has(tier.tier)
                        ? tier.tier === 3
                          ? "text-yellow-500"
                          : tier.tier === 2
                          ? isModern ? "text-gray-400" : "text-gray-600"
                          : "text-amber-600"
                        : isModern ? "text-gray-700" : "text-gray-400"
                    }`}
                  >
                    {tier.label}
                  </span>
                </div>
                <p className={`text-xs leading-tight ${isModern ? "text-gray-400" : "text-gray-700"}`}>
                  {tier.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Trofei() {
  const { user, isAuthenticated } = useAuth({});
  const [, setLocation] = useLocation();
  const [activeGame, setActiveGame] = useState<string>("all");
  const { isModern } = useTheme();

  const { data, isLoading } = trpc.achievements.getMyAchievements.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // Build a map: achievementId → Set<tier>
  const unlockedMap = new Map<string, Set<number>>();
  if (data?.unlocked) {
    for (const u of data.unlocked) {
      if (!unlockedMap.has(u.achievementId)) unlockedMap.set(u.achievementId, new Set());
      unlockedMap.get(u.achievementId)!.add(u.tier);
    }
  }

  const filteredAchievements =
    activeGame === "all"
      ? ACHIEVEMENTS
      : ACHIEVEMENTS.filter((a) => a.game === activeGame);

  const totalUnlocked = data?.unlocked.length ?? 0;
  const totalPossible = ACHIEVEMENTS.length * 3;

  // ─── Not logged in ───────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-8 ${
        isModern ? "bg-gray-950" : "bg-[#fff5f7]"
      }`}>
        <div className={`max-w-md w-full p-8 text-center ${
          isModern
            ? "bg-gray-900 border border-gray-800 rounded-2xl shadow-xl"
            : "border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] bg-white"
        }`}>
          <div className="text-6xl mb-4">🔒</div>
          <h1 className={`text-2xl font-black uppercase mb-2 ${isModern ? "text-gray-100" : "text-gray-900"}`}>
            Trofei
          </h1>
          <p className={`mb-6 ${isModern ? "text-gray-400" : "text-gray-600"}`}>
            Accedi per sbloccare i trofei e tenere traccia dei tuoi progressi.
          </p>
          <Button
            onClick={() => setLocation("/")}
            className={isModern
              ? "bg-green-500 hover:bg-green-600 text-gray-950 font-bold rounded-xl"
              : "bg-pink-600 hover:bg-pink-700 text-white font-bold border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
            }
          >
            <Home className="w-4 h-4 mr-2" />
            Torna alla Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen pt-16 pb-12 ${isModern ? "bg-gray-950" : "bg-[#fff5f7]"}`}>
      <div className="max-w-3xl mx-auto px-4">
        {/* Header */}
        <div className="text-center py-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Trophy className="w-8 h-8 text-yellow-500" />
            <h1 className={`text-4xl font-black uppercase tracking-tight ${
              isModern ? "text-gray-100" : "text-gray-900"
            }`}>
              Trofei
            </h1>
            <Trophy className="w-8 h-8 text-yellow-500" />
          </div>
          <p className={`text-sm ${isModern ? "text-gray-500" : "text-gray-500"}`}>
            {isLoading ? "Caricamento..." : `${totalUnlocked} / ${totalPossible} trofei sbloccati`}
          </p>

          {/* Progress bar */}
          <div className={`mt-3 h-3 overflow-hidden max-w-xs mx-auto ${
            isModern
              ? "bg-gray-800 rounded-full border border-gray-700"
              : "bg-gray-200 border-2 border-black rounded-none"
          }`}>
            <div
              className={`h-full transition-all duration-500 ${
                isModern
                  ? "bg-gradient-to-r from-green-500 to-cyan-500"
                  : "bg-gradient-to-r from-yellow-400 to-pink-500"
              }`}
              style={{ width: `${totalPossible > 0 ? (totalUnlocked / totalPossible) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Game filter tabs */}
        <div className="flex flex-wrap gap-2 mb-6 justify-center">
          <button
            onClick={() => setActiveGame("all")}
            className={`px-3 py-1.5 text-xs font-bold uppercase transition-all ${
              isModern
                ? `rounded-full border ${
                    activeGame === "all"
                      ? "bg-green-500 border-green-500 text-gray-950"
                      : "border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300"
                  }`
                : `border-2 border-black ${
                    activeGame === "all"
                      ? "bg-pink-600 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                      : "bg-white text-gray-700 hover:bg-pink-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  }`
            }`}
          >
            Tutti
          </button>
          {ACHIEVEMENT_GAMES.map((g) => {
            const count = ACHIEVEMENTS.filter((a) => a.game === g.id).reduce(
              (acc, a) => acc + (unlockedMap.get(a.id)?.size ?? 0),
              0
            );
            return (
              <button
                key={g.id}
                onClick={() => setActiveGame(g.id)}
                className={`px-3 py-1.5 text-xs font-bold uppercase transition-all flex items-center gap-1 ${
                  isModern
                    ? `rounded-full border ${
                        activeGame === g.id
                          ? "bg-green-500 border-green-500 text-gray-950"
                          : "border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300"
                      }`
                    : `border-2 border-black ${
                        activeGame === g.id
                          ? "bg-pink-600 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                          : "bg-white text-gray-700 hover:bg-pink-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                      }`
                }`}
              >
                {g.label}
                {count > 0 && (
                  <span className={`rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-black ${
                    isModern ? "bg-green-500/20 text-green-400" : "bg-yellow-400 text-black"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Achievement list */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={`h-20 animate-pulse ${
                isModern ? "bg-gray-800 rounded-xl" : "bg-gray-200 border-2 border-gray-300"
              }`} />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAchievements.map((achievement) => (
              <AchievementCard
                key={achievement.id}
                achievement={achievement}
                unlockedTiers={unlockedMap.get(achievement.id) ?? new Set()}
                isModern={isModern}
              />
            ))}
          </div>
        )}

        {/* Legend */}
        <div className={`mt-8 p-4 ${
          isModern
            ? "bg-gray-900 border border-gray-800 rounded-xl"
            : "border-2 border-black bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
        }`}>
          <h3 className={`font-black text-xs uppercase mb-3 ${isModern ? "text-gray-500" : "text-gray-700"}`}>
            Legenda Tier
          </h3>
          <div className="flex gap-4 flex-wrap">
            {([1, 2, 3] as const).map((t) => (
              <div key={t} className="flex items-center gap-2">
                <TrophyIcon tier={t} size="sm" isModern={isModern} />
                <span className={`text-xs font-bold ${isModern ? "text-gray-400" : "text-gray-700"}`}>
                  {TIER_COLORS[t].label}
                </span>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <LockedTrophyIcon size="sm" isModern={isModern} />
              <span className={`text-xs font-bold ${isModern ? "text-gray-600" : "text-gray-400"}`}>
                Bloccato
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
