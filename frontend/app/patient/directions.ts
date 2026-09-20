/** ประกอบประโยคนำทางจากข้อมูลเส้นทาง · ภาษาไหนก็ใช้ฟังก์ชันเดียวกัน */
import { DICT, sentenceCase } from './i18n';
import type { Place } from './places';
import type { WalkLeg } from './model';

const ARROW: Record<string, string> = {
  left: '⬅', right: '➡', straight: '⬆', back: '⬇',
  up: '▲', down: '▼', bridge: '🌉',
};

export type Translate = (key: string, params?: Record<string, unknown>) => string;

export function legArrow(leg: WalkLeg): string {
  if (leg.act === 'bridge') return ARROW.bridge;
  if (leg.act === 'lift' || leg.act === 'ramp') return ARROW[leg.dir ?? 'up'];
  return ARROW[leg.turn] ?? ARROW.straight;
}

export function legIcon(leg: WalkLeg, places: Record<string, Place>): string | null {
  if (leg.arrive) return String(places[leg.arrive]?.icon ?? '📍');
  if (leg.act === 'lift') return '🛗';
  if (leg.act === 'ramp') return '♿';
  if (leg.act === 'bridge') return '🌉';
  return null;
}

export interface Phrasebook {
  lang: string;
  t: Translate;
  placeName: (code: string | null) => string;
}

/** ข้อความหลักของคำสั่งหนึ่งข้อ */
export function legText(leg: WalkLeg, { lang, t, placeName }: Phrasebook): string {
  const join = DICT[lang]?.join ?? DICT.th.join;

  if (leg.act === 'lift' || leg.act === 'ramp') {
    return sentenceCase(lang, t(`${leg.act}_${leg.dir}`, { name: placeName(leg.name), floor: leg.floor }));
  }
  if (leg.act === 'bridge') {
    return sentenceCase(lang, t('bridge', { building: leg.building, floor: leg.floor }));
  }

  const parts = [t(`turn.${leg.turn}`)];
  if (leg.turn !== 'straight' || leg.m > 0) parts.push(t('walk', { m: leg.m }));
  if (leg.to) parts.push(t('toward', { to: placeName(leg.to) }));
  if (leg.arrive) parts.push(t(`arrive_${leg.side}`, { name: placeName(leg.arrive) }));

  return sentenceCase(lang, parts.join(join));
}

export const legHint = (leg: WalkLeg, t: Translate, ticket: string): string =>
  leg.hint ? t(`hint.${leg.hint}`, { ticket }) : '';
