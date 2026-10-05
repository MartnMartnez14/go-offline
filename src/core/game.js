/**
 * Estado de partida: turnos, capturas, ko, pases, abandono,
 * undo/redo, handicap, marcado de muertas y serialización.
 */

import {
  EMPTY, BLACK, WHITE,
  createBoard, cloneBoard, idx, opponent,
} from './board.js';
import { tryMove } from './rules.js';
import { scoreChinese } from './scoring.js';

const HANDICAP = {
  9: {
    2: [[2, 2], [6, 6]],
    3: [[2, 2], [6, 6], [6, 2]],
    4: [[2, 2], [6, 6], [6, 2], [2, 6]],
    5: [[2, 2], [6, 6], [6, 2], [2, 6], [4, 4]],
    6: [[2, 2], [6, 2], [2, 6], [6, 6], [2, 4], [6, 4]],
    7: [[2, 2], [6, 2], [2, 6], [6, 6], [2, 4], [6, 4], [4, 4]],
    8: [[2, 4], [6, 4], [2, 2], [6, 2], [2, 6], [6, 6], [4, 2], [4, 6]],
    9: [[2, 4], [6, 4], [2, 2], [6, 2], [2, 6], [6, 6], [4, 2], [4, 6], [4, 4]],
  },
  13: {
    2: [[3, 3], [9, 9]],
    3: [[3, 3], [9, 9], [9, 3]],
    4: [[3, 3], [9, 9], [9, 3], [3, 9]],
    5: [[3, 3], [9, 9], [9, 3], [3, 9], [6, 6]],
    6: [[3, 3], [9, 3], [3, 9], [9, 9], [3, 6], [9, 6]],
    7: [[3, 3], [9, 3], [3, 9], [9, 9], [3, 6], [9, 6], [6, 6]],
    8: [[3, 6], [9, 6], [3, 3], [9, 3], [3, 9], [9, 9], [6, 3], [6, 9]],
    9: [[3, 6], [9, 6], [3, 3], [9, 3], [3, 9], [9, 9], [6, 3], [6, 9], [6, 6]],
  },
  19: {
    2: [[3, 3], [15, 15]],
    3: [[3, 3], [15, 15], [15, 3]],
    4: [[3, 3], [15, 15], [15, 3], [3, 15]],
    5: [[3, 3], [15, 15], [15, 3], [3, 15], [9, 9]],
    6: [[3, 3], [15, 3], [3, 15], [15, 15], [3, 9], [15, 9]],
    7: [[3, 3], [15, 3], [3, 15], [15, 15], [3, 9], [15, 9], [9, 9]],
    8: [[3, 9], [15, 9], [3, 3], [15, 3], [3, 15], [15, 15], [9, 3], [9, 15]],
    9: [[3, 9], [15, 9], [3, 3], [15, 3], [3, 15], [15, 15], [9, 3], [9, 15], [9, 9]],
  },
};

export { BLACK, WHITE, EMPTY };

