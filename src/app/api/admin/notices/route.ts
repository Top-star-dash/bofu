import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApi } from "@/lib/admin-guard";
import { getCurrentActivity } from "@/lib/activity";
import { prisma } from "@/lib/db";
import { writeOperationLog } from "@/lib/auth";

async function resolveActivityId(input?: string) {
  if (input) return input;
  const activity = await getCurrentActivity();
  return activity?.id ?? null;
}

const base = z.object({
  activityId: z.string().optional(),
  content: z.string().trim().min(1).max(200),
  sortOrder: z.number().int().min(0).max(999).default(0),
  enabled: z.boolean().default(true),
});

export async function POST(request: Request) {
  const guard = await guardApi("activity");
  if (guard.error) return guard.error;

  const parsed = base.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: "公告内容不正确" }, { status: 400 });
  }

  const activityId = await resolveActivityId(parsed.data.activityId);
  if (!activityId) {
    return NextResponse.json({ message: "活动未配置" }, { status: 404 });
  }

  const notice = await prisma.activityNotice.create({
    data: {
      activityId,
      content: parsed.data.content,
      sortOrder: parsed.data.sortOrder,
      enabled: parsed.data.enabled,
    },
  });

  await writeOperationLog(guard.session.sub, "notice.create", notice.content);
  return NextResponse.json({ ok: true, id: notice.id });
}

const patchSchema = z.object({
  id: z.string().min(1),
  content: z.string().trim().min(1).max(200).optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
  enabled: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  const guard = await guardApi("activity");
  if (guard.error) return guard.error;

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: "参数不正确" }, { status: 400 });
  }

  const { id, ...data } = parsed.data;
  const notice = await prisma.activityNotice.update({ where: { id }, data });
  await writeOperationLog(guard.session.sub, "notice.update", notice.content);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const guard = await guardApi("activity");
  if (guard.error) return guard.error;

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ message: "缺少公告 id" }, { status: 400 });
  }

  await prisma.activityNotice.delete({ where: { id } });
  await writeOperationLog(guard.session.sub, "notice.delete", id);
  return NextResponse.json({ ok: true });
}
