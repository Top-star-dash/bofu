"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ImageField from "./ImageField";

export type AssetRow = {
  key: string;
  id?: string;
  type: "property" | "highlight";
  title: string;
  subtitle: string;
  imageUrl: string;
  linkUrl: string;
  sortOrder: number;
  enabled: boolean;
};

function blank(index: number): AssetRow {
  return {
    key: `new-${Date.now()}-${index}`,
    type: "property",
    title: "",
    subtitle: "",
    imageUrl: "",
    linkUrl: "",
    sortOrder: index + 1,
    enabled: true,
  };
}

export default function AssetManager({ initial }: { initial: AssetRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<AssetRow[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function update(key: string, patch: Partial<AssetRow>) {
    setRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  async function save() {
    const invalid = rows.find((row) => !row.imageUrl.trim());
    if (invalid) {
      setError("每个素材都需要填写图片地址");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/assets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assets: rows.map((row) => ({
            id: row.id,
            type: row.type,
            title: row.title,
            subtitle: row.subtitle,
            imageUrl: row.imageUrl,
            linkUrl: row.linkUrl,
            sortOrder: Number(row.sortOrder) || 0,
            enabled: row.enabled,
          })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.message || "保存失败");
        return;
      }
      setMessage("素材已保存");
      router.refresh();
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: AssetRow) {
    if (!row.id) {
      setRows((prev) => prev.filter((item) => item.key !== row.key));
      return;
    }
    const response = await fetch("/api/admin/assets", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.message || "删除失败");
      return;
    }
    setRows((prev) => prev.filter((item) => item.key !== row.key));
    router.refresh();
  }

  return (
    <div className="admin-card">
      <div className="admin-toolbar" style={{ marginBottom: 8 }}>
        <button
          type="button"
          className="admin-btn secondary"
          onClick={() => setRows((prev) => [...prev, blank(prev.length)])}
        >
          新增素材
        </button>
        <button type="button" className="admin-btn" onClick={save} disabled={busy}>
          {busy ? "保存中…" : "保存全部"}
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}
      {message && <p className="ok-text">{message}</p>}

      <div className="asset-list">
        {rows.map((row) => (
          <article className="asset-card" key={row.key}>
            <div className="admin-field-row">
              <label>
                类型
                <select
                  value={row.type}
                  onChange={(event) =>
                    update(row.key, { type: event.target.value as AssetRow["type"] })
                  }
                >
                  <option value="property">楼盘社区</option>
                  <option value="highlight">项目亮点</option>
                </select>
              </label>
              <label>
                标题
                <input
                  value={row.title}
                  onChange={(event) => update(row.key, { title: event.target.value })}
                />
              </label>
              <label>
                排序
                <input
                  type="number"
                  min={0}
                  value={row.sortOrder}
                  onChange={(event) =>
                    update(row.key, { sortOrder: Number(event.target.value) || 0 })
                  }
                />
              </label>
              <label className="checkbox-label">
                启用
                <input
                  type="checkbox"
                  checked={row.enabled}
                  onChange={(event) => update(row.key, { enabled: event.target.checked })}
                />
              </label>
            </div>
            <label className="stacked">
              说明
              <input
                value={row.subtitle}
                onChange={(event) => update(row.key, { subtitle: event.target.value })}
              />
            </label>
            <ImageField
              label="图片"
              value={row.imageUrl}
              onChange={(value) => update(row.key, { imageUrl: value })}
            />
            <div className="admin-field-row">
              <label>
                跳转链接（可空）
                <input
                  value={row.linkUrl}
                  onChange={(event) => update(row.key, { linkUrl: event.target.value })}
                  placeholder="https://..."
                />
              </label>
              <button
                type="button"
                className="admin-btn secondary"
                onClick={() => remove(row)}
              >
                删除
              </button>
            </div>
          </article>
        ))}
        {!rows.length && <p className="redeem-hint">还没有素材</p>}
      </div>
    </div>
  );
}
