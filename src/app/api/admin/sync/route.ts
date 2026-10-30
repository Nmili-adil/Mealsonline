import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminApi, requireAdminMutation } from "@/lib/auth/guard";
import { runCatalogSync } from "@/lib/sync/catalog-sync";
import { getIntegrationHealth } from "@/lib/caisse212/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const [lastRuns, cursor, counts, health] = await Promise.all([
    prisma.menuSyncRun.findMany({ orderBy: { startedAt: "desc" }, take: 10 }),
    prisma.menuSyncCursor.findUnique({ where: { provider: "caisse212" } }),
    prisma.product.aggregate({
      _count: { _all: true },
      where: { archived: false },
    }),
    Promise.resolve(getIntegrationHealth()),
  ]);

  return NextResponse.json({
    health,
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
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminMutation(request);
  if (!auth.ok) return auth.response;

  const result = await runCatalogSync();
  revalidateTag("menu", "max");

  await prisma.auditLog.create({
    data: {
      actorType: "admin",
      actorId: auth.session!.admin.id,
      action: "sync.manual",
      entityType: "MenuSyncRun",
      entityId: result.runId,
      metadata: JSON.stringify(result),
    },
  });

  return NextResponse.json({ ok: true, result });
}
