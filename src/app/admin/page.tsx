export const instant = false;

import { redirect } from "next/navigation";
import Link from "next/link";
import AdminShell, { firstAllowedHref } from "@/components/admin/AdminShell";
import { canUse } from "@/lib/admin-guard";
import { getCurrentActivity } from "@/lib/activity";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function AdminHomePage() {
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

  return (
    <AdminShell session={session} current="/admin">
      <h2 style={{ marginTop: 0 }}>数据概览</h2>
      <div className="admin-grid">
        <article>
          <span>曝光量</span>
          <strong>{activity?.exposureCount ?? 0}</strong>
        </article>
        <article>
          <span>参与量</span>
          <strong>{activity?.participateCount ?? 0}</strong>
        </article>
        <article>
          <span>留资人数</span>
          <strong>{leadCount}</strong>
        </article>
        <article>
          <span>抽奖次数</span>
          <strong>{drawCount}</strong>
        </article>
        <article>
          <span>中奖人数</span>
          <strong>{winCount}</strong>
        </article>
        <article>
          <span>后台用户</span>
          <strong>{userCount}</strong>
        </article>
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

