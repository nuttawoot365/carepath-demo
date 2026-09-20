import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { config } from '../config.js';
import { badRequest, gone, notFound } from '../lib/errors.js';
import { findVisitBy, insertStep, loadSteps, planFor, setPosition, visitState } from '../domain/visit.js';
import { changeStatus } from '../domain/steps.js';
import { invalidateGraph } from '../domain/graph.js';
import { recordAudit } from '../lib/audit.js';

const router = Router();

/** บัตรคิวหมดอายุสิ้นวัน — เลยแล้วลิงก์เดิมเปิดไม่ได้อีก */
async function openVisit(token) {
  const visit = await findVisitBy('token', String(token).trim());
  if (new Date(visit.expires_at) < new Date()) {
    throw gone('บัตรคิวใบนี้หมดอายุแล้ว', 'This ticket has expired');
  }
  return visit;
}

/** พิมพ์รหัสใต้ QR แทนการสแกน — คืน token ให้หน้าผู้ป่วยใช้ต่อ */
router.get('/p/code/:code', async (req, res, next) => {
  try {
    const code = String(req.params.code).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 7) throw badRequest('รหัสบนบัตรคิวมี 7 ตัว เช่น A017-3K9', 'The ticket code has 7 characters');

    const visit = await findVisitBy('short_code', `${code.slice(0, 4)}-${code.slice(4)}`);
    res.json({ token: visit.token, ticket_no: visit.ticket_no });
  } catch (error) {
    next(error);
  }
});

router.get('/p/:token', async (req, res, next) => {
  try {
    const visit = await openVisit(req.params.token);
    res.json(await visitState(visit, await loadSteps(visit.id)));
  } catch (error) {
    next(error);
  }
});

/** ผู้ป่วยบอกเองว่าอยู่ตรงไหน — ด้วยการเลือกจากรูป หรือสแกน QR ที่ผนัง */
router.post('/p/:token/position', async (req, res, next) => {
  try {
    const visit = await openVisit(req.params.token);
    const { node, qr } = req.body ?? {};

    const code = qr ? await codeForQr(String(qr)) : String(node ?? '').trim();
    if (!code) throw badRequest('ต้องระบุจุดที่อยู่', 'A position is required');

    await withTransaction((client) => setPosition(client, visit, code, qr ? 'qr' : 'manual'));

    const fresh = await findVisitBy('id', visit.id);
    res.json(await visitState(fresh, await loadSteps(visit.id)));
  } catch (error) {
    next(error);
  }
});

/** ผู้ป่วยกด "ถึงแล้ว" — เท่ากับบอกจุดบริการว่ามารออยู่หน้าห้อง */
router.post('/p/:token/arrive', async (req, res, next) => {
  try {
    const visit = await openVisit(req.params.token);
    const steps = await loadSteps(visit.id);
    const planned = await planFor(visit, steps);
    const stepId = Number(req.body?.step_id ?? 0) || planned.next?.id;
    if (!stepId) throw notFound('ไม่มีขั้นที่รออยู่', 'No step is waiting');

    await withTransaction((client) =>
      changeStatus(client, { stepId, target: 'arrived', actorKind: 'patient' }),
    );

    const fresh = await findVisitBy('id', visit.id);
    res.json(await visitState(fresh, await loadSteps(visit.id)));
  } catch (error) {
    next(error);
  }
});

