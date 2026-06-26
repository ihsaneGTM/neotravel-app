import "./globals.css";
import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
// Typo d'affichage de la marque (déjà utilisée sur la landing) — exposée globalement
// pour le back-office (titres/chiffres du dashboard).
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap", weight: ["500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: "NeoTravel — Sales command center",
  description: "Décrivez votre trajet, obtenez une estimation, un commercial vous rappelle.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${inter.variable} ${jakarta.variable}`}>
      <body>{children}</body>
    </html>
  );
}
