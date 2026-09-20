import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { DbService } from '../../db/db.service';
import { recordAudit } from '../../common/audit';
import { requireFields, requireOneOf, sanitizeProfile } from '../../common/validate';
import { LANGS } from '../../i18n/i18n';
import { VisitService } from '../../domain/visit.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser, Roles } from '../auth/roles.decorator';
import type { AuthUser } from '../auth/user.types';

const PATIENT_LANGS = [...new Set([...LANGS, 'zh', 'my', 'ru'])];

interface CreateVisitBody {
  hn?: string;
  template?: string;
  profile?: Record<string, unknown>;
  lang?: string;
  has_phone?: boolean;
  companion_present?: boolean;
  start_node?: string;
  privacy_notice_given?: boolean;
}

@Controller('api/visits')
@UseGuards(AuthGuard)
export class VisitsController {
  constructor(
    private readonly db: DbService,
    private readonly visits: VisitService,
  ) {}

  /** เปิด visit ใหม่ — ทั้ง visit, ขั้นตอน, เงื่อนไขลำดับ และ audit อยู่ในทรานแซกชันเดียว */
  @Post()
  @HttpCode(201)
  @Roles('registrar', 'admin')
  async create(@Body() body: CreateVisitBody, @CurrentUser() user: AuthUser) {
    const input = requireFields(body, ['hn', 'template']);

    const created = await this.db.withTransaction(async (client) => {
      const visit = await this.visits.create(client, {
        hn: String(input.hn).trim(),
        templateCode: String(input.template).trim(),
        profile: sanitizeProfile(input.profile),
        lang: requireOneOf<string>(String(input.lang ?? 'th'), PATIENT_LANGS, 'lang'),
        hasPhone: input.has_phone !== false,
        companionPresent: input.companion_present === true,
        startNodeCode: input.start_node ?? 'A1-REG',
        privacyNoticeGiven: input.privacy_notice_given === true,
        actorUserId: user.id,
      });

      if (input.privacy_notice_given === true) {
        await recordAudit(client, {
          actorUserId: user.id,
          actorKind: 'user',
          entity: 'visit',
          entityId: visit.id,
          action: 'privacy_notice',
          detail: { given: true },
        });
      }
      return visit;
    });

    return this.visits.stateOf(created.id);
  }

  /** คิวของวันนี้ทั้งหมด — เวชระเบียน ประชาสัมพันธ์ และผู้ดูแลระบบ */
  @Get()
  @Roles('registrar', 'admin', 'station', 'executive')
  async list(@Query('status') status?: string) {
    const { rows } = await this.db.query(
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
      [status ? String(status) : null],
    );
    return { visits: rows };
  }

  /** เจ้าหน้าที่เปิดดู visit — การเข้าถึงข้อมูลผู้ป่วยโดยเจ้าหน้าที่ถูกบันทึกไว้เสมอ */
  @Get(':id')
  @Roles('registrar', 'admin', 'station')
  async one(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const visit = await this.visits.findBy('id', Number(id));
    await recordAudit(this.db, {
      actorUserId: user.id,
      actorKind: 'user',
      entity: 'visit',
      entityId: visit.id,
      action: 'view',
      detail: { by: user.username },
    });
    return this.visits.state(visit, await this.visits.loadSteps(visit.id));
  }
}
