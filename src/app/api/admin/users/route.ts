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
