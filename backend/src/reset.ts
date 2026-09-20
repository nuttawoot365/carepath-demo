/**
 * ล้างและสร้างฐานข้อมูลใหม่จาก sql/schema.sql แล้วนำเข้า CSV ทั้งชุด
 *   npm run reset          (ในคอนเทนเนอร์ ใช้ JavaScript ที่คอมไพล์แล้ว)
 *   npm run reset:dev      (บนเครื่อง ไม่ต้อง build ก่อน)
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SeedService } from './domain/seed.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const summary = await app.get(SeedService).resetAll();
    console.log('reset เรียบร้อย', summary);
  } finally {
    await app.close();
  }
}

main().catch((error: Error) => {
  console.error('reset ล้มเหลว:', error.message);
  process.exitCode = 1;
});