router.post('/p/:token/notifications/read', async (req, res, next) => {
  try {
    const visit = await openVisit(req.params.token);
    await query('UPDATE notifications SET read_at = now() WHERE visit_id = $1 AND read_at IS NULL', [
      visit.id,
    ]);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

/**
 * ปุ่มสาธิตบนหน้าผู้ป่วย — แทนเหตุการณ์ที่ปกติมาจากเจ้าหน้าที่
 * เปิดเฉพาะโหมดเดโม (NODE_ENV=demo) เท่านั้น
 */
router.post('/p/:token/demo/:action', async (req, res, next) => {
  try {
    if (!config.isDemo) throw notFound();
    const visit = await openVisit(req.params.token);
    const steps = await loadSteps(visit.id);
    const action = req.params.action;

    if (action === 'finish') {
      const step = (await planFor(visit, steps)).next;
      if (!step) throw notFound('ไม่มีขั้นที่ทำต่อได้', 'No step is ready');

      await withTransaction(async (client) => {
        const path = { pending: ['arrived', 'in_progress', 'done'], arrived: ['in_progress', 'done'],
                       in_progress: ['done'] }[step.status] ?? [];
        for (const target of path) {
          await changeStatus(client, { stepId: step.id, target, actorKind: 'system' });
        }
      });
    } else if (action === 'xray') {
      const payment = steps.find((item) => item.point_code === 'A1-PAY');
      if (steps.some((item) => item.point_code === 'B1-XR')) {
        throw badRequest('มีขั้นเอกซเรย์อยู่แล้ว', 'The X-ray step already exists');
      }
      const doctor = steps.find((item) => item.point_code.startsWith('C4-MED'));

      await withTransaction(async (client) => {
        const stepId = await insertStep(client, visit, {
          pointCode: 'B1-XR',
          nameTh: 'เอกซเรย์ปอด',
          nameEn: 'Chest X-ray',
          estMinutes: 15,
          beforeSequence: payment ? Number(payment.sequence) : null,
          requires: doctor ? [doctor.id] : [],
        });
        await client.query(
          'INSERT INTO notifications (visit_id, message_th, message_en) VALUES ($1, $2, $3)',
          [visit.id, 'แพทย์สั่งเอกซเรย์เพิ่ม — แทรกก่อนชำระเงินแล้ว', 'The doctor added a chest X-ray before payment'],
        );
        return stepId;
      });
    } else if (action === 'lift') {
      // ปิด/เปิดลิฟต์ B ทั้งสองทิศ แล้วล้างแคชกราฟ — เหมือนที่ผู้ดูแลระบบกดจากหน้าผลกระทบ
      const closed = req.body?.closed !== false;
      await withTransaction(async (client) => {
        await client.query(
          `UPDATE edges e SET status = $1, closed_reason = $2
             FROM nodes fn, nodes tn
            WHERE fn.id = e.from_node_id AND tn.id = e.to_node_id
              AND e.kind = 'elevator' AND fn.code LIKE 'B%-LIFT' AND tn.code LIKE 'B%-LIFT'`,
          [closed ? 'closed' : 'open', closed ? 'ลิฟต์ B ปิดซ่อม' : null],
        );
        await recordAudit(client, {
          actorKind: 'system',
          entity: 'edge',
          entityId: 0,
          action: 'demo_lift',
          toStatus: closed ? 'closed' : 'open',
          detail: { visit_id: visit.id },
        });
        await client.query(
          'INSERT INTO notifications (visit_id, message_th, message_en) VALUES ($1, $2, $3)',
          [visit.id,
           closed ? 'ลิฟต์ B ปิดซ่อม — ระบบคำนวณเส้นทางใหม่ให้แล้ว' : 'ลิฟต์ B กลับมาใช้ได้แล้ว',
           closed ? 'Lift B is closed — a new route is ready' : 'Lift B is back in service'],
        );
      });
      invalidateGraph();
    } else {
      throw notFound('ไม่มีปุ่มสาธิตนี้', 'No such demo action');
    }

    const fresh = await findVisitBy('id', visit.id);
    res.json(await visitState(fresh, await loadSteps(visit.id)));
  } catch (error) {
    next(error);
  }
});

async function codeForQr(token) {
  const { rows } = await query('SELECT code FROM nodes WHERE qr_token = $1 AND is_active', [token]);
  if (rows.length === 0) throw notFound('คิวอาร์นี้ไม่ตรงกับจุดใดในผัง', 'No node for this QR code');
  return rows[0].code;
}

export default router;
