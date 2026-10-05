/**
 * Representación básica del tablero de Go.
 * Puro: sin DOM, sin almacenamiento.
 */

export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;

export function opponent(color) {
  if (color !== BLACK && color !== WHITE) {
    throw new TypeError(`Color inválido: ${color}`);
  }
  return color === BLACK ? WHITE : BLACK;
}

export function createBoard(size) {
  if (!Number.isInteger(size) || size < 2 || size > 25) {
    throw new RangeError(`Tamaño de tablero inválido: ${size}`);
  }
  return new Uint8Array(size * size);
}

export function cloneBoard(board) {
  return Uint8Array.from(board);
}

export function idx(size, x, y) {
  return y * size + x;
}

export function toXY(size, i) {
  return { x: i % size, y: Math.floor(i / size) };
}

export function inBounds(size, x, y) {
  return x >= 0 && y >= 0 && x < size && y < size;
}

export function neighbors(size, i) {
  const x = i % size;
  const y = Math.floor(i / size);
  const out = [];
  if (x > 0) out.push(i - 1);
  if (x < size - 1) out.push(i + 1);
  if (y > 0) out.push(i - size);
  if (y < size - 1) out.push(i + size);
  return out;
}
