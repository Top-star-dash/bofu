"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const FIELD_CLASS =
  "rounded-lg border border-[#e4c69f] bg-white px-3 py-2 text-[13px] text-[#3a2418] outline-none focus:border-[#b83224] focus:ring-2 focus:ring-[#b832241a]";

/** 可搜索顾问下拉：输入过滤 + 下拉面板固定展开在输入框下方 */
function ConsultantPicker({
  value,
  onChange,
  consultants,
}: {
  value: string;
  onChange: (next: string) => void;
  consultants: Array<{ id: string; name: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const boxRef = useRef<HTMLDivElement | null>(null);

  const selected = consultants.find((item) => item.id === value);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const options = useMemo(() => {
    const text = keyword.trim();
    if (!text) return consultants;
    return consultants.filter((item) => item.name.includes(text));
  }, [consultants, keyword]);

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        className={`flex w-full items-center justify-between gap-2 rounded-lg border border-[#e4c69f] bg-white px-3 py-2 text-left text-[13px] text-[#3a2418] ${
          open ? "ring-2 ring-[#b832241a]" : ""
        }`}
        onClick={() => {
          setKeyword("");
          setOpen((prev) => !prev);
        }}
      >
        <span className={selected ? "" : "text-[#9b7d64]"}>
          {selected ? selected.name : "未分配（自然到访）"}
        </span>
        <span className="text-[10px] text-[#9b7d64]">▾</span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 rounded-xl border border-[#f0e2d2] bg-white p-2 shadow-xl">
          <input
            autoFocus
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="输入顾问姓名搜索"
            className="w-full rounded-lg border border-[#e4c69f] px-2.5 py-1.5 text-[13px] outline-none focus:border-[#b83224]"
          />
          <ul className="mt-2 max-h-56 overflow-y-auto">
            <li>
              <button
                type="button"
                className={`w-full rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-[#fff2df] ${
                  value ? "" : "font-bold text-[#b83224]"
                }`}
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                未分配（自然到访）
              </button>
            </li>
            {options.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`w-full rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-[#fff2df] ${
                    item.id === value ? "bg-[#fff2df] font-bold text-[#b83224]" : ""
                  }`}
                  onClick={() => {
                    onChange(item.id);
                    setOpen(false);
                  }}
                >
                  {item.name}
                </button>
              </li>
            ))}
            {!options.length && (
              <li className="px-2.5 py-2 text-[12px] text-[#9b7d64]">没有匹配的顾问</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function LeadDetail({
  leadId,
  remark,
  tier,
  consultantId,
  consultants,
}: {
  leadId: string;
  remark: string;
  tier: string;
  consultantId: string;
  consultants: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [form, setForm] = useState({ remark, tier, consultantId });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          remark: form.remark || null,
          tier: form.tier,
          consultantId: form.consultantId || null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.message || "保存失败");
        return;
      }
      setMessage("已保存");
      router.refresh();
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="flex max-w-3xl flex-col gap-4" onSubmit={submit}>
      <label className="flex flex-col gap-2 text-[13px] font-bold text-[#3a2418]">
        备注
        <textarea
          rows={4}
          value={form.remark}
          onChange={(event) => setForm({ ...form, remark: event.target.value })}
          placeholder="回访记录、意向变化等"
          className={`${FIELD_CLASS} resize-y font-normal leading-6`}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-[13px] font-bold text-[#3a2418]">
          线索分层
          <select
            value={form.tier}
            onChange={(event) => setForm({ ...form, tier: event.target.value })}
            className={FIELD_CLASS}
          >
            <option value="A">A 类</option>
            <option value="B">B 类</option>
            <option value="C">C 类</option>
          </select>
        </label>
        <div className="flex flex-col gap-2 text-[13px] font-bold text-[#3a2418]">
          <span>归属顾问（人工改绑）</span>
          <ConsultantPicker
            value={form.consultantId}
            onChange={(next) => setForm({ ...form, consultantId: next })}
            consultants={consultants}
          />
        </div>
      </div>

      {error && <p className="error-text m-0">{error}</p>}
      {message && <p className="ok-text m-0">{message}</p>}

      <div className="admin-actions">
        <button type="submit" disabled={busy}>
          {busy ? "保存中…" : "保存"}
        </button>
      </div>
    </form>
  );
}
