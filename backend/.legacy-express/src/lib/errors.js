/** ข้อผิดพลาดที่ตอบผู้ใช้ได้ — ตัวอื่นถือเป็น 500 และไม่เปิดเผยรายละเอียด */
export class ApiError extends Error {
  constructor(status, code, messageTh, messageEn) {
    super(`${code}: ${messageEn}`);
    this.status = status;
    this.code = code;
    this.messageTh = messageTh;
    this.messageEn = messageEn;
  }

  toJSON() {
    return { error: { code: this.code, message_th: this.messageTh, message_en: this.messageEn } };
  }
}

export const badRequest = (th, en) => new ApiError(400, 'BAD_REQUEST', th, en);
export const unauthorized = () =>
  new ApiError(401, 'UNAUTHORIZED', 'กรุณาเข้าสู่ระบบ', 'Please sign in');
export const forbidden = () =>
  new ApiError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์ทำรายการนี้', 'You are not allowed to do this');
export const notFound = (th = 'ไม่พบข้อมูล', en = 'Not found') => new ApiError(404, 'NOT_FOUND', th, en);
export const conflict = (th, en) => new ApiError(409, 'CONFLICT', th, en);
export const gone = (th, en) => new ApiError(410, 'EXPIRED', th, en);
export const unprocessable = (code, th, en) => new ApiError(422, code, th, en);
