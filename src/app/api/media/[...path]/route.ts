import { readFile } from "node:fs/promises";
import path from "node:path";
import { connection, NextResponse } from "next/server";

// cacheComponents 下不允许 dynamic / runtime 段配置，改用 connection() 声明动态渲染：
// 运行时新上传的文件不受 next start 的 public 静态清单/预渲染缓存影响

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
  // 等待真实请求，避免被 cacheComponents 预渲染成静态 404 缓存
  await connection();

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
