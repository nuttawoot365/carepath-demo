-- CarePath · PostgreSQL 16 · 3NF
-- รันซ้ำได้: ล้างของเดิมทั้งชุดก่อนสร้างใหม่ (ใช้กับ npm run reset)

DROP TABLE IF EXISTS
  notifications, audit_logs,
  visit_step_prereqs, visit_steps, visits, patients,
  template_step_prereqs, template_steps, pathway_templates,
  node_photos, service_hours, edges, nodes, users, departments, floors, buildings
CASCADE;

-- ========== ผัง (M1) ==========

CREATE TABLE buildings (
  id       SERIAL PRIMARY KEY,
  code     VARCHAR(5)   NOT NULL UNIQUE,
  name_th  VARCHAR(100) NOT NULL,
  name_en  VARCHAR(100) NOT NULL
);

CREATE TABLE floors (
  id          SERIAL PRIMARY KEY,
  building_id INT NOT NULL REFERENCES buildings(id),
  level       INT NOT NULL,
  UNIQUE (building_id, level)
);

-- แผนก/คลินิก: สีป้าย + จุดยื่นบัตร + ขอบเขตที่ผู้ใช้ role station มองเห็น
CREATE TABLE departments (
  id               SERIAL PRIMARY KEY,
  floor_id         INT NOT NULL REFERENCES floors(id),
  code             VARCHAR(20)  NOT NULL UNIQUE,
  name_th          VARCHAR(100) NOT NULL,
  name_en          VARCHAR(100) NOT NULL,
  color            CHAR(7),
  entrance_node_id INT   -- FK เพิ่มหลังสร้าง nodes
);

CREATE TABLE nodes (
  id            SERIAL PRIMARY KEY,
  floor_id      INT NOT NULL REFERENCES floors(id),
  department_id INT REFERENCES departments(id),
  code          VARCHAR(20) NOT NULL UNIQUE,
  kind          VARCHAR(15) NOT NULL CHECK (kind IN (
                  'entrance','counter','screening','exam_room','lab','xray','pharmacy','cashier',
                  'appointment','waiting_area','junction','elevator','stairs','ramp','bridge','toilet','poi')),
  name_th       VARCHAR(100),
  name_en       VARCHAR(100),
  landmark_th   VARCHAR(120),
  landmark_en   VARCHAR(120),
  icon          VARCHAR(8),
  qr_token      CHAR(10) UNIQUE,                  -- QR ติดผนัง · NULL = จุดนี้ไม่ติด QR
  is_active     BOOLEAN NOT NULL DEFAULT TRUE     -- ปิดใช้แทนลบ เพราะ visit เก่าอ้างอยู่
);
ALTER TABLE departments ADD FOREIGN KEY (entrance_node_id) REFERENCES nodes(id);

-- 1 แถว = 1 ทิศทาง (ทางเดินสองทางเก็บ 2 แถว)
CREATE TABLE edges (
  id             SERIAL PRIMARY KEY,
  from_node_id   INT NOT NULL REFERENCES nodes(id),
  to_node_id     INT NOT NULL REFERENCES nodes(id),
  kind           VARCHAR(10) NOT NULL CHECK (kind IN ('corridor','door','elevator','stairs','ramp','bridge')),
  distance_m     NUMERIC(6,1) NOT NULL CHECK (distance_m >= 0),
  walk_seconds   INT NOT NULL CHECK (walk_seconds > 0),   -- น้ำหนักกราฟ · ลิฟต์ = เวลารอ+เดินทาง
  turn           VARCHAR(8) CHECK (turn IN ('left','right','straight','back')),
  instruction_th TEXT,
  instruction_en TEXT,
  is_accessible  BOOLEAN NOT NULL DEFAULT TRUE,           -- FALSE = บันได รถเข็นผ่านไม่ได้
  status         VARCHAR(6) NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  closed_reason  VARCHAR(120),
  UNIQUE (from_node_id, to_node_id),
  CHECK (from_node_id <> to_node_id)
);
CREATE INDEX idx_edges_from ON edges(from_node_id) WHERE status = 'open';

-- ========== แม่แบบขั้นตอน (M2) ==========

CREATE TABLE pathway_templates (
  id              SERIAL PRIMARY KEY,
  code            VARCHAR(20) NOT NULL UNIQUE,
  category        VARCHAR(20) NOT NULL,
  name_th         VARCHAR(100) NOT NULL,
  name_en         VARCHAR(100) NOT NULL,
  default_profile JSONB NOT NULL DEFAULT '{}',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE template_steps (
  id                 SERIAL PRIMARY KEY,
  template_id        INT NOT NULL REFERENCES pathway_templates(id) ON DELETE CASCADE,
  sequence           INT NOT NULL,
  service_point_id   INT NOT NULL REFERENCES nodes(id),
  name_th            VARCHAR(100) NOT NULL,
  name_en            VARCHAR(100) NOT NULL,
  deadline_time      TIME,
  deadline_reason_th VARCHAR(120),
  est_minutes        INT NOT NULL DEFAULT 10,
  wait_after_minutes INT NOT NULL DEFAULT 0,   -- เวลารอผลหลังทำขั้นนี้เสร็จ
  UNIQUE (template_id, sequence)
);

CREATE TABLE template_step_prereqs (
  step_id          INT NOT NULL REFERENCES template_steps(id) ON DELETE CASCADE,
  requires_step_id INT NOT NULL REFERENCES template_steps(id) ON DELETE CASCADE,
  PRIMARY KEY (step_id, requires_step_id),
  CHECK (step_id <> requires_step_id)
);

-- ========== ผู้ใช้ระบบ (M8) ==========

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,            -- bcrypt · ไม่ส่งออก API
  display_name  VARCHAR(100) NOT NULL,
  role          VARCHAR(10)  NOT NULL CHECK (role IN ('registrar','station','admin','executive')),
  department_id INT REFERENCES departments(id),   -- station เห็นเฉพาะแผนกนี้
  is_active     BOOLEAN NOT NULL DEFAULT TRUE
);

