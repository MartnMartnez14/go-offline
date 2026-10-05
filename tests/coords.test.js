import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toLabel, parseLabel, COLUMN_LABELS } from '../src/core/coords.js';

test('COLUMN_LABELS no contiene la letra I', () => {
  assert.ok(!COLUMN_LABELS.includes('I'));
  assert.equal(COLUMN_LABELS.length, 19);
  assert.equal(COLUMN_LABELS[0], 'A');
  assert.equal(COLUMN_LABELS[8], 'J');
  assert.equal(COLUMN_LABELS[18], 'T');
});

test('toLabel: y=0 es la fila superior', () => {
  assert.equal(toLabel(19, 0, 0), 'A19');
  assert.equal(toLabel(19, 15, 3), 'Q16');
  assert.equal(toLabel(19, 3, 15), 'D4');
  assert.equal(toLabel(19, 8, 8), 'J11');
  assert.equal(toLabel(19, 9, 9), 'K10');
});

test('toLabel en 9x9 y 13x13', () => {
  assert.equal(toLabel(9, 0, 0), 'A9');
  assert.equal(toLabel(9, 8, 8), 'J1');
  assert.equal(toLabel(9, 2, 2), 'C7');
  assert.equal(toLabel(13, 3, 3), 'D10');
  assert.equal(toLabel(13, 9, 9), 'K4');
});

test('toLabel devuelve null fuera de rango', () => {
  assert.equal(toLabel(9, -1, 0), null);
  assert.equal(toLabel(9, 0, -1), null);
  assert.equal(toLabel(9, 9, 0), null);
  assert.equal(toLabel(9, 0, 9), null);
});

test('parseLabel roundtrip en 9x9, 13x13 y 19x19', () => {
  for (const size of [9, 13, 19]) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const label = toLabel(size, x, y);
        const back = parseLabel(size, label);
        assert.deepEqual(back, { x, y }, `falla en ${size}x${size} ${label}`);
      }
    }
  }
});

test('parseLabel es insensible a mayúsculas y espacios', () => {
  assert.deepEqual(parseLabel(19, 'd4'), { x: 3, y: 15 });
  assert.deepEqual(parseLabel(19, 'D4'), { x: 3, y: 15 });
  assert.deepEqual(parseLabel(19, '  Q16  '), { x: 15, y: 3 });
  assert.deepEqual(parseLabel(19, 'q16'), { x: 15, y: 3 });
});

test('parseLabel rechaza la letra I y etiquetas inválidas', () => {
  assert.equal(parseLabel(19, 'I1'), null);
  assert.equal(parseLabel(19, 'i1'), null);
  assert.equal(parseLabel(19, 'Z1'), null);
  assert.equal(parseLabel(19, 'A0'), null);
  assert.equal(parseLabel(19, 'A20'), null);
  assert.equal(parseLabel(9, 'A19'), null);
  assert.equal(parseLabel(19, ''), null);
  assert.equal(parseLabel(19, null), null);
});

test('la columna que sigue a H es J', () => {
  assert.equal(toLabel(19, 7, 0), 'H19');
  assert.equal(toLabel(19, 8, 0), 'J19');
  assert.deepEqual(parseLabel(19, 'J19'), { x: 8, y: 0 });
});
