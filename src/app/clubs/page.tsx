import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Avatar, Badge, Card } from "@/components/ui";
import { pseudoDistanceKm, formatDistanceKm } from "@/lib/format";

export default async function ClubsPage() {
  const user = await getCurrentUser();

  const clubs = await prisma.club.findMany({
    include: {
      _count: { select: { memberships: true } },
      memberships: { include: { user: true }, take: 4, orderBy: { joinedAt: "asc" } },
      events: {
        where: { status: "ACTIVE", startAt: { gte: new Date() } },
        orderBy: { startAt: "asc" },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
  });

  const myClubIds = user
    ? new Set(
        (await prisma.clubMembership.findMany({ where: { userId: user.id }, select: { clubId: true } })).map(
          (m) => m.clubId,
        ),
      )
    : new Set<string>();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="text-xs font-bold uppercase tracking-widest text-gold">Autour de la table</div>
      <h1 className="mt-1 font-display text-3xl text-cream sm:text-4xl">Clubs</h1>
      <p className="mt-2 text-ink-soft">
        Des groupes qui se retrouvent régulièrement. Rejoins-en un pour voir leurs tables en premier.
      </p>

      {clubs.length === 0 ? (
        <Card className="mt-8 p-8 text-center text-sm text-ink-soft">
          Aucun club pour l&apos;instant.
        </Card>
      ) : (
        <div className="mt-8 flex flex-col gap-3">
          {clubs.map((club) => {
            const nextEvent = club.events[0];
            return (
              <Link key={club.id} href={`/clubs/${club.id}`}>
                <Card className="flex flex-wrap items-center gap-4 p-4 transition-colors hover:border-gold/60">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-lg text-cream">{club.name}</span>
                      {myClubIds.has(club.id) && <Badge variant="primary">Ton club</Badge>}
                    </div>
                    <div className="mt-1 text-xs text-ink-soft">
                      {club.city} · {club._count.memberships} membre{club._count.memberships > 1 ? "s" : ""} ·{" "}
                      {formatDistanceKm(pseudoDistanceKm(club.id))}
                    </div>
                    {nextEvent && (
                      <div className="mt-1.5 text-xs text-gold">Prochaine table : {nextEvent.title}</div>
                    )}
                  </div>
                  <div className="flex flex-none -space-x-2">
                    {club.memberships.map((m) => (
                      <Avatar key={m.id} name={m.user.name} size={30} tone={m.user.verified ? "rust" : "wood"} />
                    ))}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
