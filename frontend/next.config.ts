import type { NextConfig } from 'next';

/**
 * ที่อยู่ของ Nest API — ใน docker คือชื่อ service, บนเครื่องคือ localhost:3000
 * อ่านตอน build เท่านั้น: Next serialize rewrites ลง .next/required-server-files.json
 * ตั้งเป็น env ตอน runtime จึงไม่มีผล — Dockerfile รับเป็น build arg แทน
 */
const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:3000';

const config: NextConfig = {
  reactStrictMode: true,

  // อิมเมจ production เสิร์ฟด้วย node server.js ตัวเดียว ไม่ต้องลง node_modules ซ้ำ
  output: 'standalone',

  // FE/BE แยกกันจริง — เบราว์เซอร์คุยกับ API ผ่านที่อยู่เดียวกันเสมอ ไม่ต้องตั้ง CORS ในเบราว์เซอร์
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${API_ORIGIN}/api/:path*` },
      // Next ไม่เสิร์ฟ index.html ของโฟลเดอร์ใน public/ ให้เอง (nginx เดิมทำให้)
      { source: '/mockups', destination: '/mockups/index.html' },
    ];
  },

  /**
   * ลิงก์เดิมยังใช้ได้: QR บนบัตรคิวที่พิมพ์ไปแล้วชี้มาที่ patient-mobile.html
   * และหน้าที่ยังเป็น HTML นิ่ง (map, admin, …) ก็ลิงก์กลับมาด้วยชื่อเดิม
   */
  async redirects() {
    return [
      { source: '/login.html', destination: '/login', permanent: false },
      { source: '/registrar.html', destination: '/registrar', permanent: false },
      { source: '/station.html', destination: '/station', permanent: false },
      { source: '/patient-mobile.html', destination: '/patient', permanent: false },
    ];
  },
};

export default config;
