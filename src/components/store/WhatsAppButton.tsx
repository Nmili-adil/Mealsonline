import { WhatsappLogo } from "@phosphor-icons/react/dist/ssr";

export function WhatsAppButton({ phone }: { phone?: string | null }) {
  const number = (phone ?? "+212600000000").replace(/\D/g, "");
  const href = `https://wa.me/${number}?text=${encodeURIComponent(
    "Bonjour MealsOnline, je souhaite passer une commande.",
  )}`;
  return (
    <a
      className="whatsapp"
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="Commander sur WhatsApp"
      style={{ position: "fixed" }}
    >
      <WhatsappLogo weight="fill" aria-hidden="true" />
    </a>
  );
}
