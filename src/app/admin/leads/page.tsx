export const instant = false;

import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function AdminLeadsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      consultant: true,
      customer: true,
    },
  });

  return (
    <AdminShell session={session} current="/admin/leads">
      <h2 style={{ marginTop: 0 }}>线索管理</h2>
      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>姓名</th>
              <th>手机号</th>
              <th>意向户型</th>
              <th>顾问</th>
              <th>分层</th>
              <th>留资时间</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td>{lead.name}</td>
                <td>{lead.phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2")}</td>
                <td>{lead.intentLayout || "-"}</td>
                <td>{lead.consultant?.name || "-"}</td>
                <td>{lead.tier}</td>
                <td>{lead.createdAt.toLocaleString("zh-CN")}</td>
              </tr>
            ))}
            {!leads.length && (
              <tr>
                <td colSpan={6}>暂无线索</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}

