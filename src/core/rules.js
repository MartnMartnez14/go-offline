/**
 * Legalidad de jugadas: capturas, suicidio y ko simple.
 * Puro: opera sobre tableros, no sobre el estado de partida.
 */

import { EMPTY, BLACK, WHITE, cloneBoard, idx, inBounds, neighbors, opponent } from './board.js';
import { getGroup } from './groups.js';

/**
 * @typedef {Object} MoveResult
 * @property {boolean} ok
 * @property {Uint8Array} [board]
 * @property {number[]} [captured]
 * @property {number|null} [koPoint]
 * @property {string} [reason] 'out-of-bounds' | 'occupied' | 'suicide' | 'ko'
 */

/**
 * Intenta colocar una piedra. No muta el tablero recibido.
 * @param {Uint8Array} board
 * @param {number} size
 * @param {number} x
 * @param {number} y
 * @param {number} color BLACK | WHITE
 * @param {number|null} koPoint índice prohibido para el bando que mueve
 * @returns {MoveResult}
 */
export function tryMove(board, size, x, y, color, koPoint = null) {
  if (color !== BLACK && color !== WHITE) {
    throw new TypeError(`tryMove: color inválido ${color}`);
  }
  if (!inBounds(size, x, y)) {
    return { ok: false, reason: 'out-of-bounds' };
  }
  const at = idx(size, x, y);
  if (board[at] !== EMPTY) {
    return { ok: false, reason: 'occupied' };
  }
  if (koPoint !== null && koPoint !== undefined && at === koPoint) {
    return { ok: false, reason: 'ko' };
  }

  const next = cloneBoard(board);
  next[at] = color;

  // 1. Capturar grupos enemigos sin libertades.
  const captured = [];
  const enemy = opponent(color);
  const checked = new Set();
  for (const n of neighbors(size, at)) {
    if (next[n] !== enemy || checked.has(n)) continue;
    const group = getGroup(next, size, n);
    for (const s of group.stones) checked.add(s);
    if (group.liberties.size === 0) {
      for (const s of group.stones) {
        next[s] = EMPTY;
        captured.push(s);
      }
    }
  }

  // 2. Suicidio: si el grupo propio queda sin libertades, ilegal.
  //    (Si la jugada capturó, ya no puede ocurrir.)
  const own = getGroup(next, size, at);
  if (own.liberties.size === 0) {
    return { ok: false, reason: 'suicide' };
  }

  // 3. Ko simple:
  //    exactamente 1 captura + grupo propio de 1 piedra con 1 libertad
  //    -> el punto capturado queda prohibido un turno.
  let nextKo = null;
  if (
    captured.length === 1 &&
    own.stones.length === 1 &&
    own.liberties.size === 1
  ) {
    nextKo = captured[0];
  }

  return { ok: true, board: next, captured, koPoint: nextKo };
}

export function isLegalMove(board, size, x, y, color, koPoint = null) {
  return tryMove(board, size, x, y, color, koPoint).ok === true;
}
