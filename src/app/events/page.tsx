import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { EventCard } from "@/components/event-card";
import { Input, Select, Button, Card } from "@/components/ui";
import { categoryLabels } from "@/lib/labels";
import { Search, CalendarPlus } from "lucide-react";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; gameType?: string; city?: string }>;
}) {
  const { q, gameType, city } = await searchParams;
  const user = await getCurrentUser();

  const events = await prisma.event.findMany({
    where: {
      status: "ACTIVE",
      startAt: { gte: new Date() },
      ...(gameType ? { gameType: gameType as never } : {}),
      ...(q ? { OR: [{ title: { contains: q } }, { gameName: { contains: q } }] } : {}),
      ...(city ? { city: { contains: city } } : {}),
    },
    include: { host: { select: { name: true } }, _count: { select: { participants: true } } },
    orderBy: { startAt: "asc" },
    take: 60,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Prochaines parties</h1>
          <p className="mt-1 text-muted-foreground">
            Rejoins une partie de jeu de société ou de jeu de rôle près de chez toi.
          </p>
        </div>
        {user ? (
          <Link href="/events/new">
            <Button className="gap-1.5">
              <CalendarPlus className="size-4" />
              Créer un événement
            </Button>
          </Link>
        ) : (
          <Link href="/register">
            <Button className="gap-1.5">Créer un compte</Button>
          </Link>
        )}
      </div>

      <form className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input name="q" defaultValue={q} placeholder="Rechercher un jeu, un événement..." className="pl-10" />
        </div>
        <Select name="gameType" defaultValue={gameType ?? ""} className="sm:w-48">
          <option value="">Tous les types</option>
          {Object.entries(categoryLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Input name="city" defaultValue={city} placeholder="Ville" className="sm:w-40" />
        <Button type="submit" variant="secondary">
          Filtrer
        </Button>
      </form>

      {events.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          Aucun événement à venir pour l&apos;instant.{" "}
          {user && (
            <>
              <Link href="/events/new" className="font-medium text-primary hover:underline">
                Sois le premier à en organiser un
              </Link>{" "}
              !
            </>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
