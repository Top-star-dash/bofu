"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type CustomerPrizeRow = {
  id: string;
  prizeName: string;
  prizeLevel: string;
  isWin: boolean;
  redeemCode: string;
  redeemStatus: string;
  createdAt: string;
  redeemedAt: string | null;
  redeemedBy: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "待核销",
  REDEEMED: "已核销",
  EXPIRED: "已失效",
};

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-[#fff2df] text-[#b83224]",
  REDEEMED: "bg-[#e8f5ec] text-[#1f7a41]",
  EXPIRED: "bg-[#f1ece7] text-[#8a6c5b]",
};

export default function CustomerPrizes({
  rows: initialRows,
  canRedeem,
  drawCount,
}: {
  rows: CustomerPrizeRow[];
  canRedeem: boolean;
  drawCount: number;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [active, setActive] = useState<CustomerPrizeRow | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const pending = rows.filter((row) => row.redeemStatus === "PENDING").length;
  const redeemed = rows.filter((row) => row.redeemStatus === "REDEEMED").length;

  function open(row: CustomerPrizeRow) {
    setActive(row);
    setPassword("");
    setError("");
  }

  function close() {
    if (busy) return;
    setActive(null);
    setPassword("");
    setError("");
  }

  async function confirm() {
    if (!active || busy) return;
    if (!password.trim()) {
      setError("请填写核销密码");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/redeem/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drawRecordId: active.id, password: password.trim() }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (data.record?.redeemStatus) {
          const next = data.record;
          setRows((prev) =>
            prev.map((row) =>
              row.id === next.id
                ? {
                    ...row,
                    redeemStatus: next.redeemStatus,
                    redeemedAt: next.redeemedAt,
                    redeemedBy: next.redeemedBy,
                  }
                : row,
            ),
          );
        }
        setError(data.message || "核销失败");
        setBusy(false);
        return;
      }

      setRows((prev) =>
        prev.map((row) =>
          row.id === active.id
            ? {
                ...row,
                redeemStatus: "REDEEMED",
                redeemedAt: data.record?.redeemedAt ?? new Date().toISOString(),
                redeemedBy: data.record?.redeemedBy ?? null,
              }
            : row,
        ),
      );
      setToast(`${active.prizeName} 核销成功`);
      setActive(null);
      setPassword("");
      router.refresh();
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "中奖奖品", value: rows.length },
          { label: "待核销", value: pending },
          { label: "已核销", value: redeemed },
        ].map((item) => (
          <article
            key={item.label}
            className="rounded-xl bg-white px-4 py-3 shadow-[0_8px_24px_#7a4a2e12]"
          >
            <span className="text-[12px] text-[#8a6c5b]">{item.label}</span>
            <strong className="mt-1 block text-[20px] font-bold text-[#b83224]">
              {item.value}
            </strong>
          </article>
        ))}
      </div>

      <div className="admin-card !overflow-visible">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="m-0 text-[14px] font-bold">客户奖品</h3>
          <span className="text-[12px] text-[#8a6c5b]">
            累计抽奖 {drawCount} 次 · 中奖 {rows.length} 次
          </span>
        </div>

        {toast ? (
          <p className="mt-3 rounded-lg bg-[#e8f5ec] px-3 py-2 text-[13px] text-[#1f7a41]">
            {toast}
          </p>
        ) : null}

        {rows.length ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => open(row)}
                className="flex flex-col gap-2 rounded-xl border border-[#ead7c2] bg-[#fffaf3] p-4 text-left transition hover:border-[#d8ab80] hover:shadow-[0_10px_26px_#7a4a2e1a]"
              >
                <div className="flex items-start justify-between gap-2">
                  <strong className="text-[14px] font-bold text-[#3a2418]">
                    {row.prizeLevel} · {row.prizeName}
                  </strong>
                  <em
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] not-italic font-bold ${
                      STATUS_STYLE[row.redeemStatus] ||
                      "bg-[#f1ece7] text-[#8a6c5b]"
                    }`}
                  >
                    {STATUS_LABEL[row.redeemStatus] || row.redeemStatus}
                  </em>
                </div>
                <span className="break-all font-mono text-[16px] font-bold tracking-widest text-[#b83224]">
                  {row.redeemCode}
                </span>
                <span className="text-[12px] text-[#8a6c5b]">
                  中奖时间 {new Date(row.createdAt).toLocaleString("zh-CN")}
                </span>
                {row.redeemedAt ? (
                  <span className="text-[12px] text-[#8a6c5b]">
                    核销时间 {new Date(row.redeemedAt).toLocaleString("zh-CN")}
                    {row.redeemedBy ? ` · ${row.redeemedBy}` : ""}
                  </span>
                ) : null}
                <span className="mt-1 text-[12px] font-bold text-[#8f281f]">
                  {row.redeemStatus === "PENDING" && canRedeem
                    ? "点击核销 →"
                    : "查看奖品详情 →"}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="m-0 py-6 text-center text-[13px] text-[#9b7d64]">
            该客户暂未中奖
          </p>
        )}
      </div>

      {active ? (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <button
            type="button"
            aria-label="关闭核销弹窗"
            className="absolute inset-0 bg-black/45"
            onClick={close}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="奖品核销"
            className="relative w-full max-w-[420px] rounded-2xl bg-white p-5 shadow-[0_24px_60px_#2f0f0a55]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[12px] text-[#8a6c5b]">奖品</span>
                <h3 className="m-0 mt-1 text-[18px] font-bold text-[#3a2418]">
                  {active.prizeLevel} · {active.prizeName}
                </h3>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded-lg bg-[#fff2df] px-2.5 py-1 text-[13px] text-[#8f281f]"
              >
                关闭
              </button>
            </div>

            <dl className="mt-4 grid gap-2 text-[13px] text-[#3a2418]">
              <div className="flex justify-between gap-3">
                <dt className="shrink-0 text-[#8a6c5b]">核销码</dt>
                <dd className="m-0 max-w-[65%] break-all text-right font-mono text-[14px] font-bold tracking-wider text-[#b83224]">
                  {active.redeemCode}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#8a6c5b]">状态</dt>
                <dd className="m-0">
                  {STATUS_LABEL[active.redeemStatus] || active.redeemStatus}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#8a6c5b]">中奖时间</dt>
                <dd className="m-0">
                  {new Date(active.createdAt).toLocaleString("zh-CN")}
                </dd>
              </div>
              {active.redeemedAt ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-[#8a6c5b]">核销时间</dt>
                  <dd className="m-0">
                    {new Date(active.redeemedAt).toLocaleString("zh-CN")}
                  </dd>
                </div>
              ) : null}
            </dl>

            {active.redeemStatus === "PENDING" ? (
              canRedeem ? (
                <div className="mt-4 flex flex-col gap-2">
                  <label className="flex flex-col gap-1.5 text-[13px] font-bold text-[#3a2418]">
                    核销密码
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="现场核销密码"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={8}
                      className="rounded-lg border border-[#e4c69f] bg-[#fffaf3] px-3 py-2.5 text-[14px] font-normal outline-none focus:border-[#b83224] focus:ring-2 focus:ring-[#b83224]/20"
                    />
                  </label>
                  {error ? (
                    <p className="m-0 text-[13px] text-[#b83224]">{error}</p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void confirm()}
                    disabled={busy}
                    className="rounded-lg bg-[#b83224] px-4 py-2.5 text-[14px] font-bold text-white disabled:opacity-60"
                  >
                    {busy ? "核销中…" : "确认核销"}
                  </button>
                  <p className="m-0 text-[12px] text-[#8a6c5b]">
                    核销后不可撤销，请确认奖品已当面交付。
                  </p>
                </div>
              ) : (
                <p className="mt-4 rounded-lg bg-[#fff2df] px-3 py-2 text-[13px] text-[#8f281f]">
                  当前账号没有核销权限，请使用核销台或联系管理员。
                </p>
              )
            ) : (
              <p className="mt-4 rounded-lg bg-[#f1ece7] px-3 py-2 text-[13px] text-[#6b4c39]">
                {active.redeemStatus === "REDEEMED"
                  ? "该奖品已完成核销，请勿重复发放。"
                  : "该奖品已过兑奖截止时间，无法核销。"}
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
