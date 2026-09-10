"use client";

import { useActionState, useState } from "react";
import type { ActionState } from "@/lib/actions/auth";
import { Button, Textarea, ErrorText } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
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
  const t = useT();

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name={hiddenField} value={hiddenValue} />
      <input type="hidden" name="rating" value={rating} />
      <p className="text-sm font-bold text-cream">{title}</p>
      <div className="-mx-1 flex">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            className={cn(
              "flex size-10 items-center justify-center text-2xl leading-none transition-colors",
              n <= rating ? "text-gold" : "text-border-strong",
            )}
            aria-label={t("review.stars", { count: n })}
          >
            ★
          </button>
        ))}
      </div>
      <Textarea name="comment" rows={3} placeholder={t("review.comment.placeholder")} required />
      <ErrorText>{state?.error}</ErrorText>
      <Button type="submit" disabled={pending} size="sm" className="self-start">
        {pending ? t("review.pending") : t("review.submit")}
      </Button>
    </form>
  );
}
