import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Badge, Card } from "@/components/ui";
import { gameCategoryEmoji, tradeStatusLabels } from "@/lib/labels";

export default async function TradesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const trades = await prisma.tradeProposal.findMany({
    where: { OR: [{ fromUserId: user.id }, { toUserId: user.id }] },
    include: {
      fromUser: true,
      toUser: true,
      items: { include: { gameCopy: { include: { game: true } }, cardCopy: { include: { card: true } } } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl text-cream sm:text-4xl">Mes échanges</h1>

      {trades.length === 0 ? (
        <Card className="mt-8 p-10 text-center text-ink-soft">
          Aucun échange pour l&apos;instant. Parcours <Link href="/shelf" className="font-bold text-gold hover:underline">ton étagère</Link> ou <Link href="/cards" className="font-bold text-gold hover:underline">les cartes</Link> pour en lancer un.
        </Card>
      ) : (
        <div className="mt-8 flex flex-col gap-3">
          {trades.map((trade) => {
            const isSender = trade.fromUserId === user.id;
            const other = isSender ? trade.toUser : trade.fromUser;
            const label = (i: (typeof trade.items)[number]) =>
              i.gameCopy ? `${gameCategoryEmoji[i.gameCopy.game.category]} ${i.gameCopy.game.title}` : i.cardCopy ? `🃏 ${i.cardCopy.card.name}` : "";
            const mine = trade.items.filter((i) => (i.offeredBy === "FROM") === isSender);
            const theirs = trade.items.filter((i) => (i.offeredBy === "FROM") !== isSender);

            return (
              <Link key={trade.id} href={`/trades/${trade.id}`}>
                <Card className="flex flex-col gap-2 p-4 transition-colors hover:border-gold/60 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs text-ink-soft">Avec <span className="font-bold text-cream">{other.name}</span></p>
                    <p className="mt-1 text-sm text-cream">
                      {mine.map(label).join(", ") || "?"} ⇄ {theirs.map(label).join(", ") || "?"}
                    </p>
                  </div>
                  <Badge variant={trade.status === "COMPLETED" ? "muted" : trade.status === "PENDING" ? "primary" : "outline"}>
                    {tradeStatusLabels[trade.status]}
                  </Badge>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
