/**
 * ภาพจำลองของแต่ละจุดในโรงพยาบาล วาดด้วย canvas ในเบราว์เซอร์
 * ระบบจริงใช้รูปถ่ายจากตาราง node_photos — ภาพชุดนี้เป็นตัวยืนแทนจนกว่าจะได้รูปจริง
 */
import type { Scene } from './places';

type Ctx = CanvasRenderingContext2D;

const W = 800;
const H = 600;
const HORIZON = 330;

const roundRect = (ctx: Ctx, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
};

function drawRoom(ctx: Ctx) {
  ctx.fillStyle = '#f4f7f8';                       // เพดาน
  ctx.fillRect(0, 0, W, 96);
  ctx.fillStyle = '#e8edef';                       // ผนังด้านหลัง
  ctx.fillRect(0, 96, W, HORIZON - 96);
  ctx.fillStyle = '#d9d3c9';                       // พื้น
  ctx.fillRect(0, HORIZON, W, H - HORIZON);

  ctx.fillStyle = '#dfe5e8';                       // ผนังข้าง
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(120, 96); ctx.lineTo(120, HORIZON); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(W, 0); ctx.lineTo(W - 120, 96); ctx.lineTo(W - 120, HORIZON); ctx.lineTo(W, H); ctx.closePath(); ctx.fill();

  ctx.strokeStyle = '#cfc8bd';                     // เส้นพื้นเข้าหาจุดรวมสายตา
  ctx.lineWidth = 2;
  for (let i = -3; i <= 3; i += 1) {
    ctx.beginPath();
    ctx.moveTo(400 + i * 60, HORIZON);
    ctx.lineTo(400 + i * 300, H);
    ctx.stroke();
  }
  ctx.strokeStyle = '#c9d4d8';
  ctx.beginPath(); ctx.moveTo(0, HORIZON); ctx.lineTo(W, HORIZON); ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,.5)';          // แสงไฟเพดาน
  ctx.fillRect(330, 20, 140, 14);
  ctx.fillRect(355, 60, 90, 10);
}

function drawCounter(ctx: Ctx, scene: Scene) {
  ctx.fillStyle = '#c9d2d6';
  roundRect(ctx, 150, 300, 500, 26, 6); ctx.fill();       // หน้าเคาน์เตอร์
  ctx.fillStyle = scene.color;
  roundRect(ctx, 160, 326, 480, 120, 8); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.14)';
  for (let i = 0; i < 4; i += 1) ctx.fillRect(160 + i * 120 + 56, 326, 3, 120);
  ctx.fillStyle = '#eef2f3';                              // จอคอมบนเคาน์เตอร์
  roundRect(ctx, 250, 248, 74, 52, 5); ctx.fill();
  roundRect(ctx, 480, 248, 74, 52, 5); ctx.fill();
}

function drawDoor(ctx: Ctx, scene: Scene) {
  ctx.fillStyle = scene.color;
  roundRect(ctx, 296, 132, 208, 198, 6); ctx.fill();      // กรอบประตู
  ctx.fillStyle = '#f7fafb';
  roundRect(ctx, 308, 144, 184, 186, 4); ctx.fill();
  ctx.fillStyle = '#cfe0e6';                              // ช่องกระจก
  roundRect(ctx, 330, 166, 140, 74, 4); ctx.fill();
  ctx.fillStyle = '#9fb0b7';                              // มือจับ
  roundRect(ctx, 466, 246, 10, 34, 5); ctx.fill();
  ctx.fillStyle = scene.color;                            // ป้ายเลขห้องข้างประตู
  roundRect(ctx, 516, 176, 60, 42, 5); ctx.fill();
}

function drawSeats(ctx: Ctx, scene: Scene) {
  for (let i = 0; i < 4; i += 1) {
    const x = 176 + i * 122;
    ctx.fillStyle = scene.color;
    roundRect(ctx, x, 286, 92, 56, 8); ctx.fill();        // พนักพิง
    ctx.fillStyle = '#b9c4c9';
    roundRect(ctx, x - 4, 342, 100, 20, 6); ctx.fill();   // ที่นั่ง
    ctx.fillStyle = '#9aa8ae';
    ctx.fillRect(x + 8, 362, 8, 40);
    ctx.fillRect(x + 68, 362, 8, 40);
  }
}

