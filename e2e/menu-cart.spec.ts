import { expect, test } from "@playwright/test";

test.describe("menu browsing and cart", () => {
  test("browses the menu, customizes a product and edits the cart", async ({ page }) => {
    await page.goto("/menu");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Notre menu" })).toBeVisible();

    // Brand filter
    await page.getByRole("button", { name: "PizzaHub" }).click();
    await expect(page.getByRole("heading", { name: "Margherita" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Smash Classic" })).toHaveCount(0);

    // Product detail + variant selection
    await page.getByRole("button", { name: "Voir Margherita" }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Margherita" })).toBeVisible();
    await page.getByRole("button", { name: /Large/ }).click();

    // Optional modifier
    await page.getByRole("button", { name: /Extra fromage/ }).click();

    // Add to cart -> drawer opens
    await page.getByRole("button", { name: "Ajouter au panier" }).click();
    const drawer = page.getByRole("complementary", { name: "Panier" });
    await expect(drawer.getByText("Votre panier")).toBeVisible();
    await expect(drawer.getByRole("heading", { name: "Margherita" })).toBeVisible();

    // Go to cart page and change quantity
    await drawer.getByRole("link", { name: "Voir le panier" }).click();
    await expect(page.getByRole("heading", { name: "Votre panier" })).toBeVisible();
    await page.getByRole("main").getByRole("button", { name: "Augmenter la quantité" }).click();
    await expect(page.locator(".cart-line .qty-control span").getByText("2", { exact: true })).toBeVisible();
  });
});
