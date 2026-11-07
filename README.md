# 🛸 GALAXY STRIKE AR

Juego de aliens en 3D con **dos modos**:

- 🎯 **Disparos AR** (para celular): ves tu cuarto por la cámara trasera, aparecen ovnis y aliens a tu alrededor y **el celular es tu arma**: apuntas moviéndolo, disparas tocando la pantalla y esquivas inclinándolo hacia un lado.
- 👾 **Esquiva marcianos** (para PC): pilotas una nave 3D a toda velocidad y tienes que **esquivar a los marcianos** que vienen hacia ti.

En el menú eliges el modo. En PC arranca seleccionado *Esquiva marcianos* y en el celular *Disparos AR*, pero los dos funcionan en ambos.

Hecho por **SantiSarm** con HTML, CSS y JavaScript puro (sin frameworks).

---

## 🎮 Cómo se juega: Disparos AR

| Acción | En el celular | En el PC (para probar) |
|---|---|---|
| Apuntar | Mover el celular | Mover el mouse |
| Disparar | Tocar la pantalla o mantener **FUEGO** | Clic o Espacio |
| Esquivar | Inclinar el celular a un lado (como un timón) | A / D o ← / → |
| Centrar la mira | Tocar el radar | Tecla R |
| Pausa | Botón ❚❚ | Esc o P |

**Enemigos**
- 🟢 **Ovni** (100 pts): flota a tu alrededor y te dispara orbes de plasma. Antes de disparar se ve un brillo rosado debajo.
- 🟡 **Dron** (150 pts): un alien con jetpack que viene directo hacia ti. ¡Dispárale antes de que llegue!
- 🟣 **Nave nodriza** (1500 pts): sale cada 5 oleadas, aguanta muchos disparos y suelta drones. Al destruirla recuperas una vida.
- 🔴 **Meteoro**: no se puede destruir. Tienes que **esquivarlo** inclinando el celular (+50 pts si lo esquivas).

Los orbes de plasma se pueden destruir (+25) o esquivar (+25). Si matas aliens seguidos haces **combo** y tus puntos se multiplican hasta **x4**. Las flechas del borde de la pantalla y el radar te muestran dónde hay enemigos fuera de tu vista.

---

## 👾 Cómo se juega: Esquiva marcianos

| Acción | En el PC | En el celular |
|---|---|---|
| Mover la nave | Mouse, o WASD / flechas | Arrastrar el dedo |
| Impulso | Clic o Espacio | Botón **IMPULSO** |
| Pausa | Esc o P | Botón ❚❚ |

- Los marcianos vienen hacia ti cada vez más rápido. Cada **20 segundos** subes de nivel.
- Cuando un marciano te va a pegar, aparece un **círculo rojo** donde va a pasar: ¡muévete!
- **Impulso:** te lanza rápido hacia donde te mueves y, mientras dura, los marcianos te atraviesan sin hacerte daño. Se recarga en 2 segundos.
- Desde el nivel 3 llegan **muros de marcianos** con un hueco: tienes que pasar por ahí.
- Cada 4 niveles llega la **nave nodriza** y te dispara orbes durante 12 segundos. Si sobrevives ganas +500.
- Pasar raspando un marciano da **«¡por poco!»** (+25). Los **cristales** dan +50 y cada 12 te devuelven una vida.
- Tienes 3 vidas. Los combos multiplican los puntos hasta x4.

En multijugador, el anfitrión elige el modo de la sala. En *Esquiva marcianos*, cada 8 «¡por poco!» o cristales le mandas una **estampida de marcianos** a tus rivales.

---

## 📁 Estructura

```
galaxy-strike-ar/
├── index.html          → pantallas y HUD
├── css/
│   └── estilos.css     → todo el diseño
└── js/
    ├── utilidades.js   → matemática 3D (cuaterniones) y números aleatorios con semilla
    ├── sonido.js       → efectos de sonido sintetizados (no usa archivos de audio)
    ├── sensores.js     → cámara trasera, giroscopio y controles alternativos
    ├── sprites.js      → brillos y dibujos 2D de respaldo (si el celular no tiene WebGL)
    ├── motor3d.js      → motor 3D propio con WebGL: geometrías, luces y cámara
    ├── modelos.js      → modelos 3D del ovni, dron, nave nodriza, orbe y meteoros
    ├── juego.js        → modo Disparos AR: oleadas, enemigos, disparos, esquivar y dibujo
    ├── esquiva.js      → modo Esquiva marcianos: nave, marcianos, muros, jefe, niveles
    ├── red.js          → multijugador en línea (PeerJS)
    ├── interfaz.js     → botones, pantallas, HUD y salas
    └── main.js         → arranque y bucle del juego
```

**¿Cómo funciona la realidad aumentada?** La pantalla tiene cuatro capas, una encima de otra:

