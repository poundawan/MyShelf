import Link from "next/link";
import { Card, Badge } from "@/components/ui";
import { categoryEmoji, categoryLabels, conditionLabels } from "@/lib/labels";
import { MapPin } from "lucide-react";

export type ItemCardData = {
  id: string;
  title: string;
  category: string;
  condition: string;
  photoUrl: string | null;
  status: string;
  owner: { name: string; city: string };
};

export function ItemCard({ item }: { item: ItemCardData }) {
  return (
    <Link href={`/items/${item.id}`}>
      <Card className="group flex h-full flex-col overflow-hidden transition-shadow hover:shadow-md">
        <div className="flex aspect-[4/3] items-center justify-center bg-border/30 text-5xl">
          {item.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.photoUrl} alt={item.title} className="h-full w-full object-cover" />
          ) : (
            <span>{categoryEmoji[item.category]}</span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium leading-snug text-foreground line-clamp-2">{item.title}</h3>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="primary">{categoryLabels[item.category]}</Badge>
            <Badge variant="muted">{conditionLabels[item.condition]}</Badge>
            {item.status !== "AVAILABLE" && <Badge>{item.status === "IN_TRADE" ? "En échange" : "Échangé"}</Badge>}
          </div>
          <div className="mt-auto flex items-center gap-1 pt-2 text-xs text-muted-foreground">
            <MapPin className="size-3.5" />
            {item.owner.city} · {item.owner.name}
          </div>
        </div>
      </Card>
    </Link>
  );
}
