import "server-only";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/session";
import { requireAdminApi, requireAdminMutation } from "@/lib/auth/guard";

import { canManageStorefronts } from "./roles";

export { canManageStorefronts };

type ApiGuard = Awaited<ReturnType<typeof requireAdminApi>>;
type MutationGuard = Awaited<ReturnType<typeof requireAdminMutation>>;

function forbidden(): NextResponse {
  return NextResponse.json(
    { ok: false, error: "Permissions insuffisantes : rôle ADMIN ou SUPER_ADMIN requis." },
    { status: 403 },
  );
}

export async function requireStorefrontAdminApi(): Promise<ApiGuard> {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth;
  const session = auth.session;
  if (!session || !canManageStorefronts(session.admin.role)) {
    return { ok: false, response: forbidden() };
  }
  return { ok: true, session };
}

export async function requireStorefrontAdminMutation(
  request: Request,
): Promise<MutationGuard> {
  const auth = await requireAdminMutation(request);
  if (!auth.ok) return auth;
  if (!canManageStorefronts(auth.session.admin.role)) {
    return { ok: false, response: forbidden() };
  }
  return auth;
}

/** Page-level guard: operators are redirected away from /admin/websites. */
export async function requireStorefrontAdminPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!canManageStorefronts(session.admin.role)) redirect("/admin");
  return session;
}
