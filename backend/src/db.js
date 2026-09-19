import pg from 'pg';
import { config } from './config.js';

// อ่าน DATE/TIME เป็นสตริงตรง ๆ ไม่ให้ไดรเวอร์แปลงตามโซนเวลาเครื่อง
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);
pg.types.setTypeParser(pg.types.builtins.TIME, (value) => value);
pg.types.setTypeParser(pg.types.builtins.NUMERIC, Number);

let pool = null;

/** สร้าง pool ตอนใช้งานจริง — โมดูลโดเมนจึง import ได้โดยไม่ต้องมีฐานข้อมูล (unit test) */
export function getPool() {
  pool ??= new pg.Pool({ connectionString: config.requireDatabaseUrl(), max: 10 });
  return pool;
}

/** ทุก query ผ่านทางนี้เท่านั้น — parameterized เสมอ ห้ามต่อสตริง SQL */
export const query = (text, params) => getPool().query(text, params);

/** รัน callback ในทรานแซกชันเดียว · โยน error = ROLLBACK */
export async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export const closePool = async () => {
  await pool?.end();
  pool = null;
};
