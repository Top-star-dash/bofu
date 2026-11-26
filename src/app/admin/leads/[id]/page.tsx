export const instant = false;

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import LeadDetailTabs, {
  type InfoItem,
  type LogRow,
  type SummaryItem,
  type TimelineRow,
} from "@/components/admin/LeadDetailTabs";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";

type Params = Promise<{ id: string }>;

type TimelineItem = {
  at: Date;
  title: string;
  detail?: string;
};

export default async function AdminLeadDetailPage({
  params,
}: {
  params: Params;
}) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!hasPermission(session.permissions, "leads", session.isSuperAdmin)) {
    redirect("/admin");
  }

  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      consultant: true,
      customer: {
        include: {
          consultant: true,
          drawRecords: { orderBy: { createdAt: "desc" } },
          browseEvents: { orderBy: { createdAt: "desc" }, take: 200 },
          assistsReceived: { orderBy: { createdAt: "desc" } },
          assistsGiven: { orderBy: { createdAt: "desc" } },
          inviter: { select: { nickname: true } },
          _count: { select: { invitees: true } },
        },
      },
    },
  });

  if (!lead) notFound();

  const [consultants, operationLogs] = await Promise.all([
    prisma.consultant.findMany({
      where: { activityId: lead.activityId, enabled: true },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.operationLog.findMany({
      where: { detail: { contains: lead.name } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const customer = lead.customer;

  // E.2.8 轨迹时间轴：进入 → 留资 → 抽奖 → 核销 → 助力 → 浏览
  const timeline: TimelineItem[] = [
    { at: customer.firstEnterAt, title: "首次进入活动页" },
    { at: lead.createdAt, title: "提交留资", detail: `${lead.name} ${lead.phone}` },
  ];
  for (const record of customer.drawRecords) {
    timeline.push({
      at: record.createdAt,
      title: record.isWin ? `抽中「${record.prizeName}」` : `抽奖：${record.prizeName}`,
      detail: record.isWin ? `兑奖码 ${record.redeemCode}` : undefined,
    });
    if (record.redeemedAt) {
      timeline.push({
        at: record.redeemedAt,
        title: `核销「${record.prizeName}」`,
      });
    }
  }
  for (const assist of customer.assistsGiven) {
    timeline.push({ at: assist.createdAt, title: "被好友邀请加次（本客户作为被邀请人）" });
  }
  for (const assist of customer.assistsReceived) {
    timeline.push({ at: assist.createdAt, title: "邀请好友留资，获得一次助力" });
  }
  for (const event of customer.browseEvents) {
    timeline.push({
      at: event.createdAt,
      title: `浏览 ${event.section}`,
      detail: `停留 ${event.staySec} 秒`,
    });
  }
  timeline.sort((a, b) => b.at.getTime() - a.at.getTime());

  const timelineRows: TimelineRow[] = timeline.map((item) => ({
    at: item.at.toLocaleString("zh-CN"),
    title: item.title,
    detail: item.detail || "",
  }));

  const logRows: LogRow[] = operationLogs.map((log) => ({
    at: log.createdAt.toLocaleString("zh-CN"),
    action: log.action,
    detail: log.detail || "",
  }));

  const summary: SummaryItem[] = [
    { label: "姓名", value: lead.name },
    {
      label: "手机号",
      value: lead.phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2"),
    },
    { label: "当前分层", value: `${lead.tier} 类` },
    { label: "归属顾问", value: lead.consultant?.name || "未归属" },
    { label: "抽奖次数", value: String(customer.drawRecords.length) },
    { label: "邀请好友", value: String(customer._count.invitees) },
  ];

  const wechatInfo: InfoItem[] = [
    { label: "昵称", value: customer.nickname || "未授权资料" },
    { label: "OpenID", value: customer.openid },
    { label: "UnionID", value: customer.unionid || "-" },
    { label: "邀请人", value: customer.inviter?.nickname || "无（自然访问）" },
  ];

  const profileInfo: InfoItem[] = [
    { label: "意向户型", value: lead.intentLayout || "-" },
    { label: "意向面积", value: lead.intentArea || "-" },
    { label: "关注点", value: lead.focusFactors || "-" },
    {
      label: "预计到访",
      value: lead.visitDate ? lead.visitDate.toLocaleDateString("zh-CN") : "-",
    },
    { label: "留资时间", value: lead.createdAt.toLocaleString("zh-CN") },
    { label: "楼盘停留", value: `${customer.propertyStaySec} 秒` },
  ];

  return (
    <AdminShell session={session} current="/admin/leads">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 style={{ marginTop: 0 }}>线索详情</h2>
        <Link className="admin-btn secondary" href="/admin/leads">
          返回线索列表
        </Link>
      </div>

      <LeadDetailTabs
        summary={summary}
        avatarUrl={customer.avatarUrl || ""}
        wechat={wechatInfo}
        profile={profileInfo}
        leadId={lead.id}
        remark={lead.remark || ""}
        tier={lead.tier}
        consultantId={lead.consultantId || ""}
        consultants={consultants}
        timeline={timelineRows}
        logs={logRows}
      />
    </AdminShell>
  );
}
