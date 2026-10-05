/**
 * Renderizado del tablero en SVG.
 *
 * Geometría (unidades de usuario):
 *   viewBox        `0 0 size size`  → margen de 0.5 por lado
 *   intersección   (x, y) → (x + 0.5, y + 0.5)
 *   radio piedra   0.46
 *   hit rect       (x, y, 1, 1)
 *
 * Puro respecto del motor: recibe un estado plano, no muta la partida.
 */

import { EMPTY, BLACK, WHITE, idx, toXY } from '../core/board.js';
import { COLUMN_LABELS } from '../core/coords.js';

const R_STONE = 0.46;
const SVG_NS = 'http://www.w3.org/2000/svg';

let uid = 0;

function el(name, attrs = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

function buildDefs(id) {
  const defs = el('defs');

  // El color de cada stop se fija desde board.css (stop-color con CSS
  // custom properties): los atributos de presentación SVG no resuelven var()
  // de forma fiable en todos los navegadores.
  const wood = el('radialGradient', {
    id: `${id}-wood`, cx: '38%', cy: '30%', r: '86%',
  });
  wood.append(
    el('stop', { offset: '0%', class: 'grad-wood-hi' }),
    el('stop', { offset: '58%', class: 'grad-wood-mid' }),
    el('stop', { offset: '100%', class: 'grad-wood-lo' }),
  );

  const black = el('radialGradient', {
    id: `${id}-black`, cx: '34%', cy: '28%', r: '78%',
  });
  black.append(
    el('stop', { offset: '0%', class: 'grad-black-hi' }),
    el('stop', { offset: '52%', class: 'grad-black-mid' }),
    el('stop', { offset: '100%', class: 'grad-black-lo' }),
  );

  const white = el('radialGradient', {
    id: `${id}-white`, cx: '34%', cy: '28%', r: '78%',
  });
  white.append(
    el('stop', { offset: '0%', class: 'grad-white-hi' }),
    el('stop', { offset: '52%', class: 'grad-white-mid' }),
    el('stop', { offset: '100%', class: 'grad-white-lo' }),
  );

  defs.append(wood, black, white);
  return defs;
}

/**
 * @param {HTMLElement} container
 * @param {Object} opts
 * @param {number} opts.size
 * @param {(x:number,y:number)=>void} opts.onPointClick
 * @param {((x:number,y:number)=>void)|null} [opts.onPointHover]
 * @param {boolean} [opts.showCoordinates]
 */
export function createBoardView(container, opts) {
  const size = opts.size;
  const id = `go${++uid}`;
  const showCoords = opts.showCoordinates !== false;

  const wrap = document.createElement('div');
  wrap.className = showCoords ? 'board board-coords-on' : 'board board-coords-off';

  const svg = el('svg', {
    class: 'board-svg',
    viewBox: `0 0 ${size} ${size}`,
    role: 'grid',
    'aria-label': `Tablero de Go ${size} por ${size}`,
  });
  svg.append(buildDefs(id));

  const px = (v) => v + 0.5;

  // Madera
  svg.append(el('rect', {
    class: 'board-wood',
    x: 0, y: 0, width: size, height: size,
    rx: 0.18,
    fill: `url(#${id}-wood)`,
  }));

  // Rejilla
  const grid = el('g', { class: 'board-grid' });
  const last = size - 1;
  for (let i = 0; i < size; i++) {
    const p = px(i);
    grid.append(
      el('line', { class: 'board-grid-line', x1: p, y1: px(0), x2: p, y2: px(last) }),
      el('line', { class: 'board-grid-line', x1: px(0), y1: p, x2: px(last), y2: p }),
    );
  }
  svg.append(grid);

  // Puntos de estrella (star points)
  const stars = starPoints(size);
  const starG = el('g', { class: 'board-stars' });
  for (const [x, y] of stars) {
    starG.append(el('circle', {
      class: 'board-star', cx: px(x), cy: px(y), r: 0.095,
    }));
  }
  svg.append(starG);

  // Coordenadas
  const coords = el('g', { class: 'board-coords' });
  for (let i = 0; i < size; i++) {
    const label = el('text', {
      class: 'coord-label coord-label--col', x: px(i), y: 0.24,
    });
    label.textContent = COLUMN_LABELS[i];
    coords.append(label);

    const row = el('text', {
      class: 'coord-label coord-label--row', x: 0.22, y: px(i),
    });
    row.textContent = String(size - i);
    coords.append(row);
  }
  svg.append(coords);

  // Capas de piedras y marcadores
  const stones = el('g', { class: 'board-stones' });
  const markers = el('g', { class: 'board-markers' });
  svg.append(stones, markers);

  // Zonas de interacción (encima de todo para capturar el evento)
  const hits = el('g', { class: 'board-hits' });
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const rect = el('rect', {
        class: 'hit-area',
        x, y, width: 1, height: 1,
        tabindex: 0,
        role: 'gridcell',
        'data-x': x,
        'data-y': y,
        'aria-label': `${COLUMN_LABELS[x]}${size - y}`,
      });
      hits.append(rect);
    }
  }
  svg.append(hits);

  wrap.append(svg);
  container.append(wrap);

  const stonesByIndex = new Map();

  function drawStone(i, color, classes = []) {
    const { x, y } = toXY(size, i);
    const g = el('g', {
      class: ['stone', color === BLACK ? 'stone--black' : 'stone--white', ...classes].join(' '),
    });
    g.append(el('circle', {
      cx: px(x), cy: px(y), r: R_STONE,
      fill: `url(#${id}-${color === BLACK ? 'black' : 'white'})`,
    }));
    return g;
  }

  function render(state) {
    stones.textContent = '';
    markers.textContent = '';
    stonesByIndex.clear();

    const board = state.board;
    const dead = state.dead ? new Set(state.dead) : null;

    for (let i = 0; i < board.length; i++) {
      const v = board[i];
      if (v === EMPTY) continue;
      const classes = [];
      if (dead && dead.has(i)) classes.push('stone--dead');
      const node = drawStone(i, v, classes);
      stones.append(node);
      stonesByIndex.set(i, node);

      if (dead && dead.has(i)) {
        const { x, y } = toXY(size, i);
        const mark = el('circle', {
          class: 'stone-mark', cx: px(x), cy: px(y), r: R_STONE * 0.62,
          fill: 'none', stroke: 'var(--danger)', 'stroke-width': 0.07,
        });
        node.append(mark);
      }
    }

    // Marcador de última jugada
    if (state.lastMove != null && state.lastMove >= 0 && board[state.lastMove] !== EMPTY) {
      const { x, y } = toXY(size, state.lastMove);
      markers.append(el('circle', {
        class: 'board-marker', cx: px(x), cy: px(y), r: 0.17,
      }));
    }

    // Aviso de ko
    if (state.koPoint != null && state.koPoint >= 0 && board[state.koPoint] === EMPTY) {
      const { x, y } = toXY(size, state.koPoint);
      markers.append(el('rect', {
        class: 'ko-marker',
        x: px(x) - 0.3, y: px(y) - 0.3, width: 0.6, height: 0.6,
        rx: 0.12,
      }));
    }

    // Piedra fantasma bajo el cursor
    if (state.hover && state.hoverColor) {
      const { x, y } = state.hover;
      const i = idx(size, x, y);
      if (board[i] === EMPTY) {
        const ghost = drawStone(i, state.hoverColor, ['stone--hover']);
        stones.append(ghost);
      }
    }
  }

  function setShowCoordinates(on) {
    wrap.className = on ? 'board board-coords-on' : 'board board-coords-off';
  }

  function destroy() {
    wrap.remove();
  }

  // --- Eventos ---
  function pointFromEvent(ev) {
    const t = ev.target.closest?.('.hit-area');
    if (!t) return null;
    return { x: Number(t.dataset.x), y: Number(t.dataset.y) };
  }

  hits.addEventListener('click', (ev) => {
    const p = pointFromEvent(ev);
    if (p && opts.onPointClick) opts.onPointClick(p.x, p.y);
  });

  hits.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    const p = pointFromEvent(ev);
    if (p && opts.onPointClick) {
      ev.preventDefault();
      opts.onPointClick(p.x, p.y);
    }
  });

  if (opts.onPointHover) {
    hits.addEventListener('pointermove', (ev) => {
      const p = pointFromEvent(ev);
      if (p) opts.onPointHover(p.x, p.y);
    });
    hits.addEventListener('pointerleave', () => opts.onPointHover(null, null));
  }

  return { render, setShowCoordinates, destroy, el: wrap };
}

function starPoints(size) {
  const lo = 3;
  const mid = (size - 1) / 2;
  const hi = size - 4;
  if (size < 9) return [[mid, mid]];
  if (size === 9) {
    return [[2, 2], [6, 2], [2, 6], [6, 6], [mid, mid]];
  }
  if (size === 13) {
    return [[3, 3], [9, 3], [3, 9], [9, 9], [mid, mid]];
  }
  return [
    [lo, lo], [hi, lo], [lo, hi], [hi, hi],
    [mid, mid],
    [mid, lo], [mid, hi], [lo, mid], [hi, mid],
  ];
}
