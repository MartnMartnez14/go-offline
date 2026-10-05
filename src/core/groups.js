/**
 * Grupos (cadenas) y libertades.
 * Cálculo bajo demanda con flood-fill BFS: para tableros de hasta 25×25
 * el coste es despreciable y el código es fácil de verificar.
 */

import { EMPTY, neighbors } from './board.js';

/**
 * Devuelve el grupo (cadena) de piedras conectadas que contiene `i`
 * y el conjunto de sus libertades.
 * @param {Uint8Array} board
 * @param {number} size
 * @param {number} i índice de una piedra (no vacía)
 * @returns {{ color: number, stones: number[], liberties: Set<number> }}
 */
export function getGroup(board, size, i) {
  const color = board[i];
  if (color === EMPTY) {
    throw new TypeError(`getGroup: la casilla ${i} está vacía`);
  }
  const stones = [];
  const liberties = new Set();
  const seen = new Uint8Array(board.length);
  const stack = [i];
  seen[i] = 1;

  while (stack.length > 0) {
    const cur = stack.pop();
    stones.push(cur);
    for (const n of neighbors(size, cur)) {
      const v = board[n];
      if (v === EMPTY) {
        liberties.add(n);
      } else if (v === color && !seen[n]) {
        seen[n] = 1;
        stack.push(n);
      }
    }
  }
  return { color, stones, liberties };
}

export function countLiberties(board, size, i) {
  return getGroup(board, size, i).liberties.size;
}
