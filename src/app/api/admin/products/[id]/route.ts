import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminMutation } from "@/lib/auth/guard";
import { productPatchSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminMutation(request);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = productPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides" },
      { status: 400 },
    );
  }

  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
  }

  // Presentation-only fields. POS-controlled prices are never editable here.
  const data = parsed.data;
  const product = await prisma.product.update({
    where: { id },
    data: {
      websiteVisible: data.websiteVisible ?? existing.websiteVisible,
      isFeatured: data.isFeatured ?? existing.isFeatured,
      isPromoted: data.isPromoted ?? existing.isPromoted,
      sortOrder: data.sortOrder ?? existing.sortOrder,
      promotionalSettings:
        data.promotionalSettings !== undefined
          ? JSON.stringify(data.promotionalSettings)
          : existing.promotionalSettings,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorType: "admin",
      actorId: auth.session!.admin.id,
      action: "product.update",
      entityType: "Product",
      entityId: product.id,
      metadata: JSON.stringify(parsed.data),
    },
  });

  return NextResponse.json({ ok: true, product: { id: product.id, name: product.name } });
}
