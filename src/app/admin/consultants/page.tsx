export const instant = false;

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AdminShell, { firstAllowedHref } from "@/components/admin/AdminShell";
import ConsultantManager from "@/components/admin/ConsultantManager";
import { canUse } from "@/lib/admin-guard";
import { getCurrentActivity } from "@/lib/activity";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function AdminConsultantsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!canUse(session, "consultants")) {
    redirect(firstAllowedHref(session) || "/admin/login");
  }

  const activity = await getCurrentActivity();
  const consultants = activity
    ? await prisma.consultant.findMany({
        where: { activityId: activity.id },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      })
    : [];

  const headerList = await headers();
  const host =
    headerList.get("x-forwarded-host") || headerList.get("host") || "";
  const proto = headerList.get("x-forwarded-proto") || "https";
  const origin = host ? `${proto}://${host.split(",")[0].trim()}` : "";

  return (
    <AdminShell session={session} current="/admin/consultants">
      <h2 style={{ marginTop: 0 }}>顾问管理</h2>
      <ConsultantManager
        origin={origin}
        initial={consultants.map((item) => ({
          id: item.id,
          name: item.name,
          phone: item.phone,
          employeeNo: item.employeeNo ?? "",
          teamName: item.teamName ?? "",
          title: item.title,
          avatarUrl: item.avatarUrl ?? "",
          qrcodeUrl: item.qrcodeUrl ?? "",
          intro: item.intro ?? "",
          message: item.message ?? "",
          openid: item.openid ?? "",
          shareCode: item.shareCode,
          isDefault: item.isDefault,
          enabled: item.enabled,
        }))}
      />
    </AdminShell>
  );
}
