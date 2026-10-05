import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BLACK, WHITE, EMPTY, idx } from '../src/core/board.js';
import {
  createGame, playMove, pass, resign, undo, redo, canUndo, canRedo,
  markDeadToggle, cancelScoring, computeScore, confirmScore,
  serialize, deserialize, handicapPoints,
} from '../src/core/game.js';

test('createGame: configuración por defecto', () => {
  const g = createGame();
  assert.equal(g.size, 19);
  assert.equal(g.komi, 7.5);
  assert.equal(g.handicap, 0);
  assert.equal(g.turn, BLACK);
  assert.equal(g.phase, 'playing');
  assert.equal(g.board.length, 361);
});

test('createGame rechaza tamaños y handicap inválidos', () => {
  assert.throws(() => createGame({ size: 10 }), RangeError);
  assert.throws(() => createGame({ size: 25 }), RangeError);
  assert.throws(() => createGame({ handicap: -1 }), RangeError);
  assert.throws(() => createGame({ handicap: 10 }), RangeError);
  assert.throws(() => createGame({ handicap: 1 }), RangeError);
  assert.throws(() => createGame({ handicap: 2.5 }), RangeError);
});

test('alternancia de turnos', () => {
  const g = createGame({ size: 9 });
  assert.equal(g.turn, BLACK);
  playMove(g, 4, 4);
  assert.equal(g.turn, WHITE);
  playMove(g, 0, 0);
  assert.equal(g.turn, BLACK);
});

test('jugada ilegal no alterna turno ni registra historial', () => {
  const g = createGame({ size: 9 });
  playMove(g, 4, 4);
  const r = playMove(g, 4, 4);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'occupied');
  assert.equal(g.turn, WHITE);
  assert.equal(g.history.length, 1);
});

test('dos pases seguidos pasan a fase scoring', () => {
  const g = createGame({ size: 9 });
  playMove(g, 4, 4);
  pass(g);
  assert.equal(g.phase, 'playing');
  pass(g);
  assert.equal(g.phase, 'scoring');
  assert.equal(g.consecutivePasses, 2);
});

test('rendirse termina la partida', () => {
  const g = createGame({ size: 9 });
  const r = resign(g, BLACK);
  assert.equal(r.ok, true);
  assert.equal(g.phase, 'finished');
  assert.equal(g.result.reason, 'resign');
  assert.equal(g.result.winner, 'W');
});

test('undo y redo tras capturas mantienen contadores consistentes', () => {
  const g = createGame({ size: 9 });
  // Negro (4,4), Blanco (4,3), Negro (5,4), Blanco (3,4), Negro (5,5),
  // Blanco (4,5) captura? No. Usamos la secuencia de captura directa:
  playMove(g, 4, 4); // N
  playMove(g, 3, 4); // B
  playMove(g, 5, 4); // N
  playMove(g, 4, 3); // B
  playMove(g, 4, 5); // N
  playMove(g, 4, 6); // B
  playMove(g, 3, 5); // N
  playMove(g, 5, 5); // B
  // Negro (4,4) grupo {(4,4)}: vecinos (4,3)B (3,4)B (5,4)N (4,5)N -> conectado con (5,4),(4,5)
  // Verificamos solo la consistencia de undo/redo.
  const n = g.history.length;
  assert.equal(n, 8);
  const capsBefore = g.captures.black + g.captures.white;

  undo(g);
  assert.equal(g.history.length, 7);
  redo(g);
  assert.equal(g.history.length, 8);
  assert.equal(g.captures.black + g.captures.white, capsBefore);
  assert.equal(g.board.filter((v) => v !== EMPTY).length, 8);
});

test('undo devuelve false sin historial y redo sin futuro', () => {
  const g = createGame({ size: 9 });
  assert.equal(undo(g), false);
  assert.equal(redo(g), false);
  assert.equal(canUndo(g), false);
  assert.equal(canRedo(g), false);
});

test('handicap 9 en 19x19 coloca 9 piedras negras y empieza blanco', () => {
  const g = createGame({ size: 19, handicap: 9 });
  assert.equal(g.board.filter((v) => v === BLACK).length, 9);
  assert.equal(g.turn, WHITE);
  assert.equal(g.board[idx(19, 9, 9)], BLACK); // K10
  assert.equal(g.board[idx(19, 3, 3)], BLACK); // D16
  assert.equal(g.board[idx(19, 15, 15)], BLACK); // Q4
});

test('handicap 2 en 9x9', () => {
  const g = createGame({ size: 9, handicap: 2 });
  assert.equal(g.board.filter((v) => v === BLACK).length, 2);
  assert.equal(g.board[idx(9, 2, 2)], BLACK); // C7
  assert.equal(g.board[idx(9, 6, 6)], BLACK); // G3
});

