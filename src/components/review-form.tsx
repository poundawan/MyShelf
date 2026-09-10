"use client";

import { useActionState, useState } from "react";
import type { ActionState } from "@/lib/actions/auth";
import { Button, Textarea, ErrorText } from "@/components/ui";
import { cn } from "@/lib/utils";

export function ReviewForm({
  action,
  hiddenField,
  hiddenValue,
  title,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  hiddenField: string;
  hiddenValue: string;
  title: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [rating, setRating] = useState(5);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name={hiddenField} value={hiddenValue} />
      <input type="hidden" name="rating" value={rating} />
      <p className="text-sm font-bold text-cream">{title}</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            className={cn("text-2xl leading-none transition-colors", n <= rating ? "text-gold" : "text-border-strong")}
            aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
          >
            ★
          </button>
        ))}
      </div>
      <Textarea name="comment" rows={3} placeholder="Comment ça s'est passé ?" required />
      <ErrorText>{state?.error}</ErrorText>
      <Button type="submit" disabled={pending} size="sm" className="self-start">
        {pending ? "Envoi..." : "Publier l'avis"}
      </Button>
    </form>
  );
}
