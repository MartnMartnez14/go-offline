/**
 * Sonido de colocación de piedra. Audio perezoso y degradable:
 * si algo falla, la app sigue en silencio sin errores.
 */

const STONE_URL = new URL('../../assets/sounds/stone.wav', import.meta.url).href;

export const sound = {
  /** Sincronizar con settings.sound. */
  enabled: true,

  /**
   * Prepara el AudioContext y carga el buffer. Llamar desde un gesto
   * del usuario para no disparar bloqueos de autoplay.
   */
  init() {
    if (ctx) return;
    try {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      loadBuffer(ctx);
    } catch {
      ctx = null;
    }
  },

  /** Reproduce el golpe de piedra (no-op si está desactivado o sin buffer). */
  playStone() {
    if (!this.enabled || !ctx || !buffer) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = 0.6;
      src.connect(gain).connect(ctx.destination);
      src.start();
    } catch {
      // Silencio: sin audio no se rompe el juego.
    }
  },
};

let ctx = null;
let buffer = null;

async function loadBuffer(audioCtx) {
  try {
    const response = await fetch(STONE_URL);
    if (!response.ok) return;
    const data = await response.arrayBuffer();
    buffer = await decodeAudioData(audioCtx, data);
  } catch {
    // Silencio: sin sonido la app sigue funcionando.
  }
}

function decodeAudioData(audioCtx, data) {
  return new Promise((resolve, reject) => {
    const p = audioCtx.decodeAudioData(data, resolve, reject);
    if (p && typeof p.then === 'function') p.then(resolve, reject);
  });
}
