'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, message } from '@/lib/api';
import type { MapNode, VisitState } from '@/lib/types';
import { fingerprint, toModel, type PatientModel } from './model';
import { placesWith, type Place } from './places';

export interface PatientData {
  model: PatientModel | null;
  places: Record<string, Place>;
  token: string | null;
  /** ข้อความที่ต้องขึ้นแทนหน้าจอทั้งหมด เมื่อยังไม่มีบัตรคิวที่ใช้ได้ */
  blocked: string | null;
  openedByStaff: boolean;
}

/**
 * ต่อกับ API — GET /api/p/:token ทุก 5 วินาที
 * เจ้าหน้าที่กด "เสร็จ" ที่จอจุดบริการแล้วหน้านี้เปลี่ยนตามเอง
 */
export function usePatient(
  params: URLSearchParams,
  onChangedByStaff: () => void,
  onError: (text: string) => void,
) {
  const [data, setData] = useState<PatientData>({
    model: null, places: placesWith([]), token: null, blocked: null, openedByStaff: false,
  });
  const lastPrint = useRef<string | null>(null);

  const absorb = useCallback((state: VisitState) => {
    lastPrint.current = fingerprint(state);
    setData((current) => ({ ...current, model: toModel(state) }));
  }, []);

  /** เปิดหน้านี้ได้สองทาง: token ใน QR หรือรหัส 8 ตัวใต้ QR ที่พิมพ์เอง */
  useEffect(() => {
    let cancelled = false;

    async function boot() {
      let places = placesWith([]);
      try {
        const { nodes } = await api.get<{ nodes: MapNode[] }>('/map', { auth: false });
        places = placesWith(nodes);
      } catch {
        /* ชื่อจุดที่รู้จักอยู่แล้วยังใช้ได้ */
      }

      let token = params.get('t');
      const code = params.get('code');

      if (!token && code) {
        try {
          ({ token } = await api.get<{ token: string }>(
            `/p/code/${encodeURIComponent(code)}`, { auth: false },
          ));
        } catch {
          if (!cancelled) {
            setData((c) => ({ ...c, places, blocked: `code:${code.toUpperCase()}` }));
          }
          return;
        }
      }
      if (!token) {
        if (!cancelled) setData((c) => ({ ...c, places, blocked: 'none' }));
        return;
      }

      try {
        const state = await api.get<VisitState>(`/p/${token}`, { auth: false });
        if (cancelled) return;
        lastPrint.current = fingerprint(state);
        setData({
          model: toModel(state),
          places,
          token,
          blocked: null,
          openedByStaff: Boolean(params.get('by')),
        });
      } catch (error) {
        if (!cancelled) setData((c) => ({ ...c, places, blocked: message(error) }));
      }
    }

    void boot();
    return () => { cancelled = true; };
  }, [params]);

  /** ถามซ้ำทุก 5 วินาที · สั่นและแจ้งเฉพาะตอนที่สถานะเปลี่ยนจริง */
  useEffect(() => {
    if (!data.token) return;
    const token = data.token;

    const timer = setInterval(async () => {
      try {
        const state = await api.get<VisitState>(`/p/${token}`, { auth: false });
        const print = fingerprint(state);
        const changed = lastPrint.current !== null && print !== lastPrint.current;
        lastPrint.current = print;
        setData((current) => ({ ...current, model: toModel(state) }));
        if (changed) onChangedByStaff();
      } catch {
        /* เน็ตสะดุดชั่วคราว รอบหน้าค่อยลองใหม่ ไม่ต้องรบกวนผู้ป่วย */
      }
    }, 5000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.token]);

  /** ยิงคำขอไป API แล้ววาดใหม่จากคำตอบ — หน้าจอไม่เดาผลลัพธ์เอง */
  const send = useCallback(
    async (call: () => Promise<VisitState>, onDone?: () => void) => {
      try {
        absorb(await call());
        onDone?.();
      } catch (error) {
        onError(message(error));
      }
    },
    [absorb, onError],
  );

  return { data, send };
}
