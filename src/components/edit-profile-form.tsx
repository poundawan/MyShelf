"use client";

import { useActionState } from "react";
import { updateProfileAction } from "@/lib/actions/users";
import { Button, Input, Label, Select, Textarea, ErrorText } from "@/components/ui";
import { playerLevelLabels } from "@/lib/labels";

type ProfileData = {
  name: string;
  city: string;
  bio: string | null;
  experienceLevel: string;
  avatarUrl: string | null;
};

export function EditProfileForm({ user }: { user: ProfileData }) {
  const [state, formAction, pending] = useActionState(updateProfileAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="name">Nom</Label>
        <Input id="name" name="name" defaultValue={user.name} required />
      </div>
      <div>
        <Label htmlFor="city">Ville</Label>
        <Input id="city" name="city" defaultValue={user.city} required />
      </div>
      <div>
        <Label htmlFor="experienceLevel">Ton niveau</Label>
        <Select id="experienceLevel" name="experienceLevel" defaultValue={user.experienceLevel} required>
          {Object.entries(playerLevelLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="bio">Bio</Label>
        <Textarea id="bio" name="bio" rows={3} defaultValue={user.bio ?? ""} placeholder="Ce que tu aimes jouer, ta disponibilité..." />
      </div>
      <div>
        <Label htmlFor="avatarUrl">Photo (URL, optionnel)</Label>
        <Input id="avatarUrl" name="avatarUrl" type="url" defaultValue={user.avatarUrl ?? ""} placeholder="https://..." />
      </div>
      <ErrorText>{state?.error}</ErrorText>
      <Button type="submit" disabled={pending} className="mt-2">
        {pending ? "Enregistrement..." : "Enregistrer"}
      </Button>
    </form>
  );
}
