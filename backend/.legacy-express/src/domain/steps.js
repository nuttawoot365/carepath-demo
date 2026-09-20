/**
 * เปลี่ยนสถานะของขั้นตอน — กฎลำดับสถานะบังคับที่นี่ที่เดียว ทั้งจอจุดบริการและหน้าผู้ป่วย
 */
import { ALLOWED_TRANSITIONS } from './pathway.js';
import { recordAudit, notifyVisit } from '../lib/audit.js';
import { conflict, notFound } from '../lib/errors.js';

export async function changeStatus(client, { stepId, target, actorUserId = null, actorKind = 'user', reason = null }) {
  const { rows } = await client.query(
    `SELECT vs.id, vs.visit_id, vs.status, vs.name_th, vs.name_en, vs.service_point_id,
            n.code AS point_code, n.department_id, v.status AS visit_status
       FROM visit_steps vs
       JOIN nodes n ON n.id = vs.service_point_id
       JOIN visits v ON v.id = vs.visit_id
      WHERE vs.id = $1
      FOR UPDATE OF vs`,
    [stepId],
  );
  if (rows.length === 0) throw notFound('ไม่พบขั้นตอนนี้', 'No such step');
  const step = rows[0];

  if (!ALLOWED_TRANSITIONS[step.status].includes(target)) {
    throw conflict(
      `ขั้นนี้อยู่สถานะ "${step.status}" เปลี่ยนเป็น "${target}" ไม่ได้ — กรุณาดูคิวอีกครั้ง`,
      `Cannot change a step from "${step.status}" to "${target}"`,
    );
  }

  // คำสั่งของแต่ละสถานะเขียนไว้เต็มรูป ไม่ต่อสตริง SQL — ชื่อคอลัมน์เวลาจึงมาจากตารางที่ประกาศไว้
  const UPDATE_SQL = {
    arrived: 'UPDATE visit_steps SET status = $1, arrived_at = now() WHERE id = $2',
    in_progress: 'UPDATE visit_steps SET status = $1, called_at = now() WHERE id = $2',
    done: 'UPDATE visit_steps SET status = $1, finished_at = now() WHERE id = $2',
    skipped: 'UPDATE visit_steps SET status = $1, skip_reason = $3 WHERE id = $2',
  };
  await client.query(
    UPDATE_SQL[target],
    target === 'skipped' ? [target, stepId, reason] : [target, stepId],
  );

  // เจ้าหน้าที่กด "เสร็จ" = ยืนยันว่าผู้ป่วยอยู่ที่จุดนี้จริง ตำแหน่งจึงเชื่อถือได้
  if (target === 'done' || target === 'arrived') {
    await client.query(
      `UPDATE visits
          SET current_node_id = $1, position_source = 'station', position_confirmed_at = now()
        WHERE id = $2`,
      [step.service_point_id, step.visit_id],
    );
  }

  await recordAudit(client, {
    actorUserId,
    actorKind,
    entity: 'visit_step',
    entityId: step.id,
    action: 'status',
    fromStatus: step.status,
    toStatus: target,
    detail: { visit_id: step.visit_id, point: step.point_code, reason },
  });

  if (target === 'done') {
    await notifyVisit(
      client,
      step.visit_id,
      `${step.name_th}เรียบร้อย — ดูขั้นถัดไปได้เลย`,
      `${step.name_en} is done — your next step is ready`,
    );
    await completeIfFinished(client, step.visit_id);
  }
  if (target === 'in_progress') {
    await notifyVisit(
      client,
      step.visit_id,
      `ถึงคิวของคุณที่${step.name_th}`,
      `It is your turn: ${step.name_en}`,
    );
  }

  return { ...step, status: target };
}

/** ไม่เหลือขั้นที่ยังไม่เสร็จ = ปิด visit ให้อัตโนมัติ */
async function completeIfFinished(client, visitId) {
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS open
       FROM visit_steps WHERE visit_id = $1 AND status NOT IN ('done','skipped')`,
    [visitId],
  );
  if (rows[0].open > 0) return false;

  await client.query(
    `UPDATE visits SET status = 'completed', completed_at = now()
      WHERE id = $1 AND status = 'active'`,
    [visitId],
  );
  await recordAudit(client, {
    actorKind: 'system',
    entity: 'visit',
    entityId: visitId,
    action: 'complete',
    toStatus: 'completed',
  });
  return true;
}
