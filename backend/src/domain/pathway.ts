import { unprocessable } from '../common/errors';
import type { PlannableStep, StepStatus } from './types';

const OPEN_STATUSES = new Set<StepStatus>(['pending', 'arrived']);
const SATISFIED_STATUSES = new Set<StepStatus | undefined>(['done', 'skipped']);

/** เตือนล่วงหน้าเท่านี้ก่อนถึงกำหนด ถือว่า "ต้องรีบไปก่อน" */
const DEADLINE_MARGIN_MINUTES = 20;

export type Warning =
  | { code: 'no_route'; step_id: number }
  | { code: 'deadline_soon'; step_id: number; minutes_left: number };

export interface Candidate<S extends PlannableStep> {
  step: S;
  walk: number | null;
  deadline: number | null;
  urgent: boolean;
}

/** ขั้นที่ทำได้ตอนนี้ — ยังไม่เสร็จ และขั้นที่ต้องทำก่อนเสร็จหมดแล้ว */
export function readySteps<S extends PlannableStep>(steps: S[]): S[] {
  const statusById = new Map(steps.map((step) => [step.id, step.status]));

  return steps.filter(
    (step) =>
      OPEN_STATUSES.has(step.status) &&
      step.requires.every((requiredId) => SATISFIED_STATUSES.has(statusById.get(requiredId))),
  );
}

/**
 * เลือกขั้นถัดไปและสร้างคำเตือน
 * @param steps ขั้นทั้งหมดของ visit (มี requires: number[])
 * @param walkSeconds Map: service_point_id → วินาทีจากตำแหน่งปัจจุบัน (ไม่มีคีย์ = ไปไม่ถึง)
 * @param nowMinutes นาทีนับจากเที่ยงคืน (นาฬิกาจำลองได้)
 */
export function planNextStep<S extends PlannableStep>(
  steps: S[],
  walkSeconds: Map<number, number>,
  nowMinutes: number,
): { next: Candidate<S> | null; ready: S[]; warnings: Warning[] } {
  const ready = readySteps(steps);
  const warnings: Warning[] = [];

  const candidates: Candidate<S>[] = ready.map((step) => {
    const walk = walkSeconds.get(step.service_point_id) ?? null;
    const deadline = toMinutes(step.deadline_time);
    const finishAt =
      walk === null ? null : nowMinutes + walk / 60 + step.est_minutes + step.wait_after_minutes;
    const urgent =
      deadline !== null && finishAt !== null && finishAt > deadline - DEADLINE_MARGIN_MINUTES;

    if (walk === null) {
      warnings.push({ code: 'no_route', step_id: step.id });
    } else if (urgent) {
      warnings.push({
        code: 'deadline_soon',
        step_id: step.id,
        minutes_left: Math.max(0, Math.round(deadline! - nowMinutes)),
      });
    }
    return { step, walk, deadline, urgent };
  });

  const reachable = candidates.filter((candidate) => candidate.walk !== null);
  const urgent = reachable.filter((candidate) => candidate.urgent);

  const chosen =
    urgent.sort((a, b) => a.deadline! - b.deadline!)[0] ??
    reachable.sort((a, b) => a.walk! - b.walk! || a.step.sequence - b.step.sequence)[0] ??
    null;

  return { next: chosen ?? null, ready, warnings };
}

export interface OrderableStep {
  id: number;
  sequence: number;
  requires: number[];
}

/**
 * เรียงลำดับขั้นตามเงื่อนไข prereq (Kahn) — ใช้หลังแทรกขั้นใหม่
 * ลำดับเดิมเป็นตัวตัดสินเมื่อเลือกได้หลายขั้น ผลจึงคงที่
 * @throws ApiError 422 PREREQ_CYCLE เมื่อเงื่อนไขวนกลับมาหากันเอง
 */
export function topologicalOrder<S extends OrderableStep>(steps: S[]): S[] {
  const byId = new Map(steps.map((step) => [step.id, step]));
  const remaining = new Map(
    steps.map((step) => [step.id, step.requires.filter((id) => byId.has(id)).length]),
  );
  const dependents = new Map<number, number[]>(steps.map((step) => [step.id, []]));

  for (const step of steps) {
    for (const requiredId of step.requires) {
      dependents.get(requiredId)?.push(step.id);
    }
  }

  const ordered: S[] = [];
  const available = steps.filter((step) => remaining.get(step.id) === 0).map((step) => step.id);

  while (available.length > 0) {
    available.sort((a, b) => byId.get(a)!.sequence - byId.get(b)!.sequence || a - b);
    const id = available.shift()!;
    ordered.push(byId.get(id)!);

    for (const dependentId of dependents.get(id) ?? []) {
      const left = remaining.get(dependentId)! - 1;
      remaining.set(dependentId, left);
      if (left === 0) available.push(dependentId);
    }
  }

  if (ordered.length !== steps.length) {
    throw unprocessable(
      'PREREQ_CYCLE',
      'ลำดับขั้นตอนวนกลับมาหากันเอง แทรกขั้นนี้ไม่ได้',
      'The step order would form a cycle; this step cannot be inserted',
    );
  }
  return ordered;
}

/** สถานะถัดไปที่ยอมรับได้ — บังคับที่ API ไม่ใช่ที่หน้าจอ */
export const ALLOWED_TRANSITIONS: Record<StepStatus, StepStatus[]> = {
  pending: ['arrived', 'skipped'],
  arrived: ['in_progress', 'skipped'],
  in_progress: ['done'],
  done: [],
  skipped: [],
};

export const TIMESTAMP_COLUMN: Partial<Record<StepStatus, string>> = {
  arrived: 'arrived_at',
  in_progress: 'called_at',
  done: 'finished_at',
};

/** สถานะก่อนหน้าที่อนุญาตให้เปลี่ยนมาเป็น target ได้ */
export const previousStatusesFor = (target: StepStatus): StepStatus[] =>
  (Object.entries(ALLOWED_TRANSITIONS) as [StepStatus, StepStatus[]][])
    .filter(([, nextStatuses]) => nextStatuses.includes(target))
    .map(([status]) => status);

const toMinutes = (time: string | null | undefined): number | null => {
  if (!time) return null;
  const [hours, minutes] = String(time).split(':');
  return Number(hours) * 60 + Number(minutes);
};
