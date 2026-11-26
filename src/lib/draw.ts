import { prisma } from "@/lib/db";
import { generateRedeemCode } from "@/lib/redeem-code";

function toNumber(value: { toString(): string } | number) {
  return typeof value === "number" ? value : Number(value.toString());
}

/** 以北京时间零点为界计算当日起点 */
function shanghaiDayStart(now: Date) {
  const offsetMs = 8 * 60 * 60 * 1000;
  const local = now.getTime() + offsetMs;
  const dayStartLocal = Math.floor(local / 86_400_000) * 86_400_000;
  return new Date(dayStartLocal - offsetMs);
}

export async function drawPrize(activityId: string, customerId: string) {
  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({ where: { id: customerId } });
    if (!customer || customer.activityId !== activityId) {
      throw new Error("客户不存在");
    }
    if (customer.drawChance <= 0) {
      throw new Error("抽奖次数不足");
    }

    const activity = await tx.activity.findUnique({ where: { id: activityId } });
    if (!activity) throw new Error("活动不存在");

    const now = Date.now();
    if (now < activity.startAt.getTime() || now > activity.endAt.getTime()) {
      throw new Error("活动未开始或已结束");
    }

    // C.6.5：每日 / 活动期总次数上限（0 表示不限）
    if (activity.totalDrawLimit > 0) {
      const total = await tx.drawRecord.count({ where: { customerId } });
      if (total >= activity.totalDrawLimit) {
        throw new Error(`本次活动最多抽奖 ${activity.totalDrawLimit} 次`);
      }
    }
    if (activity.dailyDrawLimit > 0) {
      const today = await tx.drawRecord.count({
        where: { customerId, createdAt: { gte: shanghaiDayStart(new Date(now)) } },
      });
      if (today >= activity.dailyDrawLimit) {
        throw new Error(`今日抽奖次数已用完，明天再来试试`);
      }
    }

    const prizes = await tx.prize.findMany({
      where: { activityId, enabled: true },
      orderBy: { sortOrder: "asc" },
    });

    const available = prizes.filter(
      (prize) => prize.isFallback || prize.remainStock > 0,
    );
    if (!available.length) throw new Error("奖品已发完");

    const total = available.reduce((sum, prize) => sum + toNumber(prize.probability), 0);
    const random = Math.random() * total;
    let cursor = 0;
    let selected = available[available.length - 1];
    for (const prize of available) {
      cursor += toNumber(prize.probability);
      if (random <= cursor) {
        selected = prize;
        break;
      }
    }

    if (!selected.isFallback) {
      const updated = await tx.prize.updateMany({
        where: { id: selected.id, remainStock: { gt: 0 } },
        data: { remainStock: { decrement: 1 } },
      });
      if (!updated.count) {
        selected =
          available.find((prize) => prize.isFallback) ??
          available[available.length - 1];
      }
    }

    await tx.customer.update({
      where: { id: customerId },
      data: {
        drawChance: { decrement: 1 },
        lastActiveAt: new Date(),
      },
    });

    await tx.activity.update({
      where: { id: activityId },
      data: { participateCount: { increment: 1 } },
    });

    const isWin = !selected.isFallback;

    // 核销码改为 4~8 位数字（这里生成 6 位），冲突时重试
    let redeemCode = generateRedeemCode();
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const exists = await tx.drawRecord.findUnique({
        where: { redeemCode },
        select: { id: true },
      });
      if (!exists) break;
      redeemCode = generateRedeemCode();
    }

    const record = await tx.drawRecord.create({
      data: {
        activityId,
        customerId,
        prizeId: selected.id,
        prizeName: selected.name,
        prizeLevel: selected.level,
        isWin,
        redeemStatus: isWin ? "PENDING" : "EXPIRED",
        redeemCode,
      },
    });

    return { record, prize: selected };
  });
}
