import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY, BLACK, WHITE,
  createBoard, cloneBoard, idx, toXY, inBounds, neighbors, opponent,
} from '../src/core/board.js';

test('createBoard crea un tablero vacío del tamaño correcto', () => {
  const b = createBoard(19);
  assert.equal(b.length, 361);
  assert.ok(b.every((v) => v === EMPTY));
  assert.equal(createBoard(9).length, 81);
  assert.equal(createBoard(13).length, 169);
});

test('createBoard rechaza tamaños inválidos', () => {
  assert.throws(() => createBoard(1), RangeError);
  assert.throws(() => createBoard(26), RangeError);
  assert.throws(() => createBoard(9.5), RangeError);
});

test('idx / toXY roundtrip', () => {
  const size = 19;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = idx(size, x, y);
      assert.deepEqual(toXY(size, i), { x, y });
    }
  }
});

test('cloneBoard es una copia independiente', () => {
  const a = createBoard(9);
  a[0] = BLACK;
  const b = cloneBoard(a);
  b[0] = WHITE;
  assert.equal(a[0], BLACK);
  assert.equal(b[0], WHITE);
});

test('inBounds', () => {
  assert.equal(inBounds(9, 0, 0), true);
  assert.equal(inBounds(9, 8, 8), true);
  assert.equal(inBounds(9, -1, 0), false);
  assert.equal(inBounds(9, 0, -1), false);
  assert.equal(inBounds(9, 9, 0), false);
  assert.equal(inBounds(9, 0, 9), false);
});

test('neighbors: esquina 2, borde 3, centro 4', () => {
  const size = 9;
  assert.equal(neighbors(size, idx(size, 0, 0)).length, 2);
  assert.equal(neighbors(size, idx(size, 8, 8)).length, 2);
  assert.equal(neighbors(size, idx(size, 4, 0)).length, 3);
  assert.equal(neighbors(size, idx(size, 0, 4)).length, 3);
  assert.equal(neighbors(size, idx(size, 4, 4)).length, 4);
});

test('opponent alterna y rechaza valores inválidos', () => {
  assert.equal(opponent(BLACK), WHITE);
  assert.equal(opponent(WHITE), BLACK);
  assert.throws(() => opponent(EMPTY), TypeError);
  assert.throws(() => opponent(7), TypeError);
});
