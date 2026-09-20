/**
 * CSV เล็ก ๆ สำหรับสคริปต์ที่รันด้วย node ตรง ๆ (app/build.mjs)
 * ตรรกะเดียวกับ backend/src/common/csv.ts — ที่นี่เป็น ESM ล้วนจึงไม่ต้องคอมไพล์ก่อนใช้
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
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

export const csvBool = (value) => value === '1' || value.toLowerCase() === 'true';
export const csvOrNull = (value) => (value === '' ? null : value);
export const csvNumberOrNull = (value) => (value === '' ? null : Number(value));
