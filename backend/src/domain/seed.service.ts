import fs from 'node:fs/promises';
import path from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import { AppConfig, CONFIG } from '../config/config';
import { parseCsv } from '../common/csv';
import { DbService } from '../db/db.service';
import { GraphService } from './graph.service';
import { importAll, type SeedFiles, type SeedSummary } from './seed';

export const SEED_FILES = [
  'nodes', 'edges', 'departments', 'templates', 'pathways', 'users', 'patients', 'node-photos',
] as const;

/** ล้างและนำเข้าข้อมูลตัวอย่างใหม่ทั้งชุด — ใช้ทั้ง `npm run reset` และปุ่มรีเซ็ตในโหมดเดโม */
@Injectable()
export class SeedService {
  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    private readonly db: DbService,
    private readonly graphs: GraphService,
  ) {}

  async readFiles(): Promise<SeedFiles> {
    const entries = await Promise.all(
      SEED_FILES.map(async (name) => [name, await this.readCsv(name)] as const),
    );
    return Object.fromEntries(entries);
  }

  async resetAll(): Promise<SeedSummary> {
    const schema = await fs.readFile(this.config.schemaFile, 'utf8');
    const files = await this.readFiles();

    const summary = await this.db.withTransaction(async (client) => {
      await client.query(schema);
      return importAll(client, files);
    });

    this.graphs.invalidate();
    return summary;
  }

  /** ไฟล์ที่ยังไม่มี ถือว่าไม่มีแถว — node-photos.csv เริ่มต้นว่างได้ */
  private async readCsv(name: string) {
    try {
      return parseCsv(await fs.readFile(path.join(this.config.dataDir, `${name}.csv`), 'utf8'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }
}
