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

const APP_PAGES = ['login.html', 'patient-mobile.html', 'patient-map.html', 'registrar.html', 'map.html', 'pathway.html', 'impact.html', 'admin.html', 'station.html'];

/**
 * ไฟล์ใน app/ เขียนไว้สำหรับเผยแพร่เป็น artifact ซึ่งใส่หัวเอกสารให้เอง
 * ตอนเสิร์ฟเป็นไฟล์ธรรมดาจึงต้องเติมเอง ไม่งั้นภาษาไทยกลายเป็นตัวประหลาด
 * และหน้าจอมือถือย่อจนอ่านไม่ออกเพราะไม่มี viewport
 */
const DOC_HEAD = [
  '<!doctype html>',
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1">',
  '',
].join('\n');

const withHead = (html) => (/<meta[^>]+charset/i.test(html) ? html : DOC_HEAD + html);

async function copyPage(from, to) {
  await fs.writeFile(to, withHead(await fs.readFile(from, 'utf8')));
}

await fs.rm(dist, { recursive: true, force: true });
await fs.mkdir(path.join(dist, 'app'), { recursive: true });
await fs.mkdir(path.join(dist, 'mockups'), { recursive: true });

for (const page of APP_PAGES) {
  await copyPage(path.join(root, 'app', page), path.join(dist, page));
}

// หน้าแรกของเว็บ และสำเนาใน app/ เพื่อให้ลิงก์ ../app/login.html ในหน้า mockup ใช้ได้
await copyPage(path.join(root, 'app', 'login.html'), path.join(dist, 'index.html'));
await copyPage(path.join(root, 'app', 'login.html'), path.join(dist, 'app', 'login.html'));

for (const file of await fs.readdir(path.join(root, 'mockups'))) {
  if (file.endsWith('.html') || file.endsWith('.css')) {
    await fs.copyFile(path.join(root, 'mockups', file), path.join(dist, 'mockups', file));
  }
}

const files = (await fs.readdir(dist, { recursive: true, withFileTypes: true })).filter((item) => item.isFile());
console.log(`สร้าง dist/ แล้ว · ${files.length} ไฟล์`);
