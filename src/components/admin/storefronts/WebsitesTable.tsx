"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import type {
  StorefrontAdminRecord,
  StorefrontAdminPayload,
} from "@/lib/caisse212/storefront/types";
import type { StorefrontAdminIntegrationStatus } from "@/lib/caisse212/storefront/mode";

function publicBase(record: StorefrontAdminRecord): string {
  return record.publicUrl;
}

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString("fr-MA", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

function toPayload(record: StorefrontAdminRecord, active: boolean): StorefrontAdminPayload {
  return {
    slug: record.slug,
    name: record.name,
    businessId: record.businessId,
    allowedOrigins: record.allowedOrigins,
    active,
    data: record.data,
  };
}

export function WebsitesTable({
  initialStorefronts,
  initialError,
  status,
}: {
  initialStorefronts: StorefrontAdminRecord[];
  initialError: string | null;
  status: StorefrontAdminIntegrationStatus;
}) {
  const { csrfToken } = useAdmin();
  const [storefronts, setStorefronts] = useState(initialStorefronts);
  const [error, setError] = useState<string | null>(initialError);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StorefrontAdminRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return storefronts;
    return storefronts.filter(
      (record) =>
        record.name.toLowerCase().includes(term) || record.slug.toLowerCase().includes(term),
    );
  }, [search, storefronts]);

  const toggleActive = async (record: StorefrontAdminRecord) => {
    setBusyId(record.id);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/storefronts/${record.id}`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify(toPayload(record, !record.active)),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Impossible de mettre à jour le site");
      }
      setStorefronts((current) =>
        current.map((item) =>
          item.id === record.id ? (payload.storefront as StorefrontAdminRecord) : item,
        ),
      );
      setMessage(`« ${record.name} » ${record.active ? "désactivé" : "activé"}.`);
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Erreur réseau");
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/storefronts/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { "x-csrf-token": csrfToken },
      });
      if (!response.ok && response.status !== 204) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Impossible de supprimer le site");
      }
      setStorefronts((current) => current.filter((item) => item.id !== deleteTarget.id));
      setMessage(`« ${deleteTarget.name} » supprimé.`);
      setDeleteTarget(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Erreur réseau");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22 }}>Sites web</h2>
          <p style={{ margin: "4px 0 0", color: "#a3aca6", fontSize: 14 }}>
            Un site par configuration de menu, d&apos;apparence et d&apos;origines autorisées.
          </p>
        </div>
        <div style={{ flex: 1 }} />
        {status.mode !== "off" ? (
          <Link className="admin-button" href="/admin/websites/new">
            + Nouveau site
          </Link>
        ) : null}
      </div>

      {status.mode === "off" ? (
        <div className="admin-card" style={{ borderColor: "#8a6d00", marginBottom: 16 }}>
          <strong>Module Sites web désactivé</strong>
          <p style={{ color: "#a3aca6", fontSize: 13, marginBottom: 0 }}>
            Définissez <code>CAISSE212_STOREFRONT_MODE</code> sur <code>fixtures</code> (démo)
            ou <code>live</code> (Caisse212) pour activer la gestion des sites.
          </p>
        </div>
      ) : status.mode === "fixtures" ? (
        <div className="admin-card" style={{ borderColor: "#8a6d00", marginBottom: 16 }}>
          <strong>Mode fixtures</strong>
          <p style={{ color: "#a3aca6", fontSize: 13, marginBottom: 0 }}>
            Les sites affichés et modifiés ici sont des fixtures locales ({" "}
            <code>.data/storefront-fixtures.json</code>). Aucun appel d&apos;administration
            Caisse212 n&apos;est effectué.
          </p>
        </div>
      ) : !status.configured ? (
        <div className="admin-card" style={{ borderColor: "#b42318", marginBottom: 16 }}>
          <strong>Intégration admin Caisse212 non configurée</strong>
          <p style={{ color: "#a3aca6", fontSize: 13 }}>
            La connexion exige un jeton serveur et le contexte tenant/business :
          </p>
          <p style={{ color: "#ffb4ab", fontSize: 13, marginBottom: 0 }}>
            {status.missingVariables.join(", ")}
          </p>
        </div>
      ) : (
        <div className="admin-card" style={{ borderColor: "#2f6b3a", marginBottom: 16 }}>
          <strong>Connecté à Caisse212</strong>
          <p style={{ color: "#a3aca6", fontSize: 13, marginBottom: 0 }}>
            {status.baseUrl}
          </p>
        </div>
      )}

      {error ? (
        <div className="admin-card" style={{ borderColor: "#b42318", marginBottom: 16 }}>
          <strong>Aucun site chargé</strong>
          <p style={{ color: "#ffb4ab", fontSize: 13, marginBottom: 0 }}>{error}</p>
        </div>
      ) : null}
      {message ? (
        <div className="admin-card" style={{ borderColor: "#2f6b3a", marginBottom: 16 }}>
          <p style={{ color: "#9fe6a0", fontSize: 13, margin: 0 }}>{message}</p>
        </div>
      ) : null}

      {status.mode !== "off" ? (
        <>
          <div className="admin-card" style={{ marginBottom: 16 }}>
            <input
              className="admin-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher par nom ou slug…"
              aria-label="Rechercher un site"
            />
          </div>

          {visible.length === 0 ? (
            <div className="admin-card">
              <p style={{ margin: 0, color: "#a3aca6", fontSize: 14 }}>
                {storefronts.length === 0
                  ? "Aucun site pour le moment. Créez votre premier site."
                  : "Aucun site ne correspond à la recherche."}
              </p>
            </div>
          ) : (
            <div className="admin-card" style={{ overflowX: "auto" }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Slug</th>
                    <th>URL publique</th>
                    <th>Origines</th>
                    <th>Actif</th>
                    <th>Mis à jour</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((record) => (
                    <tr key={record.id}>
                      <td>
                        <strong>{record.name}</strong>
                        <div style={{ color: "#7c857f", fontSize: 11 }}>v{record.version}</div>
                      </td>
                      <td>
                        <code style={{ fontSize: 12 }}>{record.slug}</code>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <a
                            href={publicBase(record)}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: "#9fe6a0", fontSize: 12, maxWidth: 220 }}
                          >
                            {publicBase(record)}
                          </a>
                          <button
                            type="button"
                            className="admin-button admin-button-secondary"
                            style={{ fontSize: 11, padding: "4px 8px" }}
                            onClick={() => {
                              void navigator.clipboard.writeText(publicBase(record));
                              setMessage("URL publique copiée.");
                            }}
                          >
                            Copier
                          </button>
                        </div>
                      </td>
                      <td style={{ fontSize: 13 }}>
                        {record.allowedOrigins.includes("*")
                          ? "*"
                          : record.allowedOrigins.length}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="admin-button admin-button-secondary"
                          disabled={busyId === record.id}
                          onClick={() => void toggleActive(record)}
                          aria-pressed={record.active}
                        >
                          {record.active ? "Actif" : "Inactif"}
                        </button>
                      </td>
                      <td style={{ fontSize: 12, color: "#a3aca6" }}>
                        {formatDate(record.updatedAt)}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <Link
                            className="admin-button admin-button-secondary"
                            style={{ fontSize: 12, padding: "6px 10px" }}
                            href={`/admin/websites/${record.id}/edit`}
                          >
                            Modifier
                          </Link>
                          <a
                            className="admin-button admin-button-secondary"
                            style={{ fontSize: 12, padding: "6px 10px" }}
                            href={publicBase(record)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Ouvrir
                          </a>
                          <button
                            type="button"
                            className="admin-button admin-button-secondary"
                            style={{ fontSize: 12, padding: "6px 10px", color: "#ff8a8a" }}
                            onClick={() => setDeleteTarget(record)}
                          >
                            Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}

      {deleteTarget ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirmer la suppression"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 60,
            padding: 20,
          }}
        >
          <div className="admin-card" style={{ maxWidth: 480, width: "100%" }}>
            <h3 style={{ marginTop: 0 }}>Supprimer « {deleteTarget.name} » ?</h3>
            <p style={{ color: "#a3aca6", fontSize: 14 }}>
              Le site sera supprimé (suppression douce). Son URL publique cessera de
              fonctionner et son slug redeviendra disponible.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                className="admin-button admin-button-secondary"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Annuler
              </button>
              <button
                type="button"
                className="admin-button"
                style={{ background: "#b42318", borderColor: "#b42318" }}
                onClick={() => void confirmDelete()}
                disabled={deleting}
              >
                {deleting ? "Suppression…" : "Supprimer définitivement"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
