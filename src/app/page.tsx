import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getT, getLocale } from "@/lib/i18n/server";
import { Button, Card, StatTile } from "@/components/ui";
import { gameCategoryEmoji, eventTypeEmoji } from "@/lib/labels";
import { formatDateShort, timeAgo, formatEventDate, pseudoDistanceKm, formatDistanceKm, daysSince } from "@/lib/format";

type FeedItem = {
  kind: "trade" | "event" | "cards";
  tab: "Tables" | "Échanges";
  href: string;
  title: string;
  meta: string;
  body: string;
  emoji: string;
  createdAt: Date;
};

export default async function HomePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const t = await getT();
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { tab = "Tout" } = await searchParams;

  const [pendingTrades, completedTrades, allUpcomingEvents, myClubMembership, incomingRequests, wantedAvailable] =
    await Promise.all([
      prisma.tradeProposal.count({ where: { toUserId: user.id, status: "PENDING" } }),
      prisma.tradeProposal.count({ where: { OR: [{ fromUserId: user.id }, { toUserId: user.id }], status: "COMPLETED" } }),
      prisma.event.findMany({ where: { status: "ACTIVE", startAt: { gte: new Date() } }, include: { host: true, _count: { select: { participants: true } } }, orderBy: { startAt: "asc" }, take: 6 }),
      prisma.clubMembership.findFirst({
        where: { userId: user.id },
        include: { club: { include: { _count: { select: { memberships: true } }, events: { where: { status: "ACTIVE", startAt: { gte: new Date() } }, orderBy: { startAt: "asc" }, take: 1 } } } },
      }),
      prisma.tradeProposal.findMany({
        where: { toUserId: user.id, status: "PENDING", kind: "GAME" },
        include: { fromUser: true, items: { include: { gameCopy: { include: { game: true } } } } },
        orderBy: { createdAt: "desc" }, take: 3,
      }),
      prisma.cardWant.findMany({
        where: { userId: user.id },
        include: { card: { include: { copies: { where: { status: "ON_TABLE", ownerId: { not: user.id } }, include: { owner: true } } } } },
      }),
    ]);

  const nearbyEvents = allUpcomingEvents.filter((e) => pseudoDistanceKm(e.id) < 2);

  const feed: FeedItem[] = [];
  for (const req of incomingRequests) {
    const targetItem = req.items.find((i) => i.offeredBy === "TO")?.gameCopy;
    if (!targetItem) continue;
    feed.push({
      kind: "trade", tab: "Échanges", href: `/trades/${req.id}`,
      title: t("home.feed.tradeWants", { name: req.fromUser.name, game: targetItem.game.title }),
      meta: `${formatDistanceKm(pseudoDistanceKm(req.id), t)} · ${timeAgo(req.createdAt, locale, t)}`,
      body: t("home.feed.tradeAnswer"),
      emoji: gameCategoryEmoji[targetItem.game.category], createdAt: req.createdAt,
    });
  }
  for (const ev of allUpcomingEvents.slice(0, 3)) {
    const places = ev.maxParticipants ? ev.maxParticipants - ev._count.participants : null;
    feed.push({
      kind: "event", tab: "Tables", href: `/events/${ev.id}`,
      title: ev.title,
      meta: `${formatEventDate(ev.startAt, locale)}${places !== null ? ` · ${places} place${places > 1 ? "s" : ""} restante${places > 1 ? "s" : ""}` : ""}`,
      body: ev.description?.slice(0, 140) ?? "",
      emoji: eventTypeEmoji[ev.type], createdAt: ev.createdAt,
    });
  }
  const wantsWithMatches = wantedAvailable.filter((w) => w.card.copies.length > 0);
  if (wantsWithMatches.length > 0) {
    const first = wantsWithMatches[0];
    const firstCopy = first.card.copies[0];
    feed.push({
      kind: "cards", tab: "Échanges", href: "/cards",
      title: t("home.feed.cardsAvailable", { count: wantsWithMatches.length }),
      meta: `${formatDistanceKm(pseudoDistanceKm(firstCopy.id), t)} · ${firstCopy.owner.name}`,
      body: first.card.setName
        ? t("home.feed.cardsBody", { set: first.card.setName, name: first.card.name })
        : t("home.feed.cardsBodyNoSet", { name: first.card.name }),
      emoji: "🃏", createdAt: first.createdAt,
    });
  }
  feed.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const visibleFeed = tab === "Tout" ? feed : feed.filter((f) => f.tab === tab);

  const joinedDays = daysSince(user.createdAt);
  const firstName = user.name.split(" ")[0];
  const club = myClubMembership?.club;
  const nextClubEvent = club?.events[0];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Card className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:p-8">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-gold">
            {t("home.eyebrow", { level: joinedDays, city: user.city, date: formatDateShort(new Date(), locale) })}
          </div>
          <h1 className="mt-2 font-display text-3xl leading-tight text-cream sm:text-[42px]">
            {t("home.greeting")}
            <br />
            {firstName}.
          </h1>
          <p className="mt-3 max-w-lg text-ink-soft">
            {pendingTrades > 0 ? t("home.summary.waiting", { count: pendingTrades }) : t("home.summary.none")}{" "}
            {nearbyEvents.length > 0 && t("home.summary.nearby", { count: nearbyEvents.length })}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/events/new"><Button>{t("home.openTable")}</Button></Link>
            <Link href="/trades"><Button variant="secondary">{t("home.answerTrades")}</Button></Link>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 self-center">
          {["bg-surface-2", "bg-gold", "bg-surface-2", "bg-surface-2", "bg-rust", "bg-wood", "bg-gold", "bg-surface-2", "bg-surface-2"].map((c, i) => (
            <div key={i} className={`size-14 rounded-sm ${c} ${i === 6 ? "flex items-center justify-center" : ""}`}>
              {i === 6 && <span className="rotate-45 text-gold-ink">◆</span>}
              {i === 4 && <span className="flex h-full items-center justify-center text-cream">●</span>}
            </div>
          ))}
        </div>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile value={pendingTrades} label={t("home.stat.pendingTrades")} />
        <StatTile value={nearbyEvents.length} label={t("home.stat.nearbyEvents")} />
        <StatTile value={completedTrades} label={t("home.stat.completedTrades")} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          <div className="flex gap-2">
            {(["Tout", "Tables", "Échanges"] as const).map((t) => (
              <Link key={t} href={`/?tab=${t}`}>
                <Button size="sm" variant={tab === t ? "primary" : "secondary"}>{t}</Button>
              </Link>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {visibleFeed.length === 0 ? (
              <Card className="p-8 text-center text-ink-soft">{t("home.feed.empty")}</Card>
            ) : (
              visibleFeed.map((item, i) => (
                <Link key={i} href={item.href}>
                  <Card className="flex items-center gap-4 p-4 transition-colors hover:border-gold/60">
                    <div className="flex size-14 flex-none items-center justify-center bg-surface-2 text-2xl">{item.emoji}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-gold">
                        <span>{t(`home.feed.${item.kind}`)}</span>
                        <span className="font-normal normal-case text-ink-soft">{item.meta}</span>
                      </div>
                      <div className="mt-0.5 font-display text-base text-cream">{item.title}</div>
                      {item.body && <p className="mt-0.5 truncate text-sm text-ink-soft">{item.body}</p>}
                    </div>
                    <span className="text-gold">→</span>
                  </Card>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base text-cream">{t("home.nearby")}</h3>
              <Link href="/search" className="-my-2 inline-block py-2 text-xs font-bold text-gold hover:underline">{t("home.nearby.map")}</Link>
            </div>
            <div className="relative mt-3 aspect-[4/3] overflow-hidden rounded-sm bg-surface-2">
              <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "linear-gradient(#8A5A34 2px, transparent 2px), linear-gradient(90deg, #8A5A34 2px, transparent 2px)", backgroundSize: "40% 2px, 2px 40%", backgroundPosition: "20% 0, 0 30%" }} />
              {[
                { label: club?.name ?? t("clubs.yours"), top: "18%", left: "14%" },
                { label: allUpcomingEvents[0]?.title.split(" ").slice(0, 2).join(" ") ?? "Une table", top: "24%", left: "62%" },
                { label: incomingRequests[0] ? `${incomingRequests[0].fromUser.name.split(" ")[0]}` : t("home.map.somePlayer"), top: "62%", left: "68%" },
              ].map((pin, i) => (
                <div key={i} className="absolute flex items-center gap-1.5" style={{ top: pin.top, left: pin.left }}>
                  <span className="text-gold">◆</span>
                  <span className="whitespace-nowrap rounded-sm bg-surface px-1.5 py-0.5 text-[10px] font-bold text-cream">{pin.label}</span>
                </div>
              ))}
              <span className="absolute bottom-1.5 right-2 text-[10px] text-ink-soft/60">{t("home.nearby.caption")}</span>
            </div>
          </Card>

          {club ? (
            <Card className="border-gold/40 bg-gold/10 p-4">
              <Link href={`/clubs/${club.id}`} className="font-display text-base text-cream hover:text-gold">
                {t("home.club.yours", { name: club.name })}
              </Link>
              <p className="mt-1.5 text-sm text-ink-soft">
                {t("home.club.summary", { members: club._count.memberships })}
                {nextClubEvent && t("home.club.nextTable", { when: formatEventDate(nextClubEvent.startAt, locale).toLowerCase() })}.
              </p>
              {nextClubEvent && (
                <Link href={`/events/${nextClubEvent.id}`} className="inline-block">
                  <Button size="sm" className="mt-3">{t("home.club.next")}</Button>
                </Link>
              )}
              <Link href="/clubs" className="-my-2 mt-3 inline-block py-2 text-xs font-bold text-gold hover:underline">
                {t("home.club.all")}
              </Link>
            </Card>
          ) : (
            <Card className="p-4">
              <h3 className="font-display text-base text-cream">{t("home.club.none")}</h3>
              <p className="mt-1.5 text-sm text-ink-soft">{t("home.club.none.lede")}</p>
              <Link href="/clubs" className="inline-block">
                <Button size="sm" variant="secondary" className="mt-3">{t("home.club.discover")}</Button>
              </Link>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
