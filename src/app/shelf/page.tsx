import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Button, Card } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { GameCopyCard } from "@/components/game-card";
import { removeGameWantAction } from "@/lib/actions/games";
import { gameCategoryEmoji } from "@/lib/labels";

export default async function ShelfPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const t = await getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { tab = "mine" } = await searchParams;
  const isWishlist = tab === "wishlist";

  const [copies, wants] = await Promise.all([
    prisma.gameCopy.findMany({
      where: { ownerId: user.id },
      include: { game: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.gameWant.findMany({
      where: { userId: user.id },
      include: { game: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const onTableCount = copies.filter((c) => c.status === "ON_TABLE").length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-gold">{t("shelf.eyebrow")}</div>
          <h1 className="mt-1 font-display text-3xl text-cream sm:text-4xl">{t("shelf.title")}</h1>
          <p className="mt-2 text-ink-soft">
            {t("shelf.summary", { count: copies.length, onTable: onTableCount })}
          </p>
        </div>
        <Link href="/shelf/new">
          <Button>{t("shelf.add")}</Button>
        </Link>
      </div>

      <div className="mt-6 flex gap-2">
        <Link href="/shelf?tab=mine">
          <Button size="sm" variant={!isWishlist ? "primary" : "secondary"}>{t("shelf.tab.mine")}</Button>
        </Link>
        <Link href="/shelf?tab=wishlist">
          <Button size="sm" variant={isWishlist ? "primary" : "secondary"}>
            {t("shelf.tab.wishlist")}{wants.length > 0 ? ` (${wants.length})` : ""}
          </Button>
        </Link>
      </div>

      {isWishlist ? (
        wants.length === 0 ? (
          <Card className="mt-8 p-10 text-center text-ink-soft">
            {t("shelf.wishlist.empty")}{" "}
            <Link href="/search" className="font-bold text-gold hover:underline">{t("shelf.wishlist.searchLink")}</Link>.
          </Card>
        ) : (
          <div className="mt-8 flex flex-col gap-2">
            {wants.map((want) => (
              <Card key={want.id} className="flex items-center gap-3 p-3.5">
                <span className="flex size-10 flex-none items-center justify-center bg-surface-2 text-lg">
                  {gameCategoryEmoji[want.game.category]}
                </span>
                <Link href={`/games/${want.gameId}`} className="min-w-0 flex-1 font-semibold text-cream hover:underline">
                  {want.game.title}
                </Link>
                <form action={removeGameWantAction.bind(null, want.id)}>
                  <Button type="submit" size="sm" variant="ghost">{t("common.remove")}</Button>
                </form>
              </Card>
            ))}
          </div>
        )
      ) : copies.length === 0 ? (
        <Card className="mt-8 p-10 text-center text-ink-soft">
            {t("shelf.empty")}
          </Card>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {copies.map((copy) => (
            <GameCopyCard key={copy.id} copy={copy} editable />
          ))}
        </div>
      )}
    </div>
  );
}
