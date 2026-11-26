export const instant = false;

import { redirect } from "next/navigation";
import Link from "next/link";
import AdminShell, { firstAllowedHref } from "@/components/admin/AdminShell";
import { canUse } from "@/lib/admin-guard";
import { getCurrentActivity } from "@/lib/activity";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getRangeDigest, parseRange, shanghaiDayStart } from "@/lib/stats";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const DAY_MS = 86_400_000;

const PRESETS = [
  { key: "today", label: "今日" },
  { key: "7d", label: "近 7 天" },
  { key: "30d", label: "近 30 天" },
] as const;

function pick(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return typeof value === "string" ? value.trim() : "";
}

export default async function AdminHomePage({
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
      <AdminShell session={session} current="/admin">
        <h2 style={{ marginTop: 0 }}>暂无访问权限</h2>
        <p>当前账号未分配数据概览权限，请联系超级管理员。</p>
      </AdminShell>
    );
  }

  const activity = await getCurrentActivity();
  const [leadCount, drawCount, winCount, userCount] = await Promise.all([
    prisma.lead.count(),
    prisma.drawRecord.count(),
    prisma.drawRecord.count({ where: { isWin: true } }),
    prisma.adminUser.count(),
  ]);

  // 区间统计：默认近 7 天，支持今日 / 近 30 天与自定义日期
  const params = await searchParams;
  const preset = pick(params, "range");
  const from = pick(params, "from");
  const to = pick(params, "to");

  const todayStart = shanghaiDayStart();
  let rangeStart = new Date(todayStart.getTime() - 6 * DAY_MS);
  let rangeEnd = new Date(todayStart.getTime() + DAY_MS - 1);
  let activePreset: string = preset === "today" || preset === "30d" ? preset : "7d";

  if (from || to) {
    const custom = parseRange(from, to);
    rangeStart = custom.start ?? rangeStart;
    rangeEnd = custom.end ?? rangeEnd;
    activePreset = "";
  } else if (preset === "today") {
    rangeStart = todayStart;
    rangeEnd = new Date(todayStart.getTime() + DAY_MS - 1);
  } else if (preset === "30d") {
    rangeStart = new Date(todayStart.getTime() - 29 * DAY_MS);
    rangeEnd = new Date(todayStart.getTime() + DAY_MS - 1);
  }

  if (rangeStart.getTime() > rangeEnd.getTime()) {
    [rangeStart, rangeEnd] = [rangeEnd, rangeStart];
  }
  // 单次最长查询 92 天，避免误选跨年区间拖慢后台
  const maxSpan = 92 * DAY_MS;
  if (rangeEnd.getTime() - rangeStart.getTime() > maxSpan) {
    rangeStart = new Date(rangeEnd.getTime() - maxSpan);
  }

  const digest = activity
    ? await getRangeDigest(activity.id, rangeStart, rangeEnd)
    : null;

  const peak = digest
    ? Math.max(1, ...digest.daily.map((point) => point.customers))
    : 1;
  const avgLeads =
    digest && digest.daily.length
      ? Math.round((digest.overview.leads / digest.daily.length) * 10) / 10
      : 0;

  return (
    <AdminShell session={session} current="/admin">
      <h2 style={{ marginTop: 0 }}>数据概览</h2>

      <div className="admin-card flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 style={{ marginTop: 0 }}>时间范围统计</h3>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((item) => (
              <Link
                key={item.key}
                href={`/admin?range=${item.key}`}
                className={`rounded-lg px-3 py-1.5 text-[13px] font-bold no-underline ${
                  activePreset === item.key
                    ? "bg-[#b83224] text-white"
                    : "bg-[#fff2df] text-[#8f281f] hover:bg-[#ffe6b8]"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <form className="admin-toolbar" method="get" action="/admin">
          <label>
            起始日期
            <input type="date" name="from" defaultValue={digest?.start ?? ""} />
          </label>
          <label>
            截止日期
            <input type="date" name="to" defaultValue={digest?.end ?? ""} />
          </label>
          <button type="submit" className="admin-btn">
            统计
          </button>
          <Link className="admin-btn secondary" href="/admin">
            重置
          </Link>
        </form>

        {digest ? (
          <>
            <p className="m-0 text-[12px] text-[#8a6c5b]">
              统计区间 {digest.start} ~ {digest.end}，共 {digest.daily.length} 天
              · 日均留资 {avgLeads} 人
            </p>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "新增触达", value: digest.overview.customers },
                { label: "留资", value: digest.overview.leads },
                { label: "触达→留资", value: `${digest.overview.conversion}%` },
                { label: "抽奖次数", value: digest.overview.draws },
                { label: "中奖", value: digest.overview.winners },
                { label: "已核销", value: digest.overview.redeemed },
                { label: "助力成功", value: digest.overview.assists },
                { label: "区间天数", value: digest.daily.length },
              ].map((item) => (
                <article
                  key={item.label}
                  className="rounded-xl border border-[#f0e2d2] bg-[#fffaf3] px-4 py-3"
                >
                  <span className="text-[12px] text-[#8a6c5b]">{item.label}</span>
                  <strong className="mt-1 block text-[20px] font-bold text-[#b83224]">
                    {item.value}
                  </strong>
                </article>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>触达客户</th>
                    <th>留资</th>
                    <th>抽奖</th>
                    <th>中奖</th>
                    <th>核销</th>
                  </tr>
                </thead>
                <tbody>
                  {digest.daily.map((point) => (
                    <tr key={point.date}>
                      <td className="whitespace-nowrap">{point.date.slice(5)}</td>
                      <td>
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-24 overflow-hidden rounded-full bg-[#f1ece7]">
                            <span
                              className="block h-full rounded-full bg-[#b83224]"
                              style={{
                                width: `${Math.round((point.customers / peak) * 100)}%`,
                              }}
                            />
                          </span>
                          <span>{point.customers}</span>
                        </span>
                      </td>
                      <td>{point.leads}</td>
                      <td>{point.draws}</td>
                      <td>{point.wins}</td>
                      <td>{point.redeemed}</td>
                    </tr>
                  ))}
                  {!digest.daily.length && (
                    <tr>
                      <td colSpan={6}>区间内暂无数据</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="m-0 text-[13px] text-[#8a6c5b]">尚未配置活动</p>
        )}
      </div>

      <div className="admin-card flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 style={{ marginTop: 0 }}>累计总览</h3>
          <span className="text-[12px] text-[#8a6c5b]">活动开始至今</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "曝光量", value: activity?.exposureCount ?? 0 },
            { label: "参与量", value: activity?.participateCount ?? 0 },
            { label: "留资人数", value: leadCount },
            { label: "抽奖次数", value: drawCount },
            { label: "中奖人数", value: winCount },
            { label: "后台用户", value: userCount },
          ].map((item) => (
            <article
              key={item.label}
              className="rounded-xl border border-[#f0e2d2] bg-[#fffaf3] px-4 py-3"
            >
              <span className="text-[12px] text-[#8a6c5b]">{item.label}</span>
              <strong className="mt-1 block text-[20px] font-bold text-[#b83224]">
                {item.value}
              </strong>
            </article>
          ))}
        </div>
      </div>

      <div className="admin-card flex flex-col gap-3">
        <h3 style={{ marginTop: 0 }}>当前活动</h3>
        {activity ? (
          <div className="flex flex-col gap-2 text-[13px] leading-5">
            <div dangerouslySetInnerHTML={{ __html: activity.title }} />
            <div>状态：{activity.runtimeStatus}</div>
            <div>
              时间：{activity.startAt.toLocaleString("zh-CN")} ~{" "}
              {activity.endAt.toLocaleString("zh-CN")}
            </div>
          </div>
        ) : (
          <p>尚未配置活动</p>
        )}
        <div>
          <Link className="admin-btn secondary" href="/admin/stats">
            查看销售转化看板
          </Link>
        </div>
      </div>
    </AdminShell>
  );
}
