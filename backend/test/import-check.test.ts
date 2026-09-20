import { checkImport, type ImportFiles } from '../src/domain/import-check';

/** ผังเล็กที่ถูกต้องทุกข้อ ใช้เป็นฐานแล้วทำให้ผิดทีละจุด */
const good = (): ImportFiles => ({
  nodes: [
    { code: 'A1-ENT', building: 'A', floor: '1', kind: 'entrance', name_th: 'ทางเข้า', department: '', map_x: '10', map_y: '10' },
    { code: 'A1-REG', building: 'A', floor: '1', kind: 'counter', name_th: 'เวชระเบียน', department: 'A1-OPD', map_x: '20', map_y: '10' },
    { code: 'A1-LIFT', building: 'A', floor: '1', kind: 'elevator', name_th: 'ลิฟต์ A', department: '', map_x: '30', map_y: '10' },
    { code: 'A2-LIFT', building: 'A', floor: '2', kind: 'elevator', name_th: 'ลิฟต์ A ชั้น 2', department: '', map_x: '30', map_y: '20' },
  ],
  edges: [
    { from: 'A1-ENT', to: 'A1-REG', kind: 'corridor', distance_m: '20', walk_seconds: '20', turn: 'straight', bidirectional: '1', is_accessible: '1', status: 'open' },
    { from: 'A1-REG', to: 'A1-LIFT', kind: 'corridor', distance_m: '15', walk_seconds: '15', turn: 'right', bidirectional: '1', is_accessible: '1', status: 'open' },
    { from: 'A1-LIFT', to: 'A2-LIFT', kind: 'elevator', distance_m: '0', walk_seconds: '50', turn: '', bidirectional: '1', is_accessible: '1', status: 'open' },
  ],
  departments: [
    { code: 'A1-OPD', building: 'A', floor: '1', name_th: 'ผู้ป่วยนอก', name_en: 'OPD', color: '#1f6f8b', entrance_node: 'A1-REG' },
  ],
  templates: [{ code: 'WALKIN', category: 'general', name_th: 'เดินเข้า', name_en: 'Walk-in' }],
  pathways: [
    { template: 'WALKIN', step: '1', name_th: 'ยื่นบัตร', service_point: 'A1-REG', est_minutes: '5', prereq_steps: '', deadline: '', wait_after_minutes: '0' },
    { template: 'WALKIN', step: '2', name_th: 'ขึ้นชั้น 2', service_point: 'A2-LIFT', est_minutes: '3', prereq_steps: '1', deadline: '', wait_after_minutes: '0' },
  ],
  users: [{ username: 'reg1', display_name: 'ปราณี', role: 'registrar', department: 'A1-OPD', password: 'demo@1234' }],
  patients: [{ hn: '0012345', display_name: 'สมชาย', preferred_lang: 'th' }],
});

/** คืนข้อความปัญหาทั้งหมดเป็นสตริงเดียว เพื่อให้ยืนยันได้ว่าฟ้องเรื่องที่ตั้งใจ */
const messages = (files: ImportFiles) => checkImport(files).problems.map((p) => p.message).join(' | ');

it('ผังที่ถูกต้องผ่านโดยไม่มีปัญหาและไม่มีคำเตือน', () => {
  const result = checkImport(good());
  expect(result.problems).toEqual([]);
  expect(result.warnings).toEqual([]);
  expect(result.ok).toBe(true);
  expect(result.counts.nodes).toBe(4);
});

it('ลิฟต์ที่ระยะทางแนวราบเป็น 0 ถือว่าถูกต้อง เพราะเดินทางแนวตั้ง', () => {
  const files = good();
  expect(files.edges!.some((e) => e.kind === 'elevator' && e.distance_m === '0')).toBe(true);
  expect(checkImport(files).ok).toBe(true);
});

it('เส้นเชื่อมที่ไม่เสียเวลาเลยถูกปฏิเสธ เพราะระบบจะเลือกมันเสมอ', () => {
  const files = good();
  files.edges![2].walk_seconds = '0';
  expect(messages(files)).toContain('walk_seconds ต้องมากกว่า 0');
});

it('ขาดไฟล์ที่จำเป็น นำเข้าไม่ได้', () => {
  expect(messages({ nodes: good().nodes })).toContain('ต้องมีไฟล์ edges.csv');
});

it('หัวคอลัมน์ขาด ฟ้องที่บรรทัดหัวตารางและหยุดตรวจเนื้อใน', () => {
  const files = good();
  files.nodes = [{ code: 'A1-ENT', building: 'A' }];  // ขาด floor, kind
  const result = checkImport(files);
  expect(result.problems[0].line).toBe(1);
  expect(result.problems[0].message).toContain('floor');
  expect(result.problems[0].message).toContain('kind');
});

it('เส้นเชื่อมที่ชี้ไปจุดที่ไม่มีในผัง ถูกปฏิเสธ', () => {
  const files = good();
  files.edges!.push({ from: 'A1-ENT', to: 'ไม่มีจุดนี้', kind: 'corridor', distance_m: '5', walk_seconds: '5', turn: '', bidirectional: '1', is_accessible: '1', status: 'open' });
  expect(messages(files)).toContain('ไม่มีจุด ไม่มีจุดนี้ ใน nodes.csv');
});

