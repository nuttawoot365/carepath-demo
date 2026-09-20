import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AppConfig, CONFIG } from '../../config/config';
import { DbService } from '../../db/db.service';
import { badRequest, notFound } from '../../common/errors';
import { notifyVisit, recordAudit } from '../../common/audit';
import { ClockService } from '../../common/clock.service';
import { requireFields, requireOneOf } from '../../common/validate';
import { costFor, shortestTimes } from '../../domain/graph';
import { GraphService } from '../../domain/graph.service';
import { SeedService } from '../../domain/seed.service';
import type { EdgeCost, Graph } from '../../domain/types';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser, Roles } from '../auth/roles.decorator';
import type { AuthUser } from '../auth/user.types';

@Controller('api')
export class AdminController {
  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    private readonly db: DbService,
    private readonly graphs: GraphService,
    private readonly clock: ClockService,
    private readonly seed: SeedService,
  ) {}

  /**
   * ปิดหรือเปิดเส้นทาง (ลิฟต์ซ่อม ทางเดินปิด) — กราฟถูกล้างแคชและผู้ป่วยที่กระทบได้รับแจ้งทันที
   * ปิดทั้งสองทิศเสมอ เพราะทางเดินปิดแล้วเดินสวนก็ไม่ได้
   */
  @Patch('edges/:id')
  @Roles('admin')
  @UseGuards(AuthGuard)
  async setEdgeStatus(
    @Param('id') id: string,
    @Body() body: { status?: string; closed_reason?: string },
    @CurrentUser() user: AuthUser,
  ) {
    const input = requireFields(body, ['status']);
    const status = requireOneOf(String(input.status), ['open', 'closed'] as const, 'status');
    const reason = input.closed_reason ? String(input.closed_reason).slice(0, 120) : null;

    const { rows } = await this.db.query('SELECT id, from_node_id, to_node_id FROM edges WHERE id = $1', [
      Number(id),
    ]);
    if (rows.length === 0) throw notFound('ไม่พบเส้นทางนี้', 'No such edge');
    const edge = rows[0];

    const affected = await this.db.withTransaction(async (client) => {
      const { rows: changed } = await client.query(
        `UPDATE edges SET status = $1, closed_reason = $2
          WHERE (from_node_id = $3 AND to_node_id = $4) OR (from_node_id = $4 AND to_node_id = $3)
          RETURNING id`,
        [status, status === 'closed' ? reason : null, edge.from_node_id, edge.to_node_id],
      );
      await recordAudit(client, {
        actorUserId: user.id,
        actorKind: 'user',
        entity: 'edge',
        entityId: edge.id,
        action: 'status',
        toStatus: status,
        detail: { reason, directions: changed.length },
      });
      return changed.length;
    });

    this.graphs.invalidate();
    const notified = await this.notifyAffectedVisits(status, reason);

    return { ok: true, directions: affected, notified };
  }

  /** ผลกระทบก่อนกดปิด: ผู้ใช้รถเข็นกับคนเดินเดินเพิ่มกี่เมตร และมีจุดไหนไปไม่ถึงบ้าง */
  @Get('edges/:id/impact')
  @Roles('admin')
  @UseGuards(AuthGuard)
  async impact(@Param('id') id: string) {
    const { rows } = await this.db.query(
      `SELECT e.id, fn.code AS from_code, tn.code AS to_code, e.kind
         FROM edges e JOIN nodes fn ON fn.id = e.from_node_id JOIN nodes tn ON tn.id = e.to_node_id
        WHERE e.id = $1`,
      [Number(id)],
    );
    if (rows.length === 0) throw notFound('ไม่พบเส้นทางนี้', 'No such edge');
    const edge = rows[0];

    const graph = await this.graphs.getGraph();
    const start = graph.byCode.get('A1-ENT');
    if (!start) throw badRequest('ผังนี้ไม่มีทางเข้าหลัก', 'This map has no main entrance');

    const before = {
      walking: reachSummary(graph, start.id, costFor({})),
      wheelchair: reachSummary(graph, start.id, costFor({ wheelchair: true })),
    };

    // จำลองการปิดโดยไม่แตะฐานข้อมูล: ตัดเส้นทั้งสองทิศออกจากกราฟสำเนา
    const closed = closeInGraph(graph, edge.from_code, edge.to_code);
    const after = {
      walking: reachSummary(closed, start.id, costFor({})),
      wheelchair: reachSummary(closed, start.id, costFor({ wheelchair: true })),
    };

    return { edge, before, after };
  }

  @Get('audit')
  @Roles('admin')
  @UseGuards(AuthGuard)
  async audit(@Query('limit') limit?: string) {
    const { rows } = await this.db.query(
      `SELECT a.id, a.actor_kind, a.entity, a.entity_id, a.action, a.from_status, a.to_status,
              a.detail, a.created_at, u.username AS actor
         FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_user_id
        ORDER BY a.id DESC LIMIT $1`,
      [Math.min(Number(limit ?? 100), 500)],
    );
    return { audit: rows };
  }

  /* ---------- โหมดเดโม: นาฬิกาจำลองและการรีเซ็ตข้อมูล ---------- */

  @Get('demo/clock')
  clockState() {
    return { demo: this.config.isDemo, time: this.clock.getDemoTime() };
  }

  @Post('demo/clock')
  @HttpCode(200)   // Express เดิมตอบ 200 — คง contract ไว้
  setClock(@Body() body: { time?: string | null }) {
    if (!this.config.isDemo) throw notFound();
    const time = body?.time ?? null;
    if (!this.clock.setDemoTime(time === null ? null : String(time))) {
      throw badRequest('เวลาต้องอยู่ในรูป HH:MM', 'Time must look like HH:MM');
    }
    return { time: this.clock.getDemoTime() };
  }

  /** ล้างและนำเข้าข้อมูลตัวอย่างใหม่ทั้งชุด — เปิดเฉพาะโหมดเดโม */
  @Post('demo/reset')
  @HttpCode(200)   // Express เดิมตอบ 200 — คง contract ไว้
  async reset() {
    if (!this.config.isDemo) throw notFound();
    return { ok: true, summary: await this.seed.resetAll() };
  }

  /** ผู้ป่วยที่กำลังเดินอยู่ และยังมีขั้นที่ต้องไปต่อ ควรรู้ทันทีว่าเส้นทางเปลี่ยน */
  private async notifyAffectedVisits(status: 'open' | 'closed', reason: string | null): Promise<number> {
    const { rows } = await this.db.query<{ id: number }>(
      `SELECT DISTINCT v.id FROM visits v
         JOIN visit_steps vs ON vs.visit_id = v.id AND vs.status IN ('pending','arrived')
        WHERE v.visit_date = CURRENT_DATE AND v.status = 'active'`,
    );
    if (rows.length === 0) return 0;

    const messageTh =
      status === 'closed'
        ? `เส้นทางเปลี่ยน — ${reason ?? 'มีเส้นทางปิดระหว่างวัน'} ระบบคำนวณทางใหม่ให้แล้ว`
        : 'เส้นทางที่ปิดไว้กลับมาใช้ได้แล้ว';
    const messageEn =
      status === 'closed'
        ? `Your route changed — ${reason ?? 'a route is closed'}. A new route is ready.`
        : 'A closed route has reopened';

    await this.db.withTransaction(async (client) => {
      for (const visit of rows) await notifyVisit(client, visit.id, messageTh, messageEn);
    });
    return rows.length;
  }
}

function reachSummary(graph: Graph, fromId: number, cost: EdgeCost) {
  const distances = shortestTimes(graph, fromId, cost);
  const reachable = [...distances.values()];
  return {
    reachable: reachable.length,
    unreachable: graph.nodes.size - reachable.length,
    total_seconds: Math.round(reachable.reduce((sum, value) => sum + value, 0)),
  };
}

function closeInGraph(graph: Graph, fromCode: string, toCode: string): Graph {
  const blocked = new Set([`${fromCode}>${toCode}`, `${toCode}>${fromCode}`]);
  const adjacency = new Map<number, typeof graph.adjacency extends Map<number, infer E> ? E : never>();

  for (const [nodeId, edges] of graph.adjacency) {
    adjacency.set(
      nodeId,
      edges.filter((edge) => {
        const key = `${graph.nodes.get(edge.from_node_id)!.code}>${graph.nodes.get(edge.to_node_id)!.code}`;
        return !blocked.has(key);
      }),
    );
  }
  return { ...graph, adjacency };
}
