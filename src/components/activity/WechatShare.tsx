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
      try {
        // 签名 URL 必须是浏览器当前地址（去 hash），与分享出去的助力链接无关。
        const pageUrl = window.location.href.split("#")[0];
        const debug = /(?:\?|&)wxdebug=1(?:&|$)/.test(window.location.search);
        const response = await fetch(
          `/api/wechat/jssdk?url=${encodeURIComponent(pageUrl)}`,
        );
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            reason?: string;
            message?: string;
          } | null;
          console.warn(
            "[WechatShare] jssdk 签名失败",
            body?.reason || body?.message || response.status,
          );
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
        if (!wx) return;

        wx.config({
          debug,
          appId: config.appId,
          timestamp: config.timestamp,
          nonceStr: config.nonceStr,
          signature: config.signature,
          jsApiList: ["updateAppMessageShareData", "updateTimelineShareData"],
        });

        wx.error((res) => {
          console.warn("[WechatShare] wx.config 失败", res?.errMsg || res);
        });

        // 分享出去的链接才是带归因参数的助力链接；无 customer 时降级为当前地址
        const shareLink = link || pageUrl;
        const coverUrl = toAbsoluteUrl(cover);

        wx.ready(() => {
          if (cancelled) return;
          wx.updateAppMessageShareData({
            title,
            desc,
            link: shareLink,
            ...(coverUrl ? { imgUrl: coverUrl } : {}),
            fail: (res) =>
              console.warn("[WechatShare] 好友分享设置失败", res?.errMsg),
          });
          wx.updateTimelineShareData({
            title,
            link: shareLink,
            ...(coverUrl ? { imgUrl: coverUrl } : {}),
            fail: (res) =>
              console.warn("[WechatShare] 朋友圈分享设置失败", res?.errMsg),
          });
        });
      } catch (error) {
        console.warn("[WechatShare] 初始化异常", error);
      }
    }

    void setup();
    return () => {
      cancelled = true;
    };
  }, [enabled, link, title, desc, cover]);

  return null;
}
