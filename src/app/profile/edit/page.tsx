import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Card } from "@/components/ui";
import { EditProfileForm } from "@/components/edit-profile-form";
import { getT } from "@/lib/i18n/server";

export default async function EditProfilePage() {
  const t = await getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <div className="text-xs font-bold uppercase tracking-widest text-gold">{t("profile.editPage.eyebrow")}</div>
      <h1 className="mt-1 font-display text-3xl text-cream">{t("profile.editPage.title")}</h1>

      <Card className="mt-8 p-6">
        <EditProfileForm user={user} />
      </Card>
    </div>
  );
}
