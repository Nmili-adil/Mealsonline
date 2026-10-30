/**
 * Durable outbox worker — processes pending Caisse212 order submissions with
 * idempotent retries, ambiguous-timeout reconciliation and status
 * reconciliation for missed webhook events.
 *
 * Run with:  npm run worker
 *
 * Concurrency safety: claiming an outbox row uses `updateMany` with a status
 * guard, so multiple worker processes can safely run side by side.
 */
import { prisma } from "../src/lib/prisma";
import { processOutboxBatch } from "../src/lib/orders/outbox";
import { reconcileOrderStatuses } from "../src/lib/orders/reconcile";

const OUTBOX_POLL_MS = 2_000;
const RECONCILE_INTERVAL_MS = 60_000;

let shuttingDown = false;

async function tick() {
  try {
    await processOutboxBatch(10);
  } catch (error) {
    console.error("[outbox-worker] Erreur de traitement :", error);
  }
}

async function reconcileTick() {
  try {
    const result = await reconcileOrderStatuses();
    if (result.failed > 0) {
      console.warn(`[outbox-worker] Réconciliation : ${result.checked} vérifiée(s), ${result.failed} échec(s)`);
    }
  } catch (error) {
    console.error("[outbox-worker] Erreur de réconciliation :", error);
  }
}

async function main() {
  console.log("[outbox-worker] Démarrage…");
  let lastReconcile = 0;

  while (!shuttingDown) {
    await tick();
    const now = Date.now();
    if (now - lastReconcile >= RECONCILE_INTERVAL_MS) {
      lastReconcile = now;
      await reconcileTick();
    }
    await new Promise((resolve) => setTimeout(resolve, OUTBOX_POLL_MS));
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
    console.error("[outbox-worker] Erreur fatale :", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
