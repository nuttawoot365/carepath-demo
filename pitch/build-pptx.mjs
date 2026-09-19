#!/usr/bin/env node
/**
 * สร้างไฟล์ .pptx จากเนื้อหาชุดเดียวกับสไลด์บนเว็บ
 * ใช้นำเข้า Canva (Create design → Import file) หรือเปิดด้วย PowerPoint และ Keynote
 *   node pitch/build-pptx.mjs
 */
import pptxgen from 'pptxgenjs';

const INK = '0F2730';
const PAPER = 'F4F8F9';
const WHITE = 'FFFFFF';
const PRIMARY = '1F6F8B';
const PRIMARY_SOFT = 'E4F0F4';
const MUTED = '4C626C';
const SKY = '9DC8D6';
const AMBER = 'B8791A';
const AMBER_SOFT = 'FBF1DF';
const OK = '2E8B57';
const OK_SOFT = 'E4F2EA';

const TH = 'Sarabun';
const MONO = 'Courier New';

const deck = new pptxgen();
deck.layout = 'LAYOUT_WIDE';
deck.author = 'CarePath';
deck.title = 'CarePath — Hackathon 977-121';

const M = 0.62;
const W = 13.333 - M * 2;

const text = (slide, content, opts) =>
  slide.addText(content, { isTextBox: true, margin: 0, fontFace: TH, ...opts });

/** การ์ดพื้นขาวพร้อมหัวข้อและคำอธิบาย ใช้ซ้ำหลายสไลด์ */
function card(slide, { x, y, w, h, title, body, fill = WHITE, line = 'D7E3E7',
                       bodyColor = MUTED, titleSize = 15, bodySize = 12 }) {
  slide.addShape(deck.ShapeType.roundRect, {
    x, y, w, h, fill: { color: fill }, line: { color: line, width: 1 }, rectRadius: 0.12,
  });
  text(slide, title, {
    x: x + 0.26, y: y + 0.22, w: w - 0.52, h: 0.6,
    fontSize: titleSize, bold: true, color: INK, valign: 'top',
  });
  if (body) {
    text(slide, body, {
      x: x + 0.26, y: y + 0.9, w: w - 0.52, h: h - 1.15,
      fontSize: bodySize, color: bodyColor, lineSpacingMultiple: 1.35, valign: 'top',
    });
  }
}

/* ---------- 1 ปก ---------- */
{
  const s = deck.addSlide();
  s.background = { color: INK };
  text(s, 'HACKATHON 977-121', { x: M, y: 0.7, w: W, h: 0.35, fontSize: 12, color: '7FB6C9', charSpacing: 3, fontFace: MONO });
  text(s, 'CarePath', { x: M, y: 1.4, w: W, h: 1.4, fontSize: 64, bold: true, color: PAPER });
  text(s, 'ระบบนำทางในโรงพยาบาลและติดตามขั้นตอนการรักษา', { x: M, y: 3.0, w: W, h: 0.7, fontSize: 25, bold: true, color: PAPER });
  text(s, 'ผู้ป่วยรู้ตลอดทั้งวันว่าตอนนี้ต้องไปที่ไหน และไปยังไง', { x: M, y: 3.85, w: W, h: 0.5, fontSize: 16, color: SKY });
  text(s, 'ระบบสาธิตสำหรับโรงพยาบาลวชิระภูเก็ต', { x: M, y: 6.25, w: 6, h: 0.4, fontSize: 13, color: SKY });
  text(s, 'carepath-vachira.nuttawoot-star.workers.dev', { x: 6.7, y: 6.25, w: 6.0, h: 0.4, fontSize: 11, color: '5F97AA', fontFace: MONO, align: 'right' });
  s.addNotes('เปิดด้วยประโยคเดียว: วันนี้เรามาแก้ปัญหาที่ทุกคนในห้องนี้เคยเห็น — ผู้ป่วยยืนงงกลางโถงโรงพยาบาล');
}

