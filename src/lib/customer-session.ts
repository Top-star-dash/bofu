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

/**
 * 邀请关系校验：必须同活动、不能是自己、不能是「我邀请的人反过来邀请我」。
 * 上层（bootstrap）只负责传原始 inviterId，这里统一兜底。
 */
async function resolveInviterId(
  activityId: string,
  inviterId: string | null | undefined,
  selfId?: string | null,
) {
  if (!inviterId) return null;
  const inviter = await prisma.customer.findUnique({
    where: { id: inviterId },
    select: { id: true, activityId: true, inviterId: true },
  });
  if (!inviter || inviter.activityId !== activityId) return null;
  if (selfId && inviter.id === selfId) return null;
  if (selfId && inviter.inviterId === selfId) return null;
  return inviter.id;
}

export async function ensureCustomer(params: {
  activityId: string;
  openid: string;
  consultantId?: string | null;
  /** 允许覆盖已锁定的默认顾问（自然访问先锁默认、首位销售链接可接管） */
  forceConsultantId?: string | null;
  inviterId?: string | null;
  unionid?: string | null;
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

  const unionid = params.unionid?.trim() || null;
  const nickname = params.nickname?.trim() || null;
  const avatarUrl = params.avatarUrl?.trim() || null;

  if (existing) {
    // C.2.2：邀请关系只在为空时写入，首次锁定后不再改
    const inviterId =
      existing.inviterId ||
      (await resolveInviterId(params.activityId, params.inviterId, existing.id));

    await prisma.customer.update({
      where: { id: existing.id },
      data: {
        lastActiveAt: new Date(),
        consultantId:
          params.forceConsultantId?.trim() ||
          existing.consultantId ||
          params.consultantId ||
          undefined,
        inviterId: inviterId || undefined,
        // 有新资料则刷新；空值不抹掉已落库信息
        unionid: unionid || existing.unionid,
        nickname: nickname || existing.nickname,
        avatarUrl: avatarUrl || existing.avatarUrl,
      },
    });
    return prisma.customer.findUniqueOrThrow({
      where: { id: existing.id },
      include: {
        lead: true,
        drawRecords: {
          orderBy: { createdAt: "desc" },
          include: { prize: true },
        },
      },
    });
  }

  return prisma.customer.create({
    data: {
      activityId: params.activityId,
      openid: params.openid,
      unionid: unionid || undefined,
      consultantId: params.consultantId || undefined,
      inviterId:
        (await resolveInviterId(params.activityId, params.inviterId)) ||
        undefined,
      nickname: nickname || undefined,
      avatarUrl: avatarUrl || undefined,
      drawChance: 0,
    },
    include: {
      lead: true,
      drawRecords: {
        orderBy: { createdAt: "desc" },
        include: { prize: true },
      },
    },
  });
}
