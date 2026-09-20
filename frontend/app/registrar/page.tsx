'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, message } from '@/lib/api';
import { useRequireRole, useSignOut } from '@/lib/use-auth';
import type { Patient, PatientProfile, Template, User, VisitState } from '@/lib/types';
import { LANG_LABEL, LANG_OPTIONS, PROFILE_FLAGS } from './constants';
import { Ticket } from './Ticket';
import styles from './registrar.module.css';
import './print.css';

const DATE_SHORT = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
const TIME = new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit' });

function RegistrarPage({ user }: { user: User }) {
  const signOut = useSignOut();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [search, setSearch] = useState('สม');
  const [patient, setPatient] = useState<Patient | null>(null);
  const [templateCode, setTemplateCode] = useState<string | null>(null);
  const [profile, setProfile] = useState<PatientProfile>({ wheelchair: true, elderly: true });
  const [lang, setLang] = useState('th');
  const [hasPhone, setHasPhone] = useState(true);
  const [noticeGiven, setNoticeGiven] = useState(false);
  const [visit, setVisit] = useState<VisitState | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [patientUrl, setPatientUrl] = useState('');

  const out = useRef<HTMLElement>(null);
  const template = templates.find((item) => item.code === templateCode) ?? null;

  // นาฬิกาบนแถบหัว — เริ่มหลัง mount เพื่อไม่ให้ HTML ฝั่งเซิร์ฟเวอร์กับเบราว์เซอร์ต่างกัน
  useEffect(() => {
    setNow(new Date());
    setPatientUrl(`${location.origin}/patient`);
    const timer = setInterval(() => setNow(new Date()), 20000);
    return () => clearInterval(timer);
  }, []);

  const loadPatients = useCallback(async (query: string, keep?: string) => {
    const { patients: rows } = await api.get<{ patients: Patient[] }>(
      `/patients?q=${encodeURIComponent(query.trim())}`,
    );
    setPatients(rows);
    setPatient((current) => {
      const wanted = keep ?? current?.hn;
      const found = rows.find((item) => item.hn === wanted) ?? rows[0] ?? null;
      if (found && found.hn !== current?.hn) setLang(found.preferred_lang ?? 'th');
      return found;
    });
  }, []);

  useEffect(() => {
    api
      .get<{ templates: Template[] }>('/templates')
      .then(({ templates: rows }) => {
        setTemplates(rows);
        setTemplateCode(rows[0]?.code ?? null);
      })
      .catch((error) => setProblem(`โหลดข้อมูลไม่สำเร็จ: ${message(error)}`));
  }, []);

  // ค้นช้ากว่าการพิมพ์ 200ms — ไม่ยิง API ทุกตัวอักษร
  useEffect(() => {
    const timer = setTimeout(() => {
      loadPatients(search).catch((error) => setProblem(`โหลดข้อมูลไม่สำเร็จ: ${message(error)}`));
    }, 200);
    return () => clearTimeout(timer);
  }, [search, loadPatients]);

  async function openVisit() {
    if (!patient || !templateCode) return setProblem('เลือกผู้ป่วยและแม่แบบก่อน');

    setBusy(true);
    try {
      // หนึ่งคำขอ = หนึ่งทรานแซกชันที่ API — visits, visit_steps, prereqs และ audit ลงพร้อมกัน
      const created = await api.post<VisitState>('/visits', {
        hn: patient.hn,
        template: templateCode,
        profile,
        lang,
        has_phone: hasPhone,
        privacy_notice_given: noticeGiven,
        start_node: 'A1-REG',
      });
      setVisit(created);
      setProblem(null);
      out.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      setProblem(`เปิด visit ไม่สำเร็จ: ${message(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function newPatient() {
    const name = prompt('ชื่อเรียกของผู้ป่วยใหม่');
    if (!name) return;
    try {
      const { patient: created } = await api.post<{ patient: Patient }>('/patients', {
        display_name: name,
        preferred_lang: lang,
      });
      setSearch(created.hn);
      await loadPatients(created.hn, created.hn);
    } catch (error) {
      setProblem(`เปิดประวัติไม่สำเร็จ: ${message(error)}`);
    }
  }

  const timed = template?.steps.find((step) => step.deadline_time);
  const chosenFlags = PROFILE_FLAGS.filter((flag) => profile[flag.key]);

  const summary = problem
    ? problem
    : patient
      ? `กำลังจะเปิด: ${patient.display_name} · ${template?.name_th ?? '—'} · ` +
        `${chosenFlags.length ? chosenFlags.map((f) => `${f.icon} ${f.label}`).join(' · ') : 'ไม่มีความต้องการพิเศษ'} · ` +
        `ภาษา ${LANG_LABEL[lang] ?? lang} · ${hasPhone ? 'มีมือถือ' : 'ไม่มีมือถือ'}` +
        (noticeGiven ? ' · แจ้งความเป็นส่วนตัวแล้ว' : ' · ยังไม่ได้แจ้งความเป็นส่วนตัว')
      : 'เลือกผู้ป่วยก่อน';

  return (
    <>
      <header className="topbar">
        <span aria-hidden="true">🪪</span>
        <b>เวชระเบียน</b>
        <span style={{ opacity: .75, fontSize: '.85em' }}>โรงพยาบาลวชิระภูเก็ต</span>
        <span style={{ opacity: .8, fontSize: '.9em' }}>{user.display_name}</span>
        <span className="spacer" />
        <span className={styles.clock} suppressHydrationWarning>
          {now ? `${DATE_SHORT.format(now)} · ${TIME.format(now)}` : ''}
        </span>
        <button className={`${styles.clock} ${styles.signout} noPrint`} type="button" onClick={signOut}>
          ออกจากระบบ
        </button>
      </header>

      <div className={styles.wrap}>
        <main className={styles.flow}>
          <Stage
            no={1} done={Boolean(patient)} seconds="~15 วิ"
            title="ผู้ป่วยยื่นบัตรประชาชนหรือบัตรโรงพยาบาล"
            why="ค้นด้วย HN หรือชื่อ · ถ้าไม่เคยมา กดเปิดประวัติใหม่"
          >
            <div className={styles.searchRow}>
              <input
                className={`input ${styles.grow}`}
                placeholder="พิมพ์ HN หรือชื่อ เช่น 0012345 หรือ สม"
                autoComplete="off"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <button className="btn" onClick={() => void newPatient()}>+ ผู้ป่วยใหม่</button>
            </div>
            <table className={styles.table}>
              <thead>
                <tr><th>HN</th><th>ชื่อ</th><th>ภาษา</th><th>มาล่าสุด</th></tr>
              </thead>
              <tbody>
                {patients.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="note" style={{ padding: '14px 11px' }}>
                      ไม่พบผู้ป่วยที่ตรงกับคำค้น — กด &quot;ผู้ป่วยใหม่&quot; เพื่อเปิดประวัติ
                    </td>
                  </tr>
                ) : (
                  patients.map((row) => (
                    <tr
                      key={row.hn}
                      aria-selected={row.hn === patient?.hn}
                      onClick={() => { setPatient(row); setLang(row.preferred_lang ?? 'th'); }}
                    >
                      <td className="mono">{row.hn}</td>
                      <td><b>{row.display_name}</b></td>
                      <td>{LANG_LABEL[row.preferred_lang] ?? row.preferred_lang}</td>
                      <td className="note">
                        {row.last_visit ? DATE_SHORT.format(new Date(row.last_visit)) : 'ยังไม่เคยมา'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <p className="note">
              ระบบไม่เก็บเลขบัตรประชาชน · หน้าจอผู้ป่วยแสดงแค่ชื่อเรียกกับเลขคิว ไม่มี HN เต็ม
            </p>
          </Stage>

          <Stage
            no={2} done seconds="~5 วิ"
            title="เลือกว่าวันนี้มาทำอะไร"
            why="แม่แบบขั้นตอนกำหนดว่าต้องผ่านจุดไหนบ้าง และขั้นไหนมีกำหนดเวลา"
          >
            <div className={styles.grid2}>
              {templates.map((item) => (
                <button
                  key={item.code}
                  className={`${styles.toggle} ${item.code === templateCode ? styles.toggleOn : ''}`}
                  aria-pressed={item.code === templateCode}
                  onClick={() => setTemplateCode(item.code)}
                >
                  <span aria-hidden="true">{item.code === templateCode ? '✅' : '⬜'}</span>
                  <span className={styles.fill}>
                    {item.name_th}
                    <span className="sub">{item.steps.length} ขั้น · {item.name_en}</span>
                  </span>
                </button>
              ))}
            </div>
            {timed && (
              <div className={styles.warnbox}>
                <span aria-hidden="true">⏰</span>
                <span>
                  <b>แม่แบบนี้มีขั้นที่มีกำหนดเวลา</b>
                  <p>
                    ขั้น &quot;{timed.name_th}&quot; ต้องเสร็จก่อน {timed.deadline_time} —{' '}
                    {timed.deadline_reason_th ?? ''}{' '}
                    ถ้าเปิด visit สายกว่านี้ ระบบจะจัดให้ผู้ป่วยไปขั้นนี้ก่อนขั้นอื่นเอง
                  </p>
                </span>
              </div>
            )}
          </Stage>

          <Stage
            no={3} done seconds="~20 วิ"
            title="ถามความต้องการพิเศษ แล้วติ๊กให้ครบ"
            why="ติ๊กครั้งเดียวตรงนี้ มีผลกับการคิดเส้นทางและหน้าจอของผู้ป่วยทั้งวัน"
          >
            <div className={styles.grid3}>
              {PROFILE_FLAGS.map((flag) => (
                <button
                  key={flag.key}
                  className={`${styles.toggle} ${profile[flag.key] ? styles.toggleOn : ''}`}
                  aria-pressed={Boolean(profile[flag.key])}
                  onClick={() =>
                    setProfile((current) => {
                      const next = { ...current };
                      if (next[flag.key]) delete next[flag.key];
                      else next[flag.key] = true;
                      return next;
                    })
                  }
                >
                  <span aria-hidden="true">{flag.icon}</span>
                  <span className={styles.fill}>
                    {flag.label}<span className="sub">{flag.effect}</span>
                  </span>
                </button>
              ))}
            </div>

            <div className={styles.grid2}>
              <label className={`${styles.toggle} ${styles.toggleStatic}`}>
                🌐
                <span className={styles.fill}>
                  ภาษาที่ผู้ป่วยอ่านได้
                  <select
                    className={styles.select}
                    style={{ marginTop: 5 }}
                    value={lang}
                    onChange={(event) => setLang(event.target.value)}
                  >
                    {LANG_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </span>
              </label>
              <button
                className={`${styles.toggle} ${hasPhone ? styles.toggleOn : ''}`}
                aria-pressed={hasPhone}
                onClick={() => setHasPhone((value) => !value)}
              >
                <span aria-hidden="true">📱</span>
                <span className={styles.fill}>
                  {hasPhone ? 'มีมือถือ ใช้ QR ได้' : 'ไม่มีมือถือ ใช้บัตรกระดาษ'}
                  <span className="sub">
                    {hasPhone ? 'กดเพื่อสลับเป็น "ไม่มีมือถือ"' : 'บัตรจะพิมพ์คำสั่งเดินทางละเอียดขึ้น'}
                  </span>
                </span>
              </button>
            </div>

            <p className="note">
              ถ้าผู้ป่วยไม่มีมือถือ ระบบจะพิมพ์คำสั่งเดินทางลงบัตรกระดาษให้ละเอียดขึ้น
              และตั้งค่าให้เจ้าหน้าที่แต่ละจุดเป็นคนยืนยันตำแหน่งแทน
            </p>

            <button
              className={`${styles.toggle} ${noticeGiven ? styles.toggleOn : ''}`}
              type="button"
              aria-pressed={noticeGiven}
              onClick={(event) => {
                if ((event.target as HTMLElement).closest('a')) return; // กดลิงก์อ่านประกาศ ไม่ใช่ติ๊ก
                setNoticeGiven((value) => !value);
              }}
            >
              <span aria-hidden="true">🔐</span>
              <span className={styles.fill}>
                แจ้งผู้ป่วยเรื่องข้อมูลส่วนบุคคลแล้ว
                <span className="sub">
                  เปิด{' '}
                  <a href="/privacy.html?from=registrar" target="_blank" rel="noopener">
                    ประกาศความเป็นส่วนตัว
                  </a>{' '}
                  ให้ผู้ป่วยอ่านหรือพิมพ์แจกได้ · ระบบบันทึกว่าแจ้งเมื่อไรและใครเป็นผู้แจ้ง
                </span>
              </span>
            </button>
          </Stage>

          <button className="btn btn--primary btn--lg" disabled={busy} onClick={() => void openVisit()}>
            เปิด visit และพิมพ์บัตรคิว
          </button>
          <p className="note">{summary}</p>
        </main>

        <aside className={styles.out} ref={out}>
          {!visit ? (
            <div className={styles.blank}>
              <span className={styles.big} aria-hidden="true">🎫</span>
              <b>ยังไม่ได้เปิด visit</b>
              <p className="note" style={{ marginTop: 6 }}>
                กรอกสามขั้นทางซ้ายแล้วกดปุ่มเปิด visit
                <br />
                บัตรคิวและสิ่งที่ระบบสร้างจะขึ้นตรงนี้
              </p>
            </div>
          ) : (
            <Output
              data={visit}
              baseUrl={patientUrl}
              onBaseUrl={setPatientUrl}
              noticeGiven={noticeGiven}
              username={user.username}
              onAgain={() => { setVisit(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            />
          )}
        </aside>
      </div>
    </>
  );
}

function Stage({
  no, done, title, why, seconds, children,
}: {
  no: number; done: boolean; title: string; why: string; seconds: string; children: React.ReactNode;
}) {
  return (
    <section className={`${styles.stage} ${done ? styles.stageDone : ''}`}>
      <div className={styles.stageHead}>
        <span className={styles.stageNo}>{no}</span>
        <span>
          <span className={styles.stageTitle}>{title}</span>
          <span className={styles.stageWhy} style={{ display: 'block' }}>{why}</span>
        </span>
        <span className={styles.seconds}>{seconds}</span>
      </div>
      <div className={styles.stageBody}>{children}</div>
    </section>
  );
}

function Output({
  data, baseUrl, onBaseUrl, noticeGiven, username, onAgain,
}: {
  data: VisitState;
  baseUrl: string;
  onBaseUrl: (value: string) => void;
  noticeGiven: boolean;
  username: string;
  onAgain: () => void;
}) {
  const { visit, steps } = data;
  const totalMin = steps.reduce((sum, step) => sum + step.est_minutes, 0);
  const nextStep = steps.find((step) => step.id === data.next_step_id);
  const reordered = nextStep && nextStep.sequence !== Math.min(...steps.map((step) => step.sequence));

  return (
    <>
      <Ticket data={data} baseUrl={baseUrl} />

      <div className={`${styles.actions} noPrint`}>
        <button className={`btn btn--primary ${styles.grow}`} onClick={() => window.print()}>
          🖨 พิมพ์บัตร A5
        </button>
        <button
          className={`btn ${styles.grow}`}
          onClick={() =>
            window.open(
              `/patient?t=${encodeURIComponent(visit.token)}&by=${encodeURIComponent(username)}`,
              '_blank',
              'noopener',
            )
          }
        >
          📱 เปิดหน้าผู้ป่วย
        </button>
        <button className="btn" onClick={onAgain}>เปิดรายถัดไป</button>
      </div>

      <section className={`${styles.panel} noPrint`}>
        <h3>ผู้ป่วยเข้าหน้าตัวเองได้ 3 ทาง</h3>
        <ol className={`${styles.ways} note`}>
          <li><b>สแกน QR บนบัตรคิว</b> — ทางปกติ ไม่ต้องพิมพ์อะไร</li>
          <li><b>พิมพ์รหัส {visit.short_code}</b> ที่หน้าแรกของระบบ — สำหรับคนที่กล้องเสียหรือบัตรเปียก</li>
          <li><b>เจ้าหน้าที่เปิดให้จากหลังบ้าน</b> — ปุ่ม &quot;เปิดหน้าผู้ป่วย&quot; ด้านบน ใช้ตอนผู้ป่วยไม่มีมือถือ</li>
        </ol>
        <p className="note" style={{ marginTop: 9 }}>
          การเปิดโดยเจ้าหน้าที่ถูกบันทึกลง <code>audit_logs</code> ว่าใครเปิดดูของใครเมื่อไร
        </p>
      </section>

      <section className={`${styles.panel} noPrint`}>
        <h3>ระบบสร้างอะไรให้บ้าง</h3>
        <p className="note" style={{ marginBottom: 11 }}>
          ทั้งหมดนี้เกิดในทรานแซกชันเดียวที่ API — ถ้าขั้นใดล้มเหลว จะไม่มีอะไรถูกบันทึกเลย
        </p>
        <div className={styles.made}>
          <MadeRow table="visits" count="1 แถว" detail={`token ${visit.token.slice(0, 12)}… · หมดอายุสิ้นวัน`} />
          <MadeRow table="visit_steps" count={`${steps.length} แถว`}
            detail="คัดลอกจากแม่แบบ แก้แม่แบบทีหลังไม่กระทบผู้ป่วยรายนี้" />
          <MadeRow table="visit_step_prereqs"
            count={`${steps.reduce((sum, step) => sum + step.requires.length, 0)} แถว`}
            detail="เงื่อนไขว่าขั้นไหนต้องทำหลังขั้นไหน" />
          <MadeRow table="audit_logs" count={noticeGiven ? '2 แถว' : '1 แถว'}
            detail="ใครเปิด visit เมื่อไหร่ · เวลาเซิร์ฟเวอร์ แก้ไม่ได้" />
          <MadeRow table="notifications" count="0 แถว" detail="จะเริ่มมีเมื่อเส้นทางเปลี่ยนหรือมีขั้นแทรก" />
        </div>
        <p className="note" style={{ marginTop: 11 }}>
          รวมเวลาที่คาดว่าจะใช้ทั้งวัน ~{totalMin} นาที · ขั้นแรกที่ระบบเลือกให้คือ{' '}
          <b>{nextStep?.name_th ?? '—'}</b>
          {data.route && ` · เดิน ${data.route.distance_m} เมตร`}
        </p>
        {reordered && (
          <div className={styles.warnbox} style={{ marginTop: 11 }}>
            <span aria-hidden="true">⏰</span>
            <span>
              <b>ระบบสลับลำดับให้แล้ว</b>
              <p>
                ขั้นที่มีกำหนดเวลาถูกยกขึ้นมาก่อน เพราะเวลาที่เหลือไม่พอถ้าเดินตามลำดับปกติ —
                เหตุผลนี้แสดงบนหน้าจอผู้ป่วยด้วย
              </p>
            </span>
          </div>
        )}
      </section>

      <section className={`${styles.panel} noPrint`}>
        <h3 style={{ marginBottom: 8 }}>ลิงก์ที่อยู่ใน QR</h3>
        <div className={styles.linkbox}><span>{baseUrl}</span></div>
        <p className="note" style={{ marginTop: 8 }}>
          เปลี่ยนเป็นที่อยู่ของเครื่องที่ใช้สาธิตได้ แล้ว QR จะเปลี่ยนตาม
        </p>
        <input
          className="input"
          style={{ marginTop: 8 }}
          value={baseUrl}
          onChange={(event) => onBaseUrl(event.target.value)}
        />
      </section>
    </>
  );
}

const MadeRow = ({ table, count, detail }: { table: string; count: string; detail: string }) => (
  <div className={styles.madeRow}>
    <code>{table}</code>
    <small>{detail}</small>
    <span className={styles.madeCount}>{count}</span>
  </div>
);

export default function Page() {
  const user = useRequireRole('registrar', 'admin');
  if (!user) return null;
  return <RegistrarPage user={user} />;
}
