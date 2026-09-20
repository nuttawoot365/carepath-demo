'use client';

import { useEffect, useRef } from 'react';
import styles from './patient.module.css';

/** แผ่นเลื่อนขึ้นจากขอบล่าง — ใช้ <dialog> จริง จึงได้ backdrop และ Esc ฟรี */
export function Sheet({
  open, onClose, children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className={styles.sheetDialog}
      onClose={onClose}
      onClick={(event) => { if (event.target === dialog.current) onClose(); }}
    >
      <div className={styles.sheet}>
        <div className={styles.sheetGrip} />
        {children}
      </div>
    </dialog>
  );
}
