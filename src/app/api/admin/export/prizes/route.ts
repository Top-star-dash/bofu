import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { guardApi } from "@/lib/admin-guard";
import { getCurrentActivity } from "@/lib/activity";
import { writeOperationLog } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseRange } from "@/lib/stats";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "待核销",
  REDEEMED: "已核销",
  EXPIRED: "已过期",
};

function maskPhone(phone?: string | null) {
  if (!phone) return "-";
  return phone.replace(/^(\d{3})\d{4}(\d{4})$/, "$1****$2");
}

/** G.3 《中奖兑奖明细》xlsx，支持日期 / 销售 / 核销状态筛选 */
export async function GET(request: Request) {
  const guard = await guardApi("stats");
  if (guard.error) return guard.error;

  const activity = await getCurrentActivity();
  if (!activity) {
    return NextResponse.json({ message: "活动未配置" }, { status: 404 });
  }

  const url = new URL(request.url);
  const range = parseRange(url.searchParams.get("from"), url.searchParams.get("to"));
  const consultantId = url.searchParams.get("consultant")?.trim() || "";
  const status = url.searchParams.get("status")?.trim() || "";

  const records = await prisma.drawRecord.findMany({
    where: {
      activityId: activity.id,
      isWin: true,
      ...(range.start || range.end
        ? {
            createdAt: {
              ...(range.start ? { gte: range.start } : {}),
              ...(range.end ? { lte: range.end } : {}),
            },
          }
        : {}),
      ...(status === "PENDING" || status === "REDEEMED" || status === "EXPIRED"
        ? { redeemStatus: status }
        : {}),
      ...(consultantId ? { customer: { consultantId } } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      customer: {
        select: {
          nickname: true,
          consultant: { select: { name: true, teamName: true } },
          lead: { select: { name: true, phone: true } },
        },
      },
    },
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "博富·福美城抽奖系统";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("中奖兑奖明细");
  sheet.columns = [
    { header: "中奖时间", key: "createdAt", width: 20 },
    { header: "奖品", key: "prizeName", width: 24 },
    { header: "等级", key: "prizeLevel", width: 14 },
    { header: "客户姓名", key: "customerName", width: 14 },
    { header: "手机号", key: "phone", width: 16 },
    { header: "微信昵称", key: "nickname", width: 16 },
    { header: "归属顾问", key: "consultant", width: 16 },
    { header: "团队", key: "teamName", width: 14 },
    { header: "核销状态", key: "status", width: 12 },
    { header: "核销时间", key: "redeemedAt", width: 20 },
    { header: "兑奖码", key: "redeemCode", width: 26 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const record of records) {
    sheet.addRow({
      createdAt: record.createdAt.toLocaleString("zh-CN"),
      prizeName: record.prizeName,
      prizeLevel: record.prizeLevel,
      customerName: record.customer.lead?.name || "-",
      phone: maskPhone(record.customer.lead?.phone),
      nickname: record.customer.nickname || "-",
      consultant: record.customer.consultant?.name || "未归属",
      teamName: record.customer.consultant?.teamName || "",
      status: STATUS_LABEL[record.redeemStatus] || record.redeemStatus,
      redeemedAt: record.redeemedAt
        ? record.redeemedAt.toLocaleString("zh-CN")
        : "-",
      redeemCode: record.redeemCode,
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `中奖兑奖明细-${new Date().toISOString().slice(0, 10)}.xlsx`;

  await writeOperationLog(
    guard.session.sub,
    "export.prizes",
    `${records.length} 条中奖记录`,
  );

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="prizes.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "cache-control": "no-store",
    },
  });
}
