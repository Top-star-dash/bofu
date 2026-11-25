import Link from "next/link";
import LogoutButton from "@/components/admin/LogoutButton";
import type { AdminSession } from "@/lib/auth";
import { hasPermission, type PermissionCode } from "@/lib/permissions";

const NAV: Array<{ href: string; label: string; permission?: PermissionCode }> = [
  { href: "/admin", label: "数据概览", permission: "stats" },
  { href: "/admin/settings", label: "活动配置", permission: "activity" },
  { href: "/admin/prizes", label: "奖品管理", permission: "prizes" },
  { href: "/admin/consultants", label: "顾问管理", permission: "consultants" },
  { href: "/admin/assets", label: "素材管理", permission: "assets" },
  { href: "/admin/leads", label: "线索管理", permission: "leads" },
  { href: "/admin/redeem", label: "核销台", permission: "redeem" },
  { href: "/admin/stats", label: "数据统计", permission: "stats" },
  { href: "/admin/users", label: "用户权限", permission: "users" },
];

function allowed(item: (typeof NAV)[number], session: AdminSession) {
  return (
    !item.permission ||
    hasPermission(session.permissions, item.permission, session.isSuperAdmin)
  );
}

/** 登录后第一个有权限的页面，用于无权限时兜底跳转，避免在 /admin 打转 */
export function firstAllowedHref(session: AdminSession) {
  const item = NAV.find(
    (entry) => entry.href !== "/admin" && allowed(entry, session),
  );
  return item?.href ?? null;
}

export default function AdminShell({
  session,
  current,
  children,
}: {
  session: AdminSession;
  current: string;
  children: React.ReactNode;
}) {
  const items = NAV.filter((item) => allowed(item, session));

  return (
    <div className="admin-body admin-shell">
      <aside className="admin-side">
        <h1>福美城管理后台</h1>
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current === item.href ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </aside>
      <div className="admin-main">
        <div className="admin-top">
          <div>
            <strong>{session.name}</strong>
            <span style={{ marginLeft: 8, color: "#8a6c5b" }}>
              @{session.username}
            </span>
          </div>
          <LogoutButton />
        </div>
        {children}
      </div>
    </div>
  );
}
