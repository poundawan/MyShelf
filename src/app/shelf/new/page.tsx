"use client";

import { useActionState } from "react";
import { addGameCopyAction } from "@/lib/actions/games";
import { Button, Input, Label, Select, Textarea, Card, ErrorText } from "@/components/ui";
import { gameCategoryLabels, conditionLabels } from "@/lib/labels";

export default function NewGamePage() {
  const [state, formAction, pending] = useActionState(addGameCopyAction, undefined);

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <div className="text-xs font-bold uppercase tracking-widest text-gold">Nouvelle boîte</div>
      <h1 className="mt-1 font-display text-3xl text-cream">Ajouter un jeu</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Si le jeu existe déjà dans le catalogue, ta copie viendra s&apos;ajouter aux siennes.
      </p>

      <Card className="mt-8 p-6">
        <form action={formAction} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="title">Titre</Label>
            <Input id="title" name="title" placeholder="ex. Cap sur Oreb" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category">Catégorie</Label>
              <Select id="category" name="category" defaultValue="BOARD_GAME" required>
                {Object.entries(gameCategoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="condition">État de ta copie</Label>
              <Select id="condition" name="condition" defaultValue="GOOD" required>
                {Object.entries(conditionLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="minPlayers">Joueurs min.</Label>
              <Input id="minPlayers" name="minPlayers" type="number" min={1} placeholder="2" />
            </div>
            <div>
              <Label htmlFor="maxPlayers">Joueurs max.</Label>
              <Input id="maxPlayers" name="maxPlayers" type="number" min={1} placeholder="5" />
            </div>
            <div>
              <Label htmlFor="durationMin">Durée (min)</Label>
              <Input id="durationMin" name="durationMin" type="number" min={1} placeholder="60" />
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={4} placeholder="De quoi ça parle, l'ambiance, ce qu'il faut savoir avant de jouer..." />
          </div>

          <div>
            <Label htmlFor="photoUrl">Photo (URL, optionnel)</Label>
            <Input id="photoUrl" name="photoUrl" type="url" placeholder="https://..." />
          </div>

          <ErrorText>{state?.error}</ErrorText>
          <Button type="submit" disabled={pending} className="mt-2">
            {pending ? "Ajout..." : "Ajouter à mon étagère"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
