import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApi } from "@/lib/admin-guard";
import { getCurrentActivity } from "@/lib/activity";
import { writeOperationLog } from "@/lib/auth";
import { prisma } from "@/lib/db";

const schema = z.object({
  rows: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(32),
        phone: z.string().trim().min(3).max(32),
        shareCode: z
          .string()
          .trim()
          .regex(/^[A-Za-z0-9_-]{1,32}$/, "分享码不合法"),
        teamName: z.string().trim().max(32).optional(),
        title: z.string().trim().max(32).optional(),
      }),
    )
    .min(1)
    .max(200),
});

type ImportRow = {
  name: string;
  phone: string;
  shareCode?: string;
  teamName?: string;
  title?: string;
  employeeNo?: string;
};

const FIELD_ALIASES = {
  name: ["销售姓名", "顾问姓名", "姓名", "名字"],
  phone: ["手机号码", "手机号", "联系电话", "手机", "电话"],
  shareCode: ["分享码", "推广码", "渠道码"],
  teamName: ["所属团队", "团队", "部门", "分组"],
  title: ["职衔", "职位", "职务"],
  employeeNo: ["工号"],
} as const;

type FieldKey = keyof typeof FIELD_ALIASES;

function normalizeHeader(value: string) {
  return value.replace(/\s+/g, "").replace(/[（(][^）)]*[）)]/g, "");
}

function matchField(value: string): FieldKey | null {
  const normalized = normalizeHeader(value);
  if (!normalized) return null;
  for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [
    FieldKey,
    readonly string[],
  ][]) {
    if (aliases.some((alias) => normalized === alias || normalized.includes(alias))) {
      return field;
    }
  }
  return null;
}

/** 兼容文本、数字、公式结果、超链接与富文本单元格 */
function cellText(cell: ExcelJS.Cell): string {
  const raw = cell.value as unknown;
  if (raw === null || raw === undefined) return "";
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.richText)) {
      return obj.richText
        .map((part) => String((part as { text?: string }).text ?? ""))
        .join("")
        .trim();
    }
    if (typeof obj.text === "string") return obj.text.trim();
    if (obj.result !== undefined && obj.result !== null) {
      return String(obj.result).trim();
    }
    if (typeof obj.hyperlink === "string") return obj.hyperlink.trim();
  }
  return String(raw).trim();
}

function mapHeader(sheet: ExcelJS.Worksheet) {
  const maxScan = Math.min(5, sheet.rowCount);
  for (let rowNumber = 1; rowNumber <= maxScan; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const mapping = new Map<number, FieldKey>();
    const fields = new Set<FieldKey>();
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const field = matchField(cellText(cell));
      if (field && !fields.has(field)) {
        mapping.set(col, field);
        fields.add(field);
      }
    });
    if (fields.has("name") && fields.has("phone")) {
      return { headerRow: rowNumber, mapping };
    }
  }
  return null;
}

function parseSheet(sheet: ExcelJS.Worksheet) {
  const header = mapHeader(sheet);
  if (!header) {
    return {
      rows: [] as ImportRow[],
      errors: ["未识别到表头：请确保表格包含「姓名」和「手机号码」两列"],
    };
  }

  const rows: ImportRow[] = [];
  const errors: string[] = [];
  const seenPhones = new Set<string>();
  const seenCodes = new Set<string>();

  for (let rowNumber = header.headerRow + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const record: Partial<Record<FieldKey, string>> = {};
    for (const [col, field] of header.mapping) {
      record[field] = cellText(row.getCell(col));
    }

    const name = record.name?.trim() || "";
    const phone = record.phone?.trim() || "";
    // 模板尾部常带整行空格式，按姓名/手机号都为空过滤
    if (!name && !phone) continue;
    if (!name || !phone) {
      errors.push(`第 ${rowNumber} 行：姓名或手机号为空`);
      continue;
    }
    if (name.length > 32) {
      errors.push(`第 ${rowNumber} 行：姓名超过 32 个字符`);
      continue;
    }
    if (phone.length > 32) {
      errors.push(`第 ${rowNumber} 行：手机号过长`);
      continue;
    }
    if (seenPhones.has(phone)) {
      errors.push(`第 ${rowNumber} 行：手机号 ${phone} 在文件中重复`);
      continue;
    }

    const shareCode = record.shareCode?.trim() || "";
    if (shareCode && !/^[A-Za-z0-9_-]{1,32}$/.test(shareCode)) {
      errors.push(`第 ${rowNumber} 行：分享码只能包含字母、数字、下划线和中划线`);
      continue;
    }
    if (shareCode && seenCodes.has(shareCode)) {
      errors.push(`第 ${rowNumber} 行：分享码 ${shareCode} 在文件中重复`);
      continue;
    }

    seenPhones.add(phone);
    if (shareCode) seenCodes.add(shareCode);
    rows.push({
      name,
      phone,
      shareCode: shareCode || undefined,
      teamName: record.teamName?.trim() || undefined,
      title: record.title?.trim() || undefined,
      employeeNo: record.employeeNo?.trim() || undefined,
    });

    if (rows.length > 200) {
      errors.push("单次最多导入 200 条，超出部分已截断");
      break;
    }
  }

  return { rows, errors };
}

