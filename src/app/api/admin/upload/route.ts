import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { NextResponse } from "next/server";
import { guardApi } from "@/lib/admin-guard";
import { safeMediaUrl } from "@/lib/urls";

const MAX_BYTES = 5 * 1024 * 1024;
// H5 展示最大边 1600px 足够，超出部分等比缩放；质量 80 兼顾清晰度与体积
const MAX_EDGE = 1600;
const WEBP_QUALITY = 80;
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** D.4 素材上传：写入 public/uploads/年月，返回可直接引用的站内地址 */
export async function POST(request: Request) {
  const guard = await guardApi("assets");
  if (guard.error) return guard.error;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "请选择要上传的图片" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ message: "图片不能超过 5MB" }, { status: 400 });
  }

  const ext = EXT_BY_TYPE[file.type];
  if (!ext) {
    return NextResponse.json(
      { message: "只支持 jpg / png / webp / gif" },
      { status: 400 },
    );
  }

  const input = Buffer.from(await file.arrayBuffer());
  let output = input;
  let outExt = ext;
  // gif 可能为动图，sharp 默认只取首帧，保持原样
  if (ext !== "gif") {
    const compressed = await sharp(input)
      .rotate() // 按 EXIF 校正方向
      .resize({
        width: MAX_EDGE,
        height: MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer()
      .catch(() => null);
    // 压缩后更小才采用，避免小图反而变大
    if (compressed && compressed.length < input.length) {
      output = compressed;
      outExt = "webp";
    }
  }

  const now = new Date();
  const folder = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const filename = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}.${outExt}`;
  const dir = path.join(process.cwd(), "public", "uploads", folder);

  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), output);

  // 走动态媒体路由，避免 next start 对运行时新增 public 文件的 404 缓存
  const url = `/api/media/uploads/${folder}/${filename}`;
  return NextResponse.json({
    ok: true,
    url: safeMediaUrl(url),
    compressed: outExt === "webp",
    originalBytes: input.length,
    outputBytes: output.length,
  });
}
