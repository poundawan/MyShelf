import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Badge, Card } from "@/components/ui";
import { categoryEmoji, tradeStatusLabels } from "@/lib/labels";

export default async function TradesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const trades = await prisma.tradeProposal.findMany({
    where: { OR: [{ fromUserId: user.id }, { toUserId: user.id }] },
    include: {
      fromUser: { select: { id: true, name: true } },
      toUser: { select: { id: true, name: true } },
      items: { include: { item: { select: { title: true, category: true } } } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Mes échanges</h1>

      {trades.length === 0 ? (
        <Card className="mt-8 p-10 text-center text-muted-foreground">
          Aucun échange pour l&apos;instant. Parcours les objets disponibles pour proposer un premier troc !
        </Card>
      ) : (
        <div className="mt-8 flex flex-col gap-3">
          {trades.map((trade) => {
            const otherUser = trade.fromUserId === user.id ? trade.toUser : trade.fromUser;
            const myItems = trade.items.filter(
              (ti) => (ti.offeredBy === "FROM") === (trade.fromUserId === user.id),
            );
            const theirItems = trade.items.filter(
              (ti) => (ti.offeredBy === "FROM") !== (trade.fromUserId === user.id),
            );

            return (
              <Link key={trade.id} href={`/trades/${trade.id}`}>
                <Card className="flex flex-col gap-2 p-4 transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Avec <span className="font-medium text-foreground">{otherUser.name}</span>
                    </p>
                    <p className="mt-1 text-sm">
                      {myItems.map((ti) => `${categoryEmoji[ti.item.category]} ${ti.item.title}`).join(", ")}
                      {" ⇄ "}
                      {theirItems.map((ti) => `${categoryEmoji[ti.item.category]} ${ti.item.title}`).join(", ")}
                    </p>
                  </div>
                  <Badge
                    variant={
                      trade.status === "COMPLETED"
                        ? "success"
                        : trade.status === "PENDING"
                          ? "primary"
                          : "default"
                    }
                  >
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
