"use client";

import { FormEvent, Fragment, useState } from "react";
import { useRouter } from "next/navigation";

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

  function copyLink(code: string) {
    const link = `${origin}/?c=${code}`;
    navigator.clipboard
      .writeText(link)
      .then(() => setMessage(`推广链接已复制：${link}`))
      .catch(() => setError(link));
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
        <div className="admin-table-scroll">
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
                    <td className="promo-cell">
                      <button type="button" onClick={() => copyLink(row.shareCode)}>
                        复制链接
                      </button>
                      <a
                        href={`/api/admin/consultants/qrcode?code=${encodeURIComponent(row.shareCode)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        二维码
                      </a>
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
                      </button>
                    </td>
                  </tr>
                  {expanded === row.id && (
                    <tr className="detail-row">
                      <td colSpan={8}>
                        <div className="admin-field-row">
                          <label>
                            职衔
                            <input
                              value={row.title}
                              onChange={(event) =>
                                update(row.id, { title: event.target.value })
                              }
                            />
                          </label>
                          <label>
                            工号
                            <input
                              value={row.employeeNo}
                              onChange={(event) =>
                                update(row.id, { employeeNo: event.target.value })
                              }
                            />
                          </label>
                          <label>
                            头像地址
                            <input
                              value={row.avatarUrl}
                              onChange={(event) =>
                                update(row.id, { avatarUrl: event.target.value })
                              }
                            />
                          </label>
                          <label>
                            二维码图地址
                            <input
                              value={row.qrcodeUrl}
                              onChange={(event) =>
                                update(row.id, { qrcodeUrl: event.target.value })
                              }
                            />
                          </label>
                          <label>
                            顾问本人 OpenID（过滤自点）
                            <input
                              value={row.openid}
                              onChange={(event) =>
                                update(row.id, { openid: event.target.value })
                              }
                            />
                          </label>
                        </div>
                        <label className="stacked">
                          介绍
                          <input
                            value={row.intro}
                            onChange={(event) =>
                              update(row.id, { intro: event.target.value })
                            }
                          />
                        </label>
                        <label className="stacked">
                          留言
                          <input
                            value={row.message}
                            onChange={(event) =>
                              update(row.id, { message: event.target.value })
                            }
                          />
                        </label>
                        <div className="admin-actions" style={{ marginTop: 10 }}>
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
            每行一条，格式：姓名,电话,分享码,团队（团队可省略）。分享码重复的行会自动跳过。
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
    </div>
  );
}
