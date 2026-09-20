/**
 * ตรวจไฟล์นำเข้าก่อนแตะฐานข้อมูล
 *
 * ผังที่ผิดทำให้ระบบนำทางพาผู้ป่วยไปผิดที่ ซึ่งแย่กว่าการไม่นำเข้าเลย
 * ไฟล์ชุดหนึ่งจึงต้องผ่านครบทุกข้อก่อน ไม่มีการนำเข้าแบบ "เอาเท่าที่ถูก"
 *
 * บริสุทธิ์ล้วน ไม่แตะฐานข้อมูล จึงทดสอบได้ และใช้เป็นตัวพรีวิวให้ผู้ดูแลดูก่อนกดยืนยันได้
 */
import type { CsvRow } from '../common/csv';

export const IMPORT_NAMES = [
  'nodes', 'edges', 'departments', 'templates', 'pathways', 'users', 'patients', 'node-photos',
] as const;

export type ImportName = (typeof IMPORT_NAMES)[number];
export type ImportFiles = Partial<Record<ImportName, CsvRow[]>>;

/** ไฟล์ที่ขาดไม่ได้ — ผังไม่มีจุดกับเส้นเชื่อมก็คิดเส้นทางไม่ได้ */
export const REQUIRED_FILES: ImportName[] = ['nodes', 'edges'];

/** คอลัมน์ที่ต้องมีในหัวไฟล์ · คอลัมน์อื่นมีเพิ่มได้ ระบบจะข้ามไป */
const COLUMNS: Record<ImportName, string[]> = {
  nodes: ['code', 'building', 'floor', 'kind'],
  edges: ['from', 'to', 'kind', 'distance_m'],
  departments: ['code', 'building', 'floor', 'name_th'],
  templates: ['code', 'name_th'],
  pathways: ['template', 'step', 'name_th', 'service_point', 'est_minutes'],
  users: ['username', 'display_name', 'role', 'password'],
  patients: ['hn', 'display_name'],
  'node-photos': ['node', 'url'],
};

/**
 * ค่าเหล่านี้ต้องตรงกับ CHECK constraint ใน sql/schema.sql เป๊ะ
 * ถ้าปล่อยให้ต่างกัน ไฟล์จะผ่านการตรวจแล้วไปพังตอนเขียนลงฐานข้อมูล
 * ซึ่งทำให้ผู้ดูแลเห็นข้อความของ PostgreSQL แทนข้อความที่อ่านรู้เรื่อง
 */
const NODE_KINDS = new Set([
  'entrance', 'counter', 'screening', 'exam_room', 'lab', 'xray', 'pharmacy', 'cashier',
  'appointment', 'waiting_area', 'junction', 'elevator', 'stairs', 'ramp', 'bridge',
  'toilet', 'poi',
]);
const EDGE_KINDS = new Set(['corridor', 'door', 'elevator', 'stairs', 'ramp', 'bridge']);
const EDGE_STATUSES = new Set(['open', 'closed']);
const TURNS = new Set(['left', 'right', 'straight', 'back']);
const ROLES = new Set(['admin', 'registrar', 'station', 'executive']);

export interface Problem {
  file: string;
  /** บรรทัดในไฟล์ตามที่ผู้ใช้เห็นในโปรแกรมตาราง — 1 คือหัวคอลัมน์ ข้อมูลแถวแรกจึงเป็น 2 */
  line: number | null;
  message: string;
}

export interface CheckResult {
  ok: boolean;
  counts: Record<string, number>;
  /** ต้องแก้ให้หมดก่อนจึงนำเข้าได้ */
  problems: Problem[];
  /** นำเข้าได้ แต่ควรรู้ไว้ */
  warnings: Problem[];
}

const isInt = (value: string) => /^-?\d+$/.test(value.trim());
const isNumber = (value: string) => value.trim() !== '' && Number.isFinite(Number(value));
const line = (index: number) => index + 2; // +1 ข้ามหัวคอลัมน์ +1 เพราะคนนับจาก 1

