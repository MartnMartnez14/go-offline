/**
 * Go Offline — arranque, enrutado y cableado general.
 * Todo local: sin servidores, sin telemetría, sin dependencias.
 */

import { BLACK, WHITE } from './core/board.js';
import { serialize, deserialize } from './core/game.js';
import { store, StorageError } from './storage/store.js';
import { sound } from './audio/sound.js';
import { confirmDialog, alertDialog, toast } from './ui/dialogs.js';
import { mountGameScreen } from './ui/screens/game.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Normaliza un entero procedente de almacenamiento. */
function safeInt(v, fallback = 0) {
  const n = Number(v);
  return Number.isInteger(n) ? n : fallback;
}

/** Normaliza un número procedente de almacenamiento. */
function safeNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

const screens = {
  home: $('#screen-home'),
  new: $('#screen-new'),
  game: $('#screen-game'),
  games: $('#screen-games'),
  learn: $('#screen-learn'),
  settings: $('#screen-settings'),
};

let settings = null;
let gameScreen = null;
let currentScreen = 'home';
let pendingNewGame = { size: 19, komi: 7.5, handicap: 0, blackName: 'Negras', whiteName: 'Blancas' };

// ---------------------------------------------------------------------
// Enrutado
// ---------------------------------------------------------------------
function show(name) {
  for (const [key, el] of Object.entries(screens)) {
    el.classList.toggle('is-active', key === name);
  }
  currentScreen = name;
  window.scrollTo(0, 0);
  if (name === 'games') renderGamesList();
  if (name === 'settings') renderSettings();
  if (name === 'new') syncNewGameForm();
}

// ---------------------------------------------------------------------
// Preferencias
// ---------------------------------------------------------------------
function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

async function loadSettings() {
  try {
    settings = await store.getSettings();
  } catch (err) {
    settings = defaultSettings();
    if (err instanceof StorageError && err.code === 'unavailable') {
      setTimeout(() => toast('Almacenamiento no disponible: los cambios no se guardarán.', 'error'), 600);
    }
  }
  applyTheme(settings.theme === 'auto' ? 'auto' : settings.theme);
  sound.enabled = settings.sound !== false;
  return settings;
}

function defaultSettings() {
  return {
    theme: 'dark', defaultSize: 19, komi: 7.5, handicap: 0,
    sound: true, vibrate: true, coordinates: true,
    confirmResign: true, confirmRestart: true,
  };
}

async function persistSettings() {
  try {
    await store.saveSettings(settings);
  } catch {
    toast('No se pudo guardar la configuración.', 'error');
  }
}

// ---------------------------------------------------------------------
// Nueva partida
// ---------------------------------------------------------------------
function syncNewGameForm() {
  $$('#new-game-form .segmented__btn').forEach((b) => {
    b.classList.toggle('is-active', Number(b.dataset.size) === pendingNewGame.size);
  });
  $('#f-komi').value = String(pendingNewGame.komi);
  $('#f-handicap').value = String(pendingNewGame.handicap);
  $('#f-black').value = pendingNewGame.blackName;
  $('#f-white').value = pendingNewGame.whiteName;
}

function readNewGameForm() {
  pendingNewGame = {
    size: Number($('#new-game-form .segmented__btn.is-active')?.dataset.size ?? 19),
    komi: Number($('#f-komi').value),
    handicap: Number($('#f-handicap').value),
    blackName: $('#f-black').value.trim() || 'Negras',
    whiteName: $('#f-white').value.trim() || 'Blancas',
  };
  return pendingNewGame;
}

