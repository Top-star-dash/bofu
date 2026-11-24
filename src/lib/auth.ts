import { compare, hash } from "bcryptjs";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import type { PermissionCode } from "@/lib/permissions";

const COOKIE_NAME = "bofu_admin_session";
const SESSION_DAYS = 7;

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is missing");
  return new TextEncoder().encode(secret);
}

export type AdminSession = {
  sub: string;
  username: string;
  name: string;
  isSuperAdmin: boolean;
  permissions: string[];
};

type AdminJwtPayload = JWTPayload & AdminSession;

export async function hashPassword(password: string) {
  return hash(password, 10);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return compare(password, passwordHash);
}

export async function createAdminSession(payload: AdminSession) {
  const token = await new SignJWT(payload as AdminJwtPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      sub: String(payload.sub),
      username: String(payload.username),
      name: String(payload.name),
      isSuperAdmin: Boolean(payload.isSuperAdmin),
      permissions: Array.isArray(payload.permissions)
        ? payload.permissions.map(String)
        : [],
    };
  } catch {
    return null;
  }
}

export async function requireAdmin(permission?: PermissionCode) {
  const session = await getAdminSession();
  if (!session) return null;
  if (permission && !session.isSuperAdmin && !session.permissions.includes(permission)) {
    return null;
  }
  return session;
}

export async function loadAdminAuthPayload(username: string, password: string) {
  const user = await prisma.adminUser.findUnique({
    where: { username },
    include: {
      permissions: {
        include: { permission: true },
      },
    },
  });

  if (!user || user.status !== "ACTIVE") return null;
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;

  return {
    sub: user.id,
    username: user.username,
    name: user.name,
    isSuperAdmin: user.isSuperAdmin,
    permissions: user.permissions.map((item) => item.permission.code),
  } satisfies AdminSession;
}

export async function writeOperationLog(
  userId: string | null | undefined,
  action: string,
  detail?: string,
) {
  await prisma.operationLog.create({
    data: {
      userId: userId || null,
      action,
      detail,
    },
  });
}
