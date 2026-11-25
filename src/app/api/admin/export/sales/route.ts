import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { guardApi } from "@/lib/admin-guard";
import { getCurrentActivity } from "@/lib/activity";
import { getStatsSummary, parseRange } from "@/lib/stats";
import { writeOperationLog } from "@/lib/auth";

/** G.3 《销售推广转化汇总》xlsx */
export async function GET(request: Request) {
  const guard = await guardApi("stats");
  if (guard.error) return guard.error;

  const activity = await getCurrentActivity();
  if (!activity) {
    return NextResponse.json({ message: "活动未配置" }, { status: 404 });
  }

  const url = new URL(request.url);
  const range = parseRange(url.searchParams.get("from"), url.searchParams.get("to"));
  const { overview, rows } = await getStatsSummary(activity.id, range);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "博富·福美城抽奖系统";
  workbook.created = new Date();

  const summary = workbook.addWorksheet("总览");
  summary.columns = [
    { header: "指标", key: "name", width: 20 },
    { header: "数值", key: "value", width: 18 },
  ];
  summary.addRows([
    { name: "活动名称", value: activity.title.replace(/<[^>]+>/g, "") },
    { name: "统计起始", value: range.start ? range.start.toLocaleString("zh-CN") : "全部" },
    { name: "统计截止", value: range.end ? range.end.toLocaleString("zh-CN") : "全部" },
    { name: "触达客户", value: overview.customers },
    { name: "留资人数", value: overview.leads },
    { name: "触达→留资", value: `${overview.conversion}%` },
    { name: "抽奖次数", value: overview.draws },
    { name: "中奖次数", value: overview.winners },
    { name: "已核销", value: overview.redeemed },
    { name: "助力成功", value: overview.assists },
  ]);
  summary.getRow(1).font = { bold: true };

  const sheet = workbook.addWorksheet("销售推广转化");
  sheet.columns = [
    { header: "顾问", key: "name", width: 18 },
    { header: "团队", key: "teamName", width: 14 },
    { header: "分享码", key: "shareCode", width: 14 },
    { header: "触达客户", key: "customers", width: 12 },
    { header: "留资", key: "leads", width: 10 },
    { header: "留资率", key: "rate", width: 10 },
    { header: "抽奖", key: "draws", width: 10 },
    { header: "中奖", key: "wins", width: 10 },
    { header: "核销", key: "redeemed", width: 10 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const row of [...rows].sort((a, b) => b.leads - a.leads || b.customers - a.customers)) {
    sheet.addRow({
      name: row.name,
      teamName: row.teamName || "",
      shareCode: row.shareCode,
      customers: row.customers,
      leads: row.leads,
      rate: row.customers
        ? `${Math.round((row.leads / row.customers) * 1000) / 10}%`
        : "-",
      draws: row.draws,
      wins: row.wins,
      redeemed: row.redeemed,
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `销售推广转化汇总-${new Date().toISOString().slice(0, 10)}.xlsx`;

  await writeOperationLog(
    guard.session.sub,
    "export.sales",
    `${rows.length} 位顾问`,
  );

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="sales.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "cache-control": "no-store",
    },
  });
}
