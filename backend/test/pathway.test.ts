import {
  readySteps, planNextStep, topologicalOrder, previousStatusesFor, ALLOWED_TRANSITIONS,
} from '../src/domain/pathway';
import { ApiError } from '../src/common/errors';
import type { PlannableStep } from '../src/domain/types';

const step = (id: number, point: number, extra: Partial<PlannableStep> = {}): PlannableStep => ({
  id, service_point_id: point, sequence: id, status: 'pending',
  est_minutes: 10, wait_after_minutes: 0, requires: [], ...extra,
});

it('ขั้นที่เงื่อนไขยังไม่ครบ ไม่ถือว่าพร้อมทำ', () => {
  const steps = [step(1, 10), step(2, 20, { requires: [1] })];
  expect(readySteps(steps).map((s) => s.id)).toEqual([1]);
});

it('ขั้นที่เงื่อนไขครบแล้วถือว่าพร้อม รวมถึงกรณีขั้นก่อนหน้าถูกข้าม', () => {
  const steps = [step(1, 10, { status: 'skipped' }), step(2, 20, { requires: [1] })];
  expect(readySteps(steps).map((s) => s.id)).toEqual([2]);
});

it('ไม่มีกำหนดเวลา ระบบเลือกขั้นที่เดินใกล้ที่สุด', () => {
  const steps = [step(1, 10), step(2, 20)];
  const walk = new Map([[10, 600], [20, 60]]);
  expect(planNextStep(steps, walk, 9 * 60).next!.step.id).toBe(2);
});

it('ใกล้หมดเวลา ระบบยกขั้นที่มีกำหนดขึ้นก่อนแม้จะเดินไกลกว่า', () => {
  const steps = [step(1, 10), step(2, 20, { deadline_time: '11:00' })];
  const walk = new Map([[10, 60], [20, 600]]);
  const { next } = planNextStep(steps, walk, 10 * 60 + 40);
  expect(next!.step.id).toBe(2); // ขั้นที่มีกำหนดเวลาต้องมาก่อน
  expect(next!.urgent).toBe(true);
});

it('จุดที่ไปไม่ถึงถูกตัดออกและแจ้งเตือน no_route', () => {
  const steps = [step(1, 10), step(2, 20)];
  const walk = new Map([[20, 60]]);           // ไม่มีเส้นทางไปจุด 10
  const { next, warnings } = planNextStep(steps, walk, 9 * 60);
  expect(next!.step.id).toBe(2);
  expect(warnings).toContainEqual({ code: 'no_route', step_id: 1 });
});

it('เรียงลำดับตามเงื่อนไข ขั้นที่ต้องทำก่อนมาก่อนเสมอ', () => {
  const steps = [
    step(5, 50, { requires: [3, 4] }),
    step(3, 30, { requires: [1] }),
    step(4, 40, { requires: [3] }),
    step(1, 10),
  ];
  expect(topologicalOrder(steps).map((s) => s.id)).toEqual([1, 3, 4, 5]);
});

it('เงื่อนไขที่วนกลับมาหากันเอง ถูกปฏิเสธด้วย PREREQ_CYCLE', () => {
  const steps = [step(1, 10, { requires: [2] }), step(2, 20, { requires: [1] })];
  expect(() => topologicalOrder(steps)).toThrow(
    expect.objectContaining({ code: 'PREREQ_CYCLE' }) as unknown as Error,
  );
  try {
    topologicalOrder(steps);
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).getStatus()).toBe(422);
  }
});

it('สถานะเดินหน้าได้ทีละขั้นเท่านั้น', () => {
  expect(ALLOWED_TRANSITIONS.pending).toEqual(['arrived', 'skipped']);
  expect(ALLOWED_TRANSITIONS.done).toEqual([]);
  expect(previousStatusesFor('done')).toEqual(['in_progress']);
  expect(previousStatusesFor('skipped').sort()).toEqual(['arrived', 'pending']);
});
