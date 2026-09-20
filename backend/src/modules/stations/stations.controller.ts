import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { DbService } from '../../db/db.service';
import { forbidden, notFound } from '../../common/errors';
import { requireFields, requireOneOf } from '../../common/validate';
import { changeStatus } from '../../domain/steps';
import { costFor, shortestTimes } from '../../domain/graph';
import { GraphService } from '../../domain/graph.service';
import { VisitService } from '../../domain/visit.service';
import type { Graph, StepStatus } from '../../domain/types';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser, Roles } from '../auth/roles.decorator';
import type { AuthUser } from '../auth/user.types';

const STATUSES = ['arrived', 'in_progress', 'done', 'skipped'] as const satisfies readonly StepStatus[];

@Controller('api')
@UseGuards(AuthGuard)
export class StationsController {
  constructor(
    private readonly db: DbService,
    private readonly graphs: GraphService,
    private readonly visits: VisitService,
  ) {}

  /** แผนกและจุดบริการของแต่ละแผนก — แถบสลับแผนกบนจอจุดบริการใช้รายการนี้ */
  @Get('stations')
  @Roles('station', 'admin', 'registrar', 'executive')
  async stations() {
    const { rows } = await this.db.query(
      `SELECT d.code, d.name_th, d.name_en, d.color,
              ARRAY_AGG(n.code ORDER BY n.code) FILTER (WHERE n.id IS NOT NULL) AS points,
              (SELECT STRING_AGG(u.display_name, ', ')
                 FROM users u WHERE u.department_id = d.id AND u.is_active) AS staff
         FROM departments d
         LEFT JOIN nodes n ON n.department_id = d.id AND n.is_active
        GROUP BY d.id
        ORDER BY d.code`,
    );
    return { stations: rows.map((row) => ({ ...row, points: row.points ?? [] })) };
  }

  /** คิวของแผนกหนึ่ง = ขั้นที่ยังไม่เสร็จและอยู่ที่จุดบริการของแผนกนั้น */
  @Get('stations/:code/queue')
  @Roles('station', 'admin')
  async queue(@Param('code') code: string, @CurrentUser() user: AuthUser) {
    if (user.role === 'station' && user.department_code !== code) throw forbidden();

    const { rows } = await this.db.query(
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

    const graph = await this.graphs.getGraph();
    const queue = rows.map((row) => {
      const ready = row.prereqs_met !== false;
      const seconds =
        ready && row.current_node_id
          ? shortestTimes(
              graph,
              row.current_node_id,
              costFor({ ...row.profile, has_phone: row.has_phone }),
            ).get(pointIdOf(graph, row.point_code)) ?? null
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

    return { station: code, queue };
  }

  /** เจ้าหน้าที่กดปุ่มเดียว — ลำดับสถานะบังคับที่ API ไม่ใช่ที่หน้าจอ */
  @Post('steps/:id/status')
  @HttpCode(200)   // Express เดิมตอบ 200 — คง contract ไว้
  @Roles('station', 'admin', 'registrar')
  async setStatus(
    @Param('id') id: string,
    @Body() body: { status?: string; reason?: string },
    @CurrentUser() user: AuthUser,
  ) {
    const input = requireFields(body, ['status']);
    const target = requireOneOf(String(input.status), STATUSES, 'status');

    const step = await this.db.withTransaction((client) =>
      changeStatus(client, {
        stepId: Number(id),
        target,
        actorUserId: user.id,
        actorKind: 'user',
        reason: input.reason ? String(input.reason).slice(0, 120) : null,
      }),
    );

    return this.visits.stateOf(step.visit_id);
  }

  /** ส่งตรวจเพิ่มระหว่างวัน — ขั้นใหม่ถูกจัดลำดับใหม่ทั้งแผนและแจ้งผู้ป่วยทันที */
  @Post('visits/:id/steps')
  @HttpCode(201)
  @Roles('station', 'admin')
  async addStep(
    @Param('id') id: string,
    @Body() body: {
      point?: string; name_th?: string; name_en?: string;
      est_minutes?: number; before_point?: string; requires?: number[];
    },
    @CurrentUser() user: AuthUser,
  ) {
    const input = requireFields(body, ['point', 'name_th']);
    const visit = await this.visits.findBy('id', Number(id));
    const steps = await this.visits.loadSteps(visit.id);
    const before = steps.find((step) => step.point_code === (input.before_point ?? 'A1-PAY'));

    await this.db.withTransaction(async (client) => {
      await this.visits.insertStep(client, visit, {
        pointCode: String(input.point),
        nameTh: String(input.name_th),
        nameEn: String(input.name_en ?? input.name_th),
        estMinutes: Number(input.est_minutes ?? 10),
        beforeSequence: before ? Number(before.sequence) : null,
        requires: Array.isArray(input.requires) ? input.requires.map(Number) : [],
        addedBy: user.id,
      });
      await client.query(
        'INSERT INTO notifications (visit_id, message_th, message_en) VALUES ($1, $2, $3)',
        [visit.id, `มีขั้นตอนเพิ่ม: ${input.name_th}`, `A step was added: ${input.name_en ?? input.name_th}`],
      );
    });

    return this.visits.stateOf(visit.id);
  }
}

function pointIdOf(graph: Graph, code: string): number {
  const node = graph.byCode.get(code);
  if (!node) throw notFound(`ไม่พบจุด ${code}`, `No such node: ${code}`);
  return node.id;
}
