"use client";

import { useActionState } from "react";
import { sendMessageAction } from "@/lib/actions/trades";
import { Button, Input, ErrorText } from "@/components/ui";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  content: string;
  createdAt: Date;
  sender: { id: string; name: string };
};

export function MessageThread({
  tradeId,
  currentUserId,
  messages,
}: {
  tradeId: string;
  currentUserId: string;
  messages: Message[];
}) {
  const [state, formAction, pending] = useActionState(sendMessageAction, undefined);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun message pour l&apos;instant.</p>
        )}
        {messages.map((message) => {
          const isMine = message.sender.id === currentUserId;
          return (
            <div
              key={message.id}
              className={cn(
                "max-w-[80%] rounded-2xl px-4 py-2 text-sm",
                isMine ? "self-end bg-primary text-primary-foreground" : "self-start bg-border/50",
              )}
            >
              {!isMine && <p className="mb-0.5 text-xs font-medium opacity-70">{message.sender.name}</p>}
              {message.content}
            </div>
          );
        })}
      </div>

      <form action={formAction} className="flex items-center gap-2">
        <input type="hidden" name="tradeId" value={tradeId} />
        <Input name="content" placeholder="Écrire un message..." required className="flex-1" />
        <Button type="submit" disabled={pending} size="sm">
          Envoyer
        </Button>
      </form>
      <ErrorText>{state?.error}</ErrorText>
    </div>
  );
}
