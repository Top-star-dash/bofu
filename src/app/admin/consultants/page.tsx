export const instant = false;

import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { getCurrentActivity } from "@/lib/activity";
import { getAdminSession } from "@/lib/auth";

export default async function AdminConsultantsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const activity = await getCurrentActivity();

  return (
    <AdminShell session={session} current="/admin/consultants">
      <h2 style={{ marginTop: 0 }}>顾问管理</h2>
      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>姓名</th>
              <th>电话</th>
              <th>团队</th>
              <th>专属码</th>
              <th>默认</th>
              <th>推广链接</th>
            </tr>
          </thead>
          <tbody>
            {activity?.consultants.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.phone}</td>
                <td>{item.teamName || "-"}</td>
                <td>{item.shareCode}</td>
                <td>{item.isDefault ? "是" : "否"}</td>
                <td>/?c={item.shareCode}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}

