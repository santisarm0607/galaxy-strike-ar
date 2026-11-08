/* =========================================================
   GALAXY STRIKE AR — esquiva.js
   Modo «ESQUIVA MARCIANOS» (pensado para PC).
   Pilotas una nave 3D vista desde atrás; los marcianos vienen
   hacia ti y tienes que esquivarlos. Mouse, WASD/flechas o
   arrastrar el dedo para moverte; Espacio/clic para el impulso.
   Con el control de CÁMARA (js/cuerpo.js) tu cuerpo mueve la nave,
   la mano en forma de pistola dispara y la mano abierta da impulso.

   Campaña: cada sector dura ~1 minuto y termina con su nave
   nodriza (sobrevive a sus fases para completarlo).
   Infinito: subes de nivel cada 20 s y el sector cambia solo.
   ========================================================= */
'use strict';

(function (GS) {
  const U = GS.U, Q = GS.Q, TAU = Math.PI * 2;
  const J = GS.Juego;

  /* ---------------- Ajustes (cámbialos a tu gusto) ---------------- */
  const CFG = {
    vidas: 3,
    limX: 6,               // hasta dónde se mueve la nave a los lados
    limY: 3.4,             // y hacia arriba/abajo
    radioNave: 0.5,
    velBase: 16,           // velocidad inicial de los marcianos (modo infinito)
    velPorNivel: 1.7,
    velMax: 42,
    segundosPorNivel: 20,  // modo infinito
    segundosSector: 55,    // campaña: tiempo antes de que llegue la nave nodriza
    jefeCada: 4,           // modo infinito: la nave nodriza sale cada 4 niveles
    impulsoEnfriamiento: 2.2,
    impulsoDuracion: 0.32,
    cristalesPorVida: 12,
    distanciaAparicion: 130,
    // Control con cámara (js/cuerpo.js): disparos con la mano
    cadenciaCamara: 0.3,   // segundos entre disparos de cada mano
    ayudaMira: 26,         // píxeles de ayuda al apuntar
    vidaJefeBase: 20,      // disparos que aguanta la nave nodriza…
    vidaJefePorFase: 12    // …más estos por cada fase
  };
  const PUNTOS = { porPoco: 25, cristal: 50, anillo: 100, jefe: 500, marciano: 50, jefeDerribado: 1000 };

  const E = (GS.Esquiva = { CFG });

  const V = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    esc: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
    norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  };

  /* ---------------- Estado ---------------- */
  const nave = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, t: 0 };
  const teclas = { arriba: false, abajo: false, izq: false, der: false };
  let obs = [], items = [], parts = [], textos = [], rayas = [], ataques = [];
  let jefe = null, nivel = 1, vel = CFG.velBase, tiempoVivo = 0, tSector = 0;
  let tSpawn = 0, tCristal = 0, tFormacion = 0, tLaser = 0, tAnillo = 0, tCapsula = 0, acumPuntos = 0, tAvisoPuntos = 0;
  let impulsoEnfr = 0, impulsoT = 0, finEn = -1, victoriaEn = -1, sueloOffset = 0;
  let porPoco = 0, cristales = 0, anillos = 0, jefeSuperado = false;
  let derribos = 0, rayosJ = [], enfrMano = {}, fogonazos = {}; // control con cámara
  let jefesVistos = 0, offsetNivel = 0; // reto «Directo al jefe»: empieza más adelante
  E.camara = false;
  let sector = null, tema = null;
  let camQ = Q.identidad(), camInv = Q.identidad(), camPos = [0, 1.5, 8.5];
  let C = null; // capas de dibujo que presta juego.js

  /* Límites y cámara según la pantalla: en PC (horizontal) el área es ancha;
     en un celular vertical se angosta y la cámara abre más el ángulo. */
  let LX = CFG.limX, LY = CFG.limY, FE = 800, distCam = 8.5, seguir = 0.5, altCam = 1.5;
  function ajustarPantalla() {
    if (C.W >= C.H) {
      // En pantallas muy anchas (celular acostado) se abre el ángulo vertical para que la nave no se salga
      LX = CFG.limX; LY = CFG.limY; FE = Math.min(C.F, (C.H / 2) / Math.tan(24 * Math.PI / 180)); distCam = 8.5; seguir = 0.5; altCam = 1.5;
    } else {
      LX = 4.2; LY = 3.6; FE = (C.W / 2) / Math.tan(32 * Math.PI / 180); distCam = 5.6; seguir = 0.65; altCam = 2.3;
    }
  }

  function crearRayas() {
    rayas = [];
    for (let i = 0; i < 220; i++) {
      let x, y;
      do { x = U.rand(-45, 45); y = U.rand(-28, 28); } while (Math.abs(x) < 8 && Math.abs(y) < 5);
      rayas.push({ x, y, z: U.rand(-220, 10) });
    }
  }

  /** Deja la nave lista (se ve durante la cuenta regresiva). */
  E.preparar = function () {
    Object.assign(nave, { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, t: 0 });
    obs = []; items = []; parts = []; textos = []; ataques = []; rayosJ = []; enfrMano = {}; fogonazos = {};
    jefe = null; impulsoT = 0; impulsoEnfr = 0;
    if (!rayas.length) crearRayas();
  };

  /** Configuración de marcianos del momento (sector de la campaña o del nivel infinito). */
  function config() {
    if (sector) return sector.esquiva;
    return GS.Sectores.lista[Math.floor((nivel - 1) / 2) % GS.Sectores.total].esquiva;
  }

  E.iniciar = function (opc = {}) {
    E.preparar();
    sector = J.campana ? GS.Sectores.get(J.campana) : null;
    tema = (sector || GS.Sectores.lista[0]).tema;
    nivel = 1; tiempoVivo = 0; tSector = 0;
    vel = (sector ? sector.esquiva.vel : CFG.velBase) * J.dif.velocidad;
    tSpawn = 1.2; tCristal = 2; tFormacion = 10; tLaser = 6; tAnillo = 4; tCapsula = J.esReto('poderes') ? 6 : 12;
    offsetNivel = J.esReto('jefes') && !opc.sector ? (CFG.jefeCada - 1) * CFG.segundosPorNivel - 6 : 0;
    acumPuntos = 0; tAvisoPuntos = 0; finEn = -1; victoriaEn = -1;
    porPoco = 0; cristales = 0; anillos = 0; jefeSuperado = false; derribos = 0; jefesVistos = 0;
    if (opc.tutorial || J.tutorial) { tSpawn = Infinity; tCristal = Infinity; tFormacion = Infinity; tLaser = Infinity; tAnillo = Infinity; tCapsula = Infinity; }
    J.oleada = 1;
    J.tema = tema;
    J.emitir('oleada', 1, false, sector ? sector.nombre : 'Nivel 1');
  };

  E.estadisticas = () => ({ nivel, tiempo: tiempoVivo, porPoco, cristales, anillos, derribos });

  /** Texto para el centro del HUD. */
  E.progreso = function () {
    if (J.tutorial) return 'TUTORIAL';
    if (sector) {
      if (jefe) return 'SECTOR ' + sector.id + ' · ' + jefe.def.nombre;
      return 'SECTOR ' + sector.id + ' · ' + Math.max(0, Math.ceil(CFG.segundosSector - tSector)) + 's';
    }
    return 'NIVEL ' + nivel;
  };

  /** Solo para pruebas: saltar a un momento de la partida y ver el estado. */
  E.depurar = {
    tiempo: (s) => { tiempoVivo = s; tSector = s; },
    estado: () => ({ nave: { ...nave }, obs: obs.map((e) => ({ tipo: e.tipo, x: e.x, y: e.y, z: e.z, radio: e.radio })), items: items.length, jefe: !!jefe, fase: jefe ? jefe.fase : 0, vel, nivel }),
    jefe: () => jefe
  };

  /* ---------------- Controles ---------------- */
  const sens = () => (GS.Ajustes ? GS.Ajustes.get('sensibilidad') || 1 : 1);
  E.apuntar = function (mx, my, w, h) {
    if (!C) return;
    const k = sens();
    nave.tx = U.clamp((mx / w - 0.5) * 2 * LX * 1.15 * k, -LX, LX);
    nave.ty = U.clamp(-(my / h - 0.5) * 2 * LY * 1.25 * k, -LY, LY);
  };
  E.arrastrar = function (dx, dy, w, h) {
    if (!C) return;
    const k = sens();
    nave.tx = U.clamp(nave.tx + dx * ((2 * LX) / w) * 1.4 * k, -LX, LX);
    nave.ty = U.clamp(nave.ty - dy * ((2 * LY) / h) * 1.8 * k, -LY, LY);
  };
  E.tecla = function (nombre, on) { teclas[nombre] = on; };

  /** Prende o apaga el control con cámara (cuerpo mueve la nave, manos disparan). */
  E.usarCamara = function (on) { E.camara = !!on; enfrMano = {}; };

  /** Disparo con la mano hacia un punto de la pantalla (sx, sy en píxeles). */
  E.dispararA = function (sx, sy, ayuda) {
    const ay = ayuda || CFG.ayudaMira;
    if (!C || J.estado !== 'jugando' || !J.vivo) return null;
    // Rayo desde la cámara que pasa por ese punto de la pantalla
    const dir = Q.rotar(camQ, V.norm([(sx - C.W / 2) / FE, -(sy - C.H / 2) / FE, -1]));
    let mejor = null, mejorZ = -Infinity;
    for (const e of obs) {
      if (e.tipo !== 'dron' && e.tipo !== 'teleport' && e.tipo !== 'ovni') continue;
      if (e.z < -115 || e.z > 1) continue;
      const p = proyectar([e.x, e.y, e.z]);
      if (p.detras) continue;
      const r = Math.max(e.radio * p.k * 1.25, ay);
      if (Math.hypot(p.x - sx, p.y - sy) < r && e.z > mejorZ) { mejor = e; mejorZ = e.z; }
    }
    let golpeJefe = false;
    if (jefe && jefe.t < jefe.dur && jefe.entrada > 0.6 && (!mejor || jefe.z > mejorZ)) {
      const p = proyectar([jefe.x, jefe.y, jefe.z]);
      if (!p.detras && Math.hypot(p.x - sx, p.y - sy) < Math.max(4.2 * p.k * 0.75, ay)) golpeJefe = true;
    }
    const origen = [nave.x, nave.y + 0.1, -0.8];
    let fin;
    if (golpeJefe) fin = [jefe.x, jefe.y, jefe.z];
    else if (mejor) fin = [mejor.x, mejor.y, mejor.z];
    else { const t = (-90 - camPos[2]) / Math.min(-0.05, dir[2]); fin = V.add(camPos, V.esc(dir, t)); }
    rayosJ.push({ a: origen, b: fin, t: 0, vida: 0.12, c: GS.Progreso.nave().laser || '56,248,255' });
    GS.Sonido.disparo();

    if (golpeJefe) {
      jefe.vida--;
      jefe.golpe = 0.12;
      explosion([jefe.x + U.rand(-1, 1), jefe.y - 0.5, jefe.z + 2], 'orbe', 8);
      GS.Sonido.impacto();
      if (jefe.vida <= 0) jefeVencido(true);
      else J.vibrar('disparo');
      return 'jefe';
    }
    if (!mejor) return null;
    if (mejor.formacion) {
      // Los muros no se rompen: hay que pasar por el hueco
      explosion([mejor.x, mejor.y, mejor.z], 'nave', 6);
      GS.Sonido.rebote();
      return 'muro';
    }
    mejor.muerto = true;
    derribos++;
    J.congelar(0.045);
    J.vibrar('kill');
    explosion([mejor.x, mejor.y, mejor.z], mejor.tipo, 22);
    GS.Sonido.explosion(false);
    sumarCombo();
    const pts = J.sumarPuntos(PUNTOS.marciano, true);
    textos.push({ txt: '+' + pts, c: '#ffd23f', t: 0, vida: 0.8, x: mejor.x, y: mejor.y + 0.8, z: mejor.z });
    if (J.tutorial || mejor.tutorial) J.emitir('tutDisparo');
    return 'marciano';
  };

  /** Punto de la pantalla al que apunta la mira de una mano. La mano piloto (modo «solo manos») dispara al frente de la nave. */
  function puntoMira(m) {
    if (m.piloto) {
      const p = proyectar([nave.x, nave.y + 0.3, -32]);
      if (!p.detras) return [p.x, p.y];
    }
    return [m.x * C.W, m.y * C.H];
  }

  /** Cada cuadro: las manos en forma de pistola con el gatillo abajo disparan. */
  function disparosCamara(dt) {
    for (const id in enfrMano) enfrMano[id] -= dt;
    for (const id in fogonazos) fogonazos[id] -= dt;
    if (!E.camara || !GS.Cuerpo || !J.vivo) return;
    for (const m of GS.Cuerpo.manos) {
      if (!m.gatillo) continue;
      if ((enfrMano[m.id] || 0) > 0) continue;
      enfrMano[m.id] = CFG.cadenciaCamara;
      fogonazos[m.id] = 0.22; // la mira «se dispara» y se ve
      const [sx, sy] = puntoMira(m);
      E.dispararA(sx, sy, m.piloto ? 70 : 0);
    }
  }
  E.impulso = function () {
    if (J.estado !== 'jugando' || !J.vivo || impulsoEnfr > 0) return;
    let dx = nave.tx - nave.x, dy = nave.ty - nave.y;
    if (Math.hypot(dx, dy) < 0.3) { dx = nave.vx; dy = nave.vy; }
    const l = Math.hypot(dx, dy);
    if (l >= 0.05) { // si estás quieto, el impulso solo te protege
      dx /= l; dy /= l;
      nave.tx = U.clamp(nave.tx + dx * 3.2, -LX, LX);
      nave.ty = U.clamp(nave.ty + dy * 3.2, -LY, LY);
      nave.vx += dx * 22;
      nave.vy += dy * 22;
    }
    impulsoT = CFG.impulsoDuracion;
    impulsoEnfr = CFG.impulsoEnfriamiento;
    GS.Sonido.impulso();
    J.vibrar('impulso');
    if (J.tutorial) J.emitir('tutImpulso');
  };

  /** Multijugador: un rival te manda una estampida de marcianos. */
  E.recibirAtaque = function (nombre, n) {
    if (J.estado !== 'jugando' || !J.vivo) return;
    for (let i = 0; i < n * 2; i++) ataques.push(0.5 + i * 0.35);
    J.emitir('aviso', '¡' + nombre + ' te mandó una estampida!', 'peligro');
    GS.Sonido.ataque();
  };

  /** Para el tutorial: poner cosas a mano. */
  E.tut = {
    anillo(x, y) { obs.push({ tipo: 'anillo', x, y, z: -70, t: 0, radio: 1.6, extra: 0, tutorial: true }); },
    dron(x, y, z) { obs.push({ tipo: 'dron', x, y, x0: x, y0: y, z: z || -90, t: 0, fase: 0, extra: 2, radio: 0.85, tutorial: true }); },
    capsula(poder, x, y) { obs.push({ tipo: 'capsula', poder, x, y, z: -80, t: 0, radio: 0.7, extra: 0, tutorial: true }); },
    cristal(x, y) { items.push({ x, y, z: -80, t: 0, radio: 0.45 }); },
    nave: () => ({ x: nave.x, y: nave.y }),
    limites: () => ({ x: LX, y: LY })
  };

  /* ---------------- Aparición ----------------
     Siempre se usa el mismo número de llamadas a J.rng para que,
     en multijugador, todos tengan la misma lluvia de marcianos. */
  function elegirTipo(pesos, a) {
    const claves = Object.keys(pesos);
    let total = 0;
    claves.forEach((k) => { total += pesos[k]; });
    let x = a * total;
    for (const k of claves) { x -= pesos[k]; if (x <= 0) return k; }
    return claves[claves.length - 1];
  }

  function aparecer() {
    const r = J.rng;
    const a = r(), b = r(), c = r(), d = r(), f = r();
    const apuntado = d < 0.35; // algunos vienen directo hacia donde estás
    const x = apuntado ? U.clamp(nave.x + (b - 0.5) * 2, -LX, LX) : (b * 2 - 1) * LX;
    const y = apuntado ? U.clamp(nave.y + (c - 0.5) * 1.6, -LY, LY) : (c * 2 - 1) * LY;
    let pesos = config().pesos;
    if (J.esReto('meteoros')) pesos = Object.assign({}, pesos, { meteoro: (pesos.meteoro || 0) * 2 + 3 });
    const tipo = elegirTipo(pesos, a);
    const o = { tipo, x, y, x0: x, y0: y, z: -CFG.distanciaAparicion, t: 0, fase: f * TAU, extra: 0 };
    if (tipo === 'dron' || tipo === 'teleport') { o.radio = 0.85; o.extra = 4; }
    else if (tipo === 'ovni') { o.radio = 1.15; o.extra = 1; }
    else {
      o.tipo = 'meteoro';
      o.radio = 0.8 + f * 0.7;
      o.q = Q.normalizar([Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5, 1]);
      o.eje = V.norm([Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5]);
      o.vrot = 1 + Math.random() * 2;
      o.vari = (Math.random() * 3) | 0;
    }
    obs.push(o);
  }

  /** Muro de marcianos con hueco: hay que pasar por el hueco. */
  function formacion() {
    const r = J.rng, cols = 5, filas = 3;
    const h1 = Math.floor(r() * cols * filas), h2r = Math.floor(r() * cols * filas);
    const h2 = nivel < 6 && (!sector || sector.id < 4) ? h2r : -1;
    for (let j = 0; j < filas; j++) {
      for (let i = 0; i < cols; i++) {
        const k = j * cols + i;
        if (k === h1 || k === h2) continue;
        const x = -LX + (i + 0.5) * ((2 * LX) / cols);
        const y = -LY + (j + 0.5) * ((2 * LY) / filas);
        obs.push({ tipo: 'dron', formacion: true, x, y, x0: x, y0: y, z: -CFG.distanciaAparicion, t: k * 0.3, fase: 0, extra: 0, radio: 0.85 });
      }
    }
    J.emitir('aviso', '¡MURO DE MARCIANOS! Busca el hueco', 'peligro');
    GS.Sonido.alerta();
  }

  /** Láser horizontal con un hueco. En el último sector se mueve arriba y abajo. */
  function laser(desdeJefe) {
    const r = J.rng;
    const a = r(), b = r();
    const y = (a * 2 - 1) * LY * 0.85;
    const hueco = (b * 2 - 1) * (LX - 1.8);
    const mov = (sector && sector.id >= 4) || nivel >= 10 || desdeJefe ? 1.1 : 0;
    obs.push({ tipo: 'laser', x: 0, y, y0: y, z: desdeJefe ? jefe.z + 4 : -CFG.distanciaAparicion, t: 0, fase: a * TAU,
      hueco, anchoHueco: 3.4, mov, radio: 0.4, extra: desdeJefe ? 6 : 0 });
    GS.Sonido.laser();
  }

  function aparecerAnillo() {
    const r = J.rng;
    const x = (r() * 2 - 1) * (LX - 1.5), y = (r() * 2 - 1) * (LY - 1);
    obs.push({ tipo: 'anillo', x, y, z: -CFG.distanciaAparicion, t: 0, radio: 1.6, extra: 0 });
  }

  function aparecerCapsula() {
    const r = J.rng;
    const x = (r() * 2 - 1) * (LX - 1), y = (r() * 2 - 1) * (LY - 0.8);
    obs.push({ tipo: 'capsula', poder: GS.Poderes.azar('esquiva'), x, y, z: -CFG.distanciaAparicion, t: 0, radio: 0.7, extra: 0 });
  }

  function aparecerCristal() {
    const r = J.rng;
    const x = (r() * 2 - 1) * LX * 0.9, y = (r() * 2 - 1) * LY * 0.9;
    items.push({ x, y, z: -CFG.distanciaAparicion, t: 0, radio: 0.45 });
  }

  function disparoJefe(desvio = 0) {
    const origen = [jefe.x, jefe.y - 1.4, jefe.z];
    const obj = [U.clamp(nave.x + nave.vx * 0.25 + desvio, -LX, LX), nave.y + nave.vy * 0.25, 0];
    const rap = (vel + 10) * (jefe.fase === 3 ? 1.1 : 1);
    const dir = V.norm(V.sub(obj, origen));
    obs.push({ tipo: 'orbe', x: origen[0], y: origen[1], z: origen[2], vx: dir[0] * rap, vy: dir[1] * rap, vz: dir[2] * rap, t: 0, radio: 0.42, extra: 0 });
    GS.Sonido.orbe();
  }

  function llegaJefe(fases, dur) {
    jefesVistos++;
    const def = sector ? GS.Jefes.get(sector.id) : GS.Jefes.turno(jefesVistos);
    jefe = { def, x: 0, y: def.id === 'coloso' ? 4.4 : 5.2, z: -120, t: 0, dur, fases, fase: 1, tDisparo: 2.5, tLaser: 2, entrada: 0, golpe: 0,
      tRoca: 1.5, tCortina: 3, tSalto: 3, alfa: 1, saltando: 0, x0: 0, lado: 1, tRefuerzo: 4,
      vida: CFG.vidaJefeBase + CFG.vidaJefePorFase * fases }; // la vida solo importa con el control de cámara
    GS.Sonido.alerta();
    GS.Musica.tocar('jefe');
    J.emitir('aviso', '¡' + def.nombre + '! Aguanta ' + dur + ' segundos', 'peligro');
  }

  /** Roca que lanza el Rompe-rocas (se mueve con su propia velocidad, como los orbes). */
  function lanzarRoca(origen, obj, rap, radio) {
    const dir = V.norm(V.sub(obj, origen));
    obs.push({ tipo: 'roca', x: origen[0], y: origen[1], z: origen[2], vx: dir[0] * rap, vy: dir[1] * rap, vz: dir[2] * rap, t: 0,
      radio: radio || 0.9, extra: 0, vari: (Math.random() * 3) | 0, vrot: 1.5 + Math.random() * 2,
      q: Q.normalizar([Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5, 1]), eje: V.norm([Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5]) });
  }

  /** Fila de rocas u orbes a tu altura, con un hueco por donde pasar. */
  function filaConHueco(tipo) {
    const r = J.rng;
    const y = U.clamp(nave.y + (r() - 0.5) * 1.2, -LY, LY);
    const hueco = (r() * 2 - 1) * (LX - 1.8);
    const z = jefe.z + 4, rap = vel + 12;
    for (let x = -LX; x <= LX + 0.01; x += 1.45) {
      if (Math.abs(x - hueco) < 1.7) continue;
      if (tipo === 'roca') lanzarRoca([x, y, z], [x, y, 10], rap, 0.75);
      else obs.push({ tipo: 'orbe', x, y, z, vx: 0, vy: 0, vz: rap, t: 0, radio: 0.42, extra: 0 });
    }
    GS.Sonido.alerta();
  }

  /* ---------------- Actualización ---------------- */
  E.actualizar = function (dt) {
    C = J.capas();
    ajustarPantalla();
    if (J.estado === 'pausa') { actualizarCamara(); return; }
    const enJuego = J.estado === 'jugando';
    nave.t += dt;
    moverNave(dt);
    const hs = enJuego ? J.pasoSensacion(dt) : 1; // micro-pausa al golpear
    const lenta = GS.Poderes.escalaTiempo() * hs;
    const vFondo = (enJuego ? vel : 10) * lenta;
    for (const s of rayas) {
      s.z += vFondo * 1.4 * dt;
      if (s.z > 10) s.z -= 230;
    }
    sueloOffset = (sueloOffset + vFondo * dt) % 5;
    actualizarCamara();
    actualizarEfectos(dt * hs);
    if (!enJuego) return;

    const dtM = dt * lenta; // tiempo del mundo (la cámara lenta frena a los marcianos)
    J.tTotal += dt;
    if (J.modo === 'online' && J.duracion > 0) {
      J.tiempo = Math.max(0, J.tiempo - dt);
      if (J.tiempo <= 0) { J.terminar('tiempo'); return; }
    }
    if (finEn > 0) { finEn -= dt; if (finEn <= 0) { J.terminar('derrota'); return; } }
    if (victoriaEn > 0) { victoriaEn -= dt; if (victoriaEn <= 0) { J.terminar('victoria'); return; } }
    J.invul -= dt; J.flash -= dt;
    J.sacudida *= Math.exp(-dt * 7);
    impulsoT -= dt;
    impulsoEnfr = Math.max(0, impulsoEnfr - dt);
    if (J.comboT > 0) {
      J.comboT -= dt;
      if (J.comboT <= 0) { J.combo = 0; J.emitir('combo'); }
    }

    if (J.vivo && !J.tutorial) {
      tiempoVivo += dt;
      J.tSinDanio += dt;
      if (J.tSinDanio >= 60 && !J.sinDanioAvisado) { J.sinDanioAvisado = true; GS.Progreso.evento('sinDanio', 60); }
      const cfg = config();
      if (sector) {
        // Campaña: la intensidad sube hasta que llega la nave nodriza
        if (!jefe && !jefeSuperado) {
          tSector += dt;
          const f = Math.min(1, tSector / CFG.segundosSector);
          vel = cfg.vel * J.dif.velocidad * (1 + f * 0.25);
          if (tSector >= CFG.segundosSector) llegaJefe(cfg.jefeFases, 15 + cfg.jefeFases * 3);
          GS.Musica.nivel(1 + Math.floor(f * 2.5));
        }
      } else {
        const n = 1 + Math.floor((tiempoVivo + offsetNivel) / CFG.segundosPorNivel);
        if (n !== nivel) {
          nivel = n;
          J.oleada = n;
          tema = GS.Sectores.lista[Math.floor((n - 1) / 2) % GS.Sectores.total].tema;
          J.tema = tema;
          const conJefe = n % CFG.jefeCada === 0;
          J.emitir('oleada', n, conJefe);
          GS.Sonido.oleada();
          GS.Musica.nivel(Math.min(3, 1 + Math.floor(n / 3)));
          if (conJefe) llegaJefe(Math.min(3, 1 + Math.floor(n / 8)), 12);
        }
        vel = Math.min(CFG.velMax, (CFG.velBase + (nivel - 1) * CFG.velPorNivel)) * J.dif.velocidad;
      }

      // Puntos por sobrevivir
      acumPuntos += dt * 10 * nivel * J.dif.puntos * GS.Poderes.multPuntos() * (sector ? sector.id : 1);
      if (acumPuntos >= 1) { const p = Math.floor(acumPuntos); acumPuntos -= p; J.puntos += p; }
      tAvisoPuntos -= dt;
      if (tAvisoPuntos <= 0) { tAvisoPuntos = 0.2; J.emitir('puntos'); }

      const avance = sector ? Math.min(1, tSector / CFG.segundosSector) : Math.min(1, nivel / 10);
      const intervalo = Math.max(0.22, (sector ? cfg.intervalo * (1 - avance * 0.25) : 0.95 - nivel * 0.07)) * (jefe ? 1.8 : 1) / J.dif.velocidad;
      tSpawn -= dtM;
      while (tSpawn <= 0) { aparecer(); tSpawn += intervalo * J.rng.rango(0.7, 1.3); }
      tCristal -= dtM;
      while (tCristal <= 0) { aparecerCristal(); tCristal += J.rng.rango(1.8, 3.2); }
      tCapsula -= dtM;
      while (tCapsula <= 0) { aparecerCapsula(); tCapsula += J.rng.rango(13, 19) * (J.esReto('poderes') ? 0.5 : 1); }
      if (cfg.anillos) {
        tAnillo -= dtM;
        while (tAnillo <= 0) { aparecerAnillo(); tAnillo += J.rng.rango(5, 8); }
      }
      const cadaMuro = sector ? cfg.muros : nivel >= 3 ? 8.5 : 0;
      if (cadaMuro && !jefe) {
        tFormacion -= dtM;
        if (tFormacion <= 0) { formacion(); tFormacion = cadaMuro * J.rng.rango(0.85, 1.15); }
      }
      const cadaLaser = sector ? cfg.laseres : nivel >= 5 ? 7 : 0;
      if (cadaLaser && !jefe) {
        tLaser -= dtM;
        if (tLaser <= 0) { laser(false); tLaser = cadaLaser * J.rng.rango(0.85, 1.2); }
      }
      for (let i = ataques.length - 1; i >= 0; i--) {
        ataques[i] -= dt;
        if (ataques[i] <= 0) {
          ataques.splice(i, 1);
          const x = U.clamp(nave.x + U.rand(-1.5, 1.5), -LX, LX), y = U.clamp(nave.y + U.rand(-1, 1), -LY, LY);
          obs.push({ tipo: 'dron', x, y, x0: x, y0: y, z: -CFG.distanciaAparicion * 0.7, t: 0, fase: Math.random() * TAU, extra: 6, radio: 0.85 });
        }
      }
    }

    actualizarJefe(dt, dtM);
    disparosCamara(dt);

    // Marcianos y obstáculos
    const rN = CFG.radioNave;
    for (const e of obs) {
      e.t += dtM;
      const zPrev = e.z;
      if (e.tipo === 'orbe' || e.tipo === 'roca') {
        e.x += e.vx * dtM; e.y += e.vy * dtM; e.z += e.vz * dtM;
        if (e.tipo === 'roca') e.q = Q.normalizar(Q.mult(Q.eje(e.eje[0], e.eje[1], e.eje[2], e.vrot * dtM), e.q));
      } else {
        e.z += (vel + e.extra) * dtM;
        if (e.tipo === 'dron' && !e.formacion) {
          e.x = e.x0 + Math.sin(e.t * 2.6 + e.fase) * 0.7;
          e.y = e.y0 + Math.cos(e.t * 2.1 + e.fase) * 0.45;
        } else if (e.tipo === 'teleport') {
          if (!e.salto && e.z > -42) {
            // ¡Salta de lado!
            e.salto = true;
            explosion([e.x, e.y, e.z], 'teleport', 12);
            e.x0 = U.clamp(e.x0 + (e.x0 > nave.x ? -1 : 1) * U.rand(2, 3.2), -LX, LX);
            e.y0 = U.clamp(e.y0 + U.rand(-1, 1), -LY, LY);
            explosion([e.x0, e.y0, e.z], 'teleport', 12);
            GS.Sonido.teleport();
          }
          e.x = e.x0 + Math.sin(e.t * 2.6 + e.fase) * 0.4;
          e.y = e.y0;
        } else if (e.tipo === 'ovni') {
          e.x = U.clamp(e.x0 + Math.sin(e.t * 1.3 + e.fase) * 3.2, -LX - 1, LX + 1);
          e.y = e.y0 + Math.sin(e.t * 2 + e.fase) * 0.3;
        } else if (e.tipo === 'meteoro') {
          e.q = Q.normalizar(Q.mult(Q.eje(e.eje[0], e.eje[1], e.eje[2], e.vrot * dtM), e.q));
        } else if (e.tipo === 'laser' && e.mov) {
          e.y = U.clamp(e.y0 + Math.sin(e.t * 1.6 + e.fase) * e.mov * 1.6, -LY, LY);
        }
      }
      const cruzo = zPrev < 0 && e.z >= 0;
      if (e.tipo === 'laser') {
        if (cruzo && J.vivo) {
          const dy = Math.abs(nave.y - e.y), enHueco = Math.abs(nave.x - e.hueco) < e.anchoHueco / 2 - 0.35;
          if (dy < 0.75 && !enHueco) { if (choque(e)) { e.muerto = true; continue; } }
          else if (dy < 1.6 || enHueco) bonoPorPoco(e);
        }
      } else if (e.tipo === 'anillo' || e.tipo === 'capsula') {
        const dxy = Math.hypot(e.x - nave.x, e.y - nave.y);
        if (cruzo && J.vivo && dxy < (e.tipo === 'anillo' ? 1.3 : 1.35)) {
          e.muerto = true;
          if (e.tipo === 'anillo') pasarAnillo(e); else recogerCapsula(e);
          continue;
        }
        if (cruzo && e.tutorial) J.emitir('tutFallo', e.tipo);
      } else {
        const rs = e.radio + rN;
        const dxy = Math.hypot(e.x - nave.x, e.y - nave.y);
        const dist = cruzo ? dxy : Math.hypot(dxy, e.z);
        if (dist < rs && J.vivo && choque(e)) { e.muerto = true; continue; }
        if (cruzo && !e.cerca && dxy >= rs && dxy < rs + 1.1 && J.vivo) { e.cerca = true; bonoPorPoco(e); }
        if (cruzo && e.tutorial) J.emitir('tutPaso');
      }
      if (e.z > 12) e.muerto = true;
    }
    obs = obs.filter((e) => !e.muerto);

    // Cristales (el imán los atrae)
    const iman = GS.Poderes.activo('iman');
    for (const c of items) {
      c.t += dt;
      const zPrev = c.z;
      c.z += vel * dtM;
      if (iman && c.z > -28) {
        c.x = U.lerp(c.x, nave.x, 1 - Math.exp(-dt * 5));
        c.y = U.lerp(c.y, nave.y, 1 - Math.exp(-dt * 5));
      }
      const dxy = Math.hypot(c.x - nave.x, c.y - nave.y);
      const cruzo = zPrev < 0 && c.z >= 0;
      if (J.vivo && (cruzo ? dxy : Math.hypot(dxy, c.z)) < (iman ? 2 : 1.25)) { c.muerto = true; recoger(c); }
      if (c.z > 12) c.muerto = true;
    }
    items = items.filter((c) => !c.muerto);
  };

  function actualizarJefe(dt, dtM) {
    if (!jefe) return;
    jefe.t += dt;
    jefe.entrada = Math.min(1, jefe.entrada + dt * 0.5);
    const def = jefe.def;
    if (def.id === 'medusa') moverMedusa(dt);
    else if (def.id === 'coloso') jefe.x = Math.sin(jefe.t * (0.4 + jefe.fase * 0.1)) * LX * 0.4;
    else if (def.id === 'emperador') jefe.x = Math.sin(jefe.t * 0.35) * LX * 0.45;
    else jefe.x = Math.sin(jefe.t * (0.6 + jefe.fase * 0.15)) * LX * 0.55;
    if (jefe.t < jefe.dur) {
      jefe.z = -120 + 78 * U.easeOutBack(jefe.entrada); // llega volando hasta z = -42
      const fase = Math.min(jefe.fases, 1 + Math.floor((jefe.t / jefe.dur) * jefe.fases));
      if (fase !== jefe.fase) {
        jefe.fase = fase;
        J.sacudida = 0.6;
        GS.Sonido.alerta();
        GS.Musica.nivel(3);
        J.congelar(0.1);
        J.vibrar('jefeFase');
        J.emitir('aviso', def.esquiva[fase] || def.esquiva[3], 'peligro');
      }
      if (!J.vivo) return;
      const cad = J.dif.cadenciaEnemiga;
      if (def.id === 'coloso') ataqueColoso(dtM, cad);
      else if (def.id === 'medusa') ataqueMedusa(dtM, cad);
      else if (def.id === 'emperador') ataqueEmperador(dtM, cad);
      else {
        jefe.tDisparo -= dtM;
        if (jefe.tDisparo <= 0) {
          if (jefe.fase === 1) { disparoJefe(0); jefe.tDisparo = 1.0 * cad; }
          else if (jefe.fase === 2) { [-1.6, 0, 1.6].forEach((d) => disparoJefe(d)); jefe.tDisparo = 1.4 * cad; }
          else { disparoJefe(0); jefe.tDisparo = 1.6 * cad; }
        }
        if (jefe.fase === 3) {
          jefe.tLaser -= dtM;
          if (jefe.tLaser <= 0) { laser(true); jefe.tLaser = 2.2 * cad; }
        }
      }
    } else {
      jefe.y += dt * 6;
      jefe.z -= dt * 30;
      if (jefe.z < -160) jefeVencido(false);
    }
  }

  /** El Rompe-rocas: te lanza rocas y luego filas de rocas con un hueco. */
  function ataqueColoso(dtM, cad) {
    jefe.tRoca -= dtM;
    if (jefe.tRoca <= 0) {
      const origen = [jefe.x, jefe.y - 0.5, jefe.z + 2];
      const obj = [U.clamp(nave.x + nave.vx * 0.3, -LX, LX), U.clamp(nave.y + nave.vy * 0.3, -LY, LY), 0];
      lanzarRoca(origen, obj, vel + 9);
      if (jefe.fase >= 3) lanzarRoca(origen, [U.clamp(obj[0] + U.rand(-3, 3), -LX, LX), obj[1], 0], vel + 9);
      jefe.tRoca = (jefe.fase === 1 ? 1.25 : 1.6) * cad;
    }
    if (jefe.fase >= 2) {
      jefe.tCortina -= dtM;
      if (jefe.tCortina <= 0) { filaConHueco('roca'); jefe.tCortina = (jefe.fase === 3 ? 2.6 : 3.4) * cad; }
    }
  }

  /** La Reina de la nebulosa: salta de lado a lado y lanza anillos y cortinas de plasma. */
  function moverMedusa(dt) {
    jefe.tSalto -= dt;
    if (!jefe.saltando && jefe.tSalto <= 0) jefe.saltando = 1;
    if (jefe.saltando === 1) {
      jefe.alfa = Math.max(0, jefe.alfa - dt * 3.5);
      if (jefe.alfa <= 0) {
        explosion([jefe.x, jefe.y, jefe.z], 'teleport', 18);
        jefe.x0 = U.clamp(-Math.sign(jefe.x0 || 1) * U.rand(0.3, 0.6) * LX, -LX * 0.6, LX * 0.6);
        jefe.saltando = 2;
        GS.Sonido.teleport();
      }
    } else if (jefe.saltando === 2) {
      jefe.alfa = Math.min(1, jefe.alfa + dt * 3);
      if (jefe.alfa >= 1) { jefe.saltando = 0; jefe.tSalto = jefe.fase === 3 ? 1.8 : jefe.fase === 2 ? 2.6 : 3.4; }
    }
    jefe.x = U.lerp(jefe.x, jefe.x0 + Math.sin(jefe.t * 1.3) * 0.8, 1 - Math.exp(-dt * 8));
  }

  function ataqueMedusa(dtM, cad) {
    if (jefe.alfa < 0.9) return;
    jefe.tDisparo -= dtM;
    if (jefe.tDisparo <= 0) {
      // Anillo de orbes alrededor tuyo (quédate quieto) y luego uno directo (muévete)
      const origen = [jefe.x, jefe.y - 0.8, jefe.z + 2], rap = vel + 10, k = 7;
      for (let i = 0; i < k; i++) {
        const a = (i / k) * TAU;
        const obj = [nave.x + Math.cos(a) * 2.5, nave.y + Math.sin(a) * 2.0, 0];
        const dir = V.norm(V.sub(obj, origen));
        obs.push({ tipo: 'orbe', x: origen[0], y: origen[1], z: origen[2], vx: dir[0] * rap, vy: dir[1] * rap, vz: dir[2] * rap, t: 0, radio: 0.42, extra: 0 });
      }
      GS.Sonido.orbe();
      jefe.directo = 0.7;
      jefe.tDisparo = (jefe.fase === 1 ? 2.6 : 2.3) * cad;
    }
    if (jefe.directo > 0) { jefe.directo -= dtM; if (jefe.directo <= 0) disparoJefe(0); }
    if (jefe.fase >= 2) {
      jefe.tCortina -= dtM;
      if (jefe.tCortina <= 0) { filaConHueco('orbe'); jefe.tCortina = (jefe.fase === 3 ? 2.4 : 3.2) * cad; }
    }
  }

  /** Zorp, el emperador: cañones gemelos, láseres, refuerzos y al final todo junto. */
  function ataqueEmperador(dtM, cad) {
    jefe.tDisparo -= dtM;
    if (jefe.tDisparo <= 0) {
      jefe.lado = -jefe.lado;
      const centro = jefe.x;
      jefe.x = centro + jefe.lado * 2.4; // dispara desde el cañón de ese lado
      if (jefe.fase === 3) [-1.4, 0, 1.4].forEach((d) => disparoJefe(d));
      else disparoJefe(jefe.lado * 0.4);
      jefe.x = centro;
      jefe.tDisparo = (jefe.fase === 1 ? 0.75 : jefe.fase === 2 ? 1.0 : 1.2) * cad;
    }
    if (jefe.fase >= 2) {
      jefe.tLaser -= dtM;
      if (jefe.tLaser <= 0) { laser(true); jefe.tLaser = (jefe.fase === 3 ? 1.9 : 2.6) * cad; }
      jefe.tRefuerzo -= dtM;
      if (jefe.tRefuerzo <= 0) {
        jefe.tRefuerzo = 5 * cad;
        [-1, 1].forEach((l) => {
          const x = U.clamp(nave.x + l * 1.8, -LX, LX), y = U.clamp(nave.y + U.rand(-1, 1), -LY, LY);
          obs.push({ tipo: 'dron', x, y, x0: x, y0: y, z: jefe.z + 6, t: 0, fase: l, extra: 6, radio: 0.85 });
        });
      }
    }
  }

  /** El jefe se fue (sobreviviste) o lo derribaste con la cámara (bonus). */
  function jefeVencido(derribado) {
    const j = jefe;
    jefe = null;
    if (!J.vivo) return;
    jefeSuperado = true;
    GS.Progreso.evento('jefeEsquiva');
    const mult = sector ? sector.id : 1;
    let pts = J.sumarPuntos(PUNTOS.jefe * mult, false);
    if (derribado) {
      J.congelar(0.18);
      J.vibrar('jefeMuerto');
      pts += J.sumarPuntos(PUNTOS.jefeDerribado * mult, false);
      explosion([j.x, j.y, j.z], 'nave', 90);
      explosion([j.x, j.y, j.z], 'orbe', 40);
      J.sacudida = 1.2;
      J.flash = 0.4;
      J.flashColor = '255,210,63';
      GS.Sonido.explosion(true);
      // Sus disparos y láseres desaparecen con ella
      obs.forEach((e) => { if (e.tipo === 'orbe' || e.tipo === 'roca' || (e.tipo === 'laser' && e.extra === 6)) e.muerto = true; });
      J.emitir('aviso', '' + j.def.muerte + ' +' + pts, 'exito');
    } else {
      const quien = { nodriza: 'AL GUARDIÁN LUNAR', coloso: 'AL ROMPE-ROCAS', medusa: 'A LA REINA', emperador: 'A ZORP' }[j.def.id];
      J.emitir('aviso', '¡SOBREVIVISTE ' + quien + '! +' + pts, 'exito');
    }
    GS.Musica.tocar('juego');
    if (sector) victoriaEn = 1.8;
  }

  function moverNave(dt) {
    // Control con cámara: la nave va a donde está tu cuerpo
    if (E.camara && GS.Cuerpo && GS.Cuerpo.persona && J.estado !== 'pausa') {
      const k = sens();
      nave.tx = U.clamp(GS.Cuerpo.x * LX * k, -LX, LX);
      nave.ty = U.clamp(GS.Cuerpo.y * LY * k, -LY, LY);
    }
    const kx = (teclas.der ? 1 : 0) - (teclas.izq ? 1 : 0);
    const ky = (teclas.arriba ? 1 : 0) - (teclas.abajo ? 1 : 0);
    if (kx || ky) {
      nave.tx = U.clamp(nave.tx + kx * 13 * dt * sens(), -LX, LX);
      nave.ty = U.clamp(nave.ty + ky * 10 * dt * sens(), -LY, LY);
    }
    const k = 80, amort = 17.9;
    nave.vx += ((nave.tx - nave.x) * k - nave.vx * amort) * dt;
    nave.vy += ((nave.ty - nave.y) * k - nave.vy * amort) * dt;
    nave.tx = U.clamp(nave.tx, -LX, LX);
    nave.ty = U.clamp(nave.ty, -LY, LY);
    nave.x = U.clamp(nave.x + nave.vx * dt, -LX, LX);
    nave.y = U.clamp(nave.y + nave.vy * dt, -LY, LY);
  }

  function actualizarCamara() {
    camPos = [nave.x * seguir, nave.y * 0.45 + altCam, distCam];
    const obj = [nave.x * 0.8, nave.y * 0.75 + 0.15, -30];
    const d = V.norm(V.sub(obj, camPos));
    const yaw = Math.atan2(-d[0], -d[2]), pitch = Math.asin(U.clamp(d[1], -1, 1));
    const roll = U.clamp(-nave.vx * 0.006, -0.12, 0.12);
    camQ = Q.mult(Q.eje(0, 1, 0, yaw), Q.mult(Q.eje(1, 0, 0, pitch), Q.eje(0, 0, 1, roll)));
    camInv = Q.conj(camQ);
  }

  /** Ángulo en pantalla desde tu nave hacia lo que te pegó (null si fue de frente). */
  function anguloChoque(e) {
    const dx = e.x - nave.x, dy = -(e.y - nave.y);
    return Math.hypot(dx, dy) < 0.35 ? null : Math.atan2(dy, dx);
  }

  function choque(e) {
    if (J.invul > 0 || impulsoT > 0) return false; // atraviesas sin daño
    if (GS.Poderes.usarEscudo()) {
      J.marcarGolpe(anguloChoque(e), '56,248,255');
      J.vibrar('escudo');
      J.invul = 1;
      J.flash = 0.35;
      J.flashColor = '56,248,255';
      GS.Sonido.escudo();
      textos.push({ txt: '¡ESCUDO!', c: '#38f8ff', t: 0, vida: 0.9, x: nave.x, y: nave.y + 1 });
      explosion([e.x, e.y, Math.max(e.z, -1)], e.tipo, 16);
      return true;
    }
    if (J.tutorial) { J.flash = 0.35; J.flashColor = '255,0,40'; GS.Sonido.danio(); J.invul = 1; return true; }
    J.vidas--;
    J.vidasPerdidas++;
    J.tSinDanio = 0;
    J.invul = 1.6;
    J.flash = 0.55;
    J.flashColor = '255,0,40';
    J.sacudida = 1.1;
    J.marcarGolpe(anguloChoque(e));
    J.congelar(0.09);
    J.vibrar('golpe');
    if (J.combo) { J.combo = 0; J.comboT = 0; J.emitir('combo'); }
    explosion([e.x, e.y, Math.max(e.z, -1)], e.tipo, 26);
    GS.Sonido.danio();
    GS.Sonido.explosion(false);
    J.emitir('vidas');
    if (J.vidas <= 0) {
      J.vivo = false;
      explosion([nave.x, nave.y, 0], 'nave', 60);
      GS.Sonido.explosion(true);
      J.emitir('muerte');
      if (J.modo === 'solo') finEn = 1.6;
    }
    return true;
  }

  function sumarCombo() {
    J.combo = J.comboT > 0 ? J.combo + 1 : 1;
    J.comboT = 2.5;
    GS.Progreso.evento('combo', J.combo);
    if (J.combo >= 3) GS.Sonido.combo(Math.min(J.combo, 12));
    J.emitir('combo');
    if (J.modo === 'online') {
      J.carga++;
      if (J.carga >= J.CONFIG.killsParaAtaque) { J.carga = 0; J.emitir('ataque', 3); }
    }
  }

  function bonoPorPoco(e) {
    if (e) e.cerca = true;
    porPoco++;
    J.vibrar('porPoco');
    GS.Progreso.evento('porPoco', porPoco);
    sumarCombo();
    const pts = J.sumarPuntos(PUNTOS.porPoco, true);
    textos.push({ txt: '¡POR POCO! +' + pts, c: '#38f8ff', t: 0, vida: 0.9, x: nave.x, y: nave.y + 0.9 });
    GS.Sonido.porPoco();
  }

  function pasarAnillo(e) {
    anillos++;
    J.vibrar('anillo');
    sumarCombo();
    const pts = J.sumarPuntos(PUNTOS.anillo, true);
    textos.push({ txt: '¡ANILLO! +' + pts, c: '#ffd23f', t: 0, vida: 0.9, x: e.x, y: e.y + 1.2 });
    explosion([e.x, e.y, 0], 'anillo', 20);
    GS.Sonido.anillo();
    if (J.tutorial) J.emitir('tutAnillo');
  }

  function recogerCapsula(e) {
    const d = GS.Poderes.TIPOS[e.poder];
    explosion([e.x, e.y, 0], 'cristal', 18);
    GS.Poderes.activar(e.poder);
    textos.push({ txt: d.nombre.toUpperCase(), c: d.css, t: 0, vida: 1.1, x: e.x, y: e.y + 1 });
    if (J.tutorial) J.emitir('tutPoder');
  }

  function recoger(c) {
    cristales++;
    GS.Progreso.evento('cristal');
    sumarCombo();
    const pts = J.sumarPuntos(PUNTOS.cristal, true);
    textos.push({ txt: '+' + pts, c: '#7CFF4F', t: 0, vida: 0.8, x: c.x, y: c.y + 0.6 });
    explosion([c.x, c.y, 0], 'cristal', 14);
    GS.Sonido.cristal();
    if (cristales % CFG.cristalesPorVida === 0 && J.vidas < J.vidasMax) {
      J.vidas++;
      J.emitir('vidas');
      J.emitir('aviso', '¡' + CFG.cristalesPorVida + ' cristales! +1 ❤︎', 'exito');
    }
    if (J.tutorial) J.emitir('tutCristal');
  }

  /* ---------------- Efectos ---------------- */
  const COLORES = {
    dron: ['#7CFF4F', '#ffd23f', '#b6ff8f'], ovni: ['#7CFF4F', '#38f8ff', '#ffffff'],
    meteoro: ['#ffb347', '#ff6a2b', '#8a6a50'], orbe: ['#ff3df2', '#ffb3f8'],
    nave: ['#38f8ff', '#ffffff', '#ff3df2', '#ffd23f'], cristal: ['#7CFF4F', '#c8ffe8'],
    teleport: ['#b68cff', '#ffffff'], laser: ['#ff3355', '#ffb0b8'], anillo: ['#ffd23f', '#ffffff']
  };
  function explosion(p, tipo, n) {
    const cols = COLORES[tipo] || ['#ffffff'];
    if (GS.Ajustes.calidadBaja()) n = Math.ceil(n * 0.45);
    for (let i = 0; i < n; i++) {
      const d = V.norm([Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1]);
      parts.push({ p: p.slice(), v: V.esc(d, 3 + Math.random() * 5), t: 0, vida: 0.5 + Math.random() * 0.5, tam: 0.1 + Math.random() * 0.12, c: cols[(Math.random() * cols.length) | 0] });
    }
  }
  function actualizarEfectos(dt) {
    const arrastre = J.estado === 'jugando' ? vel * 0.5 * GS.Poderes.escalaTiempo() : 0;
    for (const pa of parts) {
      pa.t += dt;
      pa.p = V.add(pa.p, V.esc(pa.v, dt));
      pa.p[2] += arrastre * dt;
      pa.v = V.esc(pa.v, Math.exp(-dt * 2.5));
    }
    parts = parts.filter((pa) => pa.t < pa.vida);
    for (const tx of textos) { tx.t += dt; tx.y += dt * 1.2; }
    textos = textos.filter((tx) => tx.t < tx.vida);
    for (const r of rayosJ) r.t += dt;
    rayosJ = rayosJ.filter((r) => r.t < r.vida);
    if (jefe && jefe.golpe > 0) jefe.golpe -= dt;
  }

  /* ---------------- Dibujo ---------------- */
  function proyectar(p) {
    const v = Q.rotar(camInv, [p[0] - camPos[0], p[1] - camPos[1], p[2] - camPos[2]]), z = -v[2];
    if (z < 0.15) return { detras: true };
    return { detras: false, x: C.W / 2 + (v[0] / z) * FE, y: C.H / 2 - (v[1] / z) * FE, k: FE / z, z };
  }

  function orientacionNave() {
    const roll = U.clamp(-nave.vx * 0.05, -0.75, 0.75);
    const pitch = U.clamp(nave.vy * 0.025, -0.35, 0.35);
    const yaw = U.clamp(-nave.vx * 0.015, -0.3, 0.3);
    return Q.mult(Q.eje(0, 1, 0, yaw), Q.mult(Q.eje(1, 0, 0, pitch), Q.eje(0, 0, 1, roll)));
  }

  function naveVisible() {
    if (!J.vivo && J.estado !== 'cuenta') return false;
    return !(J.invul > 0 && Math.floor(J.invul * 10) % 2 === 0);
  }

  const COLORES_3D = {
    teleport: { cabeza: [0.62, 0.42, 1], cuerpo: [0.36, 0.2, 0.7], antena: [0.4, 0.95, 1] },
    fase: { 2: { aro: [1, 0.55, 0.15], nucleo: [1, 0.6, 0.2] }, 3: { aro: [1, 0.15, 0.2], ojo: [1, 0.85, 0.85], nucleo: [1, 0.2, 0.25] } }
  };

  E.dibujar = function () {
    C = J.capas();
    ajustarPantalla();
    const { ctx, fctx, W, H, DPR } = C;
    let sx = 0, sy = 0;
    if (J.sacudida > 0.02) { const s = J.sacudida * 9; sx = U.rand(-s, s); sy = U.rand(-s, s); }

    // 1) Fondo: espacio a toda velocidad
    fctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    dibujarFondo(fctx, W, H, sx, sy);

    // 2) Modelos 3D
    const M3 = GS.Motor3D, M = GS.Modelos;
    if (J.usar3D && M3.listo) {
      M3.comenzar(camInv, camPos, sx, sy, FE);
      if (jefe) {
        const col = Object.assign({}, COLORES_3D.fase[jefe.fase] || {});
        if (jefe.golpe > 0) { col.aro = [1, 1, 1]; col.nucleo = [1, 1, 1]; } // destello al recibir un disparo
        const opcJ = { t: jefe.t, colores: col };
        if (jefe.alfa < 1) opcJ.alfa = jefe.alfa;
        M3.dibujarModelo(M[jefe.def.modelo] || M.jefe, [jefe.x, jefe.y, jefe.z], Q.eje(1, 0, 0, 0.35), 4.2, opcJ);
      }
      for (const e of obs) {
        const pos = [e.x, e.y, e.z];
        if (e.tipo === 'dron') M3.dibujarModelo(M.dron, pos, Q.mult(Q.eje(1, 0, 0, 0.15), Q.eje(0, 0, 1, Math.sin(e.t * 5) * 0.2)), e.radio, { t: e.t });
        else if (e.tipo === 'teleport') M3.dibujarModelo(M.dron, pos, Q.mult(Q.eje(1, 0, 0, 0.15), Q.eje(0, 0, 1, Math.sin(e.t * 7) * 0.25)), e.radio, { t: e.t, colores: COLORES_3D.teleport });
        else if (e.tipo === 'ovni') M3.dibujarModelo(M.ovni, pos, Q.mult(Q.eje(1, 0, 0, 0.3), Q.eje(0, 0, 1, Math.cos(e.t * 1.3 + e.fase) * 0.25)), e.radio, { t: e.t });
        else if (e.tipo === 'meteoro' || e.tipo === 'roca') M3.dibujarModelo(M.meteoro[e.vari], pos, e.q, e.radio, { t: e.t });
        else if (e.tipo === 'orbe') M3.dibujarModelo(M.orbe, pos, Q.identidad(), e.radio, { t: e.t });
        else if (e.tipo === 'anillo') M3.dibujarModelo(M.anillo, pos, Q.eje(0, 0, 1, e.t * 0.8), 1, { t: e.t });
        else if (e.tipo === 'capsula') {
          const d = GS.Poderes.TIPOS[e.poder];
          M3.dibujarModelo(M.capsula, pos, Q.eje(0, 1, 0, e.t), e.radio, { t: e.t, colores: { nucleo: d.rgb, aro: d.rgb } });
        } else if (e.tipo === 'laser') dibujarLaser3D(M3, M, e);
      }
      for (const c of items) M3.dibujarModelo(M.cristal, [c.x, c.y, c.z], Q.identidad(), 1, { t: c.t });
      if (naveVisible()) {
        const posNave = [nave.x, nave.y + Math.sin(nave.t * 2) * 0.05, 0];
        M3.dibujarModelo(M.nave, posNave, orientacionNave(), 0.9, { t: nave.t, colores: GS.Progreso.nave().colores });
        if (GS.Poderes.activo('escudo')) M3.dibujarModelo(M.escudo, posNave, Q.eje(0, 1, 0, nave.t), 1.35, { t: nave.t, alfa: 0.9 });
      }
      M3.terminar();
    }

    // 3) Capa de arriba
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(sx, sy);
    if (!J.usar3D) dibujar2D(ctx);
    dibujarMarcadores(ctx);
    dibujarBrillos(ctx);
    dibujarParticulas(ctx);
    dibujarTextos(ctx);
    ctx.restore();
    if (J.estado === 'jugando' || J.estado === 'pausa') dibujarHUD(ctx, W, H);
  };

  function tramosLaser(e) {
    const izq = -LX - 1.5, der = LX + 1.5, a = e.hueco - e.anchoHueco / 2, b = e.hueco + e.anchoHueco / 2;
    return [[izq, a], [b, der]].filter((t) => t[1] - t[0] > 0.1);
  }

  function dibujarLaser3D(M3, M, e) {
    for (const [a, b] of tramosLaser(e)) {
      const largo = b - a, centro = (a + b) / 2;
      M3.dibujarModelo(M.laser, [centro, e.y, e.z], Q.identidad(), [largo, 1, 1], { t: e.t });
      M3.dibujarModelo(M.emisor, [a, e.y, e.z], Q.identidad(), 1, { t: e.t });
      M3.dibujarModelo(M.emisor, [b, e.y, e.z], Q.identidad(), 1, { t: e.t });
    }
  }

  function linea3D(g, a, b) {
    const ca = Q.rotar(camInv, V.sub(a, camPos)), cb = Q.rotar(camInv, V.sub(b, camPos));
    let p = ca, q = cb;
    const cerca = -0.3;
    if (p[2] > cerca && q[2] > cerca) return;
    if (p[2] > cerca) { const t = (cerca - p[2]) / (q[2] - p[2]); p = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, cerca]; }
    else if (q[2] > cerca) { const t = (cerca - q[2]) / (p[2] - q[2]); q = [q[0] + (p[0] - q[0]) * t, q[1] + (p[1] - q[1]) * t, cerca]; }
    g.moveTo(C.W / 2 + (p[0] / -p[2]) * FE, C.H / 2 - (p[1] / -p[2]) * FE);
    g.lineTo(C.W / 2 + (q[0] / -q[2]) * FE, C.H / 2 - (q[1] / -q[2]) * FE);
  }

  function dibujarFondo(g, W, H, sx, sy) {
    const t = tema || GS.Sectores.lista[0].tema;
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, t.cielo[0]);
    gr.addColorStop(0.55, t.cielo[1]);
    gr.addColorStop(1, '#1d0a2c');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    g.save();
    g.translate(sx, sy);
    // Sol de neón en el horizonte
    const sol = proyectar([0, -4, -400]);
    if (!sol.detras) {
      const r = Math.min(W, H) * 0.5;
      const gs = g.createRadialGradient(sol.x, sol.y, 0, sol.x, sol.y, r);
      gs.addColorStop(0, t.sol + '0.5)');
      gs.addColorStop(0.35, 'rgba(160,60,255,0.16)');
      gs.addColorStop(1, 'rgba(60,20,120,0)');
      g.fillStyle = gs;
      g.fillRect(sol.x - r, sol.y - r, r * 2, r * 2);
    }
    // Estrellas estiradas por la velocidad
    const largo = 0.6 + (J.estado === 'jugando' ? vel * GS.Poderes.escalaTiempo() : 10) * 0.09;
    g.lineCap = 'round';
    for (const s of rayas) {
      const a = proyectar([s.x, s.y, s.z]), b = proyectar([s.x, s.y, s.z - largo]);
      if (a.detras || b.detras) continue;
      const alfa = U.clamp(1 - -s.z / 220, 0.1, 1);
      g.strokeStyle = 'rgba(190,225,255,' + alfa.toFixed(2) + ')';
      g.lineWidth = Math.max(1, Math.min(3, a.k * 0.06));
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.stroke();
    }
    // Piso de neón que avanza
    g.strokeStyle = t.suelo + '0.3)';
    g.lineWidth = 1.2;
    g.beginPath();
    const y = -6.5;
    for (let x = -40; x <= 40; x += 4) linea3D(g, [x, y, -220], [x, y, 12]);
    for (let z = -220 + sueloOffset; z <= 12; z += 5) linea3D(g, [-40, y, z], [40, y, z]);
    g.stroke();
    g.restore();
  }

  /** Dónde va a pasar cada marciano cercano: el círculo rojo te dice si te va a pegar. */
  function dibujarMarcadores(g) {
    if (J.estado !== 'jugando' || !J.vivo) return;
    const rN = CFG.radioNave;
    for (const e of obs) {
      if (e.z < -32 || e.z > -0.5) continue;
      const a = U.clamp(1 - -e.z / 32, 0, 1);
      if (e.tipo === 'laser') {
        // Línea roja en tu plano, con el hueco marcado
        const dy = Math.abs(nave.y - e.y), enHueco = Math.abs(nave.x - e.hueco) < e.anchoHueco / 2 - 0.35;
        const peligro = dy < 0.75 && !enHueco;
        g.strokeStyle = peligro ? 'rgba(255,70,60,' + (0.35 + a * 0.6).toFixed(2) + ')' : 'rgba(255,255,255,' + (a * 0.3).toFixed(2) + ')';
        g.lineWidth = peligro ? 3 : 1.5;
        g.beginPath();
        for (const [x1, x2] of tramosLaser(e)) {
          const p1 = proyectar([x1, e.y, 0]), p2 = proyectar([x2, e.y, 0]);
          if (p1.detras || p2.detras) continue;
          g.moveTo(p1.x, p1.y);
          g.lineTo(p2.x, p2.y);
        }
        g.stroke();
        continue;
      }
      if (e.tipo === 'anillo' || e.tipo === 'capsula') continue;
      const rs = e.radio + rN;
      const dxy = Math.hypot(e.x - nave.x, e.y - nave.y);
      if (dxy > rs + 2.5) continue;
      const p = proyectar([e.x, e.y, 0]);
      if (p.detras) continue;
      // Solo se avisa lo que te va a pegar (círculo rojo). Lo que pasa cerca no se marca: mareaba.
      if (dxy >= rs) continue;
      g.strokeStyle = 'rgba(255,70,60,' + (0.35 + a * 0.6).toFixed(2) + ')';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(p.x, p.y, e.radio * p.k, 0, TAU);
      g.stroke();
    }
    g.setLineDash([]);
  }

  function dibujarBrillos(g) {
    const SP = GS.Sprites;
    g.globalCompositeOperation = 'lighter';
    for (const e of obs) {
      const p = proyectar([e.x, e.y, e.z]);
      if (p.detras) continue;
      const r = e.radio * p.k;
      if (e.tipo === 'orbe') { const w = r * 4.2; g.drawImage(SP.orbe, p.x - w / 2, p.y - w / 2, w, w); }
      else if (e.tipo === 'meteoro' || e.tipo === 'roca') { const w = r * 3; g.globalAlpha = 0.35; g.drawImage(SP.brilloFuego, p.x - w / 2, p.y - w / 2, w, w); g.globalAlpha = 1; }
      else if (e.tipo === 'ovni') { const w = r * 2.2; g.globalAlpha = 0.5; g.drawImage(SP.brilloVerde, p.x - w / 2, p.y - w * 0.05, w, w * 0.6); g.globalAlpha = 1; }
      else if (e.tipo === 'capsula') { const w = r * 3.4; g.globalAlpha = 0.65; g.drawImage(SP.brilloVerde, p.x - w / 2, p.y - w / 2, w, w); g.globalAlpha = 1; }
      else if (e.tipo === 'laser') {
        g.strokeStyle = 'rgba(255,60,80,0.45)';
        g.lineWidth = Math.max(2, 0.5 * p.k);
        g.lineCap = 'round';
        g.beginPath();
        for (const [x1, x2] of tramosLaser(e)) {
          const p1 = proyectar([x1, e.y, e.z]), p2 = proyectar([x2, e.y, e.z]);
          if (p1.detras || p2.detras) continue;
          g.moveTo(p1.x, p1.y);
          g.lineTo(p2.x, p2.y);
        }
        g.stroke();
      }
    }
    for (const c of items) {
      const p = proyectar([c.x, c.y, c.z]);
      if (p.detras) continue;
      const w = p.k * 1.6;
      g.globalAlpha = 0.6;
      g.drawImage(SP.brilloVerde, p.x - w / 2, p.y - w / 2, w, w);
      g.globalAlpha = 1;
    }
    // Láseres de tus disparos con la mano
    g.lineCap = 'round';
    for (const r of rayosJ) {
      const a = proyectar(r.a), b = proyectar(r.b);
      if (a.detras || b.detras) continue;
      const al = 1 - r.t / r.vida;
      g.strokeStyle = 'rgba(' + r.c + ',' + (0.85 * al).toFixed(2) + ')';
      g.lineWidth = 7 * al + 2;
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,' + (0.9 * al).toFixed(2) + ')';
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
    }
    // Estela de la nave durante el impulso
    if (impulsoT > 0 && naveVisible()) {
      const a = proyectar([nave.x, nave.y, 0]), b = proyectar([nave.x - nave.vx * 0.06, nave.y - nave.vy * 0.06, 2]);
      if (!a.detras && !b.detras) {
        g.strokeStyle = 'rgba(56,248,255,0.55)';
        g.lineWidth = a.k * 0.9;
        g.lineCap = 'round';
        g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(a.x, a.y); g.stroke();
      }
    }
    g.globalCompositeOperation = 'source-over';
    // Íconos de las cápsulas
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const e of obs) {
      if (e.tipo !== 'capsula') continue;
      const p = proyectar([e.x, e.y, e.z]);
      if (p.detras) continue;
      J.dibujarIconoPoder(g, GS.Poderes.TIPOS[e.poder], p.x, p.y, e.radio * p.k);
    }
  }

  function dibujarParticulas(g) {
    g.globalCompositeOperation = 'lighter';
    for (const pa of parts) {
      const p = proyectar(pa.p);
      if (p.detras) continue;
      const a = 1 - pa.t / pa.vida;
      g.globalAlpha = a;
      g.fillStyle = pa.c;
      g.beginPath();
      g.arc(p.x, p.y, Math.max(1, pa.tam * p.k * (0.5 + a * 0.5)), 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  function dibujarTextos(g) {
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const tx of textos) {
      const p = proyectar([tx.x, tx.y, tx.z || 0]);
      if (p.detras) continue;
      g.globalAlpha = 1 - tx.t / tx.vida;
      g.font = '800 20px Orbitron, sans-serif';
      g.lineWidth = 4;
      g.strokeStyle = 'rgba(0,0,0,0.6)';
      g.strokeText(tx.txt, p.x, p.y);
      g.fillStyle = tx.c;
      g.fillText(tx.txt, p.x, p.y);
    }
    g.globalAlpha = 1;
  }

  /** Respaldo si no hay WebGL: los mismos objetos con dibujos 2D. */
  function dibujar2D(g) {
    const SP = GS.Sprites;
    const lista = [];
    if (jefe) lista.push({ tipo: 'jefe', x: jefe.x, y: jefe.y, z: jefe.z, radio: 4.2, t: jefe.t });
    obs.forEach((e) => lista.push(e));
    items.forEach((c) => lista.push({ tipo: 'cristal', x: c.x, y: c.y, z: c.z, radio: 0.45, t: c.t }));
    lista.sort((a, b) => a.z - b.z);
    for (const e of lista) {
      const p = proyectar([e.x, e.y, e.z]);
      if (p.detras) continue;
      const r = e.radio * p.k;
      let sp = null, w = 0, h = 0;
      if (e.tipo === 'dron' || e.tipo === 'teleport') { sp = SP.dron[((e.t * 12) | 0) % 2]; w = h = r * 2.6; }
      else if (e.tipo === 'ovni') { sp = SP.ovni[((e.t * 4) | 0) % 2]; w = r * 2.5; h = w * (sp.height / sp.width); }
      else if (e.tipo === 'jefe') { sp = SP.jefe; w = r * 2.4; h = w * (sp.height / sp.width); }
      else if (e.tipo === 'meteoro' || e.tipo === 'roca') { sp = SP.meteoro[e.vari]; w = h = r * 2.6; }
      else if (e.tipo === 'orbe' || e.tipo === 'capsula') { sp = SP.orbe; w = h = r * 3.2; }
      if (sp) { g.drawImage(sp, p.x - w / 2, p.y - h / 2, w, h); continue; }
      if (e.tipo === 'anillo') {
        g.strokeStyle = '#ffd23f';
        g.lineWidth = Math.max(2, 0.2 * p.k);
        g.beginPath(); g.arc(p.x, p.y, r, 0, TAU); g.stroke();
        continue;
      }
      if (e.tipo === 'laser') continue; // se dibuja en los brillos
      g.fillStyle = '#7CFF4F';
      g.beginPath();
      g.moveTo(p.x, p.y - r * 1.2); g.lineTo(p.x + r * 0.7, p.y); g.lineTo(p.x, p.y + r * 1.2); g.lineTo(p.x - r * 0.7, p.y);
      g.closePath();
      g.fill();
    }
    if (naveVisible()) {
      const p = proyectar([nave.x, nave.y, 0]);
      if (!p.detras) {
        const s = p.k * 0.9;
        g.save();
        g.translate(p.x, p.y);
        g.rotate(U.clamp(nave.vx * 0.05, -0.75, 0.75));
        g.fillStyle = '#e8eefc';
        g.beginPath();
        g.moveTo(0, -s * 0.5); g.lineTo(s * 1.1, s * 0.25); g.lineTo(0, s * 0.1); g.lineTo(-s * 1.1, s * 0.25);
        g.closePath();
        g.fill();
        g.fillStyle = '#38f8ff';
        g.fillRect(-s * 0.3, s * 0.12, s * 0.6, s * 0.1);
        g.restore();
      }
    }
  }

  /** Control con cámara: una mira por cada mano. Se ve si la mano está en pistola,
      cuánto falta para el gatillo (el arco amarillo) y cuándo dispara (se cierra y destella). */
  function dibujarMiras(g, W, H) {
    const CU = GS.Cuerpo;
    if (!CU) return;
    for (const m of CU.manos) {
      const [x, y] = puntoMira(m);
      const fog = Math.max(0, fogonazos[m.id] || 0) / 0.22;
      g.save();
      g.lineCap = 'round';
      if (!m.pistola) {
        // Mano normal: un círculo punteado y tenue
        g.setLineDash([4, 5]);
        g.strokeStyle = 'rgba(255,255,255,0.5)';
        g.lineWidth = 2;
        g.beginPath(); g.arc(x, y, 12, 0, TAU); g.stroke();
        g.setLineDash([]);
        g.restore();
        continue;
      }
      const disparando = m.gatillo;
      const col = disparando ? '#ff3df2' : '#7cff4f';
      const r = disparando ? 11 : 19 - m.carga * 6; // se va cerrando al bajar el pulgar
      g.strokeStyle = col;
      g.shadowColor = col;
      g.shadowBlur = 12;
      g.lineWidth = 2.6;
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      // Marcas: hacia afuera si está listo, hacia adentro al disparar
      const a1 = disparando ? r - 6 : r + 2, a2 = disparando ? r + 2 : r + 10;
      g.moveTo(x - a1, y); g.lineTo(x - a2, y);
      g.moveTo(x + a1, y); g.lineTo(x + a2, y);
      g.moveTo(x, y - a1); g.lineTo(x, y - a2);
      g.moveTo(x, y + a1); g.lineTo(x, y + a2);
      g.stroke();
      if (!disparando && m.carga > 0.05) {
        // Arco amarillo: qué tanto falta para el gatillo
        g.strokeStyle = '#ffd23f';
        g.shadowColor = '#ffd23f';
        g.lineWidth = 4;
        g.beginPath();
        g.arc(x, y, r + 5, -Math.PI / 2, -Math.PI / 2 + TAU * m.carga);
        g.stroke();
      }
      if (disparando) {
        g.fillStyle = col;
        g.beginPath(); g.arc(x, y, 3.5, 0, TAU); g.fill();
      }
      if (fog > 0) {
        // Destello de cada disparo
        g.strokeStyle = 'rgba(255,255,255,' + fog.toFixed(2) + ')';
        g.lineWidth = 3;
        g.beginPath(); g.arc(x, y, 14 + (1 - fog) * 26, 0, TAU); g.stroke();
      }
      if (m.piloto) {
        g.shadowBlur = 0;
        g.font = '700 10px Orbitron, sans-serif';
        g.textAlign = 'center';
        g.fillStyle = col;
        g.fillText(disparando ? '¡FUEGO!' : 'BAJA EL PULGAR', x, y + r + 22);
      }
      g.restore();
    }
    if (!CU.persona && J.estado === 'jugando') {
      g.font = '800 15px Orbitron, sans-serif';
      g.textAlign = 'center';
      g.fillStyle = 'rgba(255,208,216,' + (0.6 + 0.4 * Math.sin(nave.t * 6)).toFixed(2) + ')';
      g.fillText(CU.modo === 'manos' ? 'NO VEO TU MANO: MUÉSTRALA A LA CÁMARA' : 'NO TE VEO: PÁRATE FRENTE A LA CÁMARA', W / 2, H * 0.62);
    }
  }

  function dibujarHUD(g, W, H) {
    const seguro = C.seguro;
    // Medidor del impulso
    const w = 150, x = W / 2 - w / 2, y = H - 40 - seguro.b;
    const listo = impulsoEnfr <= 0;
    const fr = 1 - impulsoEnfr / CFG.impulsoEnfriamiento;
    g.save();
    g.fillStyle = 'rgba(5,10,30,0.6)';
    g.fillRect(x, y - 5, w, 10);
    g.fillStyle = listo ? '#38f8ff' : 'rgba(56,248,255,0.45)';
    if (listo) { g.shadowColor = '#38f8ff'; g.shadowBlur = 12; }
    g.fillRect(x, y - 5, w * fr, 10);
    g.shadowBlur = 0;
    g.strokeStyle = 'rgba(56,248,255,0.6)';
    g.lineWidth = 1;
    g.strokeRect(x, y - 5, w, 10);
    g.font = '700 9px Orbitron, sans-serif';
    g.textAlign = 'center';
    g.fillStyle = listo ? '#bff9ff' : 'rgba(159,179,200,0.8)';
    g.fillText(listo ? 'IMPULSO LISTO' : 'IMPULSO', W / 2, y + 18);
    // Aviso de la nave nodriza
    if (jefe && jefe.t < jefe.dur) {
      g.font = '800 12px Orbitron, sans-serif';
      g.fillStyle = 'rgba(255,208,216,' + (0.6 + 0.4 * Math.sin(jefe.t * 8)).toFixed(2) + ')';
      const fases = jefe.fases > 1 ? ' · FASE ' + jefe.fase + '/' + jefe.fases : '';
      g.fillText(jefe.def.nombre + fases + ' · ' + Math.ceil(jefe.dur - jefe.t) + 's', W / 2, 100 + seguro.t);
      if (E.camara) {
        // Vida de la nave nodriza (solo con cámara, porque solo así se le puede disparar)
        const max = CFG.vidaJefeBase + CFG.vidaJefePorFase * jefe.fases, bw = 180;
        g.fillStyle = 'rgba(5,10,30,0.6)';
        g.fillRect(W / 2 - bw / 2, 110 + seguro.t, bw, 6);
        g.fillStyle = '#ff3df2';
        g.fillRect(W / 2 - bw / 2, 110 + seguro.t, bw * U.clamp(jefe.vida / max, 0, 1), 6);
      }
    }
    if (E.camara) dibujarMiras(g, W, H);
    g.restore();
    J.dibujarAuras(g, W, H);
  }
})(window.GS);
