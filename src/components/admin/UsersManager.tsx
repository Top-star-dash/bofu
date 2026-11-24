"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PERMISSION_MODULES } from "@/lib/permissions";

type UserRow = {
  id: string;
  username: string;
  name: string;
  phone: string | null;
  isSuperAdmin: boolean;
  status: string;
  permissions: string[];
};

export default function UsersManager({ users }: { users: UserRow[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const permissions = PERMISSION_MODULES.map((item) => item.code).filter(
      (code) => form.get(`perm_${code}`) === "on",
    );

    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: form.get("username"),
        name: form.get("name"),
        phone: form.get("phone") || undefined,
        password: form.get("password"),
        permissions,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.message || "创建失败");
      return;
    }
    setMessage("用户已创建");
    event.currentTarget.reset();
    router.refresh();
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div className="admin-card">
        <h3 style={{ marginTop: 0 }}>后台用户</h3>
        <table className="admin-table">
          <thead>
            <tr>
              <th>账号</th>
              <th>姓名</th>
              <th>权限</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.username}</td>
                <td>
                  {user.name}
                  {user.isSuperAdmin ? "（超管）" : ""}
                </td>
                <td>
                  {user.isSuperAdmin
                    ? "全部"
                    : user.permissions.join("、") || "无"}
                </td>
                <td>{user.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="admin-card">
        <h3 style={{ marginTop: 0 }}>新增用户并赋予权限</h3>
        <form className="admin-form" onSubmit={onCreate}>
          <label>
            登录账号
            <input name="username" required minLength={3} />
          </label>
          <label>
            姓名
            <input name="name" required />
          </label>
          <label>
            手机号
            <input name="phone" />
          </label>
          <label>
            初始密码
            <input name="password" type="password" required minLength={8} />
          </label>
          <div>
            <strong>权限模块</strong>
            <div className="perm-grid" style={{ marginTop: 8 }}>
              {PERMISSION_MODULES.map((item) => (
                <label key={item.code}>
                  <input type="checkbox" name={`perm_${item.code}`} />
                  {item.name}
                </label>
              ))}
            </div>
          </div>
          {error && <p className="error-text">{error}</p>}
          {message && <p>{message}</p>}
          <div className="admin-actions">
            <button type="submit">创建用户</button>
          </div>
        </form>
      </div>
    </div>
  );
}
