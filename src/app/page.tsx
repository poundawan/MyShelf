import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ItemCard } from "@/components/item-card";
import { EventCard } from "@/components/event-card";
import { Button, Card } from "@/components/ui";
import { CalendarPlus, PackagePlus, ArrowRight } from "lucide-react";

export default async function HomePage() {
  const user = await getCurrentUser();

  const [upcomingEvents, recentItems] = await Promise.all([
    prisma.event.findMany({
      where: { status: "ACTIVE", startAt: { gte: new Date() } },
      include: { host: { select: { name: true } }, _count: { select: { participants: true } } },
      orderBy: { startAt: "asc" },
      take: 3,
    }),
    prisma.item.findMany({
      where: { status: "AVAILABLE", ...(user ? { ownerId: { not: user.id } } : {}) },
      include: { owner: { select: { name: true, city: true } } },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <section className="mb-12">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Joue plus, dépense moins 🎲
        </h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Échange tes jeux de société et jeux de rôle avec d&apos;autres passionnés, et organise ou
          rejoins des parties près de chez toi.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          {user ? (
            <>
              <Link href="/events/new">
                <Button className="gap-1.5">
                  <CalendarPlus className="size-4" />
                  Organiser une partie
                </Button>
              </Link>
              <Link href="/items/new">
                <Button variant="secondary" className="gap-1.5">
                  <PackagePlus className="size-4" />
                  Proposer un jeu à l&apos;échange
                </Button>
              </Link>
            </>
          ) : (
            <Link href="/register">
              <Button className="gap-1.5">Rejoindre la communauté</Button>
            </Link>
          )}
        </div>
      </section>

      <section className="mb-12">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight">Prochaines parties</h2>
          <Link href="/events" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            Voir tous les événements
            <ArrowRight className="size-4" />
          </Link>
        </div>
        {upcomingEvents.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            Aucune partie prévue pour l&apos;instant.{" "}
            {user && (
              <Link href="/events/new" className="font-medium text-primary hover:underline">
                Lance la première
              </Link>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcomingEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight">Jeux récemment proposés</h2>
          <Link href="/items" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            Voir tous les jeux
            <ArrowRight className="size-4" />
          </Link>
        </div>
        {recentItems.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">Aucun jeu proposé pour l&apos;instant.</Card>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {recentItems.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
