"use client";

import { useActionState } from "react";
import { addGameCopyAction } from "@/lib/actions/games";
import { Button, Input, Label, Select, Textarea, Card, ErrorText } from "@/components/ui";
import { gameCategories, itemConditions } from "@/lib/validation";
import { useT } from "@/lib/i18n/client";

export default function NewGamePage() {
  const [state, formAction, pending] = useActionState(addGameCopyAction, undefined);
  const t = useT();

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <div className="text-xs font-bold uppercase tracking-widest text-gold">{t("shelf.new.eyebrow")}</div>
      <h1 className="mt-1 font-display text-3xl text-cream">{t("shelf.new.title")}</h1>
      <p className="mt-2 text-sm text-ink-soft">{t("shelf.new.lede")}</p>

      <Card className="mt-8 p-6">
        <form action={formAction} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="title">{t("game.field.title")}</Label>
            <Input id="title" name="title" placeholder={t("game.field.title.placeholder")} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category">{t("game.field.category")}</Label>
              <Select id="category" name="category" defaultValue="BOARD_GAME" required>
                {gameCategories.map((value) => (
                  <option key={value} value={value}>{t(`category.${value}`)}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="condition">{t("game.field.condition")}</Label>
              <Select id="condition" name="condition" defaultValue="GOOD" required>
                {itemConditions.map((value) => (
                  <option key={value} value={value}>{t(`condition.${value}`)}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="minPlayers">{t("game.field.minPlayers")}</Label>
              <Input id="minPlayers" name="minPlayers" type="number" min={1} placeholder="2" />
            </div>
            <div>
              <Label htmlFor="maxPlayers">{t("game.field.maxPlayers")}</Label>
              <Input id="maxPlayers" name="maxPlayers" type="number" min={1} placeholder="5" />
            </div>
            <div>
              <Label htmlFor="durationMin">{t("game.field.duration")}</Label>
              <Input id="durationMin" name="durationMin" type="number" min={1} placeholder="60" />
            </div>
          </div>

          <div>
            <Label htmlFor="description">{t("game.field.description")}</Label>
            <Textarea id="description" name="description" rows={4} placeholder={t("game.field.description.placeholder")} />
          </div>

          <div>
            <Label htmlFor="photoUrl">{t("game.field.photo")}</Label>
            <Input id="photoUrl" name="photoUrl" type="url" placeholder="https://..." />
          </div>

          <ErrorText>{state?.error}</ErrorText>
          <Button type="submit" disabled={pending} className="mt-2">
            {pending ? t("shelf.new.pending") : t("shelf.new.submit")}
          </Button>
        </form>
      </Card>
    </div>
  );
}
