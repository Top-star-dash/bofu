import { connection } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** H5 奖品余量轻量刷新：只返回 id / stock / remainStock */
export async function GET() {
  await connection();

  const activity = await prisma.activity.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!activity) {
    return NextResponse.json({ message: "活动不存在" }, { status: 404 });
  }

  const prizes = await prisma.prize.findMany({
    where: {
      activityId: activity.id,
      enabled: true,
      isFallback: false,
    },
    select: {
      id: true,
      stock: true,
      remainStock: true,
    },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(
    { prizes },
    { headers: { "Cache-Control": "no-store" } },
  );
}
