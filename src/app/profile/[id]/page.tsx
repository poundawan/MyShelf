import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Avatar, Badge, Card, StatTile, LevelBar, Stars, Button } from "@/components/ui";
import { computeLevel, levelThresholds } from "@/lib/labels";
import { startConversationAction } from "@/lib/actions/messages";

export default async function ProfilePage({ params }: PageProps<"/profile/[id]">) {
  const { id } = await params;
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
    profileUser.verified && { title: "Identité vérifiée", desc: "Pièce d'identité contrôlée une fois, jamais stockée." },
    completedTrades > 0 && { title: `${completedTrades} échange${completedTrades > 1 ? "s" : ""}`, desc: "Tous menés en face à face, aucun litige." },
    hostedEvents > 0 && { title: "Hôtesse de table", desc: `${hostedEvents} table${hostedEvents > 1 ? "s" : ""} ouverte${hostedEvents > 1 ? "s" : ""}${avgRating ? `, note moyenne ${avgRating.toFixed(1).replace(".", ",")}` : ""}.` },
    beginnerEventParticipants > 0 && { title: "Accueille les débutants", desc: `Signalée par ${beginnerEventParticipants} joueur${beginnerEventParticipants > 1 ? "s" : ""} comme pédagogue.` },
  ].filter((b): b is { title: string; desc: string } => Boolean(b));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex items-start gap-4">
          <Avatar name={profileUser.name} size={72} tone={profileUser.verified ? "rust" : "gold"} />
          <div>
            <h1 className="font-display text-3xl text-cream">{profileUser.name}</h1>
            <p className="mt-1 text-sm text-ink-soft">
              {profileUser.city} · membre depuis {new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(profileUser.createdAt)} · {completedTrades} échange{completedTrades > 1 ? "s" : ""} en face à face
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {profileUser.verified && <Badge variant="primary">Identité vérifiée</Badge>}
              <Badge variant="outline">Membre fiable · Niv. {level}</Badge>
            </div>
          </div>
        </div>
        {!isSelf && viewer && (
          <form action={startConversationAction.bind(null, profileUser.id)}>
            <Button type="submit" variant="secondary">Écrire</Button>
          </form>
        )}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <StatTile value={avgRating ? avgRating.toFixed(1).replace(".", ",") : "—"} label="note moyenne" />
        <StatTile value={completedTrades} label="échanges" />
        <StatTile value={hostedEvents} label="tables ouvertes" />
      </div>

      <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-[1fr_280px]">
        <div>
          <h2 className="font-display text-lg text-cream">Ce qu&apos;on dit de moi</h2>
          {reviews.length === 0 ? (
            <Card className="mt-4 p-6 text-sm text-ink-soft">Pas encore d&apos;avis.</Card>
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
            <h3 className="mb-3 text-sm font-bold text-cream">Jetons gagnés</h3>
            {badges.length === 0 ? (
              <p className="text-sm text-ink-soft">Encore aucun jeton.</p>
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
              Niveau {level} dans {next ? next - completedInteractions : 0} échange{next && next - completedInteractions > 1 ? "s" : ""}
            </h3>
            <LevelBar progress={computeLevel(completedInteractions).progress} />
            {next && (
              <p className="mt-3 text-sm text-ink-soft">
                Le niveau {level + 1} débloque l&apos;organisation de tables à plus de {(levelThresholds[level] ?? 20) * 3} places.
              </p>
            )}
            {gameCopiesOnTable > 0 && isSelf && (
              <p className="mt-2 text-xs text-ink-soft">{gameCopiesOnTable} jeu{gameCopiesOnTable > 1 ? "x" : ""} sur ta table en ce moment.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
