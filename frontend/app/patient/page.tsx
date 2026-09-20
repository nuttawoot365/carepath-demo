'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import type { VisitState } from '@/lib/types';
import { LANGS, langMeta, translator } from './i18n';
import { NEARBY, SCENES, STOCK_PHOTOS, type Place } from './places';
import { clearSceneCache, sampleScene } from './scene';
import { buzz, loadPhotos, readLocal, savePhotos, shrink, writeLocal, type UserPhotos } from './photos';
import { nextStepOf, routeTotals, type PatientModel, type PatientStep, type WalkLeg } from './model';
import { legArrow, legHint, legIcon, legText } from './directions';
import { JourneyChart, journeyCounts } from './JourneyChart';
import { PlaceTiles, tileFor, type Tile } from './PlaceTiles';
import { Sheet } from './Sheet';
import { usePatient } from './usePatient';
import styles from './patient.module.css';

type SheetKind =
  | { kind: 'lang' }
  | { kind: 'where' }
  | { kind: 'demo' }
  | { kind: 'gallery' }
  | { kind: 'photo'; code: string }
  | null;

function PatientPage() {
  const params = useSearchParams();
  const search = useMemo(() => new URLSearchParams(params.toString()), [params]);

  const [lang, setLang] = useState('th');
  const [large, setLarge] = useState(false);
  const [view, setView] = useState<'steps' | 'route'>('steps');
  const [leg, setLeg] = useState(0);
  const [solo, setSolo] = useState(false);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [deadlineOpen, setDeadlineOpen] = useState(true);
  const [reroute, setReroute] = useState(false);
  const [liftClosed, setLiftClosed] = useState(false);
  const [userPhotos, setUserPhotos] = useState<UserPhotos>({});
  const [toastText, setToastText] = useState<string | null>(null);
  const [fontsReady, setFontsReady] = useState(0);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const pendingPhoto = useRef<string | null>(null);

  const toast = useCallback((text: string) => {
    setToastText(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastText(null), 3400);
  }, []);

  const t = useMemo(() => translator(lang), [lang]);
  const meta = langMeta(lang);

  const onChangedByStaff = useCallback(() => {
    buzz([18, 60, 18]);
    toast(t('updatedByStaff'));
  }, [toast, t]);

  const { data, send } = usePatient(search, onChangedByStaff, toast);
  const { model, places, token, blocked } = data;

  /* ---------- ค่าที่จำไว้ในเครื่องผู้ใช้ ---------- */

  useEffect(() => {
    setUserPhotos(loadPhotos());

    const saved = readLocal('carepath.lang');
    if (saved && LANGS.some((item) => item.code === saved)) setLang(saved);
    else {
      const browser = (navigator.language ?? '').slice(0, 2);
      if (LANGS.some((item) => item.code === browser)) setLang(browser);
    }

    if (readLocal('carepath.large') === 'on') {
      setLarge(true);
      setSolo(true);
    }

    // ฟอนต์มาช้ากว่าการวาดครั้งแรก · วาดป้ายในภาพใหม่เมื่อฟอนต์พร้อม
    void document.fonts?.ready.then(() => {
      clearSceneCache();
      setFontsReady((n) => n + 1);
    });
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.body.dataset.lang = lang;
    document.body.dataset.large = large ? 'on' : 'off';
    return () => {
      delete document.body.dataset.lang;
      delete document.body.dataset.large;
    };
  }, [lang, large]);

  /* ---------- ชื่อจุดและรูป ---------- */

  const placeName = useCallback(
    (code: string | null): string => (code ? String(places[code]?.[lang] ?? code) : '—'),
    [places, lang],
  );

  const placeAt = useCallback(
    (code: string): string => {
      const place = places[code];
      return place ? t('at', { building: place.building, floor: place.floor }) : '';
    },
    [places, t],
  );

  const photoOf = useCallback(
    (code: string): { src: string; real: boolean } => {
      if (userPhotos[code]) return { src: userPhotos[code], real: true };
      if (STOCK_PHOTOS[code]) return { src: STOCK_PHOTOS[code], real: false };
      // fontsReady อยู่ใน deps เพื่อให้วาดป้ายใหม่หลังฟอนต์โหลดเสร็จ
      void fontsReady;
      return { src: sampleScene(code, `${places[code]?.icon ?? ''} ${placeName(code)}`, SCENES[code]), real: false };
    },
    [userPhotos, places, placeName, fontsReady],
  );

  /* ---------- การกระทำที่ต้องบันทึกจริง — ทุกปุ่มยิงไปที่ API ---------- */

  const post = (path: string, body?: unknown) =>
    api.post<VisitState>(path, body ?? {}, { auth: false });

  const target = nextStepOf(model);
  const ticket = model?.visit.ticket_no ?? '—';
  const route = model?.route ?? [];
  const phrasebook = { lang, t, placeName };

  async function arrive() {
    setView('steps');
    setReroute(false);
    await send(() => post(`/p/${token}/arrive`), () => {
      buzz([18, 60, 18]);
      toast(t('toastArrive', { ticket }));
    });
  }

  async function pickPlace(code: string) {
    setSheet(null);
    setLeg(0);
    await send(() => post(`/p/${token}/position`, { node: code }), () =>
      toast(t('toastMoved', { p: placeName(code) })),
    );
  }

  async function demoFinish() {
    const finishing = target;
    setSheet(null);
    setDeadlineOpen(false);
    setView('steps');
    setLeg(0);
    await send(() => post(`/p/${token}/demo/finish`), () => {
      buzz([18, 60, 18]);
      toast(t('toastDone', { s: finishing ? String(finishing[lang] ?? '') : '' }));
    });
  }

  async function demoLift() {
    const closing = !liftClosed;
    setSheet(null);
    setLeg(0);
    await send(() => post(`/p/${token}/demo/lift`, { closed: closing }), () => {
      setLiftClosed(closing);
      setReroute(closing);
      buzz(closing ? [22, 70, 22] : 12);
      toast(closing ? t('toastLift') : t('toastLiftOpen'));
    });
  }

  async function demoXray() {
    setSheet(null);
    await send(() => post(`/p/${token}/demo/xray`), () => {
      buzz([18, 60, 18]);
      toast(t('toastXray'));
    });
  }

  // เริ่มใหม่ = ล้างข้อมูลสาธิตทั้งฐานข้อมูล บัตรใบนี้จึงใช้ไม่ได้อีก ต้องเปิดใบใหม่ที่เวชระเบียน
  function demoReset() {
    setSheet(null);
    api
      .post('/demo/reset', {}, { auth: false })
      .then(() => {
        toast(t('toastReset'));
        setTimeout(() => { window.location.href = '/login'; }, 900);
      })
      .catch(() => toast(t('toastReset')));
  }

  function speak() {
    const current = route[solo ? leg : 0];
    if (!current) return;
    const text = `${legText(current, phrasebook)} ${legHint(current, t, ticket)}`.trim();
    try {
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = meta.speech;
      speechSynthesis.speak(utterance);
    } catch {
      toast(text); // เครื่องที่ไม่มีเสียงของภาษานั้น อย่างน้อยยังอ่านตัวอักษรได้
    }
  }

  async function onPhotoPicked(file: File | undefined, code: string | null) {
    if (!file || !code) return;
    try {
      const shrunk = await shrink(file);
      const next = { ...userPhotos, [code]: shrunk };
      if (!savePhotos(next)) return toast(t('photoFull'));
      setUserPhotos(next);
      setSheet({ kind: 'photo', code });
      toast(t('photoSaved', { p: placeName(code) }));
    } catch {
      toast(t('photoFull'));
    }
  }

  function dropPhoto(code: string) {
    const next = { ...userPhotos };
    delete next[code];
    savePhotos(next);
    setUserPhotos(next);
    toast(t('photoRemoved', { p: placeName(code) }));
  }

  /* ---------- หน้าจอ ---------- */

  const mapLink = (step: PatientStep) => {
    const query = new URLSearchParams({ from: model?.at ?? '', to: step.point });
    if (!model?.visit.profile?.wheelchair) query.set('wheelchair', '0');
    if (liftClosed) query.set('lift', 'closed');
    return `/patient-map.html?${query}`;
  };

  const tilesFor = (codes: string[]): Tile[] =>
    codes
      .filter((code) => places[code])
      .map((code) => tileFor(code, places, photoOf(code), placeName(code), placeAt(code)));

  const groupedRest = (codes: string[]) => {
    const groups = new Map<string, string[]>();
    for (const code of codes) {
      const label = placeAt(code);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label)!.push(code);
    }
    return [...groups].sort(([a], [b]) => a.localeCompare(b));
  };

  return (
    <>
      <div className={styles.phone}>
        <header className={styles.topbar}>
          <div className={styles.ticket}>
            <b className="mono">{ticket}</b>
            <span>
              {model
                ? `${model.visit.patient_name} · ${lang === 'th' ? model.visit.template.name_th : model.visit.template.name_en}`
                : t('who')}
            </span>
          </div>
          <div className={styles.topbarTools}>
            <button
              className={styles.chip}
              aria-haspopup="dialog"
              aria-label={t('langTitle')}
              onClick={() => setSheet({ kind: 'lang' })}
            >
              🌐 <span>{meta.short}</span>
            </button>
            <button
              className={styles.chip}
              aria-pressed={large}
              aria-label={t('readAloud')}
              onClick={() => {
                const on = !large;
                setLarge(on);
                setSolo(on);
                writeLocal('carepath.large', on ? 'on' : 'off');
              }}
            >
              ก+
            </button>
          </div>
        </header>

        <main className={`${styles.scroll} ${styles.fade}`}>
          {blocked ? (
            <NoTicket
              message={
                blocked === 'none'
                  ? 'ยังไม่ได้เปิดบัตรคิว'
                  : blocked.startsWith('code:')
                    ? t('codeUnknown', { c: blocked.slice(5) })
                    : blocked
              }
            />
          ) : !target && model ? (
            <DoneScreen t={t} steps={model.steps} places={places} placeName={placeName} placeAt={placeAt} lang={lang} />
          ) : view === 'route' && target ? (
            <RouteView
              t={t} target={target} route={route} leg={leg} solo={solo} reroute={reroute}
              places={places} placeName={placeName} ticket={ticket} phrasebook={phrasebook}
              mapHref={mapLink(target)} photoOf={photoOf}
              onMode={() => { setSolo((value) => !value); setLeg(0); }}
              onSpeak={speak} onWhere={() => setSheet({ kind: 'where' })}
              onPhoto={(code) => setSheet({ kind: 'photo', code })}
            />
          ) : target && model ? (
            <StepsView
              t={t} lang={lang} model={model} target={target} route={route} places={places}
              placeName={placeName} placeAt={placeAt} ticket={ticket}
              reroute={reroute} deadlineOpen={deadlineOpen}
              mapHref={mapLink(target)} photoOf={photoOf}
              onWhere={() => setSheet({ kind: 'where' })}
              onPhoto={(code) => setSheet({ kind: 'photo', code })}
            />
          ) : null}
        </main>

        <footer className={styles.actionbar}>
          {blocked ? (
            <a className="btn btn--primary btn--grow btn--lg" href="/login">{t('backHome')}</a>
          ) : !target ? (
            <button className="btn btn--grow btn--lg" onClick={demoReset}>↻ {t('demoReset')}</button>
          ) : view === 'route' ? (
            solo && leg < route.length - 1 ? (
              <>
                <button className="btn" onClick={() => setLeg((n) => Math.max(0, n - 1))}>
                  ← {t('prev')}
                </button>
                <button
                  className="btn btn--primary btn--grow btn--lg"
                  onClick={() => { setLeg((n) => Math.min(n + 1, route.length - 1)); buzz(12); }}
                >
                  {t('next')} →
                </button>
              </>
            ) : (
              <>
                <button className="btn btn--grow" onClick={() => setView('steps')}>
                  ☰ {t('backSteps')}
                </button>
                <button className="btn btn--success btn--grow btn--lg" onClick={() => void arrive()}>
                  ✔ {t('arrived')}
                </button>
              </>
            )
          ) : (
            <button
              className="btn btn--primary btn--lg btn--grow"
              onClick={() => { setView('route'); setLeg(0); }}
            >
              {t('viewRoute')} ➡
            </button>
          )}
        </footer>
      </div>

      <button className={styles.demoOpen} onClick={() => setSheet({ kind: 'demo' })}>
        🎬 <span>{t('demo')}</span>
      </button>

      <div className={styles.toast} aria-live="polite">
        {toastText && <div>{toastText}</div>}
      </div>

      <input
        ref={photoInput}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          const code = pendingPhoto.current;
          event.target.value = ''; // เลือกไฟล์เดิมซ้ำได้
          pendingPhoto.current = null;
          void onPhotoPicked(file, code);
        }}
      />

      <Sheet open={sheet !== null} onClose={() => setSheet(null)}>
        {sheet?.kind === 'lang' && (
          <>
            <h2>{t('langTitle')}</h2>
            <p className={styles.demoNote}>{t('langHint')}</p>
            {LANGS.map((item) => (
              <button
                key={item.code}
                className={`${styles.pick} ${item.code === lang ? styles.pickOn : ''}`}
                onClick={() => {
                  setLang(item.code);
                  writeLocal('carepath.lang', item.code);
                  setSheet(null);
                }}
              >
                <span className={styles.pickIcon} aria-hidden="true">{item.flag}</span>
                <span><b>{item.native}</b><span>{item.label}</span></span>
                {item.code === lang && <span className={styles.pickTick}>✓</span>}
              </button>
            ))}
            <button className="btn" onClick={() => setSheet(null)}>{t('close')}</button>
          </>
        )}

        {sheet?.kind === 'where' && (
          <>
            <h2>{t('pickTitle')}</h2>
            <p className={styles.demoNote}>{t('pickHint')}</p>

            <p className={styles.groupLabel}>{t('pickNearby')}</p>
            <PlaceTiles tiles={tilesFor(NEARBY)} onPick={(code) => void pickPlace(code)} />

            <p className={styles.groupLabel} style={{ marginTop: 10 }}>{t('pickAll')}</p>
            {groupedRest(Object.keys(SCENES).filter((code) => !NEARBY.includes(code))).map(
              ([label, codes]) => (
                <div key={label}>
                  <p
                    className={styles.groupLabel}
                    style={{ fontWeight: 400, letterSpacing: 0, textTransform: 'none' }}
                  >
                    {label}
                  </p>
                  <PlaceTiles tiles={tilesFor(codes)} onPick={(code) => void pickPlace(code)} />
                </div>
              ),
            )}
            <button className="btn" onClick={() => setSheet(null)}>{t('close')}</button>
          </>
        )}

        {sheet?.kind === 'gallery' && (
          <>
            <h2>{t('galleryTitle')}</h2>
            <p className={styles.demoNote}>{t('galleryHint')}</p>
            {groupedRest(Object.keys(SCENES)).map(([label, codes]) => (
              <div key={label}>
                <p className={styles.groupLabel}>{label}</p>
                <PlaceTiles
                  tiles={tilesFor(codes)}
                  onPick={(code) => setSheet({ kind: 'photo', code })}
                  showRealBadge
                  realLabel={t('photoTitle')}
                  sampleLabel={t('photoStock')}
                />
              </div>
            ))}
            <button className="btn" onClick={() => setSheet(null)}>{t('close')}</button>
          </>
        )}

        {sheet?.kind === 'photo' && (
          <PhotoSheet
            key={sheet.code} t={t} photo={photoOf(sheet.code)}
            name={placeName(sheet.code)} where={placeAt(sheet.code)}
            onShoot={() => { pendingPhoto.current = sheet.code; photoInput.current?.click(); }}
            onDrop={() => dropPhoto(sheet.code)}
            onGallery={() => setSheet({ kind: 'gallery' })}
            onClose={() => setSheet(null)}
          />
        )}

        {sheet?.kind === 'demo' && (
          <>
            <h2>{t('demoTitle')}</h2>
            <p className={styles.demoNote}>{t('demoHint')}</p>
            <button className={styles.pick} onClick={() => void demoFinish()}>
              <span className={styles.pickIcon}>✔</span>
              <span><b>{t('demoFinish')}</b><span>{target ? String(target[lang] ?? '—') : '—'}</span></span>
            </button>
            <button className={styles.pick} onClick={() => void demoLift()}>
              <span className={styles.pickIcon}>🛗</span>
              <span>
                <b>{liftClosed ? t('demoLiftOpen') : t('demoLift')}</b>
                <span>{t('demoLiftHint')}</span>
              </span>
            </button>
            <button className={styles.pick} onClick={() => void demoXray()}>
              <span className={styles.pickIcon}>📷</span>
              <span><b>{t('demoXray')}</b><span>{t('demoXrayHint')}</span></span>
            </button>
            <button className={styles.pick} onClick={() => setSheet({ kind: 'gallery' })}>
              <span className={styles.pickIcon}>🏥</span>
              <span><b>{t('galleryOpen')}</b></span>
            </button>
            <a className={styles.pick} href="/map.html">
              <span className={styles.pickIcon}>🗺</span>
              <span><b>{t('mapOpen')}</b></span>
            </a>
            <a className={styles.pick} href="/login">
              <span className={styles.pickIcon}>🏠</span>
              <span><b>{t('backHome')}</b></span>
            </a>
            <button className={styles.pick} onClick={demoReset}>
              <span className={styles.pickIcon}>↻</span>
              <span><b>{t('demoReset')}</b></span>
            </button>
            <button className="btn" onClick={() => setSheet(null)}>{t('close')}</button>
          </>
        )}
      </Sheet>
    </>
  );
}

