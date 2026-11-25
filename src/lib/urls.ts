/** 只接受 http(s) 绝对地址，避免 javascript: / data: 等伪协议进入 a[href] */
export function safeHttpUrl(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function isHttpUrl(value: string | null | undefined) {
  return safeHttpUrl(value) !== null;
}

/** 站内静态素材与历史上传图只保留 WebP，引用 jpg/png 时自动指向同名 webp */
function preferStaticWebp(text: string) {
  return text
    .replace(/^\/(property|activity)\/(.+)\.(jpe?g|png)$/i, "/$1/$2.webp")
    .replace(/(\/uploads\/.+)\.(jpe?g|png)$/i, "$1.webp");
}

/**
 * 内容型图片地址：允许站内相对路径与 http(s)，其余丢弃。
 * 站内 jpg/png 一律改写为同名 webp —— public 下已不再保留原图。
 */
export function safeMediaUrl(
  value: string | null | undefined,
): string | null {
  const text = value?.trim();
  if (!text) return null;
  if (text.startsWith("/") && !text.startsWith("//")) {
    return preferStaticWebp(text);
  }
  return safeHttpUrl(text);
}

/**
 * 归一化站内上传图片地址：旧 `/uploads/YYYYMM/xxx` 在 next start 下会被
 * 预渲染的 404 缓存遮蔽，统一改走动态媒体路由 `/api/media/uploads/...`。
 */
export function normalizeMediaUrl(
  value: string | null | undefined,
): string | null {
  const safe = safeMediaUrl(value);
  if (!safe) return null;
  if (safe.startsWith("/uploads/")) return `/api/media${safe}`;
  return safe;
}

export type MapLinkItem = { name: string; url: string };

const MAP_LINK_MAX = 5;

/** 解析活动地图导航列表；空列表时回落旧字段 mapUrl */
export function resolveMapLinks(
  raw: unknown,
  fallbackUrl?: string | null,
): MapLinkItem[] {
  const items: MapLinkItem[] = [];
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (!entry || typeof entry !== "object") continue;
      const name =
        typeof (entry as { name?: unknown }).name === "string"
          ? (entry as { name: string }).name.trim()
          : "";
      const url = safeHttpUrl(
        typeof (entry as { url?: unknown }).url === "string"
          ? (entry as { url: string }).url
          : null,
      );
      if (!name || !url || name.length > 20) continue;
      items.push({ name: name.slice(0, 20), url });
      if (items.length >= MAP_LINK_MAX) break;
    }
  }
  if (items.length > 0) return items;
  const legacy = safeHttpUrl(fallbackUrl);
  return legacy ? [{ name: "打开地图导航", url: legacy }] : [];
}
