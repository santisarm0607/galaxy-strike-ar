# 🛸 GALAXY STRIKE AR · versión 3

Juego de aliens en 3D con **dos modos**:

- 🎯 **Disparos AR** (para celular): ves tu cuarto por la cámara trasera, aparecen ovnis y aliens a tu alrededor y **el celular es tu arma**: apuntas moviéndolo, disparas tocando la pantalla y esquivas inclinándolo hacia un lado.
- 👾 **Esquiva marcianos** (para PC): pilotas una nave 3D a toda velocidad y tienes que **esquivar a los marcianos** que vienen hacia ti.

Cada modo tiene **campaña de 4 sectores** (con jefe al final de cada uno) y **modo Infinito** para batir récords. Además: poderes, logros, naves desbloqueables, música, tutorial, ajustes, multijugador competitivo **o cooperativo**.

Es **100 % web**: se juega desde el navegador con un enlace, sin instalar nada.

Hecho por **SantiSarm** con HTML, CSS y JavaScript puro (sin frameworks).

---

## 🆕 Qué trae la versión 3

| | |
|---|---|
| 👑 **4 jefes distintos** | Cada sector termina con su propio jefe (ver la tabla de abajo). En el Infinito se turnan. |
| 📅 **Reto del día** | Una partida especial cada día, **igual para todos**, con un modificador distinto. Cuenta tu mejor intento del día. |
| 💥 **Golpes que se sienten** | Micro-pausa al destruir o recibir daño, un **arco rojo** en el borde que te dice de dónde vino el golpe y vibraciones distintas para cada cosa. |
| ✋ **Cámara: modo sentado** | «Solo manos»: tu mano mueve la nave y dispara al frente. Cansa menos y sirve con la cámara cerca. |
| 🔫 **Gatillo visible** | La mira se cierra y se pone rosada al bajar el pulgar, y un arco amarillo muestra cuánto falta. |
| 🧍 **Guía para la cámara** | Una silueta en la pantalla de preparación que se pone verde cuando estás bien ubicado, con consejos («acércate», «muévete a tu derecha»…). |
| 🧩 **Código ordenado** | La interfaz quedó dividida en módulos (carpeta `js/ui/`). |

### Los jefes

| Sector | Jefe | Disparos AR | Esquiva marcianos |
|---|---|---|---|
| 1 | 🛸 **Guardián lunar** | Ráfagas, abanico y drones. Al final, dispárale al **ojo**. | Orbes, abanico y láseres. |
| 2 | 🪨 **El Rompe-rocas** | Te lanza **meteoros** (¡esquívalos!) y se cubre con una coraza: dispárale cuando se abra. Al final, su **núcleo de lava**. | Te lanza rocas y luego **filas de rocas** con un hueco. |
| 3 | 🪼 **La Reina de la nebulosa** | Se **teletransporta** alrededor tuyo (sigue las flechas), lanza **anillos de plasma** y llama fantasmas. Al final, su **corazón**. | Salta de lado a lado, anillos de orbes (¡quédate quieto!) y cortinas de plasma. |
| 4 | 👑 **Zorp, el emperador** | Cañones gemelos, refuerzos (drones y blindados) y todo su arsenal. Al final, dispárale a **Zorp en persona**. | Cañones, láseres imperiales y refuerzos. |

### Reto del día

En la pantalla de sectores está la tarjeta **📅 Reto del día**. Cada día cambia el modificador (lluvia de meteoros, solo 3 vidas, poderes de sobra, turbo o directo al jefe) y la partida es la misma para todos, así que pueden comparar puntajes en el salón. Puedes intentarlo las veces que quieras. Con Supabase activado, también hay **tabla mundial del día**.

> La vibración solo funciona en Android: Safari en iPhone no deja vibrar desde una página web.

## Qué trajo la versión 2

