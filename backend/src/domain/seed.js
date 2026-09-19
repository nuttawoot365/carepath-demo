import { csvBool, csvNumberOrNull, csvOrNull } from '../lib/csv.js';
import { hashPassword } from '../lib/auth.js';
import { qrToken } from '../lib/ids.js';

const WALK_SPEED_M_PER_SEC = 1;

/**
 * นำเข้าผังทั้งชุดในทรานแซกชันเดียว — ใช้ทั้งตอน reset และตอน admin อัปโหลด CSV
 * ทุกคำสั่งเป็น parameterized query
 * @returns สรุปจำนวนแถวที่นำเข้าแต่ละชนิด
 */
export async function importAll(client, files) {
  const floors = await importFloors(client, files.nodes);
  const departments = await importDepartments(client, files.departments, floors);
  const nodes = await importNodes(client, files.nodes, floors, departments);
  await linkDepartmentEntrances(client, files.departments, nodes);
  const edges = await importEdges(client, files.edges, nodes);
  const templates = await importPathways(client, files.templates, files.pathways, nodes);
  const users = await importUsers(client, files.users, departments);
  const patients = await importPatients(client, files.patients);

  return {
    floors: floors.size,
    departments: departments.size,
    nodes: nodes.size,
    edges,
    templates,
    users,
    patients,
  };
}

/** อาคารและชั้นมาจากคอลัมน์ building/floor ของ nodes.csv จึงไม่ต้องดูแลไฟล์แยก */
async function importFloors(client, nodeRows) {
  const buildings = new Map();
  const floors = new Map();

  for (const row of nodeRows) {
    if (!buildings.has(row.building)) {
      const { rows } = await client.query(
        `INSERT INTO buildings (code, name_th, name_en) VALUES ($1, $2, $3)
         ON CONFLICT (code) DO UPDATE SET name_th = EXCLUDED.name_th
         RETURNING id`,
        [row.building, `อาคาร ${row.building}`, `Building ${row.building}`],
      );
      buildings.set(row.building, rows[0].id);
    }

    const key = `${row.building}${row.floor}`;
    if (!floors.has(key)) {
      const { rows } = await client.query(
        `INSERT INTO floors (building_id, level) VALUES ($1, $2)
         ON CONFLICT (building_id, level) DO UPDATE SET level = EXCLUDED.level
         RETURNING id`,
        [buildings.get(row.building), Number(row.floor)],
      );
      floors.set(key, rows[0].id);
    }
  }
  return floors;
}

async function importDepartments(client, rows, floors) {
  const departments = new Map();

  for (const row of rows) {
    const { rows: inserted } = await client.query(
      `INSERT INTO departments (floor_id, code, name_th, name_en, color)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (code) DO UPDATE
         SET floor_id = EXCLUDED.floor_id, name_th = EXCLUDED.name_th,
             name_en = EXCLUDED.name_en, color = EXCLUDED.color
       RETURNING id`,
      [floors.get(`${row.building}${row.floor}`), row.code, row.name_th, row.name_en, csvOrNull(row.color)],
    );
    departments.set(row.code, inserted[0].id);
  }
  return departments;
}

async function importNodes(client, rows, floors, departments) {
  const nodes = new Map();

  for (const row of rows) {
    const { rows: inserted } = await client.query(
      `INSERT INTO nodes (floor_id, department_id, code, kind, name_th, name_en,
                          landmark_th, landmark_en, icon, qr_token)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (code) DO UPDATE
         SET floor_id = EXCLUDED.floor_id, department_id = EXCLUDED.department_id,
             kind = EXCLUDED.kind, name_th = EXCLUDED.name_th, name_en = EXCLUDED.name_en,
             landmark_th = EXCLUDED.landmark_th, landmark_en = EXCLUDED.landmark_en,
             icon = EXCLUDED.icon, is_active = TRUE
       RETURNING id`,
      [
        floors.get(`${row.building}${row.floor}`),
        row.department ? departments.get(row.department) : null,
        row.code,
        row.kind,
        csvOrNull(row.name_th),
        csvOrNull(row.name_en),
        csvOrNull(row.landmark_th),
        csvOrNull(row.landmark_en),
        csvOrNull(row.icon),
        csvBool(row.qr) ? qrToken() : null,
      ],
    );
    nodes.set(row.code, inserted[0].id);
  }
  return nodes;
}

async function linkDepartmentEntrances(client, rows, nodes) {
  for (const row of rows.filter((item) => item.entrance_node)) {
    await client.query('UPDATE departments SET entrance_node_id = $1 WHERE code = $2', [
      nodes.get(row.entrance_node),
      row.code,
    ]);
  }
}

