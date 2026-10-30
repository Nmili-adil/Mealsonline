import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashIp, verifyPassword } from "@/lib/crypto";
import { adminLoginSchema } from "@/lib/validation/schemas";
import { createAdminSession, setAdminSessionCookie } from "@/lib/auth/session";
import { rateLimit } from "@/lib/auth/rate-limit";

export const dynamic = "force-dynamic";

const LOGIN_RATE_LIMIT = 10;

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const ipKey = hashIp(ip, process.env.AUTH_SECRET ?? "dev");
  const limit = rateLimit(ipKey, LOGIN_RATE_LIMIT);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez plus tard." },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = adminLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Email ou mot de passe invalide" }, { status: 400 });
  }

  const admin = await prisma.adminUser.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });
  if (!admin || !admin.isActive) {
    return NextResponse.json({ error: "Email ou mot de passe invalide" }, { status: 401 });
  }

  const valid = verifyPassword(
    parsed.data.password,
    admin.passwordHash,
    process.env.AUTH_SECRET ?? "dev",
  );
  if (!valid) {
    await prisma.auditLog.create({
      data: {
        actorType: "system",
        action: "admin.login_failed",
        entityType: "AdminUser",
        entityId: admin.id,
        ipHash: ipKey,
      },
    });
    return NextResponse.json({ error: "Email ou mot de passe invalide" }, { status: 401 });
  }

  const session = await createAdminSession(admin.id);
  await setAdminSessionCookie(session.rawToken, session.expiresAt);
  await prisma.auditLog.create({
    data: {
      actorType: "admin",
      actorId: admin.id,
      action: "admin.login",
      entityType: "AdminUser",
      entityId: admin.id,
      ipHash: ipKey,
    },
  });

  return NextResponse.json({
    ok: true,
    csrfToken: session.csrfToken,
    admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
  });
}
