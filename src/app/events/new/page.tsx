import { createEventAction } from "@/lib/actions/events";
import { EventForm } from "@/components/event-form";
import { getT } from "@/lib/i18n/server";

export default async function NewEventPage() {
  const t = await getT();

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="text-xs font-bold uppercase tracking-widest text-gold">{t("event.new.eyebrow")}</div>
      <h1 className="mt-1 font-display text-3xl text-cream">{t("event.new.title")}</h1>
      <p className="mt-2 text-sm text-ink-soft">{t("event.new.lede")}</p>

      <div className="mt-8">
        <EventForm action={createEventAction} submitLabel={t("event.new.submit")} pendingLabel={t("event.new.pending")} />
      </div>
    </div>
  );
}
