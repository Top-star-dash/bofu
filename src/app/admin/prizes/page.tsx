export const instant = false;

import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { getCurrentActivity } from "@/lib/activity";
import { getAdminSession } from "@/lib/auth";

export default async function AdminPrizesPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const activity = await getCurrentActivity();

  return (
    <AdminShell session={session} current="/admin/prizes">
      <h2 style={{ marginTop: 0 }}>奖品管理</h2>
      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>奖项</th>
              <th>奖品</th>
              <th>库存</th>
              <th>剩余</th>
              <th>概率%</th>
            </tr>
          </thead>
          <tbody>
            {activity?.prizes.map((prize) => (
              <tr key={prize.id}>
                <td>{prize.level}</td>
                <td>{prize.name}</td>
                <td>{prize.stock}</td>
                <td>{prize.remainStock}</td>
                <td>{prize.probability.toString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}

