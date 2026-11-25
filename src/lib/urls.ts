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

/** 内容型图片地址：允许站内相对路径与 http(s)，其余丢弃 */
export function safeMediaUrl(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;
  if (text.startsWith("/") && !text.startsWith("//")) return text;
  return safeHttpUrl(text);
}
