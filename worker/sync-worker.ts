/**
 * Scheduled catalog synchronization worker.
 *
 * Run with:  npm run sync-worker
 *
 * Interval is configurable via CAISSE212_SYNC_INTERVAL_MINUTES (default 5).
 * The worker runs independently of HTTP requests, so long catalog imports
 * never block a response.
 */
import { prisma } from "../src/lib/prisma";
import { runCatalogSync } from "../src/lib/sync/catalog-sync";
import { SYNC_INTERVAL_MINUTES } from "../src/lib/constants";

let shuttingDown = false;

async function main() {
  console.log(
    `[sync-worker] Démarrage — synchronisation toutes les ${SYNC_INTERVAL_MINUTES} minute(s)`,
  );

  while (!shuttingDown) {
    try {
      const result = await runCatalogSync();
      console.log(
        `[sync-worker] ${result.status} — importés: ${result.importedProducts}, ` +
          `mis à jour: ${result.updatedProducts}, archivés: ${result.archivedProducts}, ` +
          `échecs: ${result.failedRecords}${result.error ? ` — ${result.error}` : ""}`,
      );
    } catch (error) {
      console.error("[sync-worker] Erreur de synchronisation :", error);
    }
    await new Promise((resolve) => setTimeout(resolve, SYNC_INTERVAL_MINUTES * 60_000));
  }
}

process.on("SIGINT", () => {
  shuttingDown = true;
});
process.on("SIGTERM", () => {
  shuttingDown = true;
});

main()
  .catch((error) => {
    console.error("[sync-worker] Erreur fatale :", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