/** ตรวจไฟล์ทั้งชุดพร้อมกัน เพราะความถูกต้องส่วนใหญ่เป็นความสัมพันธ์ข้ามไฟล์ */
export function checkImport(files: ImportFiles): CheckResult {
  const problems: Problem[] = [];
  const warnings: Problem[] = [];
  const bad = (file: string, at: number | null, message: string) =>
    problems.push({ file, line: at, message });
  const warn = (file: string, at: number | null, message: string) =>
    warnings.push({ file, line: at, message });

  const counts = Object.fromEntries(
    IMPORT_NAMES.filter((name) => files[name]).map((name) => [name, files[name]!.length]),
  );

  /* ---------- ไฟล์ที่ต้องมี และหัวคอลัมน์ที่ต้องครบ ---------- */

  for (const name of REQUIRED_FILES) {
    if (!files[name] || files[name]!.length === 0) {
      bad(name, null, `ต้องมีไฟล์ ${name}.csv และต้องมีข้อมูลอย่างน้อยหนึ่งแถว`);
    }
  }

  for (const name of IMPORT_NAMES) {
    const rows = files[name];
    if (!rows || rows.length === 0) continue;
    const header = Object.keys(rows[0]);
    const missing = COLUMNS[name].filter((column) => !header.includes(column));
    if (missing.length > 0) {
      bad(name, 1, `หัวคอลัมน์ขาด: ${missing.join(', ')}`);
    }
  }

  // หัวคอลัมน์ผิดแล้วตรวจเนื้อในต่อไม่มีประโยชน์ จะได้ข้อความผิดพลาดที่ชวนสับสน
  if (problems.length > 0) return { ok: false, counts, problems, warnings };

  /* ---------- จุดในผัง ---------- */

  const nodeCodes = new Set<string>();
  const floorsSeen = new Set<string>();

  (files.nodes ?? []).forEach((row, i) => {
    const code = row.code?.trim();
    if (!code) return bad('nodes', line(i), 'code ว่าง');
    if (nodeCodes.has(code)) bad('nodes', line(i), `code ซ้ำ: ${code}`);
    nodeCodes.add(code);

    if (!row.building?.trim()) bad('nodes', line(i), `${code}: building ว่าง`);
    if (!isInt(row.floor ?? '')) bad('nodes', line(i), `${code}: floor ต้องเป็นจำนวนเต็ม`);
    else floorsSeen.add(`${row.building.trim()}|${Number(row.floor)}`);

    if (!row.kind?.trim()) bad('nodes', line(i), `${code}: kind ว่าง`);
    else if (!NODE_KINDS.has(row.kind.trim())) {
      bad('nodes', line(i), `${code}: kind "${row.kind}" ไม่ใช่ชนิดที่รู้จัก · ใช้ได้เฉพาะ ${[...NODE_KINDS].join(', ')}`);
    }

    // พิกัดใช้วาดผัง ไม่มีก็นำเข้าได้แต่หน้าผังจะวาดจุดนี้ไม่ได้
    for (const axis of ['map_x', 'map_y']) {
      if (axis in row && row[axis].trim() !== '' && !isNumber(row[axis])) {
        bad('nodes', line(i), `${code}: ${axis} ไม่ใช่ตัวเลข`);
      }
    }
    if ('map_x' in row && row.map_x.trim() === '') {
      warn('nodes', line(i), `${code}: ไม่มีพิกัด map_x/map_y จุดนี้จะไม่ขึ้นบนหน้าผัง`);
    }
  });

  /* ---------- เส้นเชื่อม ---------- */

  const pairs = new Set<string>();
  const connected = new Set<string>();

  (files.edges ?? []).forEach((row, i) => {
    const from = row.from?.trim();
    const to = row.to?.trim();

    if (!from || !to) return bad('edges', line(i), 'from หรือ to ว่าง');
    if (from === to) bad('edges', line(i), `${from}: เส้นเชื่อมวนกลับมาที่จุดเดิม`);
    if (!nodeCodes.has(from)) bad('edges', line(i), `ไม่มีจุด ${from} ใน nodes.csv`);
    if (!nodeCodes.has(to)) bad('edges', line(i), `ไม่มีจุด ${to} ใน nodes.csv`);

    const key = `${from}>${to}`;
    if (pairs.has(key)) bad('edges', line(i), `เส้นเชื่อมซ้ำ: ${from} → ${to}`);
    pairs.add(key);
    connected.add(from);
    connected.add(to);

    if (!EDGE_KINDS.has(row.kind?.trim())) {
      bad('edges', line(i), `kind ต้องเป็นค่าใดค่าหนึ่งใน ${[...EDGE_KINDS].join(', ')}`);
    }
    // ลิฟต์ บันได ทางลาด เดินทางแนวตั้ง ระยะทางแนวราบจึงเป็น 0 ได้ตามจริง
    // สิ่งที่ห้ามคือเส้นเชื่อมที่ "ฟรี" เพราะ Dijkstra จะเลือกมันเสมอ
    if (!isNumber(row.distance_m ?? '') || Number(row.distance_m) < 0) {
      bad('edges', line(i), 'distance_m ต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป');
    }
    const seconds = row.walk_seconds?.trim();
    if (seconds) {
      if (!isNumber(seconds)) bad('edges', line(i), 'walk_seconds ไม่ใช่ตัวเลข');
      else if (Number(seconds) <= 0) {
        bad('edges', line(i), 'walk_seconds ต้องมากกว่า 0 ไม่งั้นระบบจะมองว่าเส้นทางนี้ไม่เสียเวลาเลย');
      }
    } else if (Number(row.distance_m) === 0) {
      warn('edges', line(i),
        `${from} → ${to}: ไม่มีทั้ง distance_m และ walk_seconds ระบบจะคิดให้เป็น 1 วินาที`);
    }
    if (row.turn?.trim() && !TURNS.has(row.turn.trim())) {
      bad('edges', line(i), `turn ต้องเป็นค่าใดค่าหนึ่งใน ${[...TURNS].join(', ')}`);
    }
    if (row.status?.trim() && !EDGE_STATUSES.has(row.status.trim())) {
      bad('edges', line(i), `status ต้องเป็น open หรือ closed — พบ "${row.status}"`);
    }
  });

  // จุดที่ไม่มีเส้นเชื่อมแตะเลย = ผู้ป่วยเดินไปไม่ถึงตลอดกาล
  for (const code of nodeCodes) {
    if (!connected.has(code)) {
      warn('nodes', null, `${code}: ไม่มีเส้นเชื่อมใดต่อถึงจุดนี้ จะไปไม่ถึง`);
    }
  }

  /* ---------- แผนก ---------- */

  const deptCodes = new Set<string>();

  (files.departments ?? []).forEach((row, i) => {
    const code = row.code?.trim();
    if (!code) return bad('departments', line(i), 'code ว่าง');
    if (deptCodes.has(code)) bad('departments', line(i), `code ซ้ำ: ${code}`);
    deptCodes.add(code);

    if (!isInt(row.floor ?? '')) {
      bad('departments', line(i), `${code}: floor ต้องเป็นจำนวนเต็ม`);
    } else if (!floorsSeen.has(`${row.building?.trim()}|${Number(row.floor)}`)) {
      bad('departments', line(i),
        `${code}: ไม่มีจุดใดใน nodes.csv อยู่อาคาร ${row.building} ชั้น ${row.floor}`);
    }
    if (row.entrance_node?.trim() && !nodeCodes.has(row.entrance_node.trim())) {
      bad('departments', line(i), `${code}: ไม่มีจุด ${row.entrance_node} ใน nodes.csv`);
    }
  });

  // จุดอ้างแผนกที่ไม่มีในไฟล์แผนก
  if (files.departments) {
    (files.nodes ?? []).forEach((row, i) => {
      const dept = row.department?.trim();
      if (dept && !deptCodes.has(dept)) {
        bad('nodes', line(i), `${row.code}: ไม่มีแผนก ${dept} ใน departments.csv`);
      }
    });
  }

  /* ---------- แม่แบบขั้นตอน ---------- */

  const templateCodes = new Set(
    (files.templates ?? []).map((row) => row.code?.trim()).filter(Boolean) as string[],
  );
  const stepKeys = new Set<string>();

  (files.pathways ?? []).forEach((row, i) => {
    const template = row.template?.trim();
    if (!template) return bad('pathways', line(i), 'template ว่าง');
    if (files.templates && !templateCodes.has(template)) {
      bad('pathways', line(i), `ไม่มีแม่แบบ ${template} ใน templates.csv`);
    }
    if (!isInt(row.step ?? '')) return bad('pathways', line(i), 'step ต้องเป็นจำนวนเต็ม');

    const key = `${template}#${Number(row.step)}`;
    if (stepKeys.has(key)) bad('pathways', line(i), `ลำดับซ้ำ: ${template} ขั้นที่ ${row.step}`);
    stepKeys.add(key);

    if (!nodeCodes.has(row.service_point?.trim())) {
      bad('pathways', line(i), `ไม่มีจุดบริการ ${row.service_point} ใน nodes.csv`);
    }
    if (!isNumber(row.est_minutes ?? '')) {
      bad('pathways', line(i), 'est_minutes ไม่ใช่ตัวเลข');
    }
    if (row.deadline?.trim() && !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(row.deadline.trim())) {
      bad('pathways', line(i), `deadline ต้องอยู่ในรูป HH:MM — พบ "${row.deadline}"`);
    }
  });

  // เงื่อนไขลำดับต้องชี้ไปขั้นที่มีจริงในแม่แบบเดียวกัน และห้ามชี้ตัวเอง
  (files.pathways ?? []).forEach((row, i) => {
    const template = row.template?.trim();
    for (const part of (row.prereq_steps ?? '').split(';').map((s) => s.trim()).filter(Boolean)) {
      if (!isInt(part)) {
        bad('pathways', line(i), `prereq_steps มีค่าที่ไม่ใช่เลขขั้น: "${part}"`);
      } else if (!stepKeys.has(`${template}#${Number(part)}`)) {
        bad('pathways', line(i), `prereq_steps ชี้ไปขั้นที่ ${part} ซึ่งไม่มีในแม่แบบ ${template}`);
      } else if (Number(part) === Number(row.step)) {
        bad('pathways', line(i), `ขั้นที่ ${row.step} ตั้งเงื่อนไขว่าต้องรอตัวเอง`);
      }
    }
  });

  /* ---------- ผู้ใช้และผู้ป่วย ---------- */

  const usernames = new Set<string>();
  (files.users ?? []).forEach((row, i) => {
    const username = row.username?.trim();
    if (!username) return bad('users', line(i), 'username ว่าง');
    if (usernames.has(username)) bad('users', line(i), `username ซ้ำ: ${username}`);
    usernames.add(username);

    if (!ROLES.has(row.role?.trim())) {
      bad('users', line(i), `${username}: role ต้องเป็นค่าใดค่าหนึ่งใน ${[...ROLES].join(', ')}`);
    }
    if (!row.password?.trim()) bad('users', line(i), `${username}: password ว่าง`);
    if (row.department?.trim() && files.departments && !deptCodes.has(row.department.trim())) {
      bad('users', line(i), `${username}: ไม่มีแผนก ${row.department} ใน departments.csv`);
    }
    if (row.role?.trim() === 'station' && !row.department?.trim()) {
      warn('users', line(i), `${username}: เป็น station แต่ไม่ได้ระบุแผนก จะไม่เห็นคิวของใครเลย`);
    }
  });

  const hns = new Set<string>();
  (files.patients ?? []).forEach((row, i) => {
    const hn = row.hn?.trim();
    if (!hn) return bad('patients', line(i), 'hn ว่าง');
    if (hns.has(hn)) bad('patients', line(i), `hn ซ้ำ: ${hn}`);
    hns.add(hn);
    if (!/^\d{5,12}$/.test(hn)) bad('patients', line(i), `hn ต้องเป็นตัวเลข 5–12 หลัก — พบ "${hn}"`);
    if (!row.display_name?.trim()) bad('patients', line(i), `${hn}: display_name ว่าง`);
  });

  (files['node-photos'] ?? []).forEach((row, i) => {
    if (!nodeCodes.has(row.node?.trim())) {
      bad('node-photos', line(i), `ไม่มีจุด ${row.node} ใน nodes.csv`);
    }
  });

  return { ok: problems.length === 0, counts, problems, warnings };
}
