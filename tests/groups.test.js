import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY, BLACK, WHITE, createBoard, idx } from '../src/core/board.js';
import { getGroup, countLiberties } from '../src/core/groups.js';

test('piedra sola en esquina: 2 libertades', () => {
  const b = createBoard(9);
  const i = idx(9, 0, 0);
  b[i] = BLACK;
  const g = getGroup(b, 9, i);
  assert.equal(g.stones.length, 1);
  assert.equal(g.liberties.size, 2);
});

test('piedra sola en borde: 3 libertades', () => {
  const b = createBoard(9);
  const i = idx(9, 4, 0);
  b[i] = BLACK;
  assert.equal(countLiberties(b, 9, i), 3);
});

test('piedra sola en centro: 4 libertades', () => {
  const b = createBoard(9);
  const i = idx(9, 4, 4);
  b[i] = BLACK;
  assert.equal(countLiberties(b, 9, i), 4);
});

test('grupo de 2 piedras: libertades contadas una sola vez', () => {
  const b = createBoard(9);
  const a = idx(9, 3, 3);
  const c = idx(9, 4, 3);
  b[a] = BLACK;
  b[c] = BLACK;
  const g = getGroup(b, 9, a);
  assert.equal(g.stones.length, 2);
  // 6 libertades compartidas: (2,3)(5,3)(3,2)(4,2)(3,4)(4,4)
  assert.equal(g.liberties.size, 6);
  assert.equal(countLiberties(b, 9, c), 6);
});

test('grupo en forma de C: las libertades internas cuentan una vez', () => {
  const size = 9;
  const b = createBoard(size);
  // C alrededor de (4,4): piedras en (3,3)(4,3)(5,3)(3,4)(3,5)(4,5)(5,5)
  const stones = [
    [3, 3], [4, 3], [5, 3],
    [3, 4], [3, 5],
    [4, 5], [5, 5],
  ];
  for (const [x, y] of stones) b[idx(size, x, y)] = BLACK;
  const g = getGroup(b, size, idx(size, 3, 3));
  assert.equal(g.stones.length, 7);
  // El hueco interior (4,4) y (5,4) son libertades
  assert.ok(g.liberties.has(idx(size, 4, 4)));
  assert.ok(g.liberties.has(idx(size, 5, 4)));
  assert.equal(g.liberties.size, 13);
});

test('piedras del mismo color adyacentes forman un solo grupo', () => {
  const size = 9;
  const b = createBoard(size);
  b[idx(size, 2, 2)] = BLACK;
  b[idx(size, 3, 2)] = BLACK;
  b[idx(size, 3, 3)] = BLACK;
  const g = getGroup(b, size, idx(size, 2, 2));
  assert.equal(g.stones.length, 3);
  assert.equal(g.color, BLACK);
});

test('piedras de color distinto no se agrupan', () => {
  const size = 9;
  const b = createBoard(size);
  b[idx(size, 2, 2)] = BLACK;
  b[idx(size, 3, 2)] = WHITE;
  assert.equal(getGroup(b, size, idx(size, 2, 2)).stones.length, 1);
  assert.equal(getGroup(b, size, idx(size, 3, 2)).stones.length, 1);
});

test('getGroup lanza si la casilla está vacía', () => {
  const b = createBoard(9);
  assert.throws(() => getGroup(b, 9, 0), TypeError);
});

test('las libertades son solo casillas vacías', () => {
  const size = 9;
  const b = createBoard(size);
  b[idx(size, 4, 4)] = BLACK;
  b[idx(size, 5, 4)] = WHITE;
  const g = getGroup(b, size, idx(size, 4, 4));
  for (const l of g.liberties) {
    assert.equal(b[l], EMPTY);
  }
  assert.equal(g.liberties.size, 3);
});
