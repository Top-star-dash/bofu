import { NextResponse } from "next/server";
import {
  findConsultantByCode,
  getCurrentActivity,
} from "@/lib/activity";
import {
  createCustomerSession,
  ensureCustomer,
} from "@/lib/customer-session";
import {
  exchangeCodeForToken,
  fetchWechatUserProfile,
  getWechatScope,
  isWechatConfigured,
  normalizeReturnPath,
  resolveBaseUrl,
  verifyState,
} from "@/lib/wechat";

/**
 * 微信授权回调：code 换 openid → 建/取客户 → 写 session cookie → 回跳首页。
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const base = resolveBaseUrl(request);
  const state = verifyState(url.searchParams.get("state"));
  const returnPath = normalizeReturnPath(state?.r);

  const backTo = new URL(returnPath, base);
  if (state?.c) backTo.searchParams.set("c", state.c);
  if (state?.i) backTo.searchParams.set("i", state.i);

  const fail = (reason: string, detail?: string) => {
    backTo.searchParams.set("wx", "fail");
    backTo.searchParams.set("reason", reason);
    if (detail) backTo.searchParams.set("detail", detail.slice(0, 120));
    return NextResponse.redirect(backTo);
  };

  if (!isWechatConfigured()) return fail("unconfigured");

  const code = url.searchParams.get("code");
  if (!code) return fail("denied");

  if (!state) return fail("state");

  const token = await exchangeCodeForToken(code);
  if (!token.ok) {
    return fail("exchange", `${token.errcode}:${token.errmsg}`);
  }

  const activity = await getCurrentActivity();
  if (!activity) return fail("activity");

  const consultant = await findConsultantByCode(activity.id, state.c);

  const profile =
    getWechatScope() === "snsapi_userinfo"
      ? await fetchWechatUserProfile(token.accessToken, token.openid)
      : null;

  const customer = await ensureCustomer({
    activityId: activity.id,
    openid: token.openid,
    consultantId: consultant?.id,
    inviterId: state.i,
    nickname: profile?.nickname ?? null,
    avatarUrl: profile?.avatarUrl ?? null,
  });

  await createCustomerSession({
    customerId: customer.id,
    activityId: activity.id,
    openid: token.openid,
  });

  backTo.searchParams.set("wx", "ok");
  return NextResponse.redirect(backTo);
}
