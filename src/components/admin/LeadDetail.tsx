"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

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
    <form className="admin-form" onSubmit={submit}>
      <label>
        备注
        <textarea
          rows={3}
          value={form.remark}
          onChange={(event) => setForm({ ...form, remark: event.target.value })}
          placeholder="回访记录、意向变化等"
        />
      </label>
      <div className="admin-field-row">
        <label>
          线索分层
          <select
            value={form.tier}
            onChange={(event) => setForm({ ...form, tier: event.target.value })}
          >
            <option value="A">A 类</option>
            <option value="B">B 类</option>
            <option value="C">C 类</option>
          </select>
        </label>
        <label>
          归属顾问（人工改绑）
          <select
            value={form.consultantId}
            onChange={(event) => setForm({ ...form, consultantId: event.target.value })}
          >
            <option value="">未分配</option>
            {consultants.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && <p className="error-text">{error}</p>}
      {message && <p className="ok-text">{message}</p>}
      <div className="admin-actions">
        <button type="submit" disabled={busy}>
          {busy ? "保存中…" : "保存"}
        </button>
      </div>
    </form>
  );
}
