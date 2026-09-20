import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthUser, Role } from './user.types';

export const ROLES_KEY = 'carepath:roles';

/**
 * ตรวจสิทธิ์ที่ API เสมอ — หน้าจอซ่อนปุ่มไม่ถือเป็นการป้องกัน
 * ใช้คู่กับ @UseGuards(AuthGuard) · ไม่ใส่ roles = แค่ต้องเข้าสู่ระบบ
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** @CurrentUser() ในพารามิเตอร์ของ handler — ได้ผู้ใช้ที่ guard แนบไว้ */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => context.switchToHttp().getRequest().user,
);
