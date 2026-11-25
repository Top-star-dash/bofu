import { NextResponse } from "next/server";
import { getCurrentActivity } from "@/lib/activity";
import { getCustomerSession } from "@/lib/customer-session";
import { drawPrize } from "@/lib/draw";
import { prisma } from "@/lib/db";

export async function POST() {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json(
      { message: "请先完成微信授权", code: "NEED_AUTH" },
      { status: 401 },
    );
  }

  const activity = await getCurrentActivity();
  if (!activity || activity.id !== session.activityId) {
    return NextResponse.json({ message: "活动不存在" }, { status: 404 });
  }

  if (activity.runtimeStatus !== "RUNNING") {
    return NextResponse.json({ message: "活动未开始或已结束" }, { status: 400 });
  }

  const customer = await prisma.customer.findUnique({
    where: { id: session.customerId },
    include: { lead: true },
  });

  if (!customer?.lead) {
    return NextResponse.json(
      { message: "请先完成留资", code: "NEED_LEAD" },
      { status: 400 },
    );
  }

  if (customer.drawChance <= 0) {
    return NextResponse.json(
      { message: "抽奖次数不足", code: "NO_CHANCE" },
      { status: 400 },
    );
  }

  try {
    const { record, prize } = await drawPrize(activity.id, customer.id);
    const updated = await prisma.customer.findUniqueOrThrow({
      where: { id: customer.id },
    });

    return NextResponse.json({
      ok: true,
      drawChance: updated.drawChance,
      result: {
        id: record.id,
        prizeName: record.prizeName,
        prizeLevel: record.prizeLevel,
        isWin: record.isWin,
        imageUrl: prize.imageUrl,
        redeemCode: record.redeemCode,
        redeemStatus: record.redeemStatus,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "抽奖失败" },
      { status: 400 },
    );
  }
}
