"use client";

import { FormEvent, Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import ImageField from "./ImageField";
import PreviewableImage from "./PreviewableImage";

export type ConsultantRow = {
  id: string;
  name: string;
  phone: string;
  employeeNo: string;
  teamName: string;
  title: string;
  avatarUrl: string;
  qrcodeUrl: string;
  intro: string;
  message: string;
  openid: string;
  shareCode: string;
  isDefault: boolean;
  enabled: boolean;
};

export default function ConsultantManager({
  initial,
  origin,
}: {
  initial: ConsultantRow[];
  origin: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<ConsultantRow[]>(initial);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tab, setTab] = useState<"list" | "create" | "import">("list");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [importing, setImporting] = useState(false);
  const [importIssues, setImportIssues] = useState<string[]>([]);
  const [qrRow, setQrRow] = useState<ConsultantRow | null>(null);

  function update(id: string, patch: Partial<ConsultantRow>) {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  async function save(row: ConsultantRow) {
    setError("");
    setMessage("");
    const response = await fetch("/api/admin/consultants", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: row.id,
        name: row.name,
        phone: row.phone,
        employeeNo: row.employeeNo || null,
        teamName: row.teamName || null,
        title: row.title || "置业顾问",
        avatarUrl: row.avatarUrl || null,
        qrcodeUrl: row.qrcodeUrl || null,
        intro: row.intro || null,
        message: row.message || null,
        openid: row.openid || null,
        shareCode: row.shareCode,
        isDefault: row.isDefault,
        enabled: row.enabled,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.message || "保存失败");
      return;
    }
    setMessage(`已保存：${row.name}`);
    router.refresh();
  }

  async function remove(row: ConsultantRow) {
    setError("");
    setMessage("");
    if (!window.confirm(`确定删除顾问「${row.name}」？已有客户或线索时无法删除。`)) {
      return;
    }
    const response = await fetch("/api/admin/consultants", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.message || "删除失败");
      return;
    }
    setRows((prev) => prev.filter((item) => item.id !== row.id));
    router.refresh();
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    setError("");
    setMessage("");
    const response = await fetch("/api/admin/consultants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        phone: form.get("phone"),
        shareCode: form.get("shareCode") || undefined,
        title: form.get("title") || undefined,
        teamName: form.get("teamName") || undefined,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.message || "新增失败");
      return;
    }
    formEl.reset();
    setMessage("顾问已新增");
    router.refresh();
  }

  async function importRows(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = String(form.get("rows") || "");
    const parsed = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split(/[,\t，]/).map((cell) => cell.trim()))
      .filter((cells) => cells.length >= 3)
      .map((cells) => ({
        name: cells[0],
        phone: cells[1],
        shareCode: cells[2],
        teamName: cells[3] || undefined,
        title: cells[4] || undefined,
      }));

    if (!parsed.length) {
      setError("没有解析到有效行，格式：姓名,电话,分享码,团队");
      return;
    }

    setError("");
    setMessage("");
    const response = await fetch("/api/admin/consultants/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: parsed }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.message || "导入失败");
      return;
    }
    setMessage(`导入完成：新增 ${data.created} 条，跳过 ${data.skipped} 条重复分享码`);
    event.currentTarget.reset();
    router.refresh();
  }

  async function importExcel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) {
      setError("请选择要导入的 .xlsx 文件");
      return;
    }

    setError("");
    setMessage("");
    setImportIssues([]);
    setImporting(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/admin/consultants/import", {
        method: "POST",
        body,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.message || "导入失败");
        setImportIssues(Array.isArray(data.errors) ? data.errors : []);
        return;
      }
      const issues: string[] = Array.isArray(data.errors) ? data.errors : [];
      setMessage(
        `导入完成：新增 ${data.created} 条，跳过 ${data.skipped} 条（重复分享码/手机号或格式问题）`,
      );
      setImportIssues(issues);
      formEl.reset();
      router.refresh();
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setImporting(false);
    }
  }

  function promoLink(code: string) {
    return `${origin}/?c=${code}`;
  }

  function qrSrc(code: string, download = false) {
    const query = `code=${encodeURIComponent(code)}&format=png${download ? "&download=1" : ""}`;
    return `/api/admin/consultants/qrcode?${query}`;
  }

  function copyLink(code: string) {
    const link = promoLink(code);
    const done = () => setMessage(`推广链接已复制：${link}`);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(link).then(done).catch(() => setError(link));
      return;
    }
    // 非安全上下文（http）下 clipboard 不可用，退化为临时文本框
    const input = document.createElement("textarea");
    input.value = link;
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    try {
      document.execCommand("copy");
      done();
    } catch {
      setError(link);
    }
    document.body.removeChild(input);
  }

  const tabs = [
    { key: "list", label: "顾问列表" },
    { key: "create", label: "新增顾问" },
    { key: "import", label: "批量导入" },
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex flex-wrap gap-2 border-b border-[#ead7c2] pb-3">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`rounded-lg px-3 py-2 text-[13px] font-bold ${
              tab === item.key
                ? "bg-[#b83224] text-white"
                : "bg-[#fff2df] text-[#8f281f] hover:bg-[#ffe6b8]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>
      {error && <p className="error-text">{error}</p>}
      {message && <p className="ok-text">{message}</p>}

      {tab === "list" && (
      <div className="admin-card">
        <h3 style={{ marginTop: 0 }}>顾问列表</h3>
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>姓名</th>
                <th>电话</th>
                <th>分享码</th>
                <th>团队</th>
                <th>默认</th>
                <th>启用</th>
                <th>推广</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Fragment key={row.id}>
                  <tr>
                    <td>
                      <input
                        className="admin-inline-input"
                        value={row.name}
                        onChange={(event) => update(row.id, { name: event.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className="admin-inline-input"
                        value={row.phone}
                        onChange={(event) => update(row.id, { phone: event.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className="admin-inline-input"
                        value={row.shareCode}
                        onChange={(event) =>
                          update(row.id, { shareCode: event.target.value })
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="admin-inline-input"
                        value={row.teamName}
                        onChange={(event) =>
                          update(row.id, { teamName: event.target.value })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={row.isDefault}
                        onChange={(event) =>
                          update(row.id, { isDefault: event.target.checked })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={row.enabled}
                        onChange={(event) =>
                          update(row.id, { enabled: event.target.checked })
                        }
                      />
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button
                          type="button"
                          className="admin-btn secondary"
                          style={{ whiteSpace: "nowrap", padding: "6px 10px", fontSize: 12 }}
                          onClick={() => copyLink(row.shareCode)}
                        >
                          复制链接
                        </button>
                        <button
                          type="button"
                          className="admin-btn secondary"
                          style={{ whiteSpace: "nowrap", padding: "6px 10px", fontSize: 12 }}
                          onClick={() => setQrRow(row)}
                        >
                          链接二维码
                        </button>
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="admin-btn"
                        onClick={() => save(row)}
                      >
                        保存
                      </button>{" "}
                      <button
                        type="button"
                        className="admin-btn secondary"
                        onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                      >
                        {expanded === row.id ? "收起" : "详情"}
                      </button>{" "}
                      <button
                        type="button"
                        className="admin-btn secondary"
                        onClick={() => remove(row)}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                  {expanded === row.id && (
                    <tr className="detail-row">
                      <td colSpan={8}>
                        <div className="consultant-detail">
                          <div className="consultant-detail-grid">
                            <label>
                              职衔
                              <input
                                value={row.title}
                                maxLength={32}
                                placeholder="如：置业顾问"
                                onChange={(event) =>
                                  update(row.id, { title: event.target.value })
                                }
                              />
                            </label>
                            <label>
                              工号
                              <input
                                value={row.employeeNo}
                                maxLength={32}
                                placeholder="选填，如：A012"
                                onChange={(event) =>
                                  update(row.id, { employeeNo: event.target.value })
                                }
                              />
                            </label>
                            <label className="span-full">
                              顾问本人 OpenID（用于过滤销售自点）
                              <input
                                value={row.openid}
                                maxLength={64}
                                placeholder="选填，顾问微信 OpenID"
                                onChange={(event) =>
                                  update(row.id, { openid: event.target.value })
                                }
                              />
                            </label>
                          </div>
                          <div className="consultant-detail-images">
                            <ImageField
                              label="顾问头像"
                              value={row.avatarUrl}
                              onChange={(value) =>
                                update(row.id, { avatarUrl: value })
                              }
                              hint="头像地址，或点击上传"
                            />
                            <ImageField
                              label="微信二维码（客户加微信用）"
                              value={row.qrcodeUrl}
                              onChange={(value) =>
                                update(row.id, { qrcodeUrl: value })
                              }
                              hint="微信二维码图片，或点击上传"
                            />
                          </div>
                          <div className="consultant-detail-text">
                            <label>
                              介绍
                              <textarea
                                value={row.intro}
                                maxLength={500}
                                rows={3}
                                placeholder="展示在顾问弹窗的自我介绍"
                                onChange={(event) =>
                                  update(row.id, { intro: event.target.value })
                                }
                              />
                            </label>
                            <label>
                              留言
                              <textarea
                                value={row.message}
                                maxLength={500}
                                rows={3}
                                placeholder="展示在顾问弹窗的留言"
                                onChange={(event) =>
                                  update(row.id, { message: event.target.value })
                                }
                              />
                            </label>
                          </div>
                          <div className="admin-actions">
                            <button
                              type="button"
                              className="admin-btn"
                              onClick={() => save(row)}
                            >
                              保存详情
                            </button>
                            <button
                              type="button"
                              className="admin-btn secondary"
                              onClick={() => remove(row)}
                            >
                              删除顾问
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={8}>还没有配置顾问</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {tab === "create" && (
      <div className="admin-card max-w-xl">
        <h3 style={{ marginTop: 0 }}>新增顾问</h3>
          <form className="admin-form" onSubmit={create}>
            <label>
              姓名
              <input name="name" required maxLength={32} />
            </label>
            <label>
              电话
              <input name="phone" required maxLength={32} />
            </label>
            <label>
              分享码（留空自动生成）
              <input name="shareCode" maxLength={32} pattern="[A-Za-z0-9_-]+" />
            </label>
            <label>
              职衔
              <input name="title" placeholder="置业顾问" maxLength={32} />
            </label>
            <label>
              团队
              <input name="teamName" maxLength={32} />
            </label>
            <button type="submit">新增</button>
          </form>
      </div>
      )}

      {tab === "import" && (
      <div className="admin-card max-w-xl">
        <h3 style={{ marginTop: 0 }}>批量导入</h3>
          <p className="redeem-hint">
            上传 Excel（.xlsx）：表头需包含「姓名」「手机号码」，可选「所属团队」「职衔」「工号」「分享码」。未填分享码时按手机号后 8 位自动生成。
          </p>
          <form className="admin-form" onSubmit={importExcel}>
            <label>
              Excel 文件
              <input type="file" name="file" accept=".xlsx" required />
            </label>
            <button type="submit" disabled={importing}>
              {importing ? "导入中…" : "上传并导入"}
            </button>
          </form>
          {importIssues.length ? (
            <ul className="redeem-hint">
              {importIssues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          ) : null}
          <p className="redeem-hint">
            或粘贴数据：每行一条，格式：姓名,电话,分享码,团队（团队可省略）。分享码或手机号重复的行会自动跳过。
          </p>
          <form className="admin-form" onSubmit={importRows}>
            <label>
              粘贴数据
              <textarea name="rows" rows={6} placeholder={"张三,13800000001,zhangsan,一组\n李四,13800000002,lisi,二组"} />
            </label>
            <button type="submit">开始导入</button>
          </form>
      </div>
      )}

      {qrRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#2a150ccc] p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setQrRow(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="m-0 text-[15px] font-bold text-[#3a2418]">推广二维码</h3>
                <p className="m-0 mt-1 text-[12px] text-[#8a6c5b]">
                  {qrRow.name} · 分享码 {qrRow.shareCode}
                </p>
              </div>
              <button
                type="button"
                aria-label="关闭"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#fff2df] text-[16px] leading-none text-[#8f281f] hover:bg-[#ffe6b8]"
                onClick={() => setQrRow(null)}
              >
                ×
              </button>
            </div>
            <div className="mt-4 flex justify-center">
              <PreviewableImage
                src={qrSrc(qrRow.shareCode)}
                alt={`${qrRow.name} 的推广二维码`}
                title={`${qrRow.name} 的推广二维码`}
                className="h-56 w-56 rounded-xl object-contain p-2"
                buttonClassName="rounded-xl border border-[#f0e2d2] bg-white"
              />
            </div>
            <p className="mt-3 break-all text-center text-[12px] text-[#8a6c5b]">
              {promoLink(qrRow.shareCode)}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <a
                className="admin-btn"
                href={qrSrc(qrRow.shareCode, true)}
                download={`qrcode-${qrRow.shareCode}.png`}
              >
                下载二维码
              </a>
              <button
                type="button"
                className="admin-btn secondary"
                onClick={() => copyLink(qrRow.shareCode)}
              >
                复制链接
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
