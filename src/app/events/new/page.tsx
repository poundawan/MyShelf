"use client";

import { useActionState } from "react";
import { createEventAction } from "@/lib/actions/events";
import { Button, Input, Label, Select, Textarea, Card, ErrorText } from "@/components/ui";
import { categoryLabels, eventLevelLabels, eventRecurrenceLabels } from "@/lib/labels";

export default function NewEventPage() {
  const [state, formAction, pending] = useActionState(createEventAction, undefined);

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Créer un événement</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Organise une partie et trouve des joueurs près de chez toi.
      </p>

      <Card className="mt-8 p-6">
        <form action={formAction} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="title">Titre</Label>
            <Input id="title" name="title" placeholder="ex. Soirée Catan, Table JDR débutants..." required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="gameType">Type de jeu</Label>
              <Select id="gameType" name="gameType" defaultValue="BOARD_GAME" required>
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="gameName">Jeu (optionnel)</Label>
              <Input id="gameName" name="gameName" placeholder="ex. Catan, D&D 5e..." />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="level">Niveau</Label>
              <Select id="level" name="level" defaultValue="ALL_LEVELS" required>
                {Object.entries(eventLevelLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="recurrence">Récurrence</Label>
              <Select id="recurrence" name="recurrence" defaultValue="ONE_OFF" required>
                {Object.entries(eventRecurrenceLabels).map(([value, label]) => (
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
              rows={3}
              placeholder="Ambiance, matériel apporté, niveau attendu..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="city">Ville</Label>
              <Input id="city" name="city" placeholder="ex. Lyon" required />
            </div>
            <div>
              <Label htmlFor="location">Lieu (optionnel)</Label>
              <Input id="location" name="location" placeholder="ex. Café des Jeux, 12 rue..." />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startAt">Date et heure</Label>
              <Input id="startAt" name="startAt" type="datetime-local" required />
            </div>
            <div>
              <Label htmlFor="maxParticipants">Places (optionnel)</Label>
              <Input id="maxParticipants" name="maxParticipants" type="number" min={1} placeholder="ex. 6" />
            </div>
          </div>

          <ErrorText>{state?.error}</ErrorText>
          <Button type="submit" disabled={pending} className="mt-2">
            {pending ? "Création..." : "Créer l'événement"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
