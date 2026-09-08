import Link from "next/link";
import { Card, Badge } from "@/components/ui";
import { categoryEmoji, categoryLabels, eventLevelLabels } from "@/lib/labels";
import { formatEventDate } from "@/lib/format";
import { MapPin, Users, CalendarClock } from "lucide-react";

export type EventCardData = {
  id: string;
  title: string;
  gameType: string;
  gameName: string | null;
  level: string;
  city: string;
  startAt: Date;
  maxParticipants: number | null;
  host: { name: string };
  _count: { participants: number };
};

export function EventCard({ event }: { event: EventCardData }) {
  const full = event.maxParticipants !== null && event._count.participants >= event.maxParticipants;

  return (
    <Link href={`/events/${event.id}`}>
      <Card className="flex h-full flex-col gap-3 p-4 transition-shadow hover:shadow-md">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xl">{categoryEmoji[event.gameType]}</span>
            <div>
              <h3 className="font-medium leading-snug">{event.title}</h3>
              {event.gameName && <p className="text-xs text-muted-foreground">{event.gameName}</p>}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Badge variant="primary">{categoryLabels[event.gameType]}</Badge>
          <Badge variant="muted">{eventLevelLabels[event.level]}</Badge>
          {full && <Badge>Complet</Badge>}
        </div>

        <div className="mt-auto flex flex-col gap-1 pt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <CalendarClock className="size-3.5" />
            {formatEventDate(event.startAt)}
          </div>
          <div className="flex items-center gap-1">
            <MapPin className="size-3.5" />
            {event.city} · organisé par {event.host.name}
          </div>
          <div className="flex items-center gap-1">
            <Users className="size-3.5" />
            {event._count.participants}
            {event.maxParticipants ? ` / ${event.maxParticipants}` : ""} participant
            {event._count.participants > 1 ? "s" : ""}
          </div>
        </div>
      </Card>
    </Link>
  );
}
