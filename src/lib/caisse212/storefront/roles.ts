const STOREFRONT_ADMIN_ROLES = new Set([
  "admin",
  "super_admin",
  "super-admin",
  "superadmin",
]);

/** V206 requires ADMIN or SUPER_ADMIN for storefront management. */
export function canManageStorefronts(role: string | null | undefined): boolean {
  return Boolean(role && STOREFRONT_ADMIN_ROLES.has(role.toLowerCase()));
}
