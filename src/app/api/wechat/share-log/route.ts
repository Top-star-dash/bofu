import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  event: z.enum([
    "jssdk_sign_fail",
    "wx_config_error",
    "wx_ready_ok",
    "share_update_fail",
    "init_exception",
  ]),
  message: z.string().trim().max(500).optional().nullable(),
  pageUrl: z.string().trim().max(800).optional().nullable(),
  shareLink: z.string().trim().max(800).optional().nullable(),
  ua: z.string().trim().max(300).optional().nullable(),
});

/** 轻量微信分享诊断：写入服务端日志，便于对照线上是否 config 成功 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { event, message, pageUrl, shareLink, ua } = parsed.data;
  const line = [
    `[WechatShare] ${event}`,
    message ? `msg=${message}` : null,
    pageUrl ? `page=${pageUrl}` : null,
    shareLink ? `link=${shareLink}` : null,
    ua ? `ua=${ua.slice(0, 120)}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  if (event === "wx_ready_ok") {
    console.info(line);
  } else {
    console.warn(line);
  }

  return new NextResponse(null, { status: 204 });
}
