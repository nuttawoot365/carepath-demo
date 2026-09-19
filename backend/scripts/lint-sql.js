#!/usr/bin/env node
/**
 * กันการต่อสตริงเข้า SQL: ข้อความ template literal ที่หน้าตาเป็นคำสั่ง SQL ต้องไม่มี ${...}
 * ทุก query ต้องส่งค่าผ่าน parameter ($1, $2, …) เท่านั้น
 *   npm run lint:sql
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const roots = [path.join(here, '..', 'src'), path.join(here, '..', 'scripts')];

const TEMPLATE_LITERAL = /`[^`]*`/gs;
const SQL_STATEMENT = /\b(SELECT\s+[\w*]|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b/i;
const INTERPOLATION = /\$\{/;
const ALLOW = 'lint-sql-allow';

async function* walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.name.endsWith('.js')) yield full;
  }
}

const offences = [];
for (const root of roots) {
  for await (const file of walk(root)) {
    const source = await fs.readFile(file, 'utf8');

    for (const [literal] of source.matchAll(TEMPLATE_LITERAL)) {
      if (!SQL_STATEMENT.test(literal) || !INTERPOLATION.test(literal) || literal.includes(ALLOW)) continue;
      const line = source.slice(0, source.indexOf(literal)).split('\n').length;
      offences.push(`${path.relative(process.cwd(), file)}:${line}`);
    }
  }
}

if (offences.length > 0) {
  console.error(`พบการต่อสตริงใน SQL:\n${offences.join('\n')}`);
  process.exit(1);
}
console.log('lint:sql ผ่าน — ทุก query เป็น parameterized');
