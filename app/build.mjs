#!/usr/bin/env node
/**
 * สร้างหน้าที่งอกจากข้อมูลใน data/ — ผังเส้นทางและแผนภาพแม่แบบ
 * ทั้งสองหน้าจึงตรงกับผังจริงเสมอ ไม่ใช่ไฟล์ที่แก้ด้วยมือแล้วลืมอัปเดต
 *   node app/build.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv, csvBool, csvOrNull } from './csv.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, '..', 'data');
// หน้าที่งอกจากข้อมูลยังเป็น HTML นิ่ง · Next.js เสิร์ฟจาก frontend/public/
const publicDir = path.join(here, '..', 'frontend', 'public');

const read = async (name) => parseCsv(await fs.readFile(path.join(dataDir, `${name}.csv`), 'utf8'));

const OPPOSITE_TURN = { left: 'right', right: 'left', straight: 'straight', back: 'back' };
const TEMPLATE_CODE = process.env.TEMPLATE ?? 'DM-FU';

const [nodeRows, edgeRows, pathRows, deptRows] = await Promise.all(
  ['nodes', 'edges', 'pathways', 'departments'].map(read),
);

const nodes = nodeRows.map((row) => ({
  code: row.code, b: row.building, f: Number(row.floor), d: row.department || null,
  kind: row.kind, th: row.name_th, en: row.name_en,
  lm: csvOrNull(row.landmark_th), icon: csvOrNull(row.icon),
  x: Number(row.map_x), y: Number(row.map_y),
}));

const missing = nodes.filter((node) => !Number.isFinite(node.x) || !Number.isFinite(node.y));
if (missing.length > 0) {
  throw new Error(`จุดที่ยังไม่มีพิกัด map_x/map_y: ${missing.map((n) => n.code).join(', ')}`);
}

// bidirectional=1 กลายเป็นสองทิศ · ทิศกลับสลับซ้าย-ขวา เหมือนตอนนำเข้าฐานข้อมูล
const edges = edgeRows.flatMap((row) => {
  const m = Number(row.distance_m);
  const s = row.walk_seconds ? Number(row.walk_seconds) : Math.max(1, Math.round(m));
  const a = csvBool(row.is_accessible);
  const forward = { f: row.from, t: row.to, k: row.kind, m, s, turn: csvOrNull(row.turn), a };
  if (!csvBool(row.bidirectional)) return [forward];
  return [forward, { ...forward, f: row.to, t: row.from, turn: row.turn ? OPPOSITE_TURN[row.turn] : null }];
});

const stepOf = (row) => ({
  seq: Number(row.step),
  name_th: row.name_th,
  name_en: row.name_en,
  point: row.service_point,
  wait: row.kind === 'wait',
  prereq: (row.prereq_steps ?? '').split(';').filter(Boolean).map(Number),
  deadline: csvOrNull(row.deadline),
  reason: csvOrNull(row.deadline_reason_th),
  min: Number(row.est_minutes),
  wait_after: Number(row.wait_after_minutes),
});

const pathway = pathRows
  .filter((row) => row.template === TEMPLATE_CODE)
  .map((row) => ({ ...stepOf(row), th: row.name_th, en: row.name_en }));

const deptColor = Object.fromEntries(deptRows.map((row) => [row.code, row.color]));

/** เขียนทั้งใน app/ (ต้นฉบับที่แก้ด้วยมือได้) และใน frontend/public/ (ที่ Next.js เสิร์ฟจริง) */
async function build(name, data) {
  const template = await fs.readFile(path.join(here, `${name}.template.html`), 'utf8');
  const page = template.replace('/*__DATA__*/', JSON.stringify(data));
  await fs.writeFile(path.join(here, `${name}.html`), page);
  await fs.writeFile(path.join(publicDir, `${name}.html`), page);
}

await build('map', { nodes, edges, pathway, deptColor });
console.log(`สร้าง app/map.html แล้ว · ${nodes.length} จุด · ${edges.length} ทิศทาง · ${pathway.length} ขั้น (${TEMPLATE_CODE})`);

// ---- แผนภาพแม่แบบ: ทุกแม่แบบในไฟล์เดียว พร้อมเงื่อนไขลำดับ ----

const templateRows = await read('templates');
const templates = templateRows.map((row) => ({
  code: row.code,
  category: row.category,
  name_th: row.name_th,
  name_en: row.name_en,
  steps: pathRows.filter((step) => step.template === row.code).map(stepOf),
}));

const places = nodes.map(({ code, th, en, b, f, icon }) => ({ code, th, en, b, f, icon }));

await build('pathway', { templates, places });

// ---- แผนที่สำหรับผู้ป่วย: ใช้ข้อมูลผังชุดเดียวกับหน้าผู้ดูแลระบบ ----
await build('patient-map', { nodes, edges });
console.log('สร้าง app/patient-map.html แล้ว');

// ---- ผลกระทบเมื่อปิดเส้นทาง: ต้องรู้ด้วยว่าตอนนี้ใครกำลังเดินอยู่ตรงไหน ----
const visits = (await read('active-visits')).map((row) => ({
  ticket: row.ticket,
  at: row.at,
  to: row.to,
  wheelchair: csvBool(row.wheelchair),
}));

await build('impact', { nodes, edges, pathway, visits });
console.log(`สร้าง app/impact.html แล้ว · ผู้ป่วยที่กำลังเดินอยู่ ${visits.length} ราย`);

// จอจุดบริการไม่อยู่ในรายการนี้แล้ว — หน้านั้นรับคิวและเวลาเดินจาก API ตรง ๆ

// ---- โต๊ะช่วยเหลือ: ค้นด้วยเลขคิวเมื่อผู้ป่วยเดินมาถาม ----
await build('helpdesk', { nodes, edges, visits });
console.log('สร้าง app/helpdesk.html แล้ว');

// ---- หน้าจัดการระบบ: ตรวจผังเองทุกครั้งที่เปิด จึงต้องมีผังเต็ม ----
await build('admin', {
  nodes,
  edges,
  visits: visits.length,
  templates: new Set(pathRows.map((row) => row.template)).size,
});
console.log('สร้าง app/admin.html แล้ว');
console.log(`สร้าง app/pathway.html แล้ว · ${templates.length} แม่แบบ · `
  + templates.map((t) => `${t.code} ${t.steps.length} ขั้น`).join(' · '));
