import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Card, Badge, Button, Input } from "@/components/ui";
import { formatDistanceKm, formatEventDate } from "@/lib/format";
import { POSITION_COMMUNE, distanceDepuis, filtreRayonCommune } from "@/lib/proximite";
import { replierSeries } from "@/lib/recurrence";
import { eventTypes } from "@/lib/validation";
import { getT, getLocale } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

type ResultItem = {
  kind: "Table" | "Jeu" | "Carte" | "Club";
  level?: string;
  /** Cadence, pour une table qui revient. */
  recurrence?: string;
  title: string;
  meta: string;
  href: string;
  km: number | null;
};

const TYPES = [
  { value: "", key: "search.all" },
  { value: "Table", key: "search.kind.Table" },
  { value: "Jeu", key: "search.kind.Jeu" },
  { value: "Carte", key: "search.kind.Carte" },
  { value: "Club", key: "search.kind.Club" },
];
/**
 * Rayons proposés, en kilomètres.
 *
 * Les anciennes valeurs (2 à 15 km) étaient calibrées sur des distances
 * inventées, toutes tirées dans une fourchette étroite. Maintenant qu'elles
 * sont réelles, il faut de quoi couvrir une agglomération comme une région :
 * hors des grandes villes, le joueur le plus proche est rarement à 8 km.
 */
const RAYONS_KM = [5, 15, 25, 50, 100];
const RAYON_DEFAUT = 25;
/**
 * Valeur du filtre « partout ».
 *
 * Le plus grand rayon proposé restait une limite : au-delà de cent kilomètres,
 * un jeu rare ou une convention annuelle devenaient introuvables alors qu'ils
 * étaient bien là. « Partout » lève le plafond — et, avec lui, l'exigence
 * d'avoir une commune : les lignes qu'on ne sait pas situer cessent d'être
 * écartées et s'affichent en fin de liste, distance inconnue.
 */
const SANS_LIMITE = "0";

const LEVELS = [
  { value: "", key: "search.all" },
  { value: "BEGINNER", key: "level.BEGINNER" },
  { value: "INTERMEDIATE", key: "level.INTERMEDIATE" },
  { value: "CONFIRMED", key: "level.CONFIRMED" },
];

