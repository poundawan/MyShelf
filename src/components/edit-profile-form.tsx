"use client";

import { useActionState } from "react";
import { updateProfileAction } from "@/lib/actions/users";
import { Button, Input, Label, Select, Textarea, ErrorText } from "@/components/ui";
import { playerLevels } from "@/lib/validation";
import { useT } from "@/lib/i18n/client";
import { LOCALES, LOCALE_NAMES } from "@/lib/i18n/types";

type ProfileData = {
  name: string;
  city: string;
  bio: string | null;
  experienceLevel: string;
  avatarUrl: string | null;
  locale: string;
};

export function EditProfileForm({ user }: { user: ProfileData }) {
  const [state, formAction, pending] = useActionState(updateProfileAction, undefined);
  const t = useT();

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="name">{t("profile.field.name")}</Label>
        <Input id="name" name="name" defaultValue={user.name} required />
      </div>
      <div>
        <Label htmlFor="city">{t("profile.field.city")}</Label>
        <Input id="city" name="city" defaultValue={user.city} required />
      </div>
      <div>
        <Label htmlFor="experienceLevel">{t("profile.field.level")}</Label>
        <Select id="experienceLevel" name="experienceLevel" defaultValue={user.experienceLevel} required>
          {playerLevels.map((value) => (
            <option key={value} value={value}>{t(`level.${value}`)}</option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="locale">{t("profile.field.locale")}</Label>
        <Select id="locale" name="locale" defaultValue={user.locale} required>
          {LOCALES.map((value) => (
            // Chaque langue s'affiche dans sa propre langue : c'est ainsi qu'on
            // la reconnaît quand on ne comprend pas celle de l'interface.
            <option key={value} value={value}>{LOCALE_NAMES[value]}</option>
          ))}
        </Select>
        <p className="mt-1.5 text-xs text-ink-soft">{t("profile.field.locale.help")}</p>
      </div>

      <div>
        <Label htmlFor="bio">{t("profile.field.bio")}</Label>
        <Textarea id="bio" name="bio" rows={3} defaultValue={user.bio ?? ""} placeholder={t("profile.field.bio.placeholder")} />
      </div>
      <div>
        <Label htmlFor="avatarUrl">{t("profile.field.avatar")}</Label>
        <Input id="avatarUrl" name="avatarUrl" type="url" defaultValue={user.avatarUrl ?? ""} placeholder="https://..." />
      </div>
      <ErrorText>{state?.error}</ErrorText>
      <Button type="submit" disabled={pending} className="mt-2">
        {pending ? t("common.saving") : t("common.save")}
      </Button>
    </form>
  );
}