| | |
|---|---|
| 🗺️ **Campaña** | 4 sectores con colores, oleadas con nombre y un jefe al final. Se desbloquean en orden. |
| ⭐ **Estrellas** | ★★★ sin perder vidas · ★★ perdiendo hasta 2 · ★ si terminas. |
| ♾️ **Infinito** | Oleadas cada vez más difíciles; cada 5 hay nave nodriza. Guarda tu **top 10**. |
| 👾 **Enemigos nuevos** | Divisor (se parte en dos), Fantasma (se teletransporta), Blindado (escudo que aguanta un disparo) y emboscadas por la espalda. |
| 🛸 **Jefes por fases** | La nave nodriza se enfurece, dispara en abanico y al final deja el **ojo expuesto**: dispárale ahí. |
| ⚡ **Poderes** | Cápsulas con 🛡️ Escudo, ⏳ Cámara lenta, ✨ Puntos x2, 🔥 Ráfaga, 💣 Bomba y 🧲 Imán. |
| 🔴 **Esquiva** | Láseres con hueco, anillos dorados para sumar puntos, marcianos que se teletransportan. |
| 🏅 **15 logros** | Y **5 naves** que se desbloquean con ellos (cambian el color de tu nave y de tu láser). |
| 🎵 **Música** | Synthwave hecha por código que sube de intensidad y cambia con el jefe. |
| 🎓 **Tutorial** | Interactivo la primera vez de cada modo (y «Practicar» en *Cómo jugar*). |
| ⚙️ **Ajustes** | Dificultad, música, sonido, vibración, sensibilidad, **modo zurdo** y calidad gráfica (auto/alta/baja). |
| 🤝 **Cooperativo** | En línea: suman puntos en equipo, se mandan escudos y si caes vuelves a los 10 s. |
| 🔥 **Reacciones** | Emojis en vivo durante las partidas en línea, y botón **Revancha** para el anfitrión. |
| 🌎 **Récords mundiales** | Opcional, con Supabase (gratis). Ver más abajo. |

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
- 🟢 **Ovni** (100): flota a tu alrededor y te dispara orbes de plasma.
- 🟡 **Dron** (150): un alien con jetpack que viene directo hacia ti.
- 🟠 **Divisor**: al destruirlo se parte en dos mini-aliens.
- 🟣 **Fantasma**: desaparece y aparece en otro lugar. Dispárale cuando se vuelva sólido.
- 🔵 **Blindado**: tiene un escudo que aguanta el primer disparo.
- 🛸 **Nave nodriza**: tiene fases; en la última su ojo queda expuesto y le haces mucho más daño ahí.
- 🔴 **Meteoro**: no se puede destruir. **Esquívalo** inclinando el celular.

Dispárale a las **cápsulas** blancas para ganar un poder. Los combos multiplican tus puntos hasta **x4**. Las flechas del borde y el radar te muestran dónde hay enemigos fuera de tu vista.

---

## 👾 Cómo se juega: Esquiva marcianos

| Acción | En el PC | En el celular |
|---|---|---|
| Mover la nave | Mouse, o WASD / flechas | Arrastrar el dedo |
| Impulso | Clic o Espacio | Botón **IMPULSO** |
| Pausa | Esc o P | Botón ❚❚ |

- En la **campaña** sobrevives 55 segundos en cada sector y luego aguantas a la nave nodriza (con sus fases).
- En el **Infinito** subes de nivel cada 20 segundos y cada 4 niveles llega la nave nodriza.
- El **círculo rojo** te avisa dónde va a pasar un marciano. Los **muros** y los **láseres** tienen un hueco.
- **Impulso:** te lanza rápido y, mientras dura, nada te hace daño.
- Pasa por dentro de los **anillos dorados** (+100), pasa raspando para un **«¡por poco!»** (+25) y junta **cristales** (+50; cada 12 = +1 ❤).
- Atraviesa las **cápsulas** para ganar poderes (el 🧲 Imán atrae los cristales).

### 🧍 Control con cámara (cuerpo y manos)

En el menú, con *Esquiva marcianos* elegido, toca **Control: 🧍 Cámara**. Funciona en PC (webcam) y en celular (cámara frontal).

Hay dos formas de jugar (se elige en la pantalla de la cámara o en **Ajustes → Control con cámara**):

- **🧍 De pie:** tu cuerpo mueve la nave (lo de la tabla de abajo).
- **✋ Sentado (solo manos):** la nave sigue a tu mano, como un mouse en el aire. Con la mano en pistola y el pulgar abajo dispara **al frente de la nave**. Si muestras la otra mano, también puedes apuntar con ella. Siéntate a unos 50 cm.

