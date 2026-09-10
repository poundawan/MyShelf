import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { sendMessagePlainAction } from "@/lib/actions/messages";
import { Avatar, Badge, Card, Input, Button } from "@/components/ui";
import { cn } from "@/lib/utils";

export default async function ConversationPage({ params }: PageProps<"/messages/[id]">) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      userA: true, userB: true,
      messages: { include: { sender: true }, orderBy: { createdAt: "asc" } },
      trades: { where: { status: { in: ["PENDING", "ACCEPTED"] } }, take: 1 },
    },
  });
  if (!conversation || (conversation.userAId !== user.id && conversation.userBId !== user.id)) notFound();

  const other = conversation.userAId === user.id ? conversation.userB : conversation.userA;
  const activeTrade = conversation.trades[0];

  return (
    <div className="mx-auto flex max-w-2xl flex-col px-4 py-10 sm:px-6" style={{ minHeight: "calc(100vh - 130px)" }}>
      <Link href="/messages" className="-my-2 inline-flex self-start py-2 text-xs font-bold uppercase tracking-widest text-gold hover:underline">
        ← Autour de la table
      </Link>

      <div className="mt-3 flex items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Avatar name={other.name} tone={other.verified ? "rust" : "wood"} />
          <div>
            <div className="font-display text-lg text-cream">{other.name}</div>
            <div className="text-xs text-ink-soft">{other.city}</div>
          </div>
        </div>
        {activeTrade && (
          <Link href={`/trades/${activeTrade.id}`}>
            <Badge variant="primary">Échange en cours</Badge>
          </Link>
        )}
      </div>

      <div className="mt-4 flex flex-1 flex-col gap-2">
        {conversation.messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "max-w-[75%] rounded-sm px-4 py-2 text-sm",
              m.senderId === user.id ? "self-end bg-gold text-gold-ink" : "self-start bg-surface-2 text-ink",
            )}
          >
            {m.content}
          </div>
        ))}
        {conversation.messages.length === 0 && (
          <Card className="p-6 text-center text-sm text-ink-soft">Dites bonjour !</Card>
        )}
      </div>

      <form action={sendMessagePlainAction} className="mt-4 flex items-center gap-2">
        <input type="hidden" name="conversationId" value={conversation.id} />
        <Input name="content" placeholder="Écris ton message..." required className="flex-1" />
        <Button type="submit">Envoyer</Button>
      </form>
    </div>
  );
}
