import Link from "next/link";
import { Card, Button } from "@/components/ui";
import { gameCategoryEmoji } from "@/lib/labels";
import { toggleCopyStatusAction } from "@/lib/actions/games";

export type GameCopyCardData = {
  id: string;
  status: string;
  game: { id: string; title: string; category: string; minPlayers: number | null; maxPlayers: number | null; durationMin: number | null; photoUrl: string | null };
};

function playersLabel(min: number | null, max: number | null) {
  if (!min && !max) return null;
  if (min && max && min !== max) return `${min}-${max} joueurs`;
  return `${min ?? max} joueurs`;
}

export function GameCopyCard({ copy, editable }: { copy: GameCopyCardData; editable?: boolean }) {
  const meta = [playersLabel(copy.game.minPlayers, copy.game.maxPlayers), copy.game.durationMin ? `${copy.game.durationMin} min` : null]
    .filter(Boolean)
    .join(" · ");
  const onTable = copy.status === "ON_TABLE";

  return (
    <Card className="overflow-hidden" data-testid="game-copy" data-copy-id={copy.id}>
      <Link href={`/games/${copy.game.id}`} className="block">
        <div className="flex aspect-[4/3] items-center justify-center bg-surface-2 text-5xl">
          {copy.game.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={copy.game.photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs uppercase tracking-widest text-ink-soft/40">visuel boîte</span>
          )}
        </div>
        <div className="p-4 pb-2">
          <div className="font-display text-base leading-snug text-cream">{copy.game.title}</div>
          {meta && <div className="mt-1 text-xs text-ink-soft">{meta}</div>}
        </div>
      </Link>
      <div className="p-4 pt-2">
        {editable ? (
          <form action={toggleCopyStatusAction.bind(null, copy.id)}>
            <Button
              type="submit"
              size="sm"
              variant={onTable ? "primary" : "secondary"}
              className="w-full uppercase"
            >
              {onTable ? "⇄ Sur la table" : "Gardée au chaud"}
            </Button>
          </form>
        ) : (
          <div className="text-xs text-ink-soft">{gameCategoryEmoji[copy.game.category]} {onTable ? "Disponible" : "Non disponible"}</div>
        )}
      </div>
    </Card>
  );
}
