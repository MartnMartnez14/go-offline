/**
 * Panel de historial de jugadas y navegación (visor de partida).
 */

import { BLACK } from '../core/board.js';
import { toLabel } from '../core/coords.js';

/**
 * @param {HTMLElement} root contenedor `.history`
 * @param {{ onSelect: (index: number) => void }} opts
 */
export function createHistoryPanel(root, opts) {
  const list = root.querySelector('.history__list');
  const empty = root.querySelector('.history-empty');
  const nav = root.querySelector('.history-nav');

  list.addEventListener('click', (ev) => {
    const item = ev.target.closest('.history__item');
    if (!item) return;
    opts.onSelect(Number(item.dataset.index));
  });

  nav.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-nav]');
    if (!btn) return;
    opts.onSelect(btn.dataset.nav);
  });
  /**
   * @param {Object} game
   * @param {number} currentIndex posición visible (-1 = antes de la primera)
   */
  function render(game, currentIndex) {
    const moves = game.history.filter((h) => h.move.type === 'play');
    list.textContent = '';

    if (moves.length === 0) {
      empty.hidden = false;
      nav.hidden = true;
      return;
    }
    empty.hidden = true;
    nav.hidden = false;

    const frag = document.createDocumentFragment();
    game.history.forEach((entry, i) => {
      const m = entry.move;
      const li = document.createElement('li');
      li.className = 'history__item' + (i === currentIndex ? ' is-current' : '');
      li.dataset.index = String(i);

      const no = document.createElement('span');
      no.className = 'move-no';
      no.textContent = String(i + 1);

      const coord = document.createElement('span');
      coord.className = 'move-coord';
      if (m.type === 'play') {
        coord.textContent = `${m.color === BLACK ? 'B' : 'W'}·${toLabel(game.size, m.x, m.y)}`;
      } else if (m.type === 'pass') {
        coord.textContent = `${m.color === BLACK ? 'B' : 'W'}·Paso`;
      } else {
        coord.textContent = `${m.color === BLACK ? 'B' : 'W'}·Rinde`;
      }

      const badge = document.createElement('span');
      badge.className = 'chip';
      badge.textContent = m.captured?.length
        ? `+${m.captured.length}`
        : '';

      li.append(no, coord, badge);
      frag.append(li);
    });
    list.append(frag);

    const current = list.querySelector('.is-current');
    current?.scrollIntoView({ block: 'nearest' });
  }

  return { render };
}
