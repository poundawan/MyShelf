import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { deleteItemAction } from "@/lib/actions/items";
import { Badge, Button, Card } from "@/components/ui";
import { categoryEmoji, categoryLabels, conditionLabels } from "@/lib/labels";
import { ProposeTradeForm } from "@/components/propose-trade-form";
import { MapPin } from "lucide-react";

export default async function ItemDetailPage({ params }: PageProps<"/items/[id]">) {
  const { id } = await params;
  const user = await getCurrentUser();

  const item = await prisma.item.findUnique({
    where: { id },
    include: { owner: { select: { id: true, name: true, city: true } } },
  });

  if (!item) notFound();

  const isOwner = user?.id === item.ownerId;

  const myAvailableItems = user && !isOwner
    ? await prisma.item.findMany({
        where: { ownerId: user.id, status: "AVAILABLE" },
        select: { id: true, title: true, category: true },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-border bg-border/30 text-8xl">
          {item.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.photoUrl} alt={item.title} className="h-full w-full object-cover" />
          ) : (
            <span>{categoryEmoji[item.category]}</span>
          )}
        </div>

        <div className="flex flex-col">
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="primary">{categoryLabels[item.category]}</Badge>
            <Badge variant="muted">{conditionLabels[item.condition]}</Badge>
            {item.status !== "AVAILABLE" && (
              <Badge>{item.status === "IN_TRADE" ? "En échange" : "Échangé"}</Badge>
            )}
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">{item.title}</h1>
          <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-4" />
            {item.owner.city} · proposé par {item.owner.name}
          </div>

          {item.description && (
            <p className="mt-4 whitespace-pre-line text-sm text-foreground/90">{item.description}</p>
          )}

          <div className="mt-8">
            {isOwner ? (
              <form action={deleteItemAction.bind(null, item.id)}>
                <Button type="submit" variant="danger" size="sm">
                  Supprimer cet objet
                </Button>
              </form>
            ) : item.status !== "AVAILABLE" ? (
              <Card className="p-4 text-sm text-muted-foreground">Cet objet n&apos;est plus disponible.</Card>
            ) : user ? (
              <ProposeTradeForm targetItemId={item.id} myItems={myAvailableItems} />
            ) : (
              <Card className="p-4 text-sm">
                <Link href="/login" className="font-medium text-primary hover:underline">
                  Connecte-toi
                </Link>{" "}
                pour proposer un échange.
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
