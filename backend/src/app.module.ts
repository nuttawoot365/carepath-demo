import { Controller, Get, Inject, Module } from '@nestjs/common';
import { AppConfig, CONFIG } from './config/config';
import { ConfigModule } from './config/config.module';
import { DbModule } from './db/db.module';
import { DomainModule } from './domain/domain.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { ImportModule } from './modules/import/import.module';
import { MapModule } from './modules/map/map.module';
import { PatientModule } from './modules/patient/patient.module';
import { StationsModule } from './modules/stations/stations.module';
import { VisitsModule } from './modules/visits/visits.module';

@Controller('api')
class HealthController {
  constructor(@Inject(CONFIG) private readonly config: AppConfig) {}

  @Get('health')
  health() {
    return { ok: true, env: this.config.env };
  }
}

/**
 * CarePath REST API — Node 24 + NestJS 11 + PostgreSQL
 * หน้าเว็บคุยกับระบบผ่าน /api เท่านั้น ไม่มีหน้าใดต่อฐานข้อมูลตรง ๆ
 */
@Module({
  imports: [
    ConfigModule,
    DbModule,
    AuthModule,
    DomainModule,
    MapModule,
    CatalogModule,
    ImportModule,
    VisitsModule,
    PatientModule,
    StationsModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
