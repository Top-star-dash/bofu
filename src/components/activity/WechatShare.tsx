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
    if (!enabled || !link) return;
    let cancelled = false;

    async function setup() {
      try {
        const pageUrl = link.split("#")[0];
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

        wx.ready(() => {
          if (cancelled) return;
          wx.updateAppMessageShareData({ title, desc, link, imgUrl: cover });
          wx.updateTimelineShareData({ title, link, imgUrl: cover });
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
