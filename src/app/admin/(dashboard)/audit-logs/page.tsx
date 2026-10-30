import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { AuditLogTable } from "@/components/admin/AuditLogTable";

export const metadata: Metadata = { title: "Journal d'audit" };
export const dynamic = "force-dynamic";

export default async function AdminAuditLogsPage() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <AuditLogTable
      logs={logs.map((log) => ({
        id: log.id,
        actorType: log.actorType,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        createdAt: log.createdAt.toISOString(),
      }))}
    />
  );
}
