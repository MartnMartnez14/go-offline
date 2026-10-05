import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BLACK, WHITE, createBoard, idx } from '../src/core/board.js';
import { scoreChinese } from '../src/core/scoring.js';

function setup(size, placements) {
  const b = createBoard(size);
  for (const [x, y, c] of placements) b[idx(size, x, y)] = c;
  return b;
}

test('tablero vacío: gana blanco por komi', () => {
  const b = createBoard(9);
  const s = scoreChinese(b, 9, 7.5);
  assert.equal(s.black.total, 0);
  assert.equal(s.white.total, 7.5);
  assert.equal(s.winner, 'W');
  assert.equal(s.margin, 7.5);
  assert.equal(s.neutral, 81);
});

test('tablero vacío con komi entero puede empatar', () => {
  const b = createBoard(9);
  const s = scoreChinese(b, 9, 0);
  assert.equal(s.winner, 'D');
  assert.equal(s.margin, 0);
});

test('área china: piedras + territorio', () => {
  const size = 9;
  // Negro ocupa la columna 0 completa; el resto queda vacío.
  const b = createBoard(size);
  for (let y = 0; y < size; y++) b[idx(size, 0, y)] = BLACK;
  const s = scoreChinese(b, size, 7.5);
  // Negro: 9 piedras + territorio (columnas 1..8 = 72 puntos)
  assert.equal(s.black.stones, 9);
  assert.equal(s.black.territory, 72);
  assert.equal(s.black.total, 81);
  assert.equal(s.white.total, 7.5);
  assert.equal(s.winner, 'B');
});

test('territorio rodeado por un solo color', () => {
  const size = 9;
  // Negro encierra (1,1) en una bolsa; blanco en (8,8) deja el exterior neutro
  const b = setup(size, [
    [0, 0, BLACK], [1, 0, BLACK], [2, 0, BLACK],
    [0, 1, BLACK], [2, 1, BLACK],
    [0, 2, BLACK], [1, 2, BLACK], [2, 2, BLACK],
    [8, 8, WHITE],
  ]);
  const s = scoreChinese(b, size, 0);
  assert.equal(s.black.stones, 8);
  assert.equal(s.black.territory, 1);
  assert.equal(s.black.total, 9);
  assert.equal(s.white.stones, 1);
  assert.equal(s.white.territory, 0);
  assert.equal(s.neutral, 81 - 8 - 1 - 1);
});

test('piedras muertas se retiran y su punto pasa a territorio del rival', () => {
  const size = 9;
  // Negra en (4,4) rodeada por blancas; (0,0) negra deja el exterior neutro
  const b = setup(size, [
    [4, 4, BLACK],
    [3, 4, WHITE], [5, 4, WHITE], [4, 3, WHITE], [4, 5, WHITE],
    [0, 0, BLACK],
  ]);
  // Sin marcar muertas: negro tiene 2 piedras y (4,4) es territorio neutral
  const s0 = scoreChinese(b, size, 0);
  assert.equal(s0.black.stones, 2);
  assert.equal(s0.white.territory, 0);

  // Marcando la piedra negra de (4,4) como muerta
  const s1 = scoreChinese(b, size, 0, [idx(size, 4, 4)]);
  assert.equal(s1.black.stones, 1);
  assert.equal(s1.white.stones, 4);
  // (4,4) queda vacío y solo linda con blancas -> territorio blanco
  assert.equal(s1.white.territory, 1);
  assert.equal(s1.white.total, 5);
});

test('seki: los puntos compartidos son neutrales', () => {
  const size = 9;
  // Dos grupos vivos compartiendo libertades (seki clásico)
  // Negro: (3,3)(3,4)  Blanco: (5,3)(5,4)
  // Puntos vacíos entre ellos: (4,3)(4,4)
  const b = setup(size, [
    [3, 3, BLACK], [3, 4, BLACK],
    [5, 3, WHITE], [5, 4, WHITE],
  ]);
  const s = scoreChinese(b, size, 0);
  // Región vacía conectada (todo el tablero): toca negro y blanco -> neutral
  assert.equal(s.neutral, 81 - 4);
  assert.equal(s.black.territory, 0);
  assert.equal(s.white.territory, 0);
  assert.equal(s.black.total, 2);
  assert.equal(s.white.total, 2);
  assert.equal(s.winner, 'D');
});

test('región vacía que toca ambos colores no es territorio de nadie', () => {
  const size = 5;
  const b = setup(size, [
    [0, 0, BLACK], [4, 4, WHITE],
  ]);
  const s = scoreChinese(b, size, 0);
  assert.equal(s.black.territory, 0);
  assert.equal(s.white.territory, 0);
  assert.equal(s.neutral, 23);
});

test('recuento de área chino exacto', () => {
  const size = 5;
  // Negro: esquina superior izquierda 3x3
  const b = setup(size, [
    [0, 0, BLACK], [1, 0, BLACK], [2, 0, BLACK],
    [0, 1, BLACK], [1, 1, BLACK], [2, 1, BLACK],
    [0, 2, BLACK], [1, 2, BLACK], [2, 2, BLACK],
  ]);
  // Blanco: esquina inferior derecha 2x2
  for (const [x, y] of [[3, 3], [4, 3], [3, 4], [4, 4]]) b[idx(size, x, y)] = WHITE;
  const s = scoreChinese(b, size, 0);
  assert.equal(s.black.stones, 9);
  assert.equal(s.white.stones, 4);
  // Región vacía: toca ambos -> neutral
  assert.equal(s.black.territory, 0);
  assert.equal(s.white.territory, 0);
  assert.equal(s.neutral, 25 - 13);
});

test('komi se aplica solo a blanco', () => {
  const b = createBoard(9);
  const s = scoreChinese(b, 9, 6.5);
  assert.equal(s.white.total, 6.5);
  assert.equal(s.black.total, 0);
  assert.equal(s.komi, 6.5);
});

test('margin es la diferencia absoluta', () => {
  const size = 9;
  const b = createBoard(size);
  for (let y = 0; y < size; y++) b[idx(size, 0, y)] = BLACK;
  const s = scoreChinese(b, size, 0);
  assert.equal(s.margin, 81);
  assert.equal(s.winner, 'B');
});
