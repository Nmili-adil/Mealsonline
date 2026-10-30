import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { randomToken, sha256Hex } from "@/lib/crypto";
import { AUTH_COOKIE_NAME } from "@/lib/constants";

const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

export interface AdminSessionContext {
  session: {
    id: string;
    csrfToken: string;
    expiresAt: Date;
  };
  admin: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

export function authCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}

export async function createAdminSession(adminUserId: string) {
  const token = randomToken(32);
  const csrfToken = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  const session = await prisma.adminSession.create({
    data: {
      tokenHash: sha256Hex(token),
      adminUserId,
      csrfToken,
      expiresAt,
    },
  });
  return { rawToken: token, csrfToken, expiresAt: session.expiresAt };
}

export async function destroyAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (rawToken) {
    await prisma.adminSession.deleteMany({
      where: { tokenHash: sha256Hex(rawToken) },
    });
  }
  cookieStore.delete(AUTH_COOKIE_NAME);
}

export async function getAdminSession(): Promise<AdminSessionContext | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!rawToken) return null;

  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: sha256Hex(rawToken) },
    include: { adminUser: true },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.adminSession.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  if (!session.adminUser.isActive) return null;

  // Opportunistic last-seen update (best effort).
  await prisma.adminSession
    .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
    .catch(() => undefined);

  return {
    session: {
      id: session.id,
      csrfToken: session.csrfToken,
      expiresAt: session.expiresAt,
    },
    admin: {
      id: session.adminUser.id,
      email: session.adminUser.email,
      name: session.adminUser.name,
      role: session.adminUser.role,
    },
  };
}

export async function setAdminSessionCookie(rawToken: string, expiresAt: Date): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, rawToken, authCookieOptions(expiresAt));
}
