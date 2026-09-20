import { Body, Controller, Get, HttpCode, Inject, Param, Post } from '@nestjs/common';
import { DbService } from '../../db/db.service';
import { AppConfig, CONFIG } from '../../config/config';
import { badRequest, gone, notFound } from '../../common/errors';
import { recordAudit } from '../../common/audit';
import { changeStatus } from '../../domain/steps';
import { GraphService } from '../../domain/graph.service';
import { VisitService } from '../../domain/visit.service';
import type { StepRow, StepStatus, VisitRow } from '../../domain/types';

/** ลำดับที่ปุ่มเดโม "เสร็จ" ต้องเดินผ่าน เพื่อให้ผ่านกฎ ALLOWED_TRANSITIONS เหมือนของจริง */
const DEMO_FINISH_PATH: Partial<Record<StepStatus, StepStatus[]>> = {
  pending: ['arrived', 'in_progress', 'done'],
  arrived: ['in_progress', 'done'],
  in_progress: ['done'],
};

@Controller('api/p')
export class PatientController {
  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    private readonly db: DbService,
    private readonly graphs: GraphService,
    private readonly visits: VisitService,
  ) {}

  /** พิมพ์รหัสใต้ QR แทนการสแกน — คืน token ให้หน้าผู้ป่วยใช้ต่อ */
  @Get('code/:code')
  async byCode(@Param('code') raw: string) {
    const code = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 7) {
      throw badRequest('รหัสบนบัตรคิวมี 7 ตัว เช่น A017-3K9', 'The ticket code has 7 characters');
    }

    const visit = await this.visits.findBy('short_code', `${code.slice(0, 4)}-${code.slice(4)}`);
    return { token: visit.token, ticket_no: visit.ticket_no };
  }

  @Get(':token')
  async state(@Param('token') token: string) {
    const visit = await this.openVisit(token);
    return this.visits.state(visit, await this.visits.loadSteps(visit.id));
  }

  /** ผู้ป่วยบอกเองว่าอยู่ตรงไหน — ด้วยการเลือกจากรูป หรือสแกน QR ที่ผนัง */
  @Post(':token/position')
  @HttpCode(200)   // Express เดิมตอบ 200 — คง contract ไว้
  async position(@Param('token') token: string, @Body() body: { node?: string; qr?: string }) {
    const visit = await this.openVisit(token);
    const { node, qr } = body ?? {};

    const code = qr ? await this.codeForQr(String(qr)) : String(node ?? '').trim();
    if (!code) throw badRequest('ต้องระบุจุดที่อยู่', 'A position is required');

    await this.db.withTransaction((client) =>
      this.visits.setPosition(client, visit, code, qr ? 'qr' : 'manual'),
    );

    return this.visits.stateOf(visit.id);
  }

  /** ผู้ป่วยกด "ถึงแล้ว" — เท่ากับบอกจุดบริการว่ามารออยู่หน้าห้อง */
  @Post(':token/arrive')
  @HttpCode(200)   // Express เดิมตอบ 200 — คง contract ไว้
  async arrive(@Param('token') token: string, @Body() body: { step_id?: number }) {
    const visit = await this.openVisit(token);
    const steps = await this.visits.loadSteps(visit.id);
    const planned = await this.visits.planFor(visit, steps);
    const stepId = Number(body?.step_id ?? 0) || planned.next?.id;
    if (!stepId) throw notFound('ไม่มีขั้นที่รออยู่', 'No step is waiting');

    await this.db.withTransaction((client) =>
      changeStatus(client, { stepId, target: 'arrived', actorKind: 'patient' }),
    );

    return this.visits.stateOf(visit.id);
  }

  @Post(':token/notifications/read')
  @HttpCode(200)   // Express เดิมตอบ 200 — คง contract ไว้
  async markRead(@Param('token') token: string) {
    const visit = await this.openVisit(token);
    await this.db.query(
      'UPDATE notifications SET read_at = now() WHERE visit_id = $1 AND read_at IS NULL',
      [visit.id],
    );
    return { ok: true };
  }

  /**
   * ปุ่มสาธิตบนหน้าผู้ป่วย — แทนเหตุการณ์ที่ปกติมาจากเจ้าหน้าที่
   * เปิดเฉพาะโหมดเดโม (NODE_ENV=demo) เท่านั้น
   */
  @Post(':token/demo/:action')
  @HttpCode(200)   // Express เดิมตอบ 200 — คง contract ไว้
  async demo(
    @Param('token') token: string,
    @Param('action') action: string,
    @Body() body: { closed?: boolean },
  ) {
    if (!this.config.isDemo) throw notFound();
    const visit = await this.openVisit(token);
    const steps = await this.visits.loadSteps(visit.id);

    if (action === 'finish') await this.demoFinish(visit, steps);
    else if (action === 'xray') await this.demoXray(visit, steps);
    else if (action === 'lift') await this.demoLift(visit, body?.closed !== false);
    else throw notFound('ไม่มีปุ่มสาธิตนี้', 'No such demo action');

    return this.visits.stateOf(visit.id);
  }

  private async demoFinish(visit: VisitRow, steps: StepRow[]) {
    const step = (await this.visits.planFor(visit, steps)).next;
    if (!step) throw notFound('ไม่มีขั้นที่ทำต่อได้', 'No step is ready');

    await this.db.withTransaction(async (client) => {
      for (const target of DEMO_FINISH_PATH[step.status] ?? []) {
        await changeStatus(client, { stepId: step.id, target, actorKind: 'system' });
      }
    });
  }

  private async demoXray(visit: VisitRow, steps: StepRow[]) {
    const payment = steps.find((item) => item.point_code === 'A1-PAY');
    if (steps.some((item) => item.point_code === 'B1-XR')) {
      throw badRequest('มีขั้นเอกซเรย์อยู่แล้ว', 'The X-ray step already exists');
    }
    const doctor = steps.find((item) => item.point_code.startsWith('C4-MED'));

    await this.db.withTransaction(async (client) => {
      await this.visits.insertStep(client, visit, {
        pointCode: 'B1-XR',
        nameTh: 'เอกซเรย์ปอด',
        nameEn: 'Chest X-ray',
        estMinutes: 15,
        beforeSequence: payment ? Number(payment.sequence) : null,
        requires: doctor ? [doctor.id] : [],
      });
      await client.query(
        'INSERT INTO notifications (visit_id, message_th, message_en) VALUES ($1, $2, $3)',
        [
          visit.id,
          'แพทย์สั่งเอกซเรย์เพิ่ม — แทรกก่อนชำระเงินแล้ว',
          'The doctor added a chest X-ray before payment',
        ],
      );
    });
  }

  /** ปิด/เปิดลิฟต์ B ทั้งสองทิศ แล้วล้างแคชกราฟ — เหมือนที่ผู้ดูแลระบบกดจากหน้าผลกระทบ */
  private async demoLift(visit: VisitRow, closed: boolean) {
    await this.db.withTransaction(async (client) => {
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
        [
          visit.id,
          closed ? 'ลิฟต์ B ปิดซ่อม — ระบบคำนวณเส้นทางใหม่ให้แล้ว' : 'ลิฟต์ B กลับมาใช้ได้แล้ว',
          closed ? 'Lift B is closed — a new route is ready' : 'Lift B is back in service',
        ],
      );
    });
    this.graphs.invalidate();
  }

  /** บัตรคิวหมดอายุสิ้นวัน — เลยแล้วลิงก์เดิมเปิดไม่ได้อีก */
  private async openVisit(token: string): Promise<VisitRow> {
    const visit = await this.visits.findBy('token', String(token).trim());
    if (new Date(visit.expires_at) < new Date()) {
      throw gone('บัตรคิวใบนี้หมดอายุแล้ว', 'This ticket has expired');
    }
    return visit;
  }

  private async codeForQr(token: string): Promise<string> {
    const { rows } = await this.db.query('SELECT code FROM nodes WHERE qr_token = $1 AND is_active', [
      token,
    ]);
    if (rows.length === 0) throw notFound('คิวอาร์นี้ไม่ตรงกับจุดใดในผัง', 'No node for this QR code');
    return rows[0].code;
  }
}
