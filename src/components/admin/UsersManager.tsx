"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PERMISSION_MODULES } from "@/lib/permissions";
import RolesManager, { type RoleRow } from "./RolesManager";

type RoleOption = {
  id: string;
  code: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: string[];
};

type UserRow = {
  id: string;
  username: string;
  name: string;
  phone: string;
  isSuperAdmin: boolean;
  status: string;
  roleIds: string[];
  roles: Array<{ id: string; code: string; name: string }>;
  permissions: string[];
};

const FIELD =
  "rounded-lg border border-[#e4c69f] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#b83224] focus:ring-2 focus:ring-[#b832241a]";

function permissionLabel(user: UserRow) {
  if (user.isSuperAdmin) return "全部（超管）";
  if (!user.permissions.length) return "无";
  return user.permissions
    .map(
      (code) =>
        PERMISSION_MODULES.find((item) => item.code === code)?.name || code,
    )
    .join("、");
}

function roleLabel(user: UserRow) {
  if (user.isSuperAdmin) return "超级管理员";
  if (!user.roles.length) return "未分配";
  return user.roles.map((role) => role.name).join("、");
}

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

function RoleChecklist({
  options,
  selected,
  onChange,
}: {
  options: RoleOption[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const effective = useMemo(() => {
    const set = new Set<string>();
    for (const role of options) {
      if (!selected.includes(role.id)) continue;
      for (const code of role.permissions) set.add(code);
    }
    return [...set];
  }, [options, selected]);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((role) => (
          <label
            key={role.id}
            className="flex items-start gap-2 rounded-lg border border-[#f0d7b2] bg-[#fffaf3] px-3 py-2 text-[13px] font-normal"
          >
            <input
              type="checkbox"
              className="mt-1"
              checked={selected.includes(role.id)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...selected.filter((id) => id !== role.id), role.id]
                    : selected.filter((id) => id !== role.id),
                )
              }
            />
            <span>
              <strong className="font-bold">{role.name}</strong>
              <span className="mt-0.5 block text-[11px] text-[#8a6c5b]">
                {role.description || role.code}
              </span>
            </span>
          </label>
        ))}
      </div>
      <p className="m-0 text-[12px] text-[#8a6c5b]">
        有效权限（并集）：
        {effective.length
          ? effective
              .map(
                (code) =>
                  PERMISSION_MODULES.find((item) => item.code === code)?.name ||
                  code,
              )
              .join("、")
          : "无"}
      </p>
    </div>
  );
}

