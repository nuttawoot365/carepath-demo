import { badRequest } from './errors';

/** ตัดคอลัมน์ที่เซิร์ฟเวอร์ต้องเป็นคนตั้งเองออกจาก body เสมอ */
const SERVER_OWNED = /_at$|^id$|^token$|^short_code$|^password_hash$/;

export const stripServerFields = (body: Record<string, unknown> = {}) =>
  Object.fromEntries(Object.entries(body).filter(([key]) => !SERVER_OWNED.test(key)));

export function requireFields<T extends object>(body: T | undefined, fields: (keyof T & string)[]): T {
  const values = body as Record<string, unknown> | undefined;
  const missing = fields.filter((field) => values?.[field] === undefined || values[field] === null);
  if (missing.length > 0) {
    throw badRequest(`ข้อมูลไม่ครบ: ${missing.join(', ')}`, `Missing fields: ${missing.join(', ')}`);
  }
  return body as T;
}

export function requireOneOf<T extends string>(value: string, allowed: readonly T[], field: string): T {
  if (!(allowed as readonly string[]).includes(value)) {
    throw badRequest(
      `${field} ต้องเป็นค่าใดค่าหนึ่งใน ${allowed.join(', ')}`,
      `${field} must be one of ${allowed.join(', ')}`,
    );
  }
  return value as T;
}

export const asPositiveInt = (value: unknown, field: string): number => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw badRequest(`${field} ไม่ถูกต้อง`, `Invalid ${field}`);
  }
  return parsed;
};

/** profile รับเฉพาะ flag boolean ที่รู้จัก — กันข้อมูลแปลกปลอมเข้า JSONB */
const PROFILE_FLAGS = ['wheelchair', 'elderly', 'low_vision', 'needs_companion'] as const;

export type PatientProfile = Partial<Record<(typeof PROFILE_FLAGS)[number], true>> & {
  has_phone?: boolean;
};

export const sanitizeProfile = (profile: Record<string, unknown> | undefined = {}): PatientProfile =>
  Object.fromEntries(
    PROFILE_FLAGS.filter((flag) => profile?.[flag] === true).map((flag) => [flag, true]),
  ) as PatientProfile;
