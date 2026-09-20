/** รูปข้อมูลที่ /api ตอบกลับ — ตรงกับ publicVisit/publicStep ของฝั่ง Nest */

export type Role = 'admin' | 'registrar' | 'station' | 'executive';

export interface User {
  id: number;
  username: string;
  display_name: string;
  role: Role;
  department_code: string | null;
  department_th: string | null;
}

export interface Session {
  token: string;
  user: User;
}

export type StepStatus = 'pending' | 'arrived' | 'in_progress' | 'done' | 'skipped';

export interface PatientProfile {
  wheelchair?: true;
  elderly?: true;
  low_vision?: true;
  needs_companion?: true;
}

export interface Place {
  code: string;
  name_th: string | null;
  name_en: string | null;
  icon: string | null;
  building: string;
  floor: number;
  department: string | null;
}

export interface Step {
  id: number;
  sequence: number;
  name_th: string;
  name_en: string;
  status: StepStatus;
  point: Place;
  deadline_time: string | null;
  deadline_reason_th: string | null;
  est_minutes: number;
  wait_after_minutes: number;
  origin: string;
  requires: number[];
  arrived_at: string | null;
  called_at: string | null;
  finished_at: string | null;
}

export interface Visit {
  id: number;
  ticket_no: string;
  short_code: string;
  token: string;
  status: string;
  lang: string;
  profile: PatientProfile;
  has_phone: boolean;
  companion_present: boolean;
  patient_name: string;
  template: { code: string; name_th: string; name_en: string };
  at: (Omit<Place, 'department'> & { source: string | null; confirmed_at: string | null }) | null;
  checked_in_at: string;
  completed_at: string | null;
}

export interface Leg {
  act: string;
  m: number;
  seconds: number;
  to: string;
  to_th: string | null;
  to_en: string | null;
  icon: string | null;
  building: string;
  floor: number;
  landmark_th: string | null;
  landmark_en: string | null;
  text_th: string | null;
  text_en: string | null;
  turn?: string;
  arrive?: string;
  side?: string;
  name_th?: string | null;
  name_en?: string | null;
  dir?: 'up' | 'down';
}

export interface Instruction {
  n: number;
  kind: string;
  arrow: string;
  icon: string | null;
  distance_m: number;
  seconds: number;
  building: string;
  floor: number;
  to: string;
  text_th: string;
  text_en: string;
}

export interface Route {
  to: string;
  seconds: number;
  distance_m: number;
  legs: Leg[];
  instructions: Instruction[];
}

export type Warning =
  | { code: 'no_route'; step_id: number }
  | { code: 'deadline_soon'; step_id: number; minutes_left: number };

export interface Notification {
  id: number;
  message_th: string;
  message_en: string;
  created_at: string;
  read_at: string | null;
}

/** สถานะเต็มของการมาหนึ่งครั้ง — คำตอบของ /p/:token, /visits/:id และทุก endpoint ที่เปลี่ยนข้อมูล */
export interface VisitState {
  visit: Visit;
  steps: Step[];
  next_step_id: number | null;
  ready_step_ids: number[];
  route: Route | null;
  warnings: Warning[];
  notifications: Notification[];
  server_time: string;
}

export interface TemplateStep {
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

export interface Template {
  code: string;
  category: string;
  name_th: string;
  name_en: string;
  steps: TemplateStep[];
}

export interface Patient {
  hn: string;
  display_name: string;
  preferred_lang: string;
  last_visit: string | null;
}

export interface Station {
  code: string;
  name_th: string;
  name_en: string;
  color: string | null;
  points: string[];
  staff: string | null;
}

export interface QueueItem {
  id: number;
  status: StepStatus;
  name_th: string;
  name_en: string;
  point: string;
  point_th: string;
  deadline_time: string | null;
  deadline_reason_th: string | null;
  origin: string;
  arrived_at: string | null;
  called_at: string | null;
  ready: boolean;
  walk_seconds: number | null;
  visit: {
    id: number;
    ticket_no: string;
    patient_name: string;
    profile: PatientProfile;
    lang: string;
    companion_present: boolean;
  };
}

export interface MapNode {
  id: number;
  code: string;
  kind: string;
  name_th: string | null;
  name_en: string | null;
  landmark_th: string | null;
  landmark_en: string | null;
  icon: string | null;
  has_qr: boolean;
  department: string | null;
  floor: number;
  building: string;
}
