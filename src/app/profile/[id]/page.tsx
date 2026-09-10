import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import Link from "next/link";
import { Avatar, Badge, Card, StatTile, LevelBar, Stars, Button } from "@/components/ui";
import { computeLevel, levelThresholds } from "@/lib/labels";
import { getT, getLocale } from "@/lib/i18n/server";
import { formatMonthYear } from "@/lib/format";
import { startConversationAction } from "@/lib/actions/messages";

export default async function ProfilePage({ params }: PageProps<"/profile/[id]">) {
  const { id } = await params;
  const t = await getT();
  const locale = await getLocale();
  const viewer = await getCurrentUser();

  const profileUser = await prisma.user.findUnique({ where: { id } });
  if (!profileUser) notFound();

  const [completedTrades, hostedEvents, reviews, beginnerEventParticipants, gameCopiesOnTable] = await Promise.all([
    prisma.tradeProposal.count({ where: { OR: [{ fromUserId: id }, { toUserId: id }], status: "COMPLETED" } }),
    prisma.event.count({ where: { hostId: id } }),
    prisma.review.findMany({ where: { toUserId: id }, include: { fromUser: true }, orderBy: { createdAt: "desc" } }),
    prisma.eventParticipant.count({ where: { event: { hostId: id, level: "BEGINNER" }, userId: { not: id } } }),
    prisma.gameCopy.count({ where: { ownerId: id, status: "ON_TABLE" } }),
  ]);

  const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;
  const { level, next, completedInteractions } = computeLevel(completedTrades + hostedEvents);
  const isSelf = viewer?.id === id;

  const badges = [
    profileUser.verified && { title: t("profile.badge.verified"), desc: t("profile.badge.verified.desc") },
    completedTrades > 0 && {
      title: t("profile.badge.trades", { count: completedTrades }),
      desc: t("profile.badge.trades.desc"),
    },
    hostedEvents > 0 && {
      title: t("profile.badge.host"),
      desc: t("profile.badge.host.desc", {
        count: hostedEvents,
        rating: avgRating ? t("profile.badge.host.rating", { rating: avgRating.toFixed(1) }) : "",
      }),
    },
    beginnerEventParticipants > 0 && {
      title: t("profile.badge.beginners"),
      desc: t("profile.badge.beginners.desc", { count: beginnerEventParticipants }),
    },
  ].filter((b): b is { title: string; desc: string } => Boolean(b));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-6">
        {/* Sur mobile l'avatar reste sur la ligne du nom, mais les métadonnées
            et les badges reprennent toute la largeur pour rester lisibles. */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-4">
            <Avatar name={profileUser.name} size={72} tone={profileUser.verified ? "rust" : "gold"} />
            <h1 className="min-w-0 font-display text-2xl text-cream sm:text-3xl">{profileUser.name}</h1>
          </div>
          <p className="mt-3 text-sm text-ink-soft">
            {t("profile.memberSince", {
              city: profileUser.city,
              date: formatMonthYear(profileUser.createdAt, locale),
              trades: t("common.trades", { count: completedTrades }),
            })}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {profileUser.verified && <Badge variant="primary">{t("profile.verified")}</Badge>}
            <Badge variant="outline">{t("profile.reliable", { level })}</Badge>
            <Badge variant="outline">{t(`level.${profileUser.experienceLevel}`)}</Badge>
          </div>
          {profileUser.bio && <p className="mt-3 max-w-md text-sm text-ink-soft">{profileUser.bio}</p>}
        </div>
        {isSelf ? (
          <Link href="/profile/edit">
            <Button variant="secondary">{t("profile.edit")}</Button>
          </Link>
        ) : (
          viewer && (
            <form action={startConversationAction.bind(null, profileUser.id)}>
              <Button type="submit" variant="secondary">{t("common.write")}</Button>
            </form>
          )
        )}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <StatTile value={avgRating ? avgRating.toFixed(1).replace(".", ",") : "—"} label={t("profile.stat.rating")} />
        <StatTile value={completedTrades} label={t("profile.stat.trades")} />
        <StatTile value={hostedEvents} label={t("profile.stat.events")} />
      </div>

      <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          <h2 className="font-display text-lg text-cream">{t("profile.reviews")}</h2>
          {reviews.length === 0 ? (
            <Card className="mt-4 p-6 text-sm text-ink-soft">{t("profile.reviews.empty")}</Card>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              {reviews.map((r) => (
                <Card key={r.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={r.fromUser.name} size={32} tone="wood" />
                      <div>
                        <div className="text-sm font-semibold text-cream">{r.fromUser.name}</div>
                        <div className="text-xs text-ink-soft">{r.context}</div>
                      </div>
                    </div>
                    <Stars rating={r.rating} />
                  </div>
                  <p className="mt-3 text-sm text-ink-soft">{r.comment}</p>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Card className="p-4">
            <h3 className="mb-3 text-sm font-bold text-cream">{t("profile.badges")}</h3>
            {badges.length === 0 ? (
              <p className="text-sm text-ink-soft">{t("profile.badges.empty")}</p>
            ) : (
              <div className="flex flex-col gap-3">
                {badges.map((b) => (
                  <div key={b.title} className="flex items-start gap-2.5">
                    <span className="mt-0.5 text-gold">◆</span>
                    <div>
                      <div className="text-sm font-semibold text-cream">{b.title}</div>
                      <div className="text-xs text-ink-soft">{b.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="border-gold/40 bg-gold/10 p-4">
            <h3 className="mb-2 text-sm font-bold text-cream">
              {t("profile.level.next", { level, remaining: next ? next - completedInteractions : 0, count: next ? next - completedInteractions : 0 })}
            </h3>
            <LevelBar progress={computeLevel(completedInteractions).progress} />
            {next && (
              <p className="mt-3 text-sm text-ink-soft">
                {t("profile.level.unlock", { next: level + 1, places: (levelThresholds[level] ?? 20) * 3 })}
              </p>
            )}
            {gameCopiesOnTable > 0 && isSelf && (
              <p className="mt-2 text-xs text-ink-soft">{t("profile.onTable", { count: gameCopiesOnTable })}</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
