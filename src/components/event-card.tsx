import Link from "next/link";
import { Card, Badge } from "@/components/ui";
import { eventTypeLabels, eventTypeEmoji, playerLevelLabels } from "@/lib/labels";
import { formatEventDate } from "@/lib/format";

export type EventCardData = {
  id: string;
  title: string;
  type: string;
  level: string;
  city: string;
  startAt: Date;
  maxParticipants: number | null;
  host: { name: string };
  _count: { participants: number };
};

export function EventCard({ event }: { event: EventCardData }) {
  const full = event.maxParticipants !== null && event._count.participants >= event.maxParticipants;
  const placesLeft = event.maxParticipants ? event.maxParticipants - event._count.participants : null;

  return (
    <Link href={`/events/${event.id}`}>
      <Card className="flex h-full flex-col gap-2 p-4 transition-colors hover:border-gold/60">
        <div className="flex items-start justify-between gap-2">
          <span className="text-lg">{eventTypeEmoji[event.type]}</span>
          {full && <Badge variant="danger">Complet</Badge>}
        </div>
        <div className="font-display text-base leading-snug text-cream">{event.title}</div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="primary">{eventTypeLabels[event.type]}</Badge>
          <Badge variant="outline">{playerLevelLabels[event.level]}</Badge>
        </div>
        <div className="mt-auto flex flex-col gap-1 pt-2 text-xs text-ink-soft">
          <div>{formatEventDate(event.startAt)}</div>
          <div>{event.city} · {event.host.name}</div>
          {placesLeft !== null && !full && <div className="text-gold">{placesLeft} place{placesLeft > 1 ? "s" : ""} restante{placesLeft > 1 ? "s" : ""}</div>}
        </div>
      </Card>
    </Link>
  );
}
