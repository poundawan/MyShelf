"use client";

import { useActionState, useState } from "react";
import { addCardAction } from "@/lib/actions/cards";
import { Button, Input, Label, Select, Card, ErrorText } from "@/components/ui";
import { cardRarityLabels } from "@/lib/labels";
import { cn } from "@/lib/utils";

export default function NewCardPage() {
  const [state, formAction, pending] = useActionState(addCardAction, undefined);
  const [mode, setMode] = useState<"DOUBLE" | "WANT">("DOUBLE");

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <div className="text-xs font-bold uppercase tracking-widest text-gold">Nouvelle carte</div>
      <h1 className="mt-1 font-display text-3xl text-cream">Ajouter une carte</h1>

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={() => setMode("DOUBLE")}
          className={cn("rounded-sm border px-4 py-2 text-sm font-bold", mode === "DOUBLE" ? "border-gold bg-gold text-gold-ink" : "border-border-strong text-ink-soft")}
        >
          C&apos;est un double
        </button>
        <button
          type="button"
          onClick={() => setMode("WANT")}
          className={cn("rounded-sm border px-4 py-2 text-sm font-bold", mode === "WANT" ? "border-gold bg-gold text-gold-ink" : "border-border-strong text-ink-soft")}
        >
          Je la cherche
        </button>
      </div>

      <Card className="mt-6 p-6">
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="mode" value={mode} />
          <div>
            <Label htmlFor="name">Nom de la carte</Label>
            <Input id="name" name="name" placeholder="ex. Gardienne des Cendres" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="setName">Extension</Label>
              <Input id="setName" name="setName" placeholder="ex. Cendres du Nord" />
            </div>
            <div>
              <Label htmlFor="rarity">Rareté</Label>
              <Select id="rarity" name="rarity" defaultValue="COMMON" required>
                {Object.entries(cardRarityLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </div>
          </div>
          <ErrorText>{state?.error}</ErrorText>
          <Button type="submit" disabled={pending} className="mt-2">
            {pending ? "Ajout..." : mode === "DOUBLE" ? "Ajouter à mes doubles" : "Ajouter à ma liste de recherche"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
