import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApi } from "@/lib/admin-guard";
import { writeOperationLog } from "@/lib/auth";
import { prisma } from "@/lib/db";

const schema = z.object({
  remark: z.string().trim().max(500).optional().nullable(),
  tier: z.enum(["A", "B", "C"]).optional(),
  consultantId: z.string().trim().min(1).optional().nullable(),
});

/** E.2.8 / A.1：线索备注、分层调整、人工改绑（写操作日志） */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await guardApi("leads");
  if (guard.error) return guard.error;

  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message || "参数不正确" },
      { status: 400 },
    );
  }

  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) {
    return NextResponse.json({ message: "线索不存在" }, { status: 404 });
  }

  let consultantName = "";
  if (parsed.data.consultantId) {
    const consultant = await prisma.consultant.findFirst({
      where: { id: parsed.data.consultantId, activityId: lead.activityId },
    });
    if (!consultant) {
      return NextResponse.json({ message: "顾问不存在" }, { status: 400 });
    }
    consultantName = consultant.name;
  }

  await prisma.$transaction(async (tx) => {
    await tx.lead.update({
      where: { id },
      data: {
        remark: parsed.data.remark === undefined ? undefined : parsed.data.remark,
        tier: parsed.data.tier,
        consultantId:
          parsed.data.consultantId === undefined
            ? undefined
            : parsed.data.consultantId,
      },
    });

    // 人工改绑时同步客户归属，保证后续裂变穿透与业绩口径一致
    if (parsed.data.consultantId !== undefined) {
      await tx.customer.update({
        where: { id: lead.customerId },
        data: { consultantId: parsed.data.consultantId },
      });
    }
  });

  await writeOperationLog(
    guard.session.sub,
    "lead.update",
    [
      lead.name,
      parsed.data.tier ? `tier=${parsed.data.tier}` : "",
      consultantName ? `改绑=${consultantName}` : "",
      parsed.data.remark !== undefined ? "备注" : "",
    ]
      .filter(Boolean)
      .join(" "),
  );

  return NextResponse.json({ ok: true });
}
