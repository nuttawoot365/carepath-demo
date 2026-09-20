/**
 * แปลงเส้นเชื่อมที่ Dijkstra คืนมาเป็น "ช่วงเดิน" แบบข้อมูลล้วน (ไม่ใช่ประโยค)
 * หน้าผู้ป่วยรองรับ 5 ภาษา จึงประกอบประโยคเองจากช่วงเหล่านี้
 * โครงเดียวกับ ROUTES ในต้นแบบ: { act, turn, m, to, arrive, side, building, floor }
 */
import type { Graph, GraphEdge } from './types';

const WALKABLE = new Set(['corridor', 'door']);

const ACT_OF: Record<string, string> = {
  elevator: 'lift', stairs: 'stairs', ramp: 'ramp', bridge: 'bridge',
};

export interface Leg {
  act: string;
  m: number;
  seconds: number;
  to: string;
  to_th: string | null;
  to_en: string | null;
  icon: string | null;
  building: string;
  floor: number;
  landmark_th: string | null;
  landmark_en: string | null;
  text_th: string | null;
  text_en: string | null;
  turn?: string;
  arrive?: string;
  side?: string;
  name?: string;
  name_th?: string | null;
  name_en?: string | null;
  dir?: 'up' | 'down';
}

export function buildLegs(graph: Graph, edges: GraphEdge[]): Leg[] {
  if (edges.length === 0) return [];

  const segments = groupSegments(edges);

  return segments.map((segment, index) => {
    const firstEdge = segment[0];
    const lastEdge = segment.at(-1)!;
    const fromNode = graph.nodes.get(firstEdge.from_node_id)!;
    const toNode = graph.nodes.get(lastEdge.to_node_id)!;
    const isLast = index === segments.length - 1;
    const metres = round1(segment.reduce((total, edge) => total + Number(edge.distance_m), 0));
    const seconds = segment.reduce((total, edge) => total + edge.walk_seconds, 0);

    const leg: Leg = {
      act: WALKABLE.has(lastEdge.kind) ? 'walk' : (ACT_OF[lastEdge.kind] ?? 'walk'),
      m: metres,
      seconds,
      to: toNode.code,
      to_th: toNode.name_th,
      to_en: toNode.name_en,
      icon: toNode.icon ?? null,
      building: toNode.building,
      floor: toNode.floor,
      landmark_th: toNode.landmark_th,
      landmark_en: toNode.landmark_en,
      text_th: lastEdge.instruction_th ?? null,
      text_en: lastEdge.instruction_en ?? null,
    };

    if (leg.act === 'walk') {
      leg.turn = firstEdge.turn ?? 'straight';
      if (isLast) {
        leg.arrive = toNode.code;
        leg.side = lastEdge.turn === 'left' || lastEdge.turn === 'right' ? lastEdge.turn : 'ahead';
      }
    } else {
      leg.name = toNode.code;
      leg.name_th = toNode.name_th;
      leg.name_en = toNode.name_en;
      leg.dir = toNode.floor >= fromNode.floor ? 'up' : 'down';
      if (isLast) leg.arrive = toNode.code;
    }
    return leg;
  });
}

/** ทางเดินตรงต่อเนื่องยุบเป็นช่วงเดียว · ลิฟต์ บันได ทางลาด ทางเชื่อม แยกช่วงเสมอ */
function groupSegments(edges: GraphEdge[]): GraphEdge[][] {
  const segments: GraphEdge[][] = [];

  for (const edge of edges) {
    const current = segments.at(-1);
    const continues =
      current &&
      WALKABLE.has(edge.kind) &&
      WALKABLE.has(current.at(-1)!.kind) &&
      (edge.turn === 'straight' || edge.turn === null);

    if (continues) current!.push(edge);
    else segments.push([edge]);
  }
  return segments;
}

const round1 = (value: number) => Math.round(value * 10) / 10;
