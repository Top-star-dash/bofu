import { compare, hash } from "bcryptjs";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import type { PermissionCode } from "@/lib/permissions";
import { permissionCodesFromUserRoles } from "@/lib/roles";

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
  const { sub, ...claims } = payload;
  const token = await new SignJWT(claims as AdminJwtPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
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
      roles: {
        include: {
          role: {
            include: {
              permissions: { include: { permission: true } },
            },
          },
        },
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
    permissions: permissionCodesFromUserRoles(user.roles),
  } satisfies AdminSession;
}

/** 日志正文上限：列已为 TEXT，这里只做防御性截断，避免异常长内容拖垮写入 */
const LOG_DETAIL_MAX = 500;

export function trimLogDetail(detail?: string | null) {
  if (detail === undefined || detail === null) return null;
  const text = String(detail);
  if (text.length <= LOG_DETAIL_MAX) return text;
  return `${text.slice(0, LOG_DETAIL_MAX)}…（已截断，原长 ${text.length}）`;
}

export async function writeOperationLog(
  userId: string | null | undefined,
  action: string,
  detail?: string | null,
) {
  const detailText = trimLogDetail(detail);
  // 失效会话可能带着已删除的 userId（如重新 seed），空串/"undefined" 也当作无用户
  const uid =
    userId && userId !== "undefined" && userId !== "null" ? userId : null;

  try {
    await prisma.operationLog.create({
      data: { userId: uid, action, detail: detailText },
    });
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: string }).code)
        : "";
    // FK 失败时降级为匿名日志，避免刷屏且不影响保存
    if (code === "P2003" && uid) {
      try {
        await prisma.operationLog.create({
          data: { userId: null, action, detail: detailText },
        });
        return;
      } catch (retryError) {
        console.error(`[operationLog] 写入失败 action=${action}`, retryError);
        return;
      }
    }
    console.error(`[operationLog] 写入失败 action=${action}`, error);
  }
}
