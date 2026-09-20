import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import { config } from '../config.js';
import { query, withTransaction } from '../db.js';
import { requireRole } from '../lib/auth.js';
import { badRequest, notFound } from '../lib/errors.js';
import { recordAudit, notifyVisit } from '../lib/audit.js';
import { requireFields, requireOneOf } from '../lib/validate.js';
import { getDemoTime, setDemoTime } from '../lib/clock.js';
import { costFor, getGraph, invalidateGraph, shortestTimes } from '../domain/graph.js';
import { importAll } from '../domain/seed.js';
import { parseCsv } from '../lib/csv.js';

const router = Router();

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaFile = path.join(here, '..', '..', 'sql', 'schema.sql');
const dataDir = process.env.DATA_DIR ?? path.join(here, '..', '..', '..', 'data');
const SEED_FILES = ['nodes', 'edges', 'departments', 'templates', 'pathways', 'users', 'patients', 'node-photos'];

/**
 * ปิดหรือเปิดเส้นทาง (ลิฟต์ซ่อม ทางเดินปิด) — กราฟถูกล้างแคชและผู้ป่วยที่กระทบได้รับแจ้งทันที
 * ปิดทั้งสองทิศเสมอ เพราะทางเดินปิดแล้วเดินสวนก็ไม่ได้
 */
router.patch('/edges/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const body = requireFields(req.body, ['status']);
    const status = requireOneOf(String(body.status), ['open', 'closed'], 'status');
    const reason = body.closed_reason ? String(body.closed_reason).slice(0, 120) : null;

    const { rows } = await query('SELECT id, from_node_id, to_node_id FROM edges WHERE id = $1', [
      Number(req.params.id),
    ]);
    if (rows.length === 0) throw notFound('ไม่พบเส้นทางนี้', 'No such edge');
    const edge = rows[0];

    const affected = await withTransaction(async (client) => {
      const { rows: changed } = await client.query(
        `UPDATE edges SET status = $1, closed_reason = $2
          WHERE (from_node_id = $3 AND to_node_id = $4) OR (from_node_id = $4 AND to_node_id = $3)
          RETURNING id`,
        [status, status === 'closed' ? reason : null, edge.from_node_id, edge.to_node_id],
      );
      await recordAudit(client, {
        actorUserId: req.user.id,
        actorKind: 'user',
        entity: 'edge',
        entityId: edge.id,
        action: 'status',
        toStatus: status,
        detail: { reason, directions: changed.length },
      });
      return changed.length;
    });

    invalidateGraph();
    const notified = await notifyAffectedVisits(status, reason);

    res.json({ ok: true, directions: affected, notified });
  } catch (error) {
    next(error);
  }
});

/** ผู้ป่วยที่กำลังเดินอยู่ และยังมีขั้นที่ต้องไปต่อ ควรรู้ทันทีว่าเส้นทางเปลี่ยน */
async function notifyAffectedVisits(status, reason) {
  const { rows } = await query(
    `SELECT DISTINCT v.id FROM visits v
       JOIN visit_steps vs ON vs.visit_id = v.id AND vs.status IN ('pending','arrived')
      WHERE v.visit_date = CURRENT_DATE AND v.status = 'active'`,
  );
  if (rows.length === 0) return 0;

  const messageTh = status === 'closed'
    ? `เส้นทางเปลี่ยน — ${reason ?? 'มีเส้นทางปิดระหว่างวัน'} ระบบคำนวณทางใหม่ให้แล้ว`
    : 'เส้นทางที่ปิดไว้กลับมาใช้ได้แล้ว';
  const messageEn = status === 'closed'
    ? `Your route changed — ${reason ?? 'a route is closed'}. A new route is ready.`
    : 'A closed route has reopened';

  await withTransaction(async (client) => {
    for (const visit of rows) await notifyVisit(client, visit.id, messageTh, messageEn);
  });
  return rows.length;
}

