/**
 * ตัวเรียก REST API ที่ทุกหน้าใช้ร่วมกัน
 * หน้าเว็บไม่รู้จักฐานข้อมูลเลย รู้จักแค่ /api — และเก็บ token ไว้ในหน่วยความจำของแท็บเท่านั้น
 */
(() => {
  'use strict';

  const SESSION_KEY = 'carepath.session';

  const readSession = () => {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null'); }
    catch { return null; }
  };

  const writeSession = (session) => {
    try {
      if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      else sessionStorage.removeItem(SESSION_KEY);
    } catch { /* โหมดส่วนตัวเขียนไม่ได้ */ }
  };

  /** ข้อผิดพลาดที่ API ตอบกลับมา — มีข้อความไทยและอังกฤษพร้อมใช้บนหน้าจอ */
  class ApiError extends Error {
    constructor(status, payload) {
      const body = payload?.error ?? {};
      super(body.message_th || body.message_en || `HTTP ${status}`);
      this.status = status;
      this.code = body.code ?? 'HTTP_ERROR';
      this.messageTh = body.message_th ?? 'ระบบขัดข้อง กรุณาลองใหม่';
      this.messageEn = body.message_en ?? 'Something went wrong';
    }
  }

  async function request(path, { method = 'GET', body, auth = true, token } = {}) {
    const headers = {};
    if (body !== undefined) headers['content-type'] = 'application/json';

    const bearer = token ?? (auth ? readSession()?.token : null);
    if (bearer) headers.authorization = `Bearer ${bearer}`;

    let response;
    try {
      response = await fetch(`/api${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError(0, {
        error: { code: 'OFFLINE', message_th: 'ติดต่อเซิร์ฟเวอร์ไม่ได้', message_en: 'Cannot reach the server' },
      });
    }

    const payload = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) {
      // token หมดอายุหรือถูกปิดใช้งาน — กลับไปหน้าเข้าสู่ระบบ ไม่ปล่อยให้หน้าค้างว่าง
      if (response.status === 401 && auth && readSession()) {
        writeSession(null);
        location.href = `login.html?next=${encodeURIComponent(location.pathname + location.search)}`;
      }
      throw new ApiError(response.status, payload);
    }
    return payload;
  }

  const api = {
    ApiError,
    get: (path, options) => request(path, options),
    post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
    patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),

    session: {
      get: readSession,
      set: writeSession,
      clear: () => writeSession(null),
      user: () => readSession()?.user ?? null,
    },

    /** หน้าไหนต้องเข้าสู่ระบบก่อน เรียกบรรทัดเดียวที่หัวไฟล์ — สิทธิ์จริงตรวจที่ API อีกชั้นเสมอ */
    requireRole(...roles) {
      const session = readSession();
      if (!session?.token || (roles.length > 0 && !roles.includes(session.user?.role))) {
        location.href = `login.html?next=${encodeURIComponent(location.pathname + location.search)}`;
        return null;
      }
      return session.user;
    },

    signOut() {
      writeSession(null);
      location.href = 'login.html';
    },

    message: (error) => (error instanceof ApiError ? error.messageTh : 'ระบบขัดข้อง กรุณาลองใหม่'),
  };

  window.CarePath = api;
})();
