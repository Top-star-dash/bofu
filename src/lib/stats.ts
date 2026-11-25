import { prisma } from "@/lib/db";

export type StatsRange = { start?: Date | null; end?: Date | null };

export type FunnelRow = {
  consultantId: string;
  name: string;
  teamName: string | null;
  shareCode: string;
  customers: number;
  leads: number;
  draws: number;
  wins: number;
  redeemed: number;
};

export type StatsOverview = {
  customers: number;
  leads: number;
  draws: number;
  winners: number;
  redeemed: number;
  assists: number;
  conversion: number;
};

/** 解析后台筛选的日期区间（北京时间，起始含当天 0 点、截止含当天 23:59） */
export function parseRange(from?: string | null, to?: string | null): StatsRange {
  const start = from?.trim() ? new Date(`${from.trim()}T00:00:00+08:00`) : null;
  const end = to?.trim() ? new Date(`${to.trim()}T23:59:59.999+08:00`) : null;
  return { start, end };
}

function createdAtFilter(range: StatsRange) {
  if (!range.start && !range.end) return undefined;
  return {
    ...(range.start ? { gte: range.start } : {}),
    ...(range.end ? { lte: range.end } : {}),
  };
}

export async function getConsultantFunnel(
  activityId: string,
  range: StatsRange,
): Promise<FunnelRow[]> {
  const createdAt = createdAtFilter(range);

  const [consultants, customers, leads, draws] = await Promise.all([
    prisma.consultant.findMany({
      where: { activityId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: { id: true, name: true, teamName: true, shareCode: true },
    }),
    prisma.customer.findMany({
      where: { activityId, ...(createdAt ? { createdAt } : {}) },
      select: { id: true, consultantId: true },
    }),
    prisma.lead.findMany({
      where: { activityId, ...(createdAt ? { createdAt } : {}) },
      select: { id: true, customerId: true, consultantId: true },
    }),
    prisma.drawRecord.findMany({
      where: { activityId, ...(createdAt ? { createdAt } : {}) },
      select: { id: true, customerId: true, isWin: true, redeemStatus: true },
    }),
  ]);

  const customerOwner = new Map<string, string | null>();
  for (const customer of customers) {
    customerOwner.set(customer.id, customer.consultantId);
  }

  const buckets = new Map<string, FunnelRow>();
  for (const consultant of consultants) {
    buckets.set(consultant.id, {
      consultantId: consultant.id,
      name: consultant.name,
      teamName: consultant.teamName,
      shareCode: consultant.shareCode,
      customers: 0,
      leads: 0,
      draws: 0,
      wins: 0,
      redeemed: 0,
    });
  }

  const unassignedKey = "__unassigned__";
  const bucketOf = (consultantId: string | null | undefined) => {
    const key = consultantId || unassignedKey;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        consultantId: key,
        name: "未归属",
        teamName: null,
        shareCode: "-",
        customers: 0,
        leads: 0,
        draws: 0,
        wins: 0,
        redeemed: 0,
      };
      buckets.set(key, bucket);
    }
    return bucket;
  };

  for (const customer of customers) {
    bucketOf(customer.consultantId).customers += 1;
  }
  for (const lead of leads) {
    bucketOf(lead.consultantId ?? customerOwner.get(lead.customerId)).leads += 1;
  }
  for (const draw of draws) {
    const bucket = bucketOf(customerOwner.get(draw.customerId));
    bucket.draws += 1;
    if (draw.isWin) bucket.wins += 1;
    if (draw.redeemStatus === "REDEEMED") bucket.redeemed += 1;
  }

  const rows = [...buckets.values()].filter(
    (row) =>
      row.consultantId !== unassignedKey || row.customers + row.leads + row.draws > 0,
  );

  return rows;
}

export async function getStatsSummary(
  activityId: string,
  range: StatsRange,
): Promise<{ overview: StatsOverview; rows: FunnelRow[]; assists: number }> {
  const createdAt = createdAtFilter(range);

  const [customers, leads, draws, winners, redeemed, assists] = await Promise.all([
    prisma.customer.count({
      where: { activityId, ...(createdAt ? { createdAt } : {}) },
    }),
    prisma.lead.count({
      where: { activityId, ...(createdAt ? { createdAt } : {}) },
    }),
    prisma.drawRecord.count({
      where: { activityId, ...(createdAt ? { createdAt } : {}) },
    }),
    prisma.drawRecord.count({
      where: { activityId, isWin: true, ...(createdAt ? { createdAt } : {}) },
    }),
    prisma.drawRecord.count({
      where: {
        activityId,
        redeemStatus: "REDEEMED",
        ...(createdAt ? { createdAt } : {}),
      },
    }),
    prisma.assistRecord.count({
      where: { valid: true, ...(createdAt ? { createdAt } : {}) },
    }),
  ]);

  const rows = await getConsultantFunnel(activityId, range);

  return {
    overview: {
      customers,
      leads,
      draws,
      winners,
      redeemed,
      assists,
      conversion: customers ? Math.round((leads / customers) * 1000) / 10 : 0,
    },
    rows,
    assists,
  };
}

export type StockWarning = {
  id: string;
  name: string;
  level: string;
  stock: number;
  remainStock: number;
  ratio: number;
};

/** G.6 库存预警：剩余不足 20% 或已发完的奖品 */
export async function getStockWarnings(activityId: string): Promise<StockWarning[]> {
  const prizes = await prisma.prize.findMany({
    where: { activityId, enabled: true, isFallback: false },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, level: true, stock: true, remainStock: true },
  });

  return prizes
    .map((prize) => ({
      ...prize,
      ratio: prize.stock > 0 ? prize.remainStock / prize.stock : 0,
    }))
    .filter((prize) => prize.remainStock <= 0 || prize.ratio <= 0.2)
    .sort((a, b) => a.ratio - b.ratio);
}
