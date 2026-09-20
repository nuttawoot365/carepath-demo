export type Role = 'admin' | 'registrar' | 'station' | 'executive';

/** ผู้ใช้ที่ผ่านการตรวจ token แล้ว — แนบไว้กับ request */
export interface AuthUser {
  id: number;
  username: string;
  display_name: string;
  role: Role;
  department_id: number | null;
  department_code: string | null;
  department_th?: string | null;
  password_hash?: string;
}

/** ข้อมูลผู้ใช้ที่ส่งออกไปหน้าจอ — ไม่มี hash ไม่มี id ภายในของแผนก */
export const publicUser = (user: AuthUser) => ({
  id: user.id,
  username: user.username,
  display_name: user.display_name,
  role: user.role,
  department_code: user.department_code ?? null,
  department_th: user.department_th ?? null,
});
