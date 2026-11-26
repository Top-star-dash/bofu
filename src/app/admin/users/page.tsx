export const instant = false;

import { redirect } from "next/navigation";
import AdminShell, { firstAllowedHref } from "@/components/admin/AdminShell";
import DataPurgePanel from "@/components/admin/DataPurgePanel";
import UsersManager from "@/components/admin/UsersManager";
import { canUse } from "@/lib/admin-guard";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { permissionCodesFromUserRoles } from "@/lib/roles";

export default async function AdminUsersPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!canUse(session, "users")) {
    redirect(firstAllowedHref(session) || "/admin/login");
  }

  const [users, roles] = await Promise.all([
    prisma.adminUser.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    }),
    prisma.adminRole.findMany({
      orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }],
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    }),
  ]);

  return (
    <AdminShell session={session} current="/admin/users">
      <h2 style={{ marginTop: 0 }}>用户与角色</h2>
      <p style={{ color: "#8a6c5b" }}>
        权限由角色决定（可多选并集）；修改角色权限会同步所有绑定用户（需重新登录生效）。
      </p>
      <UsersManager
        currentUserId={session.sub}
        roles={roles.map((role) => ({
          id: role.id,
          code: role.code,
          name: role.name,
          description: role.description ?? "",
          isSystem: role.isSystem,
          permissions: role.permissions.map((item) => item.permission.code),
        }))}
        roleRows={roles.map((role) => ({
          id: role.id,
          code: role.code,
          name: role.name,
          description: role.description ?? "",
          isSystem: role.isSystem,
          userCount: role._count.users,
          permissions: role.permissions.map((item) => item.permission.code),
        }))}
        users={users.map((user) => ({
          id: user.id,
          username: user.username,
          name: user.name,
          phone: user.phone ?? "",
          isSuperAdmin: user.isSuperAdmin,
          status: user.status,
          roleIds: user.roles.map((edge) => edge.role.id),
          roles: user.roles.map((edge) => ({
            id: edge.role.id,
            code: edge.role.code,
            name: edge.role.name,
          })),
          permissions: permissionCodesFromUserRoles(user.roles),
        }))}
      />

      {session.isSuperAdmin ? (
        <div className="admin-card">
          <h3 className="m-0 text-[15px] font-bold">数据清理</h3>
          <p className="m-0 mt-1 mb-3 text-[12px] text-[#8a6c5b]">
            活动上线前清空测试数据。仅超级管理员可见，需账号密码与确认短语双重校验。
          </p>
          <DataPurgePanel />
        </div>
      ) : null}
    </AdminShell>
  );
}
