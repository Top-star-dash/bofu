export const PERMISSION_MODULES = [
  { code: "activity", name: "活动配置" },
  { code: "assets", name: "素材管理" },
  { code: "prizes", name: "奖品管理" },
  { code: "rules", name: "规则管理" },
  { code: "consultants", name: "顾问管理" },
  { code: "leads", name: "线索管理" },
  { code: "redeem", name: "核销管理" },
  { code: "stats", name: "数据统计" },
  { code: "users", name: "用户权限" },
  { code: "settings", name: "系统设置" },
] as const;

export type PermissionCode = (typeof PERMISSION_MODULES)[number]["code"];

export function hasPermission(
  codes: string[],
  required: PermissionCode,
  isSuperAdmin = false,
) {
  if (isSuperAdmin) return true;
  return codes.includes(required);
}