function drawLift(ctx: Ctx, scene: Scene) {
  ctx.fillStyle = '#b6c2c7';
  roundRect(ctx, 276, 124, 248, 206, 4); ctx.fill();      // กรอบลิฟต์
  ctx.fillStyle = '#d7dfe2';
  ctx.fillRect(288, 136, 110, 194);
  ctx.fillRect(402, 136, 110, 194);
  ctx.fillStyle = '#8d9ba1';
  ctx.fillRect(398, 136, 4, 194);
  ctx.fillStyle = scene.color;                            // แผงกดชั้น
  roundRect(ctx, 540, 190, 40, 72, 6); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(560, 210, 8, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(560, 240, 8, 0, 7); ctx.fill();
}

function drawRamp(ctx: Ctx, scene: Scene) {
  ctx.fillStyle = '#cdc6bb';
  ctx.beginPath();                                        // พื้นลาด
  ctx.moveTo(120, H); ctx.lineTo(430, 322); ctx.lineTo(650, 322); ctx.lineTo(560, H);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = scene.color;                          // ราวจับ
  ctx.lineWidth = 9;
  ctx.beginPath(); ctx.moveTo(150, 520); ctx.lineTo(432, 268); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(600, 470); ctx.lineTo(648, 268); ctx.stroke();
  ctx.lineWidth = 5;
  for (let i = 0; i <= 5; i += 1) {
    const t = i / 5;
    ctx.beginPath();
    ctx.moveTo(150 + t * 282, 520 - t * 252);
    ctx.lineTo(150 + t * 282, 520 - t * 252 + 80);
    ctx.stroke();
  }
}

function drawBridge(ctx: Ctx, scene: Scene) {
  ctx.fillStyle = '#dceaf0';                              // ผนังกระจกสองข้าง
  ctx.beginPath(); ctx.moveTo(0, 40); ctx.lineTo(160, 120); ctx.lineTo(160, HORIZON); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(W, 40); ctx.lineTo(W - 160, 120); ctx.lineTo(W - 160, HORIZON); ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = scene.color;
  ctx.lineWidth = 6;
  for (let i = 0; i < 4; i += 1) {
    const x = 40 + i * 40;
    ctx.beginPath(); ctx.moveTo(x, 60 + i * 16); ctx.lineTo(x, H - i * 30); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W - x, 60 + i * 16); ctx.lineTo(W - x, H - i * 30); ctx.stroke();
  }
  ctx.fillStyle = '#eef4f6';                              // ปลายทางเชื่อม
  roundRect(ctx, 330, 168, 140, 162, 5); ctx.fill();
}

function drawExam(ctx: Ctx, scene: Scene) {
  ctx.fillStyle = '#e3e9eb';
  ctx.fillRect(140, 96, W - 280, HORIZON - 96);
  ctx.fillStyle = scene.color;                            // ม่านกั้นเตียง
  ctx.fillRect(452, 120, 196, 210);
  ctx.fillStyle = 'rgba(255,255,255,.2)';
  for (let i = 0; i < 6; i += 1) ctx.fillRect(460 + i * 32, 120, 10, 210);
  ctx.fillStyle = '#eef2f3';                              // เตียงตรวจ
  roundRect(ctx, 190, 296, 234, 34, 8); ctx.fill();
  ctx.fillStyle = '#9fb0b7';
  ctx.fillRect(206, 330, 12, 62);
  ctx.fillRect(396, 330, 12, 62);
  ctx.fillStyle = scene.color;
  roundRect(ctx, 190, 286, 234, 16, 8); ctx.fill();
  ctx.fillStyle = '#cfd8dc';                              // โคมไฟตรวจ
  ctx.beginPath(); ctx.arc(170, 200, 26, 0, 7); ctx.fill();
  ctx.fillRect(166, 200, 8, 130);
}

