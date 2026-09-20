import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { CONFIG, type AppConfig } from './config/config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  const config = app.get<AppConfig>(CONFIG);

  app.disable('x-powered-by');
  // นำเข้าผังส่งเนื้อ CSV มาทาง JSON · ผังจริงของโรงพยาบาลใหญ่กว่าคำขอปกติมาก
  app.useBodyParser('json', { limit: '4mb' });
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();

  // Next.js dev server อยู่คนละพอร์ต ตอน production มี reverse proxy ให้อยู่โดเมนเดียวกัน
  app.enableCors({ origin: config.publicBaseUrl, credentials: false });

  await app.listen(config.port, '0.0.0.0');
  new Logger('bootstrap').log(`carepath api ฟังอยู่ที่พอร์ต ${config.port} · โหมด ${config.env}`);
}

void bootstrap();
