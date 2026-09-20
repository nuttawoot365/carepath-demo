import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { buildGraph } from './graph';
import type { Graph, GraphEdge, GraphNode } from './types';

const NODE_SQL = `
  SELECT n.id, n.code, n.kind, n.name_th, n.name_en, n.landmark_th, n.landmark_en,
         n.icon, n.qr_token, n.department_id, f.level AS floor, b.code AS building
    FROM nodes n
    JOIN floors f ON f.id = n.floor_id
    JOIN buildings b ON b.id = f.building_id
   WHERE n.is_active`;

const EDGE_SQL = `
  SELECT e.id, e.from_node_id, e.to_node_id, e.kind, e.distance_m, e.walk_seconds, e.turn,
         e.instruction_th, e.instruction_en, e.is_accessible
    FROM edges e
    JOIN nodes fn ON fn.id = e.from_node_id AND fn.is_active
    JOIN nodes tn ON tn.id = e.to_node_id   AND tn.is_active
   WHERE e.status = 'open'`;

/** แคชกราฟ: โหลดครั้งเดียว ทิ้งเมื่อ admin แก้ผัง */
@Injectable()
export class GraphService {
  private cached: Graph | null = null;

  constructor(private readonly db: DbService) {}

  async getGraph(): Promise<Graph> {
    if (this.cached) return this.cached;
    const [nodes, edges] = await Promise.all([
      this.db.query<GraphNode>(NODE_SQL),
      this.db.query<GraphEdge>(EDGE_SQL),
    ]);
    this.cached = buildGraph(nodes.rows, edges.rows);
    return this.cached;
  }

  invalidate(): void {
    this.cached = null;
  }
}
