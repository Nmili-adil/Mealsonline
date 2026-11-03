import { rmSync } from "node:fs";
import path from "node:path";

/**
 * Global test setup (synchronous):
 *  - the dedicated test database is migrated by the `pretest` npm script,
 *  - the file-backed mock Caisse212 provider is reset,
 *  - the local storefront fixtures are reset.
 */
rmSync(path.join(process.cwd(), ".data", "mock-caisse212.json"), { force: true });
rmSync(path.join(process.cwd(), ".data", "storefront-fixtures.json"), { force: true });
