'use client';

/**
 * รูปถ่ายจริงที่ผู้ใช้ถ่ายเอง — เก็บใน localStorage ของเครื่องนั้นเท่านั้น
 * ระบบจริงเก็บที่ตาราง node_photos
 */
const KEY = 'carepath.photos';

export type UserPhotos = Record<string, string>;

export function loadPhotos(): UserPhotos {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as UserPhotos;
  } catch {
    return {};
  }
}

export function savePhotos(photos: UserPhotos): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(photos));
    return true;
  } catch {
    return false; // พื้นที่เต็มหรือโหมดส่วนตัว
  }
}

/** ย่อภาพก่อนเก็บ เพราะพื้นที่ในเครื่องมีจำกัด */
export function shrink(file: File, maxSide = 1000): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('decode failed'));
      image.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      image.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export const readLocal = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const writeLocal = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* โหมดส่วนตัวเขียนไม่ได้ ข้ามไป */
  }
};

export const buzz = (pattern: number | number[]): void => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ไม่รองรับก็ข้ามไป */
  }
};
