"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import LogoutButton from "@/components/admin/LogoutButton";

export type NavItem = { href: string; label: string };

const LINK_BASE =
  "block rounded-lg px-3 py-2.5 text-[14px] text-[#ffe9d2] no-underline hover:bg-[#b83224]";
const LINK_ACTIVE = "bg-[#b83224] font-bold";

function MenuIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
    >
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export default function AdminShellClient({
  name,
  username,
  items,
  current,
  children,
}: {
  name: string;
  username: string;
  items: NavItem[];
  current: string;
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    // 抽屉打开时锁住页面滚动，并支持 Esc 关闭
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <div className="admin-body admin-shell">
      {/* 桌面端固定侧边栏 */}
      <aside className="admin-side hidden min-[901px]:block">
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

      {/* 移动端抽屉导航 */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 min-[901px]:hidden">
          <button
            type="button"
            aria-label="关闭导航菜单"
            className="absolute inset-0 bg-black/45"
            onClick={() => setMenuOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="后台导航"
            className="absolute inset-y-0 left-0 flex w-[248px] max-w-[82vw] flex-col bg-[#8f281f] px-3.5 py-4 shadow-[0_20px_50px_#2f0f0a66]"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <strong className="text-[16px] text-[#ffe9d2]">
                福美城管理后台
              </strong>
              <button
                type="button"
                aria-label="关闭导航菜单"
                className="grid h-8 w-8 place-items-center rounded-lg bg-[#a63a2c] text-[#ffe9d2]"
                onClick={() => setMenuOpen(false)}
              >
                <CloseIcon />
              </button>
            </div>
            <nav className="flex flex-col gap-1 overflow-y-auto">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  aria-current={current === item.href ? "page" : undefined}
                  className={`${LINK_BASE} ${
                    current === item.href ? LINK_ACTIVE : ""
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="mt-auto pt-4 text-[12px] text-[#f0c3a8]">
              @{username}
            </div>
          </div>
        </div>
      )}

      <div className="admin-main">
        <div className="admin-top">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="打开导航菜单"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#fff2df] text-[#8f281f] min-[901px]:hidden"
            >
              <MenuIcon />
            </button>
            <div className="min-w-0">
              <strong>{name}</strong>
              <span className="ml-2 text-[#8a6c5b]">@{username}</span>
            </div>
          </div>
          <LogoutButton />
        </div>
        <div
          className={[
            "admin-content flex flex-col gap-4 !overflow-x-auto",
            "[&>*]:shrink-0",
            "[&>h2]:m-0 [&>h2]:text-lg [&>h2]:font-bold",
            "[&>h3]:m-0 [&>p]:m-0",
            "[&_.admin-card]:overflow-x-auto",
          ].join(" ")}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
