import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

// 动态读盘：运行时新上传的文件不受 next start 的 public 静态清单/预渲染缓存影响
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  if (!segments?.length) {
    return new NextResponse("Not Found", { status: 404 });
  }

  // 仅允许 uploads/YYYYMM/文件，防目录穿越
  const rel = segments.join("/");
  if (!/^uploads\/\d{6}\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp|gif)$/i.test(rel)) {
    return new NextResponse("Not Found", { status: 404 });
  }
  const ext = path.extname(rel).toLowerCase();

  try {
    const file = await readFile(path.join(process.cwd(), "public", rel));
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": MIME[ext] || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not Found", { status: 404 });
  }
}
