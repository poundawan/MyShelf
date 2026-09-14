"use client";

import { useActionState, useState } from "react";
import type { ActionState } from "@/lib/actions/auth";
import { Button, Input, Label, Textarea, Card, Badge, ErrorText } from "@/components/ui";
import { PhotoInput } from "@/components/photo-input";
import { CommuneInput } from "@/components/commune-input";
import { eventTypeEmoji } from "@/lib/labels";
import { eventTypes, playerLevels } from "@/lib/validation";
import { FREQUENCES, MAX_SEANCES, compterSeances, type Frequence } from "@/lib/recurrence";
import { useT } from "@/lib/i18n/client";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/lib/i18n/types";
import { cn } from "@/lib/utils";

export type EventFormValues = {
  photoUrl: string | null;
  communeCode: string | null;
  title: string;
  type: string;
  level: string;
  languages: string[];
  description: string;
  bringList: string;
  city: string;
  location: string;
  startAt: string;
  endAt: string;
  maxParticipants: string;
};

const EMPTY: EventFormValues = {
  photoUrl: null, communeCode: null, title: "", type: "BOARD_GAME", level: "BEGINNER", languages: ["FR"], description: "", bringList: "",
  city: "", location: "", startAt: "", endAt: "", maxParticipants: "",
};

/**
 * Formulaire partagé entre l'ouverture d'une table et sa modification : les
 * deux écrans doivent proposer exactement les mêmes champs, sinon un
 * organisateur perd des informations en éditant.
 */
