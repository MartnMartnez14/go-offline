/**
 * Oponente de computadora. Nivel 1: elige al azar entre las jugadas legales.
 * Puro: no muta la partida; la legalidad la decide `tryMove`.
 */

import { EMPTY } from './board.js';
import { tryMove } from './rules.js';

/**
 * @param {import('./game.js').Game|Object} game
 * @param {() => number} [rng=Math.random] devuelve un número en [0, 1)
 * @returns {{x: number, y: number}|null} null si no hay jugadas legales
 */
export function randomMove(game, rng = Math.random) {
  if (game.phase !== 'playing') return null;

  const legal = [];
  for (let i = 0; i < game.board.length; i++) {
    if (game.board[i] !== EMPTY) continue;
    const x = i % game.size;
    const y = Math.floor(i / game.size);
    if (tryMove(game.board, game.size, x, y, game.turn, game.koPoint).ok) {
      legal.push({ x, y });
    }
  }

  if (legal.length === 0) return null;
  const k = Math.min(legal.length - 1, Math.floor(rng() * legal.length));
  return legal[k];
}
