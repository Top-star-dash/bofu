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

async function getAccessToken(appId: string, appSecret: string) {
  if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.value;

  const query = new URLSearchParams({
    grant_type: "client_credential",
    appid: appId,
    secret: appSecret,
  });
  const data = await fetchJson<{
    access_token?: string;
    expires_in?: number;
    errcode?: number;
  }>(`${TOKEN_URL}?${query.toString()}`);

  if (!data?.access_token) return null;
  tokenCache = {
    value: data.access_token,
    expiresAt: Date.now() + Math.max(60, (data.expires_in ?? 7200) - 200) * 1000,
  };
  return tokenCache.value;
}

async function getJsapiTicket(appId: string, appSecret: string) {
  if (ticketCache && ticketCache.expiresAt > Date.now()) return ticketCache.value;

  const token = await getAccessToken(appId, appSecret);
  if (!token) return null;

  const data = await fetchJson<{
    errcode?: number;
    ticket?: string;
    expires_in?: number;
  }>(`${TICKET_URL}?access_token=${token}&type=jsapi`);

  if (!data?.ticket) return null;
  ticketCache = {
    value: data.ticket,
    expiresAt: Date.now() + Math.max(60, (data.expires_in ?? 7200) - 200) * 1000,
  };
  return ticketCache.value;
}

export type JsSdkConfig = {
  appId: string;
  timestamp: number;
  nonceStr: string;
  signature: string;
};

/**
 * 微信 JS-SDK 签名。
 * url 必须是当前页面完整地址（不含 #hash），否则微信会报 invalid signature。
 */
export async function buildJsSdkConfig(rawUrl: string): Promise<JsSdkConfig | null> {
  const appId = process.env.WECHAT_APP_ID?.trim();
  const appSecret = process.env.WECHAT_APP_SECRET?.trim();
  if (!appId || !appSecret) return null;

  const ticket = await getJsapiTicket(appId, appSecret);
  if (!ticket) return null;

  const url = rawUrl.split("#")[0];
  const timestamp = Math.floor(Date.now() / 1000);
  const nonceStr = Math.random().toString(36).slice(2, 12);
  const plain = `jsapi_ticket=${ticket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${url}`;
  const signature = createHash("sha1").update(plain).digest("hex");

  return { appId, timestamp, nonceStr, signature };
}
