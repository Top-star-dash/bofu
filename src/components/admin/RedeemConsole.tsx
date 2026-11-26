"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { parseRedeemCodeInput } from "@/lib/redeem-code";

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
const SCANNER_REGION_ID = "redeem-qr-reader";

type WxScanApi = {
  config: (cfg: Record<string, unknown>) => void;
  ready: (fn: () => void) => void;
  error: (fn: (res: { errMsg?: string }) => void) => void;
  scanQRCode: (cfg: {
    needResult: number;
    scanType: string[];
    success?: (res: { resultStr?: string }) => void;
    fail?: (res: { errMsg?: string }) => void;
  }) => void;
};

function isWechatBrowser() {
  return /MicroMessenger/i.test(navigator.userAgent);
}

async function loadWeixinScript() {
  if ((window as unknown as { wx?: WxScanApi }).wx) return;
  await new Promise<void>((resolve, reject) => {
    const existing = document.getElementById("wechat-jssdk");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("jssdk load fail")));
      return;
    }
    const script = document.createElement("script");
    script.id = "wechat-jssdk";
    script.src = "https://res.wx.qq.com/open/js/jweixin-1.6.0.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("jssdk load fail"));
    document.head.appendChild(script);
  });
}

export default function RedeemConsole({
  initialCode = "",
}: {
  initialCode?: string;
}) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [password, setPassword] = useState("");
  const [record, setRecord] = useState<RedeemRecord | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(
    null,
  );
  const [busy, setBusy] = useState<"query" | "confirm" | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const scanningRef = useRef(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const [scanning, setScanning] = useState(false);
  const [wxReady, setWxReady] = useState(false);
  const [inWechat, setInWechat] = useState(false);

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
    if (saved) setPassword(saved);
    if (!initialCode) codeRef.current?.focus();
  }, [initialCode]);

  useEffect(() => {
    setInWechat(isWechatBrowser());
  }, []);

  useEffect(() => {
    if (!inWechat) return;
    let cancelled = false;
    async function setupWx() {
      try {
        await loadWeixinScript();
        const pageUrl = window.location.href.split("#")[0];
        const response = await fetch(
          `/api/wechat/jssdk?url=${encodeURIComponent(pageUrl)}`,
        );
        if (!response.ok || cancelled) return;
        const config = (await response.json()) as {
          appId: string;
          timestamp: number;
          nonceStr: string;
          signature: string;
        };
        const wx = (window as unknown as { wx?: WxScanApi }).wx;
        if (!wx || cancelled) return;
        wx.config({
          debug: false,
          appId: config.appId,
          timestamp: config.timestamp,
          nonceStr: config.nonceStr,
          signature: config.signature,
          jsApiList: ["scanQRCode"],
        });
        wx.ready(() => {
          if (!cancelled) setWxReady(true);
        });
        wx.error(() => {
          if (!cancelled) setWxReady(false);
        });
      } catch {
        if (!cancelled) setWxReady(false);
      }
    }
    void setupWx();
    return () => {
      cancelled = true;
    };
  }, [inWechat]);

  useEffect(() => {
    return () => {
      void stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(
    action: "query" | "confirm",
    overrideCode?: string,
    overridePassword?: string,
  ) {
    if (busy) return;
    const parsed =
      parseRedeemCodeInput(overrideCode ?? code) ||
      (overrideCode ?? code).trim();
    const nextPassword = (overridePassword ?? password).trim();
    if (!parsed || !nextPassword) {
      setMessage({ text: "请填写核销码与核销密码", error: true });
      return;
    }
    const redeemCode = parsed;

    setBusy(action);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          redeemCode,
          password: nextPassword,
        }),
      });
      const data = await response.json();

      if (data.record) setRecord(data.record as RedeemRecord);

      if (!response.ok) {
        setMessage({ text: data.message || "操作失败", error: true });
        return;
      }

      window.sessionStorage.setItem(PASSWORD_KEY, nextPassword);
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

  function applyScannedRaw(raw: string) {
    const parsed = parseRedeemCodeInput(raw);
    if (!parsed) {
      setMessage({ text: "无法识别核销码，请重试或手输", error: true });
      return;
    }
    setCode(parsed);
    setRecord(null);
    setMessage({ text: `已识别核销码 ${parsed}`, error: false });
    const saved = window.sessionStorage.getItem(PASSWORD_KEY) || password;
    if (saved.trim()) {
      setPassword(saved.trim());
      void submit("query", parsed, saved.trim());
    } else {
      codeRef.current?.focus();
    }
  }

  async function stopScanner() {
    scanningRef.current = false;
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (scanner) {
      try {
        if (scanner.isScanning) await scanner.stop();
        await scanner.clear();
      } catch {
        // ignore
      }
    }
    setScanning(false);
  }

  async function startCameraScan() {
    setMessage(null);
    if (scanning) {
      await stopScanner();
      return;
    }
    setScanning(true);
    scanningRef.current = true;
    try {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const scanner = new Html5Qrcode(SCANNER_REGION_ID);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 8, qrbox: { width: 240, height: 240 } },
        (decoded) => {
          if (!scanningRef.current) return;
          scanningRef.current = false;
          void stopScanner().then(() => applyScannedRaw(decoded));
        },
        () => undefined,
      );
    } catch {
      setScanning(false);
      scanningRef.current = false;
      scannerRef.current = null;
      setMessage({
        text: "无法打开摄像头，请检查权限或改用手输 / 微信扫一扫",
        error: true,
      });
    }
  }

  function scanByWechat() {
    const wx = (window as unknown as { wx?: WxScanApi }).wx;
    if (!wx || !wxReady) {
      setMessage({
        text: "微信扫一扫暂不可用，请用摄像头扫码或手输",
        error: true,
      });
      return;
    }
    wx.scanQRCode({
      needResult: 1,
      scanType: ["qrCode"],
      success: (res) => {
        applyScannedRaw(res.resultStr || "");
      },
      fail: (res) => {
        setMessage({
          text: res.errMsg || "微信扫一扫失败",
          error: true,
        });
      },
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseRedeemCodeInput(code);
    if (parsed && parsed !== code) setCode(parsed);
    void submit("query", parsed || code);
  }

  function onCodeBlur() {
    const parsed = parseRedeemCodeInput(code);
    if (parsed && parsed !== code) setCode(parsed);
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

  // 首屏带 code 且已有密码时自动查询一次
  useEffect(() => {
    if (!initialCode) return;
    const saved = window.sessionStorage.getItem(PASSWORD_KEY);
    if (!saved) return;
    void submit("query", initialCode, saved);
    // 仅首屏触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

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
              onBlur={onCodeBlur}
              placeholder="扫码、粘贴链接或输入 6 位核销码"
              autoComplete="off"
              spellCheck={false}
            />
            <span style={{ fontSize: 12, color: "#8a6c5b" }}>
              支持扫客户二维码、粘贴核销链接，或手输 4~8 位数字码
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
          <div className="admin-actions" style={{ flexWrap: "wrap" }}>
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
            <button
              type="button"
              className="admin-btn secondary"
              onClick={() => void startCameraScan()}
              disabled={Boolean(busy)}
            >
              {scanning ? "关闭摄像头" : "扫码核销"}
            </button>
            {inWechat ? (
              <button
                type="button"
                className="admin-btn secondary"
                onClick={scanByWechat}
                disabled={Boolean(busy) || !wxReady}
                title={wxReady ? "调用微信扫一扫" : "微信 JS-SDK 未就绪"}
              >
                微信扫一扫
              </button>
            ) : null}
          </div>
          {scanning ? (
            <div
              id={SCANNER_REGION_ID}
              className="redeem-scanner"
              style={{ marginTop: 12, overflow: "hidden", borderRadius: 12 }}
            />
          ) : (
            <div id={SCANNER_REGION_ID} style={{ display: "none" }} />
          )}
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
            扫码或输入核销码查询后，会在这里显示奖品、中奖人与核销状态。
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
