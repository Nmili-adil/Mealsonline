"use client";

import Link from "next/link";

interface AdminOrder {
  id: string;
  reference: string;
  status: string;
  acceptanceState: string;
  preparationState: string;
  paymentState: string;
  fulfillmentState: string;
  fulfillmentType: string;
  brand: string | null;
  customerName: string;
  phone: string;
  totalLabel: string;
  posOrderId: string | null;
  itemCount: number;
  createdAt: string;
}

const STATUS_CLASS: Record<string, string> = {
  accepted: "badge-green",
  preparing: "badge-green",
  ready: "badge-green",
  dispatched: "badge-green",
  delivered: "badge-green",
  pending_submission: "badge-amber",
  submitted: "badge-amber",
  rejected: "badge-red",
  expired: "badge-red",
  cancelled: "badge-gray",
  failed: "badge-red",
};

export function OrdersTable({ orders }: { orders: AdminOrder[] }) {
  return (
    <div className="admin-card" style={{ overflowX: "auto" }}>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Référence</th>
            <th>Statut</th>
            <th>Client</th>
            <th>Articles</th>
            <th>Total</th>
            <th>POS</th>
            <th>Créée le</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td>
                <Link href={`/admin/orders/${order.id}`} style={{ color: "var(--green)" }}>
                  <strong>{order.reference}</strong>
                </Link>
              </td>
              <td>
                <span className={`badge ${STATUS_CLASS[order.status] ?? "badge-gray"}`}>
                  {order.status}
                </span>
              </td>
              <td>
                {order.customerName}
                <br />
                <small style={{ color: "#7c857f" }}>{order.phone}</small>
              </td>
              <td>{order.itemCount}</td>
              <td><strong>{order.totalLabel}</strong></td>
              <td>
                {order.posOrderId ? (
                  <code style={{ fontSize: 12 }}>{order.posOrderId}</code>
                ) : (
                  <span style={{ color: "#7c857f" }}>—</span>
                )}
              </td>
              <td style={{ fontSize: 12 }}>{new Date(order.createdAt).toLocaleString("fr-MA")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {orders.length === 0 ? (
        <p style={{ color: "#a3aca6", padding: 16 }}>Aucune commande pour le moment.</p>
      ) : null}
    </div>
  );
}
