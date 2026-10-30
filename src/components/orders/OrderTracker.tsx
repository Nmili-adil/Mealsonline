"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatMAD } from "@/lib/money";
import { formatDateTime } from "@/lib/utils";

interface TrackingView {
  reference: string;
  status: string;
  acceptanceState: string;
  preparationState: string;
  paymentState: string;
  fulfillmentState: string;
  fulfillmentType: string;
  currency: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  createdAt: string;
  acceptedAt: string | null;
  items: Array<{
    name: string;
    variantName: string | null;
    quantity: number;
    totalPrice: number;
    modifiers: string[];
    notes: string | null;
  }>;
  restaurant: { name: string; address: string | null; phone: string | null; whatsappPhone: string | null };
  timeline: Array<{ eventType: string; toState: string | null; createdAt: string }>;
}

const STATUS_LABELS: Record<string, string> = {
  pending_submission: "En attente de transmission",
  submitted: "Transmise au restaurant",
  accepted: "Acceptée par le restaurant",
  preparing: "En préparation",
  ready: "Prête",
  dispatched: "En livraison",
  delivered: "Livrée",
  rejected: "Refusée",
  expired: "Expirée",
  cancelled: "Annulée",
  failed: "Échec de transmission",
};

export function OrderTracker({ reference }: { reference: string }) {
  const [token, setToken] = useState<string>("");
  const [data, setData] = useState<TrackingView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);

  useEffect(() => {
    const stored = sessionStorage.getItem(`mlo_tracking_${reference}`);
    if (stored) setToken(stored);
    setLoading(false);
  }, [reference]);

  const fetchOrder = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`/api/orders/${reference}`, {
        headers: { "x-tracking-token": token },
        cache: "no-store",
      });
      if (response.status === 401 || response.status === 404) {
        setError("Référence ou jeton de suivi invalide.");
        setData(null);
        return;
      }
      if (!response.ok) throw new Error("Erreur réseau");
      const view = (await response.json()) as TrackingView;
      setData(view);
      setError(null);
      attemptRef.current = 0;
      scheduleNext(5000);
    } catch {
      attemptRef.current += 1;
      scheduleNext(Math.min(5000 * 2 ** attemptRef.current, 30000));
    }
  }, [reference, token]);

  const scheduleNext = useCallback((delay: number) => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    pollTimer.current = setTimeout(() => {
      if (!document.hidden) void fetchOrder();
      else scheduleNext(5000);
    }, delay);
  }, [fetchOrder]);

  useEffect(() => {
    if (!token) return;
    void fetchOrder();
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [token, fetchOrder]);

  if (loading) {
    return <div className="order-track"><div className="empty-state"><h3>Chargement…</h3></div></div>;
  }

  if (!token) {
    return (
      <div className="order-track">
        <div className="admin-card">
          <h3>Suivi de commande</h3>
          <p style={{ color: "#a3aca6", fontSize: 14 }}>
            Saisissez le jeton de suivi reçu lors de la confirmation de votre commande.
          </p>
          <div className="form-grid">
            <div className="field">
              <input
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="Jeton de suivi"
                autoComplete="off"
              />
            </div>
            <button type="button" className="admin-button" onClick={() => void fetchOrder()}>
              Suivre la commande
            </button>
          </div>
          {error ? <p className="field-error">{error}</p> : null}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="order-track">
        <div className="empty-state">
          <h3>Suivi indisponible</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="order-track"><div className="empty-state"><h3>Chargement…</h3></div></div>;
  }

  const steps: Array<{ key: string; label: string; active: boolean; done: boolean }> = [
    { key: "accepted", label: "Acceptée", active: data.acceptanceState === "accepted", done: data.acceptanceState === "accepted" },
    { key: "preparing", label: "En préparation", active: ["preparing", "ready", "dispatched", "delivered"].includes(data.preparationState), done: ["ready", "dispatched", "delivered"].includes(data.preparationState) },
    { key: "ready", label: "Prête", active: ["ready", "dispatched", "delivered"].includes(data.preparationState), done: ["dispatched", "delivered"].includes(data.preparationState) },
    {
      key: data.fulfillmentType === "delivery" ? "delivered" : "completed",
      label: data.fulfillmentType === "delivery" ? "Livrée" : "Récupérée",
      active: data.preparationState === "delivered" || data.fulfillmentState === "completed",
      done: false,
    },
  ];

  return (
    <div className="order-track">
      <div className="page-head" style={{ paddingTop: 10 }}>
        <h1>Commande {data.reference}</h1>
        <p>
          Statut : <strong style={{ color: "var(--green)" }}>{STATUS_LABELS[data.status] ?? data.status}</strong>
        </p>
      </div>

      <div className="track-steps">
        {steps.map((step) => (
          <div className="track-step" data-active={step.active || step.done} key={step.key}>
            <strong>{step.label}</strong>
            <span>{step.active ? "en cours" : step.done ? "terminé" : "à venir"}</span>
          </div>
        ))}
      </div>

      <div className="admin-card" style={{ marginBottom: 16 }}>
        <h3>Articles</h3>
        {data.items.map((item, index) => (
          <div className="summary-line" key={`${item.name}-${index}`} style={{ padding: "8px 0" }}>
            <span>
              {item.quantity}× {item.name} {item.variantName ? `(${item.variantName})` : ""}
              {item.modifiers.length > 0 ? (
                <>
                  <br />
                  <small style={{ color: "#7c857f" }}>{item.modifiers.join(", ")}</small>
                </>
              ) : null}
              {item.notes ? (
                <>
                  <br />
                  <small style={{ color: "#7c857f" }}>Note : {item.notes}</small>
                </>
              ) : null}
            </span>
            <strong>{formatMAD(item.totalPrice)}</strong>
          </div>
        ))}
        <div className="summary-divider" />
        <div className="summary-line"><span>Sous-total</span><strong>{formatMAD(data.subtotal)}</strong></div>
        <div className="summary-line"><span>Livraison</span><strong>{formatMAD(data.deliveryFee)}</strong></div>
        <div className="summary-divider" />
        <div className="summary-total"><span>Total confirmé</span><span>{formatMAD(data.total)}</span></div>
      </div>

      <div className="admin-card" style={{ marginBottom: 16 }}>
        <h3>Restaurant</h3>
        <p style={{ margin: 0, color: "#a3aca6", fontSize: 14 }}>
          {data.restaurant.name} — {data.restaurant.address}
        </p>
        {data.restaurant.phone ? (
          <p style={{ margin: "6px 0 0", color: "#a3aca6", fontSize: 14 }}>
            Téléphone : <a href={`tel:${data.restaurant.phone}`} style={{ color: "var(--green)" }}>{data.restaurant.phone}</a>
          </p>
        ) : null}
      </div>

      <div className="admin-card">
        <h3>Historique</h3>
        {data.timeline.map((event, index) => (
          <div className="summary-line" key={`${event.eventType}-${index}`}>
            <span>{event.eventType}</span>
            <span style={{ color: "#7c857f" }}>{formatDateTime(event.createdAt)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
