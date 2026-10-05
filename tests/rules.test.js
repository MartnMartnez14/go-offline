import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BLACK, WHITE, EMPTY, createBoard, idx } from '../src/core/board.js';
import { tryMove, isLegalMove } from '../src/core/rules.js';

function setup(size, placements) {
  const b = createBoard(size);
  for (const [x, y, c] of placements) b[idx(size, x, y)] = c;
  return b;
}

test('jugada fuera de tablero', () => {
  const b = createBoard(9);
  assert.equal(tryMove(b, 9, -1, 0, BLACK).reason, 'out-of-bounds');
  assert.equal(tryMove(b, 9, 0, 9, BLACK).reason, 'out-of-bounds');
});

test('jugada sobre casilla ocupada', () => {
  const b = setup(9, [[4, 4, BLACK]]);
  assert.equal(tryMove(b, 9, 4, 4, WHITE).reason, 'occupied');
});

test('colocar piedra sin captura no muta el tablero original', () => {
  const b = createBoard(9);
  const r = tryMove(b, 9, 4, 4, BLACK);
  assert.equal(r.ok, true);
  assert.equal(r.board[idx(9, 4, 4)], BLACK);
  assert.equal(r.captured.length, 0);
  assert.equal(r.koPoint, null);
  assert.equal(b[idx(9, 4, 4)], EMPTY);
});

test('captura de una piedra', () => {
  const size = 9;
  const b = setup(size, [
    [4, 1, BLACK],
    [3, 1, WHITE], [5, 1, WHITE], [4, 0, WHITE],
  ]);
  const r = tryMove(b, size, 4, 2, WHITE);
  assert.equal(r.ok, true);
  assert.equal(r.captured.length, 1);
  assert.equal(r.captured[0], idx(size, 4, 1));
  assert.equal(r.board[idx(size, 4, 1)], EMPTY);
  assert.equal(r.board[idx(size, 4, 2)], WHITE);
});

test('captura de grupo de 2 piedras', () => {
  const size = 9;
  const b = setup(size, [
    [3, 3, BLACK], [4, 3, BLACK],
    [2, 3, WHITE], [5, 3, WHITE],
    [3, 2, WHITE], [4, 2, WHITE],
    [3, 4, WHITE],
  ]);
  const r = tryMove(b, size, 4, 4, WHITE);
  assert.equal(r.ok, true);
  assert.equal(r.captured.length, 2);
  assert.equal(r.board[idx(size, 3, 3)], EMPTY);
  assert.equal(r.board[idx(size, 4, 3)], EMPTY);
});

test('captura de grupo de 3 piedras', () => {
  const size = 9;
  const b = setup(size, [
    [2, 2, BLACK], [3, 2, BLACK], [4, 2, BLACK],
    [1, 2, WHITE], [5, 2, WHITE],
    [2, 1, WHITE], [3, 1, WHITE], [4, 1, WHITE],
    [2, 3, WHITE], [3, 3, WHITE],
  ]);
  const r = tryMove(b, size, 4, 3, WHITE);
  assert.equal(r.ok, true);
  assert.equal(r.captured.length, 3);
});

test('suicidio ilegal: rellenar el último ojo', () => {
  const size = 9;
  // Piedra blanca en (4,4) con una sola libertad: (4,5).
  // Los demás vecinos de (4,5) son negras -> jugar ahí es suicidio.
  const b = setup(size, [
    [4, 4, WHITE],
    [3, 4, BLACK], [5, 4, BLACK], [4, 3, BLACK],
    [4, 6, BLACK], [3, 5, BLACK], [5, 5, BLACK],
  ]);
  const r = tryMove(b, size, 4, 5, WHITE);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'suicide');
});

test('suicidio ilegal en esquina', () => {
  const size = 9;
  const b = setup(size, [[0, 1, BLACK], [1, 0, BLACK]]);
  const r = tryMove(b, size, 0, 0, WHITE);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'suicide');
});

test('suicidio legal cuando la jugada captura', () => {
  const size = 9;
  const b = setup(size, [
    [4, 4, BLACK],
    [3, 4, WHITE], [5, 4, WHITE], [4, 3, WHITE],
  ]);
  const r = tryMove(b, size, 4, 5, WHITE);
  assert.equal(r.ok, true);
  assert.equal(r.captured.length, 1);
  assert.equal(r.board[idx(size, 4, 4)], EMPTY);
  assert.equal(r.board[idx(size, 4, 5)], WHITE);
});

test('snapback: capturar 1 piedra y ser recapturado al instante', () => {
  const size = 3;
  //   B B B
  //   B W B
  //   B . B
  const b = setup(size, [
    [0, 0, BLACK], [1, 0, BLACK], [2, 0, BLACK],
    [0, 1, BLACK], [1, 1, WHITE], [2, 1, BLACK],
    [0, 2, BLACK], [2, 2, BLACK],
  ]);
  const r1 = tryMove(b, size, 1, 2, BLACK);
  assert.equal(r1.ok, true);
  assert.equal(r1.captured.length, 1);
  assert.equal(r1.board[idx(size, 1, 1)], EMPTY);
  assert.equal(r1.koPoint, null);

  const r2 = tryMove(r1.board, size, 1, 1, WHITE);
  assert.equal(r2.ok, true);
  assert.equal(r2.captured.length, 8);
  assert.equal(r2.board.every((v) => v !== BLACK), true);
});

test('capturar 2 piedras no fija koPoint', () => {
  const size = 9;
  const b = setup(size, [
    [4, 4, BLACK], [4, 5, BLACK],
    [4, 3, WHITE], [3, 4, WHITE], [5, 4, WHITE],
    [3, 5, WHITE], [5, 5, WHITE],
  ]);
  const r = tryMove(b, size, 4, 6, WHITE);
  assert.equal(r.ok, true);
  assert.equal(r.captured.length, 2);
  assert.equal(r.koPoint, null);
});

test('isLegalMove coincide con tryMove', () => {
  const b = createBoard(9);
  assert.equal(isLegalMove(b, 9, 4, 4, BLACK), true);
  assert.equal(isLegalMove(b, 9, -1, 0, BLACK), false);
});
