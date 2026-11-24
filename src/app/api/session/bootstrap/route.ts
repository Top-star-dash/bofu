import { NextResponse } from "next/server";
import { z } from "zod";
import {
  findConsultantByCode,
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
  shareCode: z.string().optional(),
  inviterId: z.string().optional(),
  openid: z.string().optional(),
});

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

  const consultant = await findConsultantByCode(
    activity.id,
    parsed.data.shareCode,
  );

  await prisma.activity.update({
    where: { id: activity.id },
    data: { exposureCount: { increment: 1 } },
  });

  let session = await getCustomerSession();
  let customer = null;

  const openid =
    parsed.data.openid ||
    session?.openid ||
    (process.env.APP_ENV === "PRODUCTION" ? null : `dev_${Date.now()}`);

  if (openid) {
    customer = await ensureCustomer({
      activityId: activity.id,
      openid,
      consultantId: consultant?.id,
      inviterId: parsed.data.inviterId,
    });
    await createCustomerSession({
      customerId: customer.id,
      activityId: activity.id,
      openid,
    });
    session = {
      customerId: customer.id,
      activityId: activity.id,
      openid,
    };
  }

  return NextResponse.json({
    activity: serializeActivityForClient(
      {
        ...activity,
        exposureCount: activity.exposureCount + 1,
      },
      consultant,
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
    session,
  });
}
