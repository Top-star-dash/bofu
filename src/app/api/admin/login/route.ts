import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createAdminSession,
  loadAdminAuthPayload,
  writeOperationLog,
} from "@/lib/auth";

const schema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "请输入账号和密码" }, { status: 400 });
  }

  const session = await loadAdminAuthPayload(
    parsed.data.username.trim(),
    parsed.data.password,
  );

  if (!session) {
    return NextResponse.json({ message: "账号或密码错误" }, { status: 401 });
  }

  await createAdminSession(session);
  await writeOperationLog(session.sub, "admin.login", session.username);

  return NextResponse.json({
    ok: true,
    user: {
      username: session.username,
      name: session.name,
      isSuperAdmin: session.isSuperAdmin,
      permissions: session.permissions,
    },
  });
}
