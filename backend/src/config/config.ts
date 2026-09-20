/**
 * ค่าตั้งของระบบทั้งหมดอ่านจาก environment ที่เดียว
 * ฉีดเข้า service ด้วย token CONFIG เพื่อให้เขียนเทสต์แทนค่าได้
 */
import path from 'node:path';
import type { JwtSignOptions } from '@nestjs/jwt';

export interface AppConfig {
  env: string;
  port: number;
  jwtSecret: string;
  /** อายุ token — รูปแบบเดียวกับที่ @nestjs/jwt รับ เช่น '12h' */
  jwtTtl: JwtSignOptions['expiresIn'];
  publicBaseUrl: string;
  /** นาฬิกาจำลองและ endpoint รีเซ็ตเปิดเฉพาะโหมดเดโม */
  isDemo: boolean;
  /** โฟลเดอร์ CSV ที่ใช้ตอน reset · docker ตั้ง DATA_DIR=/data */
  dataDir: string;
  schemaFile: string;
}

export const CONFIG = Symbol('CONFIG');

export function loadConfig(): AppConfig {
  const env = process.env.NODE_ENV ?? 'development';
  return {
    env,
    port: Number(process.env.PORT ?? 3000),
    jwtSecret: process.env.JWT_SECRET ?? 'dev-secret',
    jwtTtl: '12h',
    publicBaseUrl: process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000',
    isDemo: env === 'demo',
    dataDir: process.env.DATA_DIR ?? path.resolve(process.cwd(), '..', 'data'),
    schemaFile: process.env.SCHEMA_FILE ?? path.resolve(process.cwd(), 'sql', 'schema.sql'),
  };
}

export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('missing env DATABASE_URL');
  return url;
}
