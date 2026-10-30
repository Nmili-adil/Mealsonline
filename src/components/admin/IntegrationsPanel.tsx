"use client";

import { useEffect, useState } from "react";
import { MockScenarioPanel } from "./MockScenarioPanel";

interface Health {
  mode: string;
  available: boolean;
  configured: boolean;
  missingVariables: string[];
  webhookSecretConfigured: boolean;
  baseUrlSet: boolean;
}

export function IntegrationsPanel({ initial }: { initial: Health }) {
  const [health, setHealth] = useState(initial);

  useEffect(() => {
    fetch("/api/admin/integrations/status", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => data && setHealth(data))
      .catch(() => undefined);
  }, []);

  return (
    <div className="admin-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
      <div className="admin-card">
        <h3>État de l'intégration Caisse212</h3>
        <p style={{ margin: 0 }}>
          Mode : <strong>{health.mode}</strong>
        </p>
        <p style={{ margin: "6px 0 0" }}>
          Disponible :{" "}
          <span className={`badge ${health.available ? "badge-green" : "badge-red"}`}>
            {health.available ? "Oui" : "Non"}
          </span>
        </p>
        <p style={{ margin: "6px 0 0" }}>
          Configuré :{" "}
          <span className={`badge ${health.configured ? "badge-green" : "badge-amber"}`}>
            {health.configured ? "Complet" : "Incomplet"}
          </span>
        </p>
        {health.missingVariables.length > 0 ? (
          <p style={{ margin: "8px 0 0", color: "#ff8a8a", fontSize: 13 }}>
            Manquant : {health.missingVariables.join(", ")}
          </p>
        ) : null}
      </div>

      <div className="admin-card">
        <h3>Configuration requise</h3>
        <ul style={{ margin: 0, paddingLeft: 18, color: "#a3aca6", fontSize: 14, lineHeight: 1.8 }}>
          <li>CAISSE212_BASE_URL : {health.baseUrlSet ? "défini" : "manquant"}</li>
          <li>CAISSE212_CLIENT_ID / SECRET : {health.configured ? "définis" : "manquants"}</li>
          <li>
            CAISSE212_WEBHOOK_SECRET :{" "}
            {health.webhookSecretConfigured ? "défini" : "manquant"}
          </li>
        </ul>
      </div>

      <div className="admin-card">
        <h3>Rappel de sécurité</h3>
        <p style={{ color: "#a3aca6", fontSize: 14, lineHeight: 1.7, margin: 0 }}>
          Les secrets d'API ne sont jamais exposés au navigateur. Le mode mock est
          automatiquement refusé en production. En mode live, l'intégration échoue fermée
          tant que toutes les variables ne sont pas configurées.
        </p>
      </div>

      {health.mode === "mock" ? <MockScenarioPanel /> : null}
    </div>
  );
}