export function EventForm({
  action,
  values = EMPTY,
  submitLabel,
  pendingLabel,
  recurrence = false,
  dansUneSerie = false,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  values?: EventFormValues;
  submitLabel: string;
  pendingLabel: string;
  /** Proposer une cadence. Réservé à l'ouverture : une série se décide une fois. */
  recurrence?: boolean;
  /** La séance modifiée fait partie d'une série : proposer d'en répercuter la correction. */
  dansUneSerie?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const t = useT();
  const [title, setTitle] = useState(values.title);
  const [type, setType] = useState(values.type);
  const [level, setLevel] = useState(values.level);
  const [languages, setLanguages] = useState<string[]>(values.languages);
  const [city, setCity] = useState(values.city);
  const [location, setLocation] = useState(values.location);
  const [maxParticipants, setMaxParticipants] = useState(values.maxParticipants);
  const [startAt, setStartAt] = useState(values.startAt);
  const [frequency, setFrequency] = useState("");
  const [untilAt, setUntilAt] = useState("");

  // Compte annoncé avant d'écrire quoi que ce soit : personne ne doit
  // découvrir après coup qu'il vient de créer cinquante-deux tables.
  const debut = startAt ? new Date(startAt) : null;
  const fin = untilAt ? new Date(`${untilAt}T23:59:59`) : null;
  const seances =
    frequency && debut && fin && !Number.isNaN(debut.getTime()) && !Number.isNaN(fin.getTime()) && fin > debut
      ? compterSeances(debut, frequency as Frequence, fin)
      : null;

  /**
   * Au premier choix de cadence, propose trois mois : une date de fin vide
   * ferait échouer l'envoi, et « pour toujours » n'existe pas ici.
   */
  function choisirFrequence(valeur: string) {
    setFrequency(valeur);
    if (valeur && !untilAt && debut && !Number.isNaN(debut.getTime())) {
      const defaut = new Date(debut);
      defaut.setMonth(defaut.getMonth() + 3);
      setUntilAt(defaut.toISOString().slice(0, 10));
    }
  }

  // Une table doit se jouer dans au moins une langue : on empêche de décocher
  // la dernière plutôt que de laisser le serveur refuser après coup.
  function toggleLanguage(value: Locale) {
    setLanguages((prev) =>
      prev.includes(value)
        ? prev.length > 1 ? prev.filter((l) => l !== value) : prev
        : [...prev, value],
    );
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
      <Card className="p-6">
        <form action={formAction} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="title">{t("event.field.title")}</Label>
            <Input id="title" name="title" placeholder={t("event.field.title.placeholder")} value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          <div>
            <Label>{t("event.field.type")}</Label>
            <div className="flex flex-wrap gap-2">
              {eventTypes.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setType(value)}
                  aria-pressed={type === value}
                  className={cn(
                    "rounded-sm border px-3.5 py-2 text-sm font-bold",
                    type === value ? "border-gold bg-gold text-gold-ink" : "border-border-strong text-ink-soft",
                  )}
                >
                  {t(`eventType.${value}`)}
                </button>
              ))}
            </div>
            <input type="hidden" name="type" value={type} />
          </div>

          <div>
            <Label>{t("event.field.languages")}</Label>
            <div className="flex flex-wrap gap-2">
              {LOCALES.map((value) => {
                const selected = languages.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleLanguage(value)}
                    aria-pressed={selected}
                    className={cn(
                      "rounded-sm border px-3.5 py-2 text-sm font-bold",
                      selected ? "border-gold bg-gold text-gold-ink" : "border-border-strong text-ink-soft",
                    )}
                  >
                    {LOCALE_NAMES[value]}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-ink-soft">{t("event.field.languages.help")}</p>
            {languages.map((value) => (
              <input key={value} type="hidden" name="languages" value={value} />
            ))}
          </div>

          <div>
            <Label>{t("event.field.level")}</Label>
            <div className="flex flex-wrap gap-2">
              {playerLevels.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setLevel(value)}
                  aria-pressed={level === value}
                  className={cn(
                    "rounded-sm border px-3.5 py-2 text-sm font-bold",
                    level === value ? "border-rust bg-rust text-cream" : "border-border-strong text-ink-soft",
                  )}
                >
                  {t(`level.${value}`)}
                </button>
              ))}
            </div>
            <input type="hidden" name="level" value={level} />
            {level === "BEGINNER" && <p className="mt-2 text-xs text-ink-soft">{t("event.field.level.beginnerNote")}</p>}
          </div>

          <div>
            <Label htmlFor="description">{t("event.field.description")}</Label>
            <Textarea id="description" name="description" rows={3} defaultValue={values.description} placeholder={t("event.field.description.placeholder")} />
          </div>
          <div>
            <Label htmlFor="bringList">{t("event.field.bring")}</Label>
            <Input id="bringList" name="bringList" defaultValue={values.bringList} placeholder={t("event.field.bring.placeholder")} />
          </div>

          <PhotoInput name="photo" label={t("event.field.photo")} currentUrl={values.photoUrl} ratio="aspect-[16/5]" />

          <div className="grid grid-cols-2 gap-4">
            <CommuneInput
              label={t("event.field.city")}
              defaultValue={values.city}
              defaultCode={values.communeCode}
              onChange={setCity}
              required
            />
            <div>
              <Label htmlFor="location">{t("event.field.location")}</Label>
              <Input id="location" name="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t("event.field.location.placeholder")} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="startAt">{t("event.field.start")}</Label>
              <Input id="startAt" name="startAt" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="endAt">{t("event.field.end")}</Label>
              <Input id="endAt" name="endAt" type="datetime-local" defaultValue={values.endAt} />
            </div>
            <div>
              <Label htmlFor="maxParticipants">{t("event.field.max")}</Label>
              <Input id="maxParticipants" name="maxParticipants" type="number" min={1} value={maxParticipants} onChange={(e) => setMaxParticipants(e.target.value)} placeholder="6" />
            </div>
          </div>

          {recurrence && (
            <div>
              <Label>{t("event.field.recurrence")}</Label>
              <div className="flex flex-wrap gap-2">
                {["", ...FREQUENCES].map((valeur) => (
                  <button
                    key={valeur || "NONE"}
                    type="button"
                    onClick={() => choisirFrequence(valeur)}
                    aria-pressed={frequency === valeur}
                    className={cn(
                      "rounded-sm border px-3.5 py-2 text-sm font-bold",
                      frequency === valeur ? "border-gold bg-gold text-gold-ink" : "border-border-strong text-ink-soft",
                    )}
                  >
                    {t(`recurrence.${valeur || "NONE"}`)}
                  </button>
                ))}
              </div>
              <input type="hidden" name="frequency" value={frequency} />
              {frequency && (
                <div className="mt-3">
                  <Label htmlFor="untilAt">{t("event.field.until")}</Label>
                  <Input
                    id="untilAt"
                    name="untilAt"
                    type="date"
                    value={untilAt}
                    onChange={(e) => setUntilAt(e.target.value)}
                    required
                  />
                  <p className="mt-2 text-xs text-ink-soft">
                    {seances === null
                      ? t("event.field.until.help")
                      : seances > MAX_SEANCES
                        ? t("event.field.until.tooMany", { max: MAX_SEANCES })
                        : t("event.field.until.count", { count: seances })}
                  </p>
                </div>
              )}
            </div>
          )}

          {dansUneSerie && (
            <label className="flex items-start gap-2 rounded-sm border border-border-strong p-3 text-sm text-ink-soft">
              <input type="checkbox" name="applyToSeries" value="1" className="mt-0.5" />
              <span>
                <span className="font-bold text-cream">{t("event.field.applyToSeries")}</span>
                <br />
                {t("event.field.applyToSeries.help")}
              </span>
            </label>
          )}

          <ErrorText>{state?.error}</ErrorText>
          <Button type="submit" disabled={pending} className="mt-2">
            {pending ? pendingLabel : submitLabel}
          </Button>
        </form>
      </Card>

      <div className="lg:sticky lg:top-20">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-ink-soft">{t("event.preview")}</div>
        <Card className="overflow-hidden">
          <div className="flex aspect-[4/3] items-center justify-center bg-surface-2 text-xs uppercase tracking-widest text-ink-soft/65">
            {t("event.placeholder.preview")}
          </div>
          <div className="p-4">
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="primary">{eventTypeEmoji[type]} {t(`eventType.${type}`)}</Badge>
              <Badge variant="outline">{t(`level.${level}`)}</Badge>
            </div>
            <div className="mt-2 font-display text-base text-cream">{title || t("event.preview.untitled")}</div>
            <div className="mt-1.5 text-xs text-gold">
              {t("event.languages", { languages: languages.map((l) => LOCALE_NAMES[l as Locale]).join(" · ") })}
            </div>
            <div className="mt-2 text-xs text-ink-soft">
              {location || t("event.preview.noLocation")}
              <br />
              {maxParticipants ? t("common.places", { count: Number(maxParticipants) }) : t("event.preview.freePlaces")} · {city || t("event.preview.city")}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
