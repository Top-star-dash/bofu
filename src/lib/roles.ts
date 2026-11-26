import { PERMISSION_MODULES, type PermissionCode } from "@/lib/permissions";

/** 预置系统角色（seed / 迁移匹配用） */
export const SYSTEM_ROLES: Array<{
  code: string;
  name: string;
  description: string;
  permissions: PermissionCode[];
}> = [
  {
    code: "admin",
    name: "管理员",
    description: "除超级管理员外的全模块管理",
    permissions: PERMISSION_MODULES.map((item) => item.code),
  },
  {
    code: "ops",
    name: "运营",
    description: "活动、素材、奖品、顾问、线索与统计",
    permissions: [
      "activity",
      "assets",
      "prizes",
      "rules",
      "consultants",
      "leads",
      "stats",
      "settings",
    ],
  },
  {
    code: "redeemer",
    name: "核销员",
    description: "核销台与线索（客户奖品）",
    permissions: ["redeem", "leads"],
  },
  {
    code: "readonly",
    name: "只读",
    description: "数据统计与线索查看",
    permissions: ["stats", "leads"],
  },
];

type RolePermEdge = {
  permission: { code: string };
};

type UserRoleEdge = {
  role: {
    id: string;
    code: string;
    name: string;
    permissions: RolePermEdge[];
  };
};

/** 从用户多角色并集出有效权限 code */
export function permissionCodesFromUserRoles(
  userRoles: UserRoleEdge[],
): string[] {
  return [
    ...new Set(
      userRoles.flatMap((edge) =>
        edge.role.permissions.map((item) => item.permission.code),
      ),
    ),
  ];
}

/** 比较两个权限集合是否完全一致（顺序无关） */
export function samePermissionSet(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((code, index) => code === right[index]);
}

export function findMatchingSystemRoleCode(codes: string[]) {
  const hit = SYSTEM_ROLES.find((role) =>
    samePermissionSet(codes, [...role.permissions]),
  );
  return hit?.code ?? null;
}
