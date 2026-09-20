import fs from 'node:fs';
import path from 'node:path';
import { parseCsv } from '../src/common/csv';
import { checkImport, IMPORT_NAMES, type ImportFiles } from '../src/domain/import-check';

const dir = path.resolve(__dirname, '..', '..', 'data');
const read = (name: string) => {
  try { return parseCsv(fs.readFileSync(path.join(dir, `${name}.csv`), 'utf8')); } catch { return []; }
};
const files: ImportFiles = Object.fromEntries(IMPORT_NAMES.map((n) => [n, read(n)]));

const r = checkImport(files);
console.log('  ไฟล์จริงของโครงการ → ok =', r.ok);
console.log('  จำนวนแถว:', JSON.stringify(r.counts));
console.log('  ปัญหา:', r.problems.length, '· เตือน:', r.warnings.length);
r.problems.slice(0, 6).forEach((p) => console.log('    ✗', p.file, p.line ?? '-', p.message));
r.warnings.slice(0, 4).forEach((p) => console.log('    ⚠', p.file, p.line ?? '-', p.message));
