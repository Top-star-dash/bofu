export const instant = false;

import { redirect } from "next/navigation";
import AdminShell, { firstAllowedHref } from "@/components/admin/AdminShell";
import AssetManager, { type AssetRow } from "@/components/admin/AssetManager";
import { canUse } from "@/lib/admin-guard";
import { getCurrentActivity } from "@/lib/activity";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizeMediaUrl } from "@/lib/urls";

export default async function AdminAssetsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!canUse(session, "assets")) {
    redirect(firstAllowedHref(session) || "/admin/login");
  }

  const activity = await getCurrentActivity();
  const assets = activity
    ? await prisma.activityAsset.findMany({
        where: { activityId: activity.id, type: { in: ["property", "highlight"] } },
        orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
      })
    : [];

  const rows: AssetRow[] = assets.map((asset) => ({
    key: asset.id,
    id: asset.id,
    type: asset.type === "highlight" ? "highlight" : "property",
    title: asset.title ?? "",
    subtitle: asset.subtitle ?? "",
    imageUrl: normalizeMediaUrl(asset.imageUrl) ?? "",
    linkUrl: asset.linkUrl ?? "",
    sortOrder: asset.sortOrder,
    enabled: asset.enabled,
  }));

  return (
    <AdminShell session={session} current="/admin/assets">
      <h2 style={{ marginTop: 0 }}>素材管理</h2>
      <p className="redeem-hint">
        楼盘社区用于「城芯生活」区块，项目亮点用于「为什么选择福美城」区块；图片支持直接上传（≤5MB）。
      </p>
      <AssetManager initial={rows} />
    </AdminShell>
  );
}
