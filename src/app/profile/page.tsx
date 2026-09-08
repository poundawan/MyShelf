import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ItemCard } from "@/components/item-card";
import { Card, Button } from "@/components/ui";
import { MapPin, PackagePlus } from "lucide-react";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const items = await prisma.item.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{user.name}</h1>
          <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-4" />
            {user.city}
          </div>
        </div>
        <Link href="/items/new">
          <Button className="gap-1.5">
            <PackagePlus className="size-4" />
            Ajouter un objet
          </Button>
        </Link>
      </div>

      <h2 className="mt-8 mb-4 text-lg font-medium">Mon étagère ({items.length})</h2>

      {items.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          Tu n&apos;as encore ajouté aucun objet.
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <ItemCard key={item.id} item={{ ...item, owner: { name: user.name, city: user.city } }} />
          ))}
        </div>
      )}
    </div>
  );
}
