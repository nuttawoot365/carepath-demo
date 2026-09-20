import { HttpException } from '@nestjs/common';

export interface ApiErrorBody {
  error: { code: string; message_th: string; message_en: string };
}

/** ข้อผิดพลาดที่ตอบผู้ใช้ได้ — ตัวอื่นถือเป็น 500 และไม่เปิดเผยรายละเอียด */
export class ApiError extends HttpException {
  readonly code: string;
  readonly messageTh: string;
  readonly messageEn: string;

  constructor(status: number, code: string, messageTh: string, messageEn: string) {
    super({ error: { code, message_th: messageTh, message_en: messageEn } } satisfies ApiErrorBody, status);
    this.code = code;
    this.messageTh = messageTh;
    this.messageEn = messageEn;
  }
}

export const badRequest = (th: string, en: string) => new ApiError(400, 'BAD_REQUEST', th, en);
export const unauthorized = () =>
  new ApiError(401, 'UNAUTHORIZED', 'กรุณาเข้าสู่ระบบ', 'Please sign in');
export const forbidden = () =>
  new ApiError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์ทำรายการนี้', 'You are not allowed to do this');
export const notFound = (th = 'ไม่พบข้อมูล', en = 'Not found') => new ApiError(404, 'NOT_FOUND', th, en);
export const conflict = (th: string, en: string) => new ApiError(409, 'CONFLICT', th, en);
export const gone = (th: string, en: string) => new ApiError(410, 'EXPIRED', th, en);
export const unprocessable = (code: string, th: string, en: string) => new ApiError(422, code, th, en);
