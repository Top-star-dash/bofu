"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const LOGIN_LOGOS = [
  { src: "/activity/logo-future.png", alt: "未来社区" },
  { src: "/activity/logo-fumei.png", alt: "博富·福美城" },
];

export default function AdminLoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: form.get("username"),
        password: form.get("password"),
      }),
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(data.message || "登录失败");
      return;
    }
    router.replace("/admin");
    router.refresh();
  }

  return (
    <div className="admin-login">
      <div className="admin-login-panel">
        <aside className="admin-login-brand" aria-label="品牌标识">
          <div className="logo-stack">
            {LOGIN_LOGOS.map((logo) => (
              <img key={logo.src} src={logo.src} alt={logo.alt} />
            ))}
          </div>
          <div>
            <h1>博富·福美城</h1>
            <p>营销互动抽奖与裂变获客管理系统</p>
          </div>
        </aside>

        <form className="admin-login-form" onSubmit={onSubmit}>
          <h2>后台登录</h2>
          <p>请输入管理员账号与密码</p>
          <label>
            账号
            <input
              name="username"
              required
              autoComplete="username"
              placeholder="请输入账号"
            />
          </label>
          <label>
            密码
            <input
              name="password"
              required
              type="password"
              autoComplete="current-password"
              placeholder="请输入密码"
            />
          </label>
          {error && <p className="error-text">{error}</p>}
          <button type="submit" disabled={loading}>
            {loading ? "登录中…" : "登录"}
          </button>
        </form>
      </div>
    </div>
  );
}
