import en from '../i18n/en.json' with { type: 'json' };
import th from '../i18n/th.json' with { type: 'json' };

const DICTIONARIES = { th, en };

export const LANGS = Object.keys(DICTIONARIES);

/** t('turn.left') · t('walk', {m: 25}) — คีย์ที่ไม่มีคืนคีย์เดิม เพื่อให้เห็นตอน dev */
export function translate(lang, key, params = {}) {
  const dictionary = DICTIONARIES[lang] ?? DICTIONARIES.th;
  const template = key.split('.').reduce((node, part) => node?.[part], dictionary);
  if (typeof template !== 'string') return key;
  return template.replace(/\{(\w+)\}/g, (_match, name) => String(params[name] ?? ''));
}

export const translator = (lang) => (key, params) => translate(lang, key, params);
