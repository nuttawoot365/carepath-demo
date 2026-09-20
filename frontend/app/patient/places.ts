/**
 * สถานที่ · ชื่อห้องแปลครบทุกภาษา ส่วนไอคอนกับอาคาร/ชั้นไม่ต้องแปล
 * จุดที่ไม่ได้อยู่ในรายการนี้ เรียนรู้เพิ่มจาก GET /api/map ตอนเปิดหน้า
 */
import type { MapNode } from '@/lib/types';

export interface Place {
  icon: string;
  building: string;
  floor: number;
  th: string;
  en: string;
  zh: string;
  my: string;
  ru: string;
  [lang: string]: string | number;
}

export interface Scene {
  kind: string;
  color: string;
  prop?: string;
}

const BASE_PLACES: Record<string, Place> = {
  'A1-REG':  { icon: '🪪', building: 'A', floor: 1, th: 'เวชระเบียน', en: 'Registration', zh: '挂号处', my: 'မှတ်ပုံတင်ဌာန', ru: 'Регистратура' },
  'A1-INFO': { icon: 'ℹ️', building: 'A', floor: 1, th: 'ประชาสัมพันธ์', en: 'Information desk', zh: '咨询台', my: 'အချက်အလက်ကောင်တာ', ru: 'Справочная' },
  'A1-CAFE': { icon: '☕', building: 'A', floor: 1, th: 'ร้านกาแฟ', en: 'Café', zh: '咖啡厅', my: 'ကော်ဖီဆိုင်', ru: 'Кафе' },
  'A1-PAY':  { icon: '💳', building: 'A', floor: 1, th: 'การเงิน', en: 'Cashier', zh: '收费处', my: 'ငွေပေးချေရန် ကောင်တာ', ru: 'Касса' },
  'A1-PHA':  { icon: '💊', building: 'A', floor: 1, th: 'ห้องยา', en: 'Pharmacy', zh: '药房', my: 'ဆေးထုတ်ပေးဌာန', ru: 'Аптека' },
  'A2-SCR':  { icon: '🩺', building: 'A', floor: 2, th: 'จุดคัดกรอง', en: 'Screening', zh: '分诊台', my: 'စစ်ဆေးရေးဌာန', ru: 'Пункт осмотра' },
  'B1-XR':   { icon: '📷', building: 'B', floor: 1, th: 'ห้องเอกซเรย์', en: 'X-ray', zh: '放射科', my: 'ဓာတ်မှန်ခန်း', ru: 'Рентген' },
  'B3-LAB':  { icon: '🩸', building: 'B', floor: 3, th: 'ห้องเจาะเลือด', en: 'Blood test', zh: '抽血室', my: 'သွေးစစ်ခန်း', ru: 'Забор крови' },
  'B3-WAIT': { icon: '🪑', building: 'B', floor: 3, th: 'จุดพักคอยรอผล', en: 'Lab waiting area', zh: '检验等候区', my: 'စောင့်ဆိုင်းခန်း', ru: 'Зона ожидания' },
  'C4-MED':  { icon: '👨‍⚕️', building: 'C', floor: 4, th: 'คลินิกอายุรกรรม', en: 'Internal medicine', zh: '内科门诊', my: 'အတွင်းရောဂါဌာန', ru: 'Терапия' },

  // จุดอ้างอิงระหว่างทาง
  'LIFT-A':  { icon: '🛗', building: 'A', floor: 1, th: 'ลิฟต์ A', en: 'Lift A', zh: 'A 座电梯', my: 'A ဓာတ်လှေကား', ru: 'лифт A' },
  'LIFT-B':  { icon: '🛗', building: 'B', floor: 2, th: 'ลิฟต์ B', en: 'Lift B', zh: 'B 座电梯', my: 'B ဓာတ်လှေကား', ru: 'лифт B' },
  'LIFT-C':  { icon: '🛗', building: 'C', floor: 2, th: 'ลิฟต์ C', en: 'Lift C', zh: 'C 座电梯', my: 'C ဓာတ်လှေကား', ru: 'лифт C' },
  'RAMP-C':  { icon: '♿', building: 'C', floor: 2, th: 'ทางลาด C', en: 'the Building C ramp', zh: 'C 座坡道', my: 'C လျှောလမ်း', ru: 'пандус корпуса C' },
  'LOBBY-A2': { icon: '🛗', building: 'A', floor: 2, th: 'โถงลิฟต์ A ชั้น 2', en: 'the Lift A lobby, 2F', zh: 'A 座 2 层电梯厅', my: 'A ဓာတ်လှေကား ခန်းမ (2 လွှာ)', ru: 'холл лифта A, 2 этаж' },
  'LOBBY-B3': { icon: '🛗', building: 'B', floor: 3, th: 'โถงลิฟต์ B ชั้น 3', en: 'the Lift B lobby, 3F', zh: 'B 座 3 层电梯厅', my: 'B ဓာတ်လှေကား ခန်းမ (3 လွှာ)', ru: 'холл лифта B, 3 этаж' },
  'LOBBY-C4': { icon: '🪧', building: 'C', floor: 4, th: 'หน้าลิฟต์ C ชั้น 4', en: 'the Lift C lobby, 4F', zh: 'C 座 4 层电梯厅', my: 'C ဓာတ်လှေကား ခန်းမ (4 လွှာ)', ru: 'холл лифта C, 4 этаж' },
  // จุดอื่นในโรงพยาบาล — แผนกและบริการที่ผู้ป่วยอาจต้องไป แม้ไม่ได้อยู่ในเส้นทางของวันนี้
  'A1-ENT':     { icon: '🚪', building: 'A', floor: 1, th: 'ทางเข้าหลัก', en: 'Main entrance', zh: '正门', my: 'ပင်မဝင်ပေါက်', ru: 'Главный вход' },
  'A1-APT':     { icon: '📅', building: 'A', floor: 1, th: 'จุดนัดหมาย', en: 'Appointment desk', zh: '预约处', my: 'ချိန်းဆိုမှု ကောင်တာ', ru: 'Запись на приём' },
  'A1-ATM':     { icon: '🏧', building: 'A', floor: 1, th: 'ตู้เอทีเอ็ม', en: 'ATM', zh: '自动取款机', my: 'ATM စက်', ru: 'Банкомат' },
  'A2-GP':      { icon: '👨‍⚕️', building: 'A', floor: 2, th: 'ห้องตรวจทั่วไป', en: 'General clinic', zh: '普通门诊', my: 'အထွေထွေ ဆေးခန်း', ru: 'Общая клиника' },
  'C4-MED-401': { icon: '🚪', building: 'C', floor: 4, th: 'ห้องตรวจ 401', en: 'Room 401', zh: '401 诊室', my: 'ဆေးခန်း 401', ru: 'Кабинет 401' },
  'C4-MED-403': { icon: '🚪', building: 'C', floor: 4, th: 'ห้องตรวจ 403', en: 'Room 403', zh: '403 诊室', my: 'ဆေးခန်း 403', ru: 'Кабинет 403' },
  'A1-WC':      { icon: '🚻', building: 'A', floor: 1, th: 'ห้องน้ำชั้น 1', en: 'Toilet, 1F', zh: '1 层洗手间', my: 'အိမ်သာ (1 လွှာ)', ru: 'Туалет, 1 этаж' },
  'A2-WC':      { icon: '🚻', building: 'A', floor: 2, th: 'ห้องน้ำชั้น 2', en: 'Toilet, 2F', zh: '2 层洗手间', my: 'အိမ်သာ (2 လွှာ)', ru: 'Туалет, 2 этаж' },
  'B3-WC':      { icon: '🚻', building: 'B', floor: 3, th: 'ห้องน้ำชั้น 3', en: 'Toilet, 3F', zh: '3 层洗手间', my: 'အိမ်သာ (3 လွှာ)', ru: 'Туалет, 3 этаж' },
  'C4-WC':      { icon: '🚻', building: 'C', floor: 4, th: 'ห้องน้ำชั้น 4', en: 'Toilet, 4F', zh: '4 层洗手间', my: 'အိမ်သာ (4 လွှာ)', ru: 'Туалет, 4 этаж' },
  'A1-STAIR':   { icon: '🪜', building: 'A', floor: 1, th: 'บันได A', en: 'Stairs A', zh: 'A 座楼梯', my: 'A လှေကား', ru: 'Лестница A' },
  'B2-STAIR':   { icon: '🪜', building: 'B', floor: 2, th: 'บันได B', en: 'Stairs B', zh: 'B 座楼梯', my: 'B လှေကား', ru: 'Лестница B' },
  'BRIDGE':  { icon: '🌉', building: 'A', floor: 2, th: 'ทางเชื่อม', en: 'the bridge', zh: '连廊', my: 'ချိတ်ဆက်လမ်း', ru: 'переход' },
};

