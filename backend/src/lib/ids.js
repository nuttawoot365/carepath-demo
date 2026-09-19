import crypto from 'node:crypto';

/** ตัวอักษรที่อ่านออกเสียงแล้วไม่สับสน (ตัด I, O, 0, 1) — ผู้ป่วยพิมพ์เองได้ */
const READABLE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const visitToken = () => crypto.randomBytes(16).toString('hex');

export const qrToken = () => randomReadable(10);

/** 'A017-3K9' — พิมพ์ใต้ QR ให้คนไม่มีกล้องพิมพ์เข้าหน้าตัวเองได้ */
export const shortCode = (ticketNo) =>
  `${ticketNo.replace('-', '').padEnd(4, 'X').slice(0, 4)}-${randomReadable(3)}`;

function randomReadable(length) {
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (byte) => READABLE[byte % READABLE.length]).join('');
}
