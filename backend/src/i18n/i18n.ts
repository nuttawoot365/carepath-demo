import en from './en.json';
import th from './th.json';

type Dictionary = Record<string, unknown>;

const DICTIONARIES: Record<string, Dictionary> = { th, en };

export const LANGS = Object.keys(DICTIONARIES);

/** t('turn.left') · t('walk', {m: 25}) — คีย์ที่ไม่มีคืนคีย์เดิม เพื่อให้เห็นตอน dev */
export function translate(lang: string, key: string, params: Record<string, unknown> = {}): string {
  const dictionary = DICTIONARIES[lang] ?? DICTIONARIES.th;
  const template = key
    .split('.')
    .reduce<unknown>((node, part) => (node as Dictionary | undefined)?.[part], dictionary);
  if (typeof template !== 'string') return key;
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => String(params[name] ?? ''));
}

export const translator = (lang: string) => (key: string, params?: Record<string, unknown>) =>
  translate(lang, key, params);