function drawDesk(ctx: Ctx, scene: Scene) {
  ctx.fillStyle = scene.color;
  roundRect(ctx, 250, 300, 300, 106, 8); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.16)';
  ctx.fillRect(396, 300, 4, 106);
  ctx.fillStyle = '#c9d2d6';
  roundRect(ctx, 240, 286, 320, 18, 6); ctx.fill();
  ctx.fillStyle = '#eef2f3';                              // ปฏิทินตั้งโต๊ะ
  roundRect(ctx, 296, 246, 62, 44, 4); ctx.fill();
  ctx.fillStyle = scene.color;
  ctx.fillRect(296, 246, 62, 12);
  ctx.fillStyle = '#b9c4c9';                              // เก้าอี้ผู้ป่วย
  roundRect(ctx, 588, 316, 74, 18, 6); ctx.fill();
  roundRect(ctx, 588, 262, 74, 54, 8); ctx.fill();
}

function drawToilet(ctx: Ctx, scene: Scene) {
  ctx.fillStyle = '#c9d2d6';
  roundRect(ctx, 300, 144, 200, 186, 5); ctx.fill();
  ctx.fillStyle = '#f2f6f7';
  roundRect(ctx, 310, 154, 180, 176, 4); ctx.fill();
  ctx.fillStyle = scene.color;                            // ป้ายห้องน้ำข้างประตู
  roundRect(ctx, 522, 164, 66, 86, 6); ctx.fill();
  ctx.fillStyle = '#9fb0b7';                              // ราวจับสำหรับรถเข็น
  roundRect(ctx, 250, 260, 14, 70, 7); ctx.fill();
}

function drawEntrance(ctx: Ctx, scene: Scene) {
  ctx.fillStyle = '#cfe4ea';                              // แสงจากภายนอกผ่านประตูกระจก
  roundRect(ctx, 250, 120, 300, 210, 5); ctx.fill();
  ctx.fillStyle = '#b6ccd3';
  ctx.fillRect(396, 120, 8, 210);
  ctx.strokeStyle = '#94b0ba';
  ctx.lineWidth = 5;
  ctx.strokeRect(250, 120, 300, 210);
  ctx.fillStyle = scene.color;                            // กันสาดเหนือประตู
  roundRect(ctx, 226, 96, 348, 22, 6); ctx.fill();
  ctx.fillStyle = '#d9d3c9';                              // ทางลาดหน้าประตู
  ctx.beginPath();
  ctx.moveTo(210, H); ctx.lineTo(300, HORIZON); ctx.lineTo(500, HORIZON); ctx.lineTo(590, H);
  ctx.closePath(); ctx.fill();
}

function drawStairs(ctx: Ctx, scene: Scene) {
  for (let i = 0; i < 7; i += 1) {                        // ขั้นบันไดไล่ขึ้นไปหาจุดรวมสายตา
    const y = H - 40 - i * 34;
    const inset = i * 26;
    ctx.fillStyle = i % 2 ? '#d2cbc1' : '#ddd7ce';
    ctx.fillRect(180 + inset, y, 440 - inset * 2, 34);
    ctx.fillStyle = scene.color;                          // แถบกันลื่นขอบขั้น
    ctx.fillRect(180 + inset, y, 440 - inset * 2, 6);
  }
  ctx.strokeStyle = '#9fb0b7';                            // ราวบันไดสองข้าง
  ctx.lineWidth = 8;
  ctx.beginPath(); ctx.moveTo(170, H - 60); ctx.lineTo(352, 300); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(630, H - 60); ctx.lineTo(448, 300); ctx.stroke();
}

function drawAtm(ctx: Ctx, scene: Scene) {
  ctx.fillStyle = '#c4ccd0';                              // ตัวตู้
  roundRect(ctx, 300, 128, 200, 232, 10); ctx.fill();
  ctx.fillStyle = scene.color;                            // แถบสีธนาคารด้านบน
  roundRect(ctx, 300, 128, 200, 40, 10); ctx.fill();
  ctx.fillStyle = '#1d3b46';                              // จอ
  roundRect(ctx, 326, 182, 148, 92, 6); ctx.fill();
  ctx.fillStyle = '#6fb3c9';
  roundRect(ctx, 340, 196, 120, 10, 5); ctx.fill();
  roundRect(ctx, 340, 216, 84, 10, 5); ctx.fill();
  ctx.fillStyle = '#e8edef';                              // แป้นกด
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      roundRect(ctx, 344 + c * 38, 290 + r * 24, 30, 18, 4); ctx.fill();
    }
  }
  ctx.fillStyle = '#7d8e96';                              // ช่องรับบัตรและช่องเงิน
  ctx.fillRect(330, 288, 8, 64);
  ctx.fillStyle = '#5c6b73';
  roundRect(ctx, 326, 362, 148, 12, 4); ctx.fill();
}

