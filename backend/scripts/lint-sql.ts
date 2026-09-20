#!/usr/bin/env ts-node
/**
 * กันการต่อสตริงเข้า SQL: ข้อความ template literal ที่หน้าตาเป็นคำสั่ง SQL ต้องไม่มี ${...}
 * ทุก query ต้องส่งค่าผ่าน parameter ($1, $2, …) เท่านั้น
 *   npm run lint:sql
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const roots = [path.resolve(__dirname, '..', 'src'), path.resolve(__dirname, '..', 'scripts')];

const TEMPLATE_LITERAL = /`[^`]*`/gs;
const SQL_STATEMENT = /\b(SELECT\s+[\w*]|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b/i;
const INTERPOLATION = /\$\{/;
const ALLOW = 'lint-sql-allow';

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.name.endsWith('.ts')) yield full;
  }
}

async function main() {
  const offences: string[] = [];
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
    console.error('พบ SQL ที่ต่อสตริง — ให้ใช้ parameter แทน:');
    for (const offence of offences) console.error(`  ${offence}`);
    process.exitCode = 1;
    return;
  }
  console.log('lint:sql ผ่าน — ไม่มี SQL ที่ต่อสตริง');
}

void main();
