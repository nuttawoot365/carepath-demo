import { redirect } from 'next/navigation';

/** เข้าเว็บเปล่า ๆ ให้ไปหน้าเข้าสู่ระบบ — เหมือนที่ nginx เคย 302 ให้ */
export default function Home() {
  redirect('/login');
}
