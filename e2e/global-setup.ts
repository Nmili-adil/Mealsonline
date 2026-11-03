import { rmSync } from "node:fs";
import path from "node:path";

/** Ensure each E2E run starts with a clean local storefront fixture store. */
export default function globalSetup() {
  rmSync(path.join(process.cwd(), ".data", "storefront-fixtures.json"), { force: true });
}
