'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ApiError, api, message, session } from '@/lib/api';
import type { Role, Session, User } from '@/lib/types';
import { BrandArt } from './BrandArt';
import styles from './login.module.css';

const DEMO_PASSWORD = 'demo@1234';

/** การ์ดบัญชีสาธิต — ชื่อผู้ใช้ตรงกับ data/users.csv ส่วนสิทธิ์จริงมาจาก API ตอนเข้าสู่ระบบ */
const ACCOUNTS: { username: string; name: string; role: Role; icon: string; what: string; still?: boolean }[] = [
  { username: 'reg1', name: 'ปราณี', role: 'registrar', icon: '🪪',
    what: 'เวชระเบียน — เปิด visit และพิมพ์บัตรคิว' },
  { username: 'lab1', name: 'นิภา', role: 'station', icon: '🩸',
    what: 'จุดบริการ ห้องเจาะเลือด — คิวของแผนกตัวเอง' },
  { username: 'scr1', name: 'มานพ', role: 'station', icon: '🩺',
    what: 'จุดบริการ จุดคัดกรอง — คิวของแผนกตัวเอง' },
  { username: 'admin', name: 'ผู้ดูแลระบบ', role: 'admin', icon: '🛠',
    what: 'จัดการผัง แม่แบบ ผู้ใช้ และตรวจผังอัตโนมัติ' },
  { username: 'exec1', name: 'ผู้อำนวยการ', role: 'executive', icon: '📊',
    what: 'ภาพรวมเวลารอและจุดคอขวด', still: true },
];

const ROLE_LABEL: Record<Role, string> = {
  registrar: 'เวชระเบียน', station: 'จุดบริการ', admin: 'ผู้ดูแลระบบ', executive: 'ผู้บริหาร',
};

/** เข้าสู่ระบบแล้วไปไหนต่อ — ตามบทบาทที่ API ตอบกลับมา ไม่ใช่ตามที่หน้าจอเดา */
const HOME_FOR: Record<Role, (user: User) => string> = {
  registrar: () => '/registrar',
  station: (user) => `/station?dept=${encodeURIComponent(user.department_code ?? '')}`,
  admin: () => '/admin.html',
  executive: () => '/mockups/d5-dashboard.html',
};

/** หน้าที่ยังเป็น HTML นิ่ง เสิร์ฟจาก public/ — ลิงก์ตรงด้วยชื่อไฟล์เดิม */
const STILL_PAGES = [
  { href: '/helpdesk.html', icon: '🙋', name: 'โต๊ะช่วยเหลือ', tag: 'ใหม่',
    what: 'ผู้ป่วยหลงเดินมาถาม ค้นด้วยเลขคิวแล้วยืนยันตำแหน่งหรือพิมพ์เส้นทางให้ได้เลย' },
  { href: '/impact.html', icon: '🚧', name: 'ผลกระทบเมื่อปิดเส้นทาง', tag: 'ใหม่',
    what: 'ก่อนปิดลิฟต์หรือทางเชื่อม ดูก่อนว่าใครต้องเดินเพิ่มเท่าไร และใครไปไม่ถึงเลย' },
  { href: '/pathway.html', icon: '📋', name: 'แม่แบบการมาโรงพยาบาลหนึ่งครั้ง', tag: 'แม่แบบ',
    what: 'แผนภาพขั้นตอนทั้งหมดในรูปเดียว พร้อมเงื่อนไขลำดับและกำหนดเวลา' },
  { href: '/map.html', icon: '🗺', name: 'ผังเส้นทางทั้งโรงพยาบาล', tag: 'แผนที่',
    what: 'ภาพรวมทุกอาคารทุกชั้น พร้อมเส้นทางทั้งวันที่ระบบคำนวณให้' },
];

