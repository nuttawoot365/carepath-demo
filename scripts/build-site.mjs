#!/usr/bin/env node
/**
 * รวมหน้าเว็บทั้งชุดไว้ใน dist/ สำหรับ deploy เป็น static assets
 * หน้าแรกของเว็บคือหน้าเข้าสู่ระบบ
 *   node scripts/build-site.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

const APP_PAGES = ['login.html', 'patient-mobile.html', 'registrar.html', 'map.html', 'pathway.html'];

await fs.rm(dist, { recursive: true, force: true });
await fs.mkdir(path.join(dist, 'app'), { recursive: true });
await fs.mkdir(path.join(dist, 'mockups'), { recursive: true });

for (const page of APP_PAGES) {
  await fs.copyFile(path.join(root, 'app', page), path.join(dist, page));
}

// หน้าแรกของเว็บ และสำเนาใน app/ เพื่อให้ลิงก์ ../app/login.html ในหน้า mockup ใช้ได้
await fs.copyFile(path.join(root, 'app', 'login.html'), path.join(dist, 'index.html'));
await fs.copyFile(path.join(root, 'app', 'login.html'), path.join(dist, 'app', 'login.html'));

for (const file of await fs.readdir(path.join(root, 'mockups'))) {
  if (file.endsWith('.html') || file.endsWith('.css')) {
    await fs.copyFile(path.join(root, 'mockups', file), path.join(dist, 'mockups', file));
  }
}

const files = (await fs.readdir(dist, { recursive: true, withFileTypes: true })).filter((item) => item.isFile());
console.log(`สร้าง dist/ แล้ว · ${files.length} ไฟล์`);
