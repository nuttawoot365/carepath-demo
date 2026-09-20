'use client';

import { Suspense, useCallback, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, message } from '@/lib/api';
import { useRequireRole, useSignOut } from '@/lib/use-auth';
import { usePoll } from '@/lib/use-poll';
import { clock, minutesOf, nowTime } from '@/lib/format';
import { useToast } from '@/components/Toast';
import type { QueueItem, Station, StepStatus, User, VisitState } from '@/lib/types';
import { InsertSheet } from './InsertSheet';

const MESSAGE: Record<string, string> = {
  arrived: 'บันทึกว่ามาถึงแล้ว',
  in_progress: 'เรียกเข้ารับบริการแล้ว',
  done: 'เสร็จแล้ว — ขั้นถัดไปขึ้นหน้าจอผู้ป่วยแล้ว',
  skipped: 'ข้ามขั้นนี้แล้ว',
};

function StationPage({ user }: { user: User }) {
  const signOut = useSignOut();
  const wantedDept = useSearchParams().get('dept');
  const toast = useToast();

  const [stations, setStations] = useState<Station[]>([]);
  const [station, setStation] = useState<Station | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [plan, setPlan] = useState<VisitState | null>(null);
  const [live, setLive] = useState('เชื่อมกับหน้าผู้ป่วยอยู่');
  const [insertFor, setInsertFor] = useState<QueueItem | null>(null);

  // คิวที่เลือกอยู่ อ่านได้ทันทีในระหว่าง poll โดยไม่ต้องรอ state รอบถัดไป
  const selectedVisitId = useRef<number | null>(null);

  const loadPlan = useCallback(async (visitId: number | null) => {
    if (!visitId) return setPlan(null);
    // การเปิดดู visit ถูกบันทึกลง audit ทุกครั้ง จึงขอเฉพาะตอนเปลี่ยนคิวที่เลือก
    setPlan(await api.get<VisitState>(`/visits/${visitId}`));
  }, []);

  const loadQueue = useCallback(
    async (target: Station | null) => {
      if (!target) return;
      try {
        const { queue: rows } = await api.get<{ station: string; queue: QueueItem[] }>(
          `/stations/${encodeURIComponent(target.code)}/queue`,
        );
        setQueue(rows);
        setLive(`อัปเดตล่าสุด ${nowTime()}`);

        if (!rows.some((item) => item.visit.id === selectedVisitId.current)) {
          selectedVisitId.current = rows[0]?.visit.id ?? null;
          await loadPlan(selectedVisitId.current);
        }
      } catch (error) {
        setLive(`ติดต่อเซิร์ฟเวอร์ไม่ได้ · ${message(error)}`);
      }
    },
    [loadPlan],
  );

  const loadStations = useCallback(async () => {
    const { stations: all } = await api.get<{ stations: Station[] }>('/stations');
    // ผู้ใช้ role station เห็นเฉพาะแผนกตัวเอง — API ก็ปฏิเสธแผนกอื่นให้อีกชั้นหนึ่ง
    const mine =
      user.role === 'station' ? all.filter((item) => item.code === user.department_code) : all;
    setStations(mine);

    const picked =
      mine.find((item) => item.code === wantedDept) ??
      mine.find((item) => item.code === user.department_code) ??
      mine[0] ??
      null;
    setStation(picked);
    return picked;
  }, [user.role, user.department_code, wantedDept]);

  // หน้าผู้ป่วยกับจอจุดบริการดูข้อมูลชุดเดียวกัน — ถามซ้ำทุก 4 วินาทีก็พอสำหรับงานหน้าเคาน์เตอร์
  usePoll(async () => {
    const target = station ?? (await loadStations().catch((error) => { setLive(message(error)); return null; }));
    await loadQueue(target);
  }, 4000);

  /* ---------- การกระทำของเจ้าหน้าที่ — ลำดับสถานะบังคับที่ API หน้าจอเป็นแค่ปุ่ม ---------- */

  async function apply(target: StepStatus, stepId: number) {
    try {
      const data = await api.post<VisitState>(`/steps/${stepId}/status`, { status: target });
      selectedVisitId.current = data.visit.id;
      setPlan(data);
      await loadQueue(station);
      toast.show(`${data.visit.ticket_no} · ${MESSAGE[target]}`);
    } catch (error) {
      toast.show(message(error));
      void loadQueue(station);
    }
  }

  async function selectVisit(visitId: number) {
    selectedVisitId.current = visitId;
    await loadPlan(visitId);
  }

  async function switchStation(code: string) {
    const picked = stations.find((item) => item.code === code) ?? null;
    setStation(picked);
    selectedVisitId.current = null;
    setPlan(null);
    await loadQueue(picked);
  }

  const left = plan?.steps.filter((step) => !['done', 'skipped'].includes(step.status)).length ?? 0;

  return (
    <>
      <header className="topbar">
        <span aria-hidden="true">🩺</span>
        <b>จุดบริการ · {station?.name_th ?? '—'}</b>
        <span style={{ opacity: .85, fontSize: '.88em' }}>{user.display_name} · {nowTime()}</span>
        <span style={{ opacity: .7, fontSize: '.82em' }}>โรงพยาบาลวชิระภูเก็ต · ผังสาธิต</span>
        <span className="spacer" />
        <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {stations.map((item) => (
            <button
              key={item.code}
              className="chip"
              type="button"
              aria-pressed={item.code === station?.code}
              onClick={() => void switchStation(item.code)}
            >
              {item.name_th}
            </button>
          ))}
        </span>
        <a href="/login" onClick={(event) => { event.preventDefault(); signOut(); }}>ออกจากระบบ</a>
      </header>

      <div className="wrap">
        <section className="card">
          <div className="card__head">
            <b>คิวของแผนกนี้</b>
            <span className="spacer" />
            <span className="live"><i aria-hidden="true" /><span>{live}</span></span>
          </div>
          <div className="card__body">
            <div className="queue">
              {queue.length === 0 ? (
                <div className="empty">
                  <span aria-hidden="true">☕</span>
                  <b>ยังไม่มีคิวที่แผนกนี้</b>
                  <p className="note" style={{ marginTop: 6 }}>
                    คิวจะขึ้นเองเมื่อเวชระเบียนเปิด visit ที่มีขั้นตอนของแผนกนี้
                  </p>
                </div>
              ) : (
                queue.map((step) => (
                  <div
                    key={step.id}
                    className={`row ${step.status === 'in_progress' ? 'row--now' : ''}`}
                    onClick={() => void selectVisit(step.visit.id)}
                  >
                    <span className="ticket">{step.visit.ticket_no}</span>
                    <span>
                      <span className="name">
                        {step.visit.patient_name}{' '}
                        {step.visit.profile?.wheelchair && <span className="tag">♿</span>}{' '}
                        {step.visit.profile?.elderly && <span className="tag">🧓</span>}{' '}
                        {step.deadline_time && <span className="tag tag--amber">⏰ ก่อน {step.deadline_time}</span>}{' '}
                        {step.origin === 'added' && <span className="tag">แทรกเพิ่ม</span>}
                      </span>
                      <span className="meta">
                        {step.name_th} · {step.point_th} · <StatusTag step={step} />
                      </span>
                    </span>
                    <span className="acts" onClick={(event) => event.stopPropagation()}>
                      <Actions step={step} onApply={apply} onInsert={() => setInsertFor(step)} />
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card__head">
            <b>ลำดับขั้นทั้งหมดของคิวที่เลือก</b>
            <span className="spacer" />
            {plan && <span className="tag">{plan.visit.ticket_no} · เหลือ {left} ขั้น</span>}
          </div>
          <div className="card__body">
            {!plan ? (
              <p className="note" style={{ padding: '12px 14px' }}>
                เลือกคิวจากรายการด้านบนเพื่อดูลำดับขั้นทั้งหมด
              </p>
            ) : (
              <ol className="queue">
                {plan.steps.map((step, index) => (
                  <li
                    key={step.id}
                    className="row"
                    style={{ gridTemplateColumns: '44px minmax(0,1fr) auto', padding: '10px 14px' }}
                  >
                    <span className="mono" style={{ fontWeight: 700 }}>{index + 1}</span>
                    <span>
                      <span className="name">{step.name_th}</span>
                      <span className="meta">
                        {step.point.name_th} · อาคาร {step.point.building} ชั้น {step.point.floor}
                      </span>
                    </span>
                    <span><PlanTag step={step} nextStepId={plan.next_step_id} /></span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card__head"><b>หน้านี้ทำงานยังไง</b></div>
          <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <p className="note">
              เจ้าหน้าที่กดปุ่มเดียว — <b>มาถึง → เรียก → เสร็จ</b> ระบบบันทึกเวลาให้เองทุกครั้ง
              ไม่ต้องกรอกอะไร งานเพิ่มไม่เกิน 2 วินาทีต่อคน
            </p>
            <p className="note">
              พอกด &quot;เสร็จ&quot; <b>หน้าจอมือถือของผู้ป่วยจะเปลี่ยนเป็นขั้นถัดไปเอง</b> ลองเปิด{' '}
              <a href="/patient" target="_blank" rel="noopener">หน้าผู้ป่วย</a> ไว้อีกแท็บแล้วกดดู
            </p>
            <p className="note">
              หน้านี้ถาม <code>GET /api/stations/:code/queue</code> ทุก 4 วินาที และหน้าผู้ป่วยถาม{' '}
              <code>GET /api/p/:token</code> ทุก 5 วินาที ทั้งสองจอจึงเห็นข้อมูลชุดเดียวกันจากฐานข้อมูล
            </p>
          </div>
        </section>
      </div>

      {toast.node}

      <InsertSheet
        step={insertFor}
        onClose={() => setInsertFor(null)}
        onInserted={async (label) => {
          setInsertFor(null);
          await loadQueue(station);
          toast.show(`แทรกขั้น "${label}" ก่อนชำระเงินแล้ว — แจ้งผู้ป่วยเรียบร้อย`);
        }}
        onFailed={(error) => { setInsertFor(null); toast.show(message(error)); }}
      />
    </>
  );
}

function StatusTag({ step }: { step: QueueItem }) {
  if (step.status === 'in_progress') return <span className="tag">กำลังให้บริการ</span>;
  if (step.status === 'arrived') {
    return <span className="tag tag--ok">มาถึงแล้ว {clock(step.arrived_at)}</span>;
  }
  if (!step.ready) return <span className="tag tag--muted">ยังทำขั้นก่อนหน้าไม่เสร็จ</span>;
  if (step.walk_seconds === null) return <span className="tag tag--warn">ไม่มีเส้นทางมาถึง</span>;
  return <span className="tag tag--muted">กำลังเดินมา · อีกราว {minutesOf(step.walk_seconds)} นาที</span>;
}

function PlanTag({ step, nextStepId }: { step: VisitState['steps'][number]; nextStepId: number | null }) {
  if (step.status === 'done') return <span className="tag tag--ok">เสร็จ {clock(step.finished_at)}</span>;
  if (step.status === 'skipped') return <span className="tag tag--muted">ข้าม</span>;
  if (step.status === 'in_progress') return <span className="tag">กำลังทำ</span>;
  if (step.status === 'arrived') return <span className="tag tag--ok">มาถึงแล้ว</span>;
  if (step.id === nextStepId) return <span className="tag">ขั้นถัดไป</span>;
  if (step.deadline_time) return <span className="tag tag--amber">⏰ ก่อน {step.deadline_time}</span>;
  return null;
}

function Actions({
  step, onApply, onInsert,
}: {
  step: QueueItem;
  onApply: (target: StepStatus, stepId: number) => Promise<void>;
  onInsert: () => void;
}) {
  if (step.status === 'pending') {
    return (
      <>
        <button className="btn btn--sm" disabled={!step.ready} onClick={() => void onApply('arrived', step.id)}>
          ✋ มาถึง
        </button>
        <button className="btn btn--sm" onClick={() => void onApply('skipped', step.id)}>⏭ ข้าม</button>
      </>
    );
  }
  if (step.status === 'arrived') {
    return (
      <>
        <button className="btn btn--primary btn--sm" onClick={() => void onApply('in_progress', step.id)}>
          📣 เรียก
        </button>
        <button className="btn btn--sm" onClick={() => void onApply('skipped', step.id)}>⏭ ข้าม</button>
      </>
    );
  }
  return (
    <>
      <button className="btn btn--success" onClick={() => void onApply('done', step.id)}>✔ เสร็จ</button>
      <button className="btn btn--sm" onClick={onInsert}>➕ ส่งตรวจเพิ่ม</button>
    </>
  );
}

function Guarded() {
  const user = useRequireRole('station', 'admin');
  if (!user) return null;
  return <StationPage user={user} />;
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Guarded />
    </Suspense>
  );
}
