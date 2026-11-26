import QRCode from "qrcode";
import { guardApi } from "@/lib/admin-guard";
import { resolveBaseUrl } from "@/lib/wechat";

/**
 * E.2.6 顾问推广二维码。
 * 默认返回 SVG（后台弹窗内直接展示）；format=png 返回位图，download=1 时作为附件下载。
 */
export async function GET(request: Request) {
  const guard = await guardApi("consultants");
  if (guard.error) return guard.error;

  const url = new URL(request.url);
  const code = url.searchParams.get("code")?.trim();
  if (!code || !/^[A-Za-z0-9_-]{1,32}$/.test(code)) {
    return new Response("缺少有效的分享码", { status: 400 });
  }

  const format = url.searchParams.get("format") === "png" ? "png" : "svg";
  const download = url.searchParams.get("download") === "1";
  const link = `${resolveBaseUrl(request)}/?c=${encodeURIComponent(code)}`;

  if (format === "png") {
    const buffer = await QRCode.toBuffer(link, {
      type: "png",
      margin: 2,
      width: 720,
      errorCorrectionLevel: "M",
    });
    const headers: Record<string, string> = {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=600",
    };
    if (download) {
      headers["Content-Disposition"] = `attachment; filename="qrcode-${code}.png"`;
    }
    return new Response(new Uint8Array(buffer), { headers });
  }

  const svg = await QRCode.toString(link, {
    type: "svg",
    margin: 1,
    width: 320,
    errorCorrectionLevel: "M",
  });

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "private, max-age=600",
    },
  });
}
