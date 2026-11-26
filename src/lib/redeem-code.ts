/**
 * 核销码规则：4~8 位纯数字。
 * 统一生成 6 位，便于现场口述、手输与截图识别，也避免 4 位时冲突概率过高。
 */
export const REDEEM_CODE_LENGTH = 6;
export const REDEEM_CODE_MIN = 4;
export const REDEEM_CODE_MAX = 8;

const NUMERIC_PATTERN = /^\d{4,8}$/;

/** 是否为符合新规则的数字核销码 */
export function isNumericRedeemCode(value: string) {
  return NUMERIC_PATTERN.test(value);
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
