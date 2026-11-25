export const instant = false;

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import LeadDetail from "@/components/admin/LeadDetail";
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
          browseEvents: { orderBy: { createdAt: "desc" }, take: 50 },
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

  return (
    <AdminShell session={session} current="/admin/leads">
      <h2 style={{ marginTop: 0 }}>线索详情</h2>
      <p>
        <Link className="admin-btn secondary" href="/admin/leads">
          返回线索列表
        </Link>
      </p>

      <div className="admin-grid">
        <article>
          <span>姓名</span>
          <strong>{lead.name}</strong>
        </article>
        <article>
          <span>手机号</span>
          <strong>{lead.phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2")}</strong>
        </article>
        <article>
          <span>当前分层</span>
          <strong>{lead.tier}</strong>
        </article>
        <article>
          <span>归属顾问</span>
          <strong>{lead.consultant?.name || "未归属"}</strong>
        </article>
        <article>
          <span>抽奖次数</span>
          <strong>{customer.drawRecords.length}</strong>
        </article>
        <article>
          <span>邀请好友</span>
          <strong>{customer._count.invitees}</strong>
        </article>
      </div>

      <div className="admin-card">
        <h3 style={{ marginTop: 0 }}>微信用户</h3>
        <div className="flex flex-wrap items-start gap-4">
          {customer.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={customer.avatarUrl}
              alt={customer.nickname || "微信头像"}
              className="h-16 w-16 rounded-full border border-[#f0e2d2] object-cover"
            />
          ) : (
            <div className="grid h-16 w-16 place-items-center rounded-full bg-[#fff2df] text-[12px] text-[#9b7d64]">
              无头像
            </div>
          )}
          <p style={{ margin: 0 }}>
            昵称：{customer.nickname || "未授权资料"}
            <br />
            OpenID：{customer.openid}
            <br />
            UnionID：{customer.unionid || "-"}
            <br />
            邀请人：{customer.inviter?.nickname || "无（自然访问）"}
          </p>
        </div>
      </div>

      <div className="admin-card">
        <h3 style={{ marginTop: 0 }}>留资信息</h3>
        <p>
          意向户型：{lead.intentLayout || "-"}
          <br />
          意向面积：{lead.intentArea || "-"}
          <br />
          关注点：{lead.focusFactors || "-"}
          <br />
          预计到访：
          {lead.visitDate ? lead.visitDate.toLocaleDateString("zh-CN") : "-"}
          <br />
          留资时间：{lead.createdAt.toLocaleString("zh-CN")}
          <br />
          楼盘停留：{customer.propertyStaySec} 秒
        </p>
      </div>

      <div className="admin-card">
        <h3 style={{ marginTop: 0 }}>备注 / 分层 / 改绑</h3>
        <LeadDetail
          leadId={lead.id}
          remark={lead.remark || ""}
          tier={lead.tier}
          consultantId={lead.consultantId || ""}
          consultants={consultants}
        />
      </div>

      <div className="admin-card">
        <h3 style={{ marginTop: 0 }}>行为轨迹</h3>
        <table className="admin-table">
          <thead>
            <tr>
              <th>时间</th>
              <th>事件</th>
              <th>说明</th>
            </tr>
          </thead>
          <tbody>
            {timeline.map((item, index) => (
              <tr key={`${item.at.toISOString()}-${index}`}>
                <td>{item.at.toLocaleString("zh-CN")}</td>
                <td>{item.title}</td>
                <td>{item.detail || "-"}</td>
              </tr>
            ))}
            {!timeline.length && (
              <tr>
                <td colSpan={3}>暂无轨迹</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="admin-card">
        <h3 style={{ marginTop: 0 }}>改绑/备注操作日志</h3>
        <table className="admin-table">
          <thead>
            <tr>
              <th>时间</th>
              <th>操作</th>
              <th>说明</th>
            </tr>
          </thead>
          <tbody>
            {operationLogs.map((log) => (
              <tr key={log.id}>
                <td>{log.createdAt.toLocaleString("zh-CN")}</td>
                <td>{log.action}</td>
                <td>{log.detail || "-"}</td>
              </tr>
            ))}
            {!operationLogs.length && (
              <tr>
                <td colSpan={3}>暂无操作记录</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
