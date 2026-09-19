import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readySteps, planNextStep, topologicalOrder, previousStatusesFor, ALLOWED_TRANSITIONS } from '../src/domain/pathway.js';

const step = (id, point, extra = {}) =>
  ({ id, service_point_id: point, sequence: id, status: 'pending', est_minutes: 10, wait_after_minutes: 0, requires: [], ...extra });

test('ขั้นที่เงื่อนไขยังไม่ครบ ไม่ถือว่าพร้อมทำ', () => {
  const steps = [step(1, 10), step(2, 20, { requires: [1] })];
  assert.deepEqual(readySteps(steps).map((s) => s.id), [1]);
});

test('ขั้นที่เงื่อนไขครบแล้วถือว่าพร้อม รวมถึงกรณีขั้นก่อนหน้าถูกข้าม', () => {
  const steps = [step(1, 10, { status: 'skipped' }), step(2, 20, { requires: [1] })];
  assert.deepEqual(readySteps(steps).map((s) => s.id), [2]);
});

test('ไม่มีกำหนดเวลา ระบบเลือกขั้นที่เดินใกล้ที่สุด', () => {
  const steps = [step(1, 10), step(2, 20)];
  const walk = new Map([[10, 600], [20, 60]]);
  const { next } = planNextStep(steps, walk, 9 * 60);
  assert.equal(next.step.id, 2);
});

test('ใกล้หมดเวลา ระบบยกขั้นที่มีกำหนดขึ้นก่อนแม้จะเดินไกลกว่า', () => {
  const steps = [step(1, 10), step(2, 20, { deadline_time: '11:00' })];
  const walk = new Map([[10, 60], [20, 600]]);
  const { next } = planNextStep(steps, walk, 10 * 60 + 40);
  assert.equal(next.step.id, 2, 'ขั้นที่มีกำหนดเวลาต้องมาก่อน');
  assert.equal(next.urgent, true);
});

test('จุดที่ไปไม่ถึงถูกตัดออกและแจ้งเตือน no_route', () => {
  const steps = [step(1, 10), step(2, 20)];
  const walk = new Map([[20, 60]]);           // ไม่มีเส้นทางไปจุด 10
  const { next, warnings } = planNextStep(steps, walk, 9 * 60);
  assert.equal(next.step.id, 2);
  assert.ok(warnings.some((w) => w.code === 'no_route' && w.step_id === 1));
});

test('เรียงลำดับตามเงื่อนไข ขั้นที่ต้องทำก่อนมาก่อนเสมอ', () => {
  const steps = [
    step(5, 50, { requires: [3, 4] }),
    step(3, 30, { requires: [1] }),
    step(4, 40, { requires: [3] }),
    step(1, 10),
  ];
  const order = topologicalOrder(steps).map((s) => s.id);
  assert.deepEqual(order, [1, 3, 4, 5]);
});

test('เงื่อนไขที่วนกลับมาหากันเอง ถูกปฏิเสธด้วย PREREQ_CYCLE', () => {
  const steps = [step(1, 10, { requires: [2] }), step(2, 20, { requires: [1] })];
  assert.throws(() => topologicalOrder(steps), (error) => error.code === 'PREREQ_CYCLE');
});

test('สถานะเดินหน้าได้ทีละขั้นเท่านั้น', () => {
  assert.deepEqual(ALLOWED_TRANSITIONS.pending, ['arrived', 'skipped']);
  assert.deepEqual(ALLOWED_TRANSITIONS.done, []);
  assert.deepEqual(previousStatusesFor('done'), ['in_progress']);
  assert.deepEqual(previousStatusesFor('skipped').sort(), ['arrived', 'pending']);
});
