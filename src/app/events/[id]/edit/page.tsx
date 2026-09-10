import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { updateEventAction } from "@/lib/actions/events";
import { EventForm } from "@/components/event-form";

/** Format attendu par un `<input type="datetime-local">`. */
function toLocalInput(date: Date | null) {
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default async function EditEventPage({ params }: PageProps<"/events/[id]/edit">) {
  const { id } = await params;
  const user = await requireUser();

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) notFound();
  if (event.hostId !== user.id) redirect(`/events/${id}`);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Link href={`/events/${id}`} className="-my-2 inline-block py-2 text-xs font-bold uppercase tracking-widest text-gold hover:underline">
        ← Retour à la table
      </Link>
      <h1 className="mt-3 font-display text-3xl text-cream">Modifier la table</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Les personnes déjà inscrites le restent. Préviens-les par message si tu changes le lieu ou l&apos;heure.
      </p>

      <div className="mt-8">
        <EventForm
          action={updateEventAction.bind(null, id)}
          submitLabel="Enregistrer"
          pendingLabel="Enregistrement..."
          values={{
            title: event.title,
            type: event.type,
            level: event.level,
            description: event.description ?? "",
            bringList: event.bringList ?? "",
            city: event.city,
            location: event.location ?? "",
            startAt: toLocalInput(event.startAt),
            endAt: toLocalInput(event.endAt),
            maxParticipants: event.maxParticipants ? String(event.maxParticipants) : "",
          }}
        />
      </div>
    </div>
  );
}