/* ---------- 2 ปัญหา ---------- */
{
  const s = deck.addSlide();
  s.background = { color: PAPER };
  text(s, 'ป้ายบอกทางบอกได้แค่ว่า “ห้องนี้อยู่ไหน”\nไม่ได้บอกว่า “คุณต้องไปไหนต่อ”', { x: M, y: 0.6, w: W, h: 1.6, fontSize: 31, bold: true, color: INK, lineSpacingMultiple: 1.2 });
  const w = (W - 0.6) / 3;
  card(s, { x: M, y: 2.7, w, h: 2.6, title: 'ผู้ป่วยถือบัตรคิวแล้วเดินหลง', body: 'ลำดับขั้นอยู่ในหัวเจ้าหน้าที่ ไม่ได้อยู่ในมือผู้ป่วย' });
  card(s, { x: M + w + 0.3, y: 2.7, w, h: 2.6, title: 'ผู้สูงอายุและรถเข็นเดินย้อนไปมา', body: 'เส้นทางเดียวกันสำหรับทุกคน ทั้งที่บันไดไม่ใช่ทางเลือกของทุกคน' });
  card(s, { x: M + (w + 0.3) * 2, y: 2.7, w, h: 2.6, title: 'แรงงานต่างชาติอ่านป้ายไม่ออก', body: 'ภูเก็ตมีทั้งเมียนมา จีน และรัสเซีย แต่ป้ายมีสองภาษา' });
  s.addNotes('อย่าเล่ายาว ให้กรรมการที่เป็นคนโรงพยาบาลพยักหน้าเอง แล้วข้ามไป');
}

/* ---------- 3 วงจรสี่หน้าจอ ---------- */
{
  const s = deck.addSlide();
  s.background = { color: PAPER };
  text(s, 'สี่หน้าจอ ต่อกันเป็นวงจรเดียว', { x: M, y: 0.6, w: W, h: 0.8, fontSize: 31, bold: true, color: INK });
  const w = (W - 0.75) / 4;
  [
    ['01  เวชระเบียน', 'ถามความต้องการพิเศษครั้งเดียว แล้วพิมพ์บัตรคิวพร้อมคิวอาร์'],
    ['02  ผู้ป่วย', 'สแกนแล้วเห็นทันทีว่าไปไหนต่อ พร้อมเส้นทางทีละเลี้ยว'],
    ['03  จุดบริการ', 'เจ้าหน้าที่กดปุ่มเดียว ขั้นถัดไปเด้งขึ้นมือถือผู้ป่วยเอง'],
    ['04  ผู้ดูแลระบบ', 'แก้ผัง ปิดเส้นทาง และเห็นว่าการปิดนั้นกระทบใคร'],
  ].forEach(([title, body], i) => {
    card(s, { x: M + (w + 0.25) * i, y: 1.9, w, h: 3.0, title, body, line: PRIMARY, titleSize: 14 });
  });
  text(s, 'งานที่เพิ่มให้เจ้าหน้าที่ต่อผู้ป่วยหนึ่งคน คือการกดปุ่มสองวินาที', { x: M, y: 5.4, w: W, h: 0.5, fontSize: 17, bold: true, color: PRIMARY });
  s.addNotes('ย้ำข้อสุดท้าย ถ้าระบบเพิ่มภาระ เจ้าหน้าที่จะไม่กด แล้วระบบก็ตาย');
}

