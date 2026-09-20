import type { PatientProfile } from '@/lib/types';

export const PROFILE_FLAGS: {
  key: keyof PatientProfile; icon: string; label: string; effect: string;
}[] = [
  { key: 'wheelchair', icon: '♿', label: 'ใช้รถเข็น', effect: 'ตัดบันไดออกจากทุกเส้นทาง' },
  { key: 'elderly', icon: '🧓', label: 'ผู้สูงอายุ', effect: 'คิดเวลาเดินช้าลง เปิดโหมดตัวใหญ่' },
  { key: 'low_vision', icon: '👓', label: 'สายตาเลือนราง', effect: 'ตัวใหญ่ + ปุ่มอ่านออกเสียง' },
  { key: 'needs_companion', icon: '👥', label: 'มีญาติมาด้วย', effect: 'แจ้งจุดบริการให้เผื่อที่นั่ง' },
];

export const LANG_LABEL: Record<string, string> = {
  th: 'ไทย', en: 'English', zh: '中文', my: 'မြန်မာ', ru: 'Русский',
};

export const LANG_OPTIONS = [
  { value: 'th', label: 'ไทย' },
  { value: 'en', label: 'English — อังกฤษ' },
  { value: 'zh', label: '中文 — จีน' },
  { value: 'my', label: 'မြန်မာ — เมียนมา' },
  { value: 'ru', label: 'Русский — รัสเซีย' },
];
