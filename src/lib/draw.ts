import { prisma } from "@/lib/db";

function toNumber(value: { toString(): string } | number) {
  return typeof value === "number" ? value : Number(value.toString());
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
    const record = await tx.drawRecord.create({
      data: {
        activityId,
        customerId,
        prizeId: selected.id,
        prizeName: selected.name,
        prizeLevel: selected.level,
        isWin,
        redeemStatus: isWin ? "PENDING" : "EXPIRED",
      },
    });

    return { record, prize: selected };
  });
}