/* ---------- 4 แผนที่งอกจากข้อมูล ---------- */
{
  const s = deck.addSlide();
  s.background = { color: PAPER };
  text(s, 'แผนที่งอกจากข้อมูล ไม่ใช่รูปที่ล้าสมัยทันทีที่ย้ายห้อง', { x: M, y: 0.6, w: W, h: 0.9, fontSize: 29, bold: true, color: INK });
  text(s, 'โรงพยาบาลย้ายห้องทุกปี แต่ผังบนผนังไม่ได้ย้ายตาม ระบบนี้จึงเก็บแผนที่เป็นข้อมูลสองไฟล์', { x: M, y: 1.65, w: W, h: 0.5, fontSize: 15, color: MUTED });
  const w = (W - 0.6) / 3;
  card(s, { x: M, y: 2.5, w, h: 2.5, title: 'nodes.csv' });
  text(s, '50', { x: M + 0.26, y: 3.15, w: w - 0.52, h: 0.9, fontSize: 40, bold: true, color: INK, fontFace: MONO });
  text(s, 'จุดในผัง · 8 ชั้น · 3 อาคาร', { x: M + 0.26, y: 4.15, w: w - 0.52, h: 0.4, fontSize: 12, color: MUTED });
  card(s, { x: M + w + 0.3, y: 2.5, w, h: 2.5, title: 'edges.csv' });
  text(s, '105', { x: M + w + 0.56, y: 3.15, w: w - 0.52, h: 0.9, fontSize: 40, bold: true, color: INK, fontFace: MONO });
  text(s, 'ทิศทางเดิน พร้อมระยะและเวลา', { x: M + w + 0.56, y: 4.15, w: w - 0.52, h: 0.4, fontSize: 12, color: MUTED });
  card(s, { x: M + (w + 0.3) * 2, y: 2.5, w, h: 2.5, fill: PRIMARY_SOFT, line: PRIMARY,
    title: 'แก้สองไฟล์นี้แล้วเปลี่ยนตามทั้งหมด',
    body: 'แผนที่รวม · แผนที่รายชั้น · แผนที่ผู้ป่วย · คำสั่งนำทาง · การตรวจผังอัตโนมัติ — โดยไม่ต้องแก้โค้ดสักบรรทัด',
    bodyColor: '2C4C57' });
  s.addNotes('ขายจุดนี้กับฝ่ายอาคารสถานที่ เขาคือคนที่รู้ว่าผังเปลี่ยนบ่อยแค่ไหน');
}

/* ---------- 5 เส้นทางคิดจากคน ---------- */
{
  const s = deck.addSlide();
  s.background = { color: PAPER };
  text(s, 'เส้นทางคิดจากคน ไม่ใช่จากระยะทาง', { x: M, y: 0.6, w: W, h: 0.8, fontSize: 31, bold: true, color: INK });
  text(s, 'สถานการณ์เดียวกัน จุดคัดกรองไปห้องเจาะเลือด ตอนลิฟต์ B ปิดซ่อม ระบบให้คำตอบคนละแบบ', { x: M, y: 1.5, w: W, h: 0.5, fontSize: 15, color: MUTED });
  s.addTable([
    [{ text: 'ใคร' }, { text: 'ระบบเลือกทางไหน' }, { text: 'ระยะทาง' }, { text: 'ช่วงที่ต้องเดิน' }],
    ['คนเดินปกติ', 'บันได B', '136 ม.', '3'],
    ['ผู้ใช้รถเข็น', 'อ้อมทางเชื่อมและทางลาดอาคาร C', '331 ม.', '5'],
  ], {
    x: M, y: 2.3, w: W, colW: [2.6, 5.5, 2.0, 1.99],
    fontFace: TH, fontSize: 14, color: INK, bold: false,
    border: { type: 'solid', color: 'D7E3E7', pt: 1 },
    fill: { color: WHITE }, rowH: 0.6, valign: 'middle', margin: 8,
  });
  text(s, 'คำนวณสดด้วย Dijkstra ทุกครั้งที่เปิดหน้า ไม่ได้วาดเส้นทางทิ้งไว้ล่วงหน้า\nปิดลิฟต์บนจอแล้วเส้นบนแผนที่เปลี่ยนให้เห็นกับตา',
    { x: M, y: 4.7, w: W, h: 1.0, fontSize: 16, bold: true, color: PRIMARY, lineSpacingMultiple: 1.35 });
  s.addNotes('ตรงนี้เปิด map.html สาธิตสดได้ กดปุ่มปิดลิฟต์ B แล้วชี้ให้ดูว่าเส้นเปลี่ยน');
}

