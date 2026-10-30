import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource/archivo-black/400.css";
import "@fontsource-variable/manrope";
import "./globals.css";
import { CartProvider } from "@/components/store/CartProvider";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "MealsOnline | Trois envies. Une seule adresse.",
    template: "%s | MealsOnline",
  },
  description:
    "PizzaHub, CIAO PASTA et Smash It Burgers, préparés à Hay Izdihar, Marrakech. Commande en ligne, livraison et retrait.",
  openGraph: {
    title: "MealsOnline | Trois envies. Une seule adresse.",
    description:
      "Pizza artisanale, pasta généreuse et smash burgers à Hay Izdihar, Marrakech.",
    locale: "fr_MA",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
