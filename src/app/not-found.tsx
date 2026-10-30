import Link from "next/link";

export default function NotFound() {
  return (
    <div className="site-shell" style={{ minHeight: "70vh", display: "grid", placeItems: "center" }}>
      <div className="empty-state" style={{ maxWidth: 480 }}>
        <h3>Page introuvable</h3>
        <p>La page que vous cherchez n'existe pas ou a été déplacée.</p>
        <Link href="/" className="button button-compact" style={{ marginTop: 16 }}>
          Retour à l'accueil
        </Link>
      </div>
    </div>
  );
}