/* ---------- 6 ต้นทุนการเข้าถึง ---------- */
{
  const s = deck.addSlide();
  s.background = { color: INK };
  text(s, 'จุดแข็งที่ยังไม่มีใครทำ', { x: M, y: 0.55, w: W, h: 0.35, fontSize: 12, color: '7FB6C9', charSpacing: 3, fontFace: MONO });
  text(s, 'ปิดลิฟต์หนึ่งตัว กระทบคนไม่เท่ากัน\nและคนที่กดปิดมองไม่เห็น', { x: M, y: 1.05, w: W, h: 1.5, fontSize: 31, bold: true, color: PAPER, lineSpacingMultiple: 1.2 });
  const w = (W - 0.6) / 3;
  const box = (x, fill, line, label, value, unit, valueColor, labelColor) => {
    s.addShape(deck.ShapeType.roundRect, {
      x, y: 2.95, w, h: 2.35, fill: { color: fill },
      line: { color: line ?? fill, width: line ? 2 : 1 }, rectRadius: 0.12,
    });
    text(s, label, { x: x + 0.28, y: 3.18, w: w - 0.56, h: 0.4, fontSize: 13, bold: true, color: labelColor });
    text(s, value, { x: x + 0.28, y: 3.7, w: w - 0.56, h: 0.95, fontSize: 42, bold: true, color: valueColor, fontFace: MONO });
    text(s, unit, { x: x + 0.28, y: 4.72, w: w - 0.56, h: 0.4, fontSize: 12, color: labelColor });
  };
  box(M, '17323D', null, 'คนเดินปกติ ต้องเดินเพิ่ม', '+8', 'เมตร', PAPER, SKY);
  box(M + w + 0.3, '3A1F16', 'EF8E6B', 'ผู้ใช้รถเข็น ต้องเดินเพิ่ม', '+203', 'เมตร', 'EF8E6B', 'F0B39C');
  box(M + (w + 0.3) * 2, '17323D', null, 'ต่างกัน', '25x', 'เท่า · จากการปิดจุดเดียว', 'E0A84A', SKY);
  text(s, 'ระบบคำนวณให้ก่อนกดยืนยัน · ปิดลิฟต์อีกตัวหนึ่ง ผู้ใช้รถเข็นไปไม่ถึงเลย 32 เส้นทาง ขณะที่คนเดินอ้อมแค่ 6 เมตร',
    { x: M, y: 5.6, w: W, h: 0.6, fontSize: 13, color: '7FB6C9' });
  s.addNotes('สไลด์ที่ควรหยุดนานที่สุด · ตัวเลขคำนวณจากผังจริงในระบบ ถ้าถูกถามให้เปิด impact.html ดูสด');
}

/* ---------- 7 แผนเป็นกราฟ ---------- */
{
  const s = deck.addSlide();
  s.background = { color: PAPER };
  text(s, 'แผนของผู้ป่วยเป็นกราฟ ไม่ใช่รายการเรียงบรรทัด', { x: M, y: 0.6, w: W, h: 0.8, fontSize: 29, bold: true, color: INK });
  const w = (W - 0.35) / 2;
  card(s, { x: M, y: 1.7, w, h: 2.3, title: 'ขั้นที่ไม่ผูกเงื่อนไขกัน สลับก่อนหลังได้',
    body: '“ชั่งน้ำหนัก” กับ “เจาะเลือด” ต่างก็ทำหลังยื่นบัตรได้ทั้งคู่ ระบบจึงเลือกได้ว่าจะไปไหนก่อน' });
  card(s, { x: M + w + 0.35, y: 1.7, w, h: 2.3, fill: AMBER_SOFT, line: AMBER,
    title: 'ผู้ป่วยงดอาหารมา ต้องเจาะเลือดก่อน 11:00',
    body: 'มาถึง 10:40 เวลาไม่พอถ้าเดินตามลำดับปกติ ระบบยกเจาะเลือดขึ้นมาก่อน พร้อมบอกเหตุผลกับผู้ป่วยตรง ๆ',
    bodyColor: '5C4A22' });
  s.addShape(deck.ShapeType.roundRect, { x: M, y: 4.35, w: W, h: 1.65, fill: { color: INK }, line: { color: INK, width: 1 }, rectRadius: 0.12 });
  text(s, '+256 ม.', { x: M + 0.35, y: 4.85, w: 2.5, h: 0.8, fontSize: 30, bold: true, color: 'E0A84A', fontFace: MONO });
  text(s, 'การสลับลำดับนี้ทำให้เดินไกลขึ้น ไม่ใช่สั้นลง — ระบบยอมแลก เพื่อไม่ให้ผู้ป่วยอดข้าวมาเสียเปล่าแล้วต้องกลับมาใหม่อีกวัน',
    { x: M + 3.1, y: 4.7, w: W - 3.5, h: 1.0, fontSize: 15, color: 'CFE3EA', lineSpacingMultiple: 1.35 });
  s.addNotes('ระบบเลือกสิ่งที่ถูกต้อง ไม่ใช่สิ่งที่วัดง่าย ถ้าไม่พูดเอง กรรมการจะนึกว่าเราแค่หาทางสั้นสุด');
}

