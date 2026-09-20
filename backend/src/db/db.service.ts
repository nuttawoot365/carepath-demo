import { Injectable, OnModuleDestroy } from '@nestjs/common';
import pg from 'pg';
import { requireDatabaseUrl } from '../config/config';

// อ่าน DATE/TIME เป็นสตริงตรง ๆ ไม่ให้ไดรเวอร์แปลงตามโซนเวลาเครื่อง
pg.types.setTypeParser(pg.types.builtins.DATE, (value: string) => value);
pg.types.setTypeParser(pg.types.builtins.TIME, (value: string) => value);
pg.types.setTypeParser(pg.types.builtins.NUMERIC, Number);

/** ทุกที่ที่ยิง SQL รับตัวนี้ — ใช้ได้ทั้ง pool และ client ในทรานแซกชัน */
export interface Executor {
  query<R extends pg.QueryResultRow = any>(
    text: string,
    params?: readonly unknown[],
  ): Promise<pg.QueryResult<R>>;
}

@Injectable()
export class DbService implements Executor, OnModuleDestroy {
  private pool: pg.Pool | null = null;

  /** สร้าง pool ตอนใช้งานจริง — โมดูลโดเมนจึงทดสอบได้โดยไม่ต้องมีฐานข้อมูล */
  getPool(): pg.Pool {
    this.pool ??= new pg.Pool({ connectionString: requireDatabaseUrl(), max: 10 });
    return this.pool;
  }

  /** ทุก query ผ่านทางนี้เท่านั้น — parameterized เสมอ ห้ามต่อสตริง SQL */
  query<R extends pg.QueryResultRow = any>(text: string, params?: readonly unknown[]) {
    return this.getPool().query<R>(text, params as unknown[]);
  }

  /** รัน callback ในทรานแซกชันเดียว · โยน error = ROLLBACK */
  async withTransaction<T>(fn: (client: Executor) => Promise<T>): Promise<T> {
    const client = await this.getPool().connect();
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

  async close(): Promise<void> {
    await this.pool?.end();
    this.pool = null;
  }

  onModuleDestroy() {
    return this.close();
  }
}
