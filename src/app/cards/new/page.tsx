"use client";

import { useActionState, useState } from "react";
import { addCardAction } from "@/lib/actions/cards";
import { Button, Input, Label, Select, Card, ErrorText } from "@/components/ui";
import { cardRarities } from "@/lib/validation";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export default function NewCardPage() {
  const [state, formAction, pending] = useActionState(addCardAction, undefined);
  const [mode, setMode] = useState<"DOUBLE" | "WANT">("DOUBLE");
  const t = useT();

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <div className="text-xs font-bold uppercase tracking-widest text-gold">{t("cards.new.eyebrow")}</div>
      <h1 className="mt-1 font-display text-3xl text-cream">{t("cards.new.title")}</h1>

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={() => setMode("DOUBLE")}
          className={cn("rounded-sm border px-4 py-2 text-sm font-bold", mode === "DOUBLE" ? "border-gold bg-gold text-gold-ink" : "border-border-strong text-ink-soft")}
        >
          {t("cards.new.isDouble")}
        </button>
        <button
          type="button"
          onClick={() => setMode("WANT")}
          className={cn("rounded-sm border px-4 py-2 text-sm font-bold", mode === "WANT" ? "border-gold bg-gold text-gold-ink" : "border-border-strong text-ink-soft")}
        >
          {t("cards.new.isWanted")}
        </button>
      </div>

      <Card className="mt-6 p-6">
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="mode" value={mode} />
          <div>
            <Label htmlFor="name">{t("card.field.name")}</Label>
            <Input id="name" name="name" placeholder={t("card.field.name.placeholder")} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="setName">{t("card.field.set")}</Label>
              <Input id="setName" name="setName" placeholder={t("card.field.set.placeholder")} />
            </div>
            <div>
              <Label htmlFor="rarity">{t("card.field.rarity")}</Label>
              <Select id="rarity" name="rarity" defaultValue="COMMON" required>
                {cardRarities.map((value) => (
                  <option key={value} value={value}>{t(`rarity.${value}`)}</option>
                ))}
              </Select>
            </div>
          </div>
          <ErrorText>{state?.error}</ErrorText>
          <Button type="submit" disabled={pending} className="mt-2">
            {pending ? t("cards.new.pending") : mode === "DOUBLE" ? t("cards.new.submitDouble") : t("cards.new.submitWanted")}
          </Button>
        </form>
      </Card>
    </div>
  );
}
