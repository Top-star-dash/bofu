import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApi } from "@/lib/admin-guard";
import { getCurrentActivity } from "@/lib/activity";
import { writeOperationLog } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { safeHttpUrl, safeMediaUrl } from "@/lib/urls";

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .nullable()
  .transform((value) => (value === undefined ? undefined : safeHttpUrl(value)));

const optionalMedia = z
  .string()
  .trim()
  .max(500)
  .optional()
  .nullable()
  .transform((value) => (value === undefined ? undefined : safeMediaUrl(value)));

const dateField = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "时间格式不正确")
  .transform((value) => new Date(value));

const schema = z.object({
  title: z.string().trim().min(1).max(2000).optional(),
  subtitle: z.string().trim().max(2000).optional().nullable(),
  status: z.enum(["DRAFT", "NOT_STARTED", "RUNNING", "ENDED"]).optional(),
  startAt: dateField.optional(),
  endAt: dateField.optional(),
  redeemDeadline: dateField.optional(),
  redeemPassword: z.string().trim().min(1).max(32).optional(),
  phone: z.string().trim().max(32).optional(),
  address: z.string().trim().max(200).optional(),
  mapUrl: optionalUrl,
  mapLinks: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(20),
        url: z.string().trim().min(1).max(500),
      }),
    )
    .max(5)
    .optional()
    .transform((list) => {
      if (list === undefined) return undefined;
      const cleaned: Array<{ name: string; url: string }> = [];
      for (const item of list) {
        const url = safeHttpUrl(item.url);
        if (!url) continue;
        cleaned.push({ name: item.name, url });
        if (cleaned.length >= 5) break;
      }
      return cleaned;
    }),
  externalUrl: optionalUrl,
  shareTitle: z.string().trim().max(200).optional().nullable(),
  shareDesc: z.string().trim().max(300).optional().nullable(),
  shareCoverUrl: optionalMedia,
  posterUrl: optionalMedia,
  backgroundUrl: optionalMedia,
  wheelImageUrl: optionalMedia,
  logoUrl: optionalMedia,
  logoSubUrl: optionalMedia,
  rulesHtml: z.string().max(20000).optional().nullable(),
  rulesColor: z.string().trim().max(32).optional().nullable(),
  firstDrawChance: z.number().int().min(0).max(99).optional(),
  assistChance: z.number().int().min(0).max(99).optional(),
  assistMaxExtra: z.number().int().min(0).max(999).optional(),
  dailyDrawLimit: z.number().int().min(0).max(999).optional(),
  totalDrawLimit: z.number().int().min(0).max(9999).optional(),
  tierAStaySec: z.number().int().min(0).max(86_400).optional(),
  tierBStaySec: z.number().int().min(0).max(86_400).optional(),
  id: z.string().optional(),
});

export async function PATCH(request: Request) {
  const guard = await guardApi("activity");
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

  const { id, ...data } = parsed.data;
  const targetId = id || activity.id;

  if (data.startAt && data.endAt && data.startAt >= data.endAt) {
    return NextResponse.json(
      { message: "结束时间必须晚于开始时间" },
      { status: 400 },
    );
  }
  if (
    data.tierAStaySec !== undefined &&
    data.tierBStaySec !== undefined &&
    data.tierAStaySec < data.tierBStaySec
  ) {
    return NextResponse.json(
      { message: "A 类停留阈值不能小于 B 类" },
      { status: 400 },
    );
  }

  const updated = await prisma.activity.update({
    where: { id: targetId },
    data,
  });

  const changed = Object.keys(data);
  await writeOperationLog(
    guard.session.sub,
    "activity.update",
    changed.length ? `更新 ${changed.length} 项：${changed.join(",")}` : "无字段变更",
  );

  return NextResponse.json({ ok: true, activity: { id: updated.id } });
}
