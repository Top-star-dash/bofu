import type { Prisma } from "@/generated/prisma/client";

export type LeadQueryInput = {
  q?: string | null;
  tier?: string | null;
  consultantId?: string | null;
  from?: string | null;
  to?: string | null;
};

export const LEAD_TIERS = ["A", "B", "C"] as const;

export function buildLeadWhere(input: LeadQueryInput): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = {};
  const q = input.q?.trim();
  const tier = input.tier?.trim();

  if (q) {
    where.OR = [{ name: { contains: q } }, { phone: { contains: q } }];
  }
  if (tier === "A" || tier === "B" || tier === "C") {
    where.tier = tier;
  }
  if (input.consultantId?.trim()) {
    where.consultantId = input.consultantId.trim();
  }

  const from = input.from?.trim();
  const to = input.to?.trim();
  if (from || to) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (from) createdAt.gte = new Date(`${from}T00:00:00+08:00`);
    if (to) createdAt.lte = new Date(`${to}T23:59:59.999+08:00`);
    where.createdAt = createdAt;
  }

  return where;
}
