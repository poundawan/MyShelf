import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Badge, Button, Avatar, Card } from "@/components/ui";
import { gameCategoryLabels, gameCategoryEmoji, playerLevelLabels } from "@/lib/labels";
import { pseudoDistanceKm, formatDistanceKm } from "@/lib/format";
import { toggleGameWantAction } from "@/lib/actions/games";

export default async function GameDetailPage({ params }: PageProps<"/games/[id]">) {
  const { id } = await params;
  const user = await getCurrentUser();

  const game = await prisma.game.findUnique({
    where: { id },
    include: {
      copies: { where: { status: "ON_TABLE" }, include: { owner: true }, orderBy: { createdAt: "asc" } },
      reviews: { select: { rating: true } },
    },
  });
  if (!game) notFound();

  const avgRating = game.reviews.length
    ? game.reviews.reduce((sum, r) => sum + r.rating, 0) / game.reviews.length
    : null;

  const otherOwners = game.copies.filter((c) => c.ownerId !== user?.id);
  const myCopy = user ? game.copies.find((c) => c.ownerId === user.id) : undefined;
  const myWant = user
    ? await prisma.gameWant.findUnique({ where: { gameId_userId: { gameId: game.id, userId: user.id } } })
    : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/shelf" className="text-xs font-bold uppercase tracking-widest text-gold hover:underline">
        ← Retour à l&apos;étagère
      </Link>

      <div className="mt-4 grid grid-cols-1 gap-8 sm:grid-cols-[280px_1fr]">
        <div className="flex aspect-[3/4] items-center justify-center bg-surface-2 text-6xl">
          {game.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={game.photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs uppercase tracking-widest text-ink-soft/40">visuel boîte 3:4</span>
          )}
        </div>

        <div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="primary">{gameCategoryLabels[game.category]}</Badge>
            {game.level && <Badge variant="outline">{playerLevelLabels[game.level]}</Badge>}
          </div>
          <h1 className="mt-3 font-display text-3xl text-cream">{game.title}</h1>
          {game.description && <p className="mt-3 text-sm leading-relaxed text-ink-soft">{game.description}</p>}

          <div className="mt-5 grid grid-cols-4 gap-4 border-t border-border pt-4 text-sm">
            <Stat label="Joueurs" value={game.minPlayers || game.maxPlayers ? `${game.minPlayers ?? "?"}–${game.maxPlayers ?? "?"}` : "—"} />
            <Stat label="Durée" value={game.durationMin ? `${game.durationMin} min` : "—"} />
            <Stat label="Âge" value={game.minAge ? `${game.minAge}+` : "—"} />
            <Stat label="Note club" value={avgRating ? avgRating.toFixed(1).replace(".", ",") : "—"} />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {otherOwners.length > 0 && user ? (
              <Link href={`/trades/new?copyId=${otherOwners[0].id}`}>
                <Button>Proposer un échange</Button>
              </Link>
            ) : (
              <Button disabled title="Aucune copie disponible pour l'instant">Proposer un échange</Button>
            )}
            {!myCopy && (
              <Link href="/shelf/new">
                <Button variant="secondary">J&apos;ai ce jeu aussi</Button>
              </Link>
            )}
            {user && (
              <form action={toggleGameWantAction.bind(null, game.id)}>
                <Button type="submit" variant={myWant ? "primary" : "secondary"}>
                  {myWant ? "★ Dans ma liste" : "☆ Ajouter à ma liste"}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>

      {otherOwners.length > 0 && (
        <div className="mt-10">
          <h2 className="font-display text-lg text-cream">
            {otherOwners.length} joueur{otherOwners.length > 1 ? "s" : ""} l&apos;{otherOwners.length > 1 ? "ont" : "a"} sur leur table d&apos;échange
          </h2>
          <div className="mt-4 flex flex-col gap-2">
            {otherOwners.map((copy) => {
              const km = pseudoDistanceKm(copy.id);
              return (
                <Card key={copy.id} className="flex items-center gap-3 p-3">
                  <Avatar name={copy.owner.name} size={38} tone={copy.owner.verified ? "rust" : "wood"} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-cream">{copy.owner.name}</div>
                    <div className="text-xs text-ink-soft">
                      {formatDistanceKm(km)} · {copy.owner.verified ? "identité vérifiée" : "nouveau membre"}
                    </div>
                  </div>
                  {user && copy.ownerId !== user.id ? (
                    <Link href={`/trades/new?copyId=${copy.id}`}>
                      <Button size="sm">Échanger</Button>
                    </Link>
                  ) : (
                    <span className="text-xs text-ink-soft">{gameCategoryEmoji[game.category]}</span>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-ink-soft">{label}</div>
      <div className="mt-0.5 font-display text-gold">{value}</div>
    </div>
  );
}
