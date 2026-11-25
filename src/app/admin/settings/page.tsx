export const instant = false;

import { redirect } from "next/navigation";
import ActivitySettings from "@/components/admin/ActivitySettings";
import AdminShell, { firstAllowedHref } from "@/components/admin/AdminShell";
import { canUse } from "@/lib/admin-guard";
import { getCurrentActivity } from "@/lib/activity";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function AdminSettingsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!canUse(session, "activity")) {
    redirect(firstAllowedHref(session) || "/admin/login");
  }

  const activity = await getCurrentActivity();
  // 后台要看到停用的公告
  const notices = activity
    ? await prisma.activityNotice.findMany({
        where: { activityId: activity.id },
        orderBy: { sortOrder: "asc" },
      })
    : [];

  return (
    <AdminShell session={session} current="/admin/settings">
      <h2 style={{ marginTop: 0 }}>活动配置</h2>
      {activity ? (
        <>
          <div className="admin-card">
            <ActivitySettings
              initial={{
                id: activity.id,
                title: activity.title,
                subtitle: activity.subtitle ?? "",
                status: activity.status,
                startAt: activity.startAt.toISOString(),
                endAt: activity.endAt.toISOString(),
                redeemDeadline: activity.redeemDeadline.toISOString(),
                phone: activity.phone,
                address: activity.address,
                mapUrl: activity.mapUrl ?? "",
                externalUrl: activity.externalUrl ?? "",
                shareTitle: activity.shareTitle ?? "",
                shareDesc: activity.shareDesc ?? "",
                shareCoverUrl: activity.shareCoverUrl ?? "",
                posterUrl: activity.posterUrl ?? "",
                backgroundUrl: activity.backgroundUrl ?? "",
                wheelImageUrl: activity.wheelImageUrl ?? "",
                logoUrl: activity.logoUrl ?? "",
                logoSubUrl: activity.logoSubUrl ?? "",
                rulesHtml: activity.rulesHtml ?? "",
                rulesColor: activity.rulesColor ?? "",
                redeemPassword: activity.redeemPassword,
                firstDrawChance: activity.firstDrawChance,
                assistChance: activity.assistChance,
                assistMaxExtra: activity.assistMaxExtra,
                dailyDrawLimit: activity.dailyDrawLimit,
                totalDrawLimit: activity.totalDrawLimit,
                tierAStaySec: activity.tierAStaySec,
                tierBStaySec: activity.tierBStaySec,
              }}
              notices={notices.map((notice) => ({
                id: notice.id,
                content: notice.content,
                sortOrder: notice.sortOrder,
                enabled: notice.enabled,
              }))}
            />
          </div>
        </>
      ) : (
        <div className="admin-card">
          <p>尚未配置活动，请先执行 seed 初始化。</p>
        </div>
      )}
    </AdminShell>
  );
}
