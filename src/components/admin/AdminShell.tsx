import Link from "next/link";
import LogoutButton from "@/components/admin/LogoutButton";
import type { AdminSession } from "@/lib/auth";

const NAV = [
  { href: "/admin", label: "数据概览" },
  { href: "/admin/users", label: "用户权限" },
  { href: "/admin/prizes", label: "奖品管理" },
  { href: "/admin/consultants", label: "顾问管理" },
  { href: "/admin/leads", label: "线索管理" },
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
  return (
    <div className="admin-body admin-shell">
      <aside className="admin-side">
        <h1>福美城管理后台</h1>
        {NAV.map((item) => (
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
