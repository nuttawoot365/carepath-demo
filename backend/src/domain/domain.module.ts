import { Global, Module } from '@nestjs/common';
import { ClockService } from '../common/clock.service';
import { GraphService } from './graph.service';
import { SeedService } from './seed.service';
import { VisitService } from './visit.service';

/** ตรรกะโดเมนที่ทุกโมดูลใช้ร่วมกัน — กราฟผัง นาฬิกา และสถานะการมาหนึ่งครั้ง */
@Global()
@Module({
  providers: [ClockService, GraphService, SeedService, VisitService],
  exports: [ClockService, GraphService, SeedService, VisitService],
})
export class DomainModule {}
