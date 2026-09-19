#!/usr/bin/env node
/**
 * สร้างหน้าที่งอกจากข้อมูลใน data/ — ผังเส้นทางและแผนภาพแม่แบบ
 * ทั้งสองหน้าจึงตรงกับผังจริงเสมอ ไม่ใช่ไฟล์ที่แก้ด้วยมือแล้วลืมอัปเดต
 *   node app/build.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv, csvBool, csvOrNull } from '../backend/src/lib/csv.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, '..', 'data');

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

/** ฝังข้อมูลลงไฟล์ต้นแบบแล้วเขียนเป็นหน้าเว็บจริง */
async function build(name, data) {
  const template = await fs.readFile(path.join(here, `${name}.template.html`), 'utf8');
  await fs.writeFile(path.join(here, `${name}.html`), template.replace('/*__DATA__*/', JSON.stringify(data)));
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
console.log(`สร้าง app/pathway.html แล้ว · ${templates.length} แม่แบบ · `
  + templates.map((t) => `${t.code} ${t.steps.length} ขั้น`).join(' · '));