/* ---------- 8 คนไม่มีมือถือ ---------- */
{
  const s = deck.addSlide();
  s.background = { color: PAPER };
  text(s, 'ออกแบบให้คนที่ไม่มีมือถือใช้ได้จริง ไม่ใช่เขียนไว้ในสไลด์', { x: M, y: 0.6, w: W, h: 0.9, fontSize: 29, bold: true, color: INK });
  const w = (W - 0.75) / 4;
  [
    ['บัตรกระดาษพิมพ์ครบ', 'เลขคิว คิวอาร์ รหัส 8 ตัว และขั้นตอนทั้งวัน อยู่บนบัตรใบเดียว', WHITE, 'D7E3E7'],
    ['พิมพ์รหัสแทนสแกน', 'กล้องเสียหรือบัตรเปียก พิมพ์รหัสที่หน้าแรกของระบบได้', WHITE, 'D7E3E7'],
    ['โต๊ะช่วยเหลือ', 'เดินมาถามแล้วแจ้งเลขคิว เจ้าหน้าที่ยืนยันตำแหน่งให้ได้ทันที', WHITE, 'D7E3E7'],
    ['พิมพ์ใบเส้นทางให้', 'คำสั่งเลี้ยวทีละข้อ ปรับตามรถเข็นของคนนั้น ถือเดินได้เลย', PRIMARY_SOFT, PRIMARY],
  ].forEach(([title, body, fill, line], i) => {
    card(s, { x: M + (w + 0.25) * i, y: 1.9, w, h: 3.0, title, body, fill, line, titleSize: 14 });
  });
  text(s, 'ผู้ป่วยที่ปฏิเสธใช้ระบบนี้ ยังได้รับบริการเท่าเดิมทุกอย่าง', { x: M, y: 5.4, w: W, h: 0.5, fontSize: 17, bold: true, color: PRIMARY });
  s.addNotes('ประมาณ 30% ของผู้ป่วยโรงพยาบาลรัฐไม่ใช้สมาร์ตโฟน ถ้าระบบใช้ได้เฉพาะคนมีมือถือ ก็แก้ปัญหาให้คนที่เดือดร้อนน้อยที่สุด');
}

