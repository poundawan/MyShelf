"use client";

import { useActionState, useState } from "react";
import { createEventAction } from "@/lib/actions/events";
import { Button, Input, Label, Textarea, Card, Badge, ErrorText } from "@/components/ui";
import { eventTypeLabels, eventTypeEmoji, playerLevelLabels } from "@/lib/labels";
import { cn } from "@/lib/utils";

export default function NewEventPage() {
  const [state, formAction, pending] = useActionState(createEventAction, undefined);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<keyof typeof eventTypeLabels>("BOARD_GAME");
  const [level, setLevel] = useState<keyof typeof playerLevelLabels>("BEGINNER");
  const [city, setCity] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("");

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="text-xs font-bold uppercase tracking-widest text-gold">Nouvelle table</div>
      <h1 className="mt-1 font-display text-3xl text-cream">Ouvrir une table</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Une aprem jeux, un weekend de JdR, un draft du jeudi : quatre champs et c&apos;est en ligne.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
        <Card className="p-6">
          <form action={formAction} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="title">Titre</Label>
              <Input id="title" name="title" placeholder="Aprem jeux au Comptoir" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>

            <div>
              <Label>Type de jeu</Label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(eventTypeLabels).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setType(value as keyof typeof eventTypeLabels)}
                    className={cn(
                      "rounded-sm border px-3.5 py-2 text-sm font-bold",
                      type === value ? "border-gold bg-gold text-gold-ink" : "border-border-strong text-ink-soft",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <input type="hidden" name="type" value={type} />
            </div>

            <div>
              <Label>Niveau attendu</Label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(playerLevelLabels).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setLevel(value as keyof typeof playerLevelLabels)}
                    className={cn(
                      "rounded-sm border px-3.5 py-2 text-sm font-bold",
                      level === value ? "border-rust bg-rust text-cream" : "border-border-strong text-ink-soft",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <input type="hidden" name="level" value={level} />
              {level === "BEGINNER" && <p className="mt-2 text-xs text-ink-soft">On explique les règles sur place, personne ne reste sur le banc.</p>}
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={3} placeholder="Au programme, l'ambiance, ce qu'il faut savoir..." />
            </div>
            <div>
              <Label htmlFor="bringList">À apporter (optionnel)</Label>
              <Input id="bringList" name="bringList" placeholder="Rien d'obligatoire, tes dés si tu en as..." />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city">Ville</Label>
                <Input id="city" name="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Lyon 7e" required />
              </div>
              <div>
                <Label htmlFor="location">Lieu</Label>
                <Input id="location" name="location" placeholder="Comptoir des Halles, Lyon 7e" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="startAt">Début</Label>
                <Input id="startAt" name="startAt" type="datetime-local" required />
              </div>
              <div>
                <Label htmlFor="endAt">Fin (optionnel)</Label>
                <Input id="endAt" name="endAt" type="datetime-local" />
              </div>
              <div>
                <Label htmlFor="maxParticipants">Places</Label>
                <Input id="maxParticipants" name="maxParticipants" type="number" min={1} value={maxParticipants} onChange={(e) => setMaxParticipants(e.target.value)} placeholder="6" />
              </div>
            </div>

            <ErrorText>{state?.error}</ErrorText>
            <Button type="submit" disabled={pending} className="mt-2">
              {pending ? "Publication..." : "Publier"}
            </Button>
          </form>
        </Card>

        <div className="lg:sticky lg:top-20">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-ink-soft">Aperçu de la carte</div>
          <Card className="overflow-hidden">
            <div className="flex aspect-[4/3] items-center justify-center bg-surface-2 text-xs uppercase tracking-widest text-ink-soft/40">
              visuel évènement
            </div>
            <div className="p-4">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="primary">{eventTypeEmoji[type]} {eventTypeLabels[type]}</Badge>
                <Badge variant="outline">{playerLevelLabels[level]}</Badge>
              </div>
              <div className="mt-2 font-display text-base text-cream">{title || "Ta table, sans titre"}</div>
              <div className="mt-2 text-xs text-ink-soft">
                {"Lieu à préciser"}
                <br />
                {maxParticipants ? `${maxParticipants} places` : "Places libres"} · {city || "Ville"}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
