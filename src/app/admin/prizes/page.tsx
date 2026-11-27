export const instant = false;

import { redirect } from "next/navigation";
import AdminShell, { firstAllowedHref } from "@/components/admin/AdminShell";
import PrizeManager, { type PrizeRow } from "@/components/admin/PrizeManager";
import { canUse } from "@/lib/admin-guard";
import { getCurrentActivity } from "@/lib/activity";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizeMediaUrl } from "@/lib/urls";

export default async function AdminPrizesPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!canUse(session, "prizes")) {
    redirect(firstAllowedHref(session) || "/admin/login");
  }

  const activity = await getCurrentActivity();
  // 后台要看全部奖品（含停用），不能用 H5 那份只含 enabled 的列表
  const allPrizes = activity
    ? await prisma.prize.findMany({
        where: { activityId: activity.id },
        orderBy: { sortOrder: "asc" },
      })
    : [];

  const prizes: PrizeRow[] = allPrizes.map((prize) => ({
    key: prize.id,
    id: prize.id,
    level: prize.level,
    name: prize.name,
    imageUrl: normalizeMediaUrl(prize.imageUrl) ?? "",
    stock: prize.stock,
    remainStock: prize.remainStock,
    probability: Number(prize.probability.toString()),
    description: prize.description ?? "",
    sortOrder: prize.sortOrder,
    enabled: prize.enabled,
    isFallback: prize.isFallback,
  }));

  return (
    <AdminShell session={session} current="/admin/prizes">
      <h2 style={{ marginTop: 0 }}>奖品管理</h2>
      <PrizeManager
        initial={prizes}
        activityStatus={activity?.runtimeStatus ?? "DRAFT"}
      />
    </AdminShell>
  );
}