function newId() {
  return `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function snapshot(game) {
  return {
    board: cloneBoard(game.board),
    turn: game.turn,
    captures: { black: game.captures.black, white: game.captures.white },
    koPoint: game.koPoint,
    consecutivePasses: game.consecutivePasses,
    phase: game.phase,
    dead: [...game.dead],
    result: game.result ? { ...game.result } : null,
  };
}

function restore(game, snap) {
  game.board = cloneBoard(snap.board);
  game.turn = snap.turn;
  game.captures = { black: snap.captures.black, white: snap.captures.white };
  game.koPoint = snap.koPoint;
  game.consecutivePasses = snap.consecutivePasses;
  game.phase = snap.phase;
  game.dead = [...snap.dead];
  game.result = snap.result ? { ...snap.result } : null;
}

function touch(game) {
  game.meta.updatedAt = Date.now();
}

/**
 * @param {Object} [options]
 * @param {number} [options.size=19]
 * @param {number} [options.komi=7.5]
 * @param {number} [options.handicap=0]
 */
export function createGame(options = {}) {
  const size = options.size ?? 19;
  const komi = options.komi ?? 7.5;
  const handicap = options.handicap ?? 0;

  if (![9, 13, 19].includes(size)) {
    throw new RangeError(`Tamaño no soportado: ${size}`);
  }
  if (!Number.isInteger(handicap) || handicap < 0 || handicap > 9) {
    throw new RangeError(`Handicap inválido: ${handicap}`);
  }
  if (handicap > 0 && !HANDICAP[size]?.[handicap]) {
    throw new RangeError(`Handicap ${handicap} no disponible para ${size}x${size}`);
  }

  const board = createBoard(size);
  if (handicap > 0) {
    for (const [x, y] of HANDICAP[size][handicap]) {
      board[idx(size, x, y)] = BLACK;
    }
  }

  const now = Date.now();
  return {
    id: options.id ?? newId(),
    size,
    komi,
    handicap,
    rules: 'chinese',
    board,
    turn: handicap > 0 ? WHITE : BLACK,
    captures: { black: 0, white: 0 },
    koPoint: null,
    phase: 'playing',
    consecutivePasses: 0,
    dead: [],
    history: [],
    future: [],
    result: null,
    meta: {
      blackName: options.blackName ?? 'Negras',
      whiteName: options.whiteName ?? 'Blancas',
      createdAt: options.createdAt ?? now,
      updatedAt: now,
      note: options.note ?? '',
    },
  };
}

export function playMove(game, x, y) {
  if (game.phase !== 'playing') {
    return { ok: false, reason: 'not-playing' };
  }
  const before = snapshot(game);
  const res = tryMove(game.board, game.size, x, y, game.turn, game.koPoint);
  if (!res.ok) return res;

  game.board = res.board;
  game.koPoint = res.koPoint;
  const mover = game.turn;
  if (res.captured.length > 0) {
    game.captures[mover === BLACK ? 'black' : 'white'] += res.captured.length;
  }
  game.consecutivePasses = 0;
  game.turn = opponent(game.turn);
  touch(game);

  game.history.push({
    move: { type: 'play', x, y, color: mover, captured: [...res.captured] },
    before,
    after: snapshot(game),
  });
  game.future.length = 0;

  return { ok: true, captured: [...res.captured] };
}

export function pass(game) {
  if (game.phase !== 'playing') {
    return { ok: false, reason: 'not-playing' };
  }
  const before = snapshot(game);
  const mover = game.turn;
  game.consecutivePasses += 1;
  // El ko solo prohibe la jugada inmediata: un pase consume ese turno.
  game.koPoint = null;
  game.turn = opponent(game.turn);
  if (game.consecutivePasses >= 2) game.phase = 'scoring';
  touch(game);

  game.history.push({
    move: { type: 'pass', x: null, y: null, color: mover, captured: [] },
    before,
    after: snapshot(game),
  });
  game.future.length = 0;
  return { ok: true };
}

export function resign(game, color = game.turn) {
  if (game.phase === 'finished') {
    return { ok: false, reason: 'already-finished' };
  }
  const before = snapshot(game);
  game.phase = 'finished';
  game.result = {
    winner: opponent(color) === BLACK ? 'B' : 'W',
    margin: null,
    reason: 'resign',
  };
  touch(game);

  game.history.push({
    move: { type: 'resign', x: null, y: null, color, captured: [] },
    before,
    after: snapshot(game),
  });
  game.future.length = 0;
  return { ok: true };
}

export function canUndo(game) {
  return game.history.length > 0;
}

export function canRedo(game) {
  return game.future.length > 0;
}

export function undo(game) {
  // En fase de puntuación el historial no debe moverse: el trabajo del
  // usuario son las marcas de muertas, y un undo las barrería sin aviso.
  // Para seguir jugando hay que "volver a jugar" antes.
  if (game.phase === 'scoring') return false;
  const entry = game.history.pop();
  if (!entry) return false;
  game.future.push(entry);
  restore(game, entry.before);
  touch(game);
  return true;
}

export function redo(game) {
  if (game.phase === 'scoring') return false;
  const entry = game.future.pop();
  if (!entry) return false;
  restore(game, entry.after);
  game.history.push(entry);
  touch(game);
  return true;
}

export function markDeadToggle(game, i) {
  if (game.phase !== 'scoring') return false;
  if (i < 0 || i >= game.board.length) return false;
  if (game.board[i] === EMPTY) return false;
  const at = game.dead.indexOf(i);
  if (at >= 0) game.dead.splice(at, 1);
  else game.dead.push(i);
  touch(game);
  return true;
}

export function clearDead(game) {
  game.dead = [];
  touch(game);
}

export function cancelScoring(game) {
  if (game.phase !== 'scoring') return false;
  game.phase = 'playing';
  game.dead = [];
  game.consecutivePasses = 0;
  touch(game);
  return true;
}

export function computeScore(game) {
  return scoreChinese(game.board, game.size, game.komi, game.dead);
}

export function confirmScore(game) {
  if (game.phase !== 'scoring') return null;
  const score = computeScore(game);
  game.phase = 'finished';
  game.result = { winner: score.winner, margin: score.margin, reason: 'score' };
  touch(game);
  return score;
}

export function serialize(game) {
  // Se guardan también las jugadas deshechas, para que "rehacer" siga
  // disponible tras recargar. El orden de `future` es inverso al cronológico.
  const undone = game.future
    .slice()
    .reverse()
    .map((h) => ({ type: h.move.type, x: h.move.x, y: h.move.y, color: h.move.color }));

  return {
    v: 1,
    id: game.id,
    size: game.size,
    komi: game.komi,
    handicap: game.handicap,
    rules: game.rules,
    phase: game.phase,
    consecutivePasses: game.consecutivePasses,
    dead: [...game.dead],
    result: game.result ? { ...game.result } : null,
    meta: { ...game.meta },
    undoneCount: undone.length,
    moves: [
      ...game.history.map((h) => ({
        type: h.move.type, x: h.move.x, y: h.move.y, color: h.move.color,
      })),
      ...undone,
    ],
  };
}

/**
 * Aplica un movimiento durante la reconstrucción desde almacenamiento.
 * No aplica los candados de fase: el estado final (fase, muertas, pases)
 * se restaura aparte al terminar. Así no se pierden jugadas por culpa de
 * un "volver a jugar" intermedio.
 */
function replayMove(game, m) {
  const before = snapshot(game);

  if (m.type === 'resign') {
    const color = m.color === BLACK || m.color === WHITE ? m.color : game.turn;
    game.phase = 'finished';
    game.result = {
      winner: opponent(color) === BLACK ? 'B' : 'W',
      margin: null,
      reason: 'resign',
    };
    game.history.push({
      move: { type: 'resign', x: null, y: null, color, captured: [] },
      before, after: snapshot(game),
    });
    return true;
  }

  if (m.type === 'pass') {
    const mover = game.turn;
    game.consecutivePasses += 1;
    game.koPoint = null;
    game.turn = opponent(game.turn);
    game.history.push({
      move: { type: 'pass', x: null, y: null, color: mover, captured: [] },
      before, after: snapshot(game),
    });
    return true;
  }

  const x = Number(m.x);
  const y = Number(m.y);
  if (!Number.isInteger(x) || !Number.isInteger(y)) return false;

  const res = tryMove(game.board, game.size, x, y, game.turn, game.koPoint);
  if (!res.ok) return false;

  const mover = game.turn;
  game.board = res.board;
  game.koPoint = res.koPoint;
  if (res.captured.length > 0) {
    game.captures[mover === BLACK ? 'black' : 'white'] += res.captured.length;
  }
  game.consecutivePasses = 0;
  game.turn = opponent(game.turn);
  game.history.push({
    move: { type: 'play', x, y, color: mover, captured: [...res.captured] },
    before, after: snapshot(game),
  });
  return true;
}

function toFinite(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toInt(value, fallback) {
  const n = Number(value);
  return Number.isInteger(n) ? n : fallback;
}

export function deserialize(data) {
  if (!data || typeof data !== 'object') {
    throw new TypeError('deserialize: datos inválidos');
  }

  const size = toInt(data.size, 19);
  const game = createGame({
    id: typeof data.id === 'string' ? data.id : undefined,
    size: [9, 13, 19].includes(size) ? size : 19,
    komi: toFinite(data.komi, 7.5),
    handicap: Math.min(9, Math.max(0, toInt(data.handicap, 0))),
    blackName: typeof data.meta?.blackName === 'string' ? data.meta.blackName : 'Negras',
    whiteName: typeof data.meta?.whiteName === 'string' ? data.meta.whiteName : 'Blancas',
    createdAt: toFinite(data.meta?.createdAt, Date.now()),
    note: typeof data.meta?.note === 'string' ? data.meta.note : '',
  });

  const moves = Array.isArray(data.moves) ? data.moves : [];
  for (const m of moves) {
    if (m && typeof m === 'object') replayMove(game, m);
  }

  // Las jugadas deshechas se re-aplican y luego se deshacen, para
  // reconstruir la pila de "rehacer" con sus snapshots.
  const undoneCount = Math.max(0, toInt(data.undoneCount, 0));
  for (let i = 0; i < undoneCount && game.history.length > 0; i++) {
    undo(game);
  }

  // El replay reconstruye el tablero, pero la fase, el marcado de muertas y
  // el contador de pases son estado que el usuario puede haber cambiado sin
  // generar movimientos (marcar piedras muertas, "volver a jugar"). Se
  // restauran tal cual para no perderlos al recargar.
  if (Array.isArray(data.dead)) {
    game.dead = data.dead.filter(
      (i) => Number.isInteger(i) && i >= 0 && i < game.board.length
    );
  }
  if (data.phase === 'scoring') {
    game.phase = 'scoring';
  } else if (data.phase === 'finished' && data.result) {
    game.phase = 'finished';
    game.result = {
      winner: data.result.winner === 'B' || data.result.winner === 'W' || data.result.winner === 'D'
        ? data.result.winner
        : 'D',
      margin: toFinite(data.result.margin, null),
      reason: typeof data.result.reason === 'string' ? data.result.reason : 'score',
    };
  } else if (data.phase === 'playing') {
    game.phase = 'playing';
    game.result = null;
  }
  game.consecutivePasses = Math.max(0, toInt(data.consecutivePasses, game.consecutivePasses));

  return game;
}

/** Puntos de handicap estándar para un tamaño y nº de piedras dados. */
export function handicapPoints(size, handicap) {
  const table = HANDICAP[size];
  return table && table[handicap] ? table[handicap].map(([x, y]) => ({ x, y })) : [];
}
