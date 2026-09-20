'use client';

import { useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import type { QueueItem } from '@/lib/types';

/** ตัวเลือกส่งตรวจเพิ่มที่จุดบริการใช้บ่อย — ชื่อจุดต้องตรงกับ code ใน data/nodes.csv */
const CHOICES = [
  { point: 'B1-XR', icon: '📷', nameTh: 'เอกซเรย์ปอด', nameEn: 'Chest X-ray',
    where: 'ห้องเอกซเรย์ อาคาร B ชั้น 1' },
  { point: 'B3-LAB', icon: '🩸', nameTh: 'เจาะเลือดเพิ่ม', nameEn: 'Additional blood test',
    where: 'ห้องเจาะเลือด อาคาร B ชั้น 3' },
];

interface Props {
  step: QueueItem | null;
  onClose: () => void;
  onInserted: (label: string) => void | Promise<void>;
  onFailed: (error: unknown) => void;
}

/** ส่งตรวจเพิ่มระหว่างวัน — ขั้นที่แทรกไปอยู่ก่อน "ชำระเงิน" และแจ้งผู้ป่วยทันที */
export function InsertSheet({ step, onClose, onInserted, onFailed }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (step && !element.open) element.showModal();
    if (!step && element.open) element.close();
  }, [step]);

  async function insert(choice: (typeof CHOICES)[number]) {
    if (!step) return;
    try {
      await api.post(`/visits/${step.visit.id}/steps`, {
        point: choice.point,
        name_th: choice.nameTh,
        name_en: choice.nameEn,
        est_minutes: 15,
        before_point: 'A1-PAY',
        requires: [step.id],
      });
      await onInserted(choice.nameTh);
    } catch (error) {
      onFailed(error);
    }
  }

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(event) => { if (event.target === dialog.current) onClose(); }}
    >
      <div className="sheet">
        <h2 style={{ fontSize: '1.1em' }}>ส่งตรวจเพิ่ม</h2>
        <p className="note">ขั้นที่แทรกจะไปอยู่ก่อน &quot;ชำระเงิน&quot; และแจ้งผู้ป่วยทันที</p>
        {CHOICES.map((choice) => (
          <button key={choice.point} className="pick" onClick={() => void insert(choice)}>
            <span aria-hidden="true">{choice.icon}</span>
            {choice.nameTh} · {choice.where}
          </button>
        ))}
        <button className="btn" onClick={onClose}>ปิด</button>
      </div>
    </dialog>
  );
}
