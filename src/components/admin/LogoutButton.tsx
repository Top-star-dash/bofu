"use client";

export default function LogoutButton() {
  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    // 硬跳转，避免软导航仍带着已清 cookie 前的后台缓存
    window.location.assign("/admin/login");
  }

  return (
    <button className="admin-btn secondary" type="button" onClick={logout}>
      退出登录
    </button>
  );
}
