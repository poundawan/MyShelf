import { BCP47, type Locale, type Translator } from "@/lib/i18n/types";

export function daysSince(date: Date) {
  return Math.max(1, Math.floor((Date.now() - date.getTime()) / 86_400_000) + 1);
}

export function formatDateShort(date: Date, locale: Locale) {
  return new Intl.DateTimeFormat(BCP47[locale], {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

export function formatEventDate(date: Date, locale: Locale) {
  return new Intl.DateTimeFormat(BCP47[locale], {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(date);
}

export function formatEventRange(start: Date, end: Date | null, locale: Locale) {
  if (!end) return formatEventDate(start, locale);
  const sameDay = start.toDateString() === end.toDateString();
  const startStr = formatEventDate(start, locale);
  const endStr = sameDay
    ? new Intl.DateTimeFormat(BCP47[locale], { hour: "2-digit", minute: "2-digit" }).format(end)
    : formatEventDate(end, locale);
  return `${startStr} → ${endStr}`;
}

export function formatMonthYear(date: Date, locale: Locale) {
  return new Intl.DateTimeFormat(BCP47[locale], { month: "long", year: "numeric" }).format(date);
}

export function formatFullDate(date: Date, locale: Locale) {
  return new Intl.DateTimeFormat(BCP47[locale], {
    day: "numeric", month: "long", year: "numeric",
  }).format(date);
}

export function timeAgo(date: Date, locale: Locale, t: Translator) {
  const diffMs = Date.now() - date.getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return t("time.now");
  if (min < 60) return t("time.minutes", { count: min });
  const h = Math.round(min / 60);
  if (h < 24) return t("time.hours", { count: h });
  const d = Math.round(h / 24);
  if (d < 7) return t("time.days", { count: d });
  return formatDateShort(date, locale);
}

export function formatDistanceKm(km: number, t: Translator) {
  if (km < 1) return t("common.metres", { value: Math.round(km * 1000) });
  return t("common.km", { value: km.toFixed(1).replace(".0", "") });
}

// Distance factice mais stable (dérivée d'un id) : pas de vraie géolocalisation
// dans cette version — juste de quoi donner un ordre de grandeur crédible.
export function pseudoDistanceKm(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return Math.round(((h % 780) / 100 + 0.2) * 10) / 10;
}
