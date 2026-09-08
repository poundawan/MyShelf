"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { proposeTradeAction } from "@/lib/actions/trades";
import { Button, Card, ErrorText } from "@/components/ui";
import { categoryEmoji, categoryLabels } from "@/lib/labels";

type MyItem = { id: string; title: string; category: string };

export function ProposeTradeForm({ targetItemId, myItems }: { targetItemId: string; myItems: MyItem[] }) {
  const [state, formAction, pending] = useActionState(proposeTradeAction, undefined);
  const [selected, setSelected] = useState<string[]>([]);

  if (myItems.length === 0) {
    return (
      <Card className="p-4 text-sm text-muted-foreground">
        Tu n&apos;as pas encore d&apos;objet disponible à proposer.{" "}
        <Link href="/items/new" className="font-medium text-primary hover:underline">
          Ajoute-en un
        </Link>{" "}
        pour lancer un échange.
      </Card>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="targetItemId" value={targetItemId} />
      <p className="text-sm font-medium">Choisis ce que tu proposes en échange :</p>
      <div className="flex flex-col gap-2">
        {myItems.map((item) => (
          <label
            key={item.id}
            className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-3 text-sm has-checked:border-primary has-checked:bg-primary/5"
          >
            <input
              type="checkbox"
              name="offeredItemIds"
              value={item.id}
              checked={selected.includes(item.id)}
              onChange={(e) =>
                setSelected((prev) =>
                  e.target.checked ? [...prev, item.id] : prev.filter((id) => id !== item.id),
                )
              }
              className="size-4 accent-primary"
            />
            <span>{categoryEmoji[item.category]}</span>
            <span className="flex-1">{item.title}</span>
            <span className="text-xs text-muted-foreground">{categoryLabels[item.category]}</span>
          </label>
        ))}
      </div>
      <ErrorText>{state?.error}</ErrorText>
      <Button type="submit" disabled={pending || selected.length === 0}>
        {pending ? "Envoi..." : "Proposer l'échange"}
      </Button>
    </form>
  );
}
