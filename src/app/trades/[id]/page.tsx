import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { respondToTradeAction, cancelTradeAction, completeTradeAction } from "@/lib/actions/trades";
import { sendMessagePlainAction } from "@/lib/actions/messages";
import { createTradeReviewAction } from "@/lib/actions/reviews";
import { Badge, Button, Card, Input, Stars } from "@/components/ui";
import { gameCategoryEmoji } from "@/lib/labels";
import { getT } from "@/lib/i18n/server";
import { ReviewForm } from "@/components/review-form";
import { cn } from "@/lib/utils";

export default async function TradeDetailPage({ params }: PageProps<"/trades/[id]">) {
  const { id } = await params;
  const t = await getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const trade = await prisma.tradeProposal.findUnique({
    where: { id },
    include: {
      fromUser: true,
      toUser: true,
      items: { include: { gameCopy: { include: { game: true } }, cardCopy: { include: { card: true } } } },
      conversation: { include: { messages: { include: { sender: true }, orderBy: { createdAt: "asc" } } } },
    },
  });
  if (!trade || (trade.fromUserId !== user.id && trade.toUserId !== user.id)) notFound();

  const myReview =
    trade.status === "COMPLETED"
      ? await prisma.review.findUnique({ where: { fromUserId_tradeId: { fromUserId: user.id, tradeId: trade.id } } })
      : null;

  const isSender = trade.fromUserId === user.id;
  const otherUser = isSender ? trade.toUser : trade.fromUser;
  const mine = trade.items.filter((i) => (i.offeredBy === "FROM") === isSender);
  const theirs = trade.items.filter((i) => (i.offeredBy === "FROM") !== isSender);

  const itemLabel = (i: (typeof trade.items)[number]) =>
    i.gameCopy ? `${gameCategoryEmoji[i.gameCopy.game.category]} ${i.gameCopy.game.title}` : i.cardCopy ? `🃏 ${i.cardCopy.card.name}` : "";

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="text-xs font-bold uppercase tracking-widest text-gold">
        {trade.status === "PENDING" && isSender ? t("trade.eyebrow.sent") : t("trade.eyebrow")}
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl text-cream sm:text-4xl">
          {trade.status === "PENDING" && isSender
            ? t("trade.title.sent", { name: otherUser.name.split(" ")[0] })
            : t("trade.title", { name: otherUser.name })}
        </h1>
        <Badge variant={trade.status === "COMPLETED" ? "muted" : trade.status === "PENDING" ? "primary" : "outline"}>
          {t(`tradeStatus.${trade.status}`)}
        </Badge>
      </div>

      {trade.kind === "GAME" ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card className="p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-soft">
              {isSender ? t("trade.yours") : t("trade.theyWant", { name: otherUser.name.split(" ")[0] })}
            </p>
            {mine.map((i) => (
              <div key={i.id} className="py-1 text-sm text-cream">{itemLabel(i)}</div>
            ))}
          </Card>
          <Card className="p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-soft">
              {isSender ? t("trade.youWant") : t("trade.theirs")}
            </p>
            {theirs.map((i) => (
              <div key={i.id} className="py-1 text-sm text-cream">{itemLabel(i)}</div>
            ))}
          </Card>
        </div>
      ) : (
        <Card className="mt-6 p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-soft">{t("trade.card")}</p>
          {theirs.concat(mine).map((i) => (
            <div key={i.id} className="py-1 text-sm text-cream">{itemLabel(i)}</div>
          ))}
          <p className="mt-2 text-xs text-ink-soft">{t("trade.card.note")}</p>
        </Card>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        {trade.status === "PENDING" && !isSender && (
          <>
            <form action={respondToTradeAction.bind(null, trade.id, true)}>
              <Button type="submit">{t("trade.accept")}</Button>
            </form>
            <form action={respondToTradeAction.bind(null, trade.id, false)}>
              <Button type="submit" variant="secondary">{t("trade.reject")}</Button>
            </form>
          </>
        )}
        {trade.status === "ACCEPTED" && (
          <form action={completeTradeAction.bind(null, trade.id)}>
            <Button type="submit">{t("trade.complete")}</Button>
          </form>
        )}
        {(trade.status === "PENDING" || trade.status === "ACCEPTED") && (
          <form action={cancelTradeAction.bind(null, trade.id)}>
            <Button type="submit" variant="ghost">{t("trade.cancel")}</Button>
          </form>
        )}
      </div>

      {trade.status === "COMPLETED" && (
        <Card className="mt-10 p-4">
          {myReview ? (
            <div>
              <p className="mb-1 text-sm font-bold text-cream">{t("review.yours")}</p>
              <Stars rating={myReview.rating} />
              <p className="mt-2 text-sm text-ink-soft">{myReview.comment}</p>
            </div>
          ) : (
            <ReviewForm
              action={createTradeReviewAction}
              hiddenField="tradeId"
              hiddenValue={trade.id}
              title={t("review.tradeTitle", { name: otherUser.name })}
            />
          )}
        </Card>
      )}

      {trade.conversation && (
        <div className="mt-10">
          <h2 className="font-display text-lg text-cream">{t("trade.messages")}</h2>
          <div className="mt-3 flex flex-col gap-2">
            {trade.conversation.messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "max-w-[80%] rounded-sm px-4 py-2 text-sm",
                  m.senderId === user.id ? "self-end bg-gold text-gold-ink" : "self-start bg-surface-2 text-ink",
                )}
              >
                {m.content}
              </div>
            ))}
          </div>
          <form action={sendMessagePlainAction} className="mt-3 flex items-center gap-2">
            <input type="hidden" name="conversationId" value={trade.conversation.id} />
            <Input name="content" placeholder={t("trade.message.placeholder")} required className="flex-1" />
            <Button type="submit" size="sm">{t("common.send")}</Button>
          </form>
        </div>
      )}
    </div>
  );
}