1. `<video>` con la cámara trasera.
2. `#fondo` (2D): viñeta sobre la cámara, o el espacio con estrellas si no hay cámara.
3. `#capa3d` (WebGL): los aliens en **3D de verdad**, con luz, brillo metálico, vidrio transparente y luces que parpadean.
4. `#lienzo` (2D): brillos, explosiones, textos, mira, radar y flechas.

Los aliens existen en un mundo 3D alrededor de ti. Cada cuadro el juego lee el giroscopio (`deviceorientation`), calcula hacia dónde apunta el celular y mueve la cámara 3D igual. Por eso, si giras, los aliens se quedan "quietos" en tu cuarto y los ves desde otro ángulo.

**Modelos 3D:** están hechos con piezas simples (esferas, conos, donas y superficies de revolución) en `js/modelos.js`. Cada pieza tiene color, posición, rotación, escala y opciones como `emisivo` (brilla), `alfa` (transparente), `giro` (da vueltas) o `parpadeo`. Puedes cambiar colores o agregar piezas ahí mismo. No se usa ninguna librería 3D: el motor está en `js/motor3d.js`.

---

## 💻 Probarlo en el PC (VS Code)

1. Abre la carpeta `galaxy-strike-ar` en VS Code.
2. Instala la extensión **Live Server** (de Ritwick Dey).
3. Clic derecho en `index.html` → **Open with Live Server**.

En el PC arranca el modo **Esquiva marcianos**, que se juega con el mouse. Si eliges *Disparos AR* en el PC, como no hay giroscopio, apuntas con el mouse y ves un fondo espacial en vez de la cámara. Puedes probar todo, incluido el multijugador (abre dos pestañas).

> Necesitas internet: las fuentes y la librería del multijugador (PeerJS) se cargan desde internet.

---

## 📱 Jugarlo en el celular (necesita HTTPS)

Los navegadores **solo dejan usar la cámara y el giroscopio en páginas con `https://`**. Por eso, abrir la IP de tu PC (`http://192.168.x.x:5500`) desde el celular **no funciona** para la AR. Publica el juego gratis con una de estas opciones:

### Opción A: Netlify Drop (la más fácil, 1 minuto)
1. Entra a **https://app.netlify.com/drop**
2. Arrastra la carpeta `galaxy-strike-ar` completa.
3. Te da un enlace `https://algo.netlify.app`: ábrelo en el celular. ¡Listo!

### Opción B: GitHub Pages
1. Sube la carpeta a un repositorio de GitHub (los archivos deben quedar en la raíz, con `index.html`).
2. En el repositorio: **Settings → Pages → Branch: main → / (root) → Save**.
3. En un par de minutos queda en `https://tu-usuario.github.io/nombre-repo/`.

**En el celular:**
- **Android:** usa Chrome. Acepta el permiso de la cámara.
- **iPhone:** usa Safari. Te va a pedir permiso para "Movimiento y orientación": dale **Permitir**.
- Sostén el celular con las dos manos y deja espacio a tu alrededor, porque vas a girar.

---

## 🌐 Multijugador en línea

- Uno toca **Crear sala** y le sale un código de 4 letras (por ejemplo `HA8T`). Los demás escriben ese código en **Unirse**. Hasta **4 pilotos**.
- También puedes tocar **Compartir**: manda un enlace que ya trae el código.
- Todos enfrentan **la misma invasión** (las oleadas salen iguales para todos), cada uno en su propio espacio.
- La partida dura **3 minutos**. Gana quien haga más puntos. Hay marcador en vivo.
- Cada **8 kills** le mandas una **lluvia de meteoros** a tus rivales. Destruir la nave nodriza manda una lluvia más grande.

Funciona con **PeerJS** (WebRTC): los celulares se conectan directo entre ellos usando el servidor público gratuito de PeerJS para encontrarse, así que **no necesitas montar un servidor**. El que crea la sala es el anfitrión: si él sale, la sala se cierra.

> Si no conecta: algunas redes WiFi de colegios o universidades bloquean WebRTC. Prueba con datos móviles.

---

## 🛠️ Personalizar

En `js/juego.js`, al inicio, está `CONFIG`:

```js
const CONFIG = {
  vidasMax: 5,
  cadencia: 0.17,          // segundos entre disparos
  ayudaApuntado: 16,       // píxeles de ayuda al apuntar
  distanciaEsquive: 1.7,   // cuánto te mueves al inclinar el celular
  killsParaAtaque: 8,      // kills para mandar meteoros en línea
  jefeCada: 5              // cada cuántas oleadas sale la nave nodriza
};
```

El modo *Esquiva marcianos* tiene su propio `CFG` al inicio de `js/esquiva.js` (vidas, velocidad, segundos por nivel, cada cuánto sale la nave nodriza, recarga del impulso…).

En `js/interfaz.js` puedes cambiar `DURACION_ONLINE` (segundos de cada partida en línea) y `MAX_JUGADORES`.

Los puntos de cada enemigo están en `PUNTOS` (también en `juego.js`) y los dibujos de los aliens en `js/sprites.js`.
