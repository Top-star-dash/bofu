"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Notice = {
  id: string;
  content: string;
  sortOrder: number;
  enabled: boolean;
};

export default function NoticeManager({ notices }: { notices: Notice[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Notice[]>(notices);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function update(id: string, patch: Partial<Notice>) {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  async function save(row: Notice) {
    setError("");
    setMessage("");
    const response = await fetch("/api/admin/notices", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.message || "保存失败");
      return;
    }
    setMessage("公告已更新");
    router.refresh();
  }

  async function remove(id: string) {
    setError("");
    setMessage("");
    const response = await fetch("/api/admin/notices", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.message || "删除失败");
      return;
    }
    setRows((prev) => prev.filter((row) => row.id !== id));
    router.refresh();
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    setMessage("");
    const response = await fetch("/api/admin/notices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: form.get("content"),
        sortOrder: Number(form.get("sortOrder") || 0),
        enabled: true,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.message || "新增失败");
      return;
    }
    event.currentTarget.reset();
    setMessage("公告已新增");
    router.refresh();
  }

  return (
    <div className="admin-card">
      <h3 style={{ marginTop: 0 }}>活动公告（H5 顶部轮播）</h3>
      <table className="admin-table">
        <thead>
          <tr>
            <th style={{ width: "50%" }}>内容</th>
            <th style={{ width: 80 }}>排序</th>
            <th style={{ width: 70 }}>启用</th>
            <th style={{ width: 150 }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <input
                  className="admin-inline-input"
                  value={row.content}
                  onChange={(event) => update(row.id, { content: event.target.value })}
                />
              </td>
              <td>
                <input
                  className="admin-inline-input"
                  type="number"
                  min={0}
                  value={row.sortOrder}
                  onChange={(event) =>
                    update(row.id, { sortOrder: Number(event.target.value) || 0 })
                  }
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  checked={row.enabled}
                  onChange={(event) => update(row.id, { enabled: event.target.checked })}
                />
              </td>
              <td>
                <button type="button" className="admin-btn" onClick={() => save(row)}>
                  保存
                </button>{" "}
                <button
                  type="button"
                  className="admin-btn secondary"
                  onClick={() => remove(row.id)}
                >
                  删除
                </button>
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={4}>还没有公告</td>
            </tr>
          )}
        </tbody>
      </table>

      <form className="admin-form inline-form" onSubmit={create}>
        <label>
          新增公告内容
          <input name="content" required maxLength={200} />
        </label>
        <label>
          排序
          <input name="sortOrder" type="number" min={0} defaultValue={rows.length + 1} />
        </label>
        <button type="submit">新增公告</button>
      </form>

      {error && <p className="error-text">{error}</p>}
      {message && <p className="ok-text">{message}</p>}
    </div>
  );
}
