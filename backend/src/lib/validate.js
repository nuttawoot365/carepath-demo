import { badRequest } from './errors.js';

/** ตัดคอลัมน์ที่เซิร์ฟเวอร์ต้องเป็นคนตั้งเองออกจาก body เสมอ */
const SERVER_OWNED = /_at$|^id$|^token$|^short_code$|^password_hash$/;

export const stripServerFields = (body = {}) =>
  Object.fromEntries(Object.entries(body).filter(([key]) => !SERVER_OWNED.test(key)));

export function requireFields(body, fields) {
  const missing = fields.filter((field) => body?.[field] === undefined || body[field] === null);
  if (missing.length > 0) {
    throw badRequest(`ข้อมูลไม่ครบ: ${missing.join(', ')}`, `Missing fields: ${missing.join(', ')}`);
  }
  return body;
}

export function requireOneOf(value, allowed, field) {
  if (!allowed.includes(value)) {
    throw badRequest(
      `${field} ต้องเป็นค่าใดค่าหนึ่งใน ${allowed.join(', ')}`,
      `${field} must be one of ${allowed.join(', ')}`,
    );
  }
  return value;
}

export const asPositiveInt = (value, field) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw badRequest(`${field} ไม่ถูกต้อง`, `Invalid ${field}`);
  }
  return parsed;
};

/** profile รับเฉพาะ flag boolean ที่รู้จัก — กันข้อมูลแปลกปลอมเข้า JSONB */
const PROFILE_FLAGS = ['wheelchair', 'elderly', 'low_vision', 'needs_companion'];

export const sanitizeProfile = (profile = {}) =>
  Object.fromEntries(
    PROFILE_FLAGS.filter((flag) => profile?.[flag] === true).map((flag) => [flag, true]),
  );
