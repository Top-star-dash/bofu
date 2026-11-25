export const instant = false;

import Link from "next/link";
import { redirect } from "next/navigation";
import AdminShell, { firstAllowedHref } from "@/components/admin/AdminShell";
import { canUse } from "@/lib/admin-guard";
import { getCurrentActivity } from "@/lib/activity";
import { getAdminSession } from "@/lib/auth";
import { getStatsSummary, getStockWarnings, parseRange } from "@/lib/stats";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pick(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return typeof value === "string" ? value.trim() : "";
}

export default async function AdminStatsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  if (!canUse(session, "stats")) {
    const target = firstAllowedHref(session);
    if (target) redirect(target);
    return (
      <AdminShell session={session} current="/admin/stats">
        <h2 style={{ marginTop: 0 }}>暂无访问权限</h2>
        <p>当前账号未分配数据统计权限，请联系超级管理员。</p>
      </AdminShell>
    );
  }

  const params = await searchParams;
  const from = pick(params, "from");
  const to = pick(params, "to");
  const range = parseRange(from, to);

  const activity = await getCurrentActivity();
  if (!activity) {
    return (
      <AdminShell session={session} current="/admin/stats">
        <h2 style={{ marginTop: 0 }}>数据统计</h2>
        <p>尚未配置活动。</p>
      </AdminShell>
    );
  }

  const [{ overview, rows }, warnings] = await Promise.all([
    getStatsSummary(activity.id, range),
    getStockWarnings(activity.id),
  ]);

  const ranked = [...rows].sort(
    (a, b) =>
      b.leads - a.leads || b.customers - a.customers || b.draws - a.draws,
  );

  const exportQuery = new URLSearchParams();
  if (from) exportQuery.set("from", from);
  if (to) exportQuery.set("to", to);
  const salesHref = `/api/admin/export/sales${
    exportQuery.toString() ? `?${exportQuery.toString()}` : ""
  }`;
  const prizeHref = `/api/admin/export/prizes${
    exportQuery.toString() ? `?${exportQuery.toString()}` : ""
  }`;

  return (
    <AdminShell session={session} current="/admin/stats">
      <h2 style={{ marginTop: 0 }}>数据统计</h2>

      <form className="admin-toolbar" method="get" action="/admin/stats">
        <label>
          起始日期
          <input type="date" name="from" defaultValue={from} />
        </label>
        <label>
          截止日期
          <input type="date" name="to" defaultValue={to} />
        </label>
        <button type="submit" className="admin-btn">
          统计
        </button>
        <Link className="admin-btn secondary" href="/admin/stats">
          重置
        </Link>
        <a className="admin-btn secondary" href={salesHref}>
          导出销售汇总 xlsx
        </a>
        <a className="admin-btn secondary" href={prizeHref}>
          导出兑奖明细 xlsx
        </a>
      </form>

      <div className="admin-grid">
        <article>
          <span>触达客户</span>
          <strong>{overview.customers}</strong>
        </article>
        <article>
          <span>留资</span>
          <strong>{overview.leads}</strong>
        </article>
        <article>
          <span>触达→留资</span>
          <strong>{overview.conversion}%</strong>
        </article>
        <article>
          <span>抽奖次数</span>
          <strong>{overview.draws}</strong>
        </article>
        <article>
          <span>中奖</span>
          <strong>{overview.winners}</strong>
        </article>
        <article>
          <span>已核销</span>
          <strong>{overview.redeemed}</strong>
        </article>
        <article>
          <span>助力成功</span>
          <strong>{overview.assists}</strong>
        </article>
        <article>
          <span>曝光总量</span>
          <strong>{activity.exposureCount}</strong>
        </article>
      </div>

      <div className="admin-card">
        <h3 style={{ marginTop: 0 }}>销售推广转化（按顾问）</h3>
        <table className="admin-table">
          <thead>
            <tr>
              <th>顾问</th>
              <th>团队</th>
              <th>分享码</th>
              <th>触达客户</th>
              <th>留资</th>
              <th>抽奖</th>
              <th>中奖</th>
              <th>核销</th>
              <th>留资率</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((row) => (
              <tr key={row.consultantId}>
                <td>{row.name}</td>
                <td>{row.teamName || "-"}</td>
                <td>{row.shareCode}</td>
                <td>{row.customers}</td>
                <td>{row.leads}</td>
                <td>{row.draws}</td>
                <td>{row.wins}</td>
                <td>{row.redeemed}</td>
                <td>
                  {row.customers
                    ? `${Math.round((row.leads / row.customers) * 1000) / 10}%`
                    : "-"}
                </td>
              </tr>
            ))}
            {!ranked.length && (
              <tr>
                <td colSpan={9}>区间内暂无数据</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="admin-card">
        <h3 style={{ marginTop: 0 }}>奖品库存预警</h3>
        <p className="redeem-hint" style={{ marginTop: 0 }}>
          剩余数量不足 20% 或已发完的奖品会列在这里。
        </p>
        <table className="admin-table">
          <thead>
            <tr>
              <th>奖品</th>
              <th>等级</th>
              <th>总量</th>
              <th>剩余</th>
              <th>剩余比例</th>
            </tr>
          </thead>
          <tbody>
            {warnings.map((prize) => (
              <tr key={prize.id}>
                <td>{prize.name}</td>
                <td>{prize.level}</td>
                <td>{prize.stock}</td>
                <td>{prize.remainStock}</td>
                <td>{Math.round(prize.ratio * 1000) / 10}%</td>
              </tr>
            ))}
            {!warnings.length && (
              <tr>
                <td colSpan={5}>库存充足</td>
              </tr>
            )}
          </tbody>
        </table>
        <p>
          <Link className="admin-btn secondary" href="/admin/prizes">
            去补充库存
          </Link>
        </p>
      </div>
    </AdminShell>
  );
}
