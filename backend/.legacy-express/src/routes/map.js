import { Router } from 'express';
import { query } from '../db.js';
import { notFound } from '../lib/errors.js';

const router = Router();

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

/** ผังทั้งชุด — หน้าที่ต้องวาดแผนที่หรือคิดเส้นทางเองขอจากที่นี่ที่เดียว */
router.get('/map', async (_req, res, next) => {
  try {
    const [nodes, edges, departments] = await Promise.all([
      query(NODE_SQL),
      query(EDGE_SQL),
      query(DEPARTMENT_SQL),
    ]);
    res.json({
      nodes: nodes.rows,
      edges: edges.rows,
      departments: departments.rows,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/nodes', async (_req, res, next) => {
  try {
    res.json({ nodes: (await query(NODE_SQL)).rows });
  } catch (error) {
    next(error);
  }
});

/** ค้นจุดจาก QR ที่ติดผนัง — ผู้ป่วยสแกนแล้วระบบรู้ว่ายืนอยู่ตรงไหน */
router.get('/nodes/by-qr/:token', async (req, res, next) => {
  try {
    const { rows } = await query(NODE_BY_QR_SQL, [req.params.token]);
    if (rows.length === 0) throw notFound('คิวอาร์นี้ไม่ตรงกับจุดใดในผัง', 'No node for this QR code');
    res.json({ node: rows[0] });
  } catch (error) {
    next(error);
  }
});

export default router;
