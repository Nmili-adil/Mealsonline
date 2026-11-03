import { expect, test } from "@playwright/test";

test.describe("admin storefronts", () => {
  test("creates and edits a website against the storefront fixtures", async ({ page }) => {
    await page.goto("/admin/login");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Email").fill("admin@mealsonline.ma");
    await page.getByLabel("Mot de passe").fill("ChangeMe123!");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByRole("heading", { name: "Administration" })).toBeVisible();

    await page.goto("/admin/websites");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Sites web" })).toBeVisible();
    await expect(page.getByText("Mode fixtures")).toBeVisible();

    const unique = Date.now().toString().slice(-6);
    const siteName = `Site E2E ${unique}`;

    await page.getByRole("link", { name: "+ Nouveau site" }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Nouveau site" })).toBeVisible();

    await page.getByLabel("Nom du site").fill(siteName);
    const slug = await page.getByLabel("Slug", { exact: false }).first().inputValue();
    expect(slug).toContain("site-e2e");

    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL(/\/admin\/websites\/\d+\/edit$/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: `Modifier ${siteName}` })).toBeVisible();
    await expect(page.getByText(/Version 1 · business/)).toBeVisible();

    // Custom sections editor and basic save round-trip.
    await page.getByRole("tab", { name: "Sections" }).click();
    await page.getByRole("button", { name: "Sections personnalisées" }).click();
    await page.getByRole("button", { name: "+ Ajouter une section" }).click();
    await page.getByLabel("Nom", { exact: true }).fill("Section E2E");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText(/Site enregistré · version 2/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Brouillon" })).toBeVisible();
    await page.getByRole("button", { name: "Enregistré" }).click();
    await expect(page.getByText(/n\u2019a aucune section|n\u0027a aucune section/)).toBeVisible();

    await page.goto("/admin/websites");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(siteName)).toBeVisible();
  });
});
