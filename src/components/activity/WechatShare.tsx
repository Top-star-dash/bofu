"use client";

import { useEffect } from "react";

type SharePayload = {
  title: string;
  desc?: string;
  link: string;
  imgUrl?: string;
};

type WxApi = {
  config: (options: Record<string, unknown>) => void;
  ready: (callback: () => void) => void;
  updateAppMessageShareData: (payload: SharePayload) => void;
  updateTimelineShareData: (payload: Omit<SharePayload, "desc">) => void;
};

const SCRIPT_ID = "wechat-jssdk";

function loadSdk() {
  return new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      resolve();
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
        // 用助力链接签名会触发 invalid signature，导致 wx.config 失败、分享退回 URL 链接。
        const pageUrl = window.location.href.split("#")[0];
        const response = await fetch(
          `/api/wechat/jssdk?url=${encodeURIComponent(pageUrl)}`,
        );
        if (!response.ok) return;
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
          debug: false,
          appId: config.appId,
          timestamp: config.timestamp,
          nonceStr: config.nonceStr,
          signature: config.signature,
          jsApiList: ["updateAppMessageShareData", "updateTimelineShareData"],
        });

        // 分享出去的链接才是带归因参数的助力链接；无 customer 时降级为当前地址
        const shareLink = link || pageUrl;
        // 微信分享封面要求可访问的绝对地址，站内相对路径补全为当前 origin
        const coverUrl = /^https?:\/\//i.test(cover)
          ? cover
          : cover.startsWith("/")
            ? `${window.location.origin}${cover}`
            : "";

        wx.ready(() => {
          if (cancelled) return;
          wx.updateAppMessageShareData({
            title,
            desc,
            link: shareLink,
            ...(coverUrl ? { imgUrl: coverUrl } : {}),
          });
          wx.updateTimelineShareData({
            title,
            link: shareLink,
            ...(coverUrl ? { imgUrl: coverUrl } : {}),
          });
        });
      } catch {
        // 分享失败不影响页面使用
      }
    }

    void setup();
    return () => {
      cancelled = true;
    };
  }, [enabled, link, title, desc, cover]);

  return null;
}