// ---------------------------------------------------------------------
// Mis partidas
// ---------------------------------------------------------------------
async function renderGamesList() {
  const root = $('#games-list');
  root.textContent = '';

  let games = [];
  try {
    games = await store.listGames();
  } catch {
    root.append(emptyState('No se pudo leer el almacenamiento local.'));
    return;
  }

  if (!games.length) {
    root.append(emptyState('Todavía no hay partidas guardadas.'));
    return;
  }

  for (const g of games) {
    const card = document.createElement('article');
    card.className = 'game-card';

    const title = document.createElement('h3');
    title.className = 'form-label';
    title.textContent = `${g.blackName ?? 'Negras'} vs ${g.whiteName ?? 'Blancas'}`;

    const meta = document.createElement('div');
    meta.className = 'game-card__meta';
    // Datos de localStorage: siempre textContent, nunca innerHTML.
    const chips = [
      [`${safeInt(g.size, 19)}×${safeInt(g.size, 19)}`, 'chip'],
      [`Komi ${safeNum(g.komi, 7.5)}`, 'chip'],
      [`${safeInt(g.moves, 0)} jugadas`, 'chip'],
      [g.phase === 'finished' ? 'Finalizada' : 'En curso',
        `badge ${g.phase === 'finished' ? 'badge--finished' : 'badge--live'}`],
    ];
    for (const [text, cls] of chips) {
      const span = document.createElement('span');
      span.className = cls;
      span.textContent = text;
      meta.append(span);
    }

    const when = document.createElement('div');
    when.className = 'game-card__meta';
    when.textContent = new Date(g.updatedAt ?? g.createdAt).toLocaleString();

    const actions = document.createElement('div');
    actions.className = 'game-card__actions';

    const open = document.createElement('button');
    open.className = 'btn btn--primary';
    open.textContent = 'Continuar';
    open.addEventListener('click', () => openGame(g.id));

    const dup = document.createElement('button');
    dup.className = 'btn';
    dup.textContent = 'Duplicar';
    dup.addEventListener('click', async () => {
      await store.duplicateGame(g.id);
      renderGamesList();
      toast('Partida duplicada.');
    });

    const del = document.createElement('button');
    del.className = 'btn btn--danger';
    del.textContent = 'Eliminar';
    del.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: '¿Eliminar partida?',
        body: 'Esta acción no se puede deshacer.',
        confirmLabel: 'Eliminar',
        danger: true,
      });
      if (!ok) return;
      await store.deleteGame(g.id);
      renderGamesList();
    });

    actions.append(open, dup, del);
    card.append(title, meta, when, actions);
    root.append(card);
  }
}

function emptyState(msg) {
  const p = document.createElement('p');
  p.className = 'empty-state';
  p.textContent = msg;
  return p;
}

async function openGame(id) {
  try {
    const data = await store.getGame(id);
    if (!data) {
      toast('No se encontró la partida.', 'error');
      return;
    }
    gameScreen.resume(data);
    await store.setActiveGameId(id);
    show('game');
  } catch {
    toast('No se pudo abrir la partida.', 'error');
  }
}

// ---------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------
function renderSettings() {
  const s = settings ?? defaultSettings();
  $$('#screen-settings .segmented__btn').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.themeOpt === (s.theme ?? 'dark'));
  });
  $('#s-coords').checked = s.coordinates !== false;
  $('#s-size').value = String(s.defaultSize ?? 19);
  $('#s-komi').value = String(s.komi ?? 7.5);
  $('#s-sound').checked = s.sound !== false;
  $('#s-vibrate').checked = s.vibrate !== false;
  $('#s-confirm-resign').checked = s.confirmResign !== false;
  $('#s-confirm-restart').checked = s.confirmRestart !== false;

  store.getStats().then((st) => {
    $('#st-played').textContent = String(st?.played ?? 0);
    $('#st-finished').textContent = String(st?.finished ?? 0);
    $('#st-9').textContent = String(st?.bySize?.[9] ?? 0);
    $('#st-13').textContent = String(st?.bySize?.[13] ?? 0);
    $('#st-19').textContent = String(st?.bySize?.[19] ?? 0);
  }).catch(() => {});
}

