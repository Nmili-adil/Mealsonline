import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { SyncPanel } from "@/components/admin/SyncPanel";
import { getIntegrationHealth } from "@/lib/caisse212/client";

export const metadata: Metadata = { title: "Synchronisation" };
export const dynamic = "force-dynamic";

export default async function AdminSyncPage() {
  const [lastRuns, cursor, counts, health] = await Promise.all([
    prisma.menuSyncRun.findMany({ orderBy: { startedAt: "desc" }, take: 10 }),
    prisma.menuSyncCursor.findUnique({ where: { provider: "caisse212" } }),
    prisma.product.aggregate({ _count: { _all: true }, where: { archived: false } }),
    Promise.resolve(getIntegrationHealth()),
  ]);

  return (
    <SyncPanel
      initial={{
        health: {
          mode: health.mode,
          available: health.available,
          configured: health.configured,
        },
        cursor: cursor
          ? { cursor: cursor.cursor, lastSyncAt: cursor.lastSyncAt?.toISOString() ?? null }
          : null,
        totalProducts: counts._count._all,
        runs: lastRuns.map((run) => ({
          id: run.id,
          mode: run.mode,
          status: run.status,
          startedAt: run.startedAt.toISOString(),
          finishedAt: run.finishedAt?.toISOString() ?? null,
          importedProducts: run.importedProducts,
          updatedProducts: run.updatedProducts,
          archivedProducts: run.archivedProducts,
          failedRecords: run.failedRecords,
          error: run.error,
        })),
      }}
    />
  );
}
