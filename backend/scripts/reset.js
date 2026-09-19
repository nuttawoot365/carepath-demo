#!/usr/bin/env node
/**
 * ล้างและสร้างฐานข้อมูลใหม่จาก sql/schema.sql แล้วนำเข้า CSV ทั้งชุด
 *   npm run reset
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { closePool, withTransaction } from '../src/db.js';
import { parseCsv } from '../src/lib/csv.js';
import { importAll } from '../src/domain/seed.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaFile = path.join(here, '..', 'sql', 'schema.sql');
const dataDir = process.env.DATA_DIR ?? path.join(here, '..', '..', 'data');

const FILES = ['nodes', 'edges', 'departments', 'templates', 'pathways', 'users', 'patients'];

const readCsv = async (name) => parseCsv(await fs.readFile(path.join(dataDir, `${name}.csv`), 'utf8'));

async function main() {
  const schema = await fs.readFile(schemaFile, 'utf8');
  const files = Object.fromEntries(
    await Promise.all(FILES.map(async (name) => [name, await readCsv(name)])),
  );

  const summary = await withTransaction(async (client) => {
    await client.query(schema);
    return importAll(client, files);
  });

  console.log('reset เรียบร้อย', summary);
}

try {
  await main();
} catch (error) {
  console.error('reset ล้มเหลว:', error.message);
  process.exitCode = 1;
} finally {
  await closePool();
}
