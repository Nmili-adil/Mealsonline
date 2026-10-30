/**
 * Seed script — development fixtures and initial admin provisioning.
 *
 * Run with:  npm run db:seed
 *
 * The initial admin is created from environment variables (never from a
 * public endpoint with a default password):
 *   ADMIN_EMAIL    (default: admin@mealsonline.ma)
 *   ADMIN_PASSWORD (default: ChangeMe123! — CHANGE IT)
 */
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/crypto";
import { ensureDefaultRestaurant } from "../src/lib/site";
import { runCatalogSync } from "../src/lib/sync/catalog-sync";

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@mealsonline.ma").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? "ChangeMe123!";
  const secret = process.env.AUTH_SECRET ?? "dev";

  await ensureDefaultRestaurant();

  const existing = await prisma.adminUser.findUnique({ where: { email: adminEmail } });
  if (existing) {
    console.log(`Admin existe déjà : ${adminEmail} (aucun changement de mot de passe)`);
  } else {
    await prisma.adminUser.create({
      data: {
        email: adminEmail,
        name: "Administrateur",
        passwordHash: hashPassword(adminPassword, secret),
        role: "admin",
        isActive: true,
      },
    });
    console.log(`Admin créé : ${adminEmail}`);
  }

  const sync = await runCatalogSync();
  console.log(
    `Synchronisation du catalogue : ${sync.status} — ${sync.importedProducts} importé(s), ` +
      `${sync.updatedProducts} mis à jour, ${sync.archivedProducts} archivé(s), ` +
      `${sync.failedRecords} échec(s)`,
  );
  if (sync.error) console.error(`Erreur : ${sync.error}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
