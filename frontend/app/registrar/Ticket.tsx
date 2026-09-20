'use client';

import { useMemo } from 'react';
import qrcode from 'qrcode-generator';
import type { VisitState } from '@/lib/types';
import { LANG_LABEL, PROFILE_FLAGS } from './constants';
import styles from './registrar.module.css';

const DATE = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
const TIME = new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit' });

/** QR จริงที่สแกนได้ · ถ้าสร้างไม่ได้ ยังมีรหัส 8 ตัวข้าง QR ให้พิมพ์แทน */
function useQrTag(url: string): string | null {
  return useMemo(() => {
    try {
      const qr = qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      return qr.createDataURL(4, 0);
    } catch {
      return null;
    }
  }, [url]);
}

export function Ticket({ data, baseUrl }: { data: VisitState; baseUrl: string }) {
  const { visit, steps } = data;
  const openedAt = new Date(visit.checked_in_at);
  const flags = PROFILE_FLAGS.filter((flag) => visit.profile?.[flag.key]);

  const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}t=${visit.token}`;
  const qrSrc = useQrTag(url);

  return (
    <div className={styles.ticket}>
      <div className={styles.ticketTop}>
        <p className={styles.hospital}>โรงพยาบาลวชิระภูเก็ต · บัตรคิววันนี้</p>
        <p className={styles.ticketNo}>{visit.ticket_no}</p>
        <p className={styles.ticketName}>{visit.patient_name} · {visit.template.name_th}</p>
        <p className={styles.hint}>
          {DATE.format(openedAt)} · เปิดบัตร {TIME.format(openedAt)}
        </p>
      </div>

      <div className={styles.ticketQr}>
        {qrSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- QR เป็น data URL ที่สร้างในเบราว์เซอร์ ไม่ผ่าน next/image
          <img src={qrSrc} alt="คิวอาร์โค้ดสำหรับเปิดหน้าติดตามขั้นตอน" />
        ) : (
          <p className={styles.hint} style={{ width: 108 }}>สแกนไม่ได้ตอนนี้<br />ใช้รหัสด้านขวาแทน</p>
        )}
        <div>
          <p className={styles.hint}>สแกนเพื่อดูขั้นตอนและเส้นทาง<br />หรือพิมพ์รหัสนี้ที่หน้าเว็บโรงพยาบาล</p>
          <p className={styles.ticketCode}>{visit.short_code}</p>
          <p className={styles.hint}>
            {flags.map((flag) => flag.icon).join(' ')} {LANG_LABEL[visit.lang] ?? visit.lang}
          </p>
        </div>
      </div>

      <div className={styles.ticketSteps}>
        <table>
          <tbody>
            {steps.map((step, index) => (
              <tr key={step.id}>
                <td>{index + 1}</td>
                <td>
                  {step.point.icon ?? '📍'} {step.name_th}
                  <br />
                  <span className={styles.where}>
                    {step.point.name_th} · อาคาร {step.point.building} ชั้น {step.point.floor}
                  </span>
                </td>
                <td>{step.deadline_time ? `ก่อน ${step.deadline_time}` : `${step.est_minutes} น.`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.ticketFoot}>
        ถ้าหลง ถามเจ้าหน้าที่จุดใดก็ได้ แจ้งเลขคิว <b>{visit.ticket_no}</b>
        <br />
        บัตรนี้ใช้ได้ถึงสิ้นวัน · ไม่มีเลขประจำตัวผู้ป่วยบนบัตร
      </div>
    </div>
  );
}
