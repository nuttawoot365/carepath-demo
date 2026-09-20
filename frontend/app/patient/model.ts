/**
 * แปลงคำตอบของ API เป็นรูปแบบที่หน้าผู้ป่วยใช้ — ที่เดียวที่รู้จักรูปร่างของ API
 * หน้านี้ไม่เก็บแผนของผู้ป่วยไว้ในเครื่องเลย เก็บแค่ภาษาและรูปที่ผู้ใช้ถ่ายเอง
 */
import type { Leg as ApiLeg, StepStatus, Visit, VisitState, Warning } from '@/lib/types';

const TIME = new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit' });

/** ขั้นตอนหนึ่งขั้น พร้อมชื่อครบทุกภาษา (ภาษาอื่นถอยไปใช้อังกฤษ) */
export interface PatientStep {
  id: number;
  point: string;
  status: StepStatus;
  deadline: boolean;
  deadlineTime: string | null;
  deadlineReason: string | null;
  added: boolean;
  at: string | null;
  th: string;
  en: string;
  zh: string;
  my: string;
  ru: string;
  [lang: string]: string | number | boolean | null;
}

/** ช่วงเดินหนึ่งช่วงในรูปแบบของประโยคนำทางในหน้านี้ */
export interface WalkLeg {
  act: string;
  m: number;
  turn: string;
  to: string | null;
  arrive: string | null;
  side: string;
  name: string;
  dir?: 'up' | 'down';
  floor: number;
  building: string;
  hint?: string;
}

export interface PatientModel {
  visit: Visit;
  warnings: Warning[];
  at: string | null;
  atSource: 'station' | 'manual';
  nextId: number | null;
  steps: PatientStep[];
  route: WalkLeg[];
}

export function toModel(data: VisitState): PatientModel {
  return {
    visit: data.visit,
    warnings: data.warnings ?? [],
    at: data.visit.at?.code ?? null,
    atSource: data.visit.at?.source === 'station' ? 'station' : 'manual',
    nextId: data.next_step_id,
    steps: data.steps.map((step) => {
      const en = step.name_en || step.name_th;
      return {
        id: step.id,
        point: step.point.code,
        status: step.status,
        deadline: Boolean(step.deadline_time),
        deadlineTime: step.deadline_time,
        deadlineReason: step.deadline_reason_th,
        added: step.origin === 'added',
        at: step.finished_at ? TIME.format(new Date(step.finished_at)) : null,
        th: step.name_th, en, zh: en, my: en, ru: en,
      };
    }),
    route: (data.route?.legs ?? []).map(toWalkLeg),
  };
}

const toWalkLeg = (leg: ApiLeg): WalkLeg => ({
  act: leg.act,
  m: Math.round(leg.m),
  turn: leg.turn ?? 'straight',
  to: leg.arrive ? null : leg.to,
  arrive: leg.arrive ?? null,
  side: leg.side ?? 'ahead',
  name: leg.to,
  dir: leg.dir,
  floor: leg.floor,
  building: leg.building,
});

/** ลายนิ้วมือของสถานะ — ใช้บอกว่ามีอะไรเปลี่ยนจริงไหม ก่อนจะสั่นและแจ้งผู้ป่วย */
export const fingerprint = (data: VisitState): string =>
  JSON.stringify([
    data.next_step_id,
    data.visit.at?.code,
    data.steps.map((step) => [step.id, step.status]),
    data.route?.distance_m ?? null,
  ]);

/** ขั้นถัดไป — API เป็นคนเลือก หน้าจอแค่หยิบมาแสดง */
export const nextStepOf = (model: PatientModel | null): PatientStep | null =>
  model?.steps.find((step) => step.id === model.nextId) ??
  model?.steps.find((step) => step.status === 'pending') ??
  null;

export const routeTotals = (route: WalkLeg[]) => {
  const m = route.reduce((sum, leg) => sum + leg.m, 0);
  return { m: Math.round(m), min: Math.max(1, Math.round(m / 60 + route.length * 0.35)) };
};
