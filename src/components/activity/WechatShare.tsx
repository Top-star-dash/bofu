"use client";

import { useEffect } from "react";

type SharePayload = {
  title: string;
  desc?: string;
  link: string;
  imgUrl?: string;
  success?: () => void;
  fail?: (res: { errMsg?: string }) => void;
};

type WxApi = {
  config: (options: Record<string, unknown>) => void;
  ready: (callback: () => void) => void;
  error: (callback: (res: { errMsg?: string }) => void) => void;
  updateAppMessageShareData: (payload: SharePayload) => void;
  updateTimelineShareData: (payload: Omit<SharePayload, "desc">) => void;
};

type ShareLogEvent =
  | "jssdk_sign_fail"
  | "wx_config_error"
  | "wx_ready_ok"
  | "share_update_fail"
  | "init_exception";

const SCRIPT_ID = "wechat-jssdk";

function loadSdk() {
  return new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if ((window as unknown as { wx?: WxApi }).wx) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("JS-SDK 加载失败")),
        { once: true },
      );
      return;
    }
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = "https://res.wx.qq.com/open/js/jweixin-1.6.0.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("JS-SDK 加载失败"));
    document.head.appendChild(script);
  });
}

function toAbsoluteUrl(path: string) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/")) return `${window.location.origin}${path}`;
  return "";
}

function reportShareLog(
  event: ShareLogEvent,
  payload: {
    message?: string;
    pageUrl?: string;
    shareLink?: string;
  },
) {
  const body = JSON.stringify({
    event,
    message: payload.message?.slice(0, 500) || null,
    pageUrl: payload.pageUrl?.slice(0, 800) || null,
    shareLink: payload.shareLink?.slice(0, 800) || null,
    ua: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 300) : null,
  });
  // 不阻塞页面：优先 sendBeacon，失败再 fetch keepalive
  try {
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon("/api/wechat/share-log", blob)) return;
    }
  } catch {
    // ignore
  }
  void fetch("/api/wechat/share-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

/** F.1 微信内自定义分享：标题/摘要/封面走活动配置，链接带 i、c 参数 */
export default function WechatShare({
  enabled,
  link,
  title,
  desc,
  cover,
}: {
  enabled: boolean;
  link: string;
  title: string;
  desc: string;
  cover: string;
}) {
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function setup() {
      const pageUrl = window.location.href.split("#")[0];
      try {
        // 签名 URL 必须是浏览器当前地址（去 hash），与分享出去的助力链接无关。
        const debug = /(?:\?|&)wxdebug=1(?:&|$)/.test(window.location.search);
        const response = await fetch(
          `/api/wechat/jssdk?url=${encodeURIComponent(pageUrl)}`,
        );
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            reason?: string;
            message?: string;
          } | null;
          const reason = body?.reason || body?.message || String(response.status);
          console.warn("[WechatShare] jssdk 签名失败", reason);
          reportShareLog("jssdk_sign_fail", { message: reason, pageUrl });
          return;
        }
        const config = (await response.json()) as {
          appId: string;
          timestamp: number;
          nonceStr: string;
          signature: string;
        };
        await loadSdk();
        if (cancelled) return;

        const wx = (window as unknown as { wx?: WxApi }).wx;
        if (!wx) {
          reportShareLog("init_exception", {
            message: "window.wx missing",
            pageUrl,
          });
          return;
        }

        const shareLink = link || pageUrl;
        const coverUrl = toAbsoluteUrl(cover);

        wx.config({
          debug,
          appId: config.appId,
          timestamp: config.timestamp,
          nonceStr: config.nonceStr,
          signature: config.signature,
          jsApiList: ["updateAppMessageShareData", "updateTimelineShareData"],
        });

        wx.error((res) => {
          const message = res?.errMsg || "wx.config error";
          console.warn("[WechatShare] wx.config 失败", message);
          reportShareLog("wx_config_error", {
            message,
            pageUrl,
            shareLink,
          });
        });

        wx.ready(() => {
          if (cancelled) return;
          reportShareLog("wx_ready_ok", { pageUrl, shareLink });
          wx.updateAppMessageShareData({
            title,
            desc,
            link: shareLink,
            ...(coverUrl ? { imgUrl: coverUrl } : {}),
            fail: (res) => {
              const message = res?.errMsg || "updateAppMessageShareData fail";
              console.warn("[WechatShare] 好友分享设置失败", message);
              reportShareLog("share_update_fail", {
                message: `app:${message}`,
                pageUrl,
                shareLink,
              });
            },
          });
          wx.updateTimelineShareData({
            title,
            link: shareLink,
            ...(coverUrl ? { imgUrl: coverUrl } : {}),
            fail: (res) => {
              const message = res?.errMsg || "updateTimelineShareData fail";
              console.warn("[WechatShare] 朋友圈分享设置失败", message);
              reportShareLog("share_update_fail", {
                message: `timeline:${message}`,
                pageUrl,
                shareLink,
              });
            },
          });
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "WechatShare init exception";
        console.warn("[WechatShare] 初始化异常", error);
        reportShareLog("init_exception", { message, pageUrl });
      }
    }

    void setup();
    return () => {
      cancelled = true;
    };
  }, [enabled, link, title, desc, cover]);

  return null;
}
