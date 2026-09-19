import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGraph, costFor, dijkstra, shortestTimes } from '../src/domain/graph.js';

/** ผังย่อสำหรับทดสอบ: A1 ─ชั้น1─ J1 ─(ลิฟต์/บันได)─ J2 ─ B2 */
const nodes = [
  { id: 1, code: 'ENT', is_active: true },
  { id: 2, code: 'J1', is_active: true },
  { id: 3, code: 'LIFT1', is_active: true },
  { id: 4, code: 'LIFT2', is_active: true },
  { id: 5, code: 'STAIR1', is_active: true },
  { id: 6, code: 'STAIR2', is_active: true },
  { id: 7, code: 'LAB', is_active: true },
];

const edge = (from, to, kind, seconds, accessible = true) =>
  ({ id: `${from}-${to}`, from_node_id: from, to_node_id: to, kind, distance_m: seconds, walk_seconds: seconds, is_accessible: accessible, turn: 'straight' });

const both = (a, b, kind, seconds, accessible = true) =>
  [edge(a, b, kind, seconds, accessible), edge(b, a, kind, seconds, accessible)];

const edges = [
  ...both(1, 2, 'corridor', 10),
  ...both(2, 3, 'door', 4),
  ...both(2, 5, 'door', 4, false),          // ทางเข้าบันได รถเข็นผ่านไม่ได้
  ...both(3, 4, 'elevator', 50),            // ลิฟต์ ช้ากว่าแต่รถเข็นใช้ได้
  ...both(5, 6, 'stairs', 20, false),       // บันได เร็วกว่าแต่รถเข็นใช้ไม่ได้
  ...both(4, 7, 'corridor', 10),
  ...both(6, 7, 'corridor', 10),
];

const graph = buildGraph(nodes, edges);

test('คนเดินปกติเลือกบันไดเพราะเร็วกว่าลิฟต์', () => {
  const route = dijkstra(graph, 1, costFor({}), { toId: 7 });
  assert.ok(route, 'ต้องหาเส้นทางเจอ');
  assert.equal(route.seconds, 44);  // 10 + 4 + 20 + 10
  assert.deepEqual(route.edges.map((e) => e.to_node_id), [2, 5, 6, 7]);
});

test('รถเข็นเลี่ยงบันไดและไปทางลิฟต์แทน', () => {
  const route = dijkstra(graph, 1, costFor({ wheelchair: true }), { toId: 7 });
  assert.ok(route);
  assert.deepEqual(route.edges.map((e) => e.to_node_id), [2, 3, 4, 7]);
  assert.ok(route.seconds > 44, 'เส้นทางรถเข็นต้องใช้เวลามากกว่าเส้นทางบันได');
});

test('ผู้สูงอายุเดินช้าลง เวลาจึงมากกว่าคนเดินปกติบนเส้นทางเดียวกัน', () => {
  const normal = dijkstra(graph, 1, costFor({}), { toId: 7 });
  const elderly = dijkstra(graph, 1, costFor({ elderly: true }), { toId: 7 });
  assert.ok(elderly.seconds > normal.seconds);
});

test('ปิดทางลิฟต์แล้วรถเข็นไปไม่ถึง คืนค่า null ไม่ใช่เส้นทางผิด', () => {
  const withoutLift = buildGraph(nodes, edges.filter((e) => e.kind !== 'elevator'));
  const route = dijkstra(withoutLift, 1, costFor({ wheelchair: true }), { toId: 7 });
  assert.equal(route, null);
});

test('จุดที่ไม่มีอยู่ในกราฟ คืนค่า null', () => {
  assert.equal(dijkstra(graph, 999, costFor({}), { toId: 7 }), null);
});

test('ทางเดียวกลับไม่ได้ เช่นบันไดหนีไฟ', () => {
  const oneWay = buildGraph(nodes, [edge(1, 2, 'corridor', 10), edge(2, 7, 'stairs', 20)]);
  assert.ok(dijkstra(oneWay, 1, costFor({}), { toId: 7 }));
  assert.equal(dijkstra(oneWay, 7, costFor({}), { toId: 1 }), null);
});

test('shortestTimes คืนเวลาไปทุกจุดในครั้งเดียว', () => {
  const times = shortestTimes(graph, 1, costFor({}));
  assert.equal(times.get(1), 0);
  assert.equal(times.get(7), 44);
  assert.ok(times.size >= 6);
});
