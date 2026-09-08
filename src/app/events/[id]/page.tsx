import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { joinEventAction, leaveEventAction, cancelEventAction } from "@/lib/actions/events";
import { Badge, Button, Card } from "@/components/ui";
import { categoryEmoji, categoryLabels, eventLevelLabels, eventRecurrenceLabels, eventStatusLabels } from "@/lib/labels";
import { formatEventDate } from "@/lib/format";
import { MapPin, CalendarClock, Users, Repeat } from "lucide-react";

export default async function EventDetailPage({ params }: PageProps<"/events/[id]">) {
  const { id } = await params;
  const user = await getCurrentUser();

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      host: { select: { id: true, name: true, city: true } },
      participants: { include: { user: { select: { id: true, name: true } } }, orderBy: { joinedAt: "asc" } },
    },
  });

  if (!event) notFound();

  const isHost = user?.id === event.hostId;
  const isParticipant = user ? event.participants.some((p) => p.userId === user.id) : false;
  const full = event.maxParticipants !== null && event.participants.length >= event.maxParticipants;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="primary">
              {categoryEmoji[event.gameType]} {categoryLabels[event.gameType]}
            </Badge>
            <Badge variant="muted">{eventLevelLabels[event.level]}</Badge>
            {event.recurrence !== "ONE_OFF" && (
              <Badge variant="muted" className="gap-1">
                <Repeat className="size-3" />
                {eventRecurrenceLabels[event.recurrence]}
              </Badge>
            )}
            {event.status === "CANCELLED" && <Badge>{eventStatusLabels.CANCELLED}</Badge>}
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">{event.title}</h1>
          {event.gameName && <p className="text-sm text-muted-foreground">{event.gameName}</p>}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2 text-sm">
        <div className="flex items-center gap-2">
          <CalendarClock className="size-4 text-muted-foreground" />
          {formatEventDate(event.startAt)}
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="size-4 text-muted-foreground" />
          {event.location ? `${event.location}, ` : ""}
          {event.city}
        </div>
        <div className="flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" />
          {event.participants.length}
          {event.maxParticipants ? ` / ${event.maxParticipants}` : ""} participant
          {event.participants.length > 1 ? "s" : ""} · organisé par {event.host.name}
        </div>
      </div>

      {event.description && (
        <p className="mt-6 whitespace-pre-line text-sm text-foreground/90">{event.description}</p>
      )}

      <div className="mt-8">
        {event.status === "CANCELLED" ? (
          <Card className="p-4 text-sm text-muted-foreground">Cet événement a été annulé.</Card>
        ) : isHost ? (
          <form action={cancelEventAction.bind(null, event.id)}>
            <Button type="submit" variant="danger" size="sm">
              Annuler l&apos;événement
            </Button>
          </form>
        ) : user ? (
          isParticipant ? (
            <form action={leaveEventAction.bind(null, event.id)}>
              <Button type="submit" variant="secondary">
                Se désinscrire
              </Button>
            </form>
          ) : full ? (
            <Card className="p-4 text-sm text-muted-foreground">Cet événement est complet.</Card>
          ) : (
            <form action={joinEventAction.bind(null, event.id)}>
              <Button type="submit">Je participe</Button>
            </form>
          )
        ) : (
          <Card className="p-4 text-sm">
            <Link href="/login" className="font-medium text-primary hover:underline">
              Connecte-toi
            </Link>{" "}
            pour t&apos;inscrire.
          </Card>
        )}
      </div>

      <div className="mt-10">
        <h2 className="mb-3 text-lg font-medium">Participants ({event.participants.length})</h2>
        <div className="flex flex-col gap-2">
          {event.participants.map((p) => (
            <Card key={p.id} className="flex items-center justify-between p-3 text-sm">
              <span>{p.user.name}</span>
              {p.userId === event.hostId && <Badge variant="primary">Organisateur</Badge>}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
