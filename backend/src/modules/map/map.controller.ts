import { Controller, Get, Param } from '@nestjs/common';
import { DbService } from '../../db/db.service';
import { notFound } from '../../common/errors';

const NODE_COLUMNS = `
  SELECT n.id, n.code, n.kind, n.name_th, n.name_en, n.landmark_th, n.landmark_en, n.icon,
         n.qr_token IS NOT NULL AS has_qr, d.code AS department,
         f.level AS floor, b.code AS building
    FROM nodes n
    JOIN floors f ON f.id = n.floor_id
    JOIN buildings b ON b.id = f.building_id
    LEFT JOIN departments d ON d.id = n.department_id
   WHERE n.is_active`;

const NODE_SQL = `${NODE_COLUMNS} ORDER BY b.code, f.level, n.code`;
const NODE_BY_QR_SQL = `${NODE_COLUMNS} AND n.qr_token = $1`;

const EDGE_SQL = `
  SELECT e.id, fn.code AS from_code, tn.code AS to_code, e.kind, e.distance_m, e.walk_seconds,
         e.turn, e.is_accessible, e.status, e.closed_reason
    FROM edges e
    JOIN nodes fn ON fn.id = e.from_node_id
    JOIN nodes tn ON tn.id = e.to_node_id
   ORDER BY e.id`;

const DEPARTMENT_SQL = `
  SELECT d.id, d.code, d.name_th, d.name_en, d.color, n.code AS entrance_node,
         f.level AS floor, b.code AS building
    FROM departments d
    JOIN floors f ON f.id = d.floor_id
    JOIN buildings b ON b.id = f.building_id
    LEFT JOIN nodes n ON n.id = d.entrance_node_id
   ORDER BY d.code`;

@Controller('api')
export class MapController {
  constructor(private readonly db: DbService) {}

  /** ผังทั้งชุด — หน้าที่ต้องวาดแผนที่หรือคิดเส้นทางเองขอจากที่นี่ที่เดียว */
  @Get('map')
  async map() {
    const [nodes, edges, departments] = await Promise.all([
      this.db.query(NODE_SQL),
      this.db.query(EDGE_SQL),
      this.db.query(DEPARTMENT_SQL),
    ]);
    return { nodes: nodes.rows, edges: edges.rows, departments: departments.rows };
  }

  @Get('nodes')
  async nodes() {
    return { nodes: (await this.db.query(NODE_SQL)).rows };
  }

  /** ค้นจุดจาก QR ที่ติดผนัง — ผู้ป่วยสแกนแล้วระบบรู้ว่ายืนอยู่ตรงไหน */
  @Get('nodes/by-qr/:token')
  async byQr(@Param('token') token: string) {
    const { rows } = await this.db.query(NODE_BY_QR_SQL, [token]);
    if (rows.length === 0) throw notFound('คิวอาร์นี้ไม่ตรงกับจุดใดในผัง', 'No node for this QR code');
    return { node: rows[0] };
  }
}
