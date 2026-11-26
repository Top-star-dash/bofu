/**
 * 核销码规则：4~8 位纯数字。
 * 统一生成 6 位，便于现场口述、手输与截图识别，也避免 4 位时冲突概率过高。
 */
export const REDEEM_CODE_LENGTH = 6;
export const REDEEM_CODE_MIN = 4;
export const REDEEM_CODE_MAX = 8;

const NUMERIC_PATTERN = /^\d{4,8}$/;
const LEGACY_PATTERN = /^[a-z0-9]{20,64}$/i;

/** 是否为符合新规则的数字核销码 */
export function isNumericRedeemCode(value: string) {
  return NUMERIC_PATTERN.test(value);
}

/** 新码或历史 cuid 码 */
export function isAcceptableRedeemCode(value: string) {
  return isNumericRedeemCode(value) || LEGACY_PATTERN.test(value);
}

/** 生成一个核销码（唯一性由调用方校验） */
export function generateRedeemCode() {
  const max = 10 ** REDEEM_CODE_LENGTH;
  return String(Math.floor(Math.random() * max)).padStart(
    REDEEM_CODE_LENGTH,
    "0",
  );
}

/** 去掉空格与连字符，兼容手输「1234 5678」「123-456」等写法 */
export function normalizeRedeemCode(raw: string) {
  return raw.replace(/[\s-]/g, "");
}

/** 后台核销台路径（相对） */
export function buildRedeemAdminPath(code: string) {
  const normalized = normalizeRedeemCode(code);
  return `/admin/redeem?code=${encodeURIComponent(normalized)}`;
}

/** 扫码用的绝对链接：origin 须为对外 https 域名 */
export function buildRedeemAdminUrl(origin: string, code: string) {
  return `${origin.replace(/\/+$/, "")}${buildRedeemAdminPath(code)}`;
}

/**
 * 从手输 / 粘贴 URL / 扫码结果中解析核销码。
 * 支持：纯码、?code=、完整 /admin/redeem?code= URL。
 */
export function parseRedeemCodeInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const fromQuery = trimmed.match(/[?&]code=([^&#]+)/i);
  if (fromQuery?.[1]) {
    try {
      const decoded = normalizeRedeemCode(decodeURIComponent(fromQuery[1]));
      if (isAcceptableRedeemCode(decoded)) return decoded;
    } catch {
      const decoded = normalizeRedeemCode(fromQuery[1]);
      if (isAcceptableRedeemCode(decoded)) return decoded;
    }
  }

  const normalized = normalizeRedeemCode(trimmed);
  if (isAcceptableRedeemCode(normalized)) return normalized;
  return null;
}
