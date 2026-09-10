"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerAction } from "@/lib/actions/auth";
import { Button, Input, Label, Card, ErrorText } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(registerAction, undefined);
  const t = useT();

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16 sm:px-6">
      <div className="text-xs font-bold uppercase tracking-widest text-gold">Nouveau joueur</div>
      <h1 className="mt-1 font-display text-3xl text-cream">{t("auth.register.title")}</h1>
      <p className="mt-2 text-sm text-ink-soft">{t("auth.register.lede")}</p>

      <Card className="mt-8 p-6">
        <form action={formAction} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="name">{t("auth.field.name")}</Label>
            <Input id="name" name="name" autoComplete="name" required />
          </div>
          <div>
            <Label htmlFor="city">{t("auth.field.city")}</Label>
            <Input id="city" name="city" placeholder={t("auth.field.city.placeholder")} autoComplete="address-level2" required />
          </div>
          <div>
            <Label htmlFor="email">{t("auth.field.email")}</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div>
            <Label htmlFor="password">{t("auth.field.password")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <ErrorText>{state?.error}</ErrorText>
          <Button type="submit" disabled={pending} className="mt-2">
            {pending ? t("auth.register.pending") : t("auth.register.submit")}
          </Button>
        </form>
      </Card>

      <p className="mt-6 text-center text-sm text-ink-soft">
        {t("auth.register.hasAccount")}{" "}
        <Link href="/login" className="font-bold text-gold hover:underline">
          {t("auth.register.goLogin")}
        </Link>
      </p>
    </div>
  );
}
