import type { Metadata, Viewport } from "next";
import { Bevan, Karla } from "next/font/google";
import { Nav } from "@/components/nav";
import { getI18n } from "@/lib/i18n/server";
import { I18nProvider } from "@/lib/i18n/client";
import { BCP47 } from "@/lib/i18n/types";
import "./globals.css";

const bevan = Bevan({
  variable: "--font-bevan",
  subsets: ["latin"],
  weight: "400",
});

const karla = Karla({
  variable: "--font-karla",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "MyShelf — échange ludique entre joueurs",
  description:
    "Échange tes jeux de société, jeux de rôle et cartes, rejoins un club, ouvre une table.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Couleur de la barre d'adresse mobile, accordée au bandeau bois.
  themeColor: "#8a5a34",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const i18n = await getI18n();

  return (
    <html lang={BCP47[i18n.locale]} className={`${bevan.variable} ${karla.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-bg text-ink font-sans antialiased">
        <I18nProvider value={i18n}>
          <Nav />
          <main className="flex-1">{children}</main>
        </I18nProvider>
      </body>
    </html>
  );
}