-- ========== ผู้ป่วยและการมาโรงพยาบาล (M3, M4) — ข้อมูลสมมุติทั้งหมด ==========

CREATE TABLE patients (
  id             SERIAL PRIMARY KEY,
  hn             VARCHAR(12) NOT NULL UNIQUE,
  display_name   VARCHAR(100) NOT NULL,
  preferred_lang CHAR(2) NOT NULL DEFAULT 'th'
);

CREATE TABLE visits (
  id                    SERIAL PRIMARY KEY,
  patient_id            INT NOT NULL REFERENCES patients(id),
  template_id           INT NOT NULL REFERENCES pathway_templates(id),
  visit_date            DATE NOT NULL,
  token                 CHAR(32) NOT NULL UNIQUE,   -- ลิงก์ในคิวอาร์ · crypto.randomBytes(16)
  short_code            CHAR(8)  NOT NULL UNIQUE,   -- 'A017-3K9' พิมพ์ใต้ QR ให้พิมพ์เองได้
  ticket_no             VARCHAR(8) NOT NULL,
  profile               JSONB NOT NULL DEFAULT '{}',  -- flag เช่น {"wheelchair":true,"elderly":true}
  lang                  CHAR(2) NOT NULL DEFAULT 'th',
  has_phone             BOOLEAN NOT NULL DEFAULT TRUE,
  companion_present     BOOLEAN NOT NULL DEFAULT FALSE,
  status                VARCHAR(10) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','completed','cancelled')),
  current_node_id       INT REFERENCES nodes(id),
  position_source       VARCHAR(8) CHECK (position_source IN ('station','qr','manual','poi','assumed')),
  position_confirmed_at TIMESTAMP,
  checked_in_at         TIMESTAMP NOT NULL DEFAULT now(),
  completed_at          TIMESTAMP,
  expires_at            TIMESTAMP NOT NULL          -- สิ้นวัน · เลยแล้ว token ใช้ไม่ได้
);
CREATE INDEX idx_visits_date ON visits(visit_date);

-- snapshot ของ template_steps โดยตั้งใจ: แก้แม่แบบทีหลังต้องไม่เปลี่ยนแผนของคนที่กำลังเดินอยู่
CREATE TABLE visit_steps (
  id                 SERIAL PRIMARY KEY,
  visit_id           INT NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  service_point_id   INT NOT NULL REFERENCES nodes(id),   -- ไม่ snapshot: ห้องย้ายต้องชี้ห้องใหม่
  sequence           NUMERIC(6,2) NOT NULL,               -- cache ของ topological sort
  name_th            VARCHAR(100) NOT NULL,
  name_en            VARCHAR(100) NOT NULL,
  status             VARCHAR(12) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','arrived','in_progress','done','skipped')),
  deadline_time      TIME,
  deadline_reason_th VARCHAR(120),
  est_minutes        INT NOT NULL,
  wait_after_minutes INT NOT NULL DEFAULT 0,
  origin             VARCHAR(8) NOT NULL DEFAULT 'template' CHECK (origin IN ('template','added')),
  added_by           INT REFERENCES users(id),
  skip_reason        VARCHAR(120),
  arrived_at         TIMESTAMP,
  called_at          TIMESTAMP,
  finished_at        TIMESTAMP   -- ทุก timestamp เซิร์ฟเวอร์ตั้งเท่านั้น
);
CREATE INDEX idx_vs_visit ON visit_steps(visit_id, sequence);
CREATE INDEX idx_vs_point ON visit_steps(service_point_id)
  WHERE status IN ('pending','arrived','in_progress');

CREATE TABLE visit_step_prereqs (
  step_id          INT NOT NULL REFERENCES visit_steps(id) ON DELETE CASCADE,
  requires_step_id INT NOT NULL REFERENCES visit_steps(id) ON DELETE CASCADE,
  PRIMARY KEY (step_id, requires_step_id),
  CHECK (step_id <> requires_step_id)
);

-- ========== audit · แจ้งเตือน (M8) ==========


CREATE TABLE audit_logs (
  id            BIGSERIAL PRIMARY KEY,
  actor_user_id INT REFERENCES users(id),
  actor_kind    VARCHAR(8) NOT NULL CHECK (actor_kind IN ('user','patient','system')),
  entity        VARCHAR(20) NOT NULL,
  entity_id     INT NOT NULL,
  action        VARCHAR(30) NOT NULL,
  from_status   VARCHAR(12),
  to_status     VARCHAR(12),
  detail        JSONB,
  created_at    TIMESTAMP NOT NULL DEFAULT now()  -- เวลาเซิร์ฟเวอร์จริงเสมอ ไม่ใช้นาฬิกาจำลอง
);
CREATE INDEX idx_audit_entity ON audit_logs(entity, entity_id);

CREATE TABLE notifications (
  id         SERIAL PRIMARY KEY,
  visit_id   INT NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  message_th TEXT NOT NULL,
  message_en TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  read_at    TIMESTAMP
);
CREATE INDEX idx_notif_unread ON notifications(visit_id) WHERE read_at IS NULL;

-- append-only: แอปเขียนได้อย่างเดียว แก้/ลบ audit ไม่ได้
DO $$ BEGIN
  EXECUTE format('REVOKE UPDATE, DELETE ON audit_logs FROM %I', current_user);
END $$;
