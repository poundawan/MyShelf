import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { joinClubAction, leaveClubAction } from "@/lib/actions/clubs";
import { Avatar, Badge, Button, Card } from "@/components/ui";
import { EventCard } from "@/components/event-card";
import { pseudoDistanceKm, formatDistanceKm } from "@/lib/format";
import { getT, getLocale } from "@/lib/i18n/server";

export default async function ClubDetailPage({ params }: PageProps<"/clubs/[id]">) {
  const { id } = await params;
  const t = await getT();
  const locale = await getLocale();
  const user = await getCurrentUser();

  const club = await prisma.club.findUnique({
    where: { id },
    include: {
      memberships: { include: { user: true }, orderBy: { joinedAt: "asc" } },
      events: {
        where: { status: "ACTIVE", startAt: { gte: new Date() } },
        orderBy: { startAt: "asc" },
        include: { host: true, _count: { select: { participants: true } } },
      },
    },
  });
  if (!club) notFound();

  const isMember = user ? club.memberships.some((m) => m.userId === user.id) : false;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link href="/clubs" className="-my-2 inline-block py-2 text-xs font-bold uppercase tracking-widest text-gold hover:underline">
        {t("club.back")}
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl text-cream">{club.name}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {club.city} · {t("common.members", { count: club.memberships.length })} ·{" "}
            {formatDistanceKm(pseudoDistanceKm(club.id), t)}
          </p>
          {club.description && <p className="mt-3 max-w-prose text-sm text-ink-soft">{club.description}</p>}
        </div>

        {user ? (
          isMember ? (
            <form action={leaveClubAction.bind(null, club.id)}>
              <Button type="submit" variant="secondary">{t("club.leave")}</Button>
            </form>
          ) : (
            <form action={joinClubAction.bind(null, club.id)}>
              <Button type="submit">{t("club.join")}</Button>
            </form>
          )
        ) : (
          <Link href="/login" className="inline-block">
            <Button>{t("club.joinPrompt")}</Button>
          </Link>
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-[minmax(0,1fr)_260px]">
        <div>
          <h2 className="font-display text-lg text-cream">
            {club.events.length > 0 ? t("club.upcoming") : t("club.noUpcoming")}
          </h2>
          {club.events.length === 0 ? (
            <Card className="mt-3 p-6 text-sm text-ink-soft">
              {t("club.noUpcoming.desc")}
              {isMember && t("club.noUpcoming.invite")}
            </Card>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {club.events.map((event) => (
                <EventCard key={event.id} event={event} t={t} locale={locale} />
              ))}
            </div>
          )}

          {isMember && (
            <Link href="/events/new" className="mt-5 inline-block">
              <Button variant="secondary">{t("club.openTable")}</Button>
            </Link>
          )}
        </div>

        <div>
          <Card className="p-4">
            <h3 className="mb-3 text-sm font-bold text-cream">
              {t("club.members", { count: club.memberships.length })}
            </h3>
            <div className="flex flex-col gap-3">
              {club.memberships.map((m) => (
                <Link key={m.id} href={`/profile/${m.userId}`} className="flex items-center gap-2.5 hover:opacity-80">
                  <Avatar name={m.user.name} size={30} tone={m.user.verified ? "rust" : "wood"} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-cream">{m.user.name}</div>
                    <div className="text-xs text-ink-soft">{t(`level.${m.user.experienceLevel}`)}</div>
                  </div>
                  {m.userId === user?.id && <Badge variant="outline">{t("club.you")}</Badge>}
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
