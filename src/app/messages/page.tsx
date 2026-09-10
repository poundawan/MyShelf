import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Avatar, Card } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { getT, getLocale } from "@/lib/i18n/server";

export default async function MessagesPage() {
  const t = await getT();
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const conversations = await prisma.conversation.findMany({
    where: { OR: [{ userAId: user.id }, { userBId: user.id }] },
    include: {
      userA: true, userB: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="text-xs font-bold uppercase tracking-widest text-gold">{t("messages.eyebrow")}</div>
      <h1 className="mt-1 font-display text-3xl text-cream sm:text-4xl">{t("messages.title")}</h1>

      {conversations.length === 0 ? (
        <Card className="mt-8 p-10 text-center text-ink-soft">{t("messages.emptyShort")}</Card>
      ) : (
        <div className="mt-8 flex flex-col gap-2">
          {conversations.map((c) => {
            const other = c.userAId === user.id ? c.userB : c.userA;
            const last = c.messages[0];
            return (
              <Link key={c.id} href={`/messages/${c.id}`}>
                <Card className="flex items-center gap-3 p-3.5 transition-colors hover:border-gold/60">
                  <Avatar name={other.name} tone={other.verified ? "rust" : "wood"} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="font-semibold text-cream">{other.name}</div>
                      {last && <div className="flex-none text-xs text-ink-soft">{timeAgo(last.createdAt, locale, t)}</div>}
                    </div>
                    <div className="truncate text-sm text-ink-soft">{last?.content ?? "Nouvelle conversation"}</div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
