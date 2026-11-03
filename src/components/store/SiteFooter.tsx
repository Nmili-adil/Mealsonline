import Link from "next/link";
import { MapPin } from "@phosphor-icons/react/dist/ssr";

export function SiteFooter({
  logoSrc,
  restaurantName,
  address,
  footerText,
  social,
}: {
  logoSrc?: string | null;
  restaurantName?: string | null;
  address?: string | null;
  footerText?: string | null;
  social?: Record<string, unknown>;
} = {}) {
  const logo = logoSrc || "/images/logo-mealsonline-clean.png";
  const name = restaurantName || "MealsOnline";
  const socialLinks = Object.entries(social ?? {}).filter(
    ([key, value]) =>
      ["instagram", "facebook", "tiktok"].includes(key) &&
      typeof value === "string" &&
      /^https?:\/\//.test(value),
  ) as Array<[string, string]>;

  return (
    <footer className="footer">
      <div className="footer-inner page-width">
        <Link href="/" aria-label={`${name}, retour à l'accueil`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- storefront logo may be any configured URL */}
          <img src={logo} alt={name} width={150} height={48} style={{ objectFit: "contain" }} />
        </Link>
        <nav aria-label="Navigation de pied de page">
          <Link href="/menu">Menu</Link>
          <Link href="/about">À propos</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/privacy">Confidentialité</Link>
          <Link href="/terms">Conditions</Link>
          {socialLinks.map(([key, href]) => (
            <a key={key} href={href} target="_blank" rel="noreferrer">
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </a>
          ))}
        </nav>
        <span className="footer-location">
          <MapPin weight="fill" aria-hidden="true" />
          {address || "Hay Izdihar, Marrakech"}
        </span>
      </div>
      {footerText ? (
        <div className="page-width" style={{ paddingBottom: 20, color: "#7c857f", fontSize: 12 }}>
          {footerText}
        </div>
      ) : null}
    </footer>
  );
}
