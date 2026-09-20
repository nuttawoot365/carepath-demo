/**
 * CarePath REST API — Node 24 + Express 5 + PostgreSQL
 * หน้าเว็บคุยกับระบบผ่าน /api เท่านั้น ไม่มีหน้าใดต่อฐานข้อมูลตรง ๆ
 */
import express from 'express';
import { config } from './config.js';
import { ApiError } from './lib/errors.js';
import authRoutes from './routes/auth.js';
import mapRoutes from './routes/map.js';
import catalogRoutes from './routes/catalog.js';
import visitRoutes from './routes/visits.js';
import patientRoutes from './routes/patient.js';
import stationRoutes from './routes/stations.js';
import adminRoutes from './routes/admin.js';

export const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, env: config.env }));

app.use('/api/auth', authRoutes);
app.use('/api', mapRoutes);
app.use('/api', catalogRoutes);
app.use('/api', visitRoutes);
app.use('/api', patientRoutes);
app.use('/api', stationRoutes);
app.use('/api', adminRoutes);

app.use('/api', (_req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message_th: 'ไม่พบปลายทางนี้', message_en: 'No such endpoint' },
  });
});

// ข้อผิดพลาดที่ไม่ใช่ ApiError ไม่เปิดเผยรายละเอียดออกไปข้างนอก
app.use((error, _req, res, _next) => {
  if (error instanceof ApiError) return res.status(error.status).json(error.toJSON());

  console.error('unhandled error:', error);
  res.status(500).json({
    error: { code: 'INTERNAL', message_th: 'ระบบขัดข้อง', message_en: 'Something went wrong' },
  });
});

if (process.argv[1]?.endsWith('server.js')) {
  app.listen(config.port, () => {
    console.log(`carepath api ฟังอยู่ที่พอร์ต ${config.port} · โหมด ${config.env}`);
  });
}
