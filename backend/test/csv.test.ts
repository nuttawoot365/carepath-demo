import { parseCsv, csvBool, csvOrNull, csvNumberOrNull } from '../src/common/csv';

it('อ่าน CSV ธรรมดาเป็นอ็อบเจกต์ตามหัวคอลัมน์', () => {
  expect(parseCsv('a,b\n1,2')).toEqual([{ a: '1', b: '2' }]);
});

it('ค่าที่มีเครื่องหมายคำพูดและจุลภาคข้างในไม่ถูกตัด', () => {
  expect(parseCsv('a,b\n1,"x,y"')).toEqual([{ a: '1', b: 'x,y' }]);
});

it('เครื่องหมายคำพูดซ้อนถูกแปลงกลับถูกต้อง', () => {
  expect(parseCsv('a\n"he said ""hi"""')).toEqual([{ a: 'he said "hi"' }]);
});

it('บรรทัดว่างถูกข้าม และไฟล์ว่างคืนอาร์เรย์ว่าง', () => {
  expect(parseCsv('a,b\n\n1,2\n')).toEqual([{ a: '1', b: '2' }]);
  expect(parseCsv('')).toEqual([]);
});

it('ตัวช่วยแปลงค่าทำงานตามที่ไฟล์นำเข้าต้องการ', () => {
  expect(csvBool('1')).toBe(true);
  expect(csvBool('0')).toBe(false);
  expect(csvOrNull('')).toBeNull();
  expect(csvNumberOrNull('')).toBeNull();
  expect(csvNumberOrNull('50')).toBe(50);
});
