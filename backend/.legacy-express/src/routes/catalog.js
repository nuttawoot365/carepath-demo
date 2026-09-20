import { Router } from 'express';
import { query } from '../db.js';
import { requireRole } from '../lib/auth.js';
import { badRequest } from '../lib/errors.js';
import { requireFields } from '../lib/validate.js';

const router = Router();

/** แม่แบบขั้นตอนพร้อมขั้นทั้งหมด — หน้าเวชระเบียนใช้เลือกว่าผู้ป่วยมาด้วยเรื่องอะไร */
router.get('/templates', async (_req, res, next) => {
  try {
    const { rows } = await query(
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

    const templates = new Map();
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
      templates.get(row.code).steps.push({
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
        requires: row.requires.map(Number),
      });
    }
    res.json({ templates: [...templates.values()] });
  } catch (error) {
    next(error);
  }
});

/** ค้นผู้ป่วยด้วย HN หรือชื่อ — เฉพาะเจ้าหน้าที่เวชระเบียน */
router.get('/patients', requireRole('registrar', 'admin'), async (req, res, next) => {
  try {
    const search = String(req.query.q ?? '').trim();
    const { rows } = await query(
      `SELECT p.hn, p.display_name, p.preferred_lang,
              (SELECT MAX(v.visit_date) FROM visits v WHERE v.patient_id = p.id) AS last_visit
         FROM patients p
        WHERE $1 = '' OR p.hn ILIKE '%' || $1 || '%' OR p.display_name ILIKE '%' || $1 || '%'
        ORDER BY p.hn
        LIMIT 50`,
      [search],
    );
    res.json({ patients: rows });
  } catch (error) {
    next(error);
  }
});

/** เปิดประวัติผู้ป่วยใหม่ — HN ออกให้อัตโนมัติถ้าไม่ได้ระบุมา */
router.post('/patients', requireRole('registrar', 'admin'), async (req, res, next) => {
  try {
    const body = requireFields(req.body, ['display_name']);
    const lang = String(body.preferred_lang ?? 'th').slice(0, 2);

    const hn = String(body.hn ?? '').trim() || (await nextHn());
    if (!/^\d{5,12}$/.test(hn)) throw badRequest('HN ต้องเป็นตัวเลข', 'HN must be digits');

    const { rows } = await query(
      `INSERT INTO patients (hn, display_name, preferred_lang) VALUES ($1, $2, $3)
       ON CONFLICT (hn) DO UPDATE SET display_name = EXCLUDED.display_name
       RETURNING hn, display_name, preferred_lang`,
      [hn, String(body.display_name).trim(), lang],
    );
    res.status(201).json({ patient: rows[0] });
  } catch (error) {
    next(error);
  }
});

async function nextHn() {
  const { rows } = await query("SELECT COALESCE(MAX(hn::bigint), 12345) + 1 AS hn FROM patients WHERE hn ~ '^[0-9]+$'");
  return String(rows[0].hn).padStart(7, '0');
}

export default router;
