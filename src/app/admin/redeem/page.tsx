export const instant = false;

import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import RedeemConsole from "@/components/admin/RedeemConsole";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { buildRedeemAdminPath, parseRedeemCodeInput } from "@/lib/redeem-code";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function maskPhone(phone: string | null | undefined) {
  if (!phone) return "-";
  return phone.replace(/^(\d{3})\d{4}(\d{4})$/, "$1****$2");
}

function pick(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return typeof value === "string" ? value.trim() : "";
}

export default async function AdminRedeemPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const rawCode = pick(params, "code");
  const initialCode = parseRedeemCodeInput(rawCode) || "";
  const loginNext = initialCode
    ? buildRedeemAdminPath(initialCode)
    : "/admin/redeem";

  const session = await getAdminSession();
  if (!session) {
    redirect(`/admin/login?next=${encodeURIComponent(loginNext)}`);
  }
  if (!hasPermission(session.permissions, "redeem", session.isSuperAdmin)) {
    redirect("/admin");
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [todayCount, pendingCount, redeemedCount, expiredCount, records] =
    await Promise.all([
      prisma.drawRecord.count({
        where: { redeemStatus: "REDEEMED", redeemedAt: { gte: startOfDay } },
      }),
      prisma.drawRecord.count({
        where: { redeemStatus: "PENDING", isWin: true },
      }),
      prisma.drawRecord.count({ where: { redeemStatus: "REDEEMED" } }),
      prisma.drawRecord.count({ where: { redeemStatus: "EXPIRED" } }),
      prisma.drawRecord.findMany({
        where: { redeemStatus: "REDEEMED" },
        orderBy: { redeemedAt: "desc" },
        take: 20,
        include: { customer: { include: { lead: true } } },
      }),
    ]);

  return (
    <AdminShell session={session} current="/admin/redeem">
      <h2 style={{ marginTop: 0 }}>核销台</h2>

      <div className="admin-grid">
        <article>
          <span>今日核销</span>
          <strong>{todayCount}</strong>
        </article>
        <article>
          <span>待核销</span>
          <strong>{pendingCount}</strong>
        </article>
        <article>
          <span>累计核销</span>
          <strong>{redeemedCount}</strong>
        </article>
        <article>
          <span>已过期</span>
          <strong>{expiredCount}</strong>
        </article>
      </div>

      <RedeemConsole initialCode={initialCode} />

      <section className="admin-card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>最近核销记录</h3>
        <table className="admin-table">
          <thead>
            <tr>
              <th>奖品</th>
              <th>中奖人</th>
              <th>手机号</th>
              <th>核销时间</th>
              <th>核销人</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id}>
                <td>
                  {record.prizeLevel} · {record.prizeName}
                </td>
                <td>
                  {record.customer.lead?.name || record.customer.nickname || "-"}
                </td>
                <td>{maskPhone(record.customer.lead?.phone)}</td>
                <td>{record.redeemedAt?.toLocaleString("zh-CN") || "-"}</td>
                <td>{record.redeemedBy || "-"}</td>
              </tr>
            ))}
            {!records.length && (
              <tr>
                <td colSpan={5}>暂无核销记录</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </AdminShell>
  );
}
