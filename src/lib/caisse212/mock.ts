import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  Caisse212Error,
  type AvailabilitySnapshot,
  type CatalogChanges,
  type CatalogSnapshot,
  type Caisse212Provider,
  type ExternalOrderStatus,
  type SubmitOrderInput,
  type SubmitOrderResult,
} from "./types";
import { catalogSnapshotSchema } from "./schemas";

/**
 * Mock Caisse212 provider with representative fixture data.
 *
 * The mock is FILE-BACKED so the Next.js server, the outbox worker and tests
 * all share one simulated POS state across processes. It must never be used
 * in production (enforced by the provider factory in client.ts).
 */

const STATE_DIR = path.join(process.cwd(), ".data");
const STATE_FILE = path.join(STATE_DIR, "mock-caisse212.json");

export type MockScenario = "normal" | "pos_offline" | "ambiguous_timeout";

interface MockStoredOrder {
  externalOrderId: string;
  posOrderId: string;
  accepted: boolean;
  rejectionReason?: string;
  authoritativeTotal?: number;
  submittedAt: string;
  status: ExternalOrderStatus;
  lines: SubmitOrderInput["lines"];
}

interface MockState {
  catalogVersion: number;
  catalog: CatalogSnapshot;
  availability: Record<string, boolean>;
  scenario: MockScenario;
  /** Number of submitOrder calls that time out ambiguously (order still created). */
  ambiguousTimeoutCount: number;
  priceOverrides: Record<string, number>;
  unavailableProducts: string[];
  orders: Record<string, MockStoredOrder>;
}

// ---------------------------------------------------------------------------
// Fixture catalog
// ---------------------------------------------------------------------------