La mira te muestra el gatillo: **verde** = mano en pistola, lista; el **arco amarillo** se llena a medida que bajas el pulgar; **rosada y cerrada** = ¡disparando! (con un destello en cada disparo).

| Acción | Cómo |
|---|---|
| Mover la nave | Muévete de lado, agáchate o estírate: la nave te sigue |
| Apuntar | Mano en forma de **pistola** (índice estirado, pulgar arriba): la mira sigue tu dedo |
| Disparar | **Baja el pulgar**, como un gatillo (si lo dejas abajo, dispara seguido) |
| Impulso | **Abre la mano** ✋ un momento |

- Solo con cámara puedes **dispararle a los marcianos** (+50 con combo). Los **muros** y los **láseres** no se rompen: igual hay que pasar por el hueco.
- A los **jefes** también les puedes disparar: si los derribas antes de que se vayan ganas **+1000** extra (por sector).
- Sirve con cualquiera de las dos manos, o con las dos a la vez (una mira por mano).
- Antes de jugar se abre una pantalla que pide permiso para la cámara y te muestra una **silueta**: ponte dentro hasta que se ponga **verde** y sigue los consejos que salen debajo. Al decir **¡YA!** en la cuenta regresiva, tu posición queda como el centro.
- En una esquina ves una mini ventana (como espejo) con tus puntos: si dice **«No te veo»**, vuelve frente a la cámara.
- Consejos: aléjate 1–2 metros, con luz de frente y que se vean tus hombros. En el celular, apóyalo en algo.
- Usa **MediaPipe** (de Google, gratis). La librería y los modelos (unos 15 MB) se descargan de internet la primera vez que eliges la cámara. Nada de tu cámara se envía a ningún lado: todo se procesa en tu equipo.
- Si tu equipo va muy lento con la cámara, el juego te avisa y vuelve solo al control normal.

---

## 📁 Estructura

```
galaxy-strike-ar/
├── index.html           → pantallas y HUD
├── iconos/icono.png     → el ícono de la pestaña del navegador
├── css/
│   └── estilos.css      → todo el diseño
└── js/
    ├── utilidades.js    → matemática 3D (cuaterniones) y números aleatorios con semilla
    ├── config.js        → (opcional) datos de Supabase para los récords mundiales
    ├── ajustes.js       → preferencias: dificultad, música, sensibilidad, zurdo, calidad…
    ├── sonido.js        → efectos de sonido sintetizados
    ├── musica.js        → música synthwave hecha por código
    ├── sensores.js      → cámara trasera, giroscopio y controles alternativos
    ├── sprites.js       → brillos y dibujos 2D de respaldo (si no hay WebGL)
    ├── motor3d.js       → motor 3D propio con WebGL
    ├── modelos.js       → modelos 3D: ovni, dron, los 4 jefes, nave, cápsulas, anillos, láseres…
    ├── sectores.js      → la campaña: sectores, colores y oleadas (¡fácil de editar!)
    ├── progreso.js      → sectores ganados, estrellas, logros, naves y récords
    ├── poderes.js       → los poderes y sus fichas en pantalla
    ├── juego.js         → modo Disparos AR
    ├── cuerpo.js        → control con cámara: detecta tu cuerpo y tus manos (MediaPipe)
    ├── esquiva.js       → modo Esquiva marcianos
    ├── tutorial.js      → tutorial interactivo
    ├── red.js           → multijugador en línea (PeerJS)
    ├── jefes.js         → los 4 jefes: nombres, avisos y punto débil
    ├── reto.js          → el reto del día (semilla y modificador de cada día)
    ├── interfaz.js      → arranque de la interfaz
    └── ui/              → la interfaz, dividida en módulos:
        ├── base.js      → utilidades, pantallas, pantalla completa, permisos y cuenta regresiva
        ├── partida.js   → HUD, eventos del juego, fin de partida, controles y pausa
        ├── sala.js      → multijugador en línea, marcador, resultados y emojis
        ├── menus.js     → botones, sectores, reto del día, perfil (logros, récords, naves) y ajustes
        └── camara.js    → control con cámara: preparación, silueta guía y modos
    └── main.js          → arranque, bucle del juego y calidad automática
```

