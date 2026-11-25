import { NextResponse } from "next/server";
import { z } from "zod";
import { getCustomerSession } from "@/lib/customer-session";
import { prisma } from "@/lib/db";

const schema = z.object({
  items: z
    .array(
      z.object({
        section: z.string().trim().min(1).max(32),
        staySec: z.number().int().min(0).max(86_400),
      }),
    )
    .max(12),
});

/** G.4 楼盘板块停留埋点：页面隐藏时批量上报 */
export async function POST(request: Request) {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ ok: false, message: "未授权" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "参数不正确" }, { status: 400 });
  }

  const items = parsed.data.items.filter((item) => item.staySec > 0);
  if (!items.length) return NextResponse.json({ ok: true });

  const propertyStay = items
    .filter((item) => item.section.startsWith("property"))
    .reduce((sum, item) => sum + item.staySec, 0);

  await prisma.$transaction([
    prisma.browseEvent.createMany({
      data: items.map((item) => ({
        customerId: session.customerId,
        section: item.section,
        staySec: item.staySec,
      })),
    }),
    ...(propertyStay > 0
      ? [
          prisma.customer.update({
            where: { id: session.customerId },
            data: { propertyStaySec: { increment: propertyStay } },
          }),
        ]
      : []),
  ]);

  return NextResponse.json({ ok: true });
}
