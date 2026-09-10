import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Badge, Button, Card, Input } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { pseudoDistanceKm, formatDistanceKm } from "@/lib/format";
import { requestCardAction } from "@/lib/actions/trades";
import { deleteCardCopyAction, deleteCardWantAction } from "@/lib/actions/cards";
import { cn } from "@/lib/utils";

const rarityBadge: Record<string, "primary" | "outline" | "muted" | "danger"> = {
  FOIL: "primary", RARE: "outline", MYTHIC: "danger", COMMON: "muted",
};

export default async function CardsPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const t = await getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { tab = "search", q } = await searchParams;
  const isMine = tab === "mine";

  const copies = await prisma.cardCopy.findMany({
    where: {
      status: "ON_TABLE",
      ...(isMine ? { ownerId: user.id } : { ownerId: { not: user.id } }),
      ...(q ? { card: { OR: [{ name: { contains: q, mode: "insensitive" } }, { setName: { contains: q, mode: "insensitive" } }] } } : {}),
    },
    include: { card: true, owner: true },
    orderBy: { createdAt: "desc" },
  });

  const myWants = isMine
    ? await prisma.cardWant.findMany({
        where: { userId: user.id },
        include: { card: true },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="text-xs font-bold uppercase tracking-widest text-gold">{t("cards.eyebrow")}</div>
      <h1 className="mt-1 font-display text-3xl text-cream sm:text-4xl">{t("cards.title")}</h1>
      <p className="mt-2 text-ink-soft">{t("cards.lede")}</p>

      <form className="mt-6 flex flex-wrap gap-3">
        <input type="hidden" name="tab" value={tab} />
        <Input name="q" defaultValue={q} placeholder={t("cards.filter.placeholder")} className="min-w-64 flex-1" />
        <Button type="submit" variant="secondary">{t("common.filter")}</Button>
      </form>

      <div className="mt-4 flex gap-2">
        <Link href={q ? `/cards?tab=search&q=${encodeURIComponent(q)}` : "/cards?tab=search"}>
          <Button variant={!isMine ? "primary" : "secondary"} size="sm">{t("cards.tab.search")}</Button>
        </Link>
        <Link href="/cards?tab=mine">
          <Button variant={isMine ? "primary" : "secondary"} size="sm">{t("cards.tab.mine")}</Button>
        </Link>
        <Link href="/cards/new" className="ml-auto">
          <Button size="sm">{t("cards.add")}</Button>
        </Link>
      </div>

      {copies.length === 0 ? (
        <Card className="mt-8 p-10 text-center text-ink-soft">
          {isMine ? t("cards.empty.mine") : t("cards.empty.search")}
        </Card>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {copies.map((copy) => {
            const km = pseudoDistanceKm(copy.id);
            return (
              <Card key={copy.id} className="overflow-hidden">
                <div className="relative flex aspect-[3/4] items-center justify-center bg-surface-2 text-xs uppercase tracking-widest text-ink-soft/65">
                  {t("cards.placeholder")}
                  <span className={cn("absolute right-2 top-2")}>
                    <Badge variant={rarityBadge[copy.card.rarity]}>{t(`rarity.${copy.card.rarity}`)}</Badge>
                  </span>
                </div>
                <div className="p-3">
                  <div className="font-display text-sm text-cream">{copy.card.name}</div>
                  <div className="mt-1 text-xs text-ink-soft">
                    {copy.card.setName ? `${copy.card.setName} · ` : ""}
                    {copy.owner.name} · {formatDistanceKm(km, t)}
                  </div>
                  {isMine ? (
                    <form action={deleteCardCopyAction.bind(null, copy.id)} className="mt-2">
                      <Button type="submit" size="sm" variant="danger" className="w-full uppercase">{t("common.remove")}</Button>
                    </form>
                  ) : (
                    <form action={requestCardAction.bind(null, copy.id)} className="mt-2">
                      <Button type="submit" size="sm" variant="secondary" className="w-full uppercase">{t("cards.request")}</Button>
                    </form>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {isMine && (
        <div className="mt-12">
          <h2 className="font-display text-lg text-cream">{t("cards.wanted.title")}</h2>
          {myWants.length === 0 ? (
            <Card className="mt-4 p-6 text-sm text-ink-soft">{t("cards.wanted.empty")}</Card>
          ) : (
            <div className="mt-4 flex flex-col gap-2">
              {myWants.map((want) => (
                <Card key={want.id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-cream">{want.card.name}</div>
                    <div className="text-xs text-ink-soft">
                      {want.card.setName ?? t("cards.wanted.unknownSet")} · {t(`rarity.${want.card.rarity}`)}
                    </div>
                  </div>
                  <form action={deleteCardWantAction.bind(null, want.id)}>
                    <Button type="submit" size="sm" variant="ghost">{t("common.remove")}</Button>
                  </form>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
