# Go Offline

> Juega y practica Go sin conexión, sin cuentas y sin distracciones.

**Go Offline** (Baduk · Weiqi) es una aplicación web progresiva para jugar al Go en
local. Todo el procesamiento y todo el almacenamiento ocurren en tu dispositivo:
no hay servidores, no hay registro, no hay anuncios, no hay telemetría.

Abre. Juega. Cierra. Vuelve otro día y continúa exactamente donde lo dejaste.

**Demo en vivo:** [martnmartnez14.github.io/go-offline](https://martnmartnez14.github.io/go-offline/)

---

## Características

- **Tableros de 9×9, 13×13 y 19×19**, con proporciones correctas y adaptación a
  pantalla.
- **Jugador contra jugador local**: dos personas, un dispositivo.
- **Reglas completas**: libertades, grupos, capturas, suicidio, ko simple, pasar
  y rendirse.
- **Puntuación china de área**, con komi configurable y marcado de piedras
  muertas.
- **Handicap** de 2 a 9 piedras, con los puntos estándar en cada tamaño.
- **Deshacer / rehacer** con historial completo, incluido el estado de ko.
- **Historial de jugadas** con coordenadas (A–T sin la columna I) y visor para
  recorrer la partida.
- **Guardado automático** tras cada movimiento.
- **Mis partidas**: continuar, duplicar y eliminar.
- **Modo práctica libre**: coloca piedras negras o blancas, borra y limpia el
  tablero para estudiar posiciones.
- **Exportación SGF**.
- **Modo oscuro** con tema cálido alternativo y tema automático.
- **Sonido suave y vibración** (opcionales).
- **Instalable como PWA** y funcional completamente sin conexión.

---

## Demo y uso

**Ya publicada en GitHub Pages:**
[https://martnmartnez14.github.io/go-offline/](https://martnmartnez14.github.io/go-offline/)

Para probarla en local no hace falta instalar nada: es una web estática.

```bash
# desde la raíz del proyecto
python3 -m http.server 8765
# abre http://127.0.0.1:8765/
```

Con Node instalado también sirve cualquier servidor estático equivalente.

### Cómo se juega

1. **Nueva partida** → elige tamaño, komi y handicap → **Empezar partida**.
2. Toca una intersección para colocar una piedra. El turno alterna entre negras
   y blancas.
3. **Pasar** cede el turno. Dos pases seguidos abren la fase de puntuación.
4. En la fase de puntuación, toca las piedras muertas para marcarlas y pulsa
   **Confirmar puntuación**. **Volver a jugar** retoma la partida.
5. **Rendirse** da la partida por perdida para quien está en turno.

La partida se guarda sola. Si cierras el navegador y vuelves días después,
**Continuar** te sitúa en la misma posición.

---

## Instalación como aplicación

### Android (Chrome)

1. Abre la web en Chrome.
2. Menú ⋮ → **Instalar aplicación** (o **Añadir a pantalla principal**).
3. Se abre como app independiente y funciona sin conexión.

### Linux / Windows (Chrome, Chromium, Edge)

1. Abre la web.
2. En la barra de direcciones aparece el icono de instalación.
3. **Instalar**.

Una vez instalada, puedes desconectar Internet y seguir jugando con normalidad.

---

## GitHub Pages

El proyecto está preparado para publicarse bajo una subcarpeta
(`https://usuario.github.io/nombre-repo/`): **todas las rutas son relativas**,
incluidas las del manifest y del service worker.

1. Sube el contenido de la raíz del repositorio.
2. Activa GitHub Pages desde la rama `main`, carpeta raíz.
3. Abre la URL publicada, instala y verifica el modo avión.

No hay paso de compilación: lo que hay en el repositorio **es** lo que se
despliega.

---

## Tecnologías

| Capa | Elección | Por qué |
|---|---|---|
| Aplicación | HTML + CSS + JavaScript (ES modules) | Sin build, sin dependencias, carga mínima |
| Tablero | SVG | Nítido en HiDPI, accesible, 361 nodos como máximo |
| Lógica | Módulos puros en `src/core/` | Sin DOM: testable de forma independiente |
| Persistencia | `localStorage` tras una fachada async | Cada partida ocupa unos KB; API síncrona y simple |
| Offline | Service worker escrito a mano | Precache del app shell, cache-first |
| Sonido | Web Audio + un WAV local | Sin descargas, degradable a silencio |
| Dependencias | **Ninguna** | — |

Elige SVG sobre Canvas porque el tablero máximo son 361 intersecciones: no hay
carga de trabajo que justifique un lienzo de mapa de bits, y a cambio SVG da
nitidez nativa, estilado por CSS, animaciones ligeras y accesibilidad real.

---

## Estructura

```
├── index.html              Shell de la aplicación
├── manifest.webmanifest    Configuración PWA
├── sw.js                   Service worker
├── LICENSE                 MIT
├── assets/
│   ├── icons/              SVG + PNG (192, 512, maskable)
│   └── sounds/             stone.wav
├── src/
│   ├── main.js             Arranque, enrutado y cableado
│   ├── core/               Motor de Go, sin dependencias del navegador
│   │   ├── board.js        Representación del tablero
│   │   ├── groups.js       Grupos y libertades (flood-fill)
│   │   ├── rules.js        Capturas, suicidio y ko
│   │   ├── game.js         Partida, undo/redo, handicap, serialización
│   │   ├── scoring.js      Puntuación china de área
│   │   └── coords.js       Etiquetas A–T sin I
│   ├── ui/
│   │   ├── boardView.js    Render SVG del tablero
│   │   ├── historyPanel.js Historial y visor
│   │   ├── dialogs.js      Diálogos y avisos
│   │   └── screens/game.js Pantalla de partida
│   ├── storage/store.js    Persistencia local
│   ├── audio/sound.js      Golpe de piedra
│   └── styles/             tokens, layout y tablero
└── tests/                  Pruebas del motor (node --test)
```

---

## Pruebas

La lógica del juego se prueba de forma independiente de la interfaz.

```bash
node --test "tests/*.test.js"
```

74 pruebas cubren libertades, grupos, capturas, suicidio, ko, snapback,
deshacer/rehacer, handicap, serialización y puntuación.

---

## Privacidad

Go Offline procesa y almacena toda la información localmente en tu dispositivo.
No se transmiten partidas ni estadísticas a servidores externos. No hay cuentas,
no hay identificadores, no hay analítica y no se piden permisos de cámara,
micrófono, ubicación ni contactos.

---

## Apoyar el proyecto

¿Te gustó el proyecto? Si querés colaborar de forma voluntaria, podés invitarme
a un cafecito o mate. Es totalmente opcional y me ayuda a seguir trabajando en
la aplicación.

- ☕ [Ko-fi](https://ko-fi.com/martinmartinezgarcia)
- 💙 [PayPal](https://www.paypal.com/paypalme/blufferedtwitch)
- 🛰️ [Internet satelital Starlink](https://starlink.com/es?referral=RC-DF-5848974-78640-68&app_source=share)

**Martín Martínez** — Cuenta Prex: 35502

---

## Roadmap

**Siguiente**
- Importación de SGF y visor de partidas con reproducción.
- Tutorial interactivo y problemas de Go.
- Modo práctica avanzado.
- CPU sencilla con varios niveles.

**En estudio**
- Motores de Go offline (WebAssembly). KataGo puede ser demasiado pesado para
  hardware modesto, así que se evaluará tamaño, RAM, CPU, compatibilidad móvil y
  licencia antes de incorporar nada.

---

## Licencia

[MIT](./LICENSE)

Este proyecto **no reutiliza código** de Online-Go.com ni de ningún otro
proyecto con licencia viral. Online-Go.com se tomó únicamente como referencia
conceptual sobre experiencia de tablero, ergonomía y controles; su licencia
AGPL-3.0 no resulta aplicable porque no hay código derivado.

---

## Créditos

Inspiración conceptual en la experiencia de tablero de la comunidad de Go
online. Ningún código de terceros.

---

## Contribución

Las contribuciones son bienvenidas. Antes de abrir un PR:

1. Lee [`AGENTS.md`](./AGENTS.md) para las convenciones del proyecto.
2. Mantén **cero dependencias** salvo necesidad técnica demostrable.
3. Añade pruebas para cualquier cambio en `src/core/`.
4. Ejecuta `node --test "tests/*.test.js"` y comprueba que todo pasa.
5. No rompas las rutas relativas: la app debe seguir funcionando bajo una
   subcarpeta.
