import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentActivity } from "@/lib/activity";
import { getAdminSession, writeOperationLog } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";

const schema = z.object({
  action: z.enum(["query", "confirm"]),
  redeemCode: z.string().trim().min(4).max(64),
  password: z.string().trim().min(1).max(32),
});

function maskPhone(phone: string | null | undefined) {
  if (!phone) return "-";
  return phone.replace(/^(\d{3})\d{4}(\d{4})$/, "$1****$2");
}

function serializeRecord(record: {
  redeemCode: string;
  prizeName: string;
  prizeLevel: string;
  isWin: boolean;
  redeemStatus: string;
  createdAt: Date;
  redeemedAt: Date | null;
  redeemedBy: string | null;
  customer: {
    id: string;
    nickname: string | null;
    lead: { name: string; phone: string } | null;
  };
}) {
  return {
    redeemCode: record.redeemCode,
    prizeName: record.prizeName,
    prizeLevel: record.prizeLevel,
    isWin: record.isWin,
    redeemStatus: record.redeemStatus,
    createdAt: record.createdAt.toISOString(),
    redeemedAt: record.redeemedAt?.toISOString() ?? null,
    redeemedBy: record.redeemedBy,
    customerName: record.customer.lead?.name || record.customer.nickname || "未留资客户",
    customerPhone: maskPhone(record.customer.lead?.phone),
  };
}

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
    return NextResponse.json({ message: "请填写核销码与核销密码" }, { status: 400 });
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
    include: {
      customer: { include: { lead: true } },
    },
  });

  if (!record || record.activityId !== activity.id) {
    return NextResponse.json({ message: "核销码不存在" }, { status: 404 });
  }

  const deadlinePassed = Date.now() > activity.redeemDeadline.getTime();

  if (parsed.data.action === "query") {
    return NextResponse.json({
      ok: true,
      redeemDeadline: activity.redeemDeadline.toISOString(),
      deadlinePassed,
      record: serializeRecord(record),
    });
  }

  if (!record.isWin) {
    return NextResponse.json(
      { message: "该记录为未中奖记录，无法核销", record: serializeRecord(record) },
      { status: 400 },
    );
  }

  if (record.redeemStatus === "REDEEMED") {
    return NextResponse.json(
      {
        message: `该奖品已于 ${record.redeemedAt?.toLocaleString("zh-CN") ?? "此前"} 核销`,
        record: serializeRecord(record),
      },
      { status: 409 },
    );
  }

  if (deadlinePassed) {
    const expired = await prisma.drawRecord.update({
      where: { id: record.id },
      data: { redeemStatus: "EXPIRED" },
      include: { customer: { include: { lead: true } } },
    });
    return NextResponse.json(
      {
        message: "已过兑奖截止时间，无法核销",
        record: serializeRecord(expired),
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
    include: { customer: { include: { lead: true } } },
  });

  await writeOperationLog(
    session.sub,
    "redeem.confirm",
    `${updated.redeemCode} ${updated.prizeLevel} ${updated.prizeName}`,
  );

  return NextResponse.json({
    ok: true,
    message: "核销成功",
    record: serializeRecord(updated),
  });
}
