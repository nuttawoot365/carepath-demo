'use client';

import { useEffect, useRef } from 'react';

/**
 * เรียกซ้ำทุก ๆ กี่มิลลิวินาที และเรียกทันทีหนึ่งครั้งตอนเปิดหน้า
 * เก็บ callback ล่าสุดไว้ใน ref จึงไม่ต้องตั้งตัวจับเวลาใหม่ทุกครั้งที่ state เปลี่ยน
 */
export function usePoll(fn: () => void | Promise<void>, ms: number, enabled = true): void {
  const latest = useRef(fn);
  latest.current = fn;

  useEffect(() => {
    if (!enabled) return;
    void latest.current();
    const timer = setInterval(() => void latest.current(), ms);
    return () => clearInterval(timer);
  }, [ms, enabled]);
}
