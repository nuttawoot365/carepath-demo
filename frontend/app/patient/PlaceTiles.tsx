'use client';

import type { Place } from './places';
import styles from './patient.module.css';

export interface Tile {
  code: string;
  icon: string;
  name: string;
  where: string;
  photo: string;
  real: boolean;
}

export const tileFor = (
  code: string,
  places: Record<string, Place>,
  photo: { src: string; real: boolean },
  name: string,
  where: string,
): Tile => ({
  code,
  icon: String(places[code]?.icon ?? '📍'),
  name,
  where,
  photo: photo.src,
  real: photo.real,
});

/** ตารางรูปของจุดต่าง ๆ — ผู้ป่วยที่หลงเลือกจากสิ่งที่ "มองเห็น" ไม่ใช่ชื่อที่อ่านไม่ออก */
export function PlaceTiles({
  tiles, onPick, showRealBadge, realLabel, sampleLabel,
}: {
  tiles: Tile[];
  onPick: (code: string) => void;
  showRealBadge?: boolean;
  realLabel?: string;
  sampleLabel?: string;
}) {
  return (
    <div className={styles.gallery}>
      {tiles.map((tile) => (
        <button key={tile.code} onClick={() => onPick(tile.code)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- ภาพวาดในเบราว์เซอร์เป็น data URL */}
          <img src={tile.photo} alt="" />
          <b>{tile.icon} {tile.name}</b>
          <small>
            {showRealBadge && tile.real ? (
              <>
                <span className={styles.dot}>●</span> {realLabel}
              </>
            ) : showRealBadge ? (
              sampleLabel
            ) : (
              tile.where
            )}
          </small>
        </button>
      ))}
    </div>
  );
}
