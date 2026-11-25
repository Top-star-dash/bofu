#!/usr/bin/env node
/**
 * 把 public 下的 jpg/png 批量转为 webp，并在转换成功后删除原图。
 * public 里只保留 webp，避免原图被误引用或部署时多传几十 MB。
 *
 *   node scripts/optimize-images.mjs
 *   node scripts/optimize-images.mjs --force   # 已有 webp 也重新生成
 *   node scripts/optimize-images.mjs --keep    # 保留原图（仅生成 webp）
 *
 * 代码里的 safeMediaUrl 会把 /property、/activity、/uploads 下的 jpg/png
 * 自动指向同名 webp，因此转换后无需改数据库；新上传图片由
 * /api/admin/upload 直接输出 webp。
 */
import { readdir, rename, stat, unlink } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOTS = ["public/property", "public/activity", "public/uploads"];
const MAX_EDGE = 1600;
const QUALITY = 80;
const FORCE = process.argv.includes("--force");
const KEEP = process.argv.includes("--keep");

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else files.push(full);
  }
  return files;
}

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(0)} KB`;
}

const stats = { converted: 0, skipped: 0, failed: 0, removed: 0, before: 0, after: 0 };

for (const root of ROOTS) {
  const files = await walk(root);
  for (const file of files) {
    if (!/\.(jpe?g|png)$/i.test(file)) continue;
    const output = file.replace(/\.(jpe?g|png)$/i, ".webp");
    try {
      const [sourceStat, outputStat] = await Promise.all([
        stat(file),
        stat(output).catch(() => null),
      ]);
      if (!FORCE && outputStat && outputStat.mtimeMs >= sourceStat.mtimeMs) {
        stats.skipped += 1;
        // 已有可用 webp，原图不再保留
        if (!KEEP) {
          await unlink(file);
          stats.removed += 1;
        }
        continue;
      }

      const temp = `${output}.tmp`;
      const info = await sharp(file)
        .rotate()
        .resize({
          width: MAX_EDGE,
          height: MAX_EDGE,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: QUALITY, effort: 5 })
        .toFile(temp);
      await rename(temp, output).catch(async (error) => {
        await unlink(temp).catch(() => {});
        throw error;
      });

      stats.converted += 1;
      stats.before += sourceStat.size;
      stats.after += info.size;
      if (!KEEP) {
        await unlink(file).catch(() => {});
        stats.removed += 1;
      }
      const delta = Math.round((1 - info.size / sourceStat.size) * 100);
      console.log(
        `${file}  ${formatKb(sourceStat.size)} → ${formatKb(info.size)}  (${delta >= 0 ? "-" : "+"}${Math.abs(delta)}%)`,
      );
    } catch (error) {
      stats.failed += 1;
      console.error(`失败 ${file}: ${error.message}`);
      await unlink(`${output}.tmp`).catch(() => {});
    }
  }
}

const saved = stats.before - stats.after;
console.log(
  `\n完成：转换 ${stats.converted}，跳过 ${stats.skipped}，失败 ${stats.failed}，删除原图 ${stats.removed}；` +
    `体积 ${formatKb(stats.before)} → ${formatKb(stats.after)}，节省 ${formatKb(saved)}`,
);
