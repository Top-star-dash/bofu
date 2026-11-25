import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentActivity } from "@/lib/activity";
import { getCustomerSession } from "@/lib/customer-session";
import { prisma } from "@/lib/db";
import { computeLeadTier } from "@/lib/lead-tier";

const schema = z.object({
  name: z.string().min(1).max(32),
  phone: z.string().regex(/^1\d{10}$/, "手机号格式不正确"),
  intentLayout: z.string().optional(),
  intentArea: z.string().optional(),
  focusFactors: z.string().optional(),
  visitDate: z.string().optional(),
});

export async function POST(request: Request) {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json(
      { message: "请先完成微信授权", code: "NEED_AUTH" },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message || "参数不正确" },
      { status: 400 },
    );
  }

  const activity = await getCurrentActivity();
  if (!activity || activity.id !== session.activityId) {
    return NextResponse.json({ message: "活动不存在" }, { status: 404 });
  }

  const customer = await prisma.customer.findUnique({
    where: { id: session.customerId },
    include: { lead: true },
  });
  if (!customer) {
    return NextResponse.json({ message: "客户不存在" }, { status: 404 });
  }

  const result = await prisma.$transaction(async (tx) => {
    let lead = customer.lead;
    if (!lead) {
      lead = await tx.lead.create({
        data: {
          activityId: activity.id,
          customerId: customer.id,
          consultantId: customer.consultantId,
          name: parsed.data.name,
          phone: parsed.data.phone,
          intentLayout: parsed.data.intentLayout,
          intentArea: parsed.data.intentArea,
          focusFactors: parsed.data.focusFactors,
          visitDate: parsed.data.visitDate
            ? new Date(parsed.data.visitDate)
            : null,
          tier: computeLeadTier(customer.propertyStaySec, activity),
        },
      });

      await tx.customer.update({
        where: { id: customer.id },
        data: {
          drawChance: { increment: activity.firstDrawChance },
          lastActiveAt: new Date(),
        },
      });

      if (customer.inviterId) {
        const inviter = await tx.customer.findUnique({
          where: { id: customer.inviterId },
        });
        if (inviter && inviter.id !== customer.id) {
          const existingAssist = await tx.assistRecord.findUnique({
            where: {
              inviterId_inviteeId: {
                inviterId: inviter.id,
                inviteeId: customer.id,
              },
            },
          });

          if (!existingAssist && inviter.assistGained < activity.assistMaxExtra) {
            await tx.assistRecord.create({
              data: {
                inviterId: inviter.id,
                inviteeId: customer.id,
                valid: true,
              },
            });
            await tx.customer.update({
              where: { id: inviter.id },
              data: {
                assistGained: { increment: 1 },
                drawChance: { increment: activity.assistChance },
              },
            });
          }
        }
      }
    } else {
      lead = await tx.lead.update({
        where: { id: lead.id },
        data: {
          name: parsed.data.name,
          phone: parsed.data.phone,
          intentLayout: parsed.data.intentLayout,
          intentArea: parsed.data.intentArea,
          focusFactors: parsed.data.focusFactors,
          visitDate: parsed.data.visitDate
            ? new Date(parsed.data.visitDate)
            : null,
        },
      });
    }

    const updatedCustomer = await tx.customer.findUniqueOrThrow({
      where: { id: customer.id },
    });

    return { lead, customer: updatedCustomer };
  });

  return NextResponse.json({
    ok: true,
    drawChance: result.customer.drawChance,
    hasLead: true,
  });
}