function buildCatalog(): CatalogSnapshot {
  return {
    generatedAt: "2026-01-01T00:00:00.000Z",
    brands: [
      {
        externalId: "brand-pizzahub",
        name: "PizzaHub",
        tagline: "Pizzas artisanales",
        logoUrl: "/images/logo-pizzahub-v2.png",
        imageUrl: "/images/brand-pizzahub.png",
        accentColor: "#ef2638",
        sortOrder: 1,
        active: true,
      },
      {
        externalId: "brand-ciao-pasta",
        name: "CIAO PASTA",
        tagline: "Cuisine italienne authentique",
        logoUrl: "/images/logo-ciao-v2.png",
        imageUrl: "/images/brand-ciao-pasta.png",
        accentColor: "#58a644",
        sortOrder: 2,
        active: true,
      },
      {
        externalId: "brand-smash-burgers",
        name: "SMASH IT BURGERS",
        tagline: "Burgers gourmets",
        logoUrl: "/images/logo-smash-v2.png",
        imageUrl: "/images/brand-smash-burger.png",
        accentColor: "#efb13a",
        sortOrder: 3,
        active: true,
      },
    ],
    categories: [
      { externalId: "cat-pizzas", brandExternalId: "brand-pizzahub", name: "Pizzas", sortOrder: 1, active: true },
      { externalId: "cat-pastas", brandExternalId: "brand-ciao-pasta", name: "Pasta", sortOrder: 2, active: true },
      { externalId: "cat-burgers", brandExternalId: "brand-smash-burgers", name: "Burgers", sortOrder: 3, active: true },
      { externalId: "cat-sides", brandExternalId: "brand-pizzahub", name: "Accompagnements", sortOrder: 4, active: true },
      { externalId: "cat-drinks", brandExternalId: "brand-pizzahub", name: "Boissons", sortOrder: 5, active: true },
    ],
    modifierGroups: [
      {
        externalId: "grp-pizza-extras",
        name: "Suppléments pizza",
        minSelection: 0,
        maxSelection: 3,
        required: false,
        modifiers: [
          { externalId: "mod-extra-cheese", name: "Extra fromage", price: 800 },
          { externalId: "mod-extra-sauce", name: "Sauce supplémentaire", price: 500 },
          { externalId: "mod-olives", name: "Olives", price: 600 },
        ],
      },
      {
        externalId: "grp-pasta-sauce",
        name: "Sauce",
        minSelection: 1,
        maxSelection: 1,
        required: true,
        modifiers: [
          { externalId: "mod-sauce-tomate", name: "Tomate", price: 0 },
          { externalId: "mod-sauce-creme", name: "Crème", price: 0 },
          { externalId: "mod-sauce-pesto", name: "Pesto", price: 300 },
        ],
      },
      {
        externalId: "grp-burger-extras",
        name: "Suppléments burger",
        minSelection: 0,
        maxSelection: 2,
        required: false,
        modifiers: [
          { externalId: "mod-bacon", name: "Bacon", price: 700 },
          { externalId: "mod-cheddar", name: "Cheddar", price: 500 },
          { externalId: "mod-onion-rings", name: "Onion rings", price: 600 },
        ],
      },
    ],
    products: [
      {
        externalId: "prod-margherita",
        brandExternalId: "brand-pizzahub",
        categoryExternalId: "cat-pizzas",
        name: "Margherita",
        description: "Sauce tomate, mozzarella fior di latte, basilic frais, huile d'olive.",
        ingredients: ["Sauce tomate", "Mozzarella", "Basilic", "Huile d'olive"],
        imageUrl: "/images/brand-pizzahub.png",
        available: true,
        sortOrder: 1,
        variants: [
          { externalId: "var-margherita-med", name: "Medium", price: 2900, isDefault: true, sortOrder: 1 },
          { externalId: "var-margherita-lg", name: "Large", price: 4900, sortOrder: 2 },
        ],
        modifierGroupExternalIds: ["grp-pizza-extras"],
      },
      {
        externalId: "prod-pepperoni",
        brandExternalId: "brand-pizzahub",
        categoryExternalId: "cat-pizzas",
        name: "Pepperoni",
        description: "Sauce tomate, mozzarella, pepperoni, origan.",
        ingredients: ["Sauce tomate", "Mozzarella", "Pepperoni", "Origan"],
        imageUrl: "/images/brand-pizzahub.png",
        available: true,
        sortOrder: 2,
        variants: [
          { externalId: "var-pepperoni-med", name: "Medium", price: 3200, isDefault: true },
          { externalId: "var-pepperoni-lg", name: "Large", price: 5200 },
        ],
        modifierGroupExternalIds: ["grp-pizza-extras"],
      },
      {
        externalId: "prod-four-cheese",
        brandExternalId: "brand-pizzahub",
        categoryExternalId: "cat-pizzas",
        name: "Four Cheese",
        description: "Mozzarella, gorgonzola, chèvre, parmesan.",
        ingredients: ["Mozzarella", "Gorgonzola", "Chèvre", "Parmesan"],
        imageUrl: "/images/brand-pizzahub.png",
        available: true,
        sortOrder: 3,
        variants: [
          { externalId: "var-four-cheese-med", name: "Medium", price: 3400, isDefault: true },
          { externalId: "var-four-cheese-lg", name: "Large", price: 5400 },
        ],
        modifierGroupExternalIds: ["grp-pizza-extras"],
      },
      {
        externalId: "prod-chicken",
        brandExternalId: "brand-pizzahub",
        categoryExternalId: "cat-pizzas",
        name: "Chicken Pizza",
        description: "Poulet mariné, champignons, mozzarella, sauce blanche.",
        ingredients: ["Poulet", "Champignons", "Mozzarella", "Sauce blanche"],
        imageUrl: "/images/brand-pizzahub.png",
        available: true,
        sortOrder: 4,
        variants: [
          { externalId: "var-chicken-med", name: "Medium", price: 3600, isDefault: true },
          { externalId: "var-chicken-lg", name: "Large", price: 5600 },
        ],
        modifierGroupExternalIds: ["grp-pizza-extras"],
      },
      {
        externalId: "prod-spicy-chicken",
        brandExternalId: "brand-pizzahub",
        categoryExternalId: "cat-pizzas",
        name: "Spicy Chicken",
        description: "Poulet épicé, poivrons, oignons rouges, mozzarella.",
        ingredients: ["Poulet épicé", "Poivrons", "Oignons", "Mozzarella"],
        imageUrl: "/images/brand-pizzahub.png",
        available: true,
        sortOrder: 5,
        variants: [
          { externalId: "var-spicy-med", name: "Medium", price: 3700, isDefault: true },
          { externalId: "var-spicy-lg", name: "Large", price: 5700 },
        ],
        modifierGroupExternalIds: ["grp-pizza-extras"],
      },
      {
        externalId: "prod-meat-lover",
        brandExternalId: "brand-pizzahub",
        categoryExternalId: "cat-pizzas",
        name: "Meat Lover",
        description: "Viande hachée, pepperoni, merguez, mozzarella.",
        ingredients: ["Viande hachée", "Pepperoni", "Merguez", "Mozzarella"],
        imageUrl: "/images/brand-pizzahub.png",
        available: true,
        sortOrder: 6,
        variants: [
          { externalId: "var-meat-med", name: "Medium", price: 3900, isDefault: true },
          { externalId: "var-meat-lg", name: "Large", price: 5900 },
        ],
        modifierGroupExternalIds: ["grp-pizza-extras"],
      },
      {
        externalId: "prod-hawaiian",
        brandExternalId: "brand-pizzahub",
        categoryExternalId: "cat-pizzas",
        name: "Hawaiian",
        description: "Ananas, jambon, mozzarella, sauce tomate.",
        ingredients: ["Ananas", "Jambon", "Mozzarella", "Sauce tomate"],
        imageUrl: "/images/brand-pizzahub.png",
        available: true,
        sortOrder: 7,
        variants: [
          { externalId: "var-hawaiian-med", name: "Medium", price: 3300, isDefault: true },
          { externalId: "var-hawaiian-lg", name: "Large", price: 5300 },
        ],
        modifierGroupExternalIds: ["grp-pizza-extras"],
      },
      {
        externalId: "prod-penne-arrabiata",
        brandExternalId: "brand-ciao-pasta",
        categoryExternalId: "cat-pastas",
        name: "Penne Arrabbiata",
        description: "Penne, sauce tomate relevée, ail, piment, persil.",
        ingredients: ["Penne", "Tomate", "Ail", "Piment"],
        imageUrl: "/images/brand-ciao-pasta.png",
        available: true,
        sortOrder: 1,
        variants: [
          { externalId: "var-penne-assiette", name: "Assiette", price: 4500, isDefault: true },
          { externalId: "var-penne-grande", name: "Grande", price: 5500 },
        ],
        modifierGroupExternalIds: ["grp-pasta-sauce"],
      },
      {
        externalId: "prod-spaghetti-bolo",
        brandExternalId: "brand-ciao-pasta",
        categoryExternalId: "cat-pastas",
        name: "Spaghetti Bolognaise",
        description: "Spaghetti, sauce bolognaise maison, parmesan.",
        ingredients: ["Spaghetti", "Bœuf", "Tomate", "Parmesan"],
        imageUrl: "/images/brand-ciao-pasta.png",
        available: true,
        sortOrder: 2,
        variants: [
          { externalId: "var-spaghetti-assiette", name: "Assiette", price: 4700, isDefault: true },
          { externalId: "var-spaghetti-grande", name: "Grande", price: 5700 },
        ],
        modifierGroupExternalIds: ["grp-pasta-sauce"],
      },
      {
        externalId: "prod-lasagna",
        brandExternalId: "brand-ciao-pasta",
        categoryExternalId: "cat-pastas",
        name: "Lasagnes maison",
        description: "Pâtes fraîches, bœuf, béchamel, tomate, fromage gratiné.",
        ingredients: ["Pâtes", "Bœuf", "Béchamel", "Fromage"],
        imageUrl: "/images/brand-ciao-pasta.png",
        available: true,
        sortOrder: 3,
        variants: [
          { externalId: "var-lasagna-assiette", name: "Assiette", price: 4900, isDefault: true },
          { externalId: "var-lasagna-grande", name: "Grande", price: 5900 },
        ],
        modifierGroupExternalIds: ["grp-pasta-sauce"],
      },
      {
        externalId: "prod-smash-classic",
        brandExternalId: "brand-smash-burgers",
        categoryExternalId: "cat-burgers",
        name: "Smash Classic",
        description: "Bœuf smashé, cheddar, oignons, sauce maison, pain brioché.",
        ingredients: ["Bœuf", "Cheddar", "Oignons", "Sauce maison"],
        imageUrl: "/images/brand-smash-burger.png",
        available: true,
        sortOrder: 1,
        variants: [
          { externalId: "var-smash-classic-simple", name: "Simple", price: 3800, isDefault: true },
          { externalId: "var-smash-classic-double", name: "Double", price: 4800 },
        ],
        modifierGroupExternalIds: ["grp-burger-extras"],
      },
      {
        externalId: "prod-smash-cheese",
        brandExternalId: "brand-smash-burgers",
        categoryExternalId: "cat-burgers",
        name: "Smash Cheese",
        description: "Double cheddar fondant, bœuf smashé, cornichons.",
        ingredients: ["Bœuf", "Cheddar", "Cornichons"],
        imageUrl: "/images/brand-smash-burger.png",
        available: true,
        sortOrder: 2,
        variants: [
          { externalId: "var-smash-cheese-simple", name: "Simple", price: 4200, isDefault: true },
          { externalId: "var-smash-cheese-double", name: "Double", price: 5200 },
        ],
        modifierGroupExternalIds: ["grp-burger-extras"],
      },
      {
        externalId: "prod-smash-spicy",
        brandExternalId: "brand-smash-burgers",
        categoryExternalId: "cat-burgers",
        name: "Smash Spicy",
        description: "Bœuf smashé, sauce piquante, jalapeños, cheddar.",
        ingredients: ["Bœuf", "Cheddar", "Jalapeños", "Sauce piquante"],
        imageUrl: "/images/brand-smash-burger.png",
        available: true,
        sortOrder: 3,
        variants: [
          { externalId: "var-smash-spicy-simple", name: "Simple", price: 4400, isDefault: true },
          { externalId: "var-smash-spicy-double", name: "Double", price: 5400 },
        ],
        modifierGroupExternalIds: ["grp-burger-extras"],
      },
      {
        externalId: "prod-fries",
        brandExternalId: "brand-pizzahub",
        categoryExternalId: "cat-sides",
        name: "Frites maison",
        description: "Frites fraîches, sel de mer, sauce au choix.",
        ingredients: ["Pommes de terre", "Sel"],
        imageUrl: "/images/brand-pizzahub.png",
        available: true,
        sortOrder: 1,
        variants: [
          { externalId: "var-fries-normal", name: "Normal", price: 1500, isDefault: true },
          { externalId: "var-fries-grande", name: "Grande", price: 2000 },
        ],
        modifierGroupExternalIds: [],
      },
      {
        externalId: "prod-garlic-bread",
        brandExternalId: "brand-pizzahub",
        categoryExternalId: "cat-sides",
        name: "Pain à l'ail",
        description: "Pain croustillant, beurre à l'ail, persil.",
        ingredients: ["Pain", "Ail", "Beurre"],
        imageUrl: "/images/brand-pizzahub.png",
        available: true,
        sortOrder: 2,
        variants: [{ externalId: "var-garlic-bread", name: "Pièce", price: 1200, isDefault: true }],
        modifierGroupExternalIds: [],
      },
      {
        externalId: "prod-soda",
        brandExternalId: "brand-pizzahub",
        categoryExternalId: "cat-drinks",
        name: "Soda",
        description: "Cola, citron ou orange.",
        ingredients: [],
        imageUrl: "/images/brand-pizzahub.png",
        available: true,
        sortOrder: 1,
        variants: [
          { externalId: "var-soda-33", name: "33 cl", price: 800, isDefault: true },
          { externalId: "var-soda-50", name: "50 cl", price: 1200 },
        ],
        modifierGroupExternalIds: [],
      },
      {
        externalId: "prod-water",
        brandExternalId: "brand-pizzahub",
        categoryExternalId: "cat-drinks",
        name: "Eau minérale",
        description: "Bouteille d'eau minérale 50 cl.",
        ingredients: [],
        imageUrl: "/images/brand-pizzahub.png",
        available: true,
        sortOrder: 2,
        variants: [{ externalId: "var-water-50", name: "50 cl", price: 500, isDefault: true }],
        modifierGroupExternalIds: [],
      },
    ],
  };
}