**¿Cómo funciona la realidad aumentada?** La pantalla tiene cuatro capas, una encima de otra:

1. `<video>` con la cámara trasera.
2. `#fondo` (2D): viñeta sobre la cámara, o el espacio con estrellas si no hay cámara.
3. `#capa3d` (WebGL): los aliens en **3D de verdad**, con luz, brillo metálico, vidrio transparente y luces que parpadean.
4. `#lienzo` (2D): brillos, explosiones, textos, mira, radar y flechas.

Los aliens existen en un mundo 3D alrededor de ti. Cada cuadro el juego lee el giroscopio (`deviceorientation`), calcula hacia dónde apunta el celular y mueve la cámara 3D igual. Por eso, si giras, los aliens se quedan "quietos" en tu cuarto.

**Modelos 3D:** están hechos con piezas simples (esferas, conos, donas y superficies de revolución) en `js/modelos.js`. No se usa ninguna librería 3D: el motor está en `js/motor3d.js`.

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

## ↔️ Horizontal y pantalla completa

El juego está hecho para jugarse **en horizontal** (celular acostado):

- Si el celular está vertical, sale el aviso **«Gira tu celular»**. Si de verdad quieres jugar vertical, toca «Seguir en vertical».
- Los menús se acomodan en **dos columnas** cuando la pantalla es baja (celular acostado).
- Se respetan las zonas del notch / isla dinámica y de la barra de inicio (`env(safe-area-inset-*)`), para que nada quede tapado.

**Botón ⛶ (arriba a la derecha y en la pausa):**

| Dispositivo | Qué hace |
|---|---|
| PC | Pantalla completa (o usa F11). |
| Android (Chrome) | Pantalla completa y **bloquea el giro en horizontal**. Al empezar a jugar se pone en pantalla completa solo. |
| iPhone (Safari) | Safari en iPhone **no permite** pantalla completa en páginas web ni bloquear el giro. El botón explica cómo esconder la barra de Safari (abajo). |

---

## 🍎 Cómo verlo mejor en iPhone

Safari en iPhone no deja poner páginas web en pantalla completa, pero así se ve casi igual:

1. Abre el enlace `https://...` del juego en **Safari**.
2. Quita el **bloqueo de orientación** 🔒 (desliza desde la esquina de arriba a la derecha) y **gira el celular**.
3. Toca el **ícono de la página** en la barra de Safari, al lado de la dirección (si no lo ves, toca **•••**), y elige **«Ocultar barra de herramientas»**. Para que vuelva, toca arriba o abajo de la pantalla.

Consejos:
- El juego se acomoda a la muesca / isla dinámica y a las esquinas redondeadas, así que nada queda tapado.
- Si no se escucha el sonido, revisa que el iPhone no esté en silencio y sube el volumen.
- Si cambias el código y no ves los cambios, recarga la página.

---

## 🌐 Multijugador en línea

- Uno toca **Crear sala** y le sale un código de 4 letras (por ejemplo `HA8T`). Los demás lo escriben en **Unirse**. Hasta **4 pilotos**. También puedes tocar **Compartir** para mandar un enlace con el código.
- El anfitrión elige el **modo** (en el menú, antes de crear la sala) y el **tipo de partida** (botón en la sala):
  - ⚔️ **Competencia:** gana quien haga más puntos en 3 minutos. Cada 8 kills le mandas meteoros (o una estampida en *Esquiva*) a tus rivales.
  - 🤝 **Cooperativo:** suman puntos para llegar a la meta del equipo (6.000 por piloto). Cuando llenas tu barra le mandas un **escudo** a tu equipo, y si caes vuelves a los 10 segundos.
- Todos enfrentan **la misma invasión** (las oleadas salen iguales para todos), cada uno en su espacio. En línea todos juegan en dificultad Normal.
- Durante la partida hay **reacciones** (🔥😂😱👏) a la derecha de la pantalla. Al terminar, el anfitrión tiene **🔁 Revancha**.

