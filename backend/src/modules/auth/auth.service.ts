import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { DbService } from '../../db/db.service';
import { unauthorized } from '../../common/errors';
import type { AuthUser } from './user.types';

const BCRYPT_ROUNDS = 10;

export const hashPassword = (plain: string) => bcrypt.hash(plain, BCRYPT_ROUNDS);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DbService,
    private readonly jwt: JwtService,
  ) {}

  /** เข้าสู่ระบบด้วยชื่อผู้ใช้และรหัสผ่าน — ข้อความผิดพลาดเดียวกันทั้งชื่อผิดและรหัสผิด */
  async signIn(username: string, password: string): Promise<{ token: string; user: AuthUser }> {
    const { rows } = await this.db.query<AuthUser>(
      `SELECT u.id, u.username, u.password_hash, u.display_name, u.role, u.department_id,
              d.code AS department_code, d.name_th AS department_th
         FROM users u LEFT JOIN departments d ON d.id = u.department_id
        WHERE u.username = $1 AND u.is_active`,
      [username.trim().toLowerCase()],
    );
    const user = rows[0];
    if (!user || !(await verifyPassword(password, user.password_hash ?? ''))) throw unauthorized();

    const token = await this.jwt.signAsync({
      sub: user.id,
      role: user.role,
      dept: user.department_id,
    });
    return { token, user };
  }
}
