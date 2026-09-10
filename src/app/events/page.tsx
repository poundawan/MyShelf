import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { EventCard } from "@/components/event-card";
import { Input, Select, Button, Card } from "@/components/ui";
import { eventTypeLabels } from "@/lib/labels";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; city?: string }>;
}) {
  const { q, type, city } = await searchParams;
  const user = await getCurrentUser();

  const events = await prisma.event.findMany({
    where: {
      status: "ACTIVE",
      startAt: { gte: new Date() },
      ...(type ? { type: type as never } : {}),
      ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
      ...(city ? { city: { contains: city, mode: "insensitive" } } : {}),
    },
    include: { host: true, _count: { select: { participants: true } } },
    orderBy: { startAt: "asc" },
    take: 60,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-gold">Autour de la table</div>
          <h1 className="mt-1 font-display text-3xl text-cream sm:text-4xl">Tables</h1>
        </div>
        {user ? (
          <Link href="/events/new"><Button>Ouvrir une table</Button></Link>
        ) : (
          <Link href="/register"><Button>Créer un compte</Button></Link>
        )}
      </div>

      <form className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
        <Input name="q" defaultValue={q} placeholder="Rechercher une table..." />
        <Select name="type" defaultValue={type ?? ""} aria-label="Filtrer par type de jeu" className="sm:w-48">
          <option value="">Tous les types</option>
          {Object.entries(eventTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
        <Input name="city" defaultValue={city} placeholder="Ville" className="sm:w-40" />
        <Button type="submit" variant="secondary">Filtrer</Button>
      </form>

      {events.length === 0 ? (
        <Card className="p-10 text-center text-ink-soft">Aucune table à venir pour l&apos;instant.</Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => <EventCard key={event.id} event={event} />)}
        </div>
      )}
    </div>
  );
}
