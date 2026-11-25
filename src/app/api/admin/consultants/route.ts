import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApi } from "@/lib/admin-guard";
import { getCurrentActivity } from "@/lib/activity";
import { writeOperationLog } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { safeMediaUrl } from "@/lib/urls";

const media = z
  .string()
  .trim()
  .max(500)
  .optional()
  .nullable()
  .transform((value) => (value ? safeMediaUrl(value) : null));

const consultantInput = z.object({
  name: z.string().trim().min(1).max(32),
  phone: z.string().trim().min(3).max(32),
  employeeNo: z.string().trim().max(32).optional().nullable(),
  teamName: z.string().trim().max(32).optional().nullable(),
  title: z.string().trim().max(32).default("置业顾问"),
  avatarUrl: media,
  qrcodeUrl: media,
  intro: z.string().trim().max(500).optional().nullable(),
  message: z.string().trim().max(500).optional().nullable(),
  openid: z.string().trim().max(64).optional().nullable(),
  shareCode: z
    .string()
    .trim()
    .min(1)
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/, "分享码只能包含字母、数字、下划线和中划线"),
  isDefault: z.boolean().default(false),
  enabled: z.boolean().default(true),
});

function randomCode() {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

export async function POST(request: Request) {
  const guard = await guardApi("consultants");
  if (guard.error) return guard.error;

  const body = await request.json().catch(() => ({}));
  const payload = {
    ...body,
    shareCode: body?.shareCode || randomCode(),
  };
  const parsed = consultantInput.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message || "顾问信息不正确" },
      { status: 400 },
    );
  }

  const activity = await getCurrentActivity();
  if (!activity) {
    return NextResponse.json({ message: "活动未配置" }, { status: 404 });
  }

  const exists = await prisma.consultant.findUnique({
    where: { shareCode: parsed.data.shareCode },
  });
  if (exists) {
    return NextResponse.json({ message: "分享码已被占用" }, { status: 409 });
  }

  const created = await prisma.$transaction(async (tx) => {
    if (parsed.data.isDefault) {
      await tx.consultant.updateMany({
        where: { activityId: activity.id },
        data: { isDefault: false },
      });
    }
    return tx.consultant.create({
      data: { ...parsed.data, activityId: activity.id },
    });
  });

  await writeOperationLog(
    guard.session.sub,
    "consultant.create",
    `${created.name}/${created.shareCode}`,
  );
  return NextResponse.json({ ok: true, id: created.id });
}

const patchSchema = consultantInput.partial().extend({ id: z.string().min(1) });

export async function PATCH(request: Request) {
  const guard = await guardApi("consultants");
  if (guard.error) return guard.error;

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message || "顾问信息不正确" },
      { status: 400 },
    );
  }

  const { id, ...data } = parsed.data;
  const current = await prisma.consultant.findUnique({ where: { id } });
  if (!current) {
    return NextResponse.json({ message: "顾问不存在" }, { status: 404 });
  }

  if (data.shareCode && data.shareCode !== current.shareCode) {
    const exists = await prisma.consultant.findUnique({
      where: { shareCode: data.shareCode },
    });
    if (exists) {
      return NextResponse.json({ message: "分享码已被占用" }, { status: 409 });
    }
  }

  await prisma.$transaction(async (tx) => {
    if (data.isDefault) {
      await tx.consultant.updateMany({
        where: { activityId: current.activityId, id: { not: id } },
        data: { isDefault: false },
      });
    }
    await tx.consultant.update({ where: { id }, data });
  });

  await writeOperationLog(guard.session.sub, "consultant.update", id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const guard = await guardApi("consultants");
  if (guard.error) return guard.error;

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ message: "缺少顾问 id" }, { status: 400 });
  }

  const consultant = await prisma.consultant.findUnique({
    where: { id },
    include: { _count: { select: { customers: true, leads: true } } },
  });
  if (!consultant) {
    return NextResponse.json({ message: "顾问不存在" }, { status: 404 });
  }
  if (consultant._count.customers || consultant._count.leads) {
    return NextResponse.json(
      { message: "该顾问已有客户或线索，不能删除，请改为停用" },
      { status: 409 },
    );
  }

  await prisma.consultant.delete({ where: { id } });
  await writeOperationLog(guard.session.sub, "consultant.delete", id);
  return NextResponse.json({ ok: true });
}