// ---------------------------------------------------------------------
// Cableado de eventos globales
// ---------------------------------------------------------------------
function bindGlobal() {
  document.addEventListener('click', async (ev) => {
    const el = ev.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;

    switch (action) {
      case 'back-home':
        show('home');
        break;

      case 'new-game':
        pendingNewGame = {
          size: settings?.defaultSize ?? 19,
          komi: settings?.komi ?? 7.5,
          handicap: 0,
          blackName: 'Negras',
          whiteName: 'Blancas',
        };
        show('new');
        break;

      case 'start-game': {
        const opts = readNewGameForm();
        gameScreen.start(opts);
        show('game');
        break;
      }

      case 'continue': {
        let id = null;
        try { id = await store.getActiveGameId(); } catch { /* ignorado */ }
        if (id) {
          openGame(id);
        } else {
          toast('No hay ninguna partida en curso.');
          show('new');
        }
        break;
      }

      case 'my-games':
        show('games');
        break;

      case 'practice':
        gameScreen.practice(settings?.defaultSize ?? 19);
        show('game');
        break;

      case 'learn':
        show('learn');
        break;

      case 'settings':
        show('settings');
        break;

      case 'privacy':
        await alertDialog({
          title: 'Privacidad',
          body: 'Go Offline procesa y almacena toda la información localmente en tu dispositivo. ' +
                'No se transmiten partidas ni estadísticas a servidores externos.',
        });
        break;

      case 'wipe-data': {
        const ok = await confirmDialog({
          title: '¿Borrar todos los datos?',
          body: 'Se eliminarán las partidas guardadas, las preferencias y las estadísticas de este dispositivo.',
          confirmLabel: 'Borrar todo',
          danger: true,
        });
        if (!ok) return;
        try {
          const keys = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('gooff:')) keys.push(k);
          }
          keys.forEach((k) => localStorage.removeItem(k));
          settings = defaultSettings();
          applyTheme(settings.theme);
          renderSettings();
          toast('Datos locales borrados.');
        } catch {
          toast('No se pudieron borrar los datos.', 'error');
        }
        break;
      }

      default:
        break;
    }
  });

  // Formulario de nueva partida
  $('#new-game-form')?.addEventListener('click', (ev) => {
    const b = ev.target.closest('.segmented__btn[data-size]');
    if (!b) return;
    $$('#new-game-form .segmented__btn').forEach((x) => x.classList.remove('is-active'));
    b.classList.add('is-active');
    pendingNewGame.size = Number(b.dataset.size);
  });

  // Configuración: tema
  $('#screen-settings')?.addEventListener('click', async (ev) => {
    const b = ev.target.closest('.segmented__btn[data-theme-opt]');
    if (b) {
      settings = settings ?? defaultSettings();
      settings.theme = b.dataset.themeOpt;
      applyTheme(settings.theme);
      renderSettings();
      await persistSettings();
      return;
    }
    const act = ev.target.closest('[data-action]');
    if (act?.dataset.action === 'practice-black' || act?.dataset.action === 'practice-white') {
      // gestionado por la pantalla de partida
    }
  });

  // Configuración: switches y selects
  const bindSetting = (id, key, transform = (v) => v) => {
    const node = $(id);
    if (!node) return;
    node.addEventListener('change', async () => {
      settings = settings ?? defaultSettings();
      settings[key] = transform(node.type === 'checkbox' ? node.checked : node.value);
      if (key === 'sound') sound.enabled = settings.sound !== false;
      if (key === 'coordinates') gameScreen?.refreshPreferences?.();
      await persistSettings();
    });
  };
  bindSetting('#s-coords', 'coordinates');
  bindSetting('#s-size', 'defaultSize', Number);
  bindSetting('#s-komi', 'komi', Number);
  bindSetting('#s-sound', 'sound');
  bindSetting('#s-vibrate', 'vibrate');
  bindSetting('#s-confirm-resign', 'confirmResign');
  bindSetting('#s-confirm-restart', 'confirmRestart');

  // Controles de modo práctica (viven dentro de la pantalla de partida)
  // Se añaden dinámicamente al entrar en práctica.
}

/** Inyecta los controles de práctica en el panel de controles. */
function injectPracticeControls() {
  const holder = $('.panel--controls .controls');
  if (!holder || $('#practice-row')) return;

  const row = document.createElement('div');
  row.className = 'controls__row';
  row.id = 'practice-row';

  for (const [action, label, cls] of [
    ['practice-black', 'Negras', ''],
    ['practice-white', 'Blancas', ''],
    ['practice-size', 'Tamaño', ''],
    ['practice-clear', 'Limpiar', 'btn--danger'],
  ]) {
    const b = document.createElement('button');
    b.className = `btn ${cls}`.trim();
    b.dataset.action = action;
    b.textContent = label;
    row.append(b);
  }
  holder.append(row);
}

// ---------------------------------------------------------------------
// Service Worker y audio
// ---------------------------------------------------------------------
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* sin SW la app sigue funcionando online */
    });
  });
}

function primeAudio() {
  const boot = () => {
    sound.init();
    window.removeEventListener('pointerdown', boot);
    window.removeEventListener('keydown', boot);
  };
  window.addEventListener('pointerdown', boot, { once: true });
  window.addEventListener('keydown', boot, { once: true });
}

// ---------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------
async function main() {
  await loadSettings();

  gameScreen = mountGameScreen(screens.game, {
    onExit: () => show('home'),
    getSettings: () => settings,
  });

  bindGlobal();
  injectPracticeControls();
  registerSW();
  primeAudio();

  // Arranque: si hay partida activa, ofrecer continuar
  show('home');
  try {
    const active = await store.getActiveGameId();
    if (active) {
      const hint = $('.home-tagline');
      if (hint) hint.textContent = 'Tienes una partida en curso. Pulsa «Continuar» para retomarla.';
    }
  } catch { /* ignorado */ }
}

main().catch((err) => {
  console.error('No se pudo iniciar Go Offline:', err);
});
