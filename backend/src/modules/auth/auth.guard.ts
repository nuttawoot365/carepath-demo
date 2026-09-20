import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { DbService } from '../../db/db.service';
import { forbidden, unauthorized } from '../../common/errors';
import { ROLES_KEY } from './roles.decorator';
import type { AuthUser, Role } from './user.types';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly db: DbService,
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  /** อ่าน Bearer token → แนบ req.user (อ่านจาก DB ทุกครั้ง เผื่อผู้ใช้ถูกปิดใช้งานระหว่างวัน) */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const [scheme, token] = (request.get('authorization') ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw unauthorized();

    let payload: { sub: number };
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw unauthorized();
    }

    const { rows } = await this.db.query<AuthUser>(
      `SELECT u.id, u.username, u.display_name, u.role, u.department_id, d.code AS department_code
         FROM users u LEFT JOIN departments d ON d.id = u.department_id
        WHERE u.id = $1 AND u.is_active`,
      [payload.sub],
    );
    if (rows.length === 0) throw unauthorized();
    request.user = rows[0];

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles && roles.length > 0 && !roles.includes(rows[0].role)) throw forbidden();

    return true;
  }
}
