import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession, hashPassword, writeOperationLog } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PERMISSION_MODULES } from "@/lib/permissions";

export async function GET() {
  const session = await getAdminSession();
  if (!session || (!session.isSuperAdmin && !session.permissions.includes("users"))) {
    return NextResponse.json({ message: "无权限" }, { status: 403 });
  }

  const users = await prisma.adminUser.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      permissions: { include: { permission: true } },
    },
  });

  return NextResponse.json({
    permissions: PERMISSION_MODULES,
    users: users.map((user) => ({
      id: user.id,
      username: user.username,
      name: user.name,
      phone: user.phone,
      isSuperAdmin: user.isSuperAdmin,
      status: user.status,
      permissions: user.permissions.map((item) => item.permission.code),
      createdAt: user.createdAt,
    })),
  });
}

const createSchema = z.object({
  username: z.string().min(3).max(32),
  name: z.string().min(1).max(64),
  phone: z.string().optional(),
  password: z.string().min(8).max(64),
  permissions: z.array(z.string()).default([]),
});

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session || (!session.isSuperAdmin && !session.permissions.includes("users"))) {
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

  const permissionRows = await prisma.permission.findMany({
    where: { code: { in: parsed.data.permissions } },
  });

  const passwordHash = await hashPassword(parsed.data.password);
  const user = await prisma.adminUser.create({
    data: {
      username: parsed.data.username,
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      passwordHash,
      permissions: {
        create: permissionRows.map((permission) => ({
          permissionId: permission.id,
        })),
      },
    },
  });

  await writeOperationLog(
    session.sub,
    "admin.user.create",
    `${user.username}:${parsed.data.permissions.join(",")}`,
  );

  return NextResponse.json({ ok: true, id: user.id });
}

const patchSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(64).optional(),
  phone: z.string().trim().max(32).optional().nullable(),
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  permissions: z.array(z.string()).optional(),
  password: z.string().min(8).max(64).optional(),
});

/** E.2.9 用户管理补齐：改姓名/手机/权限/状态，重置密码 */
export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session || (!session.isSuperAdmin && !session.permissions.includes("users"))) {
    return NextResponse.json({ message: "无权限" }, { status: 403 });
  }

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message || "参数不正确" },
      { status: 400 },
    );
  }

  const { id, permissions, password, ...rest } = parsed.data;
  const target = await prisma.adminUser.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ message: "用户不存在" }, { status: 404 });
  }

  if (rest.status === "DISABLED") {
    if (target.id === session.sub) {
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

    if (permissions) {
      const rows = await tx.permission.findMany({
        where: { code: { in: permissions } },
      });
      await tx.adminUserPermission.deleteMany({ where: { userId: id } });
      if (rows.length) {
        await tx.adminUserPermission.createMany({
          data: rows.map((permission) => ({
            userId: id,
            permissionId: permission.id,
          })),
        });
      }
    }
  });

  await writeOperationLog(
    session.sub,
    "admin.user.update",
    `${target.username}:${Object.keys(parsed.data).filter((key) => key !== "id").join(",")}`,
  );

  return NextResponse.json({ ok: true });
}
