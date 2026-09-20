/**
 * การมาโรงพยาบาลหนึ่งครั้ง — เปิด visit จากแม่แบบ อ่านสถานะ และคิดขั้นถัดไปพร้อมเส้นทาง
 * ทุก query เป็น parameterized · ทุก timestamp มาจากเซิร์ฟเวอร์
 */
import { query } from '../db.js';
import { getGraph, costFor, dijkstra, shortestTimes } from './graph.js';
import { buildInstructions } from './instructions.js';
import { buildLegs } from './legs.js';
import { planNextStep, topologicalOrder } from './pathway.js';
import { recordAudit } from '../lib/audit.js';
import { endOfToday, minutesOfDay, now } from '../lib/clock.js';
import { shortCode, visitToken } from '../lib/ids.js';
import { conflict, notFound } from '../lib/errors.js';

const VISIT_SQL = `
  SELECT v.id, v.token, v.short_code, v.ticket_no, v.visit_date, v.profile, v.lang,
         v.has_phone, v.companion_present, v.status, v.current_node_id, v.position_source,
         v.position_confirmed_at, v.checked_in_at, v.completed_at, v.expires_at,
         p.hn, p.display_name AS patient_name,
         t.code AS template_code, t.name_th AS template_th, t.name_en AS template_en,
         n.code AS at_code, n.name_th AS at_th, n.name_en AS at_en, n.icon AS at_icon,
         f.level AS at_floor, b.code AS at_building
    FROM visits v
    JOIN patients p ON p.id = v.patient_id
    JOIN pathway_templates t ON t.id = v.template_id
    LEFT JOIN nodes n ON n.id = v.current_node_id
    LEFT JOIN floors f ON f.id = n.floor_id
    LEFT JOIN buildings b ON b.id = f.building_id`;

const STEP_SQL = `
  SELECT vs.id, vs.visit_id, vs.sequence, vs.name_th, vs.name_en, vs.status,
         vs.deadline_time, vs.deadline_reason_th, vs.est_minutes, vs.wait_after_minutes,
         vs.origin, vs.skip_reason, vs.arrived_at, vs.called_at, vs.finished_at,
         vs.service_point_id,
         n.code AS point_code, n.name_th AS point_th, n.name_en AS point_en, n.icon AS point_icon,
         d.code AS dept_code, f.level AS floor, b.code AS building,
         COALESCE(ARRAY_AGG(pr.requires_step_id) FILTER (WHERE pr.requires_step_id IS NOT NULL), '{}')
           AS requires
    FROM visit_steps vs
    JOIN nodes n ON n.id = vs.service_point_id
    JOIN floors f ON f.id = n.floor_id
    JOIN buildings b ON b.id = f.building_id
    LEFT JOIN departments d ON d.id = n.department_id
    LEFT JOIN visit_step_prereqs pr ON pr.step_id = vs.id
   WHERE vs.visit_id = $1
   GROUP BY vs.id, n.id, d.code, f.level, b.code
   ORDER BY vs.sequence, vs.id`;

export async function findVisitBy(field, value) {
  const column = { id: 'v.id', token: 'v.token', short_code: 'v.short_code' }[field];
  if (!column) throw new Error(`unknown visit lookup field: ${field}`);

  const { rows } = await query(`${VISIT_SQL} WHERE ${column} = $1`, [value]);
  if (rows.length === 0) throw notFound('ไม่พบบัตรคิวใบนี้', 'No such visit');
  return rows[0];
}

export const loadSteps = async (visitId) => (await query(STEP_SQL, [visitId])).rows;

