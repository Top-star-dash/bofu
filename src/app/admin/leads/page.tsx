export const instant = false;

import Link from "next/link";
import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildLeadWhere, LEAD_TIERS } from "@/lib/lead-query";
import { hasPermission } from "@/lib/permissions";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const PAGE_SIZE = 20;

function pick(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return typeof value === "string" ? value.trim() : "";
}

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!hasPermission(session.permissions, "leads", session.isSuperAdmin)) {
    redirect("/admin");
  }

  const params = await searchParams;
  const q = pick(params, "q");
  const tier = pick(params, "tier");
  const consultantId = pick(params, "consultant");
  const from = pick(params, "from");
  const to = pick(params, "to");
  const pageParam = Number.parseInt(pick(params, "page") || "1", 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const where = buildLeadWhere({ q, tier, consultantId, from, to });

  const [total, leads, consultants] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { consultant: true, customer: true },
    }),
    prisma.consultant.findMany({
      where: { enabled: true },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const base = new URLSearchParams();
  if (q) base.set("q", q);
  if (tier) base.set("tier", tier);
  if (consultantId) base.set("consultant", consultantId);
  if (from) base.set("from", from);
  if (to) base.set("to", to);

  const pageHref = (target: number) => {
    const query = new URLSearchParams(base);
    query.set("page", String(target));
    return `/admin/leads?${query.toString()}`;
  };
  const exportHref = `/api/admin/leads/export${
    base.toString() ? `?${base.toString()}` : ""
  }`;

  return (
    <AdminShell session={session} current="/admin/leads">
      <h2 style={{ marginTop: 0 }}>线索管理</h2>

      <form className="admin-toolbar" method="get" action="/admin/leads">
        <label>
          关键词
          <input
            name="q"
            defaultValue={q}
            placeholder="姓名 / 手机 / 微信昵称"
          />
        </label>
        <label>
          线索分层
          <select name="tier" defaultValue={tier}>
            <option value="">全部</option>
            {LEAD_TIERS.map((item) => (
              <option key={item} value={item}>
                {item} 类
              </option>
            ))}
          </select>
        </label>
        <label>
          归属顾问
          <select name="consultant" defaultValue={consultantId}>
            <option value="">全部</option>
            {consultants.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          起始日期
          <input type="date" name="from" defaultValue={from} />
        </label>
        <label>
          截止日期
          <input type="date" name="to" defaultValue={to} />
        </label>
        <button type="submit" className="admin-btn">
          筛选
        </button>
        <Link className="admin-btn secondary" href="/admin/leads">
          重置
        </Link>
        <a className="admin-btn secondary" href={exportHref}>
          导出 CSV
        </a>
      </form>

      <div className="admin-card">
        <p className="redeem-hint" style={{ marginTop: 0 }}>
          共 {total} 条线索，第 {page} / {totalPages} 页
          {base.toString() ? "（已按筛选条件过滤）" : ""}
        </p>
        <table className="admin-table">
          <thead>
            <tr>
              <th>姓名</th>
              <th>手机号</th>
              <th>微信昵称</th>
              <th>意向户型</th>
              <th>关注点</th>
              <th>预计到访</th>
              <th>顾问</th>
              <th>分层</th>
              <th>留资时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td>{lead.name}</td>
                <td>{lead.phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2")}</td>
                <td>
                  {lead.customer.nickname || lead.customer.avatarUrl ? (
                    <span className="inline-flex items-center gap-2">
                      {lead.customer.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={lead.customer.avatarUrl}
                          alt=""
                          className="h-7 w-7 rounded-full object-cover"
                        />
                      ) : null}
                      <span>{lead.customer.nickname || "已授权"}</span>
                    </span>
                  ) : (
                    <span className="text-[#9b7d64]">未授权资料</span>
                  )}
                </td>
                <td>{lead.intentLayout || "-"}</td>
                <td>{lead.focusFactors || "-"}</td>
                <td>
                  {lead.visitDate
                    ? lead.visitDate.toLocaleDateString("zh-CN")
                    : "-"}
                </td>
                <td>{lead.consultant?.name || "-"}</td>
                <td>{lead.tier}</td>
                <td>{lead.createdAt.toLocaleString("zh-CN")}</td>
                <td>
                  <Link href={`/admin/leads/${lead.id}`}>详情</Link>
                </td>
              </tr>
            ))}
            {!leads.length && (
              <tr>
                <td colSpan={10}>没有匹配的线索</td>
              </tr>
            )}
          </tbody>
        </table>

        <nav className="admin-pager" aria-label="分页">
          <Link
            href={pageHref(Math.max(1, page - 1))}
            className={page <= 1 ? "is-disabled" : undefined}
            aria-disabled={page <= 1}
          >
            上一页
          </Link>
          <span aria-current="page">
            {page} / {totalPages}
          </span>
          <Link
            href={pageHref(Math.min(totalPages, page + 1))}
            className={page >= totalPages ? "is-disabled" : undefined}
            aria-disabled={page >= totalPages}
          >
            下一页
          </Link>
        </nav>
      </div>
    </AdminShell>
  );
}
