import { NextResponse } from "next/server";
import { clearAdminSession, getAdminSession, writeOperationLog } from "@/lib/auth";

export async function POST() {
  const session = await getAdminSession();
  if (session) {
    await writeOperationLog(session.sub, "admin.logout", session.username);
  }
  await clearAdminSession();
  return NextResponse.json({ ok: true });
}
