import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { requireRole } from '../lib/auth.js';
import { forbidden, notFound } from '../lib/errors.js';
import { requireFields, requireOneOf } from '../lib/validate.js';
import { changeStatus } from '../domain/steps.js';
import { costFor, getGraph, shortestTimes } from '../domain/graph.js';
import { findVisitBy, insertStep, loadSteps, visitState } from '../domain/visit.js';

const router = Router();

/** แผนกและจุดบริการของแต่ละแผนก — แถบสลับแผนกบนจอจุดบริการใช้รายการนี้ */
router.get('/stations', requireRole('station', 'admin', 'registrar', 'executive'), async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT d.code, d.name_th, d.name_en, d.color,
              ARRAY_AGG(n.code ORDER BY n.code) FILTER (WHERE n.id IS NOT NULL) AS points,
              (SELECT STRING_AGG(u.display_name, ', ')
                 FROM users u WHERE u.department_id = d.id AND u.is_active) AS staff
         FROM departments d
         LEFT JOIN nodes n ON n.department_id = d.id AND n.is_active
        GROUP BY d.id
        ORDER BY d.code`,
    );
    res.json({ stations: rows.map((row) => ({ ...row, points: row.points ?? [] })) });
  } catch (error) {
    next(error);
  }
});

/** คิวของแผนกหนึ่ง = ขั้นที่ยังไม่เสร็จและอยู่ที่จุดบริการของแผนกนั้น */
router.get('/stations/:code/queue', requireRole('station', 'admin'), async (req, res, next) => {
  try {
    const code = String(req.params.code);
    if (req.user.role === 'station' && req.user.department_code !== code) throw forbidden();

    const { rows } = await query(
      `SELECT vs.id, vs.status, vs.sequence, vs.name_th, vs.name_en, vs.deadline_time,
              vs.deadline_reason_th, vs.origin, vs.arrived_at, vs.called_at, vs.est_minutes,
              n.code AS point_code, n.name_th AS point_th,
              v.id AS visit_id, v.ticket_no, v.short_code, v.profile, v.lang, v.has_phone,
              v.companion_present, v.current_node_id,
              p.display_name AS patient_name,
              (SELECT BOOL_AND(r.status IN ('done','skipped'))
                 FROM visit_step_prereqs pr
                 JOIN visit_steps r ON r.id = pr.requires_step_id
                WHERE pr.step_id = vs.id) AS prereqs_met
         FROM visit_steps vs
         JOIN nodes n ON n.id = vs.service_point_id
         JOIN departments d ON d.id = n.department_id
         JOIN visits v ON v.id = vs.visit_id
         JOIN patients p ON p.id = v.patient_id
        WHERE d.code = $1
          AND v.visit_date = CURRENT_DATE
          AND v.status = 'active'
          AND vs.status IN ('pending','arrived','in_progress')
        ORDER BY vs.status DESC, vs.sequence`,
      [code],
    );

    const graph = await getGraph();
    const queue = rows.map((row) => {
      const ready = row.prereqs_met !== false;
      const seconds =
        ready && row.current_node_id
          ? shortestTimes(graph, row.current_node_id, costFor({ ...row.profile, has_phone: row.has_phone }))
              .get(pointIdOf(graph, row.point_code)) ?? null
          : null;

      return {
        id: row.id,
        status: row.status,
        name_th: row.name_th,
        name_en: row.name_en,
        point: row.point_code,
        point_th: row.point_th,
        deadline_time: row.deadline_time ? String(row.deadline_time).slice(0, 5) : null,
        deadline_reason_th: row.deadline_reason_th,
        origin: row.origin,
        arrived_at: row.arrived_at,
        called_at: row.called_at,
        ready,
        walk_seconds: seconds === null ? null : Math.round(seconds),
        visit: {
          id: row.visit_id,
          ticket_no: row.ticket_no,
          patient_name: row.patient_name,
          profile: row.profile,
          lang: row.lang,
          companion_present: row.companion_present,
        },
      };
    });

    res.json({ station: code, queue });
  } catch (error) {
    next(error);
  }
});

const STATUSES = ['arrived', 'in_progress', 'done', 'skipped'];

/** เจ้าหน้าที่กดปุ่มเดียว — ลำดับสถานะบังคับที่ API ไม่ใช่ที่หน้าจอ */
router.post('/steps/:id/status', requireRole('station', 'admin', 'registrar'), async (req, res, next) => {
  try {
    const body = requireFields(req.body, ['status']);
    const target = requireOneOf(String(body.status), STATUSES, 'status');
    const stepId = Number(req.params.id);

    const step = await withTransaction((client) =>
      changeStatus(client, {
        stepId,
        target,
        actorUserId: req.user.id,
        actorKind: 'user',
        reason: body.reason ? String(body.reason).slice(0, 120) : null,
      }),
    );

    const visit = await findVisitBy('id', step.visit_id);
    res.json(await visitState(visit, await loadSteps(visit.id)));
  } catch (error) {
    next(error);
  }
});

/** ส่งตรวจเพิ่มระหว่างวัน — ขั้นใหม่ถูกจัดลำดับใหม่ทั้งแผนและแจ้งผู้ป่วยทันที */
router.post('/visits/:id/steps', requireRole('station', 'admin'), async (req, res, next) => {
  try {
    const body = requireFields(req.body, ['point', 'name_th']);
    const visit = await findVisitBy('id', Number(req.params.id));
    const steps = await loadSteps(visit.id);
    const before = steps.find((step) => step.point_code === (body.before_point ?? 'A1-PAY'));

    await withTransaction(async (client) => {
      await insertStep(client, visit, {
        pointCode: String(body.point),
        nameTh: String(body.name_th),
        nameEn: String(body.name_en ?? body.name_th),
        estMinutes: Number(body.est_minutes ?? 10),
        beforeSequence: before ? Number(before.sequence) : null,
        requires: Array.isArray(body.requires) ? body.requires.map(Number) : [],
        addedBy: req.user.id,
      });
      await client.query(
        'INSERT INTO notifications (visit_id, message_th, message_en) VALUES ($1, $2, $3)',
        [visit.id, `มีขั้นตอนเพิ่ม: ${body.name_th}`, `A step was added: ${body.name_en ?? body.name_th}`],
      );
    });

    const fresh = await findVisitBy('id', visit.id);
    res.status(201).json(await visitState(fresh, await loadSteps(visit.id)));
  } catch (error) {
    next(error);
  }
});

function pointIdOf(graph, code) {
  const node = graph.byCode.get(code);
  if (!node) throw notFound(`ไม่พบจุด ${code}`, `No such node: ${code}`);
  return node.id;
}

export default router;
