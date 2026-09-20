import { Inject, Injectable } from '@nestjs/common';
import { AppConfig, CONFIG } from '../config/config';

const MINUTES_PER_DAY = 24 * 60;

export const minutesToHhmm = (minutes: number): string => {
  const wrapped = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
};

/** 'HH:MM[:SS]' → นาทีนับจากเที่ยงคืน · ค่าว่าง → null */
export function parseTimeToMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const [hours, minutes] = String(time).split(':');
  return Number(hours) * 60 + Number(minutes);
}

/** สิ้นวันของวันนี้ (เวลาจริง) — ใช้เป็นวันหมดอายุของ token ผู้ป่วย */
export function endOfToday(): Date {
  const end = new Date();
  end.setHours(23, 59, 59, 0);
  return end;
}

/**
 * นาฬิกาจำลองสำหรับสาธิต (เปิดเฉพาะ NODE_ENV=demo)
 * ใช้เทียบ deadline/เวลาทำการเท่านั้น — audit และ timestamp ในฐานข้อมูลใช้เวลาจริงเสมอ
 */
@Injectable()
export class ClockService {
  private overrideMinutes: number | null = null;

  constructor(@Inject(CONFIG) private readonly config: AppConfig) {}

  setDemoTime(hhmm: string | null): boolean {
    if (!this.config.isDemo) return false;
    if (hhmm === null) {
      this.overrideMinutes = null;
      return true;
    }
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
    if (!match) return false;
    this.overrideMinutes = Number(match[1]) * 60 + Number(match[2]);
    return true;
  }

  getDemoTime(): string | null {
    return this.overrideMinutes === null ? null : minutesToHhmm(this.overrideMinutes);
  }

  /** เวลาที่ใช้ตัดสินใจ (อาจเป็นเวลาจำลอง) */
  now(): Date {
    const real = new Date();
    if (this.overrideMinutes === null) return real;
    const simulated = new Date(real);
    simulated.setHours(Math.floor(this.overrideMinutes / 60), this.overrideMinutes % 60, 0, 0);
    return simulated;
  }

  minutesOfDay(date: Date = this.now()): number {
    return date.getHours() * 60 + date.getMinutes();
  }
}
