import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Card, Badge, Button } from "@/components/ui";
import { pseudoDistanceKm, formatDistanceKm, formatEventDate } from "@/lib/format";
import { getT, getLocale } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

type ResultItem = { kind: "Table" | "Jeu" | "Carte" | "Club"; level?: string; title: string; meta: string; href: string; km: number };

const TYPES = [
  { value: "", key: "search.all" },
  { value: "Table", key: "search.kind.Table" },
  { value: "Jeu", key: "search.kind.Jeu" },
  { value: "Carte", key: "search.kind.Carte" },
  { value: "Club", key: "search.kind.Club" },
];
const LEVELS = [
  { value: "", key: "search.all" },
  { value: "BEGINNER", key: "level.BEGINNER" },
  { value: "INTERMEDIATE", key: "level.INTERMEDIATE" },
  { value: "CONFIRMED", key: "level.CONFIRMED" },
];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; level?: string; distance?: string }>;
}) {
  const t = await getT();
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { type = "", level = "", distance = "8" } = await searchParams;
  const maxKm = Number(distance) || 8;

  const results: ResultItem[] = [];

  if (!type || type === "Table") {
    const events = await prisma.event.findMany({
      where: { status: "ACTIVE", startAt: { gte: new Date() }, ...(level ? { level: level as never } : {}) },
      include: { host: true }, take: 20,
    });
    for (const e of events) {
      const km = pseudoDistanceKm(e.id);
      if (km <= maxKm) results.push({ kind: "Table", level: e.level, title: e.title, meta: `${formatEventDate(e.startAt, locale)} · ${e.location ?? e.city}`, href: `/events/${e.id}`, km });
    }
  }
  if (!type || type === "Jeu") {
    const copies = await prisma.gameCopy.findMany({
      where: { status: "ON_TABLE", ownerId: { not: user.id }, ...(level ? { game: { level: level as never } } : {}) },
      include: { game: true, owner: true }, take: 20,
    });
    for (const c of copies) {
      const km = pseudoDistanceKm(c.id);
      if (km <= maxKm) results.push({ kind: "Jeu", level: c.game.level ?? undefined, title: c.game.title, meta: t("search.meta.game", { name: c.owner.name }), href: `/games/${c.game.id}`, km });
    }
  }
  if (!type || type === "Carte") {
    const cardCopies = await prisma.cardCopy.findMany({
      where: { status: "ON_TABLE", ownerId: { not: user.id } },
      include: { card: true, owner: true }, take: 20,
    });
    for (const c of cardCopies) {
      const km = pseudoDistanceKm(c.id);
      if (km <= maxKm) results.push({ kind: "Carte", title: c.card.name, meta: t("search.meta.card", { name: c.owner.name, set: c.card.setName ?? "" }), href: "/cards", km });
    }
  }
  if (!type || type === "Club") {
    const clubs = await prisma.club.findMany({ include: { _count: { select: { memberships: true } } }, take: 10 });
    for (const club of clubs) {
      const km = pseudoDistanceKm(club.id);
      if (km <= maxKm) results.push({ kind: "Club", title: club.name, meta: t("search.meta.club", { city: club.city, members: club._count.memberships }), href: `/clubs/${club.id}`, km });
    }
  }

  results.sort((a, b) => a.km - b.km);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-[220px_minmax(0,1fr)]">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-gold">{t("search.eyebrow")}</div>
          <h1 className="mt-1 font-display text-3xl text-cream">{t("search.title")}</h1>
          <p className="mt-2 text-sm text-ink-soft">
            {t("search.results", { count: results.length, km: maxKm })}
          </p>

          <div className="mt-6 flex flex-col gap-6">
            <div>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gold">{t("search.type")}</div>
              <div className="flex flex-wrap gap-1.5">
                {TYPES.map((ty) => (
                  <Link key={ty.value} href={`/search?${new URLSearchParams({ type: ty.value, level, distance }).toString()}`}>
                    <Button type="button" size="sm" variant={type === ty.value ? "primary" : "secondary"}>{t(ty.key)}</Button>
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gold">{t("search.level")}</div>
              <div className="flex flex-wrap gap-1.5">
                {LEVELS.map((l) => (
                  <Link key={l.value} href={`/search?${new URLSearchParams({ type, level: l.value, distance }).toString()}`}>
                    <Button type="button" size="sm" variant={level === l.value ? "primary" : "secondary"}>{t(l.key)}</Button>
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gold">{t("search.distance")}</div>
              <div className="flex flex-wrap gap-1.5">
                {[2, 5, 8, 15].map((km) => (
                  <Link key={km} href={`/search?${new URLSearchParams({ type, level, distance: String(km) }).toString()}`}>
                    <Button type="button" size="sm" variant={maxKm === km ? "primary" : "secondary"}>{km} km</Button>
                  </Link>
                ))}
              </div>
              <div className="mt-1 text-xs text-ink-soft">{t("search.under", { km: maxKm })}</div>
            </div>
            <Link href="/search"><Button variant="secondary">{t("search.reset")}</Button></Link>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {results.length === 0 ? (
            <Card className="p-8 text-center text-ink-soft">{t("search.empty")}</Card>
          ) : (
            results.map((r, i) => (
              <Link key={i} href={r.href}>
                <Card className="flex items-center justify-between gap-3 p-4 transition-colors hover:border-gold/60">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-gold">
                      <span>{t(`search.kind.${r.kind}`)}</span>
                      {r.level && <span className={cn("text-ink-soft")}>{t(`level.${r.level}`)}</span>}
                    </div>
                    <div className="mt-0.5 truncate font-display text-base text-cream">{r.title}</div>
                    <div className="truncate text-xs text-ink-soft">{r.meta}</div>
                  </div>
                  <Badge variant="outline" className="flex-none">{formatDistanceKm(r.km, t)}</Badge>
                </Card>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
