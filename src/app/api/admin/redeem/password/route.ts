import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApi } from "@/lib/admin-guard";
import { getCurrentActivity } from "@/lib/activity";
import { writeOperationLog } from "@/lib/auth";
import { prisma } from "@/lib/db";

const schema = z.object({
  currentPassword: z.string().trim().min(1).max(32),
  newPassword: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "核销密码须为 4 位数字"),
});

/** 核销台修改活动统一核销密码（需校验当前密码） */
export async function PATCH(request: Request) {
  const guard = await guardApi("redeem");
  if (guard.error) return guard.error;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message || "参数不正确" },
      { status: 400 },
    );
  }

  const activity = await getCurrentActivity();
  if (!activity) {
    return NextResponse.json({ message: "活动未配置" }, { status: 404 });
  }

  if (parsed.data.currentPassword !== activity.redeemPassword) {
    return NextResponse.json({ message: "当前核销密码不正确" }, { status: 400 });
  }

  if (parsed.data.newPassword === activity.redeemPassword) {
    return NextResponse.json({ message: "新密码不能与当前密码相同" }, { status: 400 });
  }

  await prisma.activity.update({
    where: { id: activity.id },
    data: { redeemPassword: parsed.data.newPassword },
  });

  await writeOperationLog(
    guard.session.sub,
    "redeem.password",
    "修改核销密码",
  );

  return NextResponse.json({ ok: true });
}
