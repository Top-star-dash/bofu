import { NextResponse } from "next/server";
import { getAdminSession, verifyPassword, writeOperationLog } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * 数据清理（危险操作，仅超级管理员）。
 * scope = "business"：清空客户/线索/抽奖/助力/浏览/操作日志，保留活动配置、奖品、顾问、素材。
 * scope = "full"：除后台用户与权限外全部清空（活动配置、奖品、顾问、素材一并删除）。
 * 必须同时提供当前账号密码与确认短语，避免误触。
 */
const CONFIRM_WORD = "确认清空";

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ message: "请先登录后台" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    scope?: string;
    password?: string;
    confirm?: string;
  };

  const scope = body.scope === "full" ? "full" : "business";
  if ((body.confirm || "").trim() !== CONFIRM_WORD) {
    return NextResponse.json(
      { message: `请输入确认短语「${CONFIRM_WORD}」` },
      { status: 400 },
    );
  }
  if (!body.password) {
    return NextResponse.json({ message: "请输入当前账号密码" }, { status: 400 });
  }

  // 会话声明 + 数据库实查双重确认，防止 JWT 过期前被降权后仍能清理
  const admin = await prisma.adminUser.findUnique({
    where: { id: session.sub },
    select: { passwordHash: true, isSuperAdmin: true, status: true },
  });
  if (
    !admin ||
    admin.status !== "ACTIVE" ||
    !admin.isSuperAdmin ||
    !session.isSuperAdmin
  ) {
    return NextResponse.json(
      { message: "仅超级管理员可执行数据清理" },
      { status: 403 },
    );
  }
  if (!(await verifyPassword(body.password, admin.passwordHash))) {
    return NextResponse.json({ message: "密码不正确，已取消清理" }, { status: 400 });
  }

  const removed: Record<string, number> = {};

  await prisma.$transaction(
    async (tx) => {
      // 1) 行为与抽奖数据：先删子表，避免外键阻塞
      removed.browseEvents = (await tx.browseEvent.deleteMany()).count;
      removed.assistRecords = (await tx.assistRecord.deleteMany()).count;
      removed.drawRecords = (await tx.drawRecord.deleteMany()).count;

      // 2) 线索
      removed.leads = (await tx.lead.deleteMany()).count;

      // 3) 客户：先断开邀请关系（自引用外键）再删除
      await tx.customer.updateMany({ data: { inviterId: null, consultantId: null } });
      removed.customers = (await tx.customer.deleteMany()).count;

      // 4) 操作日志
      removed.operationLogs = (await tx.operationLog.deleteMany()).count;

      if (scope === "full") {
        removed.notices = (await tx.activityNotice.deleteMany()).count;
        removed.assets = (await tx.activityAsset.deleteMany()).count;
        removed.prizes = (await tx.prize.deleteMany()).count;
        removed.consultants = (await tx.consultant.deleteMany()).count;
        removed.activities = (await tx.activity.deleteMany()).count;
      } else {
        // 保留配置，但重置计数与库存，避免统计与库存停留在历史值
        const prizes = await tx.prize.findMany({
          select: { id: true, stock: true },
        });
        for (const prize of prizes) {
          await tx.prize.update({
            where: { id: prize.id },
            data: { remainStock: prize.stock },
          });
        }
        await tx.activity.updateMany({
          data: { exposureCount: 0, participateCount: 0 },
        });
      }
    },
    { timeout: 120_000 },
  );

  await writeOperationLog(
    session.sub,
    scope === "full" ? "数据清理：完全重置" : "数据清理：业务数据",
    Object.entries(removed)
      .map(([key, value]) => `${key}=${value}`)
      .join(", "),
  );

  return NextResponse.json({ ok: true, scope, removed });
}