it('รหัสจุดซ้ำกัน ถูกปฏิเสธ', () => {
  const files = good();
  files.nodes!.push({ ...files.nodes![0] });
  expect(messages(files)).toContain('code ซ้ำ: A1-ENT');
});

it('เส้นเชื่อมซ้ำคู่เดิม ถูกปฏิเสธ', () => {
  const files = good();
  files.edges!.push({ ...files.edges![0] });
  expect(messages(files)).toContain('เส้นเชื่อมซ้ำ: A1-ENT → A1-REG');
});

it('จุดที่ไม่มีเส้นเชื่อมต่อถึงเลย ขึ้นเป็นคำเตือน ไม่ขวางการนำเข้า', () => {
  const files = good();
  files.nodes!.push({ code: 'A1-LOST', building: 'A', floor: '1', kind: 'poi', name_th: 'ห้องลอย', department: '', map_x: '99', map_y: '99' });
  const result = checkImport(files);
  expect(result.ok).toBe(true);
  expect(result.warnings.map((w) => w.message).join(' ')).toContain('A1-LOST');
});

it('ขั้นตอนที่ชี้ไปจุดบริการที่ไม่มีในผัง ถูกปฏิเสธ', () => {
  const files = good();
  files.pathways![0].service_point = 'B9-GHOST';
  expect(messages(files)).toContain('ไม่มีจุดบริการ B9-GHOST');
});

it('เงื่อนไขลำดับที่ชี้ไปขั้นที่ไม่มี ถูกปฏิเสธ', () => {
  const files = good();
  files.pathways![1].prereq_steps = '9';
  expect(messages(files)).toContain('ชี้ไปขั้นที่ 9');
});

it('ขั้นตอนที่ตั้งเงื่อนไขว่าต้องรอตัวเอง ถูกปฏิเสธ', () => {
  const files = good();
  files.pathways![1].prereq_steps = '2';
  expect(messages(files)).toContain('ต้องรอตัวเอง');
});

it('กำหนดเวลาที่ไม่อยู่ในรูป HH:MM ถูกปฏิเสธ', () => {
  const files = good();
  files.pathways![0].deadline = '11 โมง';
  expect(messages(files)).toContain('deadline ต้องอยู่ในรูป HH:MM');
});

it('แผนกที่อ้างชั้นซึ่งไม่มีจุดใดอยู่เลย ถูกปฏิเสธ', () => {
  const files = good();
  files.departments![0].floor = '9';
  expect(messages(files)).toContain('ไม่มีจุดใดใน nodes.csv อยู่อาคาร A ชั้น 9');
});

it('จุดที่อ้างแผนกซึ่งไม่มีในไฟล์แผนก ถูกปฏิเสธ', () => {
  const files = good();
  files.nodes![1].department = 'ไม่มีแผนกนี้';
  expect(messages(files)).toContain('ไม่มีแผนก ไม่มีแผนกนี้');
});

it('บทบาทผู้ใช้ที่ไม่รู้จัก ถูกปฏิเสธ', () => {
  const files = good();
  files.users![0].role = 'หัวหน้าใหญ่';
  expect(messages(files)).toContain('role ต้องเป็นค่าใดค่าหนึ่ง');
});

it('HN ที่ไม่ใช่ตัวเลข ถูกปฏิเสธ', () => {
  const files = good();
  files.patients![0].hn = 'ABC123';
  expect(messages(files)).toContain('hn ต้องเป็นตัวเลข 5–12 หลัก');
});

it('บรรทัดที่ฟ้องตรงกับบรรทัดที่ผู้ใช้เห็นในโปรแกรมตาราง', () => {
  const files = good();
  files.nodes![2].floor = 'ชั้นสาม';          // แถวข้อมูลที่ 3 = บรรทัดที่ 4
  const problem = checkImport(files).problems[0];
  expect(problem.file).toBe('nodes');
  expect(problem.line).toBe(4);
});

it('kind ของจุดที่ไม่ตรงกับ CHECK constraint ถูกปฏิเสธตั้งแต่ตอนตรวจ', () => {
  // เคสนี้มาจากการทดสอบจริง: 'room' ฟังดูสมเหตุสมผลแต่ schema ไม่รับ
  // เดิมผ่านการตรวจแล้วไปพังตอนเขียนลงฐานข้อมูล ผู้ดูแลจึงเห็นข้อความของ PostgreSQL แทน
  const files = good();
  files.nodes![1].kind = 'room';
  expect(messages(files)).toContain('ไม่ใช่ชนิดที่รู้จัก');
});

it('status ของเส้นเชื่อมที่ไม่ใช่ open/closed ถูกปฏิเสธ', () => {
  const files = good();
  files.edges![0].status = 'maybe';
  expect(messages(files)).toContain('status ต้องเป็น open หรือ closed');
});
