"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

type RedeemRecord = {
  redeemCode: string;
  prizeName: string;
  prizeLevel: string;
  isWin: boolean;
  redeemStatus: string;
  createdAt: string;
  redeemedAt: string | null;
  redeemedBy: string | null;
  customerName: string;
  customerPhone: string;
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "待核销",
  REDEEMED: "已核销",
  EXPIRED: "已失效",
};

const STATUS_CLASS: Record<string, string> = {
  PENDING: "pending",
  REDEEMED: "redeemed",
  EXPIRED: "expired",
};

const PASSWORD_KEY = "bofu_redeem_password";

export default function RedeemConsole() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [record, setRecord] = useState<RedeemRecord | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(
    null,
  );
  const [busy, setBusy] = useState<"query" | "confirm" | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdMessage, setPwdMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);
  const [pwdBusy, setPwdBusy] = useState(false);

  useEffect(() => {
    const saved = window.sessionStorage.getItem(PASSWORD_KEY);
    // 挂载后回填本次会话内已使用的核销密码，避免现场反复输入
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setPassword(saved);
    codeRef.current?.focus();
  }, []);

  async function submit(action: "query" | "confirm") {
    if (busy) return;
    if (!code.trim() || !password.trim()) {
      setMessage({ text: "请填写核销码与核销密码", error: true });
      return;
    }

    setBusy(action);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          redeemCode: code.trim(),
          password: password.trim(),
        }),
      });
      const data = await response.json();

      if (data.record) setRecord(data.record as RedeemRecord);

      if (!response.ok) {
        setMessage({ text: data.message || "操作失败", error: true });
        return;
      }

      window.sessionStorage.setItem(PASSWORD_KEY, password.trim());
      setMessage({
        text: action === "confirm" ? "核销成功，请交付奖品" : "查询成功",
        error: false,
      });
      if (action === "confirm") {
        setCode("");
        codeRef.current?.focus();
        router.refresh();
      }
    } catch {
      setMessage({ text: "网络异常，请稍后重试", error: true });
    } finally {
      setBusy(null);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit("query");
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pwdBusy) return;
    if (!/^\d{4}$/.test(newPwd.trim())) {
      setPwdMessage({ text: "新密码须为 4 位数字", error: true });
      return;
    }
    if (newPwd.trim() !== confirmPwd.trim()) {
      setPwdMessage({ text: "两次输入的新密码不一致", error: true });
      return;
    }

    setPwdBusy(true);
    setPwdMessage(null);
    try {
      const response = await fetch("/api/admin/redeem/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: currentPwd.trim(),
          newPassword: newPwd.trim(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setPwdMessage({ text: data.message || "修改失败", error: true });
        return;
      }
      window.sessionStorage.setItem(PASSWORD_KEY, newPwd.trim());
      setPassword(newPwd.trim());
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
      setPwdMessage({ text: "核销密码已更新", error: false });
    } catch {
      setPwdMessage({ text: "网络异常，请稍后重试", error: true });
    } finally {
      setPwdBusy(false);
    }
  }

  const status = record?.redeemStatus ?? "";
  const canConfirm =
    Boolean(record) && record!.isWin && record!.redeemStatus === "PENDING";

  return (
    <div className="redeem-grid">
      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>扫码 / 输入核销码</h3>
        <form className="redeem-form" onSubmit={onSubmit}>
          <label>
            核销码
            <input
              ref={codeRef}
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
                setRecord(null);
              }}
              placeholder="例如 123456"
              autoComplete="off"
              spellCheck={false}
              inputMode="numeric"
              maxLength={8}
            />
            <span style={{ fontSize: 12, color: "#8a6c5b" }}>
              客户手机上的核销码为 4~8 位数字
            </span>
          </label>
          <label>
            核销密码
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="现场核销密码"
              autoComplete="off"
            />
          </label>
          <div className="admin-actions">
            <button type="submit" disabled={Boolean(busy)}>
              {busy === "query" ? "查询中…" : "查询"}
            </button>
            {record && (
              <button
                type="button"
                className="admin-btn secondary"
                onClick={() => void submit("confirm")}
                disabled={!canConfirm || Boolean(busy)}
              >
                {busy === "confirm" ? "核销中…" : "确认核销"}
              </button>
            )}
          </div>
          {message && (
            <p className={message.error ? "error-text" : "redeem-hint"}>
              {message.text}
            </p>
          )}
        </form>
      </section>

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>核销结果</h3>
        {record ? (
          <div className="redeem-ticket">
            <div className="redeem-ticket-header">
              <h3>
                {record.prizeLevel} · {record.prizeName}
              </h3>
              <em className={`redeem-status ${STATUS_CLASS[status] || ""}`}>
                {STATUS_LABEL[status] || status}
              </em>
            </div>
            <dl>
              <dt>核销码</dt>
              <dd>{record.redeemCode}</dd>
              <dt>中奖人</dt>
              <dd>{record.customerName}</dd>
              <dt>手机号</dt>
              <dd>{record.customerPhone}</dd>
              <dt>中奖时间</dt>
              <dd>{new Date(record.createdAt).toLocaleString("zh-CN")}</dd>
              {record.redeemedAt && (
                <>
                  <dt>核销时间</dt>
                  <dd>{new Date(record.redeemedAt).toLocaleString("zh-CN")}</dd>
                </>
              )}
              {record.redeemedBy && (
                <>
                  <dt>核销人</dt>
                  <dd>{record.redeemedBy}</dd>
                </>
              )}
            </dl>
            {!record.isWin && (
              <p className="error-text" style={{ margin: 0 }}>
                该记录为未中奖记录，不可核销。
              </p>
            )}
            {record.isWin && record.redeemStatus === "REDEEMED" && (
              <p className="redeem-hint" style={{ margin: 0 }}>
                该奖品已完成核销，请勿重复发放。
              </p>
            )}
          </div>
        ) : (
          <p className="redeem-hint">
            输入核销码查询后，会在这里显示奖品、中奖人与核销状态。
          </p>
        )}
      </section>

      <section className="admin-card" style={{ gridColumn: "1 / -1" }}>
        <h3 style={{ marginTop: 0 }}>修改核销密码</h3>
        <p className="redeem-hint" style={{ marginTop: 0 }}>
          统一 4 位数字密码，修改后立即生效；现场核销与客户手机核销共用此密码。
        </p>
        <form className="redeem-form" onSubmit={changePassword}>
          <label>
            当前密码
            <input
              type="password"
              value={currentPwd}
              onChange={(event) => setCurrentPwd(event.target.value)}
              placeholder="当前 4 位核销密码"
              autoComplete="off"
              inputMode="numeric"
              maxLength={32}
              required
            />
          </label>
          <label>
            新密码
            <input
              type="password"
              value={newPwd}
              onChange={(event) => setNewPwd(event.target.value)}
              placeholder="新的 4 位数字"
              autoComplete="off"
              inputMode="numeric"
              maxLength={4}
              pattern="\d{4}"
              required
            />
          </label>
          <label>
            确认新密码
            <input
              type="password"
              value={confirmPwd}
              onChange={(event) => setConfirmPwd(event.target.value)}
              placeholder="再输入一次"
              autoComplete="off"
              inputMode="numeric"
              maxLength={4}
              pattern="\d{4}"
              required
            />
          </label>
          <div className="admin-actions">
            <button type="submit" disabled={pwdBusy}>
              {pwdBusy ? "保存中…" : "保存新密码"}
            </button>
          </div>
          {pwdMessage && (
            <p className={pwdMessage.error ? "error-text" : "redeem-hint"}>
              {pwdMessage.text}
            </p>
          )}
        </form>
      </section>
    </div>
  );
}
