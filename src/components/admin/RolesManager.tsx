"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PERMISSION_MODULES } from "@/lib/permissions";

export type RoleRow = {
  id: string;
  code: string;
  name: string;
  description: string;
  isSystem: boolean;
  userCount: number;
  permissions: string[];
};

const FIELD =
  "rounded-lg border border-[#e4c69f] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#b83224] focus:ring-2 focus:ring-[#b832241a]";

function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#2a150ccc] p-4 pt-16"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="m-0 text-[15px] font-bold text-[#3a2418]">{title}</h3>
            {subtitle ? (
              <p className="m-0 mt-1 text-[12px] text-[#8a6c5b]">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="关闭"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#fff2df] text-[16px] leading-none text-[#8f281f] hover:bg-[#ffe6b8]"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function permissionNames(codes: string[]) {
  if (!codes.length) return "无模块";
  return codes
    .map(
      (code) =>
        PERMISSION_MODULES.find((item) => item.code === code)?.name || code,
    )
    .join("、");
}

export default function RolesManager({ roles }: { roles: RoleRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(roles);
  const [editing, setEditing] = useState<RoleRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [permDraft, setPermDraft] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function openEdit(role: RoleRow) {
    setError("");
    setEditing(role);
    setPermDraft([...role.permissions]);
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/roles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editing.id,
          name: String(form.get("name") || "").trim(),
          description: String(form.get("description") || "").trim() || null,
          permissions: permDraft,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "保存失败");
      setRows((prev) =>
        prev.map((row) =>
          row.id === editing.id
            ? {
                ...row,
                name: String(form.get("name") || "").trim(),
                description: String(form.get("description") || "").trim(),
                permissions: [...permDraft],
              }
            : row,
        ),
      );
      setEditing(null);
      setMessage(
        data.tip ||
          `已保存角色「${editing.name}」；已登录用户需重新登录后生效`,
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const permissions = PERMISSION_MODULES.map((item) => item.code).filter(
      (code) => form.get(`perm_${code}`) === "on",
    );
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.get("code"),
          name: form.get("name"),
          description: form.get("description") || undefined,
          permissions,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "创建失败");
      setCreating(false);
      setMessage("角色已创建");
      formEl.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    } finally {
      setBusy(false);
    }
  }

  async function removeRole(role: RoleRow) {
    if (role.isSystem) return;
    if (!window.confirm(`确认删除角色「${role.name}」？`)) return;
    setError("");
    try {
      const response = await fetch("/api/admin/roles", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: role.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "删除失败");
      setRows((prev) => prev.filter((row) => row.id !== role.id));
      setMessage(`已删除角色：${role.name}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="m-0 text-[15px] font-bold">角色管理</h3>
          <p className="m-0 mt-1 text-[12px] text-[#8a6c5b]">
            权限由角色决定；修改角色权限后，绑定该角色的用户重新登录即同步生效。
          </p>
        </div>
        <button
          type="button"
          className="admin-btn"
          onClick={() => {
            setError("");
            setCreating(true);
          }}
        >
          新建角色
        </button>
      </div>

      {error && !editing && !creating ? (
        <p className="error-text m-0">{error}</p>
      ) : null}
      {message ? <p className="ok-text m-0">{message}</p> : null}

      <div className="admin-card">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th className="whitespace-nowrap">角色</th>
                <th className="whitespace-nowrap">编码</th>
                <th>权限模块</th>
                <th className="whitespace-nowrap">用户数</th>
                <th className="whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((role) => (
                <tr key={role.id}>
                  <td className="whitespace-nowrap font-bold">
                    {role.name}
                    {role.isSystem ? (
                      <span className="ml-2 rounded-full bg-[#fff2df] px-2 py-0.5 text-[11px] font-normal text-[#8f281f]">
                        系统
                      </span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap text-[12px] text-[#8a6c5b]">
                    {role.code}
                  </td>
                  <td className="max-w-[320px] text-[12px] text-[#5c4433]">
                    {permissionNames(role.permissions)}
                  </td>
                  <td className="whitespace-nowrap">{role.userCount}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="admin-btn secondary whitespace-nowrap"
                        onClick={() => openEdit(role)}
                      >
                        编辑权限
                      </button>
                      <button
                        type="button"
                        className="admin-btn secondary whitespace-nowrap"
                        onClick={() => void removeRole(role)}
                        disabled={role.isSystem || role.userCount > 0}
                        title={
                          role.isSystem
                            ? "系统角色不可删除"
                            : role.userCount > 0
                              ? "请先解绑用户"
                              : "删除"
                        }
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={5}>还没有角色</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <Modal
          title="编辑角色"
          subtitle={`${editing.name} · ${editing.code}${editing.isSystem ? "（系统预置）" : ""}`}
          onClose={() => setEditing(null)}
        >
          {error ? <p className="error-text m-0 mb-3">{error}</p> : null}
          <form className="flex flex-col gap-3" onSubmit={saveEdit}>
            <label className="flex flex-col gap-1.5 text-[13px] font-bold">
              名称
              <input
                name="name"
                required
                defaultValue={editing.name}
                className={`${FIELD} font-normal`}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-bold">
              说明
              <input
                name="description"
                defaultValue={editing.description}
                className={`${FIELD} font-normal`}
              />
            </label>
            <div>
              <strong className="text-[13px]">权限模块</strong>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {PERMISSION_MODULES.map((item) => (
                  <label
                    key={item.code}
                    className="flex items-center gap-2 text-[13px] font-normal"
                  >
                    <input
                      type="checkbox"
                      checked={permDraft.includes(item.code)}
                      onChange={(event) =>
                        setPermDraft((prev) =>
                          event.target.checked
                            ? [
                                ...prev.filter((code) => code !== item.code),
                                item.code,
                              ]
                            : prev.filter((code) => code !== item.code),
                        )
                      }
                    />
                    {item.name}
                  </label>
                ))}
              </div>
            </div>
            <p className="m-0 text-[12px] text-[#8a6c5b]">
              保存后绑定本角色的用户重新登录即可获得新权限。
            </p>
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                className="admin-btn secondary"
                onClick={() => setEditing(null)}
              >
                取消
              </button>
              <button type="submit" className="admin-btn" disabled={busy}>
                {busy ? "保存中…" : "保存"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {creating && (
        <Modal
          title="新建角色"
          subtitle="自定义角色编码与权限模块"
          onClose={() => setCreating(false)}
        >
          {error ? <p className="error-text m-0 mb-3">{error}</p> : null}
          <form className="flex flex-col gap-3" onSubmit={onCreate}>
            <label className="flex flex-col gap-1.5 text-[13px] font-bold">
              编码
              <input
                name="code"
                required
                minLength={2}
                placeholder="如 field_ops"
                className={`${FIELD} font-normal`}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-bold">
              名称
              <input name="name" required className={`${FIELD} font-normal`} />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-bold">
              说明
              <input name="description" className={`${FIELD} font-normal`} />
            </label>
            <div>
              <strong className="text-[13px]">权限模块</strong>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {PERMISSION_MODULES.map((item) => (
                  <label
                    key={item.code}
                    className="flex items-center gap-2 text-[13px] font-normal"
                  >
                    <input type="checkbox" name={`perm_${item.code}`} />
                    {item.name}
                  </label>
                ))}
              </div>
            </div>
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                className="admin-btn secondary"
                onClick={() => setCreating(false)}
              >
                取消
              </button>
              <button type="submit" className="admin-btn" disabled={busy}>
                {busy ? "创建中…" : "创建角色"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
