import Link from "next/link";
import Image from "next/image";
import { MapPin } from "@phosphor-icons/react/dist/ssr";

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="footer-inner page-width">
        <Link href="/" aria-label="MealsOnline, retour à l'accueil">
          <Image src="/images/logo-mealsonline-clean.png" alt="MealsOnline" width={150} height={48} />
        </Link>
        <nav aria-label="Navigation de pied de page">
          <Link href="/menu">Menu</Link>
          <Link href="/about">À propos</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/privacy">Confidentialité</Link>
          <Link href="/terms">Conditions</Link>
        </nav>
        <span className="footer-location">
          <MapPin weight="fill" aria-hidden="true" /> Hay Izdihar, Marrakech
        </span>
      </div>
    </footer>
  );
}
