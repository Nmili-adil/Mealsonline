import { getStorefrontMode } from "@/lib/caisse212/storefront/mode";

/** Clearly labels the local fixture mode (never presented as live data). */
export function StorefrontModeBanner() {
  if (getStorefrontMode() !== "fixtures") return null;
  return (
    <div
      role="status"
      style={{
        background: "#3a2f00",
        color: "#ffe58a",
        borderBottom: "1px solid #6b5500",
        padding: "8px 16px",
        fontSize: 12,
        textAlign: "center",
      }}
    >
      Mode démonstration — le menu et la configuration proviennent de fixtures locales,
      pas de Caisse212.
    </div>
  );
}