/* ---------- 9 ห้าภาษา ---------- */
{
  const s = deck.addSlide();
  s.background = { color: PRIMARY };
  text(s, 'ห้าภาษา รวมภาษาเมียนมา\nซึ่งคือแรงงานส่วนใหญ่ในภูเก็ต', { x: M, y: 0.7, w: W, h: 1.6, fontSize: 31, bold: true, color: WHITE, lineSpacingMultiple: 1.2 });
  const w = (W - 0.8) / 5;
  [['ไทย', 'ฉบับอ้างอิง'], ['English', 'นักท่องเที่ยว'], ['中文', 'จีน'], ['မြန်မာ', 'เมียนมา'], ['Русский', 'รัสเซีย']]
    .forEach(([name, who], i) => {
      const x = M + (w + 0.2) * i;
      s.addShape(deck.ShapeType.roundRect, { x, y: 2.7, w, h: 1.4, fill: { color: '17566C' }, line: { color: '17566C', width: 1 }, rectRadius: 0.1 });
      text(s, name, { x: x + 0.2, y: 2.95, w: w - 0.4, h: 0.5, fontSize: 18, bold: true, color: WHITE });
      text(s, who, { x: x + 0.2, y: 3.5, w: w - 0.4, h: 0.35, fontSize: 11, color: 'BFDDE7' });
    });
  text(s, '64', { x: M, y: 4.6, w: 1.4, h: 0.9, fontSize: 42, bold: true, color: WHITE, fontFace: MONO });
  text(s, 'ข้อความต่อภาษา — คำสั่งนำทางไม่ได้เขียนเป็นประโยคตายตัว แต่ประกอบจากข้อมูลเส้นทาง เพิ่มภาษาที่หกจึงแปลแค่ชุดนี้ชุดเดียว ไม่ต้องแตะผังเลย',
    { x: M + 1.65, y: 4.6, w: W - 1.65, h: 1.1, fontSize: 15, color: 'D6EAF1', lineSpacingMultiple: 1.35 });
  s.addNotes('ลูกศร ไอคอน และตัวเลขไม่ต้องแปล นั่นคือเหตุผลที่ออกแบบให้สัญลักษณ์มาก่อนภาษาตั้งแต่ต้น');
}

/* ---------- 10 PDPA ---------- */
{
  const s = deck.addSlide();
  s.background = { color: PAPER };
  text(s, 'ข้อมูลที่ไม่ได้เก็บ คือข้อมูลที่รั่วไม่ได้', { x: M, y: 0.6, w: W, h: 0.8, fontSize: 31, bold: true, color: INK });
  const w = (W - 0.6) / 3;
  card(s, { x: M, y: 1.8, w, h: 3.2, fill: OK_SOFT, line: OK, title: 'ตาราง patients มีสามคอลัมน์',
    body: '• เลขประจำตัวผู้ป่วย\n• ชื่อที่ใช้เรียก\n• ภาษาที่อ่านได้', bodyColor: '20503A' });
  card(s, { x: M + w + 0.3, y: 1.8, w, h: 3.2, title: 'ไม่เก็บเลย',
    body: '• เลขบัตรประชาชน เบอร์โทร ที่อยู่\n• ผลตรวจ การวินิจฉัย ประวัติการรักษา\n• พิกัด GPS และรูปถ่ายของผู้ป่วย' });
  card(s, { x: M + (w + 0.3) * 2, y: 1.8, w, h: 3.2, title: 'มาตรการในโค้ด',
    body: '• บันทึกการเข้าถึงแก้และลบไม่ได้\n• ลิงก์ผู้ป่วยสุ่มและหมดอายุสิ้นวัน\n• จอสาธารณะมีแค่เลขคิว\n• ประกาศความเป็นส่วนตัวครบห้าภาษา' });
  text(s, 'ข้อมูลความต้องการพิเศษอาจเข้าข่ายข้อมูลอ่อนไหวตามมาตรา 26 ซึ่งต้องมีฐานทางกฎหมายเฉพาะ — ต้องยืนยันกับเจ้าหน้าที่คุ้มครองข้อมูลของโรงพยาบาล',
    { x: M, y: 5.3, w: W, h: 0.7, fontSize: 13, color: MUTED, lineSpacingMultiple: 1.3 });
  s.addNotes('ถ้าถูกถามว่าขึ้นใช้จริงได้เลยไหม ตอบตรงว่ายัง กลไกทางเทคนิคพร้อม แต่ยังขาดเอกสารและกระบวนการที่ PDPA บังคับ');
}

