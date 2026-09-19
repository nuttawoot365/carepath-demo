#!/usr/bin/env node
/**
 * สร้าง app/map.html จาก app/map.template.html + ข้อมูลใน data/
 * แผนที่จึงงอกจากผังจริงเสมอ ไม่ใช่ไฟล์ที่แก้ด้วยมือแล้วลืมอัปเดต
 *   node app/build-map.mjs
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

const pathway = pathRows
  .filter((row) => row.template === TEMPLATE_CODE)
  .map((row) => ({
    seq: Number(row.step), th: row.name_th, en: row.name_en,
    point: row.service_point, deadline: csvOrNull(row.deadline), min: Number(row.est_minutes),
  }));

const deptColor = Object.fromEntries(deptRows.map((row) => [row.code, row.color]));

const template = await fs.readFile(path.join(here, 'map.template.html'), 'utf8');
const data = JSON.stringify({ nodes, edges, pathway, deptColor });
await fs.writeFile(path.join(here, 'map.html'), template.replace('/*__DATA__*/', data));

console.log(`สร้าง app/map.html แล้ว · ${nodes.length} จุด · ${edges.length} ทิศทาง · ${pathway.length} ขั้น (${TEMPLATE_CODE})`);
