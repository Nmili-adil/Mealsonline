import { expect, test } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";

/**
 * The checkout E2E starts the outbox worker as a detached process group so
 * the submitted order is actually accepted by the simulated POS, then stops
 * the whole group in afterAll.
 */
let worker: ChildProcess | null = null;

test.beforeAll(() => {
  worker = spawn("npm", ["run", "worker"], {
    cwd: process.cwd(),
    stdio: "ignore",
    detached: true,
  });
});

test.afterAll(() => {
  if (worker && worker.pid) {
    try {
      process.kill(-worker.pid, "SIGTERM");
    } catch {
      // already stopped
    }
  }
});

test.describe("checkout and order tracking", () => {
  test("places an order and tracks it until POS acceptance", async ({ page }) => {
    // Direct-add product (single variant, no required options)
    await page.goto("/menu");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Tout le menu" }).click();
    const card = page.locator(".product-card", { hasText: "Pain à l'ail" });
    await card.getByRole("button", { name: "Ajouter" }).click();
    await expect(page.getByText("Votre panier")).toBeVisible();

    await page.goto("/checkout");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Nom complet").fill("Client E2E");
    await page.getByLabel("Téléphone").fill("+212 6 12 34 56 78");
    await page.getByLabel("Adresse de livraison").fill("Hay Izdihar, Marrakech");
    await page.getByRole("button", { name: "Valider ma commande" }).click();

    await expect(page.getByRole("heading", { name: "Commande transmise" })).toBeVisible({
      timeout: 20_000,
    });

    // Follow to tracking page; the outbox worker should accept the order.
    await page.getByRole("link", { name: "Suivre ma commande" }).click();
    await expect(page.getByText("Acceptée par le restaurant")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("Articles")).toBeVisible();
  });
});
