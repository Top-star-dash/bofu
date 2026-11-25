import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApi } from "@/lib/admin-guard";
import { getCurrentActivity } from "@/lib/activity";
import { writeOperationLog } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { safeHttpUrl, safeMediaUrl } from "@/lib/urls";

const assetInput = z.object({
  id: z.string().optional(),
  type: z.enum(["property", "highlight"]),
  title: z.string().trim().max(64).optional().nullable(),
  subtitle: z.string().trim().max(200).optional().nullable(),
  imageUrl: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .refine((value) => safeMediaUrl(value) !== null, "图片地址不合法")
    .transform((value) => safeMediaUrl(value) as string),
  linkUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .transform((value) => (value ? safeHttpUrl(value) : null)),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  enabled: z.boolean().default(true),
});

const saveSchema = z.object({
  assets: z.array(assetInput).min(1).max(60),
});

export async function PATCH(request: Request) {
  const guard = await guardApi("assets");
  if (guard.error) return guard.error;

  const parsed = saveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message || "素材参数不正确" },
      { status: 400 },
    );
  }

  const activity = await getCurrentActivity();
  if (!activity) {
    return NextResponse.json({ message: "活动未配置" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    for (const asset of parsed.data.assets) {
      const { id, ...data } = asset;
      if (id) {
        await tx.activityAsset.update({ where: { id }, data });
      } else {
        await tx.activityAsset.create({
          data: { ...data, activityId: activity.id },
        });
      }
    }
  });

  await writeOperationLog(
    guard.session.sub,
    "asset.save",
    `${parsed.data.assets.length} 项`,
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const guard = await guardApi("assets");
  if (guard.error) return guard.error;

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ message: "缺少素材 id" }, { status: 400 });
  }

  await prisma.activityAsset.delete({ where: { id } });
  await writeOperationLog(guard.session.sub, "asset.delete", id);
  return NextResponse.json({ ok: true });
}
