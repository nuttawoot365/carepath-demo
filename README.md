# CarePath

ระบบนำทางในโรงพยาบาลและติดตามขั้นตอนการรักษา — ผู้ป่วยรู้ว่า "ตอนนี้ต้องไปไหน และไปยังไง" ตลอดทั้งวัน
ระบบสาธิตสำหรับ**โรงพยาบาลวชิระภูเก็ต** · Hackathon 977-121

> **ขอบเขตของข้อมูลในเดโม** — ผังอาคาร ชั้น แผนก เส้นทางเดิน และผู้ป่วยทั้งหมดเป็น **ชุดสมมุติ**
> ที่สร้างขึ้นเพื่อสาธิตกลไก ยังไม่ใช่ผังจริงของโรงพยาบาล เมื่อได้ผังจริงแล้วนำเข้าผ่าน
> `data/nodes.csv`, `data/edges.csv` และหน้านำเข้าของผู้ดูแลระบบได้ทันทีโดยไม่ต้องแก้โค้ด
> ไม่มีข้อมูลบุคคลจริงในระบบ

## สถานะตอนนี้

| ส่วน | สถานะ |
|---|---|
| แบบหน้าจอ 10 หน้า + การออกแบบข้อมูล (`mockups/`) | ✅ ดูได้แล้ว |
| โครงสร้างฐานข้อมูล 17 ตาราง 3NF (`backend/sql/schema.sql`) | ✅ |
| ข้อมูลนำเข้า CSV + สคริปต์ reset (`data/`, `backend/scripts/`) | ✅ |
| อัลกอริทึมเส้นทางและลำดับขั้น (`backend/src/domain/`) | ✅ |
| ผังเส้นทางที่วาดจากข้อมูลจริง (`app/map.html`) | ✅ |
| แผนภาพแม่แบบการมาหนึ่งครั้ง (`app/pathway.html`) | ✅ |
| ผลกระทบเมื่อปิดเส้นทาง + รับแจ้งจากผู้ใช้ (`app/impact.html`) | ✅ |
| จอจุดบริการที่ผูกกับหน้าผู้ป่วยจริง (`app/station.html`) | ✅ |
| REST API บน NestJS + PostgreSQL (`backend/src/modules/`) | ✅ ต่อครบแล้ว |
| หน้าเว็บหลัก 4 หน้าเป็น Next.js คุยกับ API จริง (เข้าสู่ระบบ · เวชระเบียน · จุดบริการ · ผู้ป่วย) | ✅ |
| หน้าผัง แผนภาพแม่แบบ ผลกระทบ โต๊ะช่วยเหลือ จัดการระบบ | ⏳ ยังเป็น HTML นิ่งใน `frontend/public/` ที่ build จากข้อมูล |
| ยกระบบขึ้น Cloudflare | ⏸ ยังไม่ทำ (ดูข้อจำกัดด้านล่าง) |

## รันทั้งระบบบนเครื่อง (front → API → ฐานข้อมูล)

```bash
cp .env.example .env
docker compose up -d --build              # db :5433 · api :3000 · web :5173
docker compose exec api npm run reset     # สร้างตารางและนำเข้าข้อมูลตัวอย่าง
open http://localhost:5173/login           # เริ่มที่หน้าเข้าสู่ระบบ
```

เว็บที่พอร์ต 5173 คือ Next.js ที่เสิร์ฟทั้งหน้า React และไฟล์นิ่งใน `frontend/public/`
แล้ว proxy `/api/` ไปที่ NestJS ที่พอร์ต 3000 เบราว์เซอร์จึงคุยกับ API ผ่านที่อยู่เดียวกัน
ไม่มีหน้าไหนต่อฐานข้อมูลเอง

| ที่อยู่ | ได้อะไร |
|---|---|
| http://localhost:5173/login | เข้าสู่ระบบด้วยบัญชีใน `data/users.csv` (รหัส `demo@1234`) หรือพิมพ์รหัสบนบัตรคิว |
| http://localhost:5173/registrar | เวชระเบียน — เปิด visit จริง ลงฐานข้อมูล พิมพ์บัตรคิวพร้อม QR ที่สแกนได้ |
| http://localhost:5173/station | จอจุดบริการ — คิวจริงของแผนก กดมาถึง/เรียก/เสร็จ/ส่งตรวจเพิ่ม |
| http://localhost:5173/patient?t=… | หน้าผู้ป่วย — เปิดจาก QR บนบัตร หรือรหัสใต้ QR |
| http://localhost:5173/mockups/ | แบบหน้าจอชุดเดิม |
| `docker compose down -v` | ล้างข้อมูลทั้งหมด |

