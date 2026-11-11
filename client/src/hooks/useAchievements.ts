/**
 * Hook for unlocking achievements from game pages.
 * Calls trpc.achievements.checkAndUnlock and shows a toast for newly unlocked tiers.
 */
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useCallback } from "react";
import { toast } from "sonner";
import { ACHIEVEMENT_MAP } from "../../../shared/achievements";

const TIER_LABEL = { 1: "Bronzo 🥉", 2: "Argento 🥈", 3: "Oro 🥇" } as const;

export function useAchievements() {
  const { isAuthenticated } = useAuth({});
  const utils = trpc.useUtils();

  const checkAndUnlock = trpc.achievements.checkAndUnlock.useMutation({
    onSuccess: (data) => {
      for (const item of data.newlyUnlocked) {
        const achievement = ACHIEVEMENT_MAP.get(item.achievementId);
        if (!achievement) continue;
        const tierLabel = TIER_LABEL[item.tier as 1 | 2 | 3];
        toast.success(`🏆 Trofeo sbloccato! ${achievement.icon} ${achievement.name} — ${tierLabel}`, {
          duration: 5000,
        });
      }
      // Invalidate achievements cache so the Trofei page updates
      if (data.newlyUnlocked.length > 0) {
        utils.achievements.getMyAchievements.invalidate();
      }
    },
  });

  const unlock = useCallback(
    (candidates: { achievementId: string; tier: 1 | 2 | 3 }[]) => {
      if (!isAuthenticated || candidates.length === 0) return;
      checkAndUnlock.mutate(candidates);
    },
    [isAuthenticated, checkAndUnlock]
  );

  return { unlock };
}
