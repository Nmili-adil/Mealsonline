import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { formatMAD } from "@/lib/money";

export const metadata: Metadata = {
  title: "Vue d'ensemble",
};

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const [
    totalOrders,
    pendingAcceptance,
    acceptedOrders,
    totalProducts,
    lastSync,
    recentFailures,
  ] = await Promise.all([
    prisma.onlineOrder.count(),
    prisma.onlineOrder.count({ where: { acceptanceState: "pending" } }),
    prisma.onlineOrder.count({ where: { acceptanceState: "accepted" } }),
    prisma.product.count({ where: { archived: false } }),
    prisma.menuSyncRun.findFirst({ orderBy: { startedAt: "desc" } }),
    prisma.integrationError.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } } }),
  ]);

  const revenue = await prisma.onlineOrder.aggregate({
    _sum: { total: true },
    where: { acceptanceState: "accepted" },
  });

  return (
    <div>
      <div className="admin-grid" style={{ marginBottom: 20 }}>
        <div className="admin-stat">
          <strong>{totalOrders}</strong>
          <span>Commandes en ligne au total</span>
        </div>
        <div className="admin-stat">
          <strong>{pendingAcceptance}</strong>
          <span>En attente d'acceptation</span>
        </div>
        <div className="admin-stat">
          <strong>{acceptedOrders}</strong>
          <span>Commandes acceptées</span>
        </div>
        <div className="admin-stat">
          <strong>{formatMAD(revenue._sum.total ?? 0)}</strong>
          <span>Volume accepté</span>
        </div>
      </div>

      <div className="admin-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
        <div className="admin-card">
          <h3>Intégration</h3>
          <p style={{ color: "#a3aca6", fontSize: 14, margin: 0 }}>
            Mode : <strong style={{ color: "#f7f9f7" }}>{process.env.CAISSE212_MODE ?? "mock"}</strong>
          </p>
          <p style={{ color: "#a3aca6", fontSize: 14, margin: "8px 0 0" }}>
            Échecs (24 h) : <strong style={{ color: recentFailures > 0 ? "#ff8a8a" : "#f7f9f7" }}>{recentFailures}</strong>
          </p>
        </div>
        <div className="admin-card">
          <h3>Catalogue</h3>
          <p style={{ color: "#a3aca6", fontSize: 14, margin: 0 }}>
            Produits actifs : <strong style={{ color: "#f7f9f7" }}>{totalProducts}</strong>
          </p>
          <p style={{ color: "#a3aca6", fontSize: 14, margin: "8px 0 0" }}>
            Dernière synchro :{" "}
            <strong style={{ color: "#f7f9f7" }}>
              {lastSync ? new Date(lastSync.startedAt).toLocaleString("fr-MA") : "Jamais"}
            </strong>
          </p>
        </div>
      </div>
    </div>
  );
}