Funciona con **PeerJS** (WebRTC): los celulares se conectan directo usando el servidor público gratuito de PeerJS para encontrarse, así que **no necesitas montar un servidor**. Si el anfitrión sale, la sala se cierra.

> Si no conecta: algunas redes WiFi de colegios o universidades bloquean WebRTC. Prueba con datos móviles.

---

## 🌎 Récords mundiales (opcional, gratis con Supabase)

Sin configurar nada, los récords se guardan en cada dispositivo (top 10). Para tener una **tabla mundial**:

1. Crea una cuenta y un proyecto en [supabase.com](https://supabase.com).
2. Ve a **SQL Editor** y ejecuta esto:

```sql
create table records (
  id bigint generated always as identity primary key,
  nombre text not null check (char_length(nombre) between 1 and 14),
  puntos integer not null check (puntos > 0 and puntos < 10000000),
  tipo text not null check (tipo in ('ar', 'esquiva', 'reto_ar', 'reto_esquiva')),
  creado timestamptz not null default now()
);
alter table records enable row level security;
create policy "todos pueden ver" on records for select using (true);
create policy "todos pueden agregar" on records for insert with check (true);
```

3. En **Project Settings → API Keys** copia la *Project URL* y la llave pública (*publishable key* `sb_publishable_…`, o la *anon public key* en proyectos viejos) y pégalas en `js/config.js`:

```js
window.GS.CONFIG_GLOBAL = {
  supabaseUrl: 'https://xxxx.supabase.co',
  supabaseKey: 'sb_publishable_...'
};
```

Listo: al terminar una partida del modo Infinito o del reto del día se envía el puntaje, y en **Logros → Récords** aparecen la tabla 🌎 Mundial y la del reto de hoy.

**¿Ya habías creado la tabla con la versión 2?** Ejecuta esto para que acepte también los puntajes del reto del día:

```sql
alter table records drop constraint records_tipo_check;
alter table records add constraint records_tipo_check check (tipo in ('ar', 'esquiva', 'reto_ar', 'reto_esquiva'));
```

> Ojo: como el juego no tiene cuentas de usuario, alguien que sepa programar podría mandar puntajes falsos. Para un juego entre amigos está bien; si se vuelve popular, toca agregar validación.

---

## 🛠️ Personalizar

- **Oleadas y sectores:** en `js/sectores.js`. Cada oleada es una lista de grupos, por ejemplo `{ tipo: 'divisor', n: 4, cada: 1.2, desde: 3, detras: true }` (4 divisores, uno cada 1,2 s, desde el segundo 3, apareciendo por tu espalda). También puedes cambiar los colores de cada sector y lo que pasa en *Esquiva* (`vel`, `laseres`, `muros`, `jefeFases`…).
- **Disparos AR:** `CONFIG` al inicio de `js/juego.js` (vidas, cadencia, ayuda al apuntar, distancia del esquive…).
- **Esquiva marcianos:** `CFG` al inicio de `js/esquiva.js` (vidas, velocidad, segundos por sector, cristales por vida, cadencia de los disparos con cámara, vida de la nave nodriza…).
- **Control con cámara:** `CFG` al inicio de `js/cuerpo.js` (cuánto te mueves para llegar al borde, qué tan sensible es el gatillo del pulgar, suavizado y detecciones por segundo).
- **Poderes:** `TIPOS` en `js/poderes.js` (duración, ícono, color y en qué modo salen).
- **Logros y naves:** `LOGROS` y `NAVES` en `js/progreso.js`.
- **Dificultades:** `DIFICULTAD` en `js/ajustes.js`.
- **Multijugador:** `DURACION_ONLINE`, `MAX_JUGADORES` y `META_COOP_POR_JUGADOR` en `js/ui/base.js`.
- **Jefes:** nombres y avisos en `js/jefes.js`; sus ataques en `actualizarJefe` de `js/juego.js` y `js/esquiva.js`.
- **Reto del día:** los modificadores (`MODS`) en `js/reto.js`.
- **Vibraciones y micro-pausa:** `VIBRA` y `J.congelar` en `js/juego.js`.
- **Música:** tempo y acordes al inicio de `js/musica.js`.

Para borrar todo tu progreso: en el navegador, abre la consola (F12) y escribe `localStorage.clear()`.
