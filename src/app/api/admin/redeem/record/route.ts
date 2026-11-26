import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentActivity } from "@/lib/activity";
import { getAdminSession, writeOperationLog } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";

const schema = z.object({
  drawRecordId: z.string().trim().min(1).max(64),
  password: z.string().trim().min(1).max(32),
});

/** 线索详情「客户奖品」内按中奖记录直接核销 */
export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ message: "请先登录后台" }, { status: 401 });
  }
  if (!hasPermission(session.permissions, "redeem", session.isSuperAdmin)) {
    return NextResponse.json({ message: "没有核销权限" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "请填写核销密码" },
      { status: 400 },
    );
  }

  const activity = await getCurrentActivity();
  if (!activity) {
    return NextResponse.json({ message: "活动不存在" }, { status: 404 });
  }

  if (parsed.data.password !== activity.redeemPassword) {
    return NextResponse.json({ message: "核销密码错误" }, { status: 400 });
  }

  const record = await prisma.drawRecord.findUnique({
    where: { id: parsed.data.drawRecordId },
    include: { customer: { include: { lead: true } } },
  });

  if (!record || record.activityId !== activity.id) {
    return NextResponse.json({ message: "中奖记录不存在" }, { status: 404 });
  }

  if (!record.isWin) {
    return NextResponse.json({ message: "该记录为未中奖记录，无法核销" }, { status: 400 });
  }

  if (record.redeemStatus === "REDEEMED") {
    return NextResponse.json({ message: "该奖品已核销，请勿重复发放" }, { status: 409 });
  }

  if (Date.now() > activity.redeemDeadline.getTime()) {
    const expired = await prisma.drawRecord.update({
      where: { id: record.id },
      data: { redeemStatus: "EXPIRED" },
    });
    return NextResponse.json(
      {
        message: "已过兑奖截止时间，无法核销",
        record: {
          id: expired.id,
          redeemStatus: expired.redeemStatus,
          redeemedAt: null,
          redeemedBy: null,
        },
      },
      { status: 400 },
    );
  }

  const operator = `${session.name}(${session.username})`;
  const updated = await prisma.drawRecord.update({
    where: { id: record.id },
    data: {
      redeemStatus: "REDEEMED",
      redeemedAt: new Date(),
      redeemedBy: operator,
    },
  });

  await writeOperationLog(
    session.sub,
    "redeem.confirm",
    `${updated.redeemCode} ${updated.prizeLevel} ${updated.prizeName}（线索详情核销）`,
  );

  return NextResponse.json({
    ok: true,
    message: "核销成功，请交付奖品",
    record: {
      id: updated.id,
      redeemStatus: updated.redeemStatus,
      redeemedAt: updated.redeemedAt?.toISOString() ?? null,
      redeemedBy: updated.redeemedBy,
    },
  });
}
