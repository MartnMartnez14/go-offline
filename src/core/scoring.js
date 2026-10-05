/**
 * Puntuación: Chinese Area Scoring.
 * Área = piedras en el tablero + territorio rodeado por un solo color.
 * Las capturas NO suman al marcador (reglas chinas).
 */

import { EMPTY, BLACK, WHITE, cloneBoard } from './board.js';
import { neighbors } from './board.js';

/**
 * @param {Uint8Array} board
 * @param {number} size
 * @param {number} komi
 * @param {number[]} [dead] índices de piedras marcadas como muertas
 */
export function scoreChinese(board, size, komi = 7.5, dead = []) {
  const b = cloneBoard(board);
  for (const i of dead) {
    if (i >= 0 && i < b.length) b[i] = EMPTY;
  }

  let blackStones = 0;
  let whiteStones = 0;
  for (let i = 0; i < b.length; i++) {
    if (b[i] === BLACK) blackStones++;
    else if (b[i] === WHITE) whiteStones++;
  }

  const visited = new Uint8Array(b.length);
  let blackTerritory = 0;
  let whiteTerritory = 0;
  let neutral = 0;

  for (let i = 0; i < b.length; i++) {
    if (b[i] !== EMPTY || visited[i]) continue;

    // Flood fill de la región vacía conectada.
    const region = [];
    const stack = [i];
    visited[i] = 1;
    let touchesBlack = false;
    let touchesWhite = false;

    while (stack.length > 0) {
      const cur = stack.pop();
      region.push(cur);
      for (const n of neighbors(size, cur)) {
        const v = b[n];
        if (v === EMPTY) {
          if (!visited[n]) {
            visited[n] = 1;
            stack.push(n);
          }
        } else if (v === BLACK) {
          touchesBlack = true;
        } else if (v === WHITE) {
          touchesWhite = true;
        }
      }
    }

    if (touchesBlack && !touchesWhite) blackTerritory += region.length;
    else if (touchesWhite && !touchesBlack) whiteTerritory += region.length;
    else neutral += region.length;
  }

  const blackTotal = blackStones + blackTerritory;
  const whiteTotal = whiteStones + whiteTerritory + komi;

  let winner;
  if (blackTotal > whiteTotal) winner = 'B';
  else if (whiteTotal > blackTotal) winner = 'W';
  else winner = 'D';

  return {
    black: { stones: blackStones, territory: blackTerritory, total: blackTotal },
    white: { stones: whiteStones, territory: whiteTerritory, total: whiteTotal },
    komi,
    winner,
    margin: Math.abs(blackTotal - whiteTotal),
    neutral,
  };
}
