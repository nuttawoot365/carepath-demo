'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { allowedUser, session } from './api';
import type { Role, User } from './types';

/**
 * บังคับให้ต้องเข้าสู่ระบบก่อนเห็นหน้า — คืน null ระหว่างที่ยังตรวจไม่เสร็จหรือกำลังพาไปหน้าเข้าสู่ระบบ
 * เป็นแค่การซ่อนหน้าจอ · สิทธิ์จริงตรวจที่ API ทุกคำขอ
 */
export function useRequireRole(...roles: Role[]): User | null {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const current = allowedUser(...roles);
    if (current) {
      setUser(current);
      return;
    }
    const next = encodeURIComponent(location.pathname + location.search);
    router.replace(`/login?next=${next}`);
    // roles เป็นรายการคงที่ต่อหน้า — ผูกด้วยสตริงเพื่อไม่ให้ effect วนซ้ำทุกครั้งที่ render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles.join(','), router]);

  return user;
}

export function useSignOut(): () => void {
  const router = useRouter();
  return () => {
    session.clear();
    router.push('/login');
  };
}
