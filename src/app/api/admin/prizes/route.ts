import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApi } from "@/lib/admin-guard";
import { getCurrentActivity } from "@/lib/activity";
import { writeOperationLog } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { safeMediaUrl } from "@/lib/urls";

const prizeInput = z.object({
  id: z.string().optional(),
  level: z.string().trim().min(1).max(32),
  name: z.string().trim().min(1).max(64),
  imageUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .transform((value) => (value ? safeMediaUrl(value) : null)),
  stock: z.number().int().min(0).max(1_000_000),
  remainStock: z.number().int().min(0).max(1_000_000),
  probability: z.number().min(0).max(100),
  description: z.string().trim().max(300).optional().nullable(),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  enabled: z.boolean().default(true),
  isFallback: z.boolean().default(false),
});

const saveSchema = z.object({
  prizes: z.array(prizeInput).min(1).max(50),
});

/** 概率合计必须为 100%，否则保存失败（E.2.4 验收） */
function probabilityTotal(prizes: Array<{ probability: number; enabled: boolean }>) {
  return prizes
    .filter((prize) => prize.enabled)
    .reduce((sum, prize) => sum + Number(prize.probability), 0);
}

const STOCK_LOCKED_MESSAGE =
  "活动进行中不可修改库存/剩余库存，请先到「活动配置」将状态改为「草稿」或「已结束」后再改";

export async function PATCH(request: Request) {
  const guard = await guardApi("prizes");
  if (guard.error) return guard.error;

  const parsed = saveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message || "奖品参数不正确" },
      { status: 400 },
    );
  }

  const activity = await getCurrentActivity();
  if (!activity) {
    return NextResponse.json({ message: "活动未配置" }, { status: 404 });
  }

  const total = probabilityTotal(parsed.data.prizes);
  if (Math.abs(total - 100) > 0.01) {
    return NextResponse.json(
      { message: `启用奖品的概率合计为 ${total.toFixed(2)}%，需要等于 100%` },
      { status: 400 },
    );
  }

  const stockLocked = activity.runtimeStatus === "RUNNING";

  try {
    await prisma.$transaction(async (tx) => {
      for (const prize of parsed.data.prizes) {
        const { id, stock, remainStock, ...rest } = prize;
        if (id) {
          if (stockLocked) {
            const current = await tx.prize.findUnique({
              where: { id },
              select: { stock: true, remainStock: true, activityId: true },
            });
            if (!current || current.activityId !== activity.id) {
              throw new Error("奖品不存在或不属于当前活动");
            }
            if (current.stock !== stock || current.remainStock !== remainStock) {
              throw new Error(STOCK_LOCKED_MESSAGE);
            }
            // 进行中绝不写回库存字段，避免并发抽奖后被表单旧值覆盖
            await tx.prize.update({ where: { id }, data: rest });
          } else {
            await tx.prize.update({
              where: { id },
              data: { ...rest, stock, remainStock },
            });
          }
        } else if (stockLocked) {
          throw new Error(
            "活动进行中不可新增奖品（含库存），请先到「活动配置」将状态改为「草稿」或「已结束」后再操作",
          );
        } else {
          await tx.prize.create({
            data: { ...rest, stock, remainStock, activityId: activity.id },
          });
        }
      }
    });
  } catch (error) {
    const raw = error instanceof Error ? error.message : "保存失败";
    const locked = raw.includes("活动进行中");
    return NextResponse.json(
      { message: locked ? raw : `保存失败：${raw}` },
      { status: locked ? 409 : 400 },
    );
  }

  await writeOperationLog(
    guard.session.sub,
    "prize.save",
    `${parsed.data.prizes.length} 项，概率合计 ${total}%${stockLocked ? "（进行中未改库存）" : ""}`,
  );

  return NextResponse.json({ ok: true, stockLocked });
}

export async function DELETE(request: Request) {
  const guard = await guardApi("prizes");
  if (guard.error) return guard.error;

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ message: "缺少奖品 id" }, { status: 400 });
  }

  const activity = await getCurrentActivity();
  if (activity?.runtimeStatus === "RUNNING") {
    return NextResponse.json(
      {
        message:
          "活动进行中不可删除奖品，请先到「活动配置」将状态改为「草稿」或「已结束」后再操作",
      },
      { status: 409 },
    );
  }

  const used = await prisma.drawRecord.count({ where: { prizeId: id } });
  if (used > 0) {
    return NextResponse.json(
      { message: `该奖品已有 ${used} 条中奖记录，不能删除，请改为停用` },
      { status: 409 },
    );
  }

  await prisma.prize.delete({ where: { id } });
  await writeOperationLog(guard.session.sub, "prize.delete", id);
  return NextResponse.json({ ok: true });
}
