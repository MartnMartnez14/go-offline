/**
 * Coordenadas al estilo Go.
 * Columnas A..T sin la letra I. Filas numeradas desde abajo (1 abajo).
 * Internamente y=0 es la fila superior.
 */

export const COLUMN_LABELS = 'ABCDEFGHJKLMNOPQRST';

export function toLabel(size, x, y) {
  if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
  if (x < 0 || y < 0 || x >= size || y >= size) return null;
  return `${COLUMN_LABELS[x]}${size - y}`;
}

export function parseLabel(size, label) {
  if (typeof label !== 'string') return null;
  const m = label.trim().toUpperCase().match(/^([A-Z])(\d{1,2})$/);
  if (!m) return null;
  const col = COLUMN_LABELS.indexOf(m[1]);
  if (col < 0) return null;
  const row = parseInt(m[2], 10);
  const y = size - row;
  const x = col;
  if (x < 0 || y < 0 || x >= size || y >= size) return null;
  return { x, y };
}
