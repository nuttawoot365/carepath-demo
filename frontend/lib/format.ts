/** รูปแบบวันเวลาและตัวเลขที่ใช้ซ้ำทุกหน้า — ภาษาไทย เขตเวลาเครื่องผู้ใช้ */

const TIME = new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit' });

export const clock = (value: string | null | undefined): string =>
  value ? TIME.format(new Date(value)) : '';

export const nowTime = (): string => TIME.format(new Date());

/** วินาที → นาทีอย่างน้อย 1 — ผู้ป่วยอ่าน "อีก 1 นาที" เข้าใจกว่า "อีก 40 วินาที" */
export const minutesOf = (seconds: number): number => Math.max(1, Math.round(seconds / 60));
