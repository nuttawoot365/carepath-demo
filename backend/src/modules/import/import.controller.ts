import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { badRequest } from '../../common/errors';
import { IMPORT_NAMES } from '../../domain/import-check';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser, Roles } from '../auth/roles.decorator';
import type { AuthUser } from '../auth/user.types';
import { ImportService, type RawFiles } from './import.service';

/** เนื้อ CSV รวมกันทุกไฟล์ไม่ควรเกินเท่านี้ — ผัง 50 จุดใช้ราว 8 KB */
const MAX_TOTAL_BYTES = 2 * 1024 * 1024;

@Controller('api/import')
@Roles('admin')
@UseGuards(AuthGuard)
export class ImportController {
  constructor(private readonly imports: ImportService) {}

  /** ตรวจไฟล์แล้วคืนรายงาน โดยไม่แตะฐานข้อมูล — ผู้ดูแลดูก่อนตัดสินใจ */
  @Post('preview')
  @HttpCode(200)
  preview(@Body() body: { files?: RawFiles }) {
    return this.imports.preview(this.clean(body));
  }

  /** นำเข้าจริง · ตรวจซ้ำที่เซิร์ฟเวอร์เสมอ ไม่เชื่อผลพรีวิวที่หน้าจอส่งมา */
  @Post('apply')
  @HttpCode(200)
  apply(@Body() body: { files?: RawFiles }, @CurrentUser() user: AuthUser) {
    return this.imports.apply(this.clean(body), user.id);
  }

  private clean(body: { files?: RawFiles }): RawFiles {
    const files = body?.files;
    if (!files || typeof files !== 'object') {
      throw badRequest('ต้องส่งไฟล์มาด้วย', 'No files were sent');
    }

    const known = Object.entries(files).filter(([name]) =>
      (IMPORT_NAMES as readonly string[]).includes(name),
    );
    if (known.length === 0) {
      throw badRequest(
        `ไม่รู้จักไฟล์ที่ส่งมา · รับเฉพาะ ${IMPORT_NAMES.join(', ')}`,
        'No recognised files were sent',
      );
    }

    const total = known.reduce((sum, [, text]) => sum + Buffer.byteLength(String(text)), 0);
    if (total > MAX_TOTAL_BYTES) {
      throw badRequest('ไฟล์รวมกันใหญ่เกิน 2 MB', 'The files exceed 2 MB in total');
    }

    return Object.fromEntries(known.map(([name, text]) => [name, String(text)])) as RawFiles;
  }
}
