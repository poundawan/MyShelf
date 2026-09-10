/**
 * Ce qui reste ici ne dépend pas de la langue : des symboles et un barème.
 *
 * Les libellés, eux, vivent dans les dictionnaires de `src/lib/i18n` et se
 * lisent avec `t("category." + valeur)`. Les garder ici en dur reviendrait à
 * n'avoir qu'une seule langue possible.
 */

export const gameCategoryEmoji: Record<string, string> = {
  BOARD_GAME: "🎲",
  ROLE_PLAYING: "🐉",
  OTHER: "📦",
};

export const eventTypeEmoji: Record<string, string> = {
  BOARD_GAME: "🎲",
  ROLE_PLAYING: "🐉",
  TCG: "🃏",
  DISCOVERY: "✨",
};

// niveau -> seuil d'échanges/tables cumulés pour l'atteindre
export const levelThresholds = [0, 3, 8, 16, 30, 50, 80];

export function computeLevel(completedInteractions: number) {
  let level = 1;
  for (let i = 1; i < levelThresholds.length; i++) {
    if (completedInteractions >= levelThresholds[i]) level = i + 1;
  }
  const next = levelThresholds[level] ?? null;
  const prev = levelThresholds[level - 1] ?? 0;
  const progress = next ? Math.min(1, (completedInteractions - prev) / (next - prev)) : 1;
  return { level, next, prev, progress, completedInteractions };
}
