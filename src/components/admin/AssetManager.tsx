"use client";

import { ChangeEvent, useState } from "react";
import { useRouter } from "next/navigation";
import PreviewableImage from "./PreviewableImage";

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

const inputCls =
  "w-full min-w-[90px] rounded border border-[#e4c69f] bg-[#fffaf3] px-2 py-1 text-[12px]";

export default function AssetManager({ initial }: { initial: AssetRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<AssetRow[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  function update(key: string, patch: Partial<AssetRow>) {
    setRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  async function upload(row: AssetRow, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploadingKey(row.key);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/admin/upload", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message || "上传失败");
        return;
      }
      update(row.key, { imageUrl: data.url });
      setMessage(`已上传：${row.title || "素材"}`);
    } catch {
      setError("上传失败，请检查网络");
    } finally {
      setUploadingKey(null);
    }
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
    <div className="flex flex-col gap-4">
      <div className="admin-toolbar">
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
        <span className="text-[12px] text-[#8a6c5b]">
          缩略图点击放大；每行可单独上传图片。
        </span>
      </div>

      {error && <p className="error-text">{error}</p>}
      {message && <p className="ok-text text-[13px] font-bold text-[#2f6b3a]">{message}</p>}

      <div className="overflow-x-auto rounded-xl border border-[#f0e2d2] bg-white">
        <table className="admin-table min-w-[1180px]">
          <thead>
            <tr>
              <th className="w-[72px]">图片</th>
              <th className="w-[60px]">序号</th>
              <th className="w-[110px]">类型</th>
              <th className="w-[140px]">标题</th>
              <th className="w-[200px]">跳转链接</th>
              <th className="w-[170px]">说明</th>
              <th className="w-[70px]">排序</th>
              <th className="w-[70px]">启用</th>
              <th className="w-[130px]">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.key}>
                <td>
                  {row.imageUrl ? (
                    <PreviewableImage
                      src={row.imageUrl}
                      alt={row.title || "素材缩略图"}
                      title={row.title || "素材预览"}
                      linkUrl={row.linkUrl || undefined}
                      className="h-14 w-14 rounded object-cover"
                    />
                  ) : (
                    <span className="text-[12px] text-[#9b7d64]">无图</span>
                  )}
                </td>
                <td>{index + 1}</td>
                <td>
                  <select
                    className={inputCls}
                    value={row.type}
                    onChange={(event) =>
                      update(row.key, { type: event.target.value as AssetRow["type"] })
                    }
                  >
                    <option value="property">楼盘社区</option>
                    <option value="highlight">项目亮点</option>
                  </select>
                </td>
                <td>
                  <input
                    className={inputCls}
                    value={row.title}
                    onChange={(event) => update(row.key, { title: event.target.value })}
                  />
                </td>
                <td>
                  <div className="flex items-center gap-1">
                    <input
                      className={inputCls}
                      value={row.linkUrl}
                      onChange={(event) => update(row.key, { linkUrl: event.target.value })}
                      placeholder="https://..."
                    />
                    {row.linkUrl ? (
                      <a
                        href={row.linkUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 text-[14px] text-[#b83224]"
                        title="打开链接"
                      >
                        ↗
                      </a>
                    ) : null}
                  </div>
                </td>
                <td>
                  <input
                    className={inputCls}
                    value={row.subtitle}
                    onChange={(event) => update(row.key, { subtitle: event.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="w-16 rounded border border-[#e4c69f] bg-[#fffaf3] px-2 py-1 text-[12px]"
                    type="number"
                    min={0}
                    value={row.sortOrder}
                    onChange={(event) =>
                      update(row.key, { sortOrder: Number(event.target.value) || 0 })
                    }
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(event) => update(row.key, { enabled: event.target.checked })}
                  />
                </td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    <label className="cursor-pointer rounded bg-[#ffe6b8] px-2 py-1 text-[12px] font-bold text-[#8f281f]">
                      {uploadingKey === row.key ? "上传中…" : "上传"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={(event) => upload(row, event)}
                      />
                    </label>
                    <button
                      type="button"
                      className="rounded bg-[#f3e4d6] px-2 py-1 text-[12px] font-bold text-[#8f281f]"
                      onClick={() => remove(row)}
                    >
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={9}>还没有素材</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
