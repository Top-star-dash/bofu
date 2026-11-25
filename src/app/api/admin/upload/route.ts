import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { guardApi } from "@/lib/admin-guard";
import { safeMediaUrl } from "@/lib/urls";

const MAX_BYTES = 5 * 1024 * 1024;
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

  const now = new Date();
  const folder = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const filename = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}.${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", folder);

  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));

  const url = `/uploads/${folder}/${filename}`;
  return NextResponse.json({ ok: true, url: safeMediaUrl(url) });
}
