import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi, requireAdminMutation } from "@/lib/auth/guard";
import { readMockState, setMockScenario } from "@/lib/caisse212/mock";
import { getCaisse212Mode } from "@/lib/caisse212/client";

export const dynamic = "force-dynamic";

const scenarioSchema = z.object({
  scenario: z.enum(["normal", "pos_offline", "ambiguous_timeout"]),
});

/** Dev/demo only: inspect the mock provider scenario. */
export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  if (getCaisse212Mode() !== "mock") {
    return NextResponse.json({ error: "Disponible uniquement en mode mock" }, { status: 409 });
  }

  const state = await readMockState();
  return NextResponse.json({
    mode: "mock",
    scenario: state.scenario,
    unavailableProducts: state.unavailableProducts,
  });
}

/** Dev/demo only: switch the mock provider scenario. */
export async function POST(request: NextRequest) {
  const auth = await requireAdminMutation(request);
  if (!auth.ok) return auth.response;

  if (getCaisse212Mode() !== "mock") {
    return NextResponse.json({ error: "Disponible uniquement en mode mock" }, { status: 409 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = scenarioSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Scénario invalide" },
      { status: 400 },
    );
  }

  await setMockScenario(parsed.data.scenario);
  return NextResponse.json({ ok: true, scenario: parsed.data.scenario });
}
