export const instant = false;

import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import UsersManager from "@/components/admin/UsersManager";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function AdminUsersPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!session.isSuperAdmin && !session.permissions.includes("users")) {
    redirect("/admin");
  }

  const users = await prisma.adminUser.findMany({
    orderBy: { createdAt: "asc" },
    include: { permissions: { include: { permission: true } } },
  });

  return (
    <AdminShell session={session} current="/admin/users">
      <h2 style={{ marginTop: 0 }}>用户权限</h2>
      <p style={{ color: "#8a6c5b" }}>
        超级管理员可新增后台用户，并按模块赋予权限。
      </p>
      <UsersManager
        users={users.map((user) => ({
          id: user.id,
          username: user.username,
          name: user.name,
          phone: user.phone,
          isSuperAdmin: user.isSuperAdmin,
          status: user.status,
          permissions: user.permissions.map((item) => item.permission.code),
        }))}
      />
    </AdminShell>
  );
}

