import { config } from '../config.js';

/**
 * นาฬิกาจำลองสำหรับสาธิต (เปิดเฉพาะ NODE_ENV=demo)
 * ใช้เทียบ deadline/เวลาทำการเท่านั้น — audit และ timestamp ในฐานข้อมูลใช้เวลาจริงเสมอ
 */
let overrideMinutes = null;

const MINUTES_PER_DAY = 24 * 60;

export function setDemoTime(hhmm) {
  if (!config.isDemo) return false;
  if (hhmm === null) {
    overrideMinutes = null;
    return true;
  }
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!match) return false;
  overrideMinutes = Number(match[1]) * 60 + Number(match[2]);
  return true;
}

export const getDemoTime = () =>
  overrideMinutes === null ? null : minutesToHhmm(overrideMinutes);

/** เวลาที่ใช้ตัดสินใจ (อาจเป็นเวลาจำลอง) */
export function now() {
  const real = new Date();
  if (overrideMinutes === null) return real;
  const simulated = new Date(real);
  simulated.setHours(Math.floor(overrideMinutes / 60), overrideMinutes % 60, 0, 0);
  return simulated;
}

export const minutesOfDay = (date = now()) => date.getHours() * 60 + date.getMinutes();

export const minutesToHhmm = (minutes) => {
  const wrapped = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
};

/** 'HH:MM[:SS]' → นาทีนับจากเที่ยงคืน · ค่าว่าง → null */
export function parseTimeToMinutes(time) {
  if (!time) return null;
  const [hours, minutes] = String(time).split(':');
  return Number(hours) * 60 + Number(minutes);
}

/** สิ้นวันของวันนี้ (เวลาจริง) — ใช้เป็นวันหมดอายุของ token ผู้ป่วย */
export function endOfToday() {
  const end = new Date();
  end.setHours(23, 59, 59, 0);
  return end;
}
