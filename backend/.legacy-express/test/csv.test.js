import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, csvBool, csvOrNull, csvNumberOrNull } from '../src/lib/csv.js';

test('อ่าน CSV ธรรมดาเป็นอ็อบเจกต์ตามหัวคอลัมน์', () => {
  assert.deepEqual(parseCsv('a,b\n1,2'), [{ a: '1', b: '2' }]);
});

test('ค่าที่มีเครื่องหมายคำพูดและจุลภาคข้างในไม่ถูกตัด', () => {
  assert.deepEqual(parseCsv('a,b\n1,"x,y"'), [{ a: '1', b: 'x,y' }]);
});

test('เครื่องหมายคำพูดซ้อนถูกแปลงกลับถูกต้อง', () => {
  assert.deepEqual(parseCsv('a\n"he said ""hi"""'), [{ a: 'he said "hi"' }]);
});

test('บรรทัดว่างถูกข้าม และไฟล์ว่างคืนอาร์เรย์ว่าง', () => {
  assert.deepEqual(parseCsv('a,b\n\n1,2\n'), [{ a: '1', b: '2' }]);
  assert.deepEqual(parseCsv(''), []);
});

test('ตัวช่วยแปลงค่าทำงานตามที่ไฟล์นำเข้าต้องการ', () => {
  assert.equal(csvBool('1'), true);
  assert.equal(csvBool('0'), false);
  assert.equal(csvOrNull(''), null);
  assert.equal(csvNumberOrNull(''), null);
  assert.equal(csvNumberOrNull('50'), 50);
});