/** 手机号后 8 位生成稳定分享码，便于重复导入时按同一编码去重 */
function baseShareCode(row: ImportRow, index: number) {
  const digits = row.phone.replace(/\D/g, "");
  if (digits.length >= 8) return `c${digits.slice(-8)}`;
  const employeeNo = (row.employeeNo || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 12);
  if (employeeNo) return `s${employeeNo}`;
  return `c${Date.now().toString(36)}${index}`;
}

function uniqueShareCode(base: string, used: Set<string>) {
  let code = base.slice(0, 32);
  let suffix = 2;
  while (used.has(code)) {
    const tail = `-${suffix}`;
    code = `${base.slice(0, 32 - tail.length)}${tail}`;
    suffix += 1;
  }
  used.add(code);
  return code;
}

/** E.2.5 批量导入：支持粘贴 CSV/TSV，也支持上传 .xlsx；逐行校验并跳过重复分享码/手机号 */
export async function POST(request: Request) {
  const guard = await guardApi("consultants");
  if (guard.error) return guard.error;

  const contentType = request.headers.get("content-type") || "";
  const fromFile = contentType.includes("multipart/form-data");
  let incoming: ImportRow[] = [];
  let rowErrors: string[] = [];

  if (fromFile) {
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File) || !file.size) {
      return NextResponse.json({ message: "请选择要导入的 Excel 文件" }, { status: 400 });
    }
    if (!/\.xlsx$/i.test(file.name)) {
      return NextResponse.json({ message: "只支持 .xlsx 格式，请用 Excel 另存为 .xlsx" }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ message: "文件过大，请控制在 5MB 以内" }, { status: 400 });
    }

    const workbook = new ExcelJS.Workbook();
    try {
      // ExcelJS 的 load 直接接受 ArrayBuffer（内部交给 JSZip 解析）
      await workbook.xlsx.load(await file.arrayBuffer());
    } catch {
      return NextResponse.json({ message: "无法读取该 Excel，请确认文件未损坏" }, { status: 400 });
    }
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      return NextResponse.json({ message: "Excel 中没有可读取的工作表" }, { status: 400 });
    }
    const parsed = parseSheet(sheet);
    incoming = parsed.rows;
    rowErrors = parsed.errors;
    if (!incoming.length) {
      return NextResponse.json(
        {
          message: parsed.errors[0] || "没有解析到有效行，请确认表头包含「姓名」「手机号码」",
          errors: parsed.errors.slice(0, 10),
        },
        { status: 400 },
      );
    }
  } else {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message || "导入数据不正确" },
        { status: 400 },
      );
    }
    incoming = parsed.data.rows;
  }

  if (incoming.length > 200) {
    return NextResponse.json({ message: "单次最多导入 200 条" }, { status: 400 });
  }

  const activity = await getCurrentActivity();
  if (!activity) {
    return NextResponse.json({ message: "活动未配置" }, { status: 404 });
  }

  // 先占用显式提供的分享码，避免自动生成的编码与同批次的其他行冲突
  const usedCodes = new Set(
    incoming
      .map((row) => row.shareCode?.trim())
      .filter((value): value is string => Boolean(value)),
  );
  const normalized = incoming.map((row, index) => {
    const shareCode = row.shareCode?.trim()
      ? row.shareCode.trim()
      : uniqueShareCode(baseShareCode(row, index), usedCodes);
    return { ...row, shareCode };
  });

  const existing = await prisma.consultant.findMany({
    where: {
      activityId: activity.id,
      OR: [
        { shareCode: { in: normalized.map((row) => row.shareCode) } },
        { phone: { in: normalized.map((row) => row.phone) } },
      ],
    },
    select: { shareCode: true, phone: true },
  });
  const takenCodes = new Set(existing.map((item) => item.shareCode));
  const takenPhones = new Set(existing.map((item) => item.phone));
  const accepted = normalized.filter(
    (row) => !takenCodes.has(row.shareCode) && !takenPhones.has(row.phone),
  );
  const duplicateSkipped = normalized.length - accepted.length;
  const skipped = duplicateSkipped + rowErrors.length;

  if (accepted.length) {
    await prisma.consultant.createMany({
      data: accepted.map((row) => ({
        activityId: activity.id,
        name: row.name,
        phone: row.phone,
        employeeNo: row.employeeNo || null,
        shareCode: row.shareCode,
        teamName: row.teamName || null,
        title: row.title || "置业顾问",
      })),
    });
  }

  await writeOperationLog(
    guard.session.sub,
    "consultant.import",
    `${fromFile ? "Excel" : "粘贴"}：新增 ${accepted.length}，跳过 ${skipped}`,
  );

  return NextResponse.json({
    ok: true,
    total: incoming.length + rowErrors.length,
    created: accepted.length,
    skipped,
    errors: rowErrors.slice(0, 10),
  });
}
