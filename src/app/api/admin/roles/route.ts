import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession, writeOperationLog } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PERMISSION_MODULES } from "@/lib/permissions";

function requireUsersPermission(
  session: Awaited<ReturnType<typeof getAdminSession>>,
) {
  return (
    session &&
    (session.isSuperAdmin || session.permissions.includes("users"))
  );
}

export async function GET() {
  const session = await getAdminSession();
  if (!requireUsersPermission(session)) {
    return NextResponse.json({ message: "无权限" }, { status: 403 });
  }

  const roles = await prisma.adminRole.findMany({
    orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }],
    include: {
      permissions: { include: { permission: true } },
      _count: { select: { users: true } },
    },
  });

  return NextResponse.json({
    permissionModules: PERMISSION_MODULES,
    roles: roles.map((role) => ({
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description ?? "",
      isSystem: role.isSystem,
      userCount: role._count.users,
      permissions: role.permissions.map((item) => item.permission.code),
    })),
  });
}

const createSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .regex(/^[a-z][a-z0-9_-]*$/i, "角色编码须为字母开头的字母数字_-"),
  name: z.string().trim().min(1).max(64),
  description: z.string().trim().max(200).optional().nullable(),
  permissions: z.array(z.string()).default([]),
});

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!requireUsersPermission(session)) {
    return NextResponse.json({ message: "无权限" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message || "参数不正确" },
      { status: 400 },
    );
  }

  const code = parsed.data.code.toLowerCase();
  const exists = await prisma.adminRole.findUnique({ where: { code } });
  if (exists) {
    return NextResponse.json({ message: "角色编码已存在" }, { status: 409 });
  }

  const permissionRows = await prisma.permission.findMany({
    where: { code: { in: parsed.data.permissions } },
  });

  const role = await prisma.adminRole.create({
    data: {
      code,
      name: parsed.data.name,
      description: parsed.data.description || null,
      isSystem: false,
      permissions: {
        create: permissionRows.map((permission) => ({
          permissionId: permission.id,
        })),
      },
    },
  });

  await writeOperationLog(
    session!.sub,
    "admin.role.create",
    `${role.code}:${parsed.data.permissions.join(",")}`,
  );

  return NextResponse.json({ ok: true, id: role.id });
}

const patchSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(64).optional(),
  description: z.string().trim().max(200).optional().nullable(),
  permissions: z.array(z.string()).optional(),
});

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

  const target = await prisma.adminRole.findUnique({
    where: { id: parsed.data.id },
  });
  if (!target) {
    return NextResponse.json({ message: "角色不存在" }, { status: 404 });
  }

  const { id, permissions, ...rest } = parsed.data;

  await prisma.$transaction(async (tx) => {
    if (rest.name !== undefined || rest.description !== undefined) {
      await tx.adminRole.update({
        where: { id },
        data: {
          ...(rest.name !== undefined ? { name: rest.name } : {}),
          ...(rest.description !== undefined
            ? { description: rest.description }
            : {}),
        },
      });
    }

    if (permissions) {
      const rows = await tx.permission.findMany({
        where: { code: { in: permissions } },
      });
      await tx.adminRolePermission.deleteMany({ where: { roleId: id } });
      if (rows.length) {
        await tx.adminRolePermission.createMany({
          data: rows.map((permission) => ({
            roleId: id,
            permissionId: permission.id,
          })),
        });
      }
    }
  });

  await writeOperationLog(
    session!.sub,
    "admin.role.update",
    `${target.code}:${Object.keys(parsed.data)
      .filter((key) => key !== "id")
      .join(",")}`,
  );

  return NextResponse.json({
    ok: true,
    tip: "角色权限已更新；已登录用户需重新登录后生效",
  });
}

const deleteSchema = z.object({
  id: z.string().min(1),
});

export async function DELETE(request: Request) {
  const session = await getAdminSession();
  if (!requireUsersPermission(session)) {
    return NextResponse.json({ message: "无权限" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "参数不正确" }, { status: 400 });
  }

  const target = await prisma.adminRole.findUnique({
    where: { id: parsed.data.id },
    include: { _count: { select: { users: true } } },
  });
  if (!target) {
    return NextResponse.json({ message: "角色不存在" }, { status: 404 });
  }
  if (target.isSystem) {
    return NextResponse.json({ message: "系统预置角色不可删除" }, { status: 400 });
  }
  if (target._count.users > 0) {
    return NextResponse.json(
      { message: "仍有用户绑定该角色，请先解绑" },
      { status: 400 },
    );
  }

  await prisma.adminRole.delete({ where: { id: target.id } });
  await writeOperationLog(
    session!.sub,
    "admin.role.delete",
    target.code,
  );

  return NextResponse.json({ ok: true });
}
