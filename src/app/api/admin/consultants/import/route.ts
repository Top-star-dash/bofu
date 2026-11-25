import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApi } from "@/lib/admin-guard";
import { getCurrentActivity } from "@/lib/activity";
import { writeOperationLog } from "@/lib/auth";
import { prisma } from "@/lib/db";

const schema = z.object({
  rows: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(32),
        phone: z.string().trim().min(3).max(32),
        shareCode: z
          .string()
          .trim()
          .regex(/^[A-Za-z0-9_-]{1,32}$/, "分享码不合法"),
        teamName: z.string().trim().max(32).optional(),
        title: z.string().trim().max(32).optional(),
      }),
    )
    .min(1)
    .max(200),
});

/** E.2.5 批量导入：接受前台粘贴的 CSV/TSV，逐行校验后跳过重复分享码 */
export async function POST(request: Request) {
  const guard = await guardApi("consultants");
  if (guard.error) return guard.error;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message || "导入数据不正确" },
      { status: 400 },
    );
  }

  const activity = await getCurrentActivity();
  if (!activity) {
    return NextResponse.json({ message: "活动未配置" }, { status: 404 });
  }

  const existing = await prisma.consultant.findMany({
    where: { shareCode: { in: parsed.data.rows.map((row) => row.shareCode) } },
    select: { shareCode: true },
  });
  const taken = new Set(existing.map((item) => item.shareCode));
  const accepted = parsed.data.rows.filter((row) => !taken.has(row.shareCode));
  const skipped = parsed.data.rows.length - accepted.length;

  if (accepted.length) {
    await prisma.consultant.createMany({
      data: accepted.map((row) => ({
        activityId: activity.id,
        name: row.name,
        phone: row.phone,
        shareCode: row.shareCode,
        teamName: row.teamName || null,
        title: row.title || "置业顾问",
      })),
    });
  }

  await writeOperationLog(
    guard.session.sub,
    "consultant.import",
    `新增 ${accepted.length}，跳过 ${skipped}`,
  );

  return NextResponse.json({ ok: true, created: accepted.length, skipped });
}
