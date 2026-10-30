import "server-only";
import { getCaisse212Provider } from "./client";
import type {
  AvailabilitySnapshot,
  CatalogChanges,
  CatalogSnapshot,
} from "./types";

/**
 * Catalog operations against Caisse212. All calls stay server-side; the
 * browser never receives Caisse212 credentials or raw POS payloads.
 */

export async function fetchCatalogFromCaisse212(): Promise<CatalogSnapshot> {
  const provider = getCaisse212Provider();
  return provider.fetchCatalog();
}

export async function fetchCatalogChangesFromCaisse212(
  cursor?: string,
): Promise<CatalogChanges> {
  const provider = getCaisse212Provider();
  return provider.fetchChanges(cursor);
}

export async function fetchAvailabilityFromCaisse212(): Promise<AvailabilitySnapshot> {
  const provider = getCaisse212Provider();
  return provider.getAvailability();
}
