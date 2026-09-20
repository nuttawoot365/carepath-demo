/**
 * CSV เล็ก ๆ ที่พอสำหรับไฟล์นำเข้าของโครงการ — รองรับเครื่องหมายคำพูดและ "" ภายในค่า
 * คืนอาร์เรย์ของอ็อบเจกต์ที่ใช้บรรทัดแรกเป็นชื่อคอลัมน์ · ค่าว่างเป็น ''
 */
export type CsvRow = Record<string, string>;

export function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  const endField = () => { row.push(field); field = ''; };
  const endRow = () => { endField(); rows.push(row); row = []; };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (quoted) {
      if (char !== '"') field += char;
      else if (text[i + 1] === '"') { field += '"'; i += 1; }
      else quoted = false;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ',') endField();
    else if (char === '\n') endRow();
    else if (char !== '\r') field += char;
  }
  if (field !== '' || row.length > 0) endRow();

  const [header, ...body] = rows.filter((cells) => cells.some((cell) => cell !== ''));
  if (!header) return [];

  return body.map((cells) =>
    Object.fromEntries(header.map((name, index) => [name.trim(), (cells[index] ?? '').trim()])),
  );
}

export const csvBool = (value: string) => value === '1' || value.toLowerCase() === 'true';
export const csvOrNull = (value: string) => (value === '' ? null : value);
export const csvNumberOrNull = (value: string) => (value === '' ? null : Number(value));
