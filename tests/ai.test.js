import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BLACK, WHITE, EMPTY, idx, cloneBoard } from '../src/core/board.js';
import { createGame, playMove } from '../src/core/game.js';
import { tryMove } from '../src/core/rules.js';
import { randomMove } from '../src/core/ai.js';

function seq(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

test('randomMove devuelve una jugada legal y en intersección vacía', () => {
  const g = createGame({ size: 9 });
  const mv = randomMove(g, seq([0.5]));
  assert.ok(mv && Number.isInteger(mv.x) && Number.isInteger(mv.y));
  assert.equal(g.board[idx(9, mv.x, mv.y)], EMPTY);
  const probe = cloneBoard(g.board);
  assert.equal(tryMove(probe, 9, mv.x, mv.y, BLACK, null).ok, true);
});

test('randomMove nunca elige una jugada suicida ni ocupada', () => {
  // Negras en (1,0) y (0,1): blanca en (0,0) sería suicida y no captura.
  const g = createGame({ size: 9 });
  g.board[idx(9, 1, 0)] = BLACK;
  g.board[idx(9, 0, 1)] = BLACK;
  g.turn = WHITE;
  for (let k = 0; k < 81 * 3; k++) {
    const mv = randomMove(g, seq([k / (81 * 3)]));
    assert.ok(mv, 'debe haber jugada');
    assert.notDeepEqual([mv.x, mv.y], [0, 0], 'jugada suicida');
    assert.equal(g.board[idx(9, mv.x, mv.y)], EMPTY, 'intersección ocupada');
    assert.equal(tryMove(g.board, 9, mv.x, mv.y, WHITE, null).ok, true);
  }
});

test('randomMove devuelve null si no hay jugadas legales', () => {
  // Tablero lleno: no quedan intersecciones vacías.
  const full = createGame({ size: 9 });
  full.board.fill(BLACK);
  full.turn = WHITE;
  assert.equal(randomMove(full), null);

  // Único punto vacío prohibido por ko.
  const ko = createGame({ size: 9 });
  ko.board.fill(BLACK);
  ko.board[0] = EMPTY;
  ko.turn = WHITE;
  ko.koPoint = 0;
  assert.equal(randomMove(ko), null);

  // Partida que no está en juego.
  const done = createGame({ size: 9 });
  done.phase = 'finished';
  assert.equal(randomMove(done), null);
});

test('randomMove no muta la partida', () => {
  const g = createGame({ size: 9 });
  playMove(g, 4, 4);
  const before = {
    board: cloneBoard(g.board),
    turn: g.turn,
    koPoint: g.koPoint,
    history: g.history.length,
    future: g.future.length,
    captures: { ...g.captures },
    phase: g.phase,
    consecutivePasses: g.consecutivePasses,
  };
  randomMove(g, seq([0.1, 0.9]));
  assert.deepEqual(g.board, before.board);
  assert.equal(g.turn, before.turn);
  assert.equal(g.koPoint, before.koPoint);
  assert.equal(g.history.length, before.history);
  assert.equal(g.future.length, before.future);
  assert.deepEqual(g.captures, before.captures);
  assert.equal(g.phase, before.phase);
  assert.equal(g.consecutivePasses, before.consecutivePasses);
});
