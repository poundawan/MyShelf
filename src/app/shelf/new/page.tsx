"use client";

import { useActionState, useState } from "react";
import { addGameCopyAction } from "@/lib/actions/games";
import { Button, Input, Label, Select, Textarea, Card, ErrorText } from "@/components/ui";
import { BggPicker } from "@/components/bgg-picker";
import { PhotoInput } from "@/components/photo-input";
import { gameCategories, itemConditions } from "@/lib/validation";
import { useT } from "@/lib/i18n/client";
import type { JeuBgg } from "@/lib/bgg";

/** Champs que le catalogue BoardGameGeek sait pré-remplir. */
type Reprise = {
  title: string;
  minPlayers: string;
  maxPlayers: string;
  durationMin: string;
  photoUrl: string;
  bggId: string;
};

const VIDE: Reprise = { title: "", minPlayers: "", maxPlayers: "", durationMin: "", photoUrl: "", bggId: "" };

export default function NewGamePage() {
  const [state, formAction, pending] = useActionState(addGameCopyAction, undefined);
  const t = useT();
  const [champs, setChamps] = useState<Reprise>(VIDE);

  function reprendre(jeu: JeuBgg) {
    setChamps({
      title: jeu.title,
      minPlayers: jeu.minPlayers ? String(jeu.minPlayers) : "",
      maxPlayers: jeu.maxPlayers ? String(jeu.maxPlayers) : "",
      durationMin: jeu.durationMin ? String(jeu.durationMin) : "",
      photoUrl: jeu.image ?? "",
      bggId: String(jeu.bggId),
    });
  }

  /**
   * Modifier un champ à la main détache la fiche de BoardGameGeek : le titre
   * n'est plus celui de leur catalogue, l'identifiant ne doit plus le prétendre.
   */
  function modifier(champ: keyof Reprise, valeur: string) {
    setChamps((prev) => ({ ...prev, [champ]: valeur, ...(champ === "title" ? { bggId: "" } : {}) }));
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <div className="text-xs font-bold uppercase tracking-widest text-gold">{t("shelf.new.eyebrow")}</div>
      <h1 className="mt-1 font-display text-3xl text-cream">{t("shelf.new.title")}</h1>
      <p className="mt-2 text-sm text-ink-soft">{t("shelf.new.lede")}</p>

      <div className="mt-8">
        <BggPicker onChoisir={reprendre} />
      </div>

      <Card className="mt-4 p-6">
        <form action={formAction} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="title">{t("game.field.title")}</Label>
            <Input
              id="title"
              name="title"
              placeholder={t("game.field.title.placeholder")}
              value={champs.title}
              onChange={(e) => modifier("title", e.target.value)}
              required
            />
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
              <Input id="minPlayers" name="minPlayers" type="number" min={1} placeholder="2"
                value={champs.minPlayers} onChange={(e) => modifier("minPlayers", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="maxPlayers">{t("game.field.maxPlayers")}</Label>
              <Input id="maxPlayers" name="maxPlayers" type="number" min={1} placeholder="5"
                value={champs.maxPlayers} onChange={(e) => modifier("maxPlayers", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="durationMin">{t("game.field.duration")}</Label>
              <Input id="durationMin" name="durationMin" type="number" min={1} placeholder="60"
                value={champs.durationMin} onChange={(e) => modifier("durationMin", e.target.value)} />
            </div>
          </div>

          <div>
            <Label htmlFor="description">{t("game.field.description")}</Label>
            <Textarea id="description" name="description" rows={4} placeholder={t("game.field.description.placeholder")} />
          </div>

          {champs.photoUrl && (
            <div>
              {/* Pas un <label> : il n'y a aucun champ à étiqueter ici, la
                  jaquette vient du catalogue et n'est pas saisissable. */}
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-gold">{t("game.field.cover")}</p>
              <div className="flex items-start gap-3">
                <span className="flex h-24 w-20 flex-none items-center justify-center overflow-hidden rounded-sm border border-border bg-surface-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={champs.photoUrl} alt="" className="h-full w-full object-cover" />
                </span>
                <div>
                  <p className="text-xs text-ink-soft">{t("game.field.cover.fromBgg")}</p>
                  <button
                    type="button"
                    onClick={() => modifier("photoUrl", "")}
                    className="mt-1.5 text-xs font-bold text-rust underline"
                  >
                    {t("photo.remove")}
                  </button>
                </div>
              </div>
            </div>
          )}

          <PhotoInput name="photo" label={t("game.field.photo")} ratio="aspect-[3/4]" />

          {/* Remplis par le sélecteur BoardGameGeek, jamais saisis à la main. */}
          <input type="hidden" name="photoUrl" value={champs.photoUrl} />
          <input type="hidden" name="bggId" value={champs.bggId} />

          <ErrorText>{state?.error}</ErrorText>
          <Button type="submit" disabled={pending} className="mt-2">
            {pending ? t("shelf.new.pending") : t("shelf.new.submit")}
          </Button>
        </form>
      </Card>
    </div>
  );
}
