import Link from "next/link";
import LogoutButton from "@/components/admin/LogoutButton";
import type { AdminSession } from "@/lib/auth";
import { hasPermission, type PermissionCode } from "@/lib/permissions";

const NAV: Array<{ href: string; label: string; permission?: PermissionCode }> = [
  { href: "/admin", label: "数据概览" },
  { href: "/admin/redeem", label: "核销台", permission: "redeem" },
  { href: "/admin/leads", label: "线索管理", permission: "leads" },
  { href: "/admin/prizes", label: "奖品管理", permission: "prizes" },
  { href: "/admin/consultants", label: "顾问管理", permission: "consultants" },
  { href: "/admin/users", label: "用户权限", permission: "users" },
];

export default function AdminShell({
  session,
  current,
  children,
}: {
  session: AdminSession;
  current: string;
  children: React.ReactNode;
}) {
  const items = NAV.filter(
    (item) =>
      !item.permission ||
      hasPermission(session.permissions, item.permission, session.isSuperAdmin),
  );

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
