# AGENTS.md — Guía para agentes de IA

Este documento describe cómo trabajar en **Go Offline** sin romper el proyecto.
Léelo antes de tocar nada.

---

## 1. Qué es este proyecto

Una PWA de Go / Baduk **offline, local y sin dependencias**. Dos jugadores
comparten un dispositivo. No hay backend, no hay cuentas, no hay telemetría.

Filosofía rectora:

> KISS. YAGNI. Primero un excelente tablero de Go offline; después ya veremos.

Si una propuesta añade complejidad que hoy no se necesita, no la implementes.
Escríbela en la sección de roadmap del README si es valiosa a futuro.

---

## 2. Reglas duras

1. **Cero dependencias de runtime.** Nada de npm, nada de CDNs, nada de
   `package.json` con dependencias. Si crees que necesitas una librería,
   detente y consulta primero.
2. **Sin paso de compilación.** ES modules nativos. El repositorio **es** el
   artefacto desplegable. No añadas Vite, Webpack, Babel ni TypeScript.
3. **Rutas siempre relativas** (`./algo`). La app se publica bajo
   `usuario.github.io/repo/`. Una ruta absoluta (`/algo`) la rompe.
4. **No copiar código de Online-Go.com.** Es AGPL-3.0. Copiarlo contaminaría
   todo el proyecto. Inspiración visual o conceptual: sí. Código: no.
5. **`src/core/` es puro.** Sin `window`, sin `document`, sin `localStorage`,
   sin APIs de navegador. Solo lógica y tipado por JSDoc si hace falta.
6. **No rompas el contrato de `src/core/`.** La UI depende de él tal cual.
7. **No rompas `sw.js`.** El `APP_SHELL` debe listar solo archivos que existen.
8. **Sin `eval`, `new Function`, `document.write`, ni `innerHTML` con datos de
   usuario.** Usa `textContent` / `createElement`. Ver §6.
9. **No añadas permisos** de cámara, micrófono, ubicación, contactos ni
   notificaciones.
10. **Nada de `console.log`** en código de producción.

---

## 3. Arquitectura

```
index.html              Shell estático con la estructura de las pantallas
manifest.webmanifest    PWA
sw.js                   Service worker (app shell en caché)
src/
  main.js               Arranque, enrutado, preferencias, cableado global
  core/                 Motor de Go — puro, sin navegador
    board.js            Uint8Array, índices, vecinos
    groups.js           Flood-fill BFS: grupos y libertades
    rules.js            tryMove: capturas, suicidio, ko simple
    game.js             Estado de partida, undo/redo, handicap, serialize
    scoring.js          Chinese Area Scoring
    coords.js           Etiquetas A–T (sin I), filas desde abajo
  ui/
    boardView.js        Render SVG del tablero
    historyPanel.js     Lista de jugadas y visor
    dialogs.js          Diálogos modales y toasts
    screens/game.js     Pantalla de partida (la única con lógica de juego)
  storage/store.js      Fachada async sobre localStorage
  audio/sound.js        Golpe de piedra con Web Audio
  styles/
    tokens.css          Variables de diseño y temas
    main.css            Layout, botones, paneles, diálogos
    board.css           Tablero SVG, piedras, gradientes
assets/icons/           SVG + PNG
assets/sounds/          stone.wav
tests/                  node --test
```

**Separación de responsabilidades:** el motor no sabe que existe la interfaz; la
interfaz no reimplementa reglas; el almacenamiento no conoce el Go.

---

## 4. Contratos que no debes romper

### Motor (`src/core/game.js`)

```js
createGame({ size, komi, handicap, blackName, whiteName, id })
playMove(game, x, y)   -> { ok: true, captured: number[] } | { ok: false, reason }
pass(game)             -> { ok: true }
resign(game, color)    -> { ok: true }
undo(game) / redo(game)-> boolean
canUndo(game) / canRedo(game) -> boolean
markDeadToggle(game, i)-> boolean
clearDead(game) / cancelScoring(game)
computeScore(game) / confirmScore(game)
serialize(game) / deserialize(data)
BLACK = 1, WHITE = 2, EMPTY = 0
```

`reason` puede ser `out-of-bounds`, `occupied`, `suicide`, `ko`, `not-playing`,
`already-finished`.

El estado de partida lleva: `id, size, komi, handicap, rules, board (Uint8Array),
turn, captures: {black, white}, koPoint, phase: 'playing'|'scoring'|'finished',
consecutivePasses, dead: number[], history, future, result, meta`.

### Coordenadas (`src/core/coords.js`)

- `y = 0` es la fila **superior** (estilo pantalla).
- Índice plano: `i = y * size + x`.
- Etiquetas: columnas `ABCDEFGHJKLMNOPQRST` (**sin I**), filas numeradas
  **desde abajo**. `toLabel(19, 0, 0) === 'A19'`.
- `toLabel` / `parseLabel` deben seguir siendo inversas.

### Almacenamiento (`src/storage/store.js`)

Todas las funciones devuelven `Promise`. Claves con prefijo `gooff:`. Índice
ligero en `gooff:games` (donde `moves` es un **número**, no un array) y objeto
completo en `gooff:game:<id>`. Los errores son `StorageError` con
`code: 'quota' | 'unavailable'`.

### Geometría del tablero SVG (`src/ui/boardView.js`)

