import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  return NextResponse.json({
    ok: true,
    csrfToken: auth.session!.session.csrfToken,
    admin: auth.session!.admin,
  });
}