/** เปิด visit ใหม่จากแม่แบบ — visits + visit_steps + prereqs + audit ในทรานแซกชันเดียว */
export async function createVisit(client, input) {
  const { rows: templateRows } = await client.query(
    'SELECT id, code FROM pathway_templates WHERE code = $1 AND is_active',
    [input.templateCode],
  );
  if (templateRows.length === 0) throw notFound('ไม่พบแม่แบบขั้นตอนนี้', 'No such pathway template');
  const template = templateRows[0];

  const { rows: patientRows } = await client.query('SELECT id, hn FROM patients WHERE hn = $1', [
    input.hn,
  ]);
  if (patientRows.length === 0) throw notFound('ไม่พบผู้ป่วยรายนี้', 'No such patient');
  const patient = patientRows[0];

  const startNode = await nodeIdByCode(client, input.startNodeCode ?? 'A1-ENT');
  const ticketNo = await nextTicketNo(client);

  const { rows: visitRows } = await client.query(
    `INSERT INTO visits (patient_id, template_id, visit_date, token, short_code, ticket_no,
                         profile, lang, has_phone, companion_present,
                         current_node_id, position_source, position_confirmed_at, expires_at)
     VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8, $9, $10, 'station', now(), $11)
     RETURNING id, token, short_code, ticket_no`,
    [
      patient.id,
      template.id,
      visitToken(),
      shortCode(ticketNo),
      ticketNo,
      input.profile ?? {},
      input.lang ?? 'th',
      input.hasPhone ?? true,
      input.companionPresent ?? false,
      startNode,
      endOfToday(),
    ],
  );
  const visit = visitRows[0];

  const { rows: templateSteps } = await client.query(
    `SELECT ts.id, ts.sequence, ts.service_point_id, ts.name_th, ts.name_en, ts.deadline_time,
            ts.deadline_reason_th, ts.est_minutes, ts.wait_after_minutes,
            COALESCE(ARRAY_AGG(pr.requires_step_id) FILTER (WHERE pr.requires_step_id IS NOT NULL), '{}')
              AS requires
       FROM template_steps ts
       LEFT JOIN template_step_prereqs pr ON pr.step_id = ts.id
      WHERE ts.template_id = $1
      GROUP BY ts.id
      ORDER BY ts.sequence`,
    [template.id],
  );

  const idByTemplateStep = new Map();
  for (const step of templateSteps) {
    const { rows } = await client.query(
      `INSERT INTO visit_steps (visit_id, service_point_id, sequence, name_th, name_en,
                                deadline_time, deadline_reason_th, est_minutes, wait_after_minutes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        visit.id,
        step.service_point_id,
        step.sequence,
        step.name_th,
        step.name_en,
        step.deadline_time,
        step.deadline_reason_th,
        step.est_minutes,
        step.wait_after_minutes,
      ],
    );
    idByTemplateStep.set(step.id, rows[0].id);
  }

  for (const step of templateSteps) {
    for (const requiredId of step.requires) {
      await client.query(
        'INSERT INTO visit_step_prereqs (step_id, requires_step_id) VALUES ($1, $2)',
        [idByTemplateStep.get(step.id), idByTemplateStep.get(requiredId)],
      );
    }
  }

  await recordAudit(client, {
    actorUserId: input.actorUserId,
    actorKind: 'user',
    entity: 'visit',
    entityId: visit.id,
    action: 'create',
    toStatus: 'active',
    detail: {
      template: template.code,
      hn: patient.hn,
      steps: templateSteps.length,
      privacy_notice_given: Boolean(input.privacyNoticeGiven),
    },
  });

  return visit;
}

/** แทรกขั้นใหม่ให้ visit ที่กำลังเดินอยู่ · ลำดับใหม่มาจาก topological sort */
export async function insertStep(client, visit, input) {
  const servicePointId = await nodeIdByCode(client, input.pointCode);

  const { rows: existing } = await client.query(
    `SELECT vs.id, vs.sequence, COALESCE(ARRAY_AGG(pr.requires_step_id)
              FILTER (WHERE pr.requires_step_id IS NOT NULL), '{}') AS requires
       FROM visit_steps vs
       LEFT JOIN visit_step_prereqs pr ON pr.step_id = vs.id
      WHERE vs.visit_id = $1
      GROUP BY vs.id`,
    [visit.id],
  );

  // แทรกไว้ก่อนขั้นที่ระบุ (ปกติคือ "ชำระเงิน") โดยใช้ลำดับกึ่งกลาง
  const before = input.beforeSequence ?? null;
  const sequence =
    before === null
      ? Math.max(0, ...existing.map((step) => Number(step.sequence))) + 1
      : Number(before) - 0.5;

  const { rows } = await client.query(
    `INSERT INTO visit_steps (visit_id, service_point_id, sequence, name_th, name_en,
                              est_minutes, wait_after_minutes, origin, added_by)
     VALUES ($1, $2, $3, $4, $5, $6, 0, 'added', $7)
     RETURNING id`,
    [
      visit.id,
      servicePointId,
      sequence,
      input.nameTh,
      input.nameEn ?? input.nameTh,
      input.estMinutes ?? 10,
      input.addedBy ?? null,
    ],
  );
  const stepId = rows[0].id;

  for (const requiredId of input.requires ?? []) {
    await client.query(
      'INSERT INTO visit_step_prereqs (step_id, requires_step_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [stepId, requiredId],
    );
  }

  // ตรวจว่าไม่เกิดวงจร แล้วเขียนลำดับที่จัดใหม่กลับลงฐานข้อมูล
  const all = [
    ...existing.map((step) => ({ ...step, sequence: Number(step.sequence) })),
    { id: stepId, sequence, requires: input.requires ?? [] },
  ];
  const ordered = topologicalOrder(all);
  for (const [index, step] of ordered.entries()) {
    await client.query('UPDATE visit_steps SET sequence = $1 WHERE id = $2', [index + 1, step.id]);
  }

  await recordAudit(client, {
    actorUserId: input.addedBy,
    actorKind: input.addedBy ? 'user' : 'system',
    entity: 'visit_step',
    entityId: stepId,
    action: 'insert',
    toStatus: 'pending',
    detail: { visit_id: visit.id, point: input.pointCode, name: input.nameTh },
  });

  return stepId;
}

export async function setPosition(client, visit, nodeCode, source, actorUserId = null) {
  const nodeId = await nodeIdByCode(client, nodeCode);
  await client.query(
    `UPDATE visits SET current_node_id = $1, position_source = $2, position_confirmed_at = now()
      WHERE id = $3`,
    [nodeId, source, visit.id],
  );
  await recordAudit(client, {
    actorUserId,
    actorKind: actorUserId ? 'user' : 'patient',
    entity: 'visit',
    entityId: visit.id,
    action: 'position',
    detail: { node: nodeCode, source },
  });
  return nodeId;
}

/**
 * เลือกขั้นถัดไปและเส้นทางไปหา — กติกาเดียวกับที่หน้าผู้ป่วยเห็น
 * ใช้ทั้งตอนแสดงผลและตอนที่ผู้ป่วยกด "ถึงแล้ว" เพื่อให้หมายถึงขั้นเดียวกันเสมอ
 */
export async function planFor(visit, steps) {
  const graph = await getGraph();
  const profile = { ...(visit.profile ?? {}), has_phone: visit.has_phone };
  const cost = costFor(profile);
  const fromId = visit.current_node_id;

  const walkSeconds = fromId ? shortestTimes(graph, fromId, cost) : new Map();
  const byPoint = new Map();
  for (const step of steps) {
    if (walkSeconds.has(step.service_point_id)) {
      byPoint.set(step.service_point_id, walkSeconds.get(step.service_point_id));
    }
  }

  const { next, ready, warnings } = planNextStep(steps, byPoint, minutesOfDay());

  let route = null;
  if (next && fromId) {
    const path = dijkstra(graph, fromId, cost, { toId: next.step.service_point_id });
    if (path) {
      route = {
        to: next.step.point_code,
        seconds: Math.round(path.seconds),
        distance_m: round1(path.edges.reduce((total, edge) => total + Number(edge.distance_m), 0)),
        legs: buildLegs(graph, path.edges),
        instructions: buildInstructions(graph, path.edges),
      };
    }
  }

  return { next: next?.step ?? null, ready, warnings, route };
}

/** สถานะทั้งหมดที่หน้าจอผู้ป่วยต้องใช้: ขั้นตอน ขั้นถัดไป เส้นทาง และคำเตือน */
export async function visitState(visit, steps) {
  const { next, ready, warnings, route } = await planFor(visit, steps);

  const { rows: notifications } = await query(
    `SELECT id, message_th, message_en, created_at, read_at
       FROM notifications WHERE visit_id = $1 ORDER BY created_at DESC LIMIT 10`,
    [visit.id],
  );

  return {
    visit: publicVisit(visit),
    steps: steps.map(publicStep),
    next_step_id: next?.id ?? null,
    ready_step_ids: ready.map((step) => step.id),
    route,
    warnings,
    notifications,
    server_time: now().toISOString(),
  };
}

export const publicVisit = (visit) => ({
  id: visit.id,
  ticket_no: visit.ticket_no,
  short_code: visit.short_code,
  token: visit.token,
  status: visit.status,
  lang: visit.lang,
  profile: visit.profile,
  has_phone: visit.has_phone,
  companion_present: visit.companion_present,
  patient_name: visit.patient_name,
  template: {
    code: visit.template_code,
    name_th: visit.template_th,
    name_en: visit.template_en,
  },
  at: visit.at_code
    ? {
        code: visit.at_code,
        name_th: visit.at_th,
        name_en: visit.at_en,
        icon: visit.at_icon,
        building: visit.at_building,
        floor: visit.at_floor,
        source: visit.position_source,
        confirmed_at: visit.position_confirmed_at,
      }
    : null,
  checked_in_at: visit.checked_in_at,
  completed_at: visit.completed_at,
});

export const publicStep = (step) => ({
  id: step.id,
  sequence: Number(step.sequence),
  name_th: step.name_th,
  name_en: step.name_en,
  status: step.status,
  point: {
    code: step.point_code,
    name_th: step.point_th,
    name_en: step.point_en,
    icon: step.point_icon,
    building: step.building,
    floor: step.floor,
    department: step.dept_code,
  },
  deadline_time: step.deadline_time ? String(step.deadline_time).slice(0, 5) : null,
  deadline_reason_th: step.deadline_reason_th,
  est_minutes: step.est_minutes,
  wait_after_minutes: step.wait_after_minutes,
  origin: step.origin,
  requires: step.requires,
  arrived_at: step.arrived_at,
  called_at: step.called_at,
  finished_at: step.finished_at,
});

export async function nodeIdByCode(executor, code) {
  const { rows } = await executor.query('SELECT id FROM nodes WHERE code = $1 AND is_active', [code]);
  if (rows.length === 0) throw notFound(`ไม่พบจุด ${code} ในผัง`, `No such node: ${code}`);
  return rows[0].id;
}

/** เลขคิวของวันนี้ — เรียงต่อจากใบล่าสุด */
async function nextTicketNo(client) {
  const { rows } = await client.query(
    "SELECT COUNT(*)::int AS taken FROM visits WHERE visit_date = CURRENT_DATE",
  );
  const number = rows[0].taken + 1;
  if (number > 999) throw conflict('เลขคิวของวันนี้เต็มแล้ว', 'No ticket numbers left today');
  return `A-${String(number).padStart(3, '0')}`;
}

const round1 = (value) => Math.round(value * 10) / 10;
