import { translate } from '../lib/i18n.js';

const WALKABLE = new Set(['corridor', 'door']);

const ARROW = { left: '⬅', right: '➡', straight: '⬆', back: '⬇' };
const VERTICAL_ARROW = { up: '▲', down: '▼' };
const KIND_ICON = { elevator: '🛗', stairs: '🪜', ramp: '♿', bridge: '🌉' };

const LANGS = ['th', 'en'];

/**
 * แปลงเส้นเชื่อมที่ Dijkstra คืนมาเป็นคำสั่งทีละข้อ
 * ทางเดินตรงต่อเนื่องถูกยุบเป็นข้อเดียวและรวมระยะทาง เพื่อไม่ให้ผู้ป่วยอ่าน 12 ข้อสำหรับทางเดินเส้นเดียว
 */
export function buildInstructions(graph, edges) {
  if (edges.length === 0) return [];

  return groupSegments(edges).map((segment, index, segments) => {
    const lastEdge = segment.at(-1);
    const toNode = graph.nodes.get(lastEdge.to_node_id);
    const fromNode = graph.nodes.get(segment[0].from_node_id);
    const isFirst = index === 0;
    const isLast = index === segments.length - 1;

    const text = Object.fromEntries(
      LANGS.map((lang) => [
        lang,
        describe(lang, { segment, fromNode, toNode, isFirst, isLast }),
      ]),
    );

    return {
      n: index + 1,
      kind: lastEdge.kind,
      arrow: arrowFor(segment[0], fromNode, toNode),
      icon: isLast ? (toNode.icon ?? null) : (KIND_ICON[lastEdge.kind] ?? null),
      distance_m: round1(sum(segment, (edge) => Number(edge.distance_m))),
      seconds: sum(segment, (edge) => edge.walk_seconds),
      building: toNode.building,
      floor: toNode.floor,
      to: toNode.code,
      text_th: text.th,
      text_en: text.en,
    };
  });
}

/** ยุบทางเดิน/ประตูที่เดินตรงต่อเนื่องเข้าด้วยกัน · ลิฟต์ บันได ทางลาด ทางเชื่อม แยกข้อเสมอ */
function groupSegments(edges) {
  const segments = [];

  for (const edge of edges) {
    const current = segments.at(-1);
    const continues =
      current &&
      WALKABLE.has(edge.kind) &&
      WALKABLE.has(current.at(-1).kind) &&
      (edge.turn === 'straight' || edge.turn === null);

    if (continues) current.push(edge);
    else segments.push([edge]);
  }
  return segments;
}

function describe(lang, { segment, fromNode, toNode, isFirst, isLast }) {
  const firstEdge = segment[0];
  const lastEdge = segment.at(-1);
  const authored = lastEdge[`instruction_${lang}`];

  if (!WALKABLE.has(lastEdge.kind)) {
    return authored || verticalText(lang, lastEdge, fromNode, toNode);
  }

  const parts = [];
  if (isFirst && fromNode.name_th) {
    parts.push(translate(lang, 'exit', { from: nameOf(fromNode, lang) }));
  }
  if (firstEdge.turn && firstEdge.turn !== 'straight') {
    parts.push(translate(lang, `turn.${firstEdge.turn}`));
  }
  parts.push(
    firstEdge.turn === 'straight' && !isFirst
      ? `${translate(lang, 'turn.straight')} ${translate(lang, 'walk', { m: round1(sum(segment, (e) => Number(e.distance_m))) })}`
      : translate(lang, 'walk', { m: round1(sum(segment, (e) => Number(e.distance_m))) }),
  );
  parts.push(authored || arrivalText(lang, lastEdge, toNode, isLast));

  return joinParts(lang, parts.filter(Boolean));
}

function verticalText(lang, edge, fromNode, toNode) {
  if (edge.kind === 'bridge') {
    return translate(lang, 'bridge', {
      name: nameOf(toNode, lang),
      building: toNode.building,
      floor: toNode.floor,
    });
  }
  const direction = toNode.floor >= fromNode.floor ? 'up' : 'down';
  return translate(lang, `${edge.kind}_${direction}`, {
    name: nameOf(fromNode, lang),
    floor: toNode.floor,
  });
}

function arrivalText(lang, edge, toNode, isLast) {
  const name = nameOf(toNode, lang);
  if (!name) return '';

  const landmark = toNode[`landmark_${lang}`];
  const side = edge.turn === 'left' || edge.turn === 'right' ? edge.turn : 'ahead';
  const arrival = isLast
    ? translate(lang, `arrive_side.${side}`, { name })
    : translate(lang, 'arrive', { name });

  return landmark ? joinParts(lang, [arrival, landmark]) : arrival;
}

function arrowFor(edge, fromNode, toNode) {
  if (edge.kind === 'elevator' || edge.kind === 'stairs' || edge.kind === 'ramp') {
    return VERTICAL_ARROW[toNode.floor >= fromNode.floor ? 'up' : 'down'];
  }
  return ARROW[edge.turn ?? 'straight'] ?? ARROW.straight;
}

const nameOf = (node, lang) => node[`name_${lang}`] || node[`name_th`] || node.code;
const joinParts = (lang, parts) => parts.join(lang === 'th' ? ' ' : ', ');
const sum = (items, pick) => items.reduce((total, item) => total + pick(item), 0);
const round1 = (value) => Math.round(value * 10) / 10;
