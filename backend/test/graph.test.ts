import { buildGraph, costFor, dijkstra, shortestTimes } from '../src/domain/graph';
import type { GraphEdge, GraphNode } from '../src/domain/types';

/** ผังย่อสำหรับทดสอบ: A1 ─ชั้น1─ J1 ─(ลิฟต์/บันได)─ J2 ─ B2 */
const node = (id: number, code: string): GraphNode =>
  ({ id, code, kind: 'point', name_th: code, name_en: code, landmark_th: null,
     landmark_en: null, icon: null, department_id: null, floor: 1, building: 'A' });

const nodes = [
  node(1, 'ENT'), node(2, 'J1'), node(3, 'LIFT1'), node(4, 'LIFT2'),
  node(5, 'STAIR1'), node(6, 'STAIR2'), node(7, 'LAB'),
];

const edge = (from: number, to: number, kind: string, seconds: number, accessible = true): GraphEdge =>
  ({ id: `${from}-${to}`, from_node_id: from, to_node_id: to, kind, distance_m: seconds,
     walk_seconds: seconds, is_accessible: accessible, turn: 'straight' });

const both = (a: number, b: number, kind: string, seconds: number, accessible = true) =>
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

it('คนเดินปกติเลือกบันไดเพราะเร็วกว่าลิฟต์', () => {
  const route = dijkstra(graph, 1, costFor({}), { toId: 7 });
  expect(route).not.toBeNull();
  expect(route!.seconds).toBe(44); // 10 + 4 + 20 + 10
  expect(route!.edges.map((e) => e.to_node_id)).toEqual([2, 5, 6, 7]);
});

it('รถเข็นเลี่ยงบันไดและไปทางลิฟต์แทน', () => {
  const route = dijkstra(graph, 1, costFor({ wheelchair: true }), { toId: 7 });
  expect(route).not.toBeNull();
  expect(route!.edges.map((e) => e.to_node_id)).toEqual([2, 3, 4, 7]);
  expect(route!.seconds).toBeGreaterThan(44);
});

it('ผู้สูงอายุเดินช้าลง เวลาจึงมากกว่าคนเดินปกติบนเส้นทางเดียวกัน', () => {
  const normal = dijkstra(graph, 1, costFor({}), { toId: 7 })!;
  const elderly = dijkstra(graph, 1, costFor({ elderly: true }), { toId: 7 })!;
  expect(elderly.seconds).toBeGreaterThan(normal.seconds);
});

it('ปิดทางลิฟต์แล้วรถเข็นไปไม่ถึง คืนค่า null ไม่ใช่เส้นทางผิด', () => {
  const withoutLift = buildGraph(nodes, edges.filter((e) => e.kind !== 'elevator'));
  expect(dijkstra(withoutLift, 1, costFor({ wheelchair: true }), { toId: 7 })).toBeNull();
});

it('จุดที่ไม่มีอยู่ในกราฟ คืนค่า null', () => {
  expect(dijkstra(graph, 999, costFor({}), { toId: 7 })).toBeNull();
});

it('ทางเดียวกลับไม่ได้ เช่นบันไดหนีไฟ', () => {
  const oneWay = buildGraph(nodes, [edge(1, 2, 'corridor', 10), edge(2, 7, 'stairs', 20)]);
  expect(dijkstra(oneWay, 1, costFor({}), { toId: 7 })).not.toBeNull();
  expect(dijkstra(oneWay, 7, costFor({}), { toId: 1 })).toBeNull();
});

it('shortestTimes คืนเวลาไปทุกจุดในครั้งเดียว', () => {
  const times = shortestTimes(graph, 1, costFor({}));
  expect(times.get(1)).toBe(0);
  expect(times.get(7)).toBe(44);
  expect(times.size).toBeGreaterThanOrEqual(6);
});
