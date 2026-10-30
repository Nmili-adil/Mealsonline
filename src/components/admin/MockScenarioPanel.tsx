"use client";

import { useEffect, useState } from "react";
import { useAdmin } from "./AdminProvider";

interface MockScenarioState {
  mode: string;
  scenario: "normal" | "pos_offline" | "ambiguous_timeout";
  unavailableProducts: string[];
}

const SCENARIOS = [
  { value: "normal", label: "Normal", hint: "Catalogue et commandes fonctionnent." },
  { value: "pos_offline", label: "POS hors ligne", hint: "Les soumissions échouent (jamais de fausse confirmation)." },
  { value: "ambiguous_timeout", label: "Timeout ambigu", hint: "La 1re soumission expire mais le POS accepte — réconcilié par l'outbox." },
] as const;

/** Dev/demo control for the file-backed mock Caisse212 provider. */
export function MockScenarioPanel() {
  const { csrfToken } = useAdmin();
  const [state, setState] = useState<MockScenarioState | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/mock-scenario", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => data && setState(data))
      .catch(() => undefined);
  }, []);

  const setScenario = async (scenario: MockScenarioState["scenario"]) => {
    setMessage(null);
    try {
      const response = await fetch("/api/admin/mock-scenario", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ scenario }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? "Impossible de changer le scénario");
      } else {
        setState((current) => (current ? { ...current, scenario } : current));
        setMessage(`Scénario appliqué : ${scenario}`);
      }
    } catch {
      setMessage("Erreur réseau");
    }
  };

  if (!state) {
    return <div className="admin-card"><h3>Scénario mock</h3><p style={{ color: "#a3aca6", fontSize: 13 }}>Chargement…</p></div>;
  }

  return (
    <div className="admin-card">
      <h3>Scénario mock (développement)</h3>
      <p style={{ color: "#a3aca6", fontSize: 13, margin: "0 0 12px" }}>
        Simule les comportements du POS pour tester la robustesse de l'intégration.
        Désactivé automatiquement en production.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {SCENARIOS.map((scenario) => (
          <button
            type="button"
            key={scenario.value}
            className="option-pill"
            aria-pressed={state.scenario === scenario.value}
            onClick={() => setScenario(scenario.value)}
          >
            {scenario.label}
          </button>
        ))}
      </div>
      <p style={{ color: "#7c857f", fontSize: 12, margin: "10px 0 0" }}>
        {SCENARIOS.find((scenario) => scenario.value === state.scenario)?.hint}
      </p>
      {state.unavailableProducts.length > 0 ? (
        <p style={{ color: "#ff8a8a", fontSize: 12, margin: "8px 0 0" }}>
          Produits indisponibles simulés : {state.unavailableProducts.join(", ")}
        </p>
      ) : null}
      {message ? <p style={{ color: "var(--green)", fontSize: 12, margin: "10px 0 0" }}>{message}</p> : null}
    </div>
  );
}
