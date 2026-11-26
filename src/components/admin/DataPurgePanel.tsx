"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Scope = "business" | "full";

const SCOPES: Array<{
  key: Scope;
  title: string;
  desc: string;
}> = [
  {
    key: "business",
    title: "清空业务数据",
    desc: "删除客户、线索、抽奖记录、助力、浏览轨迹与操作日志；保留活动配置、奖品、顾问、素材。库存与统计计数会重置。",
  },
  {
    key: "full",
    title: "完全重置",
    desc: "除后台用户与权限外全部清空，包含活动配置、奖品、顾问、素材、公告。适合活动正式上线前彻底归零。",
  },
];

export default function DataPurgePanel() {
  const router = useRouter();
  const [scope, setScope] = useState<Scope>("business");
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Array<[string, number]>>([]);

  async function purge() {
    setError("");
    setResult([]);
    if (confirmText.trim() !== "确认清空") {
      setError("请输入确认短语「确认清空」");
      return;
    }
    if (!password) {
      setError("请输入当前账号密码");
      return;
    }
    const label = SCOPES.find((item) => item.key === scope)?.title || scope;
    if (
      !window.confirm(
        `即将执行「${label}」，此操作不可撤销，且无法通过后台恢复。确定继续？`,
      )
    ) {
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/admin/system/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, password, confirm: confirmText.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.message || "清理失败");
        return;
      }
      setResult(
        Object.entries(data.removed || {}) as Array<[string, number]>,
      );
      setPassword("");
      setConfirmText("");
      router.refresh();
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-[#f0c9c2] bg-[#fff7f5] p-3 text-[13px] text-[#8f281f]">
        ⚠️ 该操作会永久删除数据且不可恢复。执行前请确认已完成数据库备份。
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {SCOPES.map((item) => (
          <label
            key={item.key}
            className={`cursor-pointer rounded-xl border p-3 text-[13px] ${
              scope === item.key
                ? "border-[#b83224] bg-[#fff7f4]"
                : "border-[#f0e2d2] bg-white"
            }`}
          >
            <span className="flex items-center gap-2 font-bold text-[#3a2418]">
              <input
                type="radio"
                name="purge-scope"
                checked={scope === item.key}
                onChange={() => setScope(item.key)}
              />
              {item.title}
            </span>
            <span className="mt-2 block leading-6 text-[#7d6250]">{item.desc}</span>
          </label>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-[13px] font-bold">
          当前账号密码
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            placeholder="用于二次校验身份"
            className="rounded-lg border border-[#e4c69f] px-3 py-2 text-[13px] font-normal outline-none focus:border-[#b83224]"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-bold">
          确认短语
          <input
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            placeholder="请输入：确认清空"
            className="rounded-lg border border-[#e4c69f] px-3 py-2 text-[13px] font-normal outline-none focus:border-[#b83224]"
          />
        </label>
      </div>

      {error ? <p className="error-text m-0">{error}</p> : null}

      <div>
        <button
          type="button"
          className="admin-btn"
          disabled={busy}
          onClick={purge}
        >
          {busy ? "清理中…" : "执行清理"}
        </button>
      </div>

      {result.length ? (
        <div className="rounded-xl border border-[#cfe6d3] bg-[#f4fbf5] p-3">
          <p className="m-0 text-[13px] font-bold text-[#1f7a34]">清理完成</p>
          <ul className="m-0 mt-2 list-inside list-disc text-[13px] text-[#3a5c42]">
            {result.map(([key, value]) => (
              <li key={key}>
                {key}：删除 {value} 条
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