function defaultState(): MockState {
  return {
    catalogVersion: 42,
    catalog: buildCatalog(),
    availability: {},
    scenario: (process.env.CAISSE212_MOCK_SCENARIO as MockScenario) || "normal",
    ambiguousTimeoutCount: 0,
    priceOverrides: {},
    unavailableProducts: [],
    orders: {},
  };
}

// ---------------------------------------------------------------------------
// State persistence
// ---------------------------------------------------------------------------

let cachedState: MockState | null = null;

export async function readMockState(): Promise<MockState> {
  if (cachedState) return cachedState;
  try {
    const raw = await fs.readFile(STATE_FILE, "utf8");
    const parsed = JSON.parse(raw) as MockState;
    parsed.catalog = catalogSnapshotSchema.parse(parsed.catalog);
    cachedState = parsed;
    return parsed;
  } catch {
    const fresh = defaultState();
    await writeMockState(fresh);
    return fresh;
  }
}

export async function writeMockState(state: MockState): Promise<void> {
  await fs.mkdir(STATE_DIR, { recursive: true });
  const tmp = `${STATE_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(state, null, 2), "utf8");
  await fs.rename(tmp, STATE_FILE);
  cachedState = state;
}

export async function setMockScenario(scenario: MockScenario): Promise<void> {
  const state = await readMockState();
  state.scenario = scenario;
  if (scenario === "ambiguous_timeout") state.ambiguousTimeoutCount = 1;
  await writeMockState(state);
}

/** Reset the file-backed mock to its default state (used by tests). */
export async function resetMockState(): Promise<void> {
  cachedState = null;
  await writeMockState(defaultState());
}

export async function setMockUnavailableProducts(
  externalIds: string[],
): Promise<void> {
  const state = await readMockState();
  state.unavailableProducts = externalIds;
  await writeMockState(state);
}

export async function setMockPriceOverride(
  externalVariantId: string,
  priceMinor: number,
): Promise<void> {
  const state = await readMockState();
  state.priceOverrides[externalVariantId] = priceMinor;
  state.catalogVersion += 1;
  await writeMockState(state);
}

/** Simulate POS-side preparation progress (used by tests/demo). */
export async function advanceMockPreparation(
  externalOrderId: string,
  preparation: ExternalOrderStatus["preparation"],
): Promise<void> {
  const state = await readMockState();
  const order = state.orders[externalOrderId];
  if (order) {
    order.status.preparation = preparation;
    order.status.updatedAt = new Date().toISOString();
    if (preparation === "delivered") order.status.fulfillment = "completed";
    if (preparation === "ready" && order.status.fulfillment === "pending") {
      order.status.fulfillment = "in_progress";
    }
    await writeMockState(state);
  }
}

// ---------------------------------------------------------------------------
// Provider implementation
// ---------------------------------------------------------------------------

function clone<T>(value: T): T {
  return structuredClone(value);
}

/** Reflect price overrides in the catalog snapshot returned to callers. */
function applyPriceOverrides(
  catalog: CatalogSnapshot,
  overrides: Record<string, number>,
): CatalogSnapshot {
  if (Object.keys(overrides).length === 0) return catalog;
  return {
    ...catalog,
    products: catalog.products.map((product) => ({
      ...product,
      variants: product.variants.map((variant) => ({
        ...variant,
        price: overrides[variant.externalId] ?? variant.price,
      })),
    })),
  };
}

function computeAuthoritativeTotal(
  state: MockState,
  input: SubmitOrderInput,
): number {
  let total = 0;
  for (const line of input.lines) {
    const product = state.catalog.products.find(
      (p) => p.externalId === line.externalProductId,
    );
    if (!product) continue;
    const variant = product.variants.find(
      (v) => v.externalId === line.externalVariantId,
    );
    if (!variant) continue;
    const variantPrice =
      state.priceOverrides[variant.externalId] ?? variant.price;
    let lineTotal = variantPrice * line.quantity;
    const groups = (product.modifierGroupExternalIds ?? []).flatMap((groupId) =>
      state.catalog.modifierGroups.filter((g) => g.externalId === groupId),
    );
    const modifiers = groups.flatMap((g) => g.modifiers);
    for (const modId of line.externalModifierIds) {
      const mod = modifiers.find((m) => m.externalId === modId);
      if (mod) lineTotal += mod.price * line.quantity;
    }
    total += lineTotal;
  }
  return total;
}

export class MockCaisse212Provider implements Caisse212Provider {
  async fetchCatalog(): Promise<CatalogSnapshot> {
    const state = await readMockState();
    return clone(applyPriceOverrides(state.catalog, state.priceOverrides));
  }

  async fetchChanges(cursor?: string): Promise<CatalogChanges> {
    const state = await readMockState();
    const currentCursor = String(state.catalogVersion);
    if (!cursor || cursor !== currentCursor) {
      // Full snapshot reconciliation fallback (also covers the first import).
      return {
        cursor: currentCursor,
        generatedAt: new Date().toISOString(),
        upserts: clone(applyPriceOverrides(state.catalog, state.priceOverrides)),
        removed: { brands: [], categories: [], products: [] },
      };
    }
    return {
      cursor: currentCursor,
      generatedAt: new Date().toISOString(),
      upserts: { generatedAt: new Date().toISOString(), brands: [], categories: [], products: [], modifierGroups: [] },
      removed: { brands: [], categories: [], products: [] },
    };
  }

  async getAvailability(): Promise<AvailabilitySnapshot> {
    const state = await readMockState();
    return {
      generatedAt: new Date().toISOString(),
      items: state.catalog.products.map((product) => ({
        externalProductId: product.externalId,
        available:
          product.available &&
          !state.unavailableProducts.includes(product.externalId),
      })),
    };
  }

  async submitOrder(input: SubmitOrderInput): Promise<SubmitOrderResult> {
    const state = await readMockState();

    if (state.scenario === "pos_offline") {
      throw new Caisse212Error(
        "unavailable",
        "Caisse212 injoignable (scénario mock pos_offline)",
        { retryable: true },
      );
    }

    // Ambiguous timeout: the POS actually receives and accepts the order, but
    // the website never gets the response. The outbox worker must reconcile
    // through getOrderByExternalId before retrying.
    if (state.scenario === "ambiguous_timeout" && state.ambiguousTimeoutCount > 0) {
      state.ambiguousTimeoutCount -= 1;
      this.persistAcceptedOrder(state, input);
      await writeMockState(state);
      throw new Caisse212Error(
        "timeout",
        "Délai d'attente dépassé (réponse POS ambiguë)",
        { retryable: true },
      );
    }

    // Idempotent duplicate submission: same external ID returns same POS order.
    const duplicate = state.orders[input.externalOrderId];
    if (duplicate) {
      return {
        accepted: duplicate.accepted,
        externalOrderId: duplicate.externalOrderId,
        posOrderId: duplicate.posOrderId,
        authoritativeTotal: duplicate.authoritativeTotal,
        rejectionReason: duplicate.rejectionReason,
      };
    }

    const unavailable = input.lines.some((line) =>
      state.unavailableProducts.includes(line.externalProductId),
    );
    if (unavailable) {
      return {
        accepted: false,
        externalOrderId: input.externalOrderId,
        rejectionReason: "product_unavailable",
      };
    }

    // Deterministic rejection trigger for tests/demo.
    const reject = input.lines.some(
      (line) => line.externalProductId === "prod-reject",
    );
    if (reject) {
      state.orders[input.externalOrderId] = {
        externalOrderId: input.externalOrderId,
        posOrderId: "",
        accepted: false,
        rejectionReason: "rejected",
        submittedAt: new Date().toISOString(),
        status: {
          externalOrderId: input.externalOrderId,
          acceptance: "rejected",
          preparation: "pending",
          fulfillment: "cancelled",
          updatedAt: new Date().toISOString(),
        },
        lines: input.lines,
      };
      await writeMockState(state);
      return {
        accepted: false,
        externalOrderId: input.externalOrderId,
        rejectionReason: "Commande refusée par le restaurant (scénario mock)",
      };
    }

    const authoritativeTotal = computeAuthoritativeTotal(state, input);
    if (authoritativeTotal !== input.expectedTotal && !input.acceptRepricing) {
      return {
        accepted: false,
        externalOrderId: input.externalOrderId,
        authoritativeTotal,
        repriced: true,
        rejectionReason: "stale_price",
      };
    }

    const order = this.persistAcceptedOrder(state, input);
    await writeMockState(state);
    return {
      accepted: true,
      externalOrderId: order.externalOrderId,
      posOrderId: order.posOrderId,
      authoritativeTotal: order.authoritativeTotal,
      repriced: order.authoritativeTotal !== input.expectedTotal,
      acceptedAt: order.submittedAt,
    };
  }

  private persistAcceptedOrder(
    state: MockState,
    input: SubmitOrderInput,
  ): MockStoredOrder {
    const posOrderId = `POS-${randomUUID().slice(0, 8).toUpperCase()}`;
    const authoritativeTotal = computeAuthoritativeTotal(state, input);
    const order: MockStoredOrder = {
      externalOrderId: input.externalOrderId,
      posOrderId,
      accepted: true,
      authoritativeTotal,
      submittedAt: new Date().toISOString(),
      status: {
        externalOrderId: input.externalOrderId,
        posOrderId,
        acceptance: "accepted",
        preparation: "pending",
        fulfillment: "pending",
        payment: "pending",
        updatedAt: new Date().toISOString(),
      },
      lines: input.lines,
    };
    state.orders[input.externalOrderId] = order;
    return order;
  }

  async getOrderByExternalId(
    externalOrderId: string,
  ): Promise<ExternalOrderStatus | null> {
    const state = await readMockState();
    const order = state.orders[externalOrderId];
    if (!order) return null;
    return clone(order.status);
  }

  async getOrderStatus(posOrderId: string): Promise<ExternalOrderStatus | null> {
    const state = await readMockState();
    const order = Object.values(state.orders).find(
      (o) => o.posOrderId === posOrderId,
    );
    if (!order) return null;
    return clone(order.status);
  }
}
