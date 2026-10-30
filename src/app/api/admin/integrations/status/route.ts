import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/guard";
import { getIntegrationHealth } from "@/lib/caisse212/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  return NextResponse.json(getIntegrationHealth());
}
