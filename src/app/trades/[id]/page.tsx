import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { respondToTradeAction, cancelTradeAction, completeTradeAction } from "@/lib/actions/trades";
import { Badge, Button, Card } from "@/components/ui";
import { categoryEmoji, tradeStatusLabels } from "@/lib/labels";
import { MessageThread } from "@/components/message-thread";

export default async function TradeDetailPage({ params }: PageProps<"/trades/[id]">) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const trade = await prisma.tradeProposal.findUnique({
    where: { id },
    include: {
      fromUser: { select: { id: true, name: true } },
      toUser: { select: { id: true, name: true } },
      items: { include: { item: { select: { id: true, title: true, category: true, photoUrl: true } } } },
      messages: {
        include: { sender: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!trade || (trade.fromUserId !== user.id && trade.toUserId !== user.id)) notFound();

  const isRecipient = trade.toUserId === user.id;
  const otherUser = trade.fromUserId === user.id ? trade.toUser : trade.fromUser;
  const myItems = trade.items.filter((ti) => (ti.offeredBy === "FROM") === (trade.fromUserId === user.id));
  const theirItems = trade.items.filter((ti) => (ti.offeredBy === "FROM") !== (trade.fromUserId === user.id));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Échange avec {otherUser.name}</h1>
        <Badge
          variant={trade.status === "COMPLETED" ? "success" : trade.status === "PENDING" ? "primary" : "default"}
        >
          {tradeStatusLabels[trade.status]}
        </Badge>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="p-4">
          <p className="mb-3 text-sm font-medium text-muted-foreground">Tu proposes</p>
          <ItemList items={myItems.map((ti) => ti.item)} />
        </Card>
        <Card className="p-4">
          <p className="mb-3 text-sm font-medium text-muted-foreground">Tu reçois</p>
          <ItemList items={theirItems.map((ti) => ti.item)} />
        </Card>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {trade.status === "PENDING" && isRecipient && (
          <>
            <form action={respondToTradeAction.bind(null, trade.id, true)}>
              <Button type="submit">Accepter</Button>
            </form>
            <form action={respondToTradeAction.bind(null, trade.id, false)}>
              <Button type="submit" variant="secondary">
                Refuser
              </Button>
            </form>
          </>
        )}
        {trade.status === "ACCEPTED" && (
          <form action={completeTradeAction.bind(null, trade.id)}>
            <Button type="submit">Marquer comme terminé</Button>
          </form>
        )}
        {(trade.status === "PENDING" || trade.status === "ACCEPTED") && (
          <form action={cancelTradeAction.bind(null, trade.id)}>
            <Button type="submit" variant="ghost">
              Annuler l&apos;échange
            </Button>
          </form>
        )}
      </div>

      <div className="mt-10">
        <h2 className="mb-3 text-lg font-medium">Messages</h2>
        <MessageThread tradeId={trade.id} currentUserId={user.id} messages={trade.messages} />
      </div>
    </div>
  );
}

function ItemList({
  items,
}: {
  items: { id: string; title: string; category: string; photoUrl: string | null }[];
}) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-2 text-sm">
          <span>{categoryEmoji[item.category]}</span>
          {item.title}
        </div>
      ))}
    </div>
  );
}
