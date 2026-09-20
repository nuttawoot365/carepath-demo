import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { DbService } from '../../db/db.service';
import { badRequest } from '../../common/errors';
import { requireFields } from '../../common/validate';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';

interface TemplateStep {
  sequence: number;
  name_th: string;
  name_en: string;
  point: string;
  point_th: string;
  point_icon: string | null;
  building: string;
  floor: number;
  deadline_time: string | null;
  deadline_reason_th: string | null;
  est_minutes: number;
  wait_after_minutes: number;
  requires: number[];
}

@Controller('api')
export class CatalogController {
  constructor(private readonly db: DbService) {}

  /** แม่แบบขั้นตอนพร้อมขั้นทั้งหมด — หน้าเวชระเบียนใช้เลือกว่าผู้ป่วยมาด้วยเรื่องอะไร */
  @Get('templates')
  async templates() {
    const { rows } = await this.db.query(
      `SELECT t.code, t.category, t.name_th, t.name_en,
              ts.sequence, ts.name_th AS step_th, ts.name_en AS step_en,
              ts.deadline_time, ts.deadline_reason_th, ts.est_minutes, ts.wait_after_minutes,
              n.code AS point, n.name_th AS point_th, n.icon AS point_icon,
              f.level AS floor, b.code AS building,
              COALESCE(ARRAY_AGG(req.sequence) FILTER (WHERE req.sequence IS NOT NULL), '{}') AS requires
         FROM pathway_templates t
         JOIN template_steps ts ON ts.template_id = t.id
         JOIN nodes n ON n.id = ts.service_point_id
         JOIN floors f ON f.id = n.floor_id
         JOIN buildings b ON b.id = f.building_id
         LEFT JOIN template_step_prereqs pr ON pr.step_id = ts.id
         LEFT JOIN template_steps req ON req.id = pr.requires_step_id
        WHERE t.is_active
        GROUP BY t.id, ts.id, n.id, f.level, b.code
        ORDER BY t.code, ts.sequence`,
    );

    const templates = new Map<string, {
      code: string; category: string; name_th: string; name_en: string; steps: TemplateStep[];
    }>();
    for (const row of rows) {
      if (!templates.has(row.code)) {
        templates.set(row.code, {
          code: row.code,
          category: row.category,
          name_th: row.name_th,
          name_en: row.name_en,
          steps: [],
        });
      }
      templates.get(row.code)!.steps.push({
        sequence: Number(row.sequence),
        name_th: row.step_th,
        name_en: row.step_en,
        point: row.point,
        point_th: row.point_th,
        point_icon: row.point_icon,
        building: row.building,
        floor: row.floor,
        deadline_time: row.deadline_time ? String(row.deadline_time).slice(0, 5) : null,
        deadline_reason_th: row.deadline_reason_th,
        est_minutes: row.est_minutes,
        wait_after_minutes: row.wait_after_minutes,
        requires: (row.requires as number[]).map(Number),
      });
    }
    return { templates: [...templates.values()] };
  }

  /** ค้นผู้ป่วยด้วย HN หรือชื่อ — เฉพาะเจ้าหน้าที่เวชระเบียน */
  @Get('patients')
  @Roles('registrar', 'admin')
  @UseGuards(AuthGuard)
  async patients(@Query('q') q?: string) {
    const search = String(q ?? '').trim();
    const { rows } = await this.db.query(
      `SELECT p.hn, p.display_name, p.preferred_lang,
              (SELECT MAX(v.visit_date) FROM visits v WHERE v.patient_id = p.id) AS last_visit
         FROM patients p
        WHERE $1 = '' OR p.hn ILIKE '%' || $1 || '%' OR p.display_name ILIKE '%' || $1 || '%'
        ORDER BY p.hn
        LIMIT 50`,
      [search],
    );
    return { patients: rows };
  }

  /** เปิดประวัติผู้ป่วยใหม่ — HN ออกให้อัตโนมัติถ้าไม่ได้ระบุมา */
  @Post('patients')
  @HttpCode(201)
  @Roles('registrar', 'admin')
  @UseGuards(AuthGuard)
  async createPatient(@Body() body: { display_name?: string; hn?: string; preferred_lang?: string }) {
    const input = requireFields(body, ['display_name']);
    const lang = String(input.preferred_lang ?? 'th').slice(0, 2);

    const hn = String(input.hn ?? '').trim() || (await this.nextHn());
    if (!/^\d{5,12}$/.test(hn)) throw badRequest('HN ต้องเป็นตัวเลข', 'HN must be digits');

    const { rows } = await this.db.query(
      `INSERT INTO patients (hn, display_name, preferred_lang) VALUES ($1, $2, $3)
       ON CONFLICT (hn) DO UPDATE SET display_name = EXCLUDED.display_name
       RETURNING hn, display_name, preferred_lang`,
      [hn, String(input.display_name).trim(), lang],
    );
    return { patient: rows[0] };
  }

  private async nextHn(): Promise<string> {
    const { rows } = await this.db.query(
      "SELECT COALESCE(MAX(hn::bigint), 12345) + 1 AS hn FROM patients WHERE hn ~ '^[0-9]+$'",
    );
    return String(rows[0].hn).padStart(7, '0');
  }
}
