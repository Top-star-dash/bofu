import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession, hashPassword, writeOperationLog } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PERMISSION_MODULES } from "@/lib/permissions";
import { permissionCodesFromUserRoles } from "@/lib/roles";

function requireUsersPermission(
  session: Awaited<ReturnType<typeof getAdminSession>>,
) {
  return (
    session &&
    (session.isSuperAdmin || session.permissions.includes("users"))
  );
}

const userRoleInclude = {
  roles: {
    include: {
      role: {
        include: {
          permissions: { include: { permission: true } },
        },
      },
    },
  },
} as const;

function mapUser(
  user: {
    id: string;
    username: string;
    name: string;
    phone: string | null;
    isSuperAdmin: boolean;
    status: string;
    createdAt: Date;
    roles: Parameters<typeof permissionCodesFromUserRoles>[0];
  },
) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    phone: user.phone,
    isSuperAdmin: user.isSuperAdmin,
    status: user.status,
    roleIds: user.roles.map((edge) => edge.role.id),
    roles: user.roles.map((edge) => ({
      id: edge.role.id,
      code: edge.role.code,
      name: edge.role.name,
    })),
    permissions: permissionCodesFromUserRoles(user.roles),
    createdAt: user.createdAt,
  };
}

export async function GET() {
  const session = await getAdminSession();
  if (!requireUsersPermission(session)) {
    return NextResponse.json({ message: "无权限" }, { status: 403 });
  }

  const [users, roles] = await Promise.all([
    prisma.adminUser.findMany({
      orderBy: { createdAt: "asc" },
      include: userRoleInclude,
    }),
    prisma.adminRole.findMany({
      orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }],
      include: {
        permissions: { include: { permission: true } },
      },
    }),
  ]);

  return NextResponse.json({
    permissions: PERMISSION_MODULES,
    roles: roles.map((role) => ({
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description ?? "",
      isSystem: role.isSystem,
      permissions: role.permissions.map((item) => item.permission.code),
    })),
    users: users.map(mapUser),
  });
}

const createSchema = z.object({
  username: z.string().min(3).max(32),
  name: z.string().min(1).max(64),
  phone: z.string().optional(),
  password: z.string().min(8).max(64),
  roleIds: z.array(z.string()).default([]),
});

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!requireUsersPermission(session)) {
    return NextResponse.json({ message: "无权限" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "参数不正确" }, { status: 400 });
  }

  const exists = await prisma.adminUser.findUnique({
    where: { username: parsed.data.username },
  });
  if (exists) {
    return NextResponse.json({ message: "账号已存在" }, { status: 409 });
  }

  const roleRows = parsed.data.roleIds.length
    ? await prisma.adminRole.findMany({
        where: { id: { in: parsed.data.roleIds } },
      })
    : [];

  const passwordHash = await hashPassword(parsed.data.password);
  const user = await prisma.adminUser.create({
    data: {
      username: parsed.data.username,
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      passwordHash,
      roles: {
        create: roleRows.map((role) => ({ roleId: role.id })),
      },
    },
  });

  await writeOperationLog(
    session!.sub,
    "admin.user.create",
    `${user.username}:roles=${roleRows.map((role) => role.code).join(",")}`,
  );

  return NextResponse.json({ ok: true, id: user.id });
}

const patchSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(64).optional(),
  phone: z.string().trim().max(32).optional().nullable(),
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  roleIds: z.array(z.string()).optional(),
  password: z.string().min(8).max(64).optional(),
});

/** 用户管理：改姓名/手机/角色/状态，重置密码 */
export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!requireUsersPermission(session)) {
    return NextResponse.json({ message: "无权限" }, { status: 403 });
  }

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message || "参数不正确" },
      { status: 400 },
    );
  }

  const { id, roleIds, password, ...rest } = parsed.data;
  const target = await prisma.adminUser.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ message: "用户不存在" }, { status: 404 });
  }

  if (roleIds && target.isSuperAdmin) {
    return NextResponse.json(
      { message: "超级管理员不通过角色分配权限" },
      { status: 400 },
    );
  }

  if (rest.status === "DISABLED") {
    if (target.id === session!.sub) {
      return NextResponse.json({ message: "不能停用当前登录账号" }, { status: 400 });
    }
    if (target.isSuperAdmin) {
      const activeSuperAdmins = await prisma.adminUser.count({
        where: { isSuperAdmin: true, status: "ACTIVE" },
      });
      if (activeSuperAdmins <= 1) {
        return NextResponse.json(
          { message: "至少需要保留一个启用状态的超级管理员" },
          { status: 400 },
        );
      }
    }
  }

  const data: {
    name?: string;
    phone?: string | null;
    status?: "ACTIVE" | "DISABLED";
    passwordHash?: string;
  } = { ...rest };
  if (password) data.passwordHash = await hashPassword(password);

  await prisma.$transaction(async (tx) => {
    await tx.adminUser.update({ where: { id }, data });

    if (roleIds) {
      const rows = await tx.adminRole.findMany({
        where: { id: { in: roleIds } },
      });
      await tx.adminUserRole.deleteMany({ where: { userId: id } });
      if (rows.length) {
        await tx.adminUserRole.createMany({
          data: rows.map((role) => ({
            userId: id,
            roleId: role.id,
          })),
        });
      }
    }
  });

  await writeOperationLog(
    session!.sub,
    roleIds ? "admin.user.roles" : "admin.user.update",
    `${target.username}:${Object.keys(parsed.data)
      .filter((key) => key !== "id")
      .join(",")}`,
  );

  return NextResponse.json({
    ok: true,
    tip: roleIds
      ? "角色已更新；该用户需重新登录后权限生效"
      : undefined,
  });
}