test('markDeadToggle solo funciona en fase scoring', () => {
  const g = createGame({ size: 9 });
  playMove(g, 4, 4);
  assert.equal(markDeadToggle(g, idx(9, 4, 4)), false);
  pass(g);
  pass(g);
  assert.equal(g.phase, 'scoring');
  assert.equal(markDeadToggle(g, idx(9, 4, 4)), true);
  assert.deepEqual(g.dead, [idx(9, 4, 4)]);
  assert.equal(markDeadToggle(g, idx(9, 4, 4)), true);
  assert.deepEqual(g.dead, []);
  // Casilla vacía no se marca
  assert.equal(markDeadToggle(g, idx(9, 0, 0)), false);
});

test('cancelScoring vuelve a playing y limpia muertas', () => {
  const g = createGame({ size: 9 });
  playMove(g, 4, 4);
  pass(g);
  pass(g);
  markDeadToggle(g, idx(9, 4, 4));
  assert.equal(cancelScoring(g), true);
  assert.equal(g.phase, 'playing');
  assert.deepEqual(g.dead, []);
  assert.equal(g.consecutivePasses, 0);
});

test('confirmScore termina la partida con resultado', () => {
  const g = createGame({ size: 9, komi: 7.5 });
  pass(g);
  pass(g);
  const score = confirmScore(g);
  assert.equal(g.phase, 'finished');
  assert.equal(g.result.reason, 'score');
  // Tablero vacío: negro 0, blanco 0 + 7.5 -> gana blanco
  assert.equal(score.winner, 'W');
  assert.equal(g.result.winner, 'W');
});

test('computeScore sin confirmar no cambia el estado', () => {
  const g = createGame({ size: 9 });
  playMove(g, 4, 4);
  pass(g);
  pass(g);
  const s = computeScore(g);
  assert.equal(g.phase, 'scoring');
  assert.ok(s.black.total >= 0);
});

test('serialize / deserialize roundtrip', () => {
  const g = createGame({
    size: 13, komi: 6.5, handicap: 2,
    blackName: 'Alice', whiteName: 'Bob',
  });
  // Evitamos los puntos de handicap de 13x13 (3,3) y (9,9)
  playMove(g, 2, 2);
  playMove(g, 10, 10);
  playMove(g, 2, 10);
  playMove(g, 10, 2);
  pass(g);
  playMove(g, 6, 6);

  const data = serialize(g);
  assert.equal(data.size, 13);
  assert.equal(data.handicap, 2);
  assert.equal(data.moves.length, 6);

  const g2 = deserialize(data);
  assert.equal(g2.size, 13);
  assert.equal(g2.komi, 6.5);
  assert.equal(g2.handicap, 2);
  assert.equal(g2.meta.blackName, 'Alice');
  assert.equal(g2.meta.whiteName, 'Bob');
  assert.deepEqual(Array.from(g2.board), Array.from(g.board));
  assert.equal(g2.turn, g.turn);
  assert.equal(g2.captures.black, g.captures.black);
  assert.equal(g2.captures.white, g.captures.white);
});

test('serialize / deserialize preserva el resultado final', () => {
  const g = createGame({ size: 9 });
  resign(g, BLACK);
  const g2 = deserialize(serialize(g));
  assert.equal(g2.phase, 'finished');
  assert.equal(g2.result.reason, 'resign');
  assert.equal(g2.result.winner, 'W');
});

test('el autoguardado tras cada movimiento mantiene el historial', () => {
  const g = createGame({ size: 9 });
  for (let i = 0; i < 5; i++) playMove(g, i, i);
  assert.equal(g.history.length, 5);
  assert.equal(g.future.length, 0);
  const g2 = deserialize(serialize(g));
  assert.equal(g2.history.length, 5);
});

test('cancelar la puntuación sobrevive a un guardado y carga', () => {
  const g = createGame({ size: 9, komi: 7.5 });
  playMove(g, 4, 4);
  pass(g);
  pass(g);
  assert.equal(g.phase, 'scoring');
  markDeadToggle(g, idx(9, 4, 4));
  cancelScoring(g);
  assert.equal(g.phase, 'playing');

  const g2 = deserialize(serialize(g));
  assert.equal(g2.phase, 'playing', 'la fase debe conservarse tras recargar');
  assert.equal(g2.consecutivePasses, 0, 'los pases deben quedar reseteados');
  assert.deepEqual(g2.dead, [], 'las muertas deben limpiarse');
});

test('las piedras muertas marcadas sobreviven a un guardado y carga', () => {
  const g = createGame({ size: 9, komi: 7.5 });
  playMove(g, 4, 4);
  pass(g);
  pass(g);
  markDeadToggle(g, idx(9, 4, 4));
  assert.equal(g.phase, 'scoring');

  const g2 = deserialize(serialize(g));
  assert.equal(g2.phase, 'scoring');
  assert.deepEqual(g2.dead, [idx(9, 4, 4)], 'el marcado de muertas debe conservarse');
});