function LoginPage() {
  const router = useRouter();
  const nextPage = useSearchParams().get('next');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn(name: string, secret: string) {
    if (!name || !secret) return setError('กรอกชื่อผู้ใช้และรหัสผ่าน');

    setBusy(true);
    try {
      // ตรวจรหัสผ่านที่ API เท่านั้น — หน้าจอไม่มีรายชื่อผู้ใช้หรือรหัสผ่านอยู่เลย
      const { token, user } = await api.post<Session>(
        '/auth/login',
        { username: name, password: secret },
        { auth: false },
      );
      session.set({ token, user });
      setError(null);
      router.push(nextPage?.startsWith('/') ? nextPage : HOME_FOR[user.role](user));
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 401
          ? 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง — บัญชีสาธิตใช้รหัส demo@1234'
          : message(caught),
      );
    } finally {
      setBusy(false);
    }
  }

  async function openTicket() {
    const typed = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{4}-?[A-Z0-9]{3}$/.test(typed)) {
      return setError('รหัสบนบัตรคิวเป็นตัวอักษรและตัวเลข 7 ตัว เช่น A017-3K9');
    }
    try {
      // รหัสใต้ QR แลกเป็น token ของบัตรใบนั้นที่ API — หน้าจอไม่ได้เดาเอง
      const { token } = await api.get<{ token: string }>(
        `/p/code/${encodeURIComponent(typed)}`,
        { auth: false },
      );
      setError(null);
      router.push(`/patient?t=${encodeURIComponent(token)}`);
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 404
          ? `รหัส ${typed} ไม่ตรงกับบัตรคิวใบใดของวันนี้`
          : message(caught),
      );
    }
  }

  return (
    <div className={styles.page}>
      <section className={styles.brand}>
        <BrandArt />

        <p className={styles.mark}><span aria-hidden="true">🧭</span> CarePath · โรงพยาบาลวชิระภูเก็ต</p>
        <h1>ระบบนำทางในโรงพยาบาลและติดตามขั้นตอนการรักษา</h1>
        <p>
          ผู้ป่วยรู้ตลอดเวลาว่าตอนนี้ต้องไปที่ไหนและไปยังไง
          เจ้าหน้าที่แต่ละจุดกดปุ่มเดียวแล้วขั้นถัดไปเด้งขึ้นมือถือผู้ป่วยเอง
        </p>
        <div className={styles.facts}>
          <span className={styles.fact}><b>48</b><span>จุดในผัง</span></span>
          <span className={styles.fact}><b>5</b><span>ภาษา</span></span>
          <span className={styles.fact}><b>4</b><span>บทบาทผู้ใช้</span></span>
          <span className={styles.fact}><b>13</b><span>ตาราง 3NF</span></span>
        </div>
        <p className={`note ${styles.scopeNote}`}>
          ระบบสาธิตสำหรับโรงพยาบาลวชิระภูเก็ต · ผังอาคาร ชั้น แผนก และข้อมูลผู้ป่วยในเดโมนี้เป็น{' '}
          <b>ชุดสมมุติ</b> ยังไม่ใช่ผังจริงของโรงพยาบาล
          เมื่อได้ผังจริงแล้วนำเข้าผ่านไฟล์ CSV ได้ทันทีโดยไม่ต้องแก้โค้ด
        </p>
      </section>

      <main className={styles.panel}>
        <div>
          <h2 className={styles.heading}>เข้าสู่ระบบ</h2>
          <p className="note">สำหรับเจ้าหน้าที่ · ผู้ป่วยไม่ต้องเข้าสู่ระบบ ใช้ QR หรือรหัสบนบัตรคิว</p>
        </div>

        <form
          className={styles.form}
          autoComplete="off"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void signIn(username.trim().toLowerCase(), password);
          }}
        >
          <div className="field">
            <label htmlFor="username">ชื่อผู้ใช้</label>
            <input
              className="input" id="username" name="username"
              autoCapitalize="off" spellCheck={false} placeholder="เช่น lab1"
              value={username}
              onChange={(event) => { setUsername(event.target.value); setError(null); }}
            />
          </div>
          <div className="field">
            <label htmlFor="password">รหัสผ่าน</label>
            <input
              className="input" id="password" name="password" type="password" placeholder="demo@1234"
              value={password}
              onChange={(event) => { setPassword(event.target.value); setError(null); }}
            />
          </div>
          {error && <p className="error"><span aria-hidden="true">⚠</span> <span>{error}</span></p>}
          <button className="btn btn--primary btn--lg btn--block" type="submit" disabled={busy}>
            เข้าสู่ระบบ
          </button>
        </form>

        <div className="divider">บัญชีสำหรับสาธิต — กดเพื่อกรอกให้อัตโนมัติ</div>
        <div className={styles.accounts}>
          {ACCOUNTS.map((account) => (
            <button
              key={account.username}
              className={styles.account}
              type="button"
              onClick={() => {
                setUsername(account.username);
                setPassword(DEMO_PASSWORD);
                setError(null);
                void signIn(account.username, DEMO_PASSWORD);
              }}
            >
              <span className={styles.icon} aria-hidden="true">{account.icon}</span>
              <span>
                <span className={styles.accountName}>
                  {account.name} · {ROLE_LABEL[account.role]}{' '}
                  {account.still && <span className="tag tag--amber">ภาพนิ่ง</span>}
                </span>
                <span className={styles.what}>{account.what}</span>
              </span>
              <span className={styles.who}>{account.username}</span>
            </button>
          ))}
        </div>
        <p className="note">
          รหัสผ่านทุกบัญชีคือ <code>demo@1234</code> · ในระบบจริงเก็บเป็น bcrypt และตรวจที่ API เท่านั้น
          หน้าเว็บไม่เคยเห็นรหัสผ่านที่ถูกต้อง
        </p>

        {STILL_PAGES.map((page) => (
          <a key={page.href} className={styles.account} href={page.href}>
            <span className={styles.icon} aria-hidden="true">{page.icon}</span>
            <span>
              <span className={styles.accountName}>{page.name}</span>
              <span className={styles.what}>{page.what}</span>
            </span>
            <span className={styles.who}>{page.tag}</span>
          </a>
        ))}

        <div className="divider">ผู้ป่วย</div>
        <form
          className={styles.codeForm}
          autoComplete="off"
          noValidate
          onSubmit={(event) => { event.preventDefault(); void openTicket(); }}
        >
          <div className="field">
            <label htmlFor="code">รหัสบนบัตรคิว 8 ตัว</label>
            <input
              className={`input mono ${styles.codeInput}`}
              id="code" placeholder="A017-3K9" maxLength={9}
              value={code}
              onChange={(event) => { setCode(event.target.value); setError(null); }}
            />
          </div>
          <div className={styles.codeActions}>
            <button className={`btn btn--primary ${styles.grow}`} type="submit">
              เปิดหน้าติดตามขั้นตอน
            </button>
            <button className="btn" type="button" onClick={() => router.push('/patient')}>
              📷 สแกน QR
            </button>
          </div>
          <p className="note">
            <a href="/privacy.html?from=login">ระบบนี้เก็บข้อมูลอะไรของคุณบ้าง</a> — อ่านได้ 5 ภาษา ก่อนเริ่มใช้งาน
          </p>
          <p className="note">
            ปกติผู้ป่วยสแกน QR บนบัตรคิว ช่องนี้ไว้ให้คนที่กล้องเสียหรือบัตรเปียกพิมพ์รหัสเข้าแทน
          </p>
        </form>
      </main>
    </div>
  );
}

export default function Page() {
  // useSearchParams ต้องอยู่ใต้ Suspense เพื่อให้ Next prerender เปลือกหน้าได้
  return (
    <Suspense fallback={null}>
      <LoginPage />
    </Suspense>
  );
}
