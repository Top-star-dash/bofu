import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

const COOKIE_NAME = "bofu_customer_session";

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is missing");
  return new TextEncoder().encode(secret);
}

export type CustomerSession = {
  customerId: string;
  activityId: string;
  openid: string;
};

export async function createCustomerSession(payload: CustomerSession) {
  const token = await new SignJWT(payload as JWTPayload & CustomerSession)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
}

export async function getCustomerSession(): Promise<CustomerSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      customerId: String(payload.customerId),
      activityId: String(payload.activityId),
      openid: String(payload.openid),
    };
  } catch {
    return null;
  }
}

export async function ensureCustomer(params: {
  activityId: string;
  openid: string;
  consultantId?: string | null;
  inviterId?: string | null;
  nickname?: string | null;
  avatarUrl?: string | null;
}) {
  const existing = await prisma.customer.findUnique({
    where: {
      activityId_openid: {
        activityId: params.activityId,
        openid: params.openid,
      },
    },
    include: { lead: true },
  });

  if (existing) {
    await prisma.customer.update({
      where: { id: existing.id },
      data: {
        lastActiveAt: new Date(),
        consultantId: existing.consultantId || params.consultantId || undefined,
        nickname: params.nickname || existing.nickname,
        avatarUrl: params.avatarUrl || existing.avatarUrl,
      },
    });
    return prisma.customer.findUniqueOrThrow({
      where: { id: existing.id },
      include: { lead: true, drawRecords: { orderBy: { createdAt: "desc" } } },
    });
  }

  return prisma.customer.create({
    data: {
      activityId: params.activityId,
      openid: params.openid,
      consultantId: params.consultantId || undefined,
      inviterId: params.inviterId || undefined,
      nickname: params.nickname || undefined,
      avatarUrl: params.avatarUrl || undefined,
      drawChance: 0,
    },
    include: { lead: true, drawRecords: { orderBy: { createdAt: "desc" } } },
  });
}
