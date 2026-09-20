import type { PatientProfile } from '../common/validate';

export interface GraphNode {
  id: number;
  code: string;
  kind: string;
  name_th: string | null;
  name_en: string | null;
  landmark_th: string | null;
  landmark_en: string | null;
  icon: string | null;
  qr_token?: string | null;
  department_id: number | null;
  floor: number;
  building: string;
  [key: string]: unknown;
}

export interface GraphEdge {
  id: number | string;
  from_node_id: number;
  to_node_id: number;
  kind: string;
  distance_m: number;
  walk_seconds: number;
  turn: string | null;
  instruction_th?: string | null;
  instruction_en?: string | null;
  is_accessible: boolean;
  [key: string]: unknown;
}

export interface Graph {
  nodes: Map<number, GraphNode>;
  byCode: Map<string, GraphNode>;
  adjacency: Map<number, GraphEdge[]>;
}

export type EdgeCost = (edge: GraphEdge) => number;

export type StepStatus = 'pending' | 'arrived' | 'in_progress' | 'done' | 'skipped';

/** ขั้นตอนของ visit เท่าที่ตรรกะการวางแผนต้องใช้ */
export interface PlannableStep {
  id: number;
  service_point_id: number;
  sequence: number;
  status: StepStatus;
  est_minutes: number;
  wait_after_minutes: number;
  deadline_time?: string | null;
  requires: number[];
}

export interface StepRow extends PlannableStep {
  visit_id: number;
  name_th: string;
  name_en: string;
  deadline_reason_th: string | null;
  origin: string;
  skip_reason: string | null;
  arrived_at: string | null;
  called_at: string | null;
  finished_at: string | null;
  point_code: string;
  point_th: string | null;
  point_en: string | null;
  point_icon: string | null;
  dept_code: string | null;
  floor: number;
  building: string;
}

export interface VisitRow {
  id: number;
  token: string;
  short_code: string;
  ticket_no: string;
  visit_date: string;
  profile: PatientProfile;
  lang: string;
  has_phone: boolean;
  companion_present: boolean;
  status: string;
  current_node_id: number | null;
  position_source: string | null;
  position_confirmed_at: string | null;
  checked_in_at: string;
  completed_at: string | null;
  expires_at: string;
  hn: string;
  patient_name: string;
  template_code: string;
  template_th: string;
  template_en: string;
  at_code: string | null;
  at_th: string | null;
  at_en: string | null;
  at_icon: string | null;
  at_floor: number | null;
  at_building: string | null;
}