function drawWaterDispenser(ctx: Ctx) {
  ctx.fillStyle = '#e7ebed';
  roundRect(ctx, 664, 250, 62, 130, 7); ctx.fill();
  ctx.fillStyle = '#9fd0e4';
  roundRect(ctx, 672, 198, 46, 56, 8); ctx.fill();
  ctx.fillStyle = '#7d8e96';
  ctx.fillRect(686, 296, 18, 9);
}

function drawPlant(ctx: Ctx) {
  ctx.fillStyle = '#b08968';
  roundRect(ctx, 96, 336, 62, 54, 7); ctx.fill();
  ctx.fillStyle = '#4a7c59';
  for (let i = -2; i <= 2; i += 1) {
    ctx.beginPath();
    ctx.ellipse(127 + i * 17, 306 - Math.abs(i) * 10, 13, 34, i * 0.32, 0, 7);
    ctx.fill();
  }
}

/** ป้ายแขวนเหนือจุด — สีเดียวกับป้ายจริงในโรงพยาบาล */
function drawSign(ctx: Ctx, scene: Scene, label: string) {
  ctx.font = '700 30px Sarabun, "Noto Sans", "Noto Sans SC", "Noto Sans Myanmar", sans-serif';
  const width = Math.min(620, ctx.measureText(label).width + 56);

  ctx.fillStyle = 'rgba(16,34,42,.16)';
  roundRect(ctx, 400 - width / 2, 26, width, 58, 10); ctx.fill();
  ctx.fillStyle = scene.color;
  roundRect(ctx, 400 - width / 2, 20, width, 58, 10); ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 400, 51, width - 32);
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}

function drawDisclaimer(ctx: Ctx) {
  const text = 'ภาพจำลอง · illustration';
  ctx.font = '600 19px Sarabun, sans-serif';
  const width = ctx.measureText(text).width + 26;
  ctx.fillStyle = 'rgba(16,34,42,.62)';
  roundRect(ctx, W - width - 16, H - 46, width, 30, 15); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, W - width - 3, H - 25);
}
/** ตัววาดของแต่ละชนิดจุด */
const PAINTERS: Record<string, (ctx: Ctx, scene: Scene) => void> = {
  counter: drawCounter, door: drawDoor, seats: drawSeats, lift: drawLift,
  ramp: drawRamp, bridge: drawBridge, exam: drawExam, desk: drawDesk,
  toilet: drawToilet, entrance: drawEntrance, stairs: drawStairs, atm: drawAtm,
};

const cache = new Map<string, string>();

/**
 * ภาพจำลองของจุดหนึ่ง · คืน data URL และจำไว้ไม่ต้องวาดซ้ำ
 * label เปลี่ยนตามภาษา จึงเป็นส่วนหนึ่งของคีย์แคช
 */
export function sampleScene(code: string, label: string, scene?: Scene): string {
  const key = `${code}|${label}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const chosen = scene ?? { kind: 'door', color: '#1f6f8b' };
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  drawRoom(ctx);
  (PAINTERS[chosen.kind] ?? drawDoor)(ctx, chosen);
  if (chosen.prop === 'water') drawWaterDispenser(ctx);
  if (chosen.prop === 'plant') drawPlant(ctx);
  drawSign(ctx, chosen, label);
  drawDisclaimer(ctx);

  const url = canvas.toDataURL('image/jpeg', 0.82);
  cache.set(key, url);
  return url;
}

/** ฟอนต์มาช้ากว่าการวาดครั้งแรก — ล้างแคชแล้ววาดป้ายใหม่เมื่อฟอนต์พร้อม */
export const clearSceneCache = () => cache.clear();
