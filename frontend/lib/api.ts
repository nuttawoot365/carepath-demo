/**
 * ตัวเรียก REST API ที่ทุกหน้าใช้ร่วมกัน
 * หน้าเว็บไม่รู้จักฐานข้อมูลเลย รู้จักแค่ /api — และเก็บ token ไว้ในหน่วยความจำของแท็บเท่านั้น
 */
import type { Role, Session, User } from './types';

const SESSION_KEY = 'carepath.session';

export const readSession = (): Session | null => {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null') as Session | null;
  } catch {
    return null;
  }
};

export const writeSession = (session: Session | null): void => {
  if (typeof window === 'undefined') return;
  try {
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* โหมดส่วนตัวเขียนไม่ได้ */
  }
};

interface ErrorPayload {
  error?: { code?: string; message_th?: string; message_en?: string };
}

/** ข้อผิดพลาดที่ API ตอบกลับมา — มีข้อความไทยและอังกฤษพร้อมใช้บนหน้าจอ */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly messageTh: string;
  readonly messageEn: string;

  constructor(status: number, payload: ErrorPayload | null) {
    const body = payload?.error ?? {};
    super(body.message_th || body.message_en || `HTTP ${status}`);
    this.status = status;
    this.code = body.code ?? 'HTTP_ERROR';
    this.messageTh = body.message_th ?? 'ระบบขัดข้อง กรุณาลองใหม่';
    this.messageEn = body.message_en ?? 'Something went wrong';
  }
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  /** ส่ง Bearer จาก session · ตั้ง false สำหรับปลายทางเปิด เช่น หน้าผู้ป่วย */
  auth?: boolean;
  token?: string;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, token, signal } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';

  const bearer = token ?? (auth ? readSession()?.token : null);
  if (bearer) headers.authorization = `Bearer ${bearer}`;

  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, {
      error: { code: 'OFFLINE', message_th: 'ติดต่อเซิร์ฟเวอร์ไม่ได้', message_en: 'Cannot reach the server' },
    });
  }

  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    // token หมดอายุหรือถูกปิดใช้งาน — กลับไปหน้าเข้าสู่ระบบ ไม่ปล่อยให้หน้าค้างว่าง
    if (response.status === 401 && auth && readSession()) {
      writeSession(null);
      window.location.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`;
    }
    throw new ApiError(response.status, payload as ErrorPayload | null);
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
};

export const session = {
  get: readSession,
  set: writeSession,
  clear: () => writeSession(null),
  user: (): User | null => readSession()?.user ?? null,
};

/** หน้าไหนต้องเข้าสู่ระบบก่อน เรียกผ่าน useRequireRole — สิทธิ์จริงตรวจที่ API อีกชั้นเสมอ */
export const allowedUser = (...roles: Role[]): User | null => {
  const current = readSession();
  if (!current?.token || (roles.length > 0 && !roles.includes(current.user.role))) return null;
  return current.user;
};

export const message = (error: unknown): string =>
  error instanceof ApiError ? error.messageTh : 'ระบบขัดข้อง กรุณาลองใหม่';
