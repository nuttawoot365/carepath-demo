import { Router } from 'express';
import { query } from '../db.js';
import { authenticate, signToken, verifyPassword } from '../lib/auth.js';
import { unauthorized } from '../lib/errors.js';
import { requireFields } from '../lib/validate.js';

const router = Router();

/** เข้าสู่ระบบด้วยชื่อผู้ใช้และรหัสผ่าน — ข้อความผิดพลาดเดียวกันทั้งชื่อผิดและรหัสผิด */
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = requireFields(req.body, ['username', 'password']);

    const { rows } = await query(
      `SELECT u.id, u.username, u.password_hash, u.display_name, u.role, u.department_id,
              d.code AS department_code, d.name_th AS department_th
         FROM users u LEFT JOIN departments d ON d.id = u.department_id
        WHERE u.username = $1 AND u.is_active`,
      [String(username).trim().toLowerCase()],
    );
    const user = rows[0];
    if (!user || !(await verifyPassword(String(password), user.password_hash))) throw unauthorized();

    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

router.get('/me', authenticate, async (req, res) => {
  res.json({ user: publicUser(req.user) });
});

const publicUser = (user) => ({
  id: user.id,
  username: user.username,
  display_name: user.display_name,
  role: user.role,
  department_code: user.department_code ?? null,
  department_th: user.department_th ?? null,
});

export default router;
