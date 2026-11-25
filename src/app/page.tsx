export const instant = false;

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import ActivityPage from "@/components/activity/ActivityPage";
import { getCustomerSession } from "@/lib/customer-session";
import { isWechatBrowser, isWechatConfigured } from "@/lib/wechat";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const shareCode = typeof params.c === "string" ? params.c : undefined;
  const inviterId = typeof params.i === "string" ? params.i : undefined;
  const wxState = typeof params.wx === "string" ? params.wx : undefined;
  const wxReason = typeof params.reason === "string" ? params.reason : undefined;

  const [session, headerList] = await Promise.all([
    getCustomerSession(),
    headers(),
  ]);

  const wechatMode =
    process.env.APP_ENV === "PRODUCTION" && isWechatConfigured();
  const inWechat = isWechatBrowser(headerList.get("user-agent"));
  const needsAuth = wechatMode && !session;

  // 微信内且未授权：静默走一次 OAuth；失败后带 wx=fail 回来，不再重试以防跳转死循环
  if (needsAuth && inWechat && wxState !== "fail") {
    const query = new URLSearchParams({ r: "/" });
    if (shareCode) query.set("c", shareCode);
    if (inviterId) query.set("i", inviterId);
    redirect(`/api/auth/wechat/start?${query.toString()}`);
  }

  return (
    <ActivityPage
      shareCode={shareCode}
      inviterId={inviterId}
      authRequired={needsAuth}
      authErrorReason={wxState === "fail" ? wxReason || "unknown" : null}
      inWechat={inWechat}
    />
  );
}
