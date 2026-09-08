"use client";

import { useActionState } from "react";
import { createItemAction } from "@/lib/actions/items";
import { Button, Input, Label, Select, Textarea, Card, ErrorText } from "@/components/ui";
import { categoryLabels, conditionLabels } from "@/lib/labels";

export default function NewItemPage() {
  const [state, formAction, pending] = useActionState(createItemAction, undefined);

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Ajouter un objet</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Décris ce que tu proposes à l&apos;échange.
      </p>

      <Card className="mt-8 p-6">
        <form action={formAction} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="title">Titre</Label>
            <Input id="title" name="title" placeholder="ex. Catan, Warhammer 40k, D&D 5e..." required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category">Catégorie</Label>
              <Select id="category" name="category" defaultValue="BOARD_GAME" required>
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="condition">État</Label>
              <Select id="condition" name="condition" defaultValue="GOOD" required>
                {Object.entries(conditionLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              rows={4}
              placeholder="Nombre de joueurs, édition, auteur, état détaillé..."
            />
          </div>

          <div>
            <Label htmlFor="photoUrl">Photo (URL)</Label>
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
