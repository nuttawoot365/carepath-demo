import { Injectable } from '@nestjs/common';
import { DbService } from '../../db/db.service';
import { GraphService } from '../../domain/graph.service';
import { recordAudit } from '../../common/audit';
import { unprocessable } from '../../common/errors';
import { parseCsv, type CsvRow } from '../../common/csv';
import { importAll, type SeedSummary } from '../../domain/seed';
import {
  checkImport, IMPORT_NAMES, type CheckResult, type ImportFiles, type ImportName,
} from '../../domain/import-check';

/** ไฟล์ที่ส่งมาจากหน้าเว็บ — คีย์คือชื่อชุด ค่าคือเนื้อ CSV ดิบ */
export type RawFiles = Partial<Record<ImportName, string>>;

export interface ApplyResult {
  summary: SeedSummary;
  /** จุดที่หายไปจากผังใหม่ ถูกปิดใช้งานแทนการลบ เพื่อไม่ให้ประวัติการมาเสียหาย */
  deactivated: number;
  check: CheckResult;
}

@Injectable()
export class ImportService {
  constructor(
    private readonly db: DbService,
    private readonly graphs: GraphService,
  ) {}

  /** แปลง CSV ดิบเป็นแถว แล้วตรวจ — ไม่แตะฐานข้อมูลเลย */
  preview(raw: RawFiles): CheckResult {
    return checkImport(this.parse(raw));
  }

  /**
   * นำเข้าจริง — ตรวจก่อนเสมอ ถ้าไม่ผ่านไม่แตะฐานข้อมูล
   * ทั้งหมดอยู่ในทรานแซกชันเดียว ถ้าพังกลางทางจะไม่มีอะไรถูกบันทึก
   */
  async apply(raw: RawFiles, actorUserId: number): Promise<ApplyResult> {
    const files = this.parse(raw);
    const check = checkImport(files);
    if (!check.ok) {
      throw unprocessable(
        'IMPORT_INVALID',
        `ไฟล์ยังมีปัญหา ${check.problems.length} จุด แก้ให้ครบก่อนจึงนำเข้าได้`,
        `The files still have ${check.problems.length} problems`,
      );
    }

    const keep = new Set((files.nodes ?? []).map((row) => row.code.trim()));

    const result = await this.db.withTransaction(async (client) => {
      const summary = await importAll(client, files as Record<string, CsvRow[]>);

      // จุดที่ไม่อยู่ในผังใหม่: ปิดใช้งาน ไม่ลบ เพราะ visit_steps เก่ายังอ้างถึงอยู่
      const { rows } = await client.query<{ code: string }>(
        `UPDATE nodes SET is_active = FALSE
          WHERE is_active AND NOT (code = ANY($1::text[]))
          RETURNING code`,
        [[...keep]],
      );

      await recordAudit(client, {
        actorUserId,
        actorKind: 'user',
        entity: 'map',
        entityId: 0,
        action: 'import',
        detail: { ...summary, deactivated: rows.length, files: Object.keys(raw) },
      });

      return { summary, deactivated: rows.length };
    });

    this.graphs.invalidate();
    return { ...result, check };
  }

  private parse(raw: RawFiles): ImportFiles {
    const files: ImportFiles = {};
    for (const name of IMPORT_NAMES) {
      const text = raw[name];
      if (typeof text === 'string' && text.trim() !== '') files[name] = parseCsv(text);
    }
    return files;
  }
}
