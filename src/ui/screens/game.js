/**
 * Pantalla de partida: tablero, estado, controles, historial y puntuación.
 */

import {
  BLACK, WHITE, EMPTY, idx, toXY, cloneBoard,
} from '../../core/board.js';
import {
  createGame, playMove, pass, resign, undo, redo, canUndo, canRedo,
  markDeadToggle, clearDead, cancelScoring, computeScore, confirmScore,
  serialize, deserialize, handicapPoints,
} from '../../core/game.js';
import { toLabel } from '../../core/coords.js';
import { createBoardView } from '../boardView.js';
import { createHistoryPanel } from '../historyPanel.js';
import { confirmDialog, alertDialog, toast } from '../dialogs.js';
import { store } from '../../storage/store.js';
import { sound } from '../../audio/sound.js';

const $ = (sel, root = document) => root.querySelector(sel);

function safeInt(v, fallback = 0) {
  const n = Number(v);
  return Number.isInteger(n) ? n : fallback;
}

function safeNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function mountGameScreen(root, { onExit, getSettings }) {
  const boardWrap = $('#board-wrap', root);
  const historyRoot = $('.history', root);

  let game = null;
  let view = null;
  let history = null;
  let cursor = -1;          // -1 = posición actual
  let practiceMode = false;
  let practiceColor = BLACK;
  let practiceBoard = null; // Uint8Array en modo práctica
  let autosaveTimer = null;

  const ui = {
    title: $('#game-title', root),
    phase: $('#game-phase', root),
    turnBadge: $('#turn-badge', root),
    turnText: $('#turn-text', root),
    capBlack: $('#cap-black', root),
    capWhite: $('#cap-white', root),
    chipSize: $('#chip-size', root),
    chipKomi: $('#chip-komi', root),
    chipMoves: $('#chip-moves', root),
    hint: $('#game-hint', root),
    scoring: $('#scoring-controls', root),
    undo: $('#btn-undo', root),
    redo: $('#btn-redo', root),
    pass: $('#btn-pass', root),
    resign: $('#btn-resign', root),
  };

  history = createHistoryPanel(historyRoot, {
    onSelect: (target) => {
      if (practiceMode || !game) return;
      const n = game.history.length;
      if (n === 0) return;

      // cursor === -1 significa "posición actual" (tras la última jugada).
      // cursor === i significa "posición tras la jugada i+1".
      if (target === 'first') {
        cursor = 0;
      } else if (target === 'last') {
        cursor = -1;
      } else if (target === 'prev') {
        const cur = cursor < 0 ? n - 1 : cursor;
        cursor = Math.max(0, cur - 1);
      } else if (target === 'next') {
        const cur = cursor < 0 ? n - 1 : cursor;
        cursor = cur >= n - 1 ? -1 : cur + 1;
      } else {
        const i = Number(target);
        cursor = Number.isInteger(i) && i >= 0 && i < n ? i : -1;
      }
      render();
    },
  });

  // ---------- Estado visible ----------
  function boardSnapshot() {
    if (practiceMode) {
      return {
        board: practiceBoard,
        koPoint: null,
        lastMove: null,
        dead: [],
        hover: null,
        hoverColor: null,
      };
    }
    const viewing = cursor >= 0 ? game.history[cursor] : null;
    const snap = viewing ? viewing.after : currentSnapshot();
    return {
      board: snap.board,
      koPoint: viewing ? snap.koPoint : game.koPoint,
      lastMove: viewing
        ? (viewing.move.type === 'play' ? idx(game.size, viewing.move.x, viewing.move.y) : null)
        : lastPlayIndex(),
      dead: viewing ? [] : (game.phase === 'scoring' ? game.dead : []),
      hover,
      hoverColor: hover ? (practiceMode ? practiceColor : game.turn) : null,
    };
  }

  function currentSnapshot() {
    return {
      board: game.board,
      koPoint: game.koPoint,
    };
  }

  function lastPlayIndex() {
    for (let i = game.history.length - 1; i >= 0; i--) {
      const m = game.history[i].move;
      if (m.type === 'play') return idx(game.size, m.x, m.y);
    }
    return null;
  }

  let hover = null;

  // ---------- Render ----------
  function render() {
    if (!view) return;
    view.render(boardSnapshot());

    const practiceRow = document.getElementById('practice-row');
    if (practiceRow) practiceRow.hidden = !practiceMode;

    if (practiceMode) {
      ui.title.textContent = 'Práctica libre';
      ui.phase.textContent = 'Práctica';
      ui.phase.className = 'badge badge--live';
      ui.turnText.textContent = practiceColor === BLACK ? 'Colocando piedras negras' : 'Colocando piedras blancas';
      ui.turnBadge.className = `turn-badge ${practiceColor === BLACK ? 'turn-badge--black' : 'turn-badge--white'}`;
      ui.capBlack.textContent = '—';
      ui.capWhite.textContent = '—';
      ui.chipMoves.textContent = 'Modo estudio';
      ui.scoring.hidden = true;
      ui.undo.disabled = true;
      ui.redo.disabled = true;
      ui.pass.disabled = true;
      ui.resign.disabled = true;
      ui.hint.textContent = 'Toca una intersección para colocar. Usa los controles de color y limpiar.';
      historyRoot.hidden = true;
      return;
    }

    historyRoot.hidden = false;
    const score = game.phase === 'scoring' ? computeScore(game) : null;

    ui.title.textContent = `${game.meta.blackName} vs ${game.meta.whiteName}`;
    ui.phase.textContent =
      game.phase === 'finished' ? 'Finalizada' :
      game.phase === 'scoring' ? 'Puntuación' : 'En curso';
    ui.phase.className = `badge ${game.phase === 'playing' ? 'badge--live' : 'badge--finished'}`;

    const isBlack = game.turn === BLACK;
    ui.turnText.textContent = game.phase === 'playing'
      ? (isBlack ? 'Turno de negras' : 'Turno de blancas')
      : game.phase === 'scoring'
        ? 'Marca las piedras muertas y confirma'
        : 'Partida terminada';
    ui.turnBadge.className = `turn-badge ${isBlack ? 'turn-badge--black' : 'turn-badge--white'}`;

    ui.capBlack.textContent = String(game.captures.black);
    ui.capWhite.textContent = String(game.captures.white);
    ui.chipSize.textContent = `${game.size}×${game.size}`;
    ui.chipKomi.textContent = `Komi ${game.komi}`;
    ui.chipMoves.textContent = `${game.history.length} jugadas`;

    ui.undo.disabled = !canUndo(game) || game.phase !== 'playing' || cursor >= 0;
    ui.redo.disabled = !canRedo(game) || game.phase !== 'playing' || cursor >= 0;
    ui.pass.disabled = game.phase !== 'playing';
    ui.resign.disabled = game.phase === 'finished';
    ui.scoring.hidden = game.phase !== 'scoring';

    if (score) {
      ui.hint.textContent =
        `Área actual — Negras ${score.black.total} · Blancas ${score.white.total} (komi ${score.komi}). ` +
        'Toca las piedras muertas para marcarlas.';
    } else if (game.phase === 'finished' && game.result) {
      ui.hint.textContent = resultText(game);
    } else {
      ui.hint.textContent = '';
    }

    history.render(game, cursor);
  }

  function resultText(g) {
    const r = g.result;
    if (!r) return '';
    if (r.winner === 'D') return 'La partida terminó en empate.';
    const who = r.winner === 'B' ? g.meta.blackName : g.meta.whiteName;
    if (r.reason === 'resign') return `Gana ${who} por abandono.`;
    if (r.reason === 'score') {
      return `Gana ${who} por ${r.margin} punto${r.margin === 1 ? '' : 's'}.`;
    }
    return `Resultado: ${who}.`;
  }

  // ---------- Acciones ----------
  function feedback(captured) {
    const settings = getSettings?.() ?? {};
    if (settings.sound !== false) sound.playStone();
    if (settings.vibrate !== false && typeof navigator.vibrate === 'function') {
      try { navigator.vibrate(captured?.length ? 18 : 10); } catch { /* ignorado */ }
    }
  }

  function scheduleAutosave() {
    if (practiceMode || !game) return;
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(async () => {
      try {
        await store.saveGame(serialize(game));
        await store.setActiveGameId(game.id);
      } catch {
        /* sin almacenamiento: la partida sigue en memoria */
      }
    }, 350);
  }

  function onPointClick(x, y) {
    if (!game && !practiceMode) return;

    if (practiceMode) {
      const i = idx(game ? game.size : practiceSize, x, y);
      if (practiceBoard[i] === practiceColor) practiceBoard[i] = EMPTY;
      else practiceBoard[i] = practiceColor;
      render();
      return;
    }

    if (cursor >= 0) { cursor = -1; }          // al jugar volvemos al presente

    if (game.phase === 'scoring') {
      markDeadToggle(game, idx(game.size, x, y));
      render();
      scheduleAutosave();
      return;
    }
    if (game.phase !== 'playing') return;

    const res = playMove(game, x, y);
    if (!res.ok) {
      const messages = {
        occupied: 'Esa intersección ya está ocupada.',
        suicide: 'Jugada ilegal: no puedes dejarte sin libertades.',
        ko: 'Ko: no puedes recapturar de inmediato.',
        'out-of-bounds': 'Fuera del tablero.',
      };
      ui.hint.textContent = messages[res.reason] ?? 'Jugada no permitida.';
      return;
    }
    feedback(res.captured);
    render();
    scheduleAutosave();
  }

  function onPointHover(x, y) {
    hover = x == null ? null : { x, y };
    if (view && !practiceMode && game?.phase === 'playing') render();
    else if (view && practiceMode) render();
  }

  // ---------- Controles ----------
  root.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;

    if (action === 'back-home') {
      clearTimeout(autosaveTimer);
      if (game && !practiceMode) {
        try { await store.saveGame(serialize(game)); } catch { /* ignorado */ }
      }
      onExit?.();
      return;
    }

    if (practiceMode) {
      if (action === 'practice-black') { practiceColor = BLACK; render(); }
      else if (action === 'practice-white') { practiceColor = WHITE; render(); }
      else if (action === 'practice-clear') {
        practiceBoard = new Uint8Array(practiceBoard.length);
        render();
      } else if (action === 'practice-size') {
        practiceSize = practiceSize === 9 ? 13 : practiceSize === 13 ? 19 : 9;
        practiceBoard = new Uint8Array(practiceSize * practiceSize);
        if (view) view.destroy();
        view = createBoardView(boardWrap, {
          size: practiceSize,
          onPointClick,
          onPointHover,
        });
        render();
      }
      return;
    }

    if (!game) return;

    // Cualquier acción que muta la partida debe salir del modo visor,
    // o el tablero se quedaría mostrando una posición antigua.
    const mutating = ['undo', 'redo', 'pass', 'resign', 'restart',
      'confirm-score', 'cancel-scoring'];
    if (mutating.includes(action) && cursor >= 0) {
      cursor = -1;
    }

    switch (action) {
      case 'undo': {
        if (cursor >= 0) { cursor = -1; render(); break; }
        if (undo(game)) { feedback(); render(); scheduleAutosave(); }
        break;
      }
      case 'redo':
        if (redo(game)) { render(); scheduleAutosave(); }
        break;

      case 'pass': {
        const settings = getSettings?.() ?? {};
        pass(game);
        if (game.phase === 'scoring') {
          toast('Dos pases seguidos: marca las piedras muertas.');
        }
        feedback();
        render();
        scheduleAutosave();
        break;
      }

      case 'resign': {
        const settings = getSettings?.() ?? {};
        if (settings.confirmResign !== false) {
          const ok = await confirmDialog({
            title: '¿Rendirse?',
            body: `Se dará la partida por perdida para ${game.turn === BLACK ? 'negras' : 'blancas'}.`,
            confirmLabel: 'Me rindo',
            danger: true,
          });
          if (!ok) return;
        }
        resign(game, game.turn);
        render();
        scheduleAutosave();
        bumpStats('finish-resign');
        toast(resultText(game));
        break;
      }

      case 'save-game': {
        try {
          await store.saveGame(serialize(game));
          await store.setActiveGameId(game.id);
          toast('Partida guardada.');
        } catch {
          toast('No se pudo guardar (¿almacenamiento lleno?).', 'error');
        }
        break;
      }

      case 'restart': {
        const settings = getSettings?.() ?? {};
        if (settings.confirmRestart !== false) {
          const ok = await confirmDialog({
            title: '¿Nueva partida?',
            body: 'Se perderá el progreso de la partida actual.',
            confirmLabel: 'Empezar de nuevo',
            danger: true,
          });
          if (!ok) return;
        }
        start(lastOptions ?? { size: game.size, komi: game.komi });
        toast('Nueva partida.');
        break;
      }

      case 'export-sgf':
        downloadSGF(game);
        break;

      case 'confirm-score': {
        const score = confirmScore(game);
        if (score) {
          render();
          scheduleAutosave();
          bumpStats('finish-score');
          toast(resultText(game));
        }
        break;
      }

      case 'cancel-scoring':
        cancelScoring(game);
        render();
        scheduleAutosave();
        break;

      default:
        break;
    }
  });

  /**
   * Estadísticas locales. `kind` describe el evento que dispara el recuento:
   * 'start' (una partida nueva), 'finish-score', 'finish-resign'.
   */
  async function bumpStats(kind = 'start') {
    if (!game) return;
    try {
      const s = (await store.getStats()) ?? {};
      s.played = safeInt(s.played, 0);
      s.finished = safeInt(s.finished, 0);
      s.resigned = safeInt(s.resigned, 0);
      s.scored = safeInt(s.scored, 0);
      s.bySize = s.bySize && typeof s.bySize === 'object' ? s.bySize : { 9: 0, 13: 0, 19: 0 };

      if (kind === 'start') {
        s.played += 1;
        s.bySize[game.size] = safeInt(s.bySize[game.size], 0);
      } else {
        s.finished += 1;
        s.bySize[game.size] = safeInt(s.bySize[game.size], 0) + 1;
        if (kind === 'finish-resign') s.resigned += 1;
        if (kind === 'finish-score') s.scored += 1;
      }
      await store.saveStats(s);
    } catch { /* ignorado */ }
  }

  // ---------- SGF ----------
  /** Escapa caracteres reservados por el formato SGF. */
  function sgfEscape(value) {
    return String(value ?? '').replace(/[\\\]]/g, (m) => `\\${m}`).replace(/\r?\n/g, ' ');
  }

  function downloadSGF(g) {
    const letters = 'abcdefghijklmnopqrs';
    const toSGF = (x, y) => letters[x] + letters[y];
    const moves = g.history
      .filter((h) => h.move.type === 'play' || h.move.type === 'pass')
      .map((h) => {
        const col = h.move.color === BLACK ? 'B' : 'W';
        return h.move.type === 'pass'
          ? `;${col}[]`
          : `;${col}[${toSGF(h.move.x, h.move.y)}]`;
      })
      .join('');

    const created = Number(g.meta?.createdAt);
    const date = Number.isFinite(created)
      ? new Date(created).toISOString().slice(0, 10)
      : 'sin-fecha';

    let result = '?';
    if (g.result) {
      if (g.result.winner === 'D') result = '0';
      else {
        const side = g.result.winner === 'B' ? 'B+' : 'W+';
        result = side + (g.result.margin != null ? g.result.margin : 'R');
      }
    }

    const handicap = Number(g.handicap) || 0;
    const hp = handicap > 0 ? handicapPoints(g.size, handicap) : [];
    const handicapProps = hp.length
      ? `HA[${hp.length}]AB${hp.map((p) => `[${toSGF(p.x, p.y)}]`).join('')}`
      : '';

    const sgf =
      `(;GM[1]FF[4]CA[UTF-8]AP[GoOffline]SZ[${safeInt(g.size, 19)}]` +
      `KM[${safeNum(g.komi, 7.5)}]${handicapProps}` +
      `PB[${sgfEscape(g.meta.blackName)}]PW[${sgfEscape(g.meta.whiteName)}]` +
      `DT[${date}]RE[${sgfEscape(result)}]` +
      moves + ')';

    const blob = new Blob([sgf], { type: 'application/x-go-sgf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `go-offline-${date}.sgf`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('SGF exportado.');
  }

  // ---------- API pública ----------
  let practiceSize = 19;
  let lastOptions = null;

  function mountBoard(size) {
    if (view) view.destroy();
    const coords = getSettings?.()?.coordinates !== false;
    view = createBoardView(boardWrap, {
      size,
      showCoordinates: coords,
      onPointClick,
      onPointHover,
    });
  }

  /** Crea una partida nueva. Se expone abajo en el objeto devuelto. */
  function start(options) {
    practiceMode = false;
    cursor = -1;
    lastOptions = { ...options };
    game = createGame(options);
    mountBoard(game.size);
    render();
    scheduleAutosave();
    bumpStats('start');
  }

  return {
    /** Arranca una partida nueva. */
    start,

    /** Reanuda una partida existente (objeto serializado). */
    resume(serialized) {
      practiceMode = false;
      cursor = -1;
      game = deserialize(serialized);
      mountBoard(game.size);
      render();
    },

    /** Modo práctica libre. */
    practice(size = 19) {
      practiceMode = true;
      practiceSize = size;
      practiceColor = BLACK;
      practiceBoard = new Uint8Array(size * size);
      game = null;
      cursor = -1;
      mountBoard(size);
      render();
    },

    /** Reaplica las preferencias visuales (p. ej. coordenadas). */
    refreshPreferences() {
      if (view) {
        const coords = getSettings?.()?.coordinates !== false;
        view.setShowCoordinates(coords);
      }
      render();
    },

    /** Diálogo de reinicio. Devuelve true si se puede reiniciar. */
    async restart() {
      const settings = getSettings?.() ?? {};
      if (settings.confirmRestart !== false) {
        const ok = await confirmDialog({
          title: '¿Nueva partida?',
          body: 'Se perderá el progreso de la partida actual.',
          confirmLabel: 'Empezar de nuevo',
          danger: true,
        });
        if (!ok) return false;
      }
      return true;
    },

    hasGame: () => !!game,
    render,
  };
}
