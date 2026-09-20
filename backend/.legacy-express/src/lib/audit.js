/**
 * บันทึก audit แบบ append-only · created_at ใช้ now() ของเซิร์ฟเวอร์เท่านั้น
 * รับ client ของทรานแซกชันได้ เพื่อให้ audit กับข้อมูลลงพร้อมกันหรือไม่ลงเลย
 */
export const recordAudit = (executor, entry) =>
  executor.query(
    `INSERT INTO audit_logs
       (actor_user_id, actor_kind, entity, entity_id, action, from_status, to_status, detail)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      entry.actorUserId ?? null,
      entry.actorKind,
      entry.entity,
      entry.entityId,
      entry.action,
      entry.fromStatus ?? null,
      entry.toStatus ?? null,
      entry.detail ?? null,
    ],
  );

export const notifyVisit = (executor, visitId, messageTh, messageEn) =>
  executor.query(
    'INSERT INTO notifications (visit_id, message_th, message_en) VALUES ($1, $2, $3)',
    [visitId, messageTh, messageEn],
  );
