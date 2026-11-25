import { createHash } from "node:crypto";

const TOKEN_URL = "https://api.weixin.qq.com/cgi-bin/token";
const TICKET_URL = "https://api.weixin.qq.com/cgi-bin/ticket/getticket";

type Cached = { value: string; expiresAt: number };

let tokenCache: Cached | null = null;
let ticketCache: Cached | null = null;

async function fetchJson<T>(url: string, timeoutMs = 6000): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });
    // 微信接口返回 text/plain
    return JSON.parse(await response.text()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

type TokenResult =
  | { ok: true; token: string }
  | { ok: false; reason: string };

type TicketResult =
  | { ok: true; ticket: string }
  | { ok: false; reason: string };

async function getAccessToken(
  appId: string,
  appSecret: string,
): Promise<TokenResult> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return { ok: true, token: tokenCache.value };
  }

  const query = new URLSearchParams({
    grant_type: "client_credential",
    appid: appId,
    secret: appSecret,
  });
  const data = await fetchJson<{
    access_token?: string;
    expires_in?: number;
    errcode?: number;
    errmsg?: string;
  }>(`${TOKEN_URL}?${query.toString()}`);

  if (!data?.access_token) {
    return {
      ok: false,
      reason: data?.errcode
        ? `token ${data.errcode}:${data.errmsg || "fail"}`
        : "token 请求失败",
    };
  }
  tokenCache = {
    value: data.access_token,
    expiresAt: Date.now() + Math.max(60, (data.expires_in ?? 7200) - 200) * 1000,
  };
  return { ok: true, token: tokenCache.value };
}

async function getJsapiTicket(
  appId: string,
  appSecret: string,
): Promise<TicketResult> {
  if (ticketCache && ticketCache.expiresAt > Date.now()) {
    return { ok: true, ticket: ticketCache.value };
  }

  const tokenResult = await getAccessToken(appId, appSecret);
  if (!tokenResult.ok) return tokenResult;

  const data = await fetchJson<{
    errcode?: number;
    errmsg?: string;
    ticket?: string;
    expires_in?: number;
  }>(`${TICKET_URL}?access_token=${tokenResult.token}&type=jsapi`);

  if (!data?.ticket) {
    return {
      ok: false,
      reason: data?.errcode
        ? `ticket ${data.errcode}:${data.errmsg || "fail"}`
        : "ticket 请求失败",
    };
  }
  ticketCache = {
    value: data.ticket,
    expiresAt: Date.now() + Math.max(60, (data.expires_in ?? 7200) - 200) * 1000,
  };
  return { ok: true, ticket: ticketCache.value };
}

export type JsSdkConfig = {
  appId: string;
  timestamp: number;
  nonceStr: string;
  signature: string;
};

export type JsSdkBuildResult =
  | { ok: true; config: JsSdkConfig }
  | { ok: false; reason: string };

/**
 * 微信 JS-SDK 签名。
 * url 必须是当前页面完整地址（不含 #hash），否则微信会报 invalid signature。
 */
export async function buildJsSdkConfig(
  rawUrl: string,
): Promise<JsSdkBuildResult> {
  const appId = process.env.WECHAT_APP_ID?.trim();
  const appSecret = process.env.WECHAT_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    return { ok: false, reason: "缺少 WECHAT_APP_ID/SECRET" };
  }

  const ticketResult = await getJsapiTicket(appId, appSecret);
  if (!ticketResult.ok) return ticketResult;

  const url = rawUrl.split("#")[0];
  const timestamp = Math.floor(Date.now() / 1000);
  const nonceStr = Math.random().toString(36).slice(2, 12);
  const plain = `jsapi_ticket=${ticketResult.ticket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${url}`;
  const signature = createHash("sha1").update(plain).digest("hex");

  return {
    ok: true,
    config: { appId, timestamp, nonceStr, signature },
  };
}
