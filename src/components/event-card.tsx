import Link from "next/link";
import { Card, Badge } from "@/components/ui";
import { eventTypeEmoji } from "@/lib/labels";
import { formatEventDate } from "@/lib/format";
import { LOCALE_NAMES, type Locale, type Translator } from "@/lib/i18n/types";

export type EventCardData = {
  id: string;
  title: string;
  type: string;
  level: string;
  city: string;
  startAt: Date;
  maxParticipants: number | null;
  languages?: string[];
  host: { name: string };
  _count: { participants: number };
};

export function EventCard({ event, t, locale }: { event: EventCardData; t: Translator; locale: Locale }) {
  const full = event.maxParticipants !== null && event._count.participants >= event.maxParticipants;
  const placesLeft = event.maxParticipants ? event.maxParticipants - event._count.participants : null;

  return (
    <Link href={`/events/${event.id}`}>
      <Card className="flex h-full flex-col gap-2 p-4 transition-colors hover:border-gold/60">
        <div className="flex items-start justify-between gap-2">
          <span className="text-lg">{eventTypeEmoji[event.type]}</span>
          {full && <Badge variant="danger">{t("events.full")}</Badge>}
        </div>
        <div className="font-display text-base leading-snug text-cream">{event.title}</div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="primary">{t(`eventType.${event.type}`)}</Badge>
          <Badge variant="outline">{t(`level.${event.level}`)}</Badge>
        </div>
        <div className="mt-auto flex flex-col gap-1 pt-2 text-xs text-ink-soft">
          <div>{formatEventDate(event.startAt, locale)}</div>
          <div>{event.city} · {event.host.name}</div>
          {event.languages && event.languages.length > 0 && (
            <div>{t("event.languages", { languages: event.languages.map((l) => LOCALE_NAMES[l as Locale]).join(" · ") })}</div>
          )}
          {placesLeft !== null && !full && <div className="text-gold">{t("common.placesLeft", { count: placesLeft })}</div>}
        </div>
      </Card>
    </Link>
  );
}