test('serialize expone consecutivePasses y fase', () => {
  const g = createGame({ size: 9 });
  pass(g);
  const data = serialize(g);
  assert.equal(data.phase, 'playing');
  assert.equal(data.consecutivePasses, 1);
  assert.ok('dead' in data);
});

test('CRÍTICO: las jugadas posteriores a «volver a jugar» no se pierden al recargar', () => {
  const g = createGame({ size: 9, komi: 7.5 });
  playMove(g, 2, 2);
  playMove(g, 3, 3);
  pass(g);
  pass(g);
  assert.equal(g.phase, 'scoring');
  cancelScoring(g);
  assert.equal(g.phase, 'playing');

  playMove(g, 4, 4);
  playMove(g, 5, 5);
  playMove(g, 6, 6);
  // 2 jugadas + 2 pases + 3 jugadas = 7
  assert.equal(g.history.length, 7);

  const g2 = deserialize(serialize(g));
  assert.equal(g2.history.length, 7, 'ninguna jugada debe perderse al recargar');
  assert.deepEqual(Array.from(g2.board), Array.from(g.board), 'el tablero debe coincidir');
  assert.equal(g2.phase, 'playing');
  assert.equal(g2.turn, g.turn);
});

test('las marcas de muertas no las borra un undo', () => {
  const g = createGame({ size: 9, komi: 7.5 });
  playMove(g, 4, 4);
  pass(g);
  pass(g);
  markDeadToggle(g, idx(9, 4, 4));
  assert.equal(g.phase, 'scoring');

  assert.equal(undo(g), false, 'undo debe estar bloqueado en fase de puntuación');
  assert.equal(redo(g), false, 'redo debe estar bloqueado en fase de puntuación');
  assert.deepEqual(g.dead, [idx(9, 4, 4)], 'las muertas deben seguir marcadas');
  assert.equal(g.phase, 'scoring');
});

test('pass levanta la restricción de ko', () => {
  const g = createGame({ size: 9 });
  // Construimos un ko y comprobamos que un pase lo libera.
  const seq = [[1, 0], [2, 0], [0, 1], [1, 1], [1, 2], [3, 1], [4, 4], [2, 2]];
  for (const [x, y] of seq) {
    const r = playMove(g, x, y);
    assert.equal(r.ok, true, `mov ${x},${y}: ${r.reason}`);
  }
  const r = playMove(g, 2, 1);
  assert.equal(r.ok, true);
  assert.equal(g.koPoint, idx(9, 1, 1));
  pass(g);
  assert.equal(g.koPoint, null, 'un pase consume el turno prohibido');
});

test('rehacer sigue disponible tras guardar y recargar', () => {
  const g = createGame({ size: 9 });
  playMove(g, 0, 0);
  playMove(g, 1, 1);
  playMove(g, 2, 2);
  undo(g);
  undo(g);
  assert.equal(g.history.length, 1);
  assert.equal(canRedo(g), true);

  const g2 = deserialize(serialize(g));
  assert.equal(g2.history.length, 1);
  assert.equal(canRedo(g2), true, 'las jugadas deshechas deben sobrevivir al guardado');
  assert.equal(redo(g2), true);
  assert.equal(g2.history.length, 2);
  // La jugada 2 (1,1) es de blancas: negro movió primero.
  assert.equal(g2.board[idx(9, 1, 1)], WHITE);
});

test('deserialize tolera datos corruptos sin contaminar el recuento', () => {
  const g = deserialize({
    size: 'nueve',
    komi: '7.5',
    handicap: 'x',
    moves: [
      { type: 'play', x: 0, y: 0, color: BLACK },
      { type: 'play', x: 1, y: 1, color: 'X' },
      { type: 'play', x: 'a', y: 0, color: WHITE },
      null,
      { type: 'resign', color: 'Z' },
    ],
    meta: { blackName: 42, whiteName: null },
  });
  assert.equal(g.size, 19);
  assert.equal(g.komi, 7.5);
  assert.equal(typeof g.komi, 'number');
  assert.equal(g.handicap, 0);
  assert.equal(g.meta.blackName, 'Negras');
  // Solo debe haberse aplicado el primer movimiento válido
  assert.equal(g.board[idx(19, 0, 0)], BLACK);

  const score = computeScore(g);
  assert.equal(typeof score.white.total, 'number');
  assert.equal(typeof score.black.total, 'number');
});

test('handicapPoints devuelve los puntos estándar', () => {
  const two = handicapPoints(19, 2);
  assert.equal(two.length, 2);
  assert.deepEqual(two[0], { x: 3, y: 3 });
  assert.deepEqual(two[1], { x: 15, y: 15 });

  const nine = handicapPoints(19, 9);
  assert.equal(nine.length, 9);
  assert.deepEqual(nine[8], { x: 9, y: 9 });

  assert.deepEqual(handicapPoints(19, 0), []);
  assert.deepEqual(handicapPoints(19, 1), []);
});