// จุดที่ขึ้นก่อนในแผ่น "ตอนนี้คุณอยู่ตรงไหน" — จุดอื่นเลือกได้เหมือนกัน API คิดเส้นทางให้ทุกคู่
export const NEARBY = ['A1-ENT', 'A1-REG', 'A2-SCR', 'B3-LAB', 'B3-WAIT', 'C4-MED', 'B1-XR', 'A1-PAY'];

/**
 * รูปของแต่ละจุด
 * ระบบจริงเก็บที่ตาราง node_photos (node_id, url, caption_th, caption_en)
 * ต้นแบบนี้วาดภาพจำลองด้วย canvas ให้ครบทุกจุด และให้ถ่ายรูปจริงทับได้จากมือถือ
 */
export const SCENES: Record<string, Scene> = {
  'A1-REG':   { kind: 'counter', color: '#0f766e', prop: 'plant' },
  'A1-INFO':  { kind: 'counter', color: '#0369a1' },
  'A1-CAFE':  { kind: 'counter', color: '#7c2d12', prop: 'plant' },
  'A1-PAY':   { kind: 'counter', color: '#b45309' },
  'A1-PHA':   { kind: 'counter', color: '#7c3aed' },
  'A2-SCR':   { kind: 'counter', color: '#0369a1', prop: 'water' },
  'B1-XR':    { kind: 'door',    color: '#475569' },
  'B3-LAB':   { kind: 'door',    color: '#be123c', prop: 'water' },
  'B3-WAIT':  { kind: 'seats',   color: '#be123c' },
  'C4-MED':   { kind: 'door',    color: '#166534' },
  'LIFT-A':   { kind: 'lift',    color: '#1f6f8b' },
  'LIFT-B':   { kind: 'lift',    color: '#1f6f8b' },
  'LIFT-C':   { kind: 'lift',    color: '#1f6f8b' },
  'LOBBY-A2': { kind: 'lift',    color: '#1f6f8b' },
  'LOBBY-B3': { kind: 'lift',    color: '#1f6f8b' },
  'LOBBY-C4': { kind: 'lift',    color: '#166534', prop: 'plant' },
  'RAMP-C':   { kind: 'ramp',    color: '#166534' },
  'BRIDGE':   { kind: 'bridge',  color: '#0369a1' },
  'A1-ENT':     { kind: 'entrance', color: '#0f766e', prop: 'plant' },
  'A1-APT':     { kind: 'desk',     color: '#0f766e' },
  'A1-ATM':     { kind: 'atm',      color: '#b45309' },
  'A2-GP':      { kind: 'exam',     color: '#15803d' },
  'C4-MED-401': { kind: 'exam',     color: '#166534' },
  'C4-MED-403': { kind: 'exam',     color: '#166534' },
  'A1-WC':      { kind: 'toilet',   color: '#475569' },
  'A2-WC':      { kind: 'toilet',   color: '#475569' },
  'B3-WC':      { kind: 'toilet',   color: '#475569' },
  'C4-WC':      { kind: 'toilet',   color: '#475569' },
  'A1-STAIR':   { kind: 'stairs',   color: '#b45309' },
  'B2-STAIR':   { kind: 'stairs',   color: '#b45309' },
};