/** ผลกระทบก่อนกดปิด: ผู้ใช้รถเข็นกับคนเดินเดินเพิ่มกี่เมตร และมีจุดไหนไปไม่ถึงบ้าง */
router.get('/edges/:id/impact', requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT e.id, fn.code AS from_code, tn.code AS to_code, e.kind
         FROM edges e JOIN nodes fn ON fn.id = e.from_node_id JOIN nodes tn ON tn.id = e.to_node_id
        WHERE e.id = $1`,
      [Number(req.params.id)],
    );
    if (rows.length === 0) throw notFound('ไม่พบเส้นทางนี้', 'No such edge');
    const edge = rows[0];

    const graph = await getGraph();
    const start = graph.byCode.get('A1-ENT');
    if (!start) throw badRequest('ผังนี้ไม่มีทางเข้าหลัก', 'This map has no main entrance');

    const before = {
      walking: reachSummary(graph, start.id, costFor({})),
      wheelchair: reachSummary(graph, start.id, costFor({ wheelchair: true })),
    };

    // จำลองการปิดโดยไม่แตะฐานข้อมูล: ตัดเส้นทั้งสองทิศออกจากกราฟสำเนา
    const closed = closeInGraph(graph, edge.from_code, edge.to_code);
    const after = {
      walking: reachSummary(closed, start.id, costFor({})),
      wheelchair: reachSummary(closed, start.id, costFor({ wheelchair: true })),
    };

    res.json({ edge, before, after });
  } catch (error) {
    next(error);
  }
});

function reachSummary(graph, fromId, cost) {
  const distances = shortestTimes(graph, fromId, cost);
  const reachable = [...distances.values()];
  return {
    reachable: reachable.length,
    unreachable: graph.nodes.size - reachable.length,
    total_seconds: Math.round(reachable.reduce((sum, value) => sum + value, 0)),
  };
}

function closeInGraph(graph, fromCode, toCode) {
  const blocked = new Set([`${fromCode}>${toCode}`, `${toCode}>${fromCode}`]);
  const adjacency = new Map();

  for (const [nodeId, edges] of graph.adjacency) {
    adjacency.set(
      nodeId,
      edges.filter((edge) => {
        const key = `${graph.nodes.get(edge.from_node_id).code}>${graph.nodes.get(edge.to_node_id).code}`;
        return !blocked.has(key);
      }),
    );
  }
  return { ...graph, adjacency };
}

router.get('/audit', requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT a.id, a.actor_kind, a.entity, a.entity_id, a.action, a.from_status, a.to_status,
              a.detail, a.created_at, u.username AS actor
         FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_user_id
        ORDER BY a.id DESC LIMIT $1`,
      [Math.min(Number(req.query.limit ?? 100), 500)],
    );
    res.json({ audit: rows });
  } catch (error) {
    next(error);
  }
});

/* ---------- โหมดเดโม: นาฬิกาจำลองและการรีเซ็ตข้อมูล ---------- */

router.get('/demo/clock', (_req, res) => {
  res.json({ demo: config.isDemo, time: getDemoTime() });
});

router.post('/demo/clock', (req, res, next) => {
  try {
    if (!config.isDemo) throw notFound();
    const time = req.body?.time ?? null;
    if (!setDemoTime(time === null ? null : String(time))) {
      throw badRequest('เวลาต้องอยู่ในรูป HH:MM', 'Time must look like HH:MM');
    }
    res.json({ time: getDemoTime() });
  } catch (error) {
    next(error);
  }
});

/** ล้างและนำเข้าข้อมูลตัวอย่างใหม่ทั้งชุด — เปิดเฉพาะโหมดเดโม */
router.post('/demo/reset', async (_req, res, next) => {
  try {
    if (!config.isDemo) throw notFound();

    const schema = await fs.readFile(schemaFile, 'utf8');
    const files = Object.fromEntries(
      await Promise.all(SEED_FILES.map(async (name) => [name, await readCsv(name)])),
    );

    const summary = await withTransaction(async (client) => {
      await client.query(schema);
      return importAll(client, files);
    });

    invalidateGraph();
    res.json({ ok: true, summary });
  } catch (error) {
    next(error);
  }
});

async function readCsv(name) {
  try {
    return parseCsv(await fs.readFile(path.join(dataDir, `${name}.csv`), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

export default router;