/** bidirectional=1 กลายเป็นสองแถว — ทิศกลับสลับซ้าย/ขวาและไม่ยกคำบรรยายมาด้วย */
async function importEdges(client, rows, nodes) {
  const OPPOSITE_TURN = { left: 'right', right: 'left', straight: 'straight', back: 'back' };
  let count = 0;

  for (const row of rows) {
    const distance = Number(row.distance_m);
    const seconds =
      csvNumberOrNull(row.walk_seconds) ?? Math.max(1, Math.round(distance / WALK_SPEED_M_PER_SEC));

    const directions = [
      {
        from: row.from,
        to: row.to,
        turn: csvOrNull(row.turn),
        instructionTh: csvOrNull(row.instruction_th),
        instructionEn: csvOrNull(row.instruction_en),
      },
    ];
    if (csvBool(row.bidirectional)) {
      directions.push({
        from: row.to,
        to: row.from,
        turn: row.turn ? OPPOSITE_TURN[row.turn] : null,
        instructionTh: null,
        instructionEn: null,
      });
    }

    for (const direction of directions) {
      await client.query(
        `INSERT INTO edges (from_node_id, to_node_id, kind, distance_m, walk_seconds, turn,
                            instruction_th, instruction_en, is_accessible, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (from_node_id, to_node_id) DO UPDATE
           SET kind = EXCLUDED.kind, distance_m = EXCLUDED.distance_m,
               walk_seconds = EXCLUDED.walk_seconds, turn = EXCLUDED.turn,
               instruction_th = EXCLUDED.instruction_th, instruction_en = EXCLUDED.instruction_en,
               is_accessible = EXCLUDED.is_accessible, status = EXCLUDED.status`,
        [
          nodes.get(direction.from),
          nodes.get(direction.to),
          row.kind,
          distance,
          seconds,
          direction.turn,
          direction.instructionTh,
          direction.instructionEn,
          csvBool(row.is_accessible),
          row.status || 'open',
        ],
      );
      count += 1;
    }
  }
  return count;
}

async function importPathways(client, templateRows, rows, nodes) {
  const templates = new Map();
  const stepIds = new Map();   // 'CODE#sequence' → id

  for (const row of templateRows) {
    const { rows: inserted } = await client.query(
      `INSERT INTO pathway_templates (code, category, name_th, name_en)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (code) DO UPDATE
         SET category = EXCLUDED.category, name_th = EXCLUDED.name_th, name_en = EXCLUDED.name_en
       RETURNING id`,
      [row.code, row.category, row.name_th, row.name_en],
    );
    templates.set(row.code, inserted[0].id);
  }

  for (const row of rows) {
    const { rows: inserted } = await client.query(
      `INSERT INTO template_steps (template_id, sequence, service_point_id, name_th, name_en,
                                   deadline_time, deadline_reason_th, est_minutes, wait_after_minutes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (template_id, sequence) DO UPDATE
         SET service_point_id = EXCLUDED.service_point_id, name_th = EXCLUDED.name_th,
             name_en = EXCLUDED.name_en, deadline_time = EXCLUDED.deadline_time,
             deadline_reason_th = EXCLUDED.deadline_reason_th, est_minutes = EXCLUDED.est_minutes,
             wait_after_minutes = EXCLUDED.wait_after_minutes
       RETURNING id`,
      [
        templates.get(row.template),
        Number(row.step),
        nodes.get(row.service_point),
        row.name_th,
        row.name_en,
        csvOrNull(row.deadline),
        csvOrNull(row.deadline_reason_th),
        Number(row.est_minutes),
        Number(row.wait_after_minutes),
      ],
    );
    stepIds.set(`${row.template}#${row.step}`, inserted[0].id);
  }

  for (const row of rows.filter((item) => item.prereq_steps)) {
    for (const sequence of row.prereq_steps.split(';').filter(Boolean)) {
      await client.query(
        `INSERT INTO template_step_prereqs (step_id, requires_step_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [stepIds.get(`${row.template}#${row.step}`), stepIds.get(`${row.template}#${sequence.trim()}`)],
      );
    }
  }
  return templates.size;
}

async function importUsers(client, rows, departments) {
  for (const row of rows) {
    await client.query(
      `INSERT INTO users (username, password_hash, display_name, role, department_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (username) DO UPDATE
         SET password_hash = EXCLUDED.password_hash, display_name = EXCLUDED.display_name,
             role = EXCLUDED.role, department_id = EXCLUDED.department_id, is_active = TRUE`,
      [
        row.username,
        await hashPassword(row.password),
        row.display_name,
        row.role,
        row.department ? departments.get(row.department) : null,
      ],
    );
  }
  return rows.length;
}

async function importPatients(client, rows) {
  for (const row of rows) {
    await client.query(
      `INSERT INTO patients (hn, display_name, preferred_lang) VALUES ($1, $2, $3)
       ON CONFLICT (hn) DO UPDATE SET display_name = EXCLUDED.display_name`,
      [row.hn, row.display_name, row.preferred_lang || 'th'],
    );
  }
  return rows.length;
}
