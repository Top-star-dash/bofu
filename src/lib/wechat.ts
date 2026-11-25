import { createHmac, timingSafeEqual } from "node:crypto";

const AUTHORIZE_URL = "https://open.weixin.qq.com/connect/oauth2/authorize";
const ACCESS_TOKEN_URL = "https://api.weixin.qq.com/sns/oauth2/access_token";
const USER_INFO_URL = "https://api.weixin.qq.com/sns/userinfo";
const STATE_MAX_AGE_MS = 10 * 60 * 1000;

export type WechatOAuthState = {
  /** 授权完成后回跳的前端路径 */
  r: string;
  /** 分享码（顾问） */
  c?: string;
  /** 邀请人 customerId */
  i?: string;
  /** 签发时间 */
  t: number;
};

export function isWechatBrowser(userAgent: string | null | undefined) {
  return Boolean(userAgent && /MicroMessenger/i.test(userAgent));
}

export function isWechatConfigured() {
  return Boolean(
    process.env.WECHAT_APP_ID?.trim() && process.env.WECHAT_APP_SECRET?.trim(),
  );
}

export function getWechatScope() {
  const scope = process.env.WECHAT_OAUTH_SCOPE?.trim();
  return scope === "snsapi_base" ? "snsapi_base" : "snsapi_userinfo";
}

/**
 * 反代场景下 request.url 可能是 http://127.0.0.1:3007，
 * 优先使用显式配置，其次读反代透传头，最后退回请求自身。
 */
export function resolveBaseUrl(request: Request) {
  const configured =
    process.env.PUBLIC_BASE_URL?.trim() ||
    process.env.WECHAT_OAUTH_REDIRECT_BASE?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const url = new URL(request.url);
  const proto =
    firstHeaderValue(request.headers.get("x-forwarded-proto")) ||
    url.protocol.replace(":", "");
  const host =
    firstHeaderValue(request.headers.get("x-forwarded-host")) ||
    firstHeaderValue(request.headers.get("host")) ||
    url.host;
  return `${proto}://${host}`;
}

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || "";
}

function stateSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is missing");
  return secret;
}

export function normalizeReturnPath(path: string | null | undefined) {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return "/";
  return path;
}

/** state 用 HMAC 签名，避免回调被构造为开放重定向 */
export function signState(state: WechatOAuthState) {
  const payload = Buffer.from(JSON.stringify(state), "utf8").toString(
    "base64url",
  );
  const signature = createHmac("sha256", stateSecret())
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyState(raw: string | null | undefined): WechatOAuthState | null {
  if (!raw) return null;
  const [payload, signature] = raw.split(".");
  if (!payload || !signature) return null;

  const expected = createHmac("sha256", stateSecret())
    .update(payload)
    .digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as WechatOAuthState;
    if (!parsed || typeof parsed.t !== "number") return null;
    if (Date.now() - parsed.t > STATE_MAX_AGE_MS) return null;
    return {
      r: normalizeReturnPath(parsed.r),
      c: typeof parsed.c === "string" ? parsed.c : undefined,
      i: typeof parsed.i === "string" ? parsed.i : undefined,
      t: parsed.t,
    };
  } catch {
    return null;
  }
}

export function buildAuthorizeUrl(params: {
  appId: string;
  redirectUri: string;
  scope: string;
  state: string;
}) {
  const query = new URLSearchParams({
    appid: params.appId,
    redirect_uri: params.redirectUri,
    response_type: "code",
    scope: params.scope,
    state: params.state,
  });
  return `${AUTHORIZE_URL}?${query.toString()}#wechat_redirect`;
}

type WechatTokenResult =
  | { ok: true; openid: string; accessToken: string; scope: string }
  | { ok: false; errcode: number; errmsg: string };

async function fetchWechatJson<T>(url: string, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });
    // 微信接口返回 text/plain，不能直接用 response.json()
    const text = await response.text();
    return JSON.parse(text) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function exchangeCodeForToken(
  code: string,
): Promise<WechatTokenResult> {
  const appId = process.env.WECHAT_APP_ID?.trim();
  const appSecret = process.env.WECHAT_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    return { ok: false, errcode: -1, errmsg: "WECHAT_NOT_CONFIGURED" };
  }

  const query = new URLSearchParams({
    appid: appId,
    secret: appSecret,
    code,
    grant_type: "authorization_code",
  });

  try {
    const data = await fetchWechatJson<{
      openid?: string;
      access_token?: string;
      scope?: string;
      errcode?: number;
      errmsg?: string;
    }>(`${ACCESS_TOKEN_URL}?${query.toString()}`);

    if (!data.openid || !data.access_token) {
      return {
        ok: false,
        errcode: data.errcode ?? -1,
        errmsg: data.errmsg || "EXCHANGE_FAILED",
      };
    }

    return {
      ok: true,
      openid: data.openid,
      accessToken: data.access_token,
      scope: data.scope || "",
    };
  } catch (error) {
    return {
      ok: false,
      errcode: -2,
      errmsg: error instanceof Error ? error.message : "NETWORK_ERROR",
    };
  }
}

export async function fetchWechatUserProfile(
  accessToken: string,
  openid: string,
) {
  const query = new URLSearchParams({
    access_token: accessToken,
    openid,
    lang: "zh_CN",
  });

  try {
    const data = await fetchWechatJson<{
      nickname?: string;
      headimgurl?: string;
      errcode?: number;
    }>(`${USER_INFO_URL}?${query.toString()}`);
    if (data.errcode) return null;
    return {
      nickname: data.nickname || null,
      avatarUrl: data.headimgurl || null,
    };
  } catch {
    return null;
  }
}
