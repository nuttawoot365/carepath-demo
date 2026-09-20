import type { EdgeCost, Graph, GraphEdge, GraphNode } from './types';
import type { PatientProfile } from '../common/validate';

/** สร้างกราฟในหน่วยความจำจากแถวที่อ่านมา — บริสุทธิ์ ทดสอบได้โดยไม่ต้องมีฐานข้อมูล */
export function buildGraph(nodeRows: GraphNode[], edgeRows: GraphEdge[]): Graph {
  const nodes = new Map(nodeRows.map((node) => [node.id, node]));
  const byCode = new Map(nodeRows.map((node) => [node.code, node]));
  const adjacency = new Map<number, GraphEdge[]>(nodeRows.map((node) => [node.id, []]));

  for (const edge of edgeRows) {
    adjacency.get(edge.from_node_id)?.push(edge);
  }
  return { nodes, byCode, adjacency };
}

/**
 * ต้นทุนของเส้นเชื่อมตามโปรไฟล์ผู้ป่วย (วินาทีโดยประมาณ)
 * Infinity = ผ่านไม่ได้ เช่น รถเข็นกับบันได
 */
export function costFor(profile: PatientProfile = {}): EdgeCost {
  const slower = profile.elderly || profile.wheelchair ? 1.5 : 1;

  return (edge) => {
    if (profile.wheelchair && !edge.is_accessible) return Infinity;

    let seconds = edge.walk_seconds * slower;
    if (profile.elderly && edge.kind === 'stairs') seconds += 60;
    // ไม่มีมือถือ = อ่านแผนที่ตามทางไม่ได้ ทุกทางเลี้ยวคือความเสี่ยงหลง
    if (profile.has_phone === false && edge.turn && edge.turn !== 'straight') seconds += 5;
    return seconds;
  };
}

export interface ShortestPath {
  seconds: number;
  edges: GraphEdge[];
  toId: number;
}

/** เส้นทางสั้นที่สุดจาก fromId · null = ไปไม่ถึง */
export function dijkstra(
  graph: Graph,
  fromId: number,
  cost: EdgeCost,
  { toId = null, until = null }: { toId?: number | null; until?: ((nodeId: number) => boolean) | null } = {},
): ShortestPath | null {
  if (!graph.nodes.has(fromId)) return null;

  const distance = new Map<number, number>([[fromId, 0]]);
  const cameFrom = new Map<number, GraphEdge>();
  const queue = new MinHeap();
  const settled = new Set<number>();
  queue.push(0, fromId);

  while (queue.size > 0) {
    const { value: nodeId, key: nodeDistance } = queue.pop()!;
    if (settled.has(nodeId)) continue;
    settled.add(nodeId);

    if (nodeId === toId || until?.(nodeId)) {
      return { seconds: nodeDistance, edges: tracePath(cameFrom, nodeId), toId: nodeId };
    }

    for (const edge of graph.adjacency.get(nodeId) ?? []) {
      const weight = cost(edge);
      if (weight === Infinity) continue;

      const candidate = nodeDistance + weight;
      if (candidate < (distance.get(edge.to_node_id) ?? Infinity)) {
        distance.set(edge.to_node_id, candidate);
        cameFrom.set(edge.to_node_id, edge);
        queue.push(candidate, edge.to_node_id);
      }
    }
  }
  return null;
}

/** ระยะทางจากจุดเดียวไปทุกจุด — ใช้ตอนเลือกขั้นถัดไปที่ใกล้ที่สุด (เรียก Dijkstra ครั้งเดียว) */
export function shortestTimes(graph: Graph, fromId: number, cost: EdgeCost): Map<number, number> {
  const distance = new Map<number, number>();
  if (!graph.nodes.has(fromId)) return distance;

  const queue = new MinHeap();
  queue.push(0, fromId);
  distance.set(fromId, 0);

  while (queue.size > 0) {
    const { value: nodeId, key: nodeDistance } = queue.pop()!;
    if (nodeDistance > (distance.get(nodeId) ?? Infinity)) continue;

    for (const edge of graph.adjacency.get(nodeId) ?? []) {
      const weight = cost(edge);
      if (weight === Infinity) continue;

      const candidate = nodeDistance + weight;
      if (candidate < (distance.get(edge.to_node_id) ?? Infinity)) {
        distance.set(edge.to_node_id, candidate);
        queue.push(candidate, edge.to_node_id);
      }
    }
  }
  return distance;
}

function tracePath(cameFrom: Map<number, GraphEdge>, targetId: number): GraphEdge[] {
  const edges: GraphEdge[] = [];
  for (let id = targetId; cameFrom.has(id); id = cameFrom.get(id)!.from_node_id) {
    edges.unshift(cameFrom.get(id)!);
  }
  return edges;
}

class MinHeap {
  #items: { key: number; value: number }[] = [];

  get size() { return this.#items.length; }

  push(key: number, value: number) {
    const items = this.#items;
    items.push({ key, value });
    for (let i = items.length - 1; i > 0; ) {
      const parent = (i - 1) >> 1;
      if (items[parent].key <= items[i].key) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }

  pop() {
    const items = this.#items;
    const top = items[0];
    const last = items.pop()!;
    if (items.length > 0) {
      items[0] = last;
      for (let i = 0; ; ) {
        const left = i * 2 + 1;
        const right = left + 1;
        let smallest = i;
        if (left < items.length && items[left].key < items[smallest].key) smallest = left;
        if (right < items.length && items[right].key < items[smallest].key) smallest = right;
        if (smallest === i) break;
        [items[smallest], items[i]] = [items[i], items[smallest]];
        i = smallest;
      }
    }
    return top;
  }
}
