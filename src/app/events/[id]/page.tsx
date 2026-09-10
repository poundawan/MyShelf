import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { joinEventAction, leaveEventAction, cancelEventAction } from "@/lib/actions/events";
import { startConversationAction } from "@/lib/actions/messages";
import { createEventReviewAction } from "@/lib/actions/reviews";
import { Badge, Button, Avatar, Card, Stars } from "@/components/ui";
import { eventTypeLabels, playerLevelLabels } from "@/lib/labels";
import { formatEventRange } from "@/lib/format";
import { ReviewForm } from "@/components/review-form";

export default async function EventDetailPage({ params }: PageProps<"/events/[id]">) {
  const { id } = await params;
  const user = await getCurrentUser();

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      host: true,
      club: true,
      participants: { include: { user: true }, orderBy: { joinedAt: "asc" } },
    },
  });
  if (!event) notFound();

  const isHost = user?.id === event.hostId;
  const isParticipant = user ? event.participants.some((p) => p.userId === user.id) : false;
  const myReview =
    user && isParticipant && !isHost
      ? await prisma.review.findUnique({ where: { fromUserId_eventId: { fromUserId: user.id, eventId: event.id } } })
      : null;
  const full = event.maxParticipants !== null && event.participants.length >= event.maxParticipants;
  const placesLeft = event.maxParticipants ? event.maxParticipants - event.participants.length : null;
  const hostLabel = event.type === "ROLE_PLAYING" ? "Maître de jeu" : "Organisé par";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex aspect-[16/5] items-center justify-center bg-surface-2 text-xs uppercase tracking-widest text-ink-soft/40">
        {event.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.photoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          "photo de la salle"
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="primary">{eventTypeLabels[event.type]}</Badge>
            <Badge variant="outline">{playerLevelLabels[event.level]}</Badge>
            {event.status === "CANCELLED" && <Badge variant="danger">Annulée</Badge>}
          </div>
          <h1 className="mt-3 font-display text-3xl text-cream">{event.title}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {formatEventRange(event.startAt, event.endAt)} · {event.location ? `${event.location}` : event.city}
          </p>
        </div>
        <div className="w-full sm:w-auto sm:text-right">
          <div className="text-sm text-ink-soft">
            {event.participants.length}{event.maxParticipants ? ` / ${event.maxParticipants}` : ""} inscrits
            {placesLeft !== null && placesLeft > 0 && ` · ${placesLeft} place${placesLeft > 1 ? "s" : ""}`}
          </div>
          <div className="mt-2">
            {event.status === "CANCELLED" ? (
              <span className="text-sm text-ink-soft">Événement annulé</span>
            ) : isHost ? (
              <form action={cancelEventAction.bind(null, event.id)}>
                <Button type="submit" variant="danger" size="sm">Annuler l&apos;événement</Button>
              </form>
            ) : isParticipant ? (
              <form action={leaveEventAction.bind(null, event.id)}>
                <Button type="submit" variant="secondary" size="sm">Se désinscrire</Button>
              </form>
            ) : full ? (
              <Button size="sm" disabled>Complet</Button>
            ) : user ? (
              <form action={joinEventAction.bind(null, event.id)}>
                <Button type="submit">Je réserve une place</Button>
              </form>
            ) : (
              <Link href="/login"><Button size="sm">Connexion</Button></Link>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-[minmax(0,1fr)_260px]">
        <div>
          {event.description && (
            <>
              <h2 className="font-display text-lg text-cream">Au programme</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-soft">{event.description}</p>
            </>
          )}

          <h2 className="mt-8 font-display text-lg text-cream">{hostLabel}</h2>
          <Card className="mt-3 flex items-center gap-3 p-4">
            <Avatar name={event.host.name} tone="gold" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-cream">{event.host.name}</div>
              <div className="text-xs text-ink-soft">
                {event.host.verified ? "identité vérifiée" : "membre"}
                {event.club && ` · ${event.club.name}`}
              </div>
            </div>
            {user && user.id !== event.hostId && (
              <form action={startConversationAction.bind(null, event.hostId)}>
                <Button type="submit" variant="secondary" size="sm">Écrire</Button>
              </form>
            )}
          </Card>

          {isParticipant && !isHost && (
            <Card className="mt-6 p-4">
              {myReview ? (
                <div>
                  <p className="mb-1 text-sm font-bold text-cream">Ton avis sur {event.host.name.split(" ")[0]}</p>
                  <Stars rating={myReview.rating} />
                  <p className="mt-2 text-sm text-ink-soft">{myReview.comment}</p>
                </div>
              ) : (
                <ReviewForm
                  action={createEventReviewAction}
                  hiddenField="eventId"
                  hiddenValue={event.id}
                  title={`Comment s'est passée la table avec ${event.host.name} ?`}
                />
              )}
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Card className="p-4">
            <h3 className="mb-3 text-sm font-bold text-cream">À la table ({event.participants.length})</h3>
            <div className="flex flex-col gap-3">
              {event.participants.map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <Avatar name={p.user.name} size={30} tone={p.userId === event.hostId ? "gold" : "wood"} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-cream">{p.user.name}</div>
                    <div className="text-xs text-ink-soft">
                      {p.userId === event.hostId ? `${hostLabel === "Maître de jeu" ? "MJ" : "Hôte"} · ` : ""}
                      {playerLevelLabels[p.user.experienceLevel]}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          {event.bringList && (
            <Card className="border-wood bg-wood/20 p-4">
              <h3 className="mb-1 text-sm font-bold text-cream">À apporter</h3>
              <p className="text-sm text-ink-soft">{event.bringList}</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
