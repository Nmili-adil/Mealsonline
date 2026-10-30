import { expect, test } from "@playwright/test";

test.describe("admin dashboard", () => {
  test("logs in and triggers a manual catalog import", async ({ page }) => {
    await page.goto("/admin/login");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Email").fill("admin@mealsonline.ma");
    await page.getByLabel("Mot de passe").fill("ChangeMe123!");
    await page.getByRole("button", { name: "Se connecter" }).click();

    await expect(page.getByRole("heading", { name: "Administration" })).toBeVisible();
    await page.goto("/admin/sync");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Lancer l'import manuel" }).click();
    await expect(page.getByText(/Synchronisation terminée/)).toBeVisible({ timeout: 30_000 });

    await page.goto("/admin/orders");
    await expect(page.getByRole("heading", { name: "Administration" })).toBeVisible();
  });
});
