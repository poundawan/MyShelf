export const gameCategoryLabels: Record<string, string> = {
  BOARD_GAME: "Jeu de société",
  ROLE_PLAYING: "Jeu de rôle",
  OTHER: "Autre",
};
export const gameCategoryEmoji: Record<string, string> = {
  BOARD_GAME: "🎲",
  ROLE_PLAYING: "🐉",
  OTHER: "📦",
};

export const eventTypeLabels: Record<string, string> = {
  BOARD_GAME: "Jeu de société",
  ROLE_PLAYING: "Jeu de rôle",
  TCG: "TCG",
  DISCOVERY: "Découverte",
};
export const eventTypeEmoji: Record<string, string> = {
  BOARD_GAME: "🎲",
  ROLE_PLAYING: "🐉",
  TCG: "🃏",
  DISCOVERY: "✨",
};

export const playerLevelLabels: Record<string, string> = {
  BEGINNER: "Débutant",
  INTERMEDIATE: "Intermédiaire",
  CONFIRMED: "Confirmé",
};

export const conditionLabels: Record<string, string> = {
  NEW: "Neuf",
  LIKE_NEW: "Comme neuf",
  GOOD: "Bon état",
  WORN: "Usé",
};

export const copyStatusLabels: Record<string, string> = {
  ON_TABLE: "Sur la table",
  KEPT_WARM: "Gardée au chaud",
  IN_TRADE: "En échange",
  TRADED: "Échangée",
};

export const cardRarityLabels: Record<string, string> = {
  COMMON: "Commune",
  RARE: "Rare",
  FOIL: "Foil",
  MYTHIC: "Mythique",
};

export const eventStatusLabels: Record<string, string> = {
  ACTIVE: "Prévue",
  CANCELLED: "Annulée",
};

export const tradeStatusLabels: Record<string, string> = {
  PENDING: "En attente",
  ACCEPTED: "Acceptée",
  REJECTED: "Refusée",
  CANCELLED: "Annulée",
  COMPLETED: "Terminée",
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
