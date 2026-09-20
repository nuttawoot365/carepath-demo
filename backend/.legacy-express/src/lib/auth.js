import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { query } from '../db.js';
import { forbidden, unauthorized } from './errors.js';

const BCRYPT_ROUNDS = 10;

export const hashPassword = (plain) => bcrypt.hash(plain, BCRYPT_ROUNDS);
export const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);

export const signToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role, dept: user.department_id }, config.jwtSecret, {
    expiresIn: config.jwtTtl,
  });

/** อ่าน Bearer token → แนบ req.user (อ่านจาก DB ทุกครั้ง เผื่อผู้ใช้ถูกปิดใช้งานระหว่างวัน) */
export async function authenticate(req, _res, next) {
  try {
    const [scheme, token] = (req.get('authorization') ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw unauthorized();

    let payload;
    try {
      payload = jwt.verify(token, config.jwtSecret);
    } catch {
      throw unauthorized();
    }

    const { rows } = await query(
      `SELECT u.id, u.username, u.display_name, u.role, u.department_id, d.code AS department_code
         FROM users u LEFT JOIN departments d ON d.id = u.department_id
        WHERE u.id = $1 AND u.is_active`,
      [payload.sub],
    );
    if (rows.length === 0) throw unauthorized();

    req.user = rows[0];
    next();
  } catch (error) {
    next(error);
  }
}

/** ตรวจสิทธิ์ที่ API เสมอ — หน้าจอซ่อนปุ่มไม่ถือเป็นการป้องกัน */
export const requireRole = (...roles) => [
  authenticate,
  (req, _res, next) => next(roles.includes(req.user.role) ? undefined : forbidden()),
];
