export const instant = false;

import { redirect } from "next/navigation";
import AdminShell, { firstAllowedHref } from "@/components/admin/AdminShell";
import UsersManager from "@/components/admin/UsersManager";
import { canUse } from "@/lib/admin-guard";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function AdminUsersPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!canUse(session, "users")) {
    redirect(firstAllowedHref(session) || "/admin/login");
  }

  const users = await prisma.adminUser.findMany({
    orderBy: { createdAt: "asc" },
    include: { permissions: { include: { permission: true } } },
  });

  return (
    <AdminShell session={session} current="/admin/users">
      <h2 style={{ marginTop: 0 }}>用户权限</h2>
      <p style={{ color: "#8a6c5b" }}>
        超级管理员可新增后台用户、调整权限、停用账号与重置密码。
      </p>
      <UsersManager
        currentUserId={session.sub}
        users={users.map((user) => ({
          id: user.id,
          username: user.username,
          name: user.name,
          phone: user.phone ?? "",
          isSuperAdmin: user.isSuperAdmin,
          status: user.status,
          permissions: user.permissions.map((item) => item.permission.code),
        }))}
      />
    </AdminShell>
  );
}

