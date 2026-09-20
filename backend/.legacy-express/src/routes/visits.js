import { Router } from 'express';
import { withTransaction } from '../db.js';
import { requireRole } from '../lib/auth.js';
import { query } from '../db.js';
import { requireFields, sanitizeProfile, requireOneOf } from '../lib/validate.js';
import { recordAudit } from '../lib/audit.js';
import { createVisit, findVisitBy, loadSteps, visitState } from '../domain/visit.js';
import { LANGS } from '../lib/i18n.js';

const router = Router();

const PATIENT_LANGS = [...new Set([...LANGS, 'zh', 'my', 'ru'])];

/** เปิด visit ใหม่ — ทั้ง visit, ขั้นตอน, เงื่อนไขลำดับ และ audit อยู่ในทรานแซกชันเดียว */
router.post('/visits', requireRole('registrar', 'admin'), async (req, res, next) => {
  try {
    const body = requireFields(req.body, ['hn', 'template']);

    const created = await withTransaction(async (client) => {
      const visit = await createVisit(client, {
        hn: String(body.hn).trim(),
        templateCode: String(body.template).trim(),
        profile: sanitizeProfile(body.profile),
        lang: requireOneOf(String(body.lang ?? 'th'), PATIENT_LANGS, 'lang'),
        hasPhone: body.has_phone !== false,
        companionPresent: body.companion_present === true,
        startNodeCode: body.start_node ?? 'A1-REG',
        privacyNoticeGiven: body.privacy_notice_given === true,
        actorUserId: req.user.id,
      });

      if (body.privacy_notice_given === true) {
        await recordAudit(client, {
          actorUserId: req.user.id,
          actorKind: 'user',
          entity: 'visit',
          entityId: visit.id,
          action: 'privacy_notice',
          detail: { given: true },
        });
      }
      return visit;
    });

    const visit = await findVisitBy('id', created.id);
    const state = await visitState(visit, await loadSteps(visit.id));
    res.status(201).json(state);
  } catch (error) {
    next(error);
  }
});

/** คิวของวันนี้ทั้งหมด — เวชระเบียน ประชาสัมพันธ์ และผู้ดูแลระบบ */
router.get('/visits', requireRole('registrar', 'admin', 'station', 'executive'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT v.id, v.ticket_no, v.short_code, v.status, v.lang, v.profile, v.checked_in_at,
              p.display_name AS patient_name, t.code AS template_code, t.name_th AS template_th,
              n.code AS at_code, n.name_th AS at_th,
              COUNT(vs.id) FILTER (WHERE vs.status IN ('done','skipped')) AS steps_done,
              COUNT(vs.id) AS steps_total
         FROM visits v
         JOIN patients p ON p.id = v.patient_id
         JOIN pathway_templates t ON t.id = v.template_id
         LEFT JOIN nodes n ON n.id = v.current_node_id
         LEFT JOIN visit_steps vs ON vs.visit_id = v.id
        WHERE v.visit_date = CURRENT_DATE
          AND ($1::text IS NULL OR v.status = $1)
        GROUP BY v.id, p.display_name, t.code, t.name_th, n.code, n.name_th
        ORDER BY v.checked_in_at DESC
        LIMIT 100`,
      [req.query.status ? String(req.query.status) : null],
    );
    res.json({ visits: rows });
  } catch (error) {
    next(error);
  }
});

/** เจ้าหน้าที่เปิดดู visit — การเข้าถึงข้อมูลผู้ป่วยโดยเจ้าหน้าที่ถูกบันทึกไว้เสมอ */
router.get('/visits/:id', requireRole('registrar', 'admin', 'station'), async (req, res, next) => {
  try {
    const visit = await findVisitBy('id', Number(req.params.id));
    await recordAudit({ query }, {
      actorUserId: req.user.id,
      actorKind: 'user',
      entity: 'visit',
      entityId: visit.id,
      action: 'view',
      detail: { by: req.user.username },
    });
    res.json(await visitState(visit, await loadSteps(visit.id)));
  } catch (error) {
    next(error);
  }
});

export default router;