ลิงก์เดิมที่ลงท้ายด้วย `.html` (เช่น QR บนบัตรคิวที่พิมพ์ไปแล้ว) ยังใช้ได้ — Next.js redirect ให้เอง

> **ที่อยู่ API เป็นค่าตอน build** — Next.js ฝัง `rewrites()` ลงใน `.next` ตั้งแต่ตอน `next build`
> ตั้ง `API_ORIGIN` เป็น env ตอน runtime จึงไม่มีผล ต้องส่งเป็น build arg (docker-compose ตั้งให้แล้ว)
> ถ้าเปลี่ยนที่อยู่ API ต้อง `docker compose up -d --build web` ใหม่

### รันแยกกันบนเครื่อง (ไม่ผ่าน docker)

```bash
docker compose up -d db                   # ต้องมี Postgres สักตัว
cd backend  && npm install && npm run build && npm run reset && npm start
cd frontend && npm install && npm run dev  # :5173 · proxy ไป API_ORIGIN
```

เดินตามสถานการณ์นี้แล้วเห็นครบทั้งระบบ: เปิด visit ที่เวชระเบียน (รถเข็น + ผู้สูงอายุ) → สแกน QR เปิดหน้าผู้ป่วย
→ ตั้งเวลาเดโม 10:40 (`POST /api/demo/clock`) แล้วกดปุ่มเดโม "ลิฟต์ B ปิด" บนหน้าผู้ป่วย
→ เปิดจอจุดบริการอีกแท็บแล้วกด "เสร็จ" หน้าผู้ป่วยเปลี่ยนเองภายใน 5 วินาที

## REST API

ทุกปลายทางอยู่ใต้ `/api` · เจ้าหน้าที่ใช้ JWT ใน `Authorization: Bearer` · ผู้ป่วยใช้ token ในลิงก์ของบัตรคิว

| ปลายทาง | ใคร | ทำอะไร |
|---|---|---|
| `POST /auth/login` · `GET /auth/me` | ทุกคน | เข้าสู่ระบบ · ดูว่าตัวเองเป็นใคร |
| `GET /map` · `GET /nodes/by-qr/:token` | เปิด | ผังทั้งชุด · หาจุดจาก QR ที่ติดผนัง |
| `GET /templates` | เปิด | แม่แบบขั้นตอนพร้อมทุกขั้น |
| `GET /patients` · `POST /patients` | เวชระเบียน | ค้นผู้ป่วย · เปิดประวัติใหม่ |
| `POST /visits` · `GET /visits` · `GET /visits/:id` | เจ้าหน้าที่ | เปิด visit (ทรานแซกชันเดียว) · คิวของวันนี้ · แผนเต็มของหนึ่งราย |
| `GET /p/:token` · `GET /p/code/:code` | ผู้ป่วย | สถานะ ขั้นถัดไป เส้นทาง คำเตือน แจ้งเตือน · แลกรหัสใต้ QR เป็น token |
| `POST /p/:token/position` · `POST /p/:token/arrive` | ผู้ป่วย | บอกตำแหน่งใหม่ (เลือกจุดหรือสแกน QR) · กดว่าถึงแล้ว |
| `GET /stations` · `GET /stations/:code/queue` | จุดบริการ | แผนกและจุดบริการ · คิวของแผนกพร้อมเวลาเดินของแต่ละคน |
| `POST /steps/:id/status` · `POST /visits/:id/steps` | จุดบริการ | เปลี่ยนสถานะขั้น · ส่งตรวจเพิ่ม |
| `PATCH /edges/:id` · `GET /edges/:id/impact` | ผู้ดูแลระบบ | ปิด/เปิดเส้นทาง · ดูผลกระทบก่อนกดปิด |
| `GET /audit` | ผู้ดูแลระบบ | บันทึกการตรวจสอบย้อนหลัง |
| `POST /demo/clock` · `POST /demo/reset` | เดโม | นาฬิกาจำลอง · ล้างและนำเข้าข้อมูลใหม่ (เฉพาะ `NODE_ENV=demo`) |

