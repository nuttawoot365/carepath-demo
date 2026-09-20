'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** ข้อความแจ้งผลสั้น ๆ ที่หายเองใน 3.2 วินาที — ใช้ตอบรับการกดปุ่มของเจ้าหน้าที่ */
export function useToast() {
  const [text, setText] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string) => {
    setText(message);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setText(null), 3200);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const node = (
    <div className="toast" aria-live="polite">
      {text && <div>{text}</div>}
    </div>
  );

  return { show, node };
}
