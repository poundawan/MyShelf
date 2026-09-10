import { requireUser } from "@/lib/auth";

// Garde de rendu : le formulaire ne s'affiche pas du tout à un visiteur
// déconnecté, plutôt que de le laisser tout remplir avant de le renvoyer.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return children;
}