/* ========================================================================== */

type T = (key: string, params?: Record<string, unknown>) => string;
type PhotoOf = (code: string) => { src: string; real: boolean };

function Alert({ kind, icon, title, body }: { kind: 'warn' | 'amber'; icon: string; title: string; body: string }) {
  return (
    <div
      className={`${styles.alert} ${kind === 'warn' ? styles.alertWarn : styles.alertAmber}`}
      role="status"
    >
      <span className={styles.alertIcon} aria-hidden="true">{icon}</span>
      <span><b>{title}</b><p>{body}</p></span>
    </div>
  );
}

function PhotoRow({ code, t, photoOf, onOpen }: { code: string; t: T; photoOf: PhotoOf; onOpen: () => void }) {
  const photo = photoOf(code);
  return (
    <button className={styles.photoRow} onClick={onOpen}>
      {/* eslint-disable-next-line @next/next/no-img-element -- ภาพวาดในเบราว์เซอร์เป็น data URL */}
      <img src={photo.src} alt="" />
      <span style={{ flex: 1 }}>
        <b>📷 {t('photoView')}</b>
        <small>{photo.real ? t('photoTitle') : t('photoStock')}</small>
      </span>
      <span aria-hidden="true">›</span>
    </button>
  );
}

function StepList({
  steps, target, places, placeName, placeAt, lang, t,
}: {
  steps: PatientStep[]; target: PatientStep | null; places: Record<string, Place>;
  placeName: (code: string | null) => string; placeAt: (code: string) => string;
  lang: string; t: T;
}) {
  return (
    <ol className={styles.steps}>
      {steps.map((step, index) => {
        const isNow = target?.id === step.id;
        const mark = step.status === 'done' ? styles.stepDone : isNow ? styles.stepNow : '';
        return (
          <li key={step.id} className={`${styles.step} ${mark}`}>
            <span className={styles.stepNo}>{step.status === 'done' ? '✓' : index + 1}</span>
            <span className={styles.stepIcon} aria-hidden="true">
              {String(places[step.point]?.icon ?? '📍')}
            </span>
            <span>
              <span className={styles.stepName}>{String(step[lang] ?? step.th)}</span>
              <br />
              <span className={styles.stepWhere}>{placeAt(step.point)} · {placeName(step.point)}</span>
            </span>
            {step.status === 'done' ? (
              <span className="tag tag--success mono">{step.at ?? t('doneAt')}</span>
            ) : step.deadline ? (
              <span className="tag tag--amber">{t('deadlineTag', { time: step.deadlineTime })}</span>
            ) : step.added ? (
              <span className="tag">{t('added')}</span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function StepsView({
  t, lang, model, target, route, places, placeName, placeAt, ticket,
  reroute, deadlineOpen, mapHref, photoOf, onWhere, onPhoto,
}: {
  t: T; lang: string; model: PatientModel;
  target: PatientStep; route: WalkLeg[]; places: Record<string, Place>;
  placeName: (code: string | null) => string; placeAt: (code: string) => string; ticket: string;
  reroute: boolean; deadlineOpen: boolean; mapHref: string; photoOf: PhotoOf;
  onWhere: () => void; onPhoto: (code: string) => void;
}) {
  const totals = routeTotals(route);
  const remaining = model.steps.filter((step) => step.status === 'pending').length;
  const counts = journeyCounts(model.steps, places);

  // นาทีที่เหลือมาจากคำเตือนของ API ไม่ใช่นาฬิกาของเครื่องผู้ป่วย
  const warning = model.warnings.find(
    (item) => item.code === 'deadline_soon' && item.step_id === target.id,
  );

  return (
    <>
      {reroute && <Alert kind="warn" icon="🔔" title={t('rerouteTitle')} body={t('rerouteBody')} />}
      {deadlineOpen && target.deadline && (
        <Alert
          kind="amber"
          icon="⏰"
          title={t('deadlineTitle', { step: String(target[lang] ?? target.th), time: target.deadlineTime })}
          body={t('deadlineBody', {
            step: String(target[lang] ?? target.th),
            time: target.deadlineTime,
            // เหตุผลของกำหนดเวลาในฐานข้อมูลมีแต่ภาษาไทย ภาษาอื่นจึงข้ามไปไม่แปลเอง
            reason: lang === 'th' ? (target.deadlineReason ?? '') : '',
            min: warning && warning.code === 'deadline_soon' ? warning.minutes_left : '',
          })}
        />
      )}

      <section className={styles.hero}>
        <p className={styles.eyebrow}>{t('nowGo')}</p>
        <div className={styles.heroRow} style={{ marginTop: 9 }}>
          <div className={styles.heroIcon} aria-hidden="true">
            {String(places[target.point]?.icon ?? '📍')}
          </div>
          <div>
            <h2 className={styles.heroName}>{placeName(target.point)}</h2>
            <p className={styles.heroAt}>
              {placeAt(target.point)}{' '}
              {target.deadline && (
                <span className="tag tag--amber">{t('deadlineTag', { time: target.deadlineTime })}</span>
              )}
            </p>
          </div>
        </div>
        <div className={styles.heroWalk}>
          <span className={styles.metric}><b>{totals.m}</b><span>{t('meters')}</span></span>
          <span className={styles.metric}><b>{totals.min}</b><span>{t('minutes')}</span></span>
          <span className={styles.metric}><b>{route.length}</b><span>{t('turns')}</span></span>
        </div>
        <PhotoRow code={target.point} t={t} photoOf={photoOf} onOpen={() => onPhoto(target.point)} />
      </section>

      <section className={styles.card}>
        <div className={styles.progress}>
          <b>{t('progress')}</b>
          <span>{t('remain', { n: remaining })}</span>
        </div>
        <div className={styles.rail}>
          {model.steps.map((step) => (
            <i
              key={step.id}
              data-on={step.status === 'done' ? 'done' : target.id === step.id ? 'now' : ''}
            />
          ))}
        </div>
        <StepList
          steps={model.steps} target={target} places={places}
          placeName={placeName} placeAt={placeAt} lang={lang} t={t}
        />
      </section>

      <section className={styles.card}>
        <div className={styles.progress}><b>{t('overviewTitle')}</b></div>
        <div className={styles.overview}>
          <JourneyChart
            steps={model.steps} target={target} places={places}
            floorLabel={(floor) => t('floorShort', { n: floor })}
            title={t('overviewTitle')}
          />
          <div className={styles.overviewFacts}>
            <span>🛗 {t('overviewFloors', { n: counts.floors })}</span>
            <span>🌉 {t('overviewCross', { n: counts.buildings })}</span>
          </div>
          <a className="btn" href={mapHref}>🗺 {t('mapFull')}</a>
        </div>
      </section>

      <section className={styles.card}>
        <p className={styles.eyebrow}>{t('position')}</p>
        <p style={{ marginTop: 5 }}>
          📍 {placeName(model.at)}{' '}
          <span className="tag tag--muted">
            {model.atSource === 'station' ? t('confirmedBy') : t('youSet')}
          </span>
        </p>
        <div style={{ display: 'flex', gap: 9, marginTop: 11 }}>
          <button className="btn btn--grow" onClick={onWhere}>📍 {t('whereAmI')}</button>
          <button className="btn" aria-label={t('scanQr')} onClick={onWhere}>📷</button>
        </div>
      </section>

      <p className={styles.demoNote}>
        ♿ {t('wheelchair')}<br />
        {t('lostHelp', { ticket })}<br />
        {t('hospital')}<br />
        <a href="/privacy.html" style={{ color: 'var(--primary)' }}>{t('privacy')}</a>
      </p>
    </>
  );
}

function RouteView({
  t, target, route, leg, solo, reroute, places, placeName, ticket, phrasebook,
  mapHref, photoOf, onMode, onSpeak, onWhere, onPhoto,
}: {
  t: T; target: PatientStep; route: WalkLeg[]; leg: number; solo: boolean; reroute: boolean;
  places: Record<string, Place>; placeName: (code: string | null) => string; ticket: string;
  phrasebook: { lang: string; t: T; placeName: (code: string | null) => string };
  mapHref: string; photoOf: PhotoOf;
  onMode: () => void; onSpeak: () => void; onWhere: () => void; onPhoto: (code: string) => void;
}) {
  const totals = routeTotals(route);
  const current = Math.min(leg, Math.max(0, route.length - 1));

  const LegBody = ({ item }: { item: WalkLeg }) => {
    const icon = legIcon(item, places);
    const hint = legHint(item, t, ticket);
    const photoCode = item.arrive ?? item.to ?? item.name;
    return (
      <>
        <span className={styles.legText}>{icon ? `${icon} ` : ''}{legText(item, phrasebook)}</span>
        {hint && <span className={styles.legSub}>{hint}</span>}
        {item.m > 0 && <span className={styles.legDist}>{item.m} {t('meters')}</span>}
        {photoCode && places[photoCode] && (
          <button className={styles.photoLeg} onClick={() => onPhoto(photoCode)}>
            {/* eslint-disable-next-line @next/next/no-img-element -- ภาพวาดในเบราว์เซอร์เป็น data URL */}
            <img src={photoOf(photoCode).src} alt="" />
            {t('photoView')}
          </button>
        )}
      </>
    );
  };

  return (
    <>
      {reroute && <Alert kind="warn" icon="🔔" title={t('rerouteTitle')} body={t('rerouteBody')} />}

      <section className={styles.routehead}>
        <div
          className={styles.heroIcon}
          style={{ width: 52, height: 52, fontSize: '1.6em' }}
          aria-hidden="true"
        >
          {String(places[target.point]?.icon ?? '📍')}
        </div>
        <div>
          <p className={styles.eyebrow}>{t('routeTo')}</p>
          <h2 style={{ fontSize: '1.2em', fontWeight: 800, lineHeight: 1.25 }}>
            {placeName(target.point)}
          </h2>
          <p className="mono" style={{ fontSize: '.84em', color: 'var(--ink-2)' }}>
            {totals.m} {t('meters')} · {totals.min} {t('minutes')}
          </p>
        </div>
      </section>

      <div style={{ display: 'flex', gap: 9 }}>
        <button className="btn btn--grow" onClick={onMode}>
          {solo ? `☰ ${t('listMode')}` : `1️⃣ ${t('soloMode')}`}
        </button>
        <a className="btn" href={mapHref} aria-label={t('mapFull')}>🗺</a>
        <button className="btn" aria-label={t('readAloud')} onClick={onSpeak}>🔊</button>
      </div>

      <ol className={styles.route}>
        {solo && route[current] ? (
          <li className={`${styles.leg} ${styles.legCurrent} ${styles.solo}`}>
            <p className={styles.soloCount}>{t('of', { a: current + 1, b: route.length })}</p>
            <p className={styles.legArrow} aria-hidden="true">{legArrow(route[current])}</p>
            <LegBody item={route[current]} />
          </li>
        ) : (
          route.map((item, index) => (
            <li
              key={index}
              className={`${styles.leg} ${
                index === current ? styles.legCurrent : index < current ? styles.legPast : ''
              }`}
            >
              <span className={styles.legArrow} aria-hidden="true">{legArrow(item)}</span>
              <span><LegBody item={item} /></span>
            </li>
          ))
        )}
      </ol>

      <button className="btn" onClick={onWhere}>🙋 {t('lost')}</button>
      <p className={styles.demoNote}>{t('lostHelp', { ticket })}</p>
    </>
  );
}

function DoneScreen({
  t, steps, places, placeName, placeAt, lang,
}: {
  t: T; steps: PatientStep[]; places: Record<string, Place>;
  placeName: (code: string | null) => string; placeAt: (code: string) => string; lang: string;
}) {
  return (
    <>
      <section className={`${styles.card} ${styles.doneScreen}`}>
        <div className={styles.heroIcon} aria-hidden="true">✅</div>
        <h2 className={styles.heroName}>{t('allDone')}</h2>
        <p style={{ color: 'var(--ink-2)', marginTop: 8 }}>{t('allDoneBody')}</p>
      </section>
      <section className={styles.card}>
        <div className={styles.rail}>
          {steps.map((step) => <i key={step.id} data-on="done" />)}
        </div>
        <StepList
          steps={steps} target={null} places={places}
          placeName={placeName} placeAt={placeAt} lang={lang} t={t}
        />
      </section>
    </>
  );
}

function NoTicket({ message }: { message: string }) {
  return (
    <section className={`${styles.card} ${styles.doneScreen}`}>
      <div className={styles.heroIcon} aria-hidden="true">🎫</div>
      <h2 className={styles.heroName}>{message}</h2>
      <p style={{ color: 'var(--ink-2)', marginTop: 8 }}>
        สแกน QR บนบัตรคิว หรือพิมพ์รหัสใต้ QR ที่หน้าแรกของระบบ
      </p>
    </section>
  );
}

function PhotoSheet({
  t, photo, name, where, onShoot, onDrop, onGallery, onClose,
}: {
  t: T; photo: { src: string; real: boolean }; name: string; where: string;
  onShoot: () => void; onDrop: () => void; onGallery: () => void; onClose: () => void;
}) {
  return (
    <>
      <h2>{name}</h2>
      <p className={styles.demoNote}>{where}</p>
      {/* eslint-disable-next-line @next/next/no-img-element -- ภาพวาดในเบราว์เซอร์เป็น data URL */}
      <img className={styles.photo} src={photo.src} alt={`${t('photoTitle')} — ${name}`} />
      <p>
        <span className={`${styles.badge} ${photo.real ? styles.badgeReal : styles.badgeSample}`}>
          {photo.real ? `📷 ${t('photoTitle')}` : `✏️ ${t('photoStock')}`}
        </span>
      </p>
      <p className={styles.demoNote}>{t('photoHint')}<br />{t('photoStored')}</p>
      <button className={styles.pick} onClick={onShoot}>
        <span className={styles.pickIcon}>📷</span>
        <span><b>{photo.real ? t('photoRetake') : t('photoAdd')}</b></span>
      </button>
      {photo.real && (
        <button className={styles.pick} onClick={onDrop}>
          <span className={styles.pickIcon}>🗑</span>
          <span><b>{t('photoRemove')}</b></span>
        </button>
      )}
      <button className={styles.pick} onClick={onGallery}>
        <span className={styles.pickIcon}>🏥</span>
        <span><b>{t('galleryOpen')}</b></span>
      </button>
      <button className="btn" onClick={onClose}>{t('close')}</button>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PatientPage />
    </Suspense>
  );
}
