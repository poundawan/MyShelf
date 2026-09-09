"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction } from "@/lib/actions/auth";
import { Button, Input, Label, Card, ErrorText } from "@/components/ui";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16 sm:px-6">
      <div className="text-xs font-bold uppercase tracking-widest text-gold">Bienvenue</div>
      <h1 className="mt-1 font-display text-3xl text-cream">Connexion</h1>
      <p className="mt-2 text-sm text-ink-soft">Content de te revoir à la table.</p>

      <Card className="mt-8 p-6">
        <form action={formAction} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div>
            <Label htmlFor="password">Mot de passe</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          <ErrorText>{state?.error}</ErrorText>
          <Button type="submit" disabled={pending} className="mt-2">
            {pending ? "Connexion..." : "Se connecter"}
          </Button>
        </form>
      </Card>

      <p className="mt-6 text-center text-sm text-ink-soft">
        Pas encore de compte ?{" "}
        <Link href="/register" className="font-bold text-gold hover:underline">
          Créer un compte
        </Link>
      </p>
    </div>
  );
}
