/**
 * Fachada de persistencia sobre localStorage.
 * API async para poder migrar a IndexedDB sin tocar el resto de la app.
 */

const KEY_SETTINGS = 'gooff:settings';
const KEY_GAMES = 'gooff:games';
const KEY_GAME = 'gooff:game:';
const KEY_ACTIVE = 'gooff:active';
const KEY_STATS = 'gooff:stats';

const DEFAULT_SETTINGS = {
  theme: 'dark',
  defaultSize: 19,
  komi: 7.5,
  handicap: 0,
  sound: true,
  vibrate: true,
  coordinates: true,
  confirmResign: true,
  confirmRestart: true,
};

const DEFAULT_STATS = {
  played: 0,
  finished: 0,
  bySize: { 9: 0, 13: 0, 19: 0 },
  resigned: 0,
  scored: 0,
};

export class StorageError extends Error {
  /**
   * @param {string} message
   * @param {'quota'|'unavailable'} code
   */
  constructor(message, code) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
  }
}

let lsCache = null;

function ls() {
  if (lsCache) return lsCache;
  try {
    const storage = globalThis.localStorage;
    if (!storage) throw new Error('sin localStorage');
    const probe = 'gooff:probe';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    lsCache = storage;
    return storage;
  } catch {
    throw new StorageError('Almacenamiento no disponible (¿modo privado?)', 'unavailable');
  }
}

function wrap(err) {
  if (err instanceof StorageError) return err;
  const quota =
    err &&
    (err.name === 'QuotaExceededError' ||
      err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      err.code === 22 ||
      err.code === 1014);
  return quota
    ? new StorageError('Sin espacio de almacenamiento', 'quota')
    : new StorageError('Error de almacenamiento', 'unavailable');
}

function readJSON(key, fallback) {
  try {
    const raw = ls().getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    if (err instanceof StorageError) throw err;
    // Dato corrupto: se ignora y se usa el valor por defecto.
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    ls().setItem(key, JSON.stringify(value));
  } catch (err) {
    throw wrap(err);
  }
}

function remove(key) {
  try {
    ls().removeItem(key);
  } catch (err) {
    throw wrap(err);
  }
}

function newId() {
  return `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Índice ligero de una partida serializada. */
function indexEntry(serialized) {
  const meta = serialized.meta ?? {};
  const now = Date.now();
  return {
    id: serialized.id,
    size: serialized.size,
    komi: serialized.komi,
    moves: Array.isArray(serialized.moves) ? serialized.moves.length : (serialized.moves ?? 0),
    result: serialized.result ?? null,
    phase: serialized.phase,
    createdAt: meta.createdAt ?? serialized.createdAt ?? now,
    updatedAt: meta.updatedAt ?? serialized.updatedAt ?? now,
    blackName: meta.blackName ?? serialized.blackName ?? 'Negras',
    whiteName: meta.whiteName ?? serialized.whiteName ?? 'Blancas',
  };
}

function readIndex() {
  const index = readJSON(KEY_GAMES, []);
  return Array.isArray(index) ? index : [];
}

function writeIndex(index) {
  writeJSON(KEY_GAMES, index);
}

export const store = {
  // Preferencias -----------------------------------------------------------

  async getSettings() {
    const saved = readJSON(KEY_SETTINGS, {});
    return { ...DEFAULT_SETTINGS, ...(saved && typeof saved === 'object' ? saved : {}) };
  },

  async saveSettings(settings) {
    const merged = { ...DEFAULT_SETTINGS, ...(settings ?? {}) };
    writeJSON(KEY_SETTINGS, merged);
    return merged;
  },

  // Partidas ---------------------------------------------------------------

  async listGames() {
    return readIndex().slice().sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  },

  async getGame(id) {
    if (!id) return null;
    return readJSON(KEY_GAME + id, null);
  },

  async saveGame(serialized) {
    if (!serialized || typeof serialized !== 'object') {
      throw new TypeError('Partida serializada inválida');
    }
    const entry = indexEntry(serialized);
    if (!entry.id) {
      entry.id = newId();
      serialized = { ...serialized, id: entry.id };
    }
    writeJSON(KEY_GAME + entry.id, serialized);
    const index = readIndex().filter((g) => g.id !== entry.id);
    index.push(entry);
    writeIndex(index);
    return entry.id;
  },

  async deleteGame(id) {
    remove(KEY_GAME + id);
    writeIndex(readIndex().filter((g) => g.id !== id));
    if ((await store.getActiveGameId()) === id) await store.clearActiveGameId();
  },

  async duplicateGame(id) {
    const game = await store.getGame(id);
    if (!game) throw new Error(`Partida no encontrada: ${id}`);
    const now = Date.now();
    const copy = {
      ...game,
      id: newId(),
      meta: { ...(game.meta ?? {}), createdAt: now, updatedAt: now },
      createdAt: now,
      updatedAt: now,
    };
    await store.saveGame(copy);
    return copy.id;
  },

  async getActiveGameId() {
    const value = readJSON(KEY_ACTIVE, null);
    return typeof value === 'string' ? value : null;
  },

  async setActiveGameId(id) {
    if (!id) throw new TypeError('id inválido');
    writeJSON(KEY_ACTIVE, id);
    return id;
  },

  async clearActiveGameId() {
    remove(KEY_ACTIVE);
  },

  // Estadísticas -----------------------------------------------------------

  async getStats() {
    const saved = readJSON(KEY_STATS, {});
    const s = saved && typeof saved === 'object' ? saved : {};
    return {
      ...DEFAULT_STATS,
      ...s,
      bySize: { ...DEFAULT_STATS.bySize, ...(s.bySize ?? {}) },
    };
  },

  async saveStats(stats) {
    const current = await store.getStats();
    const merged = {
      ...current,
      ...(stats ?? {}),
      bySize: { ...current.bySize, ...((stats && stats.bySize) ?? {}) },
    };
    writeJSON(KEY_STATS, merged);
    return merged;
  },
};
