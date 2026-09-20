import type { Executor } from '../db/db.service';

export interface AuditEntry {
  actorUserId?: number | null;
  actorKind: 'user' | 'patient' | 'system';
  entity: string;
  entityId: number;
  action: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  detail?: unknown;
}

/**
 * บันทึก audit แบบ append-only · created_at ใช้ now() ของเซิร์ฟเวอร์เท่านั้น
 * รับ client ของทรานแซกชันได้ เพื่อให้ audit กับข้อมูลลงพร้อมกันหรือไม่ลงเลย
 */
export const recordAudit = (executor: Executor, entry: AuditEntry) =>
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

export const notifyVisit = (executor: Executor, visitId: number, messageTh: string, messageEn: string) =>
  executor.query(
    'INSERT INTO notifications (visit_id, message_th, message_en) VALUES ($1, $2, $3)',
    [visitId, messageTh, messageEn],
  );
