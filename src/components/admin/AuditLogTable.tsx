import { formatDateTime } from "@/lib/utils";

interface AuditLog {
  id: string;
  actorType: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
}

export function AuditLogTable({ logs }: { logs: AuditLog[] }) {
  return (
    <div className="admin-card" style={{ overflowX: "auto" }}>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Acteur</th>
            <th>Action</th>
            <th>Entité</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td style={{ fontSize: 12 }}>{formatDateTime(log.createdAt)}</td>
              <td>{log.actorType}</td>
              <td><code style={{ fontSize: 12 }}>{log.action}</code></td>
              <td>
                {log.entityType ?? "—"} {log.entityId ? `· ${log.entityId.slice(0, 12)}…` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
