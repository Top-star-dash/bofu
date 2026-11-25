import { NextResponse } from "next/server";
import { z } from "zod";
import {
  findConsultantById,
  findConsultantByShareCode,
  findDefaultConsultant,
  getCurrentActivity,
  serializeActivityForClient,
} from "@/lib/activity";
import {
  createCustomerSession,
  ensureCustomer,
  getCustomerSession,
} from "@/lib/customer-session";
import { prisma } from "@/lib/db";

const schema = z.object({
  shareCode: z.string().trim().max(64).optional(),
  inviterId: z.string().trim().max(64).optional(),
  /** 仅非生产环境用于联调，生产环境忽略 */
  openid: z.string().trim().max(64).optional(),
});

const EXPOSURE_DEDUPE_MS = 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "参数错误" }, { status: 400 });
  }

  const activity = await getCurrentActivity();
  if (!activity) {
    return NextResponse.json({ message: "活动未配置" }, { status: 404 });
  }

  const isProduction = process.env.APP_ENV === "PRODUCTION";
  const session = await getCustomerSession();

  // B.1：生产环境不允许用请求体里的 openid 创建/切换身份
  const bodyOpenid = isProduction ? undefined : parsed.data.openid;
  const openid =
    bodyOpenid ||
    session?.openid ||
    (isProduction ? null : `dev_${Date.now()}`);

  const linkConsultant = await findConsultantByShareCode(
    activity.id,
    parsed.data.shareCode,
  );

  const existing = openid
    ? await prisma.customer.findUnique({
        where: {
          activityId_openid: { activityId: activity.id, openid },
        },
        select: { id: true, consultantId: true, lastExposureAt: true },
      })
    : null;

  // C.3.2：无销售码但有邀请人时，继承邀请人已锁定的顾问（多层穿透）
  let inheritedConsultantId: string | null = null;
  let inviterValid = false;
  if (parsed.data.inviterId) {
    const inviter = await prisma.customer.findUnique({
      where: { id: parsed.data.inviterId },
      select: { id: true, activityId: true, consultantId: true, inviterId: true },
    });
    if (
      inviter &&
      inviter.activityId === activity.id &&
      inviter.id !== existing?.id &&
      (!existing || inviter.id !== existing.id) &&
      (!existing || inviter.inviterId !== existing.id)
    ) {
      inheritedConsultantId = inviter.consultantId;
      inviterValid = true;
    }
  }

  // 首触锁客：已锁定到具体销售后，再点其他销售链接不改绑（A.1）
  const lockedConsultant = await findConsultantById(
    activity.id,
    existing?.consultantId,
  );
  const lockedBySales = Boolean(lockedConsultant && !lockedConsultant.isDefault);

  // 可接管的顾问：销售链接优先，其次邀请人继承（多层穿透）
  const takeoverConsultant = lockedBySales
    ? null
    : linkConsultant ??
      (await findConsultantById(activity.id, inheritedConsultantId));

  const assignedConsultant =
    takeoverConsultant ??
    lockedConsultant ??
    (await findDefaultConsultant(activity.id));

  // 展示用顾问：已锁定到销售时始终展示该销售（不改绑），否则展示本次链接/继承的顾问
  const displayConsultant = lockedBySales ? lockedConsultant : assignedConsultant;

  let customer = null;
  let exposureCounted = false;

  if (openid) {
    customer = await ensureCustomer({
      activityId: activity.id,
      openid,
      consultantId: assignedConsultant?.id,
      forceConsultantId: takeoverConsultant?.id,
      inviterId: inviterValid ? parsed.data.inviterId : undefined,
    });
    await createCustomerSession({
      customerId: customer.id,
      activityId: activity.id,
      openid,
    });

    // C.3.4：同一客户 24 小时内只计一次曝光；销售本人打开自己的链接不计
    const selfView = Boolean(
      linkConsultant?.openid && linkConsultant.openid === openid,
    );
    const recent =
      existing?.lastExposureAt &&
      Date.now() - existing.lastExposureAt.getTime() < EXPOSURE_DEDUPE_MS;

    if (!selfView && !recent) {
      exposureCounted = true;
      await prisma.customer.update({
        where: { id: customer.id },
        data: { lastExposureAt: new Date() },
      });
    }
  } else {
    // 未授权浏览也计入曝光，但每次访问都算（没有身份无法去重）
    exposureCounted = true;
  }

  if (exposureCounted) {
    await prisma.activity.update({
      where: { id: activity.id },
      data: { exposureCount: { increment: 1 } },
    });
  }

  return NextResponse.json({
    activity: serializeActivityForClient(
      {
        ...activity,
        exposureCount: activity.exposureCount + (exposureCounted ? 1 : 0),
      },
      displayConsultant,
    ),
    customer: customer
      ? {
          id: customer.id,
          drawChance: customer.drawChance,
          assistGained: customer.assistGained,
          hasLead: Boolean(customer.lead),
          prizes: customer.drawRecords.map((record) => ({
            id: record.id,
            prizeName: record.prizeName,
            prizeLevel: record.prizeLevel,
            isWin: record.isWin,
            redeemStatus: record.redeemStatus,
            createdAt: record.createdAt,
            redeemCode: record.redeemCode,
          })),
        }
      : null,
  });
}
