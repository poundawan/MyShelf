import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Badge, Button, Card, Input } from "@/components/ui";
import { cardRarityLabels } from "@/lib/labels";
import { pseudoDistanceKm, formatDistanceKm } from "@/lib/format";
import { requestCardAction } from "@/lib/actions/trades";
import { cn } from "@/lib/utils";

const rarityBadge: Record<string, "primary" | "outline" | "muted" | "danger"> = {
  FOIL: "primary", RARE: "outline", MYTHIC: "danger", COMMON: "muted",
};

export default async function CardsPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { tab = "search", q } = await searchParams;
  const isMine = tab === "mine";

  const copies = await prisma.cardCopy.findMany({
    where: {
      status: "ON_TABLE",
      ...(isMine ? { ownerId: user.id } : { ownerId: { not: user.id } }),
      ...(q ? { card: { OR: [{ name: { contains: q } }, { setName: { contains: q } }] } } : {}),
    },
    include: { card: true, owner: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="text-xs font-bold uppercase tracking-widest text-gold">Ta main · ta liste de recherche</div>
      <h1 className="mt-1 font-display text-3xl text-cream sm:text-4xl">Échange de cartes</h1>
      <p className="mt-2 text-ink-soft">Croisé avec les doubles des joueurs à moins de 5 km.</p>

      <form className="mt-6 flex flex-wrap gap-3">
        <input type="hidden" name="tab" value={tab} />
        <Input name="q" defaultValue={q} placeholder="Filtrer par carte ou extension..." className="min-w-64 flex-1" />
        <Button type="submit" variant="secondary">Filtrer</Button>
      </form>

      <div className="mt-4 flex gap-2">
        <Link href={q ? `/cards?tab=search&q=${encodeURIComponent(q)}` : "/cards?tab=search"}>
          <Button variant={!isMine ? "primary" : "secondary"} size="sm">Je cherche</Button>
        </Link>
        <Link href="/cards?tab=mine">
          <Button variant={isMine ? "primary" : "secondary"} size="sm">Mes doubles</Button>
        </Link>
        <Link href="/cards/new" className="ml-auto">
          <Button size="sm">+ Ajouter une carte</Button>
        </Link>
      </div>

      {copies.length === 0 ? (
        <Card className="mt-8 p-10 text-center text-ink-soft">
          {isMine ? "Tu n'as pas encore ajouté de double." : "Aucune carte disponible pour l'instant."}
        </Card>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {copies.map((copy) => {
            const km = pseudoDistanceKm(copy.id);
            return (
              <Card key={copy.id} className="overflow-hidden">
                <div className="relative flex aspect-[3/4] items-center justify-center bg-surface-2 text-xs uppercase tracking-widest text-ink-soft/40">
                  scan carte
                  <span className={cn("absolute right-2 top-2")}>
                    <Badge variant={rarityBadge[copy.card.rarity]}>{cardRarityLabels[copy.card.rarity]}</Badge>
                  </span>
                </div>
                <div className="p-3">
                  <div className="font-display text-sm text-cream">{copy.card.name}</div>
                  <div className="mt-1 text-xs text-ink-soft">
                    {copy.card.setName ? `${copy.card.setName} · ` : ""}
                    {copy.owner.name} · {formatDistanceKm(km)}
                  </div>
                  {!isMine && (
                    <form action={requestCardAction.bind(null, copy.id)} className="mt-2">
                      <Button type="submit" size="sm" variant="secondary" className="w-full uppercase">
                        Demander
                      </Button>
                    </form>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
