import { createEventAction } from "@/lib/actions/events";
import { EventForm } from "@/components/event-form";

export default function NewEventPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="text-xs font-bold uppercase tracking-widest text-gold">Nouvelle table</div>
      <h1 className="mt-1 font-display text-3xl text-cream">Ouvrir une table</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Une aprem jeux, un weekend de JdR, un draft du jeudi : quatre champs et c&apos;est en ligne.
      </p>

      <div className="mt-8">
        <EventForm action={createEventAction} submitLabel="Publier" pendingLabel="Publication..." />
      </div>
    </div>
  );
}
