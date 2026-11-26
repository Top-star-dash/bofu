/** 后台规则文案：运营用纯文本编辑，存库仍为安全 HTML（换行 → br） */

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 纯文本 → 规则 HTML：保留回车换行 */
export function plainToRulesHtml(plain: string) {
  const text = plain.replace(/\r\n/g, "\n").replace(/^\n+|\n+$/g, "");
  if (!text.trim()) return "";
  return `<p>${escapeHtml(text).replace(/\n/g, "<br>")}</p>`;
}

/** 已有规则 HTML → 纯文本，便于非技术人员继续编辑 */
export function rulesHtmlToPlain(html: string) {
  if (!html) return "";
  return html
    .replace(/\r\n/g, "\n")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*p\s*>\s*<\s*p[^>]*>/gi, "\n\n")
    .replace(/<\/\s*div\s*>\s*<\s*div[^>]*>/gi, "\n\n")
    .replace(/<\/\s*p\s*>/gi, "\n")
    .replace(/<\/\s*div\s*>/gi, "\n")
    .replace(/<\s*p[^>]*>/gi, "")
    .replace(/<\s*div[^>]*>/gi, "")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, "&")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+|\n+$/g, "");
}
