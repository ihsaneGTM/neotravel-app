import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "NeoTravel — Devis transport de groupe en autocar",
  description: "Décrivez votre trajet, obtenez une estimation, un commercial vous rappelle.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