/* ---------- 11 ความซื่อสัตย์ ---------- */
{
  const s = deck.addSlide();
  s.background = { color: INK };
  text(s, 'สิ่งที่เราวัดแล้วไม่จริง จึงไม่เอามาอ้าง', { x: M, y: 1.0, w: W, h: 0.4, fontSize: 12, color: '7FB6C9', charSpacing: 3, fontFace: MONO });
  text(s, 'เราเคยคิดว่าระบบจะช่วยลดระยะเดิน\nวัดแล้วได้ศูนย์เปอร์เซ็นต์', { x: M, y: 1.65, w: W, h: 1.7, fontSize: 36, bold: true, color: PAPER, lineSpacingMultiple: 1.2 });
  text(s, 'ลำดับในแม่แบบบังเอิญเป็นลำดับที่สั้นที่สุดอยู่แล้ว ทั้งสองแบบได้ 616 เมตรเท่ากัน เราจึงตัดข้อนี้ออกจากทุกหน้าจอและทุกสไลด์ และบันทึกเหตุผลไว้ในประวัติการแก้โค้ด',
    { x: M, y: 3.65, w: W, h: 1.0, fontSize: 16, color: 'CFE3EA', lineSpacingMultiple: 1.4 });
  text(s, 'ด้วยเหตุผลเดียวกัน ทุกหน้าจอเขียนกำกับว่าผังชุดนี้เป็นผังสาธิต ไม่ใช่ผังจริงของโรงพยาบาลวชิระภูเก็ต และภาพประกอบก็ติดป้ายว่าไม่ใช่ภาพถ่ายจริง',
    { x: M, y: 4.9, w: W, h: 1.0, fontSize: 16, color: SKY, lineSpacingMultiple: 1.4 });
  s.addNotes('จุดแข็งที่แท้จริงเวลาคุยกับคนโรงพยาบาล ทุกทีมจะพูดแต่ข้อดี ทีมที่กล้าบอกว่าอะไรไม่จริง คือทีมที่เชื่อตัวเลขที่เหลือได้');
}

/* ---------- 12 สถานะ ---------- */
{
  const s = deck.addSlide();
  s.background = { color: PAPER };
  text(s, 'สถานะจริงของระบบวันนี้', { x: M, y: 0.6, w: W, h: 0.8, fontSize: 31, bold: true, color: INK });
  const w = (W - 0.35) / 2;
  card(s, { x: M, y: 1.7, w, h: 3.9, fill: OK_SOFT, line: OK, title: 'ใช้งานได้จริงแล้ว',
    body: '• หน้าผู้ป่วยห้าภาษา พร้อมแผนที่ทีละชั้น\n• เวชระเบียน เปิด visit และพิมพ์บัตรคิว\n• จอจุดบริการที่ผูกกับมือถือผู้ป่วยจริง\n• โต๊ะช่วยเหลือ และการแจ้งเส้นทางชำรุด\n• ผังเส้นทางและผลกระทบเมื่อปิดเส้นทาง\n• โครงสร้างฐานข้อมูล 17 ตาราง และอัลกอริทึม',
    bodyColor: '20503A' });
  card(s, { x: M + w + 0.35, y: 1.7, w, h: 3.9, title: 'ยังเป็นแบบหน้าจอ และยังไม่ได้ทำ',
    body: '• นำเข้าผังจากไฟล์ CSV\n• ภาพรวมผู้บริหารและจุดคอขวด\n• จอเรียกคิวหน้าห้องตรวจ\n• ผู้ใช้และสิทธิ์ · บันทึกการใช้งาน\n• REST API ที่ต่อฐานข้อมูลจริง' });
  text(s, 'ทุกเมนูในระบบติดป้ายไว้ตามความจริง กดแล้วไม่เงียบ', { x: M, y: 5.85, w: W, h: 0.4, fontSize: 13, color: MUTED });
  s.addNotes('บอกสถานะตรง ๆ ดีกว่าให้กรรมการกดเจอเอง ถ้าถามว่าทำไมยังไม่มี API ตอบเรื่องข้อจำกัดของ Cloudflare Workers สามข้อที่บันทึกไว้ใน README');
}