- `viewBox = "0 0 size size"` (margen de 0.5 por lado).
- Intersección `(x, y)` → punto SVG `(x + 0.5, y + 0.5)`.
- Radio de piedra `0.46`. Hit rect `(x, y, 1, 1)`.
- Los colores de los gradientes se fijan en `board.css` mediante clases de
  `stop`. **No uses `var()` en atributos de presentación SVG**: no resuelven de
  forma fiable.

---

## 5. Convenciones

- **Español** en textos de interfaz, comentarios y commits. Identificadores de
  código en inglés.
- **Sin comentarios decorativos.** Solo cuando el "por qué" no sea obvio.
- **Funciones pequeñas y puras** en `src/core/`. Sin efectos secundarios.
- **La UI reacciona al estado, no lo modela.** Si una regla cambia, cambia en
  `src/core/`, no en la pantalla.
- **Variables CSS en `tokens.css`.** Nada de colores hardcodeados repetidos en
  `main.css` o `board.css`.
- **Accesibilidad**: `:focus-visible` visible, `aria-label` en controles
  iconográficos, `.sr-only` para texto solo para lectores de pantalla,
  `prefers-reduced-motion` respetado.

---

## 6. Seguridad

La app es 100 % cliente, así que la superficie es el propio DOM y el
almacenamiento local.

- **Nunca vuelques datos de `localStorage` con `innerHTML`.** Con `textContent`
  o `createElement`. Si necesitas estructura, construye nodos.
- **Valida lo que leas de `localStorage`**: `Number.isInteger` para enteros,
  `Number.isFinite` para números, enums para estados. `localStorage` es un canal
  de datos no confiable (otro script same-origin, una extensión, DevTools).
- **Escapa en SGF** los caracteres `]` y `\` en cualquier propiedad de texto.
- **El origen puede estar compartido** en `usuario.github.io`. Por eso
  `activate` del service worker solo borra cachés con prefijo `go-offline-`.
- **CSP** declarado en `index.html`. Si lo cambias, no permitas `unsafe-inline`
  en `script-src`. `style-src` también es `'self'`: nada de estilos inline.

---

## 7. Cómo probar

```bash
# Node está en ~/.local/opt/node/bin/node
export PATH="$HOME/.local/opt/node/bin:$PATH"

# Lógica del motor (obligatorio tras tocar src/core/)
node --test "tests/*.test.js"

# Sintaxis de todos los módulos
for f in src/main.js src/core/*.js src/ui/*.js src/ui/screens/*.js \
         src/storage/*.js src/audio/*.js sw.js; do node --check "$f"; done

# Servidor de desarrollo
python3 -m http.server 8765
```

**Prueba de interacción headless** (recomendada tras tocar la UI): se puede
usar Chrome con DevTools Protocol. Hay un patrón funcional en `/tmp/opencode/cdp-smoke.mjs`
durante el desarrollo; si no existe, reproducelo: `google-chrome --headless`
+ `Runtime.evaluate` para simular clics y verificar el DOM resultante.

**Antes de dar un cambio por bueno:**
1. `node --test "tests/*.test.js"` en verde.
2. `node --check` sin errores.
3. Probar el flujo principal en navegador: nueva partida → colocar → capturar →
   pasar dos veces → marcar muertas → confirmar → ver en Mis partidas.
4. Si tocaste `sw.js`, comprobar que `APP_SHELL` solo contiene archivos que
   existen.

---

## 8. Cómo implementar una feature

1. **¿Afecta al motor?** Empieza por `src/core/` con tests primero. Si no puedes
   escribir el test, no tienes clara la regla.
2. **¿Es solo UI?** Añade el marcado en `index.html`, los estilos en el CSS
   correspondiente y el cableado en `main.js` o `screens/game.js`.
3. **¿Necesita persistencia?** Extiende `src/storage/store.js` sin cambiar la
   firma de lo existente. Todo por la fachada: nunca `localStorage` directo
   desde la UI.
4. **¿Cambia algo offline?** Revisa `sw.js` y el `APP_SHELL`.

---

## 9. Qué NO hacer

- No reconstruir Online-Go.com. Ni su infraestructura, ni su complejidad.
- No añadir multijugador, WebSockets, usuarios, chat, rankings ni torneos.
- No añadir una IA pesada sin evaluar antes RAM, CPU, tamaño y compatibilidad
  móvil.
- No migrar a React, Vue ni Svelte "por si acaso".
- No introducir un paso de compilación.
- No romper el funcionamiento bajo subcarpeta de GitHub Pages.
- No tocar `LICENSE` sin consultarlo.

---

## 10. Roadmap (no implementar todavía)

- Importación de SGF y visor con reproducción (`|<` `<` `>` `>|`).
- Tutorial interactivo y problemas de Go.
- Superko posicional y situacional (el hash Zobrist ya deja la puerta abierta).
- Reglas japonesas de puntuación junto a las chinas.
- CPU sencilla por niveles (aleatoria → capturas/atari → heurísticas).
- Evaluación de motores offline en WebAssembly.

---

## 11. Filosofía de mantenimiento

- Cambios pequeños y verificables.
- Si algo no se necesita hoy, no se construye hoy.
- Si un test es más complejo que el código que prueba, el código está
  sobreingenierizado.
- La app debe seguir siendo instalable, offline y rápida en un equipo modesto
  después de cada cambio.
