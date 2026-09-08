import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ItemCard } from "@/components/item-card";
import { Input, Select, Button, Card } from "@/components/ui";
import { categoryLabels } from "@/lib/labels";
import { Search } from "lucide-react";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; city?: string }>;
}) {
  const { q, category, city } = await searchParams;
  const user = await getCurrentUser();

  const items = await prisma.item.findMany({
    where: {
      status: "AVAILABLE",
      ...(user ? { ownerId: { not: user.id } } : {}),
      ...(category ? { category: category as never } : {}),
      ...(q ? { title: { contains: q } } : {}),
      ...(city ? { owner: { city: { contains: city } } } : {}),
    },
    include: { owner: { select: { name: true, city: true } } },
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Découvre des objets à échanger</h1>
        <p className="mt-1 text-muted-foreground">
          Jeux de société, livres et plus encore, proposés par des membres près de chez toi.
        </p>
        {!user && (
          <Card className="mt-4 flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm">Crée un compte pour proposer tes objets et lancer des échanges.</p>
            <Link href="/register">
              <Button size="sm">Commencer</Button>
            </Link>
          </Card>
        )}
      </div>

      <form className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input name="q" defaultValue={q} placeholder="Rechercher un titre..." className="pl-10" />
        </div>
        <Select name="category" defaultValue={category ?? ""} className="sm:w-48">
          <option value="">Toutes catégories</option>
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

      {items.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          Aucun objet ne correspond à ta recherche pour l&apos;instant.
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