## เผยแพร่ขึ้น Cloudflare

ยังไม่ได้ทำ — โค้ดชุดนี้รันครบบนเครื่องก่อน `dist/` ที่เผยแพร่ไว้เดิมเป็นหน้าเว็บ static ล้วน
และ API ยังย้ายขึ้น Workers ตรง ๆ ไม่ได้ (ดู **ข้อจำกัดเมื่อย้าย API ขึ้น Workers** ด้านล่าง)

```bash
node scripts/build-site.mjs     # รวมหน้าเว็บไว้ใน dist/
npx wrangler deploy             # ขึ้น Cloudflare — ยังไม่ต้องรันตอนนี้
```

## เปิดดูแบบหน้าจอ (ไม่ต้องติดตั้งอะไร)

```bash
./serve.sh                      # แบบหน้าจอ · พิมพ์ที่อยู่สำหรับเครื่องนี้และสำหรับมือถือให้
./serve.sh app 5174       # ต้นแบบที่กดได้จริง สำหรับทดสอบบนมือถือ
```

หมายเหตุ: `./serve.sh` เสิร์ฟไฟล์อย่างเดียว ไม่มี API — หน้าเวชระเบียน จุดบริการ และผู้ป่วยต้องเปิดผ่าน
`docker compose` ที่พอร์ต 5173 จึงจะทำงานได้จริง

ที่อยู่ของมือถือคือ IP ในวงแลน เช่น `http://192.168.1.54:5173` — ต้องต่อไวไฟวงเดียวกัน
ครั้งแรก macOS อาจถามว่าจะอนุญาตให้ python รับการเชื่อมต่อไหม ให้กดอนุญาต

เริ่มที่หน้าสารบัญ แล้วไล่ดูตามสถานการณ์: ผู้ป่วยเบาหวานคิว A-017 ใช้รถเข็น มาถึง 10:40 ซึ่งสายกว่านัด
ขั้น "เจาะเลือด" ต้องเสร็จก่อน 11:00 ระบบจึงสลับให้ไปเจาะเลือดก่อนคัดกรอง — ระหว่างเดิน ลิฟต์ B ปิดซ่อม
ระบบเปลี่ยนเส้นทางเป็นทางลาดอาคาร C และแจ้งผู้ป่วยทันที

## เอกสาร

| ไฟล์ | เนื้อหา |
|---|---|
| `docs/deliverables.pdf` | สรุปเอกสารส่งมอบตามโจทย์ทั้ง 5 ข้อ · ตารางทดสอบ 20 กรณี · ส่วนที่ใช้ AI · สิ่งที่ยังไม่ได้ทำ |
| `docs/as-built.md` | ระบบตามที่สร้างจริง · อัลกอริทึม · ตัวเลขที่วัดได้ · บันทึกการตัดสินใจ · ข้อจำกัด |
| `pitch/` | สไลด์นำเสนอ 14 หน้า พร้อมลำดับการเล่าและแผนสำรองเมื่อเวลาไม่พอ |
| `app/README.md` | รายละเอียดแต่ละหน้าจอและวิธีสร้างใหม่จากข้อมูล |
| `data/README.md` | คอลัมน์ของไฟล์นำเข้าแต่ละไฟล์ |

## โครงสร้าง

