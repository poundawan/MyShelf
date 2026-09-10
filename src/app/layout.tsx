import type { Metadata, Viewport } from "next";
import { Bevan, Karla } from "next/font/google";
import { Nav } from "@/components/nav";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${bevan.variable} ${karla.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-bg text-ink font-sans antialiased">
        <Nav />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
