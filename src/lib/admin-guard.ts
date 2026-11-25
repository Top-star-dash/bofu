import { NextResponse } from "next/server";
import { getAdminSession, type AdminSession } from "@/lib/auth";
import { hasPermission, type PermissionCode } from "@/lib/permissions";

type GuardResult =
  | { session: AdminSession; error?: undefined }
  | { session?: undefined; error: NextResponse };

/** 接口统一鉴权：未登录 401，无权限 403 */
export async function guardApi(permission?: PermissionCode): Promise<GuardResult> {
  const session = await getAdminSession();
  if (!session) {
    return {
      error: NextResponse.json({ message: "请先登录后台" }, { status: 401 }),
    };
  }
  if (permission && !hasPermission(session.permissions, permission, session.isSuperAdmin)) {
    return {
      error: NextResponse.json({ message: "没有该模块的操作权限" }, { status: 403 }),
    };
  }
  return { session };
}

/** 页面统一鉴权：无权限时跳到后台首页 */
export function canUse(session: AdminSession, permission: PermissionCode) {
  return hasPermission(session.permissions, permission, session.isSuperAdmin);
}
