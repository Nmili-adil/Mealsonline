"use client";

import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react";
import { formatDateTime } from "@/lib/utils";

interface OrderDetailView {
  id: string;
  reference: string;
  status: string;
  acceptanceState: string;
  preparationState: string;
  paymentState: string;
  fulfillmentState: string;
  fulfillmentType: string;
  brand: string | null;
  restaurant: string;
  customerName: string;
  phone: string;
  deliveryAddress: string | null;
  deliveryInstructions: string | null;
  orderNote: string | null;
  currency: string;
  subtotalLabel: string;
  deliveryFeeLabel: string;
  totalLabel: string;
  priceChanged: boolean;
  externalOrderId: string | null;
  posOrderId: string | null;
  acceptanceDeadlineAt: string | null;
  submittedAt: string | null;
  acceptedAt: string | null;
  createdAt: string;
  items: Array<{
    id: string;
    name: string;
    variantName: string | null;
    quantity: number;
    unitPriceLabel: string;
    totalPriceLabel: string;
    notes: string | null;
    modifiers: Array<{ group: string; name: string; priceLabel: string }>;
  }>;
  payments: Array<{ method: string; state: string; amountLabel: string }>;
  timeline: Array<{
    eventType: string;
    fromState: string | null;
    toState: string | null;
    source: string;
    createdAt: string;
  }>;
  outbox: {
    status: string;
    attempts: number;
    maxAttempts: number;
    lastError: string | null;
    nextAttemptAt: string | null;
    processedAt: string | null;
  } | null;
}

export function OrderDetail({ order }: { order: OrderDetailView }) {
  return (
    <div>
      <Link href="/admin/orders" className="admin-button admin-button-secondary" style={{ marginBottom: 16 }}>
        <ArrowLeft weight="bold" aria-hidden="true" /> Retour aux commandes
      </Link>

      <div className="admin-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", marginBottom: 18 }}>
        <div className="admin-stat"><strong>{order.reference}</strong><span>Référence</span></div>
        <div className="admin-stat"><strong>{order.status}</strong><span>Statut</span></div>
        <div className="admin-stat"><strong>{order.totalLabel}</strong><span>Total</span></div>
        <div className="admin-stat"><strong>{order.brand ?? "—"}</strong><span>Marque</span></div>
      </div>

      <div className="admin-grid" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 18 }}>
        <div className="admin-card">
          <h3>Client & livraison</h3>
          <p style={{ margin: 0, fontSize: 14 }}>{order.customerName} · {order.phone}</p>
          <p style={{ margin: "6px 0 0", color: "#a3aca6", fontSize: 14 }}>
            {order.fulfillmentType === "delivery" ? order.deliveryAddress : "Retrait au restaurant"}
          </p>
          {order.deliveryInstructions ? (
            <p style={{ margin: "6px 0 0", color: "#a3aca6", fontSize: 13 }}>
              Instructions : {order.deliveryInstructions}
            </p>
          ) : null}
          {order.orderNote ? (
            <p style={{ margin: "6px 0 0", color: "#a3aca6", fontSize: 13 }}>
              Note : {order.orderNote}
            </p>
          ) : null}
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "#7c857f" }}>
            Créée le {formatDateTime(order.createdAt)}
          </p>
        </div>
        <div className="admin-card">
          <h3>Intégration Caisse212</h3>
          <p style={{ margin: 0, fontSize: 13 }}>
            ID externe : <code>{order.externalOrderId ?? "—"}</code>
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 13 }}>
            ID POS : <code>{order.posOrderId ?? "—"}</code>
          </p>
          {order.outbox ? (
            <div style={{ marginTop: 10, fontSize: 13, color: "#a3aca6" }}>
              <p style={{ margin: "4px 0" }}>
                Outbox : <span className={`badge ${order.outbox.status === "succeeded" ? "badge-green" : order.outbox.status === "failed" || order.outbox.status === "expired" ? "badge-red" : "badge-amber"}`}>{order.outbox.status}</span>
              </p>
              <p style={{ margin: "4px 0" }}>Tentatives : {order.outbox.attempts}/{order.outbox.maxAttempts}</p>
              {order.outbox.lastError ? (
                <p style={{ margin: "4px 0", color: "#ff8a8a" }}>Erreur : {order.outbox.lastError}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="admin-card" style={{ marginBottom: 18, overflowX: "auto" }}>
        <h3>Articles</h3>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Article</th>
              <th>Variante</th>
              <th>Qté</th>
              <th>Options</th>
              <th>P.U.</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.name}</strong>{item.notes ? <><br /><small style={{ color: "#7c857f" }}>{item.notes}</small></> : null}</td>
                <td>{item.variantName ?? "—"}</td>
                <td>{item.quantity}</td>
                <td style={{ fontSize: 12 }}>
                  {item.modifiers.length > 0
                    ? item.modifiers.map((mod, index) => (
                        <span key={index} style={{ display: "block" }}>
                          {mod.group} : {mod.name} ({mod.priceLabel})
                        </span>
                      ))
                    : "—"}
                </td>
                <td>{item.unitPriceLabel}</td>
                <td><strong>{item.totalPriceLabel}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ textAlign: "right", fontSize: 14, margin: "12px 0 0" }}>
          Sous-total {order.subtotalLabel} · Livraison {order.deliveryFeeLabel} ·{" "}
          <strong>Total {order.totalLabel}</strong>
        </p>
      </div>

      <div className="admin-card">
        <h3>Historique des statuts</h3>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Événement</th>
              <th>De</th>
              <th>Vers</th>
              <th>Source</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {order.timeline.map((event, index) => (
              <tr key={index}>
                <td><code style={{ fontSize: 12 }}>{event.eventType}</code></td>
                <td>{event.fromState ?? "—"}</td>
                <td>{event.toState ?? "—"}</td>
                <td>{event.source}</td>
                <td style={{ fontSize: 12 }}>{formatDateTime(event.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
