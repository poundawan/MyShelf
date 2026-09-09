import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Card, Badge, Button } from "@/components/ui";
import { pseudoDistanceKm, formatDistanceKm, formatEventDate } from "@/lib/format";
import { playerLevelLabels } from "@/lib/labels";
import { cn } from "@/lib/utils";

type ResultItem = { kind: "Table" | "Jeu" | "Carte" | "Club"; level?: string; title: string; meta: string; href: string; km: number };

const TYPES = [
  { value: "", label: "Tout" },
  { value: "Table", label: "Table" },
  { value: "Jeu", label: "Jeu" },
  { value: "Carte", label: "Carte" },
  { value: "Club", label: "Club" },
];
const LEVELS = [
  { value: "", label: "Tout" },
  { value: "BEGINNER", label: "Débutant" },
  { value: "INTERMEDIATE", label: "Intermédiaire" },
  { value: "CONFIRMED", label: "Confirmé" },
];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; level?: string; distance?: string }>;
}) {
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
      if (km <= maxKm) results.push({ kind: "Table", level: e.level, title: e.title, meta: `${formatEventDate(e.startAt)} · ${e.location ?? e.city}`, href: `/events/${e.id}`, km });
    }
  }
  if (!type || type === "Jeu") {
    const copies = await prisma.gameCopy.findMany({
      where: { status: "ON_TABLE", ownerId: { not: user.id }, ...(level ? { game: { level: level as never } } : {}) },
      include: { game: true, owner: true }, take: 20,
    });
    for (const c of copies) {
      const km = pseudoDistanceKm(c.id);
      if (km <= maxKm) results.push({ kind: "Jeu", level: c.game.level ?? undefined, title: c.game.title, meta: `Chez ${c.owner.name} · sur la table d'échange`, href: `/games/${c.game.id}`, km });
    }
  }
  if (!type || type === "Carte") {
    const cardCopies = await prisma.cardCopy.findMany({
      where: { status: "ON_TABLE", ownerId: { not: user.id } },
      include: { card: true, owner: true }, take: 20,
    });
    for (const c of cardCopies) {
      const km = pseudoDistanceKm(c.id);
      if (km <= maxKm) results.push({ kind: "Carte", title: c.card.name, meta: `Chez ${c.owner.name} · ${c.card.setName ?? ""}`, href: "/cards", km });
    }
  }
  if (!type || type === "Club") {
    const clubs = await prisma.club.findMany({ include: { _count: { select: { memberships: true } } }, take: 10 });
    for (const club of clubs) {
      const km = pseudoDistanceKm(club.id);
      if (km <= maxKm) results.push({ kind: "Club", title: club.name, meta: `${club.city} · ${club._count.memberships} membres`, href: "/", km });
    }
  }

  results.sort((a, b) => a.km - b.km);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-[220px_1fr]">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-gold">Exploration du plateau</div>
          <h1 className="mt-1 font-display text-3xl text-cream">Recherche</h1>
          <p className="mt-2 text-sm text-ink-soft">
            {results.length} résultat{results.length > 1 ? "s" : ""} dans un rayon de {maxKm} km
          </p>

          <div className="mt-6 flex flex-col gap-6">
            <div>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gold">Type</div>
              <div className="flex flex-wrap gap-1.5">
                {TYPES.map((t) => (
                  <Link key={t.value} href={`/search?${new URLSearchParams({ type: t.value, level, distance }).toString()}`}>
                    <Button type="button" size="sm" variant={type === t.value ? "primary" : "secondary"}>{t.label}</Button>
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gold">Niveau</div>
              <div className="flex flex-wrap gap-1.5">
                {LEVELS.map((l) => (
                  <Link key={l.value} href={`/search?${new URLSearchParams({ type, level: l.value, distance }).toString()}`}>
                    <Button type="button" size="sm" variant={level === l.value ? "primary" : "secondary"}>{l.label}</Button>
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gold">Distance</div>
              <div className="flex flex-wrap gap-1.5">
                {[2, 5, 8, 15].map((km) => (
                  <Link key={km} href={`/search?${new URLSearchParams({ type, level, distance: String(km) }).toString()}`}>
                    <Button type="button" size="sm" variant={maxKm === km ? "primary" : "secondary"}>{km} km</Button>
                  </Link>
                ))}
              </div>
              <div className="mt-1 text-xs text-ink-soft">Moins de {maxKm} km</div>
            </div>
            <Link href="/search"><Button variant="secondary">Tout réinitialiser</Button></Link>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {results.length === 0 ? (
            <Card className="p-8 text-center text-ink-soft">Aucun résultat pour ces filtres.</Card>
          ) : (
            results.map((r, i) => (
              <Link key={i} href={r.href}>
                <Card className="flex items-center justify-between gap-3 p-4 transition-colors hover:border-gold/60">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-gold">
                      <span>{r.kind}</span>
                      {r.level && <span className={cn("text-ink-soft")}>{playerLevelLabels[r.level]}</span>}
                    </div>
                    <div className="mt-0.5 truncate font-display text-base text-cream">{r.title}</div>
                    <div className="truncate text-xs text-ink-soft">{r.meta}</div>
                  </div>
                  <Badge variant="outline" className="flex-none">{formatDistanceKm(r.km)}</Badge>
                </Card>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
