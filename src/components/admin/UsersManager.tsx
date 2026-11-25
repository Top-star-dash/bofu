"use client";

import { FormEvent, Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { PERMISSION_MODULES } from "@/lib/permissions";

type UserRow = {
  id: string;
  username: string;
  name: string;
  phone: string;
  isSuperAdmin: boolean;
  status: string;
  permissions: string[];
  newPassword?: string;
};

export default function UsersManager({
  users,
  currentUserId,
}: {
  users: Omit<UserRow, "newPassword">[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<UserRow[]>(users);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function update(id: string, patch: Partial<UserRow>) {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function togglePermission(id: string, code: string, checked: boolean) {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              permissions: checked
                ? [...row.permissions.filter((item) => item !== code), code]
                : row.permissions.filter((item) => item !== code),
            }
          : row,
      ),
    );
  }

  async function save(row: UserRow) {
    setError("");
    setMessage("");
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: row.id,
        name: row.name,
        phone: row.phone || null,
        status: row.status,
        permissions: row.permissions,
        ...(row.newPassword ? { password: row.newPassword } : {}),
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.message || "保存失败");
      return;
    }
    update(row.id, { newPassword: "" });
    setMessage(`已保存：${row.username}`);
    router.refresh();
  }

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
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
    formEl.reset();
    router.refresh();
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {error && <p className="error-text">{error}</p>}
      {message && <p className="ok-text">{message}</p>}

      <div className="admin-card">
        <h3 style={{ marginTop: 0 }}>后台用户</h3>
        <table className="admin-table">
          <thead>
            <tr>
              <th>账号</th>
              <th>姓名</th>
              <th>手机号</th>
              <th>状态</th>
              <th>权限</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((user) => (
              <Fragment key={user.id}>
                <tr>
                  <td>{user.username}</td>
                  <td>
                    <input
                      className="admin-inline-input"
                      value={user.name}
                      onChange={(event) => update(user.id, { name: event.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="admin-inline-input"
                      value={user.phone}
                      onChange={(event) => update(user.id, { phone: event.target.value })}
                    />
                  </td>
                  <td>
                    <select
                      className="admin-inline-input"
                      value={user.status}
                      onChange={(event) => update(user.id, { status: event.target.value })}
                    >
                      <option value="ACTIVE">启用</option>
                      <option value="DISABLED">停用</option>
                    </select>
                  </td>
                  <td>
                    {user.isSuperAdmin
                      ? "全部"
                      : user.permissions.length
                        ? user.permissions.join("、")
                        : "无"}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="admin-btn secondary"
                      onClick={() => setExpanded(expanded === user.id ? null : user.id)}
                    >
                      {expanded === user.id ? "收起" : "编辑"}
                    </button>
                  </td>
                </tr>
                {expanded === user.id && (
                  <tr className="detail-row">
                    <td colSpan={6}>
                      <div className="perm-grid">
                        {PERMISSION_MODULES.map((item) => (
                          <label key={item.code}>
                            <input
                              type="checkbox"
                              checked={
                                user.isSuperAdmin || user.permissions.includes(item.code)
                              }
                              disabled={user.isSuperAdmin}
                              onChange={(event) =>
                                togglePermission(user.id, item.code, event.target.checked)
                              }
                            />
                            {item.name}
                          </label>
                        ))}
                      </div>
                      <div className="admin-field-row" style={{ marginTop: 12 }}>
                        <label>
                          重置密码（留空不改）
                          <input
                            type="password"
                            minLength={8}
                            value={user.newPassword ?? ""}
                            onChange={(event) =>
                              update(user.id, { newPassword: event.target.value })
                            }
                            autoComplete="new-password"
                          />
                        </label>
                        <button
                          type="button"
                          className="admin-btn"
                          onClick={() => save(user)}
                        >
                          保存用户
                        </button>
                      </div>
                      {user.id === currentUserId && (
                        <p className="redeem-hint">这是当前登录账号，不能停用。</p>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
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
          <div className="admin-actions">
            <button type="submit">创建用户</button>
          </div>
        </form>
      </div>
    </div>
  );
}
