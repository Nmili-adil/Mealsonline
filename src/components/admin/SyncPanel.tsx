"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "./AdminProvider";
import { formatDateTime } from "@/lib/utils";

interface SyncRun {
  id: string;
  mode: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  importedProducts: number;
  updatedProducts: number;
  archivedProducts: number;
  failedRecords: number;
  error: string | null;
}

interface SyncStatus {
  health: { mode: string; available: boolean; configured: boolean };
  cursor: { cursor: string | null; lastSyncAt: string | null } | null;
  totalProducts: number;
  runs: SyncRun[];
}

export function SyncPanel({ initial }: { initial: SyncStatus }) {
  const { csrfToken } = useAdmin();
  const [status, setStatus] = useState(initial);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/admin/sync", { cache: "no-store" });
    if (response.ok) setStatus(await response.json());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const trigger = async () => {
    setRunning(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/sync", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        body: "{}",
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? "Échec de la synchronisation");
      } else {
        setMessage(
          `Synchronisation terminée : ${data.result.importedProducts} importé(s), ${data.result.updatedProducts} mis à jour, ${data.result.archivedProducts} archivé(s).`,
        );
      }
      await refresh();
    } catch {
      setMessage("Erreur réseau pendant la synchronisation");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div>
      <div className="admin-grid" style={{ marginBottom: 18 }}>
        <div className="admin-stat">
          <strong>{status.health.mode}</strong>
          <span>Mode d'intégration</span>
        </div>
        <div className="admin-stat">
          <strong>{status.totalProducts}</strong>
          <span>Produits importés</span>
        </div>
        <div className="admin-stat">
          <strong>
            {status.cursor?.lastSyncAt ? formatDateTime(status.cursor.lastSyncAt) : "Jamais"}
          </strong>
          <span>Dernière synchronisation</span>
        </div>
        <div className="admin-stat">
          <strong style={{ color: status.health.available ? "var(--green)" : "#ff8a8a" }}>
            {status.health.available ? "OK" : "Indisponible"}
          </strong>
          <span>État de l'intégration</span>
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <button type="button" className="admin-button" onClick={trigger} disabled={running}>
          {running ? "Synchronisation…" : "Lancer l'import manuel"}
        </button>
        {message ? <p style={{ color: "#a3aca6", marginTop: 10 }}>{message}</p> : null}
      </div>

      <div className="admin-card" style={{ overflowX: "auto" }}>
        <h3>Dernières synchronisations</h3>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Début</th>
              <th>Mode</th>
              <th>Statut</th>
              <th>Importés</th>
              <th>Mis à jour</th>
              <th>Archivés</th>
              <th>Échecs</th>
              <th>Erreur</th>
            </tr>
          </thead>
          <tbody>
            {status.runs.map((run) => (
              <tr key={run.id}>
                <td style={{ fontSize: 12 }}>{formatDateTime(run.startedAt)}</td>
                <td>{run.mode}</td>
                <td>
                  <span
                    className={`badge ${
                      run.status === "success"
                        ? "badge-green"
                        : run.status === "partial"
                          ? "badge-amber"
                          : "badge-red"
                    }`}
                  >
                    {run.status}
                  </span>
                </td>
                <td>{run.importedProducts}</td>
                <td>{run.updatedProducts}</td>
                <td>{run.archivedProducts}</td>
                <td>{run.failedRecords}</td>
                <td style={{ fontSize: 12, color: "#ff8a8a" }}>{run.error ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
