export const instant = false;

import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { getCurrentActivity } from "@/lib/activity";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function AdminHomePage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

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

      <div className="admin-card">
        <h3 style={{ marginTop: 0 }}>当前活动</h3>
        {activity ? (
          <p>
            {activity.title}
            <br />
            状态：{activity.runtimeStatus}
            <br />
            时间：{activity.startAt.toLocaleString("zh-CN")} ~{" "}
            {activity.endAt.toLocaleString("zh-CN")}
          </p>
        ) : (
          <p>尚未配置活动</p>
        )}
      </div>
    </AdminShell>
  );
}