/**
 * ภาพประกอบที่เตรียมไว้ล่วงหน้าสำหรับบางจุด
 * ยังไม่ใช่ภาพถ่ายของโรงพยาบาลจริง จึงติดป้ายว่าภาพประกอบเหมือนภาพที่ระบบวาดเอง
 * เมื่อถ่ายรูปสถานที่จริงมาทับ จะขึ้นป้ายเขียวว่าเป็นรูปถ่ายจริงแทน
 */
export const STOCK_PHOTOS: Record<string, string> = {
  'A1-REG': '/photos/registration.jpg',
  'A1-PAY': '/photos/cashier.jpg',
  'B1-XR': '/photos/xray.jpg',
  'LIFT-A': '/photos/lift.jpg',
  'LIFT-B': '/photos/lift.jpg',
  'LIFT-C': '/photos/lift.jpg',
  'LOBBY-A2': '/photos/lift.jpg',
  'LOBBY-B3': '/photos/lift.jpg',
  'LOBBY-C4': '/photos/lift.jpg',
};

/** ชื่อจุดในภาษาอื่นยังไม่มีในฐานข้อมูล จึงถอยไปใช้ชื่ออังกฤษ (ข้อจำกัดที่รู้ตัว) */
export function placesWith(nodes: MapNode[]): Record<string, Place> {
  const places: Record<string, Place> = { ...BASE_PLACES };
  for (const node of nodes) {
    if (places[node.code]) continue;
    const en = node.name_en || node.name_th || node.code;
    places[node.code] = {
      icon: node.icon ?? '📍',
      building: node.building,
      floor: node.floor,
      th: node.name_th || en,
      en, zh: en, my: en, ru: en,
    };
  }
  return places;
}

export const BASE = BASE_PLACES;
