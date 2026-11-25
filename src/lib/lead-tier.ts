import type { LeadTier } from "@/generated/prisma/enums";

type TierRule = {
  tierAStaySec: number;
  tierBStaySec: number;
};

/**
 * G.5 分层规则：停留时长达到 A 阈值记为 A，达到 B 阈值记为 B，其余 C。
 * 阈值在后台「活动配置」可改，0 视为不启用该档。
 */
export function computeLeadTier(staySec: number, rule: TierRule): LeadTier {
  const stay = Math.max(0, staySec || 0);
  if (rule.tierAStaySec > 0 && stay >= rule.tierAStaySec) return "A";
  if (rule.tierBStaySec > 0 && stay >= rule.tierBStaySec) return "B";
  return "C";
}
