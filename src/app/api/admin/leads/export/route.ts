import { NextResponse } from "next/server";
import { getAdminSession, writeOperationLog } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildLeadWhere } from "@/lib/lead-query";
import { hasPermission } from "@/lib/permissions";

const COLUMNS = [
  "姓名",
  "手机号",
  "意向户型",
  "意向面积",
  "关注点",
  "预计到访",
  "归属顾问",
  "线索分层",
  "备注",
  "微信昵称",
  "OpenID",
  "留资时间",
];

function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ message: "请先登录后台" }, { status: 401 });
  }
  if (!hasPermission(session.permissions, "leads", session.isSuperAdmin)) {
    return NextResponse.json({ message: "没有线索导出权限" }, { status: 403 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const tier = url.searchParams.get("tier")?.trim() ?? "";
  const consultantId = url.searchParams.get("consultant")?.trim() ?? "";
  const from = url.searchParams.get("from")?.trim() ?? "";
  const to = url.searchParams.get("to")?.trim() ?? "";

  const where = buildLeadWhere({
    q,
    tier,
    consultantId,
    from,
    to,
  });

  const leads = await prisma.lead.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5000,
    include: { consultant: true, customer: true },
  });

  const rows = leads.map((lead) =>
    [
      lead.name,
      lead.phone,
      lead.intentLayout ?? "",
      lead.intentArea ?? "",
      lead.focusFactors ?? "",
      lead.visitDate ? dateFormatter.format(lead.visitDate) : "",
      lead.consultant?.name ?? "",
      lead.tier,
      lead.remark ?? "",
      lead.customer.nickname ?? "",
      lead.customer.openid,
      dateTimeFormatter.format(lead.createdAt),
    ]
      .map(csvCell)
      .join(","),
  );

  const csv = `\ufeff${[COLUMNS.join(","), ...rows].join("\r\n")}`;

  await writeOperationLog(
    session.sub,
    "leads.export",
    `导出 ${leads.length} 条线索（q=${q || "-"} tier=${tier || "-"}）`,
  );

  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const fileName = `线索-${stamp}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${stamp}.csv"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "no-store",
    },
  });
}