```
mockups/     แบบหน้าจอและการออกแบบข้อมูล (HTML นิ่ง)
data/        CSV นำเข้า: ผัง แผนก แม่แบบขั้นตอน ผู้ใช้ ผู้ป่วยสมมุติ
backend/     NestJS 11 + TypeScript — REST /api ตัวเดียวที่คุยกับฐานข้อมูล
  sql/       schema.sql — 17 ตาราง 3NF
  src/
    config/  ค่าตั้งจาก environment ที่เดียว
    db/      DbService — pg.Pool · query() · withTransaction()
    common/  error สองภาษา + filter · นาฬิกาจำลอง · audit · CSV · ids · validate
    domain/  graph (Dijkstra ตามความต้องการพิเศษ) · instructions · legs · pathway
             · visit.service · steps · seed
    modules/ auth · map · catalog · visits · patient · stations · admin
    reset.ts สร้างตารางและนำเข้า CSV (`npm run reset`)
  test/      jest — graph · pathway · legs · csv
frontend/    Next.js 15 (App Router) + TypeScript
  app/       login · registrar · station · patient (React) + globals.css
  lib/       api.ts (ตัวเรียก /api) · types.ts · use-auth · use-poll · format
  public/    หน้าที่ยังเป็น HTML นิ่ง: map · pathway · impact · helpdesk · admin
             · privacy · patient-map · photos/ · mockups/
app/         ต้นแบบ HTML + `build.mjs` ที่ generate หน้านิ่งจาก data/ ลง frontend/public/
```

## ข้อกำหนดที่ยึดตลอดโครงการ

- PostgreSQL 16 · 3NF · ทุก query เป็น parameterized (`npm run lint:sql` ตรวจให้)
- Frontend กับ backend แยกกันจริง คุยผ่าน REST `/api` เท่านั้น
- รหัสผ่านเก็บด้วย bcrypt · ตรวจสิทธิ์ที่ API ไม่ใช่ที่หน้าจอ
- บันทึกการตรวจสอบย้อนหลังเขียนได้อย่างเดียว และใช้เวลาของเซิร์ฟเวอร์เสมอ
- ข้อมูลสมมุติทั้งหมด · หน้าจอสาธารณะไม่แสดงชื่อหรือเลขประจำตัวผู้ป่วย


## ข้อจำกัดเมื่อย้าย API ขึ้น Cloudflare Workers

หน้าเว็บ static ขึ้น Workers ได้ทันที แต่ backend ที่เขียนไว้ยังย้ายตรง ๆ ไม่ได้ ต้องแก้ก่อน

| จุด | ปัญหา | ทางแก้ |
|---|---|---|
| `common/clock.service.ts` | Workers รันบน UTC เสมอ `getHours()` จึงเพี้ยน 7 ชั่วโมง และ deadline 11:00 เทียบผิด | แปลงเวลาด้วย `Intl.DateTimeFormat` timeZone `Asia/Bangkok` |
| `modules/auth/auth.service.ts` | bcrypt rounds 10 ใช้ CPU 60–100 ms เกินโควตา 10 ms ของแผนฟรี | ใช้ PBKDF2 ผ่าน WebCrypto หรือขึ้นแผนเสียเงิน |
| `domain/graph.service.ts` | แคชกราฟอยู่ใน singleton ของ Nest ซึ่งไม่แชร์ข้าม isolate และ `invalidate()` ไม่มีผล | 48 โหนดเล็กมาก โหลดใหม่ทุก request หรือแคชใน KV พร้อมเลขเวอร์ชัน |
| นาฬิกาจำลอง | เหตุผลเดียวกับข้างบน ตั้งแล้วเครื่องอื่นไม่เห็น | เก็บใน KV หรือตารางในฐานข้อมูล |
| `db/db.service.ts` | ไม่มี Postgres บน Workers และ `pg.Pool` ใช้ไม่ได้ | Postgres ภายนอก (Neon/Supabase) ต่อผ่าน Hyperdrive · `pg` ขั้นต่ำ 8.16.3 · เปิด `nodejs_compat` |
| `config/config.ts` | `process.env` ไม่มีบน Workers | อ่านจาก `env` binding ที่ส่งเข้ามาต่อ request |
| `src/main.ts` | NestJS (Express adapter) รันบน Workers ไม่ได้ | เปลี่ยนเป็น Hono · `AuthGuard` ย้ายเป็น middleware ได้ตรง ๆ |
| `src/reset.ts` | ใช้ `fs` อ่าน schema.sql และ CSV | รันจากเครื่องหรือ CI ยิงเข้า Postgres ตรง ๆ ไม่ผ่าน Worker |
| `audit_logs` | `REVOKE UPDATE, DELETE` ต้องจัดการ role ที่ฐานข้อมูล | ทำได้บน Neon/Supabase · ทำไม่ได้ถ้าใช้ D1 ซึ่งเป็น SQLite และขัดข้อกำหนด PostgreSQL 3NF |
