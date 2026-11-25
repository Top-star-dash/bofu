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

  try {
    await prisma.$transaction(async (tx) => {
      for (const prize of parsed.data.prizes) {
        const { id, ...data } = prize;
        if (id) {
          await tx.prize.update({ where: { id }, data });
        } else {
          await tx.prize.create({ data: { ...data, activityId: activity.id } });
        }
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? `保存失败：${error.message}` : "保存失败",
      },
      { status: 400 },
    );
  }

  await writeOperationLog(
    guard.session.sub,
    "prize.save",
    `${parsed.data.prizes.length} 项，概率合计 ${total}%`,
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const guard = await guardApi("prizes");
  if (guard.error) return guard.error;

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ message: "缺少奖品 id" }, { status: 400 });
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
