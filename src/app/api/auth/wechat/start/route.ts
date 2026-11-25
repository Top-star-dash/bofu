import { NextResponse } from "next/server";
import {
  buildAuthorizeUrl,
  getWechatScope,
  isWechatBrowser,
  isWechatConfigured,
  normalizeReturnPath,
  resolveBaseUrl,
  signState,
} from "@/lib/wechat";

/**
 * 公众号网页授权入口。
 * GET /api/auth/wechat/start?r=/&c=<shareCode>&i=<inviterId>&force=1
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const base = resolveBaseUrl(request);
  const returnPath = normalizeReturnPath(url.searchParams.get("r"));
  const force = url.searchParams.get("force") === "1";
  const shareCode = url.searchParams.get("c") || undefined;
  const inviterId = url.searchParams.get("i") || undefined;

  const backTo = new URL(returnPath, base);
  if (shareCode) backTo.searchParams.set("c", shareCode);
  if (inviterId) backTo.searchParams.set("i", inviterId);

  if (!isWechatConfigured()) {
    backTo.searchParams.set("wx", "fail");
    backTo.searchParams.set("reason", "unconfigured");
    return NextResponse.redirect(backTo);
  }

  if (!force && !isWechatBrowser(request.headers.get("user-agent"))) {
    backTo.searchParams.set("wx", "fail");
    backTo.searchParams.set("reason", "browser");
    return NextResponse.redirect(backTo);
  }

  const state = signState({
    r: returnPath,
    c: shareCode,
    i: inviterId,
    t: Date.now(),
  });

  const authorizeUrl = buildAuthorizeUrl({
    appId: process.env.WECHAT_APP_ID!.trim(),
    redirectUri: `${base}/api/auth/wechat/callback`,
    scope: getWechatScope(),
    state,
  });

  return NextResponse.redirect(authorizeUrl);
}
