import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGraph } from '../src/domain/graph.js';
import { buildLegs } from '../src/domain/legs.js';

/** ผังย่อ: REG ─ทางเดินตรงสองช่วง─ J1 ─ลิฟต์ขึ้นชั้น 2─ LIFT2 ─เลี้ยวซ้าย─ LAB */
const node = (id, code, floor, building, extra = {}) =>
  ({ id, code, floor, building, name_th: code, name_en: code, icon: null,
     landmark_th: null, landmark_en: null, ...extra });

const nodes = [
  node(1, 'REG', 1, 'A'),
  node(2, 'J1', 1, 'A'),
  node(3, 'J2', 1, 'A'),
  node(4, 'LIFT1', 1, 'A'),
  node(5, 'LIFT2', 2, 'A'),
  node(6, 'LAB', 2, 'A'),
];

const edge = (from, to, kind, turn, distance) =>
  ({ id: `${from}-${to}`, from_node_id: from, to_node_id: to, kind, turn,
     distance_m: distance, walk_seconds: distance, is_accessible: true,
     instruction_th: null, instruction_en: null });

const path = [
  edge(1, 2, 'corridor', 'straight', 10),
  edge(2, 3, 'corridor', 'straight', 15),   // เดินตรงต่อเนื่อง ต้องยุบรวมกับข้อบน
  edge(3, 4, 'corridor', 'right', 4),
  edge(4, 5, 'elevator', null, 0),
  edge(5, 6, 'corridor', 'left', 20),
];

const graph = buildGraph(nodes, path);

test('ทางเดินตรงต่อเนื่องถูกยุบเป็นข้อเดียวและรวมระยะทาง', () => {
  const legs = buildLegs(graph, path);
  assert.equal(legs.length, 4);
  assert.deepEqual(
    legs.map((leg) => [leg.act, leg.m, leg.to]),
    [['walk', 25, 'J2'], ['walk', 4, 'LIFT1'], ['lift', 0, 'LIFT2'], ['walk', 20, 'LAB']],
  );
});

test('ลิฟต์บอกทิศขึ้นลงจากชั้นของจุดปลายทาง', () => {
  const [, , lift] = buildLegs(graph, path);
  assert.equal(lift.act, 'lift');
  assert.equal(lift.dir, 'up');
  assert.equal(lift.floor, 2);
});

test('ข้อสุดท้ายบอกว่าถึงที่หมายและอยู่ด้านไหน ข้ออื่นไม่บอก', () => {
  const legs = buildLegs(graph, path);
  assert.equal(legs.at(-1).arrive, 'LAB');
  assert.equal(legs.at(-1).side, 'left');
  assert.equal(legs[0].arrive, undefined);
});

test('ไม่มีเส้นทางให้แปลง คืนรายการว่าง', () => {
  assert.deepEqual(buildLegs(graph, []), []);
});