export default function UsersManager({
  users,
  roles,
  roleRows,
  currentUserId,
}: {
  users: UserRow[];
  roles: RoleOption[];
  roleRows: RoleRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"users" | "roles">("users");
  const [rows, setRows] = useState<UserRow[]>(users);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [roleUser, setRoleUser] = useState<UserRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [roleDraft, setRoleDraft] = useState<string[]>([]);
  const [createRoles, setCreateRoles] = useState<string[]>([]);
  const [passwordDraft, setPasswordDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function patchLocal(id: string, patch: Partial<UserRow>) {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function openEdit(user: UserRow) {
    setError("");
    setEditing(user);
    setPasswordDraft("");
  }

  function openRoles(user: UserRow) {
    setError("");
    setRoleUser(user);
    setRoleDraft([...user.roleIds]);
  }

  async function sendPatch(payload: Record<string, unknown>) {
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "保存失败");
    return data as { tip?: string };
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    const patch: Partial<UserRow> = {
      name: String(form.get("name") || "").trim(),
      phone: String(form.get("phone") || "").trim(),
      status: String(form.get("status") || "ACTIVE"),
    };
    setBusy(true);
    setError("");
    try {
      await sendPatch({
        id: editing.id,
        ...patch,
        phone: patch.phone || null,
        ...(passwordDraft ? { password: passwordDraft } : {}),
      });
      patchLocal(editing.id, patch);
      setEditing(null);
      setPasswordDraft("");
      setMessage(`已保存：${editing.username}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function saveRoles() {
    if (!roleUser) return;
    setBusy(true);
    setError("");
    try {
      const data = await sendPatch({
        id: roleUser.id,
        roleIds: roleDraft,
      });
      const nextRoles = roles
        .filter((role) => roleDraft.includes(role.id))
        .map((role) => ({ id: role.id, code: role.code, name: role.name }));
      const nextPermissions = [
        ...new Set(
          roles
            .filter((role) => roleDraft.includes(role.id))
            .flatMap((role) => role.permissions),
        ),
      ];
      patchLocal(roleUser.id, {
        roleIds: [...roleDraft],
        roles: nextRoles,
        permissions: nextPermissions,
      });
      setRoleUser(null);
      setMessage(
        data.tip ||
          `角色已更新：${roleUser.username}（需重新登录后生效）`,
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "角色保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.get("username"),
          name: form.get("name"),
          phone: form.get("phone") || undefined,
          password: form.get("password"),
          roleIds: createRoles,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "创建失败");
      setCreating(false);
      setCreateRoles([]);
      setMessage("用户已创建");
      formEl.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(user: UserRow) {
    const next = user.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    setError("");
    try {
      await sendPatch({
        id: user.id,
        name: user.name,
        phone: user.phone || null,
        status: next,
      });
      patchLocal(user.id, { status: next });
      setMessage(`${user.username} 已${next === "ACTIVE" ? "启用" : "停用"}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "状态更新失败");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`admin-btn ${tab === "users" ? "" : "secondary"}`}
          onClick={() => setTab("users")}
        >
          用户
        </button>
        <button
          type="button"
          className={`admin-btn ${tab === "roles" ? "" : "secondary"}`}
          onClick={() => setTab("roles")}
        >
          角色
        </button>
      </div>

      {tab === "roles" ? (
        <RolesManager roles={roleRows} />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="m-0 text-[15px] font-bold">后台用户</h3>
              <p className="m-0 mt-1 text-[12px] text-[#8a6c5b]">
                权限由角色决定，可多选；改角色后用户需重新登录生效。
              </p>
            </div>
            <button
              type="button"
              className="admin-btn"
              onClick={() => {
                setError("");
                setCreateRoles([]);
                setCreating(true);
              }}
            >
              新增用户
            </button>
          </div>

          {error && !editing && !roleUser && !creating ? (
            <p className="error-text m-0">{error}</p>
          ) : null}
          {message ? <p className="ok-text m-0">{message}</p> : null}

          <div className="admin-card">
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th className="whitespace-nowrap">账号</th>
                    <th className="whitespace-nowrap">姓名</th>
                    <th className="whitespace-nowrap">手机号</th>
                    <th className="whitespace-nowrap">状态</th>
                    <th className="whitespace-nowrap">角色</th>
                    <th>有效权限</th>
                    <th className="whitespace-nowrap">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((user) => (
                    <tr key={user.id}>
                      <td className="whitespace-nowrap font-bold">
                        {user.username}
                      </td>
                      <td className="whitespace-nowrap">{user.name}</td>
                      <td className="whitespace-nowrap">
                        {user.phone || "-"}
                      </td>
                      <td className="whitespace-nowrap">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[12px] ${
                            user.status === "ACTIVE"
                              ? "bg-[#e8f5ea] text-[#1f7a34]"
                              : "bg-[#f4ece5] text-[#8a6c5b]"
                          }`}
                        >
                          {user.status === "ACTIVE" ? "启用" : "停用"}
                        </span>
                      </td>
                      <td className="max-w-[180px] text-[12px] text-[#5c4433]">
                        {roleLabel(user)}
                      </td>
                      <td className="max-w-[240px] text-[12px] text-[#5c4433]">
                        {permissionLabel(user)}
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="admin-btn secondary whitespace-nowrap"
                            onClick={() => openEdit(user)}
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            className="admin-btn secondary whitespace-nowrap"
                            onClick={() => openRoles(user)}
                            disabled={user.isSuperAdmin}
                          >
                            分配角色
                          </button>
                          <button
                            type="button"
                            className="admin-btn secondary whitespace-nowrap"
                            onClick={() => toggleStatus(user)}
                            disabled={user.id === currentUserId}
                          >
                            {user.status === "ACTIVE" ? "停用" : "启用"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!rows.length && (
                    <tr>
                      <td colSpan={7}>还没有后台用户</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="m-0 mt-3 text-[12px] text-[#8a6c5b]">
              超级管理员不通过角色赋权；当前登录账号不能停用。
            </p>
          </div>

          {editing && (
            <Modal
              title="编辑用户"
              subtitle={`账号 ${editing.username}`}
              onClose={() => setEditing(null)}
            >
              {error ? <p className="error-text m-0 mb-3">{error}</p> : null}
              <form className="flex flex-col gap-3" onSubmit={saveEdit}>
                <label className="flex flex-col gap-1.5 text-[13px] font-bold">
                  姓名
                  <input
                    name="name"
                    required
                    defaultValue={editing.name}
                    className={`${FIELD} font-normal`}
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-[13px] font-bold">
                  手机号
                  <input
                    name="phone"
                    defaultValue={editing.phone}
                    className={`${FIELD} font-normal`}
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-[13px] font-bold">
                  状态
                  <select
                    name="status"
                    defaultValue={editing.status}
                    className={`${FIELD} font-normal`}
                  >
                    <option value="ACTIVE">启用</option>
                    <option value="DISABLED">停用</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 text-[13px] font-bold">
                  重置密码（留空不改）
                  <input
                    type="password"
                    minLength={8}
                    value={passwordDraft}
                    onChange={(event) => setPasswordDraft(event.target.value)}
                    autoComplete="new-password"
                    placeholder="至少 8 位"
                    className={`${FIELD} font-normal`}
                  />
                </label>
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

          {roleUser && (
            <Modal
              title="分配角色"
              subtitle={`${roleUser.name} · @${roleUser.username}`}
              onClose={() => setRoleUser(null)}
            >
              {error ? <p className="error-text m-0 mb-3">{error}</p> : null}
              {roleUser.isSuperAdmin ? (
                <p className="m-0 text-[13px] text-[#8a6c5b]">
                  超级管理员默认拥有全部权限，无需分配角色。
                </p>
              ) : (
                <>
                  <RoleChecklist
                    options={roles}
                    selected={roleDraft}
                    onChange={setRoleDraft}
                  />
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      className="admin-btn secondary"
                      onClick={() => setRoleUser(null)}
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      className="admin-btn"
                      disabled={busy}
                      onClick={() => void saveRoles()}
                    >
                      {busy ? "保存中…" : "保存角色"}
                    </button>
                  </div>
                </>
              )}
            </Modal>
          )}

          {creating && (
            <Modal
              title="新增用户"
              subtitle="创建后台账号并分配角色（可多选）"
              onClose={() => setCreating(false)}
            >
              {error ? <p className="error-text m-0 mb-3">{error}</p> : null}
              <form className="flex flex-col gap-3" onSubmit={onCreate}>
                <label className="flex flex-col gap-1.5 text-[13px] font-bold">
                  登录账号
                  <input
                    name="username"
                    required
                    minLength={3}
                    className={`${FIELD} font-normal`}
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-[13px] font-bold">
                  姓名
                  <input
                    name="name"
                    required
                    className={`${FIELD} font-normal`}
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-[13px] font-bold">
                  手机号
                  <input name="phone" className={`${FIELD} font-normal`} />
                </label>
                <label className="flex flex-col gap-1.5 text-[13px] font-bold">
                  初始密码
                  <input
                    name="password"
                    type="password"
                    required
                    minLength={8}
                    className={`${FIELD} font-normal`}
                  />
                </label>
                <div>
                  <strong className="text-[13px]">角色（可多选）</strong>
                  <div className="mt-2">
                    <RoleChecklist
                      options={roles}
                      selected={createRoles}
                      onChange={setCreateRoles}
                    />
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
                    {busy ? "创建中…" : "创建用户"}
                  </button>
                </div>
              </form>
            </Modal>
          )}
        </>
      )}
    </div>
  );
}
