import type { Place } from './places';
import type { PatientStep } from './model';
import styles from './patient.module.css';

/**
 * ภาพรวมทั้งวันแบบย่อ: แกนตั้งคือชั้น แกนนอนคือลำดับขั้น
 * ตอบคำถามที่ผู้ป่วยถามจริง — วันนี้ต้องขึ้นลงกี่รอบ ข้ามตึกกี่ครั้ง
 */
export function JourneyChart({
  steps, target, places, floorLabel, title,
}: {
  steps: PatientStep[];
  target: PatientStep | null;
  places: Record<string, Place>;
  floorLabel: (floor: number) => string;
  title: string;
}) {
  if (steps.length === 0) return null;

  const floorOf = (step: PatientStep) => Number(places[step.point]?.floor ?? 1);
  const buildingOf = (step: PatientStep) => String(places[step.point]?.building ?? '');

  const floors = [...new Set(steps.map(floorOf))].sort((a, b) => b - a);

  const width = 320;
  const height = 34 + floors.length * 26;
  const left = 30;
  const gap = steps.length > 1 ? (width - left - 16) / (steps.length - 1) : 0;

  const points = steps.map((step, index) => ({
    x: left + index * gap,
    y: 16 + floors.indexOf(floorOf(step)) * 26,
  }));

  const doneCount = steps.filter((step) => step.status === 'done').length;

  const polyline = (from: number, to: number, done: boolean) => {
    const slice = points.slice(from, to);
    if (slice.length < 2) return null;
    return (
      <polyline
        className={`${styles.ovLine} ${done ? styles.ovLineDone : ''}`}
        points={slice.map((point) => `${point.x},${point.y}`).join(' ')}
      />
    );
  };

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
      {floors.map((floor, i) => (
        <g key={floor}>
          <line className={styles.ovFloor} x1={left - 8} y1={16 + i * 26} x2={width} y2={16 + i * 26} />
          <text className={styles.ovFloorLabel} x="0" y={19 + i * 26}>{floorLabel(floor)}</text>
        </g>
      ))}

      {steps.slice(1).map((step, i) => {
        if (buildingOf(step) === buildingOf(steps[i])) return null;
        const x = (points[i].x + points[i + 1].x) / 2;
        return (
          <g key={`split-${step.id}`}>
            <line className={styles.ovSplit} x1={x} y1="4" x2={x} y2={height - 16} />
            <text className={styles.ovBuilding} x={x + 3} y={height - 4}>{buildingOf(step)}</text>
          </g>
        );
      })}

      {polyline(0, Math.max(doneCount, 1), true)}
      {polyline(Math.max(doneCount - 1, 0), steps.length, false)}

      {steps.map((step, i) => {
        const isNow = target?.id === step.id;
        const mark =
          step.status === 'done' ? styles.ovNodeDone : isNow ? styles.ovNodeNow : '';
        return (
          <g key={step.id}>
            <circle
              className={`${styles.ovNode} ${mark}`}
              cx={points[i].x} cy={points[i].y} r={isNow ? 7 : 5}
            />
            <text className={styles.ovIcon} x={points[i].x} y={points[i].y - 11} textAnchor="middle">
              {String(places[step.point]?.icon ?? '📍')}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** จำนวนครั้งที่ต้องเปลี่ยนชั้นและข้ามอาคารตลอดทั้งวัน */
export function journeyCounts(steps: PatientStep[], places: Record<string, Place>) {
  let floors = 0;
  let buildings = 0;
  steps.slice(1).forEach((step, i) => {
    const from = places[steps[i].point];
    const to = places[step.point];
    if (!from || !to) return;
    if (from.floor !== to.floor) floors += 1;
    if (from.building !== to.building) buildings += 1;
  });
  return { floors, buildings };
}
