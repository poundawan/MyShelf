export function daysSince(date: Date) {
  return Math.max(1, Math.floor((Date.now() - date.getTime()) / 86_400_000) + 1);
}

export function formatDateShort(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" }).format(date);
}

export function formatEventDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(date);
}

export function formatEventRange(start: Date, end: Date | null) {
  if (!end) return formatEventDate(start);
  const sameDay = start.toDateString() === end.toDateString();
  const startStr = formatEventDate(start);
  const endStr = sameDay
    ? new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(end)
    : formatEventDate(end);
  return `${startStr} → ${endStr}`;
}

export function timeAgo(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  if (d < 7) return `il y a ${d} j`;
  return formatDateShort(date);
}

export function formatDistanceKm(km: number) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1).replace(".0", "")} km`;
}

// Distance factice mais stable (dérivée d'un id) : pas de vraie géolocalisation
// dans cette version — juste de quoi donner un ordre de grandeur crédible.
export function pseudoDistanceKm(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return Math.round(((h % 780) / 100 + 0.2) * 10) / 10;
}
