import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentActivity } from "@/lib/activity";
import { getCustomerSession } from "@/lib/customer-session";
import { prisma } from "@/lib/db";

const schema = z.object({
  redeemCode: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ message: "请先完成微信授权" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "参数不正确" }, { status: 400 });
  }

  const activity = await getCurrentActivity();
  if (!activity) {
    return NextResponse.json({ message: "活动不存在" }, { status: 404 });
  }

  if (parsed.data.password !== activity.redeemPassword) {
    return NextResponse.json({ message: "核销密码错误" }, { status: 400 });
  }

  const record = await prisma.drawRecord.findUnique({
    where: { redeemCode: parsed.data.redeemCode },
  });

  if (!record || record.customerId !== session.customerId) {
    return NextResponse.json({ message: "中奖记录不存在" }, { status: 404 });
  }

  if (!record.isWin) {
    return NextResponse.json({ message: "该记录不可核销" }, { status: 400 });
  }

  if (record.redeemStatus === "REDEEMED") {
    return NextResponse.json({ message: "该奖品已核销" }, { status: 400 });
  }

  if (Date.now() > activity.redeemDeadline.getTime()) {
    await prisma.drawRecord.update({
      where: { id: record.id },
      data: { redeemStatus: "EXPIRED" },
    });
    return NextResponse.json({ message: "已过兑奖截止时间" }, { status: 400 });
  }

  const updated = await prisma.drawRecord.update({
    where: { id: record.id },
    data: {
      redeemStatus: "REDEEMED",
      redeemedAt: new Date(),
      redeemedBy: "staff",
    },
  });

  return NextResponse.json({
    ok: true,
    redeemStatus: updated.redeemStatus,
    redeemedAt: updated.redeemedAt,
  });
}
