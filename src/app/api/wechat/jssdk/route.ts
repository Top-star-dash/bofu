import { NextResponse } from "next/server";
import { buildJsSdkConfig } from "@/lib/wechat-jssdk";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const target = url.searchParams.get("url")?.trim();
  if (!target || !/^https?:\/\//i.test(target)) {
    return NextResponse.json({ message: "缺少有效页面地址" }, { status: 400 });
  }

  const result = await buildJsSdkConfig(target);
  if (!result.ok) {
    return NextResponse.json(
      { message: "微信 JS-SDK 未就绪", reason: result.reason },
      { status: 503 },
    );
  }

  return NextResponse.json(result.config, {
    headers: { "Cache-Control": "no-store" },
  });
}