/* ---------- 13 สิ่งที่ขอ ---------- */
{
  const s = deck.addSlide();
  s.background = { color: PAPER };
  text(s, 'สิ่งที่เราขอจากโรงพยาบาล', { x: M, y: 0.6, w: W, h: 0.8, fontSize: 31, bold: true, color: INK });
  const w = (W - 0.6) / 3;
  [
    ['01  ผังจริงหนึ่งชุด', 'ชื่ออาคาร ชั้น แผนก และห้อง แม้เป็นรูปถ่ายป้ายผังหน้าโรงพยาบาลก็พอ นำเข้าได้ทันที'],
    ['02  หนึ่งแผนกทดลองใช้', 'เริ่มที่แผนกเดียวที่ผู้ป่วยหลงบ่อยที่สุด วัดเวลารอก่อนและหลัง แล้วค่อยขยาย'],
    ['03  คนของโรงพยาบาลร่วมตรวจ', 'เจ้าหน้าที่คุ้มครองข้อมูลตรวจประกาศความเป็นส่วนตัว และฝ่ายอาคารตรวจผัง'],
  ].forEach(([title, body], i) => {
    card(s, { x: M + (w + 0.3) * i, y: 1.8, w, h: 2.9, title, body, line: PRIMARY, titleSize: 14 });
  });
  text(s, 'ทั้งหมดนี้ไม่ต้องรื้อระบบเดิมของโรงพยาบาล เพราะ CarePath ไม่แตะเวชระเบียนอิเล็กทรอนิกส์ ไม่เก็บผลตรวจ และทำงานคู่ขนานกับบัตรคิวกระดาษที่ใช้อยู่',
    { x: M, y: 5.1, w: W, h: 0.9, fontSize: 15, bold: true, color: PRIMARY, lineSpacingMultiple: 1.35 });
  s.addNotes('ปิดด้วยข้อสุดท้าย เพราะคำถามแรกของโรงพยาบาลคือ ต้องเปลี่ยนระบบเดิมไหม');
}

/* ---------- 14 ปิด ---------- */
{
  const s = deck.addSlide();
  s.background = { color: INK };
  text(s, 'ผู้ป่วยไม่ควรต้องเก่งเรื่องโรงพยาบาล\nเพื่อจะได้รับการรักษา', { x: M, y: 1.4, w: W, h: 1.9, fontSize: 38, bold: true, color: PAPER, lineSpacingMultiple: 1.2 });
  text(s, 'ระบบเปิดใช้ได้เลยจากมือถือทุกเครื่อง ไม่ต้องติดตั้งแอป ไม่ต้องสมัครสมาชิก', { x: M, y: 3.6, w: W, h: 0.5, fontSize: 17, color: SKY });
  const w = (W - 0.35) / 2;
  [['ลองใช้ระบบ', 'carepath-vachira.nuttawoot-star.workers.dev'],
   ['บัญชีสาธิตทุกบทบาท', 'admin · reg1 · lab1 · exec1 / demo@1234']]
    .forEach(([label, value], i) => {
      const x = M + (w + 0.35) * i;
      s.addShape(deck.ShapeType.roundRect, { x, y: 4.9, w, h: 1.3, fill: { color: '17323D' }, line: { color: '17323D', width: 1 }, rectRadius: 0.12 });
      text(s, label, { x: x + 0.3, y: 5.12, w: w - 0.6, h: 0.35, fontSize: 12, color: '7FB6C9' });
      text(s, value, { x: x + 0.3, y: 5.55, w: w - 0.6, h: 0.5, fontSize: 13, bold: true, color: PAPER, fontFace: MONO });
    });
  s.addNotes('จบด้วยประโยคนี้แล้วหยุด อย่าต่อท้าย ถ้ามีเวลาเหลือให้เปิดระบบจริงสาธิตแทนการพูด');
}

await deck.writeFile({ fileName: 'CarePath-pitch.pptx' });
console.log('สร้าง CarePath-pitch.pptx แล้ว · 14 สไลด์');
