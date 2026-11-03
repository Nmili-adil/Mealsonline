import { expect, test } from "@playwright/test";

test.describe("storefront menu and cart", () => {
  test("browses collections, customizes a product and edits the cart", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Trois envies. Une seule adresse." })).toBeVisible();
    await expect(page.getByRole("status")).toContainText("Mode démonstration");

    await page.goto("/menu");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Notre menu" })).toBeVisible();

    // Storefront sections come from the V206 menu collections.
    await page.getByRole("button", { name: "Boissons" }).click();
    await expect(page.getByText("Soda")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Margherita" })).toHaveCount(0);

    await page.getByRole("button", { name: "La carte" }).click();
    await expect(page.getByRole("heading", { name: "Margherita" })).toBeVisible();

    // Product detail + variant selection (numeric storefront product id URL).
    await page.getByRole("link", { name: "Voir Margherita" }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Margherita" })).toBeVisible();
    await page.getByRole("button", { name: /Large/ }).click();
    await page.getByRole("button", { name: /Extra fromage/ }).click();

    await page.getByRole("button", { name: "Ajouter au panier" }).click();
    const drawer = page.getByRole("complementary", { name: "Panier" });
    await expect(drawer.getByText("Votre panier")).toBeVisible();
    await expect(drawer.getByRole("heading", { name: "Margherita" })).toBeVisible();

    await drawer.getByRole("link", { name: "Voir le panier" }).click();
    await expect(
      page.getByRole("main").getByRole("heading", { name: "Votre panier" }),
    ).toBeVisible();
    await page.getByRole("main").getByRole("button", { name: "Augmenter la quantité" }).click();
    await expect(
      page.locator(".cart-line .qty-control span").getByText("2", { exact: true }),
    ).toBeVisible();
  });
});
