import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BLACK, WHITE, createBoard, idx } from '../src/core/board.js';
import { tryMove } from '../src/core/rules.js';
import { createGame, playMove, undo, redo, pass } from '../src/core/game.js';

function setup(size, placements) {
  const b = createBoard(size);
  for (const [x, y, c] of placements) b[idx(size, x, y)] = c;
  return b;
}

// Posición de ko clásica (y=0 arriba):
//   y=0:  . X O .
//   y=1:  X O . O
//   y=2:  . X O .
// X = negro en (1,0) (0,1) (1,2)
// O = blanco en (2,0) (1,1) (3,1) (2,2)
// (2,1) está vacío: es el punto de ko.
const KO_BLACK = [[1, 0], [0, 1], [1, 2]];
const KO_WHITE = [[2, 0], [1, 1], [3, 1], [2, 2]];

function koBoard(size = 9) {
  const b = createBoard(size);
  for (const [x, y] of KO_BLACK) b[idx(size, x, y)] = BLACK;
  for (const [x, y] of KO_WHITE) b[idx(size, x, y)] = WHITE;
  return b;
}

test('ko: la recaptura inmediata es ilegal', () => {
  const size = 9;
  const b = koBoard(size);
  // Negro juega (2,1): captura la blanca (1,1) y fija koPoint
  const r1 = tryMove(b, size, 2, 1, BLACK);
  assert.equal(r1.ok, true);
  assert.equal(r1.captured.length, 1);
  assert.equal(r1.captured[0], idx(size, 1, 1));
  assert.equal(r1.koPoint, idx(size, 1, 1));

  // Blanco no puede recapturar de inmediato en (1,1)
  const r2 = tryMove(r1.board, size, 1, 1, WHITE, r1.koPoint);
  assert.equal(r2.ok, false);
  assert.equal(r2.reason, 'ko');
});

test('ko: la piedra jugada queda con una sola libertad', () => {
  const size = 9;
  const b = koBoard(size);
  const r = tryMove(b, size, 2, 1, BLACK);
  assert.equal(r.ok, true);
  // (2,1) solo linda con el punto capturado (1,1)
  assert.equal(r.koPoint, idx(size, 1, 1));
});

test('ko: tras una jugada en otro sitio la recaptura vuelve a ser legal', () => {
  const size = 9;
  const b = koBoard(size);
  const r1 = tryMove(b, size, 2, 1, BLACK);
  assert.equal(r1.koPoint, idx(size, 1, 1));

  // Blanco juega en otro sitio (un punto libre y seguro)
  const r2 = tryMove(r1.board, size, 8, 8, WHITE, r1.koPoint);
  assert.equal(r2.ok, true);
  assert.equal(r2.koPoint, null);

  // Negro juega en otro sitio
  const r3 = tryMove(r2.board, size, 7, 7, BLACK, r2.koPoint);
  assert.equal(r3.ok, true);

  // Ahora blanco sí puede recapturar en (1,1)
  const r4 = tryMove(r3.board, size, 1, 1, WHITE, r3.koPoint);
  assert.equal(r4.ok, true);
  assert.equal(r4.captured.length, 1);
  assert.equal(r4.captured[0], idx(size, 2, 1));
  assert.equal(r4.koPoint, idx(size, 2, 1));
});

test('el bloqueo de ko solo dura un turno', () => {
  const size = 9;
  const b = koBoard(size);
  const r1 = tryMove(b, size, 2, 1, BLACK);
  assert.equal(r1.koPoint, idx(size, 1, 1));
  const r2 = tryMove(r1.board, size, 8, 8, WHITE, r1.koPoint);
  assert.equal(r2.koPoint, null);
});

test('capturar 2 piedras deja koPoint en null', () => {
  const size = 9;
  const b = setup(size, [
    [4, 4, BLACK], [4, 5, BLACK],
    [4, 3, WHITE], [3, 4, WHITE], [5, 4, WHITE],
    [3, 5, WHITE], [5, 5, WHITE],
  ]);
  const r = tryMove(b, size, 4, 6, WHITE);
  assert.equal(r.captured.length, 2);
  assert.equal(r.koPoint, null);
});

test('grupo de varias piedras con 1 captura no fija koPoint', () => {
  const size = 9;
  const b = setup(size, [
    [4, 4, BLACK],
    [4, 3, WHITE], [5, 4, WHITE], [4, 5, WHITE], [6, 4, WHITE],
  ]);
  const r = tryMove(b, size, 3, 4, WHITE);
  assert.equal(r.ok, true);
  assert.equal(r.captured.length, 1);
  assert.equal(r.koPoint, null);
});

test('undo restaura el koPoint', () => {
  const game = createGame({ size: 9 });
  // Secuencia que llega a la posición de ko y la dispara
  const seq = [[1, 0], [2, 0], [0, 1], [1, 1], [1, 2], [3, 1], [4, 4], [2, 2]];
  for (const [x, y] of seq) {
    const r = playMove(game, x, y);
    assert.equal(r.ok, true, `movimiento ${x},${y} falló: ${r.reason}`);
  }
  assert.equal(game.koPoint, null);

  const r = playMove(game, 2, 1);
  assert.equal(r.ok, true, `jugada de ko falló: ${r.reason}`);
  assert.equal(game.koPoint, idx(9, 1, 1));

  undo(game);
  assert.equal(game.koPoint, null);
  redo(game);
  assert.equal(game.koPoint, idx(9, 1, 1));
});

test('pass incrementa consecutivePasses y resetea tras jugada', () => {
  const game = createGame({ size: 9 });
  playMove(game, 4, 4);
  assert.equal(game.consecutivePasses, 0);
  pass(game);
  assert.equal(game.consecutivePasses, 1);
  playMove(game, 0, 0);
  assert.equal(game.consecutivePasses, 0);
});