/** Nombre de tables ramenées avant repli des séries (cf. `replierSeries`). */
const TABLES_RAMENEES = 120;
const PAR_CATEGORIE = 20;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; level?: string; distance?: string; eventType?: string }>;
}) {
  const t = await getT();
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const {
    q = "",
    type = "",
    level = "",
    distance = String(RAYON_DEFAUT),
    eventType = "",
  } = await searchParams;

  // `Number(distance) || RAYON_DEFAUT` aurait avalé « partout » : zéro est
  // faux en JavaScript. Le cas se traite donc avant tout calcul.
  const maxKm = distance === SANS_LIMITE ? null : Number(distance) || RAYON_DEFAUT;
  const terme = q.trim().slice(0, 80);
  // Un type de table venu de l'URL n'est pas forcément un type de table.
  const typeTable = (eventTypes as readonly string[]).includes(eventType) ? eventType : "";

  /** Filtre textuel appliqué aux champs d'un type de résultat. */
  const commePartie = { contains: terme, mode: "insensitive" as const };

  // Sans commune sur son propre compte, aucune distance n'est calculable : on
  // montre alors tout, en le disant, plutôt que de filtrer sur du vide.
  const origine = user.commune;
  const prefiltre = origine && maxKm !== null ? filtreRayonCommune(origine, maxKm) : null;
  const rayon = prefiltre ?? {};
  const dansLeRayon = (km: number | null) =>
    maxKm === null || !origine || (km !== null && km <= maxKm);

  const results: ResultItem[] = [];

  // Choisir un type de table implique de ne chercher que des tables : c'est le
  // seul genre de résultat qui en ait un. D'où le `&& !typeTable` sur les trois
  // catégories suivantes.
  if (!type || type === "Table") {
    const seances = await prisma.event.findMany({
      where: {
        status: "ACTIVE", startAt: { gte: new Date() },
        ...(level ? { level: level as never } : {}),
        ...(typeTable ? { type: typeTable as never } : {}),
        ...(terme ? { OR: [{ title: commePartie }, { city: commePartie }, { location: commePartie }] } : {}),
        ...rayon,
      },
      include: { host: true, series: { select: { frequency: true } }, commune: POSITION_COMMUNE },
      orderBy: { startAt: "asc" },
      take: TABLES_RAMENEES,
    });
    // Une table récurrente ne compte que pour sa prochaine séance.
    for (const e of replierSeries(seances).slice(0, PAR_CATEGORIE)) {
      const km = distanceDepuis(origine, e);
      if (dansLeRayon(km)) results.push({
        kind: "Table", level: e.level, recurrence: e.series?.frequency,
        title: e.title, meta: `${formatEventDate(e.startAt, locale)} · ${e.location ?? e.city}`,
        href: `/events/${e.id}`, km,
      });
    }
  }
  if ((!type || type === "Jeu") && !typeTable) {
    const copies = await prisma.gameCopy.findMany({
      where: {
        status: "ON_TABLE", ownerId: { not: user.id },
        // Un seul objet `game` : deux clés du même nom se seraient écrasées,
        // et chercher un titre aurait silencieusement annulé le filtre de niveau.
        //
        // Le titre d'origine compte autant que celui choisi : c'est ce qui
        // permet de retrouver « Les Aventuriers du Rail » en tapant
        // « Ticket to Ride », et l'inverse.
        ...(level || terme
          ? {
              game: {
                ...(level ? { level: level as never } : {}),
                ...(terme ? { OR: [{ title: commePartie }, { titreOriginal: commePartie }] } : {}),
              },
            }
          : {}),
        ...(prefiltre ? { owner: prefiltre } : {}),
      },
      include: { game: true, owner: { include: { commune: POSITION_COMMUNE } } }, take: PAR_CATEGORIE,
    });
    for (const c of copies) {
      const km = distanceDepuis(origine, c.owner);
      if (dansLeRayon(km)) results.push({ kind: "Jeu", level: c.game.level ?? undefined, title: c.game.title, meta: t("search.meta.game", { name: c.owner.name }), href: `/games/${c.game.id}`, km });
    }
  }
  if ((!type || type === "Carte") && !typeTable) {
    const cardCopies = await prisma.cardCopy.findMany({
      where: {
        status: "ON_TABLE", ownerId: { not: user.id },
        ...(terme ? { card: { OR: [{ name: commePartie }, { setName: commePartie }] } } : {}),
        ...(prefiltre ? { owner: prefiltre } : {}),
      },
      include: { card: true, owner: { include: { commune: POSITION_COMMUNE } } }, take: PAR_CATEGORIE,
    });
    for (const c of cardCopies) {
      const km = distanceDepuis(origine, c.owner);
      if (dansLeRayon(km)) results.push({ kind: "Carte", title: c.card.name, meta: t("search.meta.card", { name: c.owner.name, set: c.card.setName ?? "" }), href: "/cards", km });
    }
  }
  if ((!type || type === "Club") && !typeTable) {
    const clubs = await prisma.club.findMany({
      where: { ...(terme ? { OR: [{ name: commePartie }, { city: commePartie }] } : {}), ...rayon },
      include: { _count: { select: { memberships: true } }, commune: POSITION_COMMUNE }, take: 10,
    });
    for (const club of clubs) {
      const km = distanceDepuis(origine, club);
      if (dansLeRayon(km)) results.push({ kind: "Club", title: club.name, meta: t("search.meta.club", { city: club.city, members: club._count.memberships }), href: `/clubs/${club.id}`, km });
    }
  }

  results.sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));

  /**
   * Lien vers la même recherche, un filtre changé.
   *
   * Les paramètres vides sont omis plutôt que laissés à blanc : une URL
   * partagée doit rester lisible, et `?q=&type=&level=` ne dit rien à personne.
   */
  const lien = (modifs: Record<string, string>) => {
    const params = new URLSearchParams({ q: terme, type, level, distance, eventType: typeTable, ...modifs });
    for (const [cle, valeur] of [...params.entries()]) if (!valeur) params.delete(cle);
    return `/search?${params.toString()}`;
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-[220px_minmax(0,1fr)]">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-gold">{t("search.eyebrow")}</div>
          <h1 className="mt-1 font-display text-3xl text-cream">{t("search.title")}</h1>
          <p className="mt-2 text-sm text-ink-soft">
            {!origine
              ? t("search.results.noCommune", { count: results.length })
              : maxKm === null
                ? t("search.results.anywhere", { count: results.length })
                : t("search.results", { count: results.length, km: maxKm })}
            {terme && ` · ${t("search.for", { terme })}`}
          </p>
          {!origine && (
            <p className="mt-2 text-sm text-gold">
              <Link href="/profile/edit" className="underline">{t("search.setCommune")}</Link>
            </p>
          )}

          <div className="mt-6 flex flex-col gap-6">
            {/* Formulaire en GET : la recherche reste dans l'URL, donc
                partageable et rechargeable, et les filtres la conservent. */}
            <form method="get" action="/search">
              <label htmlFor="q" className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-gold">
                {t("search.text")}
              </label>
              <div className="flex flex-wrap gap-2">
                <Input id="q" name="q" defaultValue={terme} placeholder={t("search.text.placeholder")} className="min-w-0 flex-1" />
                <Button type="submit" size="sm">{t("search.text.submit")}</Button>
              </div>
              <input type="hidden" name="type" value={type} />
              <input type="hidden" name="level" value={level} />
              <input type="hidden" name="distance" value={distance} />
              <input type="hidden" name="eventType" value={typeTable} />
            </form>

            <div>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gold">{t("search.type")}</div>
              <div className="flex flex-wrap gap-1.5">
                {TYPES.map((ty) => (
                  // Quitter les tables emporte le filtre de type de table : il
                  // n'aurait plus rien à filtrer, et resterait actif en douce.
                  <Link key={ty.value} href={lien({ type: ty.value, ...(ty.value === "Table" ? {} : { eventType: "" }) })}>
                    <Button type="button" size="sm" variant={type === ty.value ? "primary" : "secondary"}>{t(ty.key)}</Button>
                  </Link>
                ))}
              </div>
            </div>
            {(!type || type === "Table") && (
              <div>
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gold">{t("search.eventType")}</div>
                <div className="flex flex-wrap gap-1.5">
                  <Link href={lien({ eventType: "" })}>
                    <Button type="button" size="sm" variant={typeTable === "" ? "primary" : "secondary"}>{t("search.all")}</Button>
                  </Link>
                  {eventTypes.map((valeur) => (
                    <Link key={valeur} href={lien({ type: "Table", eventType: valeur })}>
                      <Button type="button" size="sm" variant={typeTable === valeur ? "primary" : "secondary"}>{t(`eventType.${valeur}`)}</Button>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            <div>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gold">{t("search.level")}</div>
              <div className="flex flex-wrap gap-1.5">
                {LEVELS.map((l) => (
                  <Link key={l.value} href={lien({ level: l.value })}>
                    <Button type="button" size="sm" variant={level === l.value ? "primary" : "secondary"}>{t(l.key)}</Button>
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gold">{t("search.distance")}</div>
              <div className="flex flex-wrap gap-1.5">
                {RAYONS_KM.map((km) => (
                  <Link key={km} href={lien({ distance: String(km) })}>
                    <Button type="button" size="sm" variant={maxKm === km ? "primary" : "secondary"}>{km} km</Button>
                  </Link>
                ))}
                <Link href={lien({ distance: SANS_LIMITE })}>
                  <Button type="button" size="sm" variant={maxKm === null ? "primary" : "secondary"}>{t("search.distance.anywhere")}</Button>
                </Link>
              </div>
              <div className="mt-1 text-xs text-ink-soft">
                {maxKm === null ? t("search.anywhere") : t("search.under", { km: maxKm })}
              </div>
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
                      {r.recurrence && <span className="text-ink-soft">{t(`recurrence.${r.recurrence}`)}</span>}
                    </div>
                    <div className="mt-0.5 truncate font-display text-base text-cream">{r.title}</div>
                    <div className="truncate text-xs text-ink-soft">{r.meta}</div>
                  </div>
                  <Badge variant="outline" className="flex-none">{formatDistanceKm(r.km, locale, t)}</Badge>
                </Card>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
