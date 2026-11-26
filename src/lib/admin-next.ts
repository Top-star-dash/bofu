/**
 * 后台登录回跳：只允许站内 /admin 相对路径，防止开放重定向。
 */
export function safeAdminNext(raw: string | null | undefined): string {
  if (!raw) return "/admin";
  const value = raw.trim();
  if (!value.startsWith("/admin")) return "/admin";
  if (value.startsWith("//")) return "/admin";
  if (value.includes("://")) return "/admin";
  if (/[\r\n\\]/.test(value)) return "/admin";
  return value;
}
