/* =========================================================
   GALAXY STRIKE AR — juego.js
   Lógica del juego y dibujo en 3D sobre la cámara.
   Los aliens viven en un mundo 3D alrededor del jugador; cada
   cuadro se proyectan a la pantalla según hacia dónde apunte
   el celular.
   ========================================================= */
'use strict';

(function (GS) {
  const U = GS.U, Q = GS.Q, DEG = U.DEG, TAU = Math.PI * 2;

  /* ---------------- Ajustes del juego (cámbialos a tu gusto) ---------------- */
  const CONFIG = {
    vidasMax: 5,
    cadencia: 0.17,          // segundos entre disparos
    ayudaApuntado: 16,       // píxeles extra alrededor del enemigo que cuentan como acierto
    distanciaEsquive: 1.7,   // cuánto te mueves al inclinar el celular (metros del juego)
    killsParaAtaque: 8,      // multijugador: kills para mandar meteoros al rival
    jefeCada: 5              // cada cuántas oleadas sale la nave nodriza
  };
  const PUNTOS = { ovni: 100, dron: 150, jefe: 1500, orbe: 25 };
  const COLORES = {
    ovni: ['#7CFF4F', '#38f8ff', '#ffffff'],
    dron: ['#7CFF4F', '#ffd23f', '#b6ff8f'],
    jefe: ['#ff3355', '#c9b3ff', '#ffd23f', '#ffffff'],
    orbe: ['#ff3df2', '#ffb3f8'],
    meteoro: ['#ffb347', '#ff6a2b'],
    divisor: ['#ff8a3d', '#ffd23f', '#ffffff'],
    teleport: ['#b68cff', '#ffffff', '#38f8ff'],
    blindado: ['#6fb6ff', '#ffffff', '#38f8ff'],
    capsula: ['#ffffff', '#ffd23f']
  };
  const COLOR_INDICADOR = {
    ovni: '#7CFF4F', dron: '#ffd23f', jefe: '#c77dff', orbe: '#ff3df2', meteoro: '#ff4d3d',
    divisor: '#ff8a3d', teleport: '#b68cff', blindado: '#6fb6ff', capsula: '#ffffff'
  };

  /* ---------------- Vectores 3D ---------------- */
  const V = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    esc: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    len: (a) => Math.hypot(a[0], a[1], a[2]),
    norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
    dist: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
  };
  /** Punto alrededor del jugador: yaw (0 = al frente, + = izquierda), distancia y altura. */
  const posDesde = (yaw, dist, alt) => [-Math.sin(yaw) * dist, alt, -Math.cos(yaw) * dist];

  /* ---------------- Estado ---------------- */
  const J = (GS.Juego = {
    CONFIG,
    estado: 'menu', // menu | cuenta | jugando | pausa | fin
    modo: 'solo',      // solo | online
    tipoJuego: 'ar',   // ar (disparos en realidad aumentada) | esquiva (Esquiva marcianos)
    vidasMax: CONFIG.vidasMax,
    entidades: [], particulas: [], textos: [], textosPantalla: [], laseres: [],
    puntos: 0, vidas: CONFIG.vidasMax, oleada: 0, combo: 0, comboT: 0, carga: 0,
    jugadorX: 0, gatillo: false, vivo: true, objetivo: null, jefe: null,
    invul: 0, flash: 0, sacudida: 0, marcaGolpe: 0, tiempo: 0, duracion: 0
  });

  const oyentes = {};
  J.on = (nombre, fn) => { (oyentes[nombre] = oyentes[nombre] || []).push(fn); };
  function emitir(nombre, ...args) {
    (oyentes[nombre] || []).forEach((fn) => {
      try { fn(...args); } catch (e) { console.error(e); }
    });
  }
  J.emitir = emitir;

  let lienzo, ctx, lienzoFondo, fctx, lienzoGL, W = 1, H = 1, DPR = 1, F = 500, cx = 0, cy = 0;
  let camQ = Q.identidad(), camInv = Q.identidad(), camPos = [0, 0, 0], camYaw = 0, angArriba = 0;
  let vineta = null, tMenu = 0;
  const seguro = { t: 0, b: 0, l: 0, r: 0 };
  const estrellas = [], nebulosas = [], decor = [];

  /* ---------------- Lienzo ---------------- */
  /**
   * Tres capas: fondo (2D: espacio o viñeta), 3D (WebGL: los aliens)
   * y la capa de arriba (2D: partículas, textos y HUD).
   * Si el celular no tiene WebGL, los aliens se dibujan en 2D.
   */
  J.iniciarLienzo = function (c, cFondo, cGL) {
    lienzo = c;
    ctx = c.getContext('2d');
    lienzoFondo = cFondo;
    fctx = cFondo.getContext('2d');
    lienzoGL = cGL;
    J.usar3D = GS.Motor3D.iniciar(cGL);
    if (J.usar3D) {
      try { GS.Modelos.crear(); } catch (e) { console.warn('Modelos 3D:', e); J.usar3D = false; }
    }
    if (!J.usar3D) cGL.style.display = 'none';
    for (let i = 0; i < 420; i++) {
      const u = Math.random() * 2 - 1, th = Math.random() * TAU, r = Math.sqrt(1 - u * u);
      estrellas.push({ d: [r * Math.cos(th), u, r * Math.sin(th)], b: Math.random(), s: Math.random() < 0.08 ? 2 : 1 });
    }
    nebulosas.push(
      { d: V.norm([-0.6, 0.25, -1]), c: 'rgba(140,60,255,', r: 0.9 },
      { d: V.norm([0.9, 0.1, -0.4]), c: 'rgba(0,200,255,', r: 0.7 },
      { d: V.norm([0.2, 0.3, 1]), c: 'rgba(255,60,200,', r: 0.8 },
      { d: V.norm([-1, -0.1, 0.3]), c: 'rgba(60,255,160,', r: 0.6 }
    );
    for (let i = 0; i < 3; i++) decor.push({ yaw: (i - 1) * 0.75, dist: 8 + i * 2.5, alt: 0.4 + i * 0.7, t: i * 2, w: (i % 2 ? -1 : 1) * (0.1 + i * 0.03) });
    J.redimensionar();
  };

  J.redimensionar = function () {
    const baja = GS.Ajustes.calidadBaja();
    DPR = Math.min(window.devicePixelRatio || 1, baja ? 1 : 2);
    W = window.innerWidth;
    H = window.innerHeight;
    lienzo.width = Math.round(W * DPR);
    lienzo.height = Math.round(H * DPR);
    lienzoFondo.width = Math.round(W * DPR);
    lienzoFondo.height = Math.round(H * DPR);
    cx = W / 2;
    cy = H / 2;
    F = Math.max(W, H) / 2 / Math.tan(34 * DEG); // ~68° como la cámara de un celular
    GS.Motor3D.redimensionar(lienzoGL, W, H, baja ? Math.min(DPR, 0.85) : Math.min(DPR, 1.75), F);
    vineta = null;
    const sonda = document.getElementById('sondaSegura');
    if (sonda) {
      const cs = getComputedStyle(sonda);
      seguro.t = parseFloat(cs.paddingTop) || 0;
      seguro.b = parseFloat(cs.paddingBottom) || 0;
      seguro.l = parseFloat(cs.paddingLeft) || 0;
      seguro.r = parseFloat(cs.paddingRight) || 0;
    }
  };

  /** Lienzos y medidas que comparte el modo Esquiva marcianos. */
  J.capas = () => ({ ctx, fctx, W, H, DPR, F, seguro });

  /** Elige el tipo de juego antes de la cuenta regresiva. */
  J.prepararTipo = function (tipo) {
    J.tipoJuego = tipo === 'esquiva' ? 'esquiva' : 'ar';
    if (J.tipoJuego === 'esquiva') GS.Esquiva.preparar();
  };

  function aCamara(p) {
    return Q.rotar(camInv, [p[0] - camPos[0], p[1] - camPos[1], p[2] - camPos[2]]);
  }
  function proyectar(p) {
    const v = aCamara(p), z = -v[2];
    if (z < 0.15) return { detras: true, v, z };
    return { detras: false, v, z, x: cx + (v[0] / z) * F, y: cy - (v[1] / z) * F, k: F / z };
  }

  /* ---------------- Partida ---------------- */
  /**
   * opc: { modo: 'solo'|'online', tipo: 'ar'|'esquiva', semilla, duracion,
   *        sector: 1-4 (campaña) o null (infinito), coop: bool, tutorial: bool }
   */
  J.iniciar = function (opc) {
    J.modo = opc.modo || 'solo';
    J.rng = U.crearRNG(opc.semilla != null ? opc.semilla : (Math.random() * 1e9) | 0);
    J.prepararTipo(opc.tipo || J.tipoJuego);
    J.campana = opc.sector || null;
    J.coop = !!opc.coop;
    J.tutorial = !!opc.tutorial;
    J.reto = opc.reto || null; // reto del día: { id, icono, nombre, desc }
    // En línea todos juegan en Normal para que sea justo
    J.dif = J.modo === 'online' ? GS.Ajustes.DIFICULTAD.normal : GS.Ajustes.dif();
    if (J.esReto('turbo')) J.dif = Object.assign({}, J.dif, { velocidad: J.dif.velocidad * 1.2, puntos: J.dif.puntos * 1.2 });
    J.tema = (J.campana ? GS.Sectores.get(J.campana) : GS.Sectores.lista[0]).tema;
    GS.Poderes.reiniciar();
    const comunes = {
      combo: 0, comboT: 0, kills: 0, disparos: 0, aciertos: 0, esquivados: 0, carga: 0,
      tiempo: opc.duracion || 0, duracion: opc.duracion || 0, tTotal: 0, puntos: 0,
      entidades: [], particulas: [], textos: [], textosPantalla: [], laseres: [], ataques: [], cola: [],
      invul: 0, sacudida: 0, flash: 0, flashColor: '255,0,40', vivo: true, gatillo: false, objetivo: null, jefe: null,
      vidasPerdidas: 0, tSinDanio: 0, sinDanioAvisado: false, camaraLenta: 0, finEn: -1, victoriaEn: -1, resultado: null,
      hitStop: 0, hitStopCD: 0, golpesDir: [], jefesVistos: 0
    };
    if (J.tipoJuego === 'esquiva') {
      const vidas = J.esReto('fragil') ? 3 : Math.max(1, GS.Esquiva.CFG.vidas + J.dif.vidasExtra);
      Object.assign(J, comunes, { vidas, vidasMax: vidas, oleada: 1 });
      J.estado = 'jugando';
      GS.Esquiva.iniciar(opc);
    } else {
      const vidas = J.esReto('fragil') ? 3 : Math.max(2, CONFIG.vidasMax + J.dif.vidasExtra);
      Object.assign(J, comunes, {
        vidas, vidasMax: vidas, oleada: 0, tOleada: 0, marcaGolpe: 0, enfriamiento: 0,
        entreOleadas: J.tutorial ? Infinity : 1.0, tMeteoro: Infinity, jugadorX: 0, pistaRebote: false,
        canon: 0, alertaT: 0, defOleada: null, explosionesJefe: []
      });
      if (J.esReto('jefes') && !J.campana) J.oleada = 4; // la próxima oleada (la 5) trae al jefe
      J.estado = 'jugando';
    }
    GS.Musica.tocar('juego');
    GS.Musica.nivel(1);
    emitir('puntos');
    emitir('vidas');
    emitir('combo');
    if (J.tutorial) GS.Tutorial.iniciar(J.tipoJuego);
  };

  /** ¿Esta partida es el reto del día con este modificador? */
  J.esReto = (id) => !!(J.reto && J.reto.id === id);

  J.multiplicador = () => (J.combo >= 10 ? 4 : J.combo >= 6 ? 3 : J.combo >= 3 ? 2 : 1);

  /** Puntos con todos los multiplicadores (combo, dificultad y poder x2). */
  J.sumarPuntos = function (base, conCombo) {
    const pts = Math.round(base * (conCombo ? J.multiplicador() : 1) * J.dif.puntos * GS.Poderes.multPuntos());
    J.puntos += pts;
    emitir('puntos');
    return pts;
  };

  J.terminar = function (motivo) {
    if (J.estado === 'fin') return;
    J.estado = 'fin';
    J.gatillo = false;
    J.resultado = motivo;
    GS.Poderes.reiniciar();
    GS.Progreso.evento('puntos', J.puntos);
    emitir('fin', motivo);
  };

  /** Multijugador: un rival te mandó una lluvia de meteoros. */
  J.recibirAtaque = function (nombre, n) {
    if (J.tipoJuego === 'esquiva') { GS.Esquiva.recibirAtaque(nombre, n); return; }
    if (J.estado !== 'jugando' || !J.vivo) return;
    for (let i = 0; i < n; i++) J.ataques.push(0.8 + i * 0.85);
    emitir('aviso', '¡' + nombre + ' te lanzó meteoros!', 'peligro');
    GS.Sonido.ataque();
  };

  /** Cooperativo: después de caer, vuelves a la partida. */
  J.revivir = function () {
    if (J.estado !== 'jugando' || J.vivo) return;
    J.vivo = true;
    J.vidas = Math.min(2, J.vidasMax);
    J.invul = 3;
    J.finEn = -1;
    emitir('vidas');
    emitir('aviso', '¡De vuelta a la batalla!', 'exito');
    GS.Sonido.poder();
  };

  /* ---------------- Sensación de los golpes (los usan los dos modos) ----------------
     - Vibraciones distintas para cada cosa (solo Android: el iPhone no deja vibrar desde la web).
     - Micro-pausa («hit-stop»): el mundo se congela unas centésimas al destruir o al recibir daño.
     - Marca de dirección: un arco rojo en el borde te dice de dónde vino el golpe. */
  const VIBRA = {
    disparo: 8, kill: 22, golpe: [90, 40, 160], escudo: [40, 30, 40], poder: [25, 35, 25, 35, 70],
    jefeFase: [70, 40, 70], jefeMuerto: [120, 60, 220], porPoco: 12, anillo: [15, 30, 15], impulso: 18, puntoDebil: [15, 20, 30]
  };
  J.vibrar = function (p) {
    const patron = typeof p === 'string' ? VIBRA[p] : p;
    if (!patron || !GS.Ajustes.get('vibracion')) return;
    try { if (navigator.vibrate) navigator.vibrate(patron); } catch (e) { /* nada */ }
  };
  const vibrar = (p) => J.vibrar(p);

  /** Congela el mundo un instante. Los golpes chicos no se encadenan (con la ráfaga sería molesto). */
  J.congelar = function (seg) {
    if (J.hitStopCD > 0 && seg < 0.1) return;
    J.hitStop = Math.max(J.hitStop || 0, seg);
    J.hitStopCD = 0.14;
  };

  /** Marca en el borde: ang en radianes de pantalla (0 = derecha, PI/2 = abajo). c = color 'r,g,b'. */
  J.marcarGolpe = function (ang, c) {
    if (ang == null || !isFinite(ang)) return;
    J.golpesDir.push({ ang, t: 0, c: c || '255,40,60' });
    if (J.golpesDir.length > 4) J.golpesDir.shift();
  };

  /** Avanza la sensación de golpes y devuelve cuánto corre el mundo (≈0 durante la micro-pausa). */
  J.pasoSensacion = function (dt) {
    const congelado = J.hitStop > 0;
    J.hitStop -= dt;
    J.hitStopCD -= dt;
    for (const g of J.golpesDir) g.t += dt;
    if (J.golpesDir.length) J.golpesDir = J.golpesDir.filter((g) => g.t < 1.1);
    return congelado ? 0.05 : 1;
  };

  // Ganar un poder también se siente
  GS.Poderes.alActivar(() => { if (J.estado === 'jugando') vibrar('poder'); });

  /* ---------------- Oleadas ---------------- */
  J.totalOleadas = () => (J.campana ? GS.Sectores.get(J.campana).oleadas.length : 0);

  function definicionOleada(n) {
    if (J.campana) return GS.Sectores.get(J.campana).oleadas[n - 1] || null;
    return GS.Sectores.oleadaInfinita(n, J.rng);
  }

  function nuevaOleada() {
    J.oleada++;
    const def = definicionOleada(J.oleada);
    if (!def) return;
    J.defOleada = def;
    if (!J.campana && def.tema) J.tema = def.tema.tema;
    const r = J.rng, cola = [];
    (def.grupos || []).forEach((g) => {
      let t = g.desde || 0.4;
      for (let i = 0; i < g.n; i++) { cola.push({ t, tipo: g.tipo, detras: !!g.detras }); t += g.cada * r.rango(0.85, 1.15); }
    });
    if (def.jefe) cola.push({ t: 1.2, tipo: 'jefe', jefe: def.jefe });
    // Parámetros con semilla: en multijugador todos ven la misma oleada.
    cola.forEach((c) => { c.yaw = r.rango(-1, 1); c.alt = r(); c.dist = r(); c.vari = r(); });
    cola.sort((a, b) => a.t - b.t);
    J.cola = cola;
    J.tOleada = 0;
    J.tMeteoro = def.meteoros ? def.meteoros * 0.7 : Infinity;
    emitir('oleada', J.oleada, !!def.jefe, def.nombre);
    GS.Musica.tocar(def.jefe ? 'jefe' : 'juego');
    GS.Musica.nivel(J.campana ? Math.min(3, 1 + Math.floor(J.oleada / 2)) : Math.min(3, 1 + Math.floor(J.oleada / 4)));
  }

  const COLORES_JEFE = {
    1: null,
    2: { disco: [0.78, 0.48, 0.26], domo: [0.42, 0.2, 0.08] },
    3: { disco: [0.32, 0.72, 0.36], domo: [0.1, 0.34, 0.16] },
    4: { disco: [0.72, 0.16, 0.26], domo: [0.3, 0.05, 0.12] }
  };

  function yawAparicion(c, arco) {
    if (!c.detras) return c.yaw * arco;
    // Emboscada: a tu espalda (o al costado si no hay giroscopio)
    if (GS.Sensores.modo === 'giro') return Math.PI + c.yaw * 0.6;
    return (c.yaw < 0 ? -1 : 1) * GS.Sensores.arcoMax() * DEG * 0.95;
  }

  function aparecer(c) {
    const n = J.oleada, d = J.dif;
    const arco = Math.min(55 + n * 12, GS.Sensores.arcoMax()) * DEG;
    const yaw = yawAparicion(c, arco);
    const orbitante = (tipo, extra) => {
      const alt = -0.6 + c.alt * 3.2, dist = 9 + c.dist * 6;
      J.entidades.push(Object.assign({
        tipo, enemigo: true, yaw, dist, alt0: alt, alt, radio: 0.85, hp: 1, t: c.vari * 10, entrada: 0,
        pos: posDesde(yaw, dist, alt), w: (c.vari < 0.5 ? -1 : 1) * (0.08 + c.vari * 0.18) * (1 + n * 0.04),
        tDisparo: (1.8 + c.vari * 2.5) * d.cadenciaEnemiga, atras: !!c.detras
      }, extra || {}));
    };
    switch (c.tipo) {
      case 'ovni': orbitante('ovni'); break;
      case 'divisor': orbitante('divisor'); break;
      case 'blindado': orbitante('blindado', { hp: 3, hpMax: 3, w: (c.vari < 0.5 ? -1 : 1) * 0.07 }); break;
      case 'teleport': {
        const alt = -0.3 + c.alt * 2.4;
        J.entidades.push({ tipo: 'teleport', enemigo: true, yaw, dist: 8 + c.dist * 4, alt, radio: 0.62, hp: 1, t: 0, entrada: 0,
          pos: posDesde(yaw, 8 + c.dist * 4, alt), tSalto: 1.6 + c.vari, tDisparo: 99 });
        break;
      }
      case 'dron':
        J.entidades.push({ tipo: 'dron', enemigo: true, pos: posDesde(yaw, 20, -0.5 + c.alt * 2.5), radio: 0.6, hp: 1,
          t: c.vari * 10, vel: (2.0 + n * 0.12 + c.vari * 0.6) * d.velocidad });
        break;
      case 'jefe': {
        const cfg = c.jefe || { hp: 14 + n * 2, fases: 2 };
        const hp = Math.round(cfg.hp * (0.7 + 0.3 * d.velocidad));
        // Cada sector tiene su jefe; en el Infinito se turnan
        J.jefesVistos++;
        const def = J.campana ? GS.Jefes.get(J.campana) : GS.Jefes.turno(J.jefesVistos);
        const dist = def.id === 'coloso' ? 15 : def.id === 'emperador' ? 17 : 16;
        J.entidades.push({
          tipo: 'jefe', def, enemigo: true, yaw0: c.yaw * 0.3, yaw: c.yaw * 0.3, dist, alt: 3, radio: def.id === 'emperador' ? 2.9 : 2.6,
          hp, hpMax: hp, fases: cfg.fases || 2, fase: 1, final: !!cfg.final, t: 0, entrada: 0, tDisparo: 3, tDron: 5,
          rafaga: 0, tRafaga: 0, abanico: 0, pos: posDesde(c.yaw * 0.3, dist, 3), alfa: 1,
          tMeteoro: 2.5, tBlindaje: 3.2, blindado: false, tSalto: 5, salto: 0, tRefuerzo: 3, lado: 1,
          colores: def.id === 'nodriza' && J.campana ? COLORES_JEFE[J.campana] : null
        });
        emitir('aviso', def.llegada, 'peligro');
        break;
      }
    }
  }

  /** Para el tutorial y los poderes: crear cosas a mano. */
  J.tut = {
    ovni(yaw, dist, alt) {
      J.entidades.push({ tipo: 'ovni', enemigo: true, yaw, dist, alt0: alt, alt, radio: 0.85, hp: 1, t: 0, entrada: 0,
        pos: posDesde(yaw, dist, alt), w: 0, tDisparo: Infinity, tutorial: true });
    },
    meteoro: () => lanzarMeteoro(),
    capsula(poder, yaw, dist) { soltarCapsula(posDesde(camYaw + yaw, dist, 0.2), poder); },
    yawCamara: () => camYaw
  };

  function dispararOrbe(origen, rapidez, desvio = 0, arriba = 0) {
    const derecha = [Math.cos(camYaw), 0, -Math.sin(camYaw)];
    const obj = V.add(V.add(camPos, V.esc(derecha, desvio)), [U.rand(-0.15, 0.15), arriba + U.rand(-0.15, 0.15), U.rand(-0.15, 0.15)]);
    const vel = V.esc(V.norm(V.sub(obj, origen)), rapidez * J.dif.velocidad);
    J.entidades.push({ tipo: 'orbe', pos: origen.slice(), vel, radio: 0.32, radioGolpe: 0.72, hp: 1, t: 0, vida: 9, minDist: 99 });
    GS.Sonido.orbe();
  }

  function lanzarMeteoro() {
    // Aparece dentro de lo que estás viendo para que lo veas venir.
    const abierto = Math.atan(W / 2 / F) * 0.65;
    const yaw = camYaw + U.rand(-abierto, abierto), dist = 26, alt = U.rand(-0.4, 1.6);
    const pos = [-Math.sin(yaw) * dist + camPos[0], alt, -Math.cos(yaw) * dist + camPos[2]];
    const obj = V.add(camPos, [U.rand(-0.25, 0.25), U.rand(-0.2, 0.2), U.rand(-0.25, 0.25)]);
    const rapidez = (U.rand(8.5, 10.5) + Math.min(J.oleada * 0.12, 2)) * J.dif.velocidad;
    J.entidades.push({
      tipo: 'meteoro', pos, vel: V.esc(V.norm(V.sub(obj, pos)), rapidez), radio: 0.75, radioGolpe: 1.05,
      hp: 99, t: 0, rot: Math.random() * TAU, vrot: U.rand(-2, 2), vida: 6, minDist: 99, vari: (Math.random() * 3) | 0,
      q: Q.normalizar([Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5]),
      eje: V.norm([Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5])
    });
    GS.Sonido.meteoro();
  }

  /** Meteoro que lanza un jefe desde su posición, directo hacia ti. */
  function lanzarMeteoroDesde(origen, desvio = 0) {
    const derecha = [Math.cos(camYaw), 0, -Math.sin(camYaw)];
    const obj = V.add(V.add(camPos, V.esc(derecha, desvio)), [U.rand(-0.2, 0.2), U.rand(-0.15, 0.15), 0]);
    const rapidez = (8 + Math.min(J.oleada * 0.08, 1.5)) * J.dif.velocidad;
    J.entidades.push({
      tipo: 'meteoro', pos: origen.slice(), vel: V.esc(V.norm(V.sub(obj, origen)), rapidez), radio: 0.75, radioGolpe: 1.05,
      hp: 99, t: 0, rot: 0, vrot: U.rand(-2, 2), vida: 7, minDist: 99, vari: (Math.random() * 3) | 0,
      q: Q.normalizar([Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5]),
      eje: V.norm([Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5])
    });
    GS.Sonido.meteoro();
  }

  function soltarCapsula(pos, poder) {
    J.entidades.push({ tipo: 'capsula', poder: poder || GS.Poderes.azar('ar'), pos: pos.slice(), y0: pos[1], radio: 0.55, hp: 1, t: 0, vida: 11 });
  }

  /* ---------------- Poderes instantáneos ---------------- */
  GS.Poderes.alActivar((tipo) => {
    if (J.tipoJuego !== 'ar' || J.estado !== 'jugando') return;
    if (tipo === 'bomba') {
      J.flash = 0.5;
      J.flashColor = '255,255,255';
      J.sacudida = 1;
      for (const e of J.entidades) {
        if (!e.enemigo || e.muerto || !e.proy || e.proy.detras) continue;
        if (e.tipo === 'jefe') { e.hp = Math.max(1, e.hp - 5); e.golpeT = 0.2; continue; }
        e.hp = 1;
        golpear(e, true);
      }
      GS.Sonido.explosion(true);
    }
  });

  /* ---------------- Actualización ---------------- */
  J.actualizar = function (dt) {
    dt = Math.min(dt, 0.05);

    if (J.estado === 'menu') {
      tMenu += dt;
      camQ = Q.mult(Q.eje(0, 1, 0, Math.sin(tMenu * 0.07) * 0.6), Q.eje(1, 0, 0, 0.08));
      camInv = Q.conj(camQ);
      camPos = [0, 0, 0];
      angArriba = 0;
      decor.forEach((d) => { d.t += dt; d.yaw += d.w * dt; });
      actualizarEfectos(dt);
      return;
    }

    if (J.estado === 'jugando') GS.Poderes.actualizar(dt);
    if (J.tipoJuego === 'esquiva') { GS.Esquiva.actualizar(dt); return; }

    camQ = GS.Sensores.actualizar(dt);
    camInv = Q.conj(camQ);
    const f = Q.rotar(camQ, [0, 0, -1]);
    camYaw = Math.atan2(-f[0], -f[2]);
    const arriba = Q.rotar(camInv, [0, 1, 0]);
    angArriba = Math.atan2(arriba[0], arriba[1]);

    if (J.estado === 'pausa') return;

    // Esquivar: inclinar el celular te mueve hacia un lado
    const meta = (J.estado === 'jugando' && J.vivo ? GS.Sensores.inclinacion : 0) * CONFIG.distanciaEsquive;
    J.jugadorX = U.lerp(J.jugadorX, meta, 1 - Math.exp(-dt * 12));
    camPos = [Math.cos(camYaw) * J.jugadorX, 0, -Math.sin(camYaw) * J.jugadorX];

    if (J.estado !== 'jugando') {
      actualizarEfectos(dt);
      return;
    }

    // Tiempo del mundo: la cámara lenta (poder o final del jefe) y la micro-pausa frenan a los aliens, no a ti
    J.camaraLenta -= dt;
    const hs = J.pasoSensacion(dt);
    const dtM = dt * (J.camaraLenta > 0 ? 0.3 : 1) * GS.Poderes.escalaTiempo() * hs;

    J.tTotal += dt;
    if (J.modo === 'online' && J.duracion > 0) {
      J.tiempo = Math.max(0, J.tiempo - dt);
      if (J.tiempo <= 0) { J.terminar('tiempo'); return; }
    }
    if (J.finEn > 0) {
      J.finEn -= dt;
      if (J.finEn <= 0) { J.terminar('derrota'); return; }
    }
    if (J.victoriaEn > 0) {
      J.victoriaEn -= dt;
      if (J.victoriaEn <= 0) { J.terminar('victoria'); return; }
    }

    J.enfriamiento -= dt; J.invul -= dt; J.flash -= dt; J.marcaGolpe -= dt; J.alertaT -= dt;
    J.sacudida *= Math.exp(-dt * 7);
    if (J.comboT > 0) {
      J.comboT -= dt;
      if (J.comboT <= 0) { J.combo = 0; emitir('combo'); }
    }
    if (J.vivo && !J.tutorial) {
      J.tSinDanio += dt;
      if (J.tSinDanio >= 60 && !J.sinDanioAvisado) { J.sinDanioAvisado = true; GS.Progreso.evento('sinDanio', 60); }
    }

    // Explosiones en cadena de la nave nodriza
    for (let i = J.explosionesJefe.length - 1; i >= 0; i--) {
      const x = J.explosionesJefe[i];
      x.t -= dt;
      if (x.t <= 0) {
        J.explosionesJefe.splice(i, 1);
        explotar({ tipo: 'jefe', pos: x.pos, radio: 2 });
      }
    }

    if (J.vivo && J.victoriaEn < 0) {
      if (J.entreOleadas > 0) {
        J.entreOleadas -= dt;
        if (J.entreOleadas <= 0) nuevaOleada();
      } else {
        J.tOleada += dtM;
        while (J.cola.length && J.cola[0].t <= J.tOleada) aparecer(J.cola.shift());
        if (!J.cola.length && !J.entidades.some((e) => e.enemigo)) {
          if (J.campana && J.oleada >= J.totalOleadas()) {
            J.victoriaEn = 2.6; // ¡sector completado!
          } else {
            J.entreOleadas = 3.2;
            emitir('oleadaSuperada', J.oleada);
            GS.Sonido.oleada();
          }
        }
        J.tMeteoro -= dtM;
        if (J.tMeteoro <= 0) {
          lanzarMeteoro();
          J.tMeteoro = (J.defOleada && J.defOleada.meteoros ? J.defOleada.meteoros : 6) * U.rand(0.85, 1.25) / J.dif.velocidad * (J.esReto('meteoros') ? 0.5 : 1);
        }
      }
      for (let i = J.ataques.length - 1; i >= 0; i--) {
        J.ataques[i] -= dt;
        if (J.ataques[i] <= 0) { J.ataques.splice(i, 1); lanzarMeteoro(); }
      }
    }

    J.entidades = J.entidades.filter((e) => !e.muerto && actualizarEntidad(e, dtM));
    for (const e of J.entidades) e.proy = proyectar(e.pos);
    J.jefe = J.entidades.find((e) => e.tipo === 'jefe') || null;
    J.objetivo = buscarObjetivo();
    if (J.gatillo && J.vivo) disparar();

    for (const e of J.entidades) {
      if (e.tipo === 'meteoro' && !e.alertado) {
        const eta = V.dist(e.pos, camPos) / V.len(e.vel);
        if (eta < 1.6) {
          e.alertado = true;
          J.alertaT = 1.3;
          GS.Sonido.alerta();
          emitir('aviso', '¡ESQUIVA! ' + GS.Sensores.textoEsquivar(), 'peligro');
        }
      }
    }
    actualizarEfectos((J.camaraLenta > 0 ? dt * 0.5 : dt) * hs);
  };

  function moverOrbitante(e, dt, n) {
    e.entrada = Math.min(1, e.entrada + dt * 1.8);
    e.yaw += e.w * dt;
    const lim = GS.Sensores.arcoMax() * DEG;
    if (!e.atras) {
      if (e.yaw > lim && e.yaw < Math.PI) { e.yaw = lim; e.w = -Math.abs(e.w); }
      if (e.yaw < -lim) { e.yaw = -lim; e.w = Math.abs(e.w); }
    }
    e.dist = Math.max(7, e.dist - dt * 0.15);
    e.alt = e.alt0 + Math.sin(e.t * 1.4) * 0.35;
    e.pos = posDesde(e.yaw, e.dist, e.alt);
    e.tDisparo -= dt;
    if (e.tDisparo <= 0 && e.entrada >= 1) {
      if (J.vivo) dispararOrbe(V.add(e.pos, [0, -0.35, 0]), 5 + n * 0.25);
      e.tDisparo = Math.max(1.8, 4.6 - n * 0.22) * U.rand(0.8, 1.3) * J.dif.cadenciaEnemiga * (e.tipo === 'blindado' ? 1.3 : 1);
    }
  }

  function actualizarEntidad(e, dt) {
    e.t += dt;
    if (e.golpeT > 0) e.golpeT -= dt;
    const n = J.oleada;
    switch (e.tipo) {
      case 'ovni':
      case 'divisor':
      case 'blindado':
        moverOrbitante(e, dt, n);
        return true;
      case 'teleport': {
        e.entrada = Math.min(1, e.entrada + dt * 2);
        e.alt += Math.sin(e.t * 3) * 0.004;
        e.pos = posDesde(e.yaw, e.dist, e.alt + Math.sin(e.t * 2.2) * 0.25);
        e.tSalto -= dt;
        if (e.tSalto <= 0) {
          chispas(e.pos, ['#b68cff', '#ffffff'], 10);
          const salto = (0.35 + Math.random() * 0.5) * (Math.random() < 0.5 ? -1 : 1);
          e.yaw = U.clamp(e.yaw + salto, -GS.Sensores.arcoMax() * DEG, GS.Sensores.arcoMax() * DEG);
          e.alt = U.clamp(e.alt + U.rand(-0.8, 0.8), -0.5, 2.2);
          e.pos = posDesde(e.yaw, e.dist, e.alt);
          e.entrada = 0;
          e.tSalto = 2.4 * J.dif.cadenciaEnemiga;
          e.tDisparo = 0.9;
          chispas(e.pos, ['#b68cff', '#ffffff'], 10);
          GS.Sonido.teleport();
        }
        e.tDisparo -= dt;
        if (e.tDisparo <= 0) { if (J.vivo) dispararOrbe(e.pos, 6 + n * 0.2); e.tDisparo = 99; }
        return true;
      }
      case 'dron': {
        const d = V.sub(camPos, e.pos), dist = V.len(d);
        if (dist < 0.9) { recibirDanio(e); explotar(e); return false; }
        const dir = V.esc(d, 1 / dist), lado = [-dir[2], 0, dir[0]];
        const zigzag = Math.sin(e.t * 3.2) * 1.4 * Math.min(1, dist / 6);
        e.pos = V.add(e.pos, V.add(V.esc(dir, e.vel * dt), V.esc(lado, zigzag * dt)));
        return true;
      }
      case 'jefe':
        actualizarJefe(e, dt, n);
        return true;
      case 'capsula': {
        e.vida -= dt;
        const d = V.sub(camPos, e.pos), dist = V.len(d);
        if (dist < 1.6) { recogerCapsula(e); return false; }
        e.pos = V.add(e.pos, V.esc(V.norm(d), 0.7 * dt));
        e.pos[1] = e.y0 + Math.sin(e.t * 2) * 0.25;
        return e.vida > 0;
      }
      case 'orbe':
      case 'meteoro': {
        e.pos = V.add(e.pos, V.esc(e.vel, dt));
        if (e.tipo === 'meteoro') {
          e.rot += e.vrot * dt;
          e.q = Q.normalizar(Q.mult(Q.eje(e.eje[0], e.eje[1], e.eje[2], e.vrot * dt), e.q));
        }
        const d = V.dist(e.pos, camPos);
        e.minDist = Math.min(e.minDist, d);
        if (d < e.radioGolpe) {
          if (recibirDanio(e)) explotar(e);
          if (e.tipo === 'meteoro' && J.tutorial) emitir('tutGolpe');
          return false;
        }
        e.vida -= dt;
        const seAleja = V.dot(V.sub(e.pos, camPos), e.vel) > 0;
        if (seAleja && d > 2.5) {
          if (e.minDist < (e.tipo === 'meteoro' ? 2.6 : 2.0)) esquivado(e);
          else if (e.tipo === 'meteoro' && J.tutorial) emitir('tutEsquivo');
          return false;
        }
        return e.vida > 0;
      }
    }
    return true;
  }

  /** Los jefes: cambian de fase según la vida que les quede. En la última, su punto débil queda expuesto. */
  function actualizarJefe(e, dt, n) {
    const def = e.def;
    e.entrada = Math.min(1, e.entrada + dt * 0.8);
    const r = e.hp / e.hpMax;
    const fase = e.fases >= 3 && r <= 0.3 ? 3 : e.fases >= 2 && r <= 0.6 ? 2 : 1;
    if (fase !== e.fase) {
      e.fase = fase;
      J.sacudida = 0.7;
      J.congelar(0.12);
      vibrar('jefeFase');
      GS.Sonido.alerta();
      GS.Musica.nivel(3);
      emitir('aviso', fase === e.fases ? def.fases.final : def.fases[2], 'peligro');
      soltarCapsula(V.add(e.pos, [0, -1.5, 0]));
    }
    e.expuesto = e.fases >= 2 && fase === e.fases;
    const ultima = e.expuesto;

    // Movimiento
    if (def.id === 'medusa') moverMedusa(e, dt, fase);
    else {
      const velMov = (fase === 3 ? 0.65 : fase === 2 ? 0.48 : 0.35) * (def.id === 'coloso' ? 0.6 : 1);
      e.fx = (e.fx || 0) + dt * velMov;
      e.yaw = e.yaw0 + Math.sin(e.fx) * (0.45 + 0.08 * fase) * (def.id === 'emperador' ? 0.8 : 1);
      e.alt = (def.id === 'coloso' ? 2.2 : 2.6) + Math.sin(e.t * 0.9) * 0.4;
      e.pos = posDesde(e.yaw, e.dist, e.alt);
    }
    // Dónde está su punto débil
    const esc = e.radio * Math.max(0.01, U.easeOutBack(e.entrada));
    const q = haciaJugador(e.pos, Q.eje(1, 0, 0, 0.2 + Math.sin(e.t * 0.9) * 0.05));
    e.ojo = V.add(e.pos, V.esc(Q.rotar(q, def.puntoDebil), esc));
    e.radioOjo = def.radioDebil * esc;

    if (!J.vivo) return;
    const cad = J.dif.cadenciaEnemiga;
    if (def.id === 'coloso') ataqueColoso(e, dt, n, fase, ultima, cad);
    else if (def.id === 'medusa') ataqueMedusa(e, dt, n, fase, ultima, cad);
    else if (def.id === 'emperador') ataqueEmperador(e, dt, n, fase, ultima, cad, q, esc);
    else ataqueNodriza(e, dt, n, fase, cad);
  }

  /** Guardián lunar: ráfagas, abanico y drones. */
  function ataqueNodriza(e, dt, n, fase, cad) {
    e.tDisparo -= dt;
    if (e.tDisparo <= 0) {
      if (fase === 1) { e.rafaga = 3; e.abanico = 0; e.tDisparo = Math.max(2.2, 3.8 - n * 0.06) * cad; }
      else if (fase === 2) { e.rafaga = 5; e.abanico = 1; e.tDisparo = 3.2 * cad; }
      else { e.rafaga = 1; e.abanico = 0; e.tDisparo = 0.75 * cad; }
      e.tRafaga = 0;
      e.iRafaga = 0;
    }
    if (e.rafaga > 0) {
      e.tRafaga -= dt;
      if (e.tRafaga <= 0) {
        const desvio = e.abanico ? (e.iRafaga - 2) * 0.9 : 0;
        dispararOrbe(V.add(e.pos, [0, -1, 0]), (6 + n * 0.15) * (fase === 3 ? 1.15 : 1), desvio);
        e.rafaga--;
        e.iRafaga++;
        e.tRafaga = e.abanico ? 0.18 : 0.35;
      }
    }
    if (fase >= 2) {
      e.tDron -= dt;
      if (e.tDron <= 0) {
        e.tDron = (fase === 3 ? 6 : 5) * cad;
        J.entidades.push({ tipo: 'dron', enemigo: true, pos: V.add(e.pos, [0, -1.2, 0]), radio: 0.6, hp: 1, t: 0, vel: 2.4 * J.dif.velocidad });
      }
    }
  }

  /** El Rompe-rocas: lanza meteoros (¡esquívalos!), se cubre con una coraza y al final muestra su núcleo. */
  function ataqueColoso(e, dt, n, fase, ultima, cad) {
    // Coraza: en la fase 2 se cierra un rato y se vuelve a abrir
    if (fase === 2 && !ultima) {
      e.tBlindaje -= dt;
      if (e.tBlindaje <= 0) {
        e.blindado = !e.blindado;
        e.tBlindaje = e.blindado ? 1.8 : 3.2;
        if (e.blindado) GS.Sonido.escudo();
      }
    } else e.blindado = false;
    e.tMeteoro -= dt;
    if (e.tMeteoro <= 0) {
      const origen = V.add(e.pos, [0, 0.6, 0]);
      lanzarMeteoroDesde(origen, U.rand(-0.3, 0.3));
      if (ultima) e.meteoroExtra = 0.55; // al final, de a dos
      e.tMeteoro = (fase === 1 ? 3.6 : fase === 2 ? 3.1 : 2.6) * cad;
    }
    if (e.meteoroExtra > 0) {
      e.meteoroExtra -= dt;
      if (e.meteoroExtra <= 0) lanzarMeteoroDesde(V.add(e.pos, [0, 0.6, 0]), (Math.random() < 0.5 ? -1 : 1) * 1.1);
    }
    e.tDisparo -= dt;
    if (e.tDisparo <= 0) {
      const brazos = [-0.7, 0.7];
      if (!e.blindado) brazos.forEach((dv) => dispararOrbe(V.add(e.pos, [0, -0.6, 0]), 5.2 + n * 0.12, dv));
      if (ultima) dispararOrbe(V.add(e.pos, [0, -0.6, 0]), 6 + n * 0.12, 0);
      e.tDisparo = (ultima ? 2.4 : 3.2) * cad;
    }
  }

  /** La Reina de la nebulosa: se teletransporta alrededor tuyo y lanza anillos de plasma. */
  function moverMedusa(e, dt, fase) {
    e.tSalto -= dt;
    if (e.salto === 0 && e.tSalto <= 0) e.salto = 1; // empieza a desvanecerse
    if (e.salto === 1) {
      e.alfa = Math.max(0, e.alfa - dt * 3);
      if (e.alfa <= 0) {
        chispas(e.pos, ['#ff8af0', '#ffffff'], 16);
        const lim = GS.Sensores.arcoMax() * DEG * 0.8;
        let nuevo = e.yaw0 + U.rand(0.5, 1.1) * (Math.random() < 0.5 ? -1 : 1);
        if (Math.abs(nuevo) > lim) nuevo = U.clamp(-nuevo * 0.5, -lim, lim);
        e.yaw0 = e.yaw = nuevo;
        e.salto = 2;
        GS.Sonido.teleport();
      }
    } else if (e.salto === 2) {
      e.alfa = Math.min(1, e.alfa + dt * 2.5);
      if (e.alfa >= 1) { e.salto = 0; e.tSalto = (fase === 1 ? 5.5 : fase === 2 ? 3.8 : 3) * J.dif.cadenciaEnemiga; }
    }
    e.fx = (e.fx || 0) + dt * 0.5;
    e.yaw = e.yaw0 + Math.sin(e.fx) * 0.18;
    e.alt = 2.4 + Math.sin(e.t * 1.6) * 0.5;
    e.pos = posDesde(e.yaw, e.dist, e.alt);
  }

  function ataqueMedusa(e, dt, n, fase, ultima, cad) {
    if (e.alfa < 0.9) return; // no ataca mientras salta
    e.tDisparo -= dt;
    if (e.tDisparo <= 0) {
      // Anillo de orbes a tu alrededor (quédate quieto) y uno directo (esquívalo)
      const k = ultima ? 7 : 5, rap = (4.6 + n * 0.1) * (ultima ? 1.2 : 1), origen = V.add(e.pos, [0, -0.6, 0]);
      for (let i = 0; i < k; i++) {
        const a = Math.PI * (0.05 + 0.9 * (i / (k - 1))); // arco por arriba y los lados
        dispararOrbe(origen, rap, Math.cos(a) * 2.7, Math.sin(a) * 1.6);
      }
      e.directo = 0.6;
      e.tDisparo = (fase === 1 ? 3.6 : fase === 2 ? 3.1 : 2.5) * cad;
    }
    if (e.directo > 0) {
      e.directo -= dt;
      if (e.directo <= 0) dispararOrbe(V.add(e.pos, [0, -0.6, 0]), 6 + n * 0.15, 0);
    }
    if (fase >= 2) {
      e.tRefuerzo -= dt;
      if (e.tRefuerzo <= 0) {
        e.tRefuerzo = 7.5 * cad;
        const yaw = e.yaw + U.rand(-0.5, 0.5);
        J.entidades.push({ tipo: 'teleport', enemigo: true, yaw, dist: 9, alt: U.rand(0, 1.6), radio: 0.62, hp: 1, t: 0, entrada: 0,
          pos: posDesde(yaw, 9, 0.8), tSalto: 2, tDisparo: 99 });
      }
    }
  }

  /** Zorp, el emperador: cañones gemelos, refuerzos y al final todo su arsenal. */
  function ataqueEmperador(e, dt, n, fase, ultima, cad, q, esc) {
    const canon = (lado) => V.add(e.pos, V.esc(Q.rotar(q, [lado * 1.15, -0.02, 0.74]), esc));
    e.tDisparo -= dt;
    if (e.tDisparo <= 0) {
      if (ultima) { dispararOrbe(canon(e.lado), 7 + n * 0.12, e.lado * 0.4); e.lado = -e.lado; e.tDisparo = 0.62 * cad; }
      else if (fase === 2) { for (let i = 0; i < 5; i++) dispararOrbe(canon(i % 2 ? 1 : -1), 5.8 + n * 0.12, (i - 2) * 0.85); e.tDisparo = 3.0 * cad; }
      else { e.rafaga = 4; e.iRafaga = 0; e.tRafaga = 0; e.tDisparo = 2.6 * cad; }
    }
    if (e.rafaga > 0) {
      e.tRafaga -= dt;
      if (e.tRafaga <= 0) {
        const lado = e.iRafaga % 2 ? 1 : -1;
        dispararOrbe(canon(lado), 6.2 + n * 0.12, lado * 0.35);
        e.rafaga--;
        e.iRafaga++;
        e.tRafaga = 0.28;
      }
    }
    if (fase >= 2) {
      e.tRefuerzo -= dt;
      if (e.tRefuerzo <= 0) {
        e.tRefuerzo = (ultima ? 9 : 6.5) * cad;
        [-1, 1].forEach((l) => J.entidades.push({ tipo: 'dron', enemigo: true, pos: canon(l), radio: 0.6, hp: 1, t: l, vel: 2.5 * J.dif.velocidad }));
        if (!ultima) {
          const yaw = e.yaw + U.rand(-0.4, 0.4);
          J.entidades.push({ tipo: 'blindado', enemigo: true, yaw, dist: 10, alt0: 1.2, alt: 1.2, radio: 0.85, hp: 3, hpMax: 3, t: 0, entrada: 0,
            pos: posDesde(yaw, 10, 1.2), w: (Math.random() < 0.5 ? -1 : 1) * 0.07, tDisparo: 2.5 });
        }
      }
    }
    if (ultima) {
      e.tMeteoro -= dt;
      if (e.tMeteoro <= 0) { lanzarMeteoro(); e.tMeteoro = 4.5 * cad; }
    }
  }

  function buscarObjetivo() {
    let mejor = null, mejorZ = Infinity;
    const ayuda = CONFIG.ayudaApuntado + (GS.Poderes.activo('rafaga') ? 14 : 0);
    J.objetivoOjo = false;
    for (const e of J.entidades) {
      const p = e.proy;
      if (!p || p.detras || e.muerto) continue;
      if (e.alfa != null && e.alfa < 0.35) continue; // la Reina mientras se teletransporta
      const dx = p.x - cx, dy = p.y - cy;
      const r = e.radio * p.k * 1.1 + ayuda;
      if (dx * dx + dy * dy <= r * r && p.z < mejorZ) { mejor = e; mejorZ = p.z; }
    }
    if (mejor && mejor.tipo === 'jefe' && mejor.ojo && mejor.expuesto) {
      const po = proyectar(mejor.ojo);
      if (!po.detras) {
        const ro = mejor.radioOjo * po.k + 12;
        J.objetivoOjo = Math.hypot(po.x - cx, po.y - cy) <= ro;
      }
    }
    return mejor;
  }

  function disparar() {
    if (J.enfriamiento > 0) return;
    J.enfriamiento = CONFIG.cadencia / (GS.Poderes.activo('rafaga') ? 2.5 : 1);
    J.disparos++;
    J.canon = 1 - J.canon;
    J.laseres.push({ t: 0.09, lado: J.canon });
    GS.Sonido.disparo();
    vibrar('disparo');
    if (J.objetivo) golpear(J.objetivo);
  }

  const PUNTOS_TIPO = { ovni: 100, divisor: 150, dron: 150, mini: 75, teleport: 200, blindado: 250, jefe: 1500, orbe: 25 };

  function golpear(e, porBomba) {
    if (e.tipo === 'meteoro') {
      chispas(e.pos, COLORES.meteoro, 8);
      GS.Sonido.rebote();
      if (!J.pistaRebote) {
        J.pistaRebote = true;
        emitir('aviso', 'Los meteoros no se destruyen: ¡esquívalos!', 'peligro');
      }
      return;
    }
    if (e.tipo === 'capsula') { recogerCapsula(e); e.muerto = true; return; }
    if (e.tipo === 'jefe' && e.blindado && !porBomba) {
      // El Rompe-rocas cerró su coraza: los disparos rebotan
      chispas(e.pos, ['#c9a27a', '#ffffff'], 6);
      GS.Sonido.rebote();
      if (!e.avisoBlindado || J.tTotal - e.avisoBlindado > 2) { e.avisoBlindado = J.tTotal; J.textosPantalla.push({ txt: '¡BLINDADO! Espera a que se abra', c: '#e8c39e', t: 0, vida: 0.9 }); }
      return;
    }
    if (!porBomba) { J.aciertos++; J.marcaGolpe = 0.16; }
    const danio = e.tipo === 'jefe' && J.objetivoOjo ? 3 : 1;
    e.hp -= danio;
    e.golpeT = 0.1;
    if (e.hp > 0) {
      GS.Sonido.impacto();
      chispas(e.ojo && danio > 1 ? e.ojo : e.pos, danio > 1 ? ['#ff3355', '#ffffff'] : ['#ffffff', '#c9b3ff'], danio > 1 ? 12 : 6);
      if (danio > 1) { J.textosPantalla.push({ txt: '¡PUNTO DÉBIL! x3', c: '#ff6b81', t: 0, vida: 0.7 }); J.congelar(0.04); vibrar('puntoDebil'); }
      if (e.tipo === 'blindado' && e.hp === 1) { chispas(e.pos, ['#6fb6ff', '#ffffff'], 16); emitir('escudoRoto'); }
      return;
    }
    e.muerto = true;
    if (e.enemigo) {
      J.congelar(e.tipo === 'jefe' ? 0.18 : 0.045);
      vibrar(e.tipo === 'jefe' ? 'jefeMuerto' : 'kill');
      J.kills++;
      GS.Progreso.evento('kill');
      J.combo = J.comboT > 0 ? J.combo + 1 : 1;
      J.comboT = 3;
      GS.Progreso.evento('combo', J.combo);
      if (J.combo >= 3) GS.Sonido.combo(Math.min(J.combo, 12));
      if (J.modo === 'online') {
        J.carga++;
        if (J.carga >= CONFIG.killsParaAtaque) { J.carga = 0; emitir('ataque', 3); }
      }
      emitir('combo');
      if (J.tutorial) emitir('tutKill');
      // A veces dejan caer un poder
      if (e.tipo !== 'jefe' && !e.tutorial && Math.random() < (J.esReto('poderes') ? 0.2 : 0.09)) soltarCapsula(e.pos);
    }
    const pts = J.sumarPuntos(PUNTOS_TIPO[e.tipo] || 50, e.enemigo);
    textoFlotante(e.pos, '+' + pts, !e.enemigo ? '#ffb3f8' : J.multiplicador() > 1 ? '#ffd23f' : '#ffffff');
    explotar(e);
    if (e.tipo === 'divisor') {
      // Se parte en dos minis rapidísimos
      [-1, 1].forEach((lado) => {
        const p = V.add(e.pos, [lado * 0.8, 0.2, 0]);
        J.entidades.push({ tipo: 'dron', mini: true, enemigo: true, pos: p, radio: 0.42, hp: 1, t: lado, vel: 3.3 * J.dif.velocidad });
      });
    }
    if (e.tipo === 'jefe') {
      GS.Progreso.evento('jefe');
      J.camaraLenta = 1.6;
      J.flash = 0.6;
      J.flashColor = '255,255,255';
      for (let i = 0; i < 5; i++) J.explosionesJefe.push({ t: 0.12 + i * 0.22, pos: V.add(e.pos, [U.rand(-2, 2), U.rand(-1, 1), U.rand(-1, 1)]) });
      if (J.vidas < J.vidasMax) { J.vidas++; emitir('vidas'); }
      emitir('aviso', e.def.muerte + ' +1 ❤︎', 'exito');
      if (J.modo === 'online') emitir('ataque', 5);
      GS.Musica.tocar('juego');
    }
  }

  function recogerCapsula(e) {
    const d = GS.Poderes.TIPOS[e.poder];
    chispas(e.pos, [d.css, '#ffffff'], 18);
    GS.Poderes.activar(e.poder);
    J.textosPantalla.push({ txt: d.nombre.toUpperCase(), c: d.css, t: 0, vida: 1.2 });
    if (J.tutorial) emitir('tutPoder');
  }

  /** Ángulo en pantalla hacia donde vino el golpe (null si venía de frente, porque ya lo viste). */
  function anguloDesde(e) {
    if (!e || !e.pos) return null;
    const d = e.vel ? V.esc(e.vel, -1) : V.sub(e.pos, camPos);
    const v = Q.rotar(camInv, d);
    const lado = Math.hypot(v[0], v[1]);
    if (v[2] > 0 && lado < 0.35 * V.len(v)) return Math.PI / 2; // por la espalda: abajo
    if (v[2] <= 0 && lado < 0.18 * V.len(v)) return null;
    return Math.atan2(-v[1], v[0]);
  }

  function recibirDanio(fuente) {
    if (J.invul > 0 || !J.vivo) return false;
    const ang = anguloDesde(fuente);
    if (GS.Poderes.usarEscudo()) {
      J.marcarGolpe(ang, '56,248,255');
      vibrar('escudo');
      J.invul = 1;
      J.flash = 0.35;
      J.flashColor = '56,248,255';
      GS.Sonido.escudo();
      J.textosPantalla.push({ txt: '¡EL ESCUDO TE SALVÓ!', c: '#38f8ff', t: 0, vida: 1.1 });
      return true;
    }
    if (J.tutorial) { J.flash = 0.4; J.flashColor = '255,0,40'; GS.Sonido.danio(); J.invul = 1; return true; }
    J.vidas--;
    J.vidasPerdidas++;
    J.tSinDanio = 0;
    J.invul = 1.3;
    J.flash = 0.55;
    J.flashColor = '255,0,40';
    J.sacudida = 1;
    J.marcarGolpe(ang);
    J.congelar(0.09);
    if (J.combo) { J.combo = 0; J.comboT = 0; emitir('combo'); }
    GS.Sonido.danio();
    vibrar('golpe');
    emitir('vidas');
    if (J.vidas <= 0) {
      J.vivo = false;
      J.gatillo = false;
      emitir('muerte');
      if (J.modo === 'solo') J.finEn = 1.4;
    }
    return true;
  }

  function esquivado(e) {
    if (!J.vivo) return;
    J.esquivados++;
    if (e.tipo === 'meteoro') GS.Progreso.evento('meteoro');
    if (J.tutorial && e.tipo === 'meteoro') emitir('tutEsquivo');
    const pts = J.sumarPuntos(e.tipo === 'meteoro' ? 50 : 25, false);
    J.textosPantalla.push({ txt: '¡ESQUIVADO! +' + pts, c: '#38f8ff', t: 0, vida: 1 });
    GS.Sonido.esquivado();
  }

  /* ---------------- Efectos ---------------- */
  function explotar(e) {
    const cols = COLORES[e.tipo] || ['#ffffff'];
    const jefe = e.tipo === 'jefe';
    let n = jefe ? 70 : e.tipo === 'orbe' ? 12 : 28;
    if (GS.Ajustes.calidadBaja()) n = Math.ceil(n * 0.45);
    const fuerza = jefe ? 7 : 3.5;
    for (let i = 0; i < n; i++) {
      const d = V.norm([Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1]);
      J.particulas.push({
        p: e.pos.slice(), v: V.esc(d, fuerza * (0.4 + Math.random())), t: 0, vida: 0.5 + Math.random() * 0.6,
        tam: (jefe ? 0.25 : 0.12) * (0.6 + Math.random()), c: cols[(Math.random() * cols.length) | 0]
      });
    }
    J.particulas.push({ p: e.pos.slice(), v: [0, 0, 0], t: 0, vida: 0.35, tam: e.radio * 1.6, c: '#ffffff', anillo: true });
    GS.Sonido.explosion(jefe);
    if (jefe) J.sacudida = 1.2;
  }

  function chispas(p, cols, n) {
    if (GS.Ajustes.calidadBaja()) n = Math.ceil(n * 0.5);
    for (let i = 0; i < n; i++) {
      const d = V.norm([Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1]);
      J.particulas.push({ p: p.slice(), v: V.esc(d, 2 + Math.random() * 2), t: 0, vida: 0.25 + Math.random() * 0.2, tam: 0.06, c: cols[(Math.random() * cols.length) | 0] });
    }
  }

  function textoFlotante(p, txt, c) {
    J.textos.push({ p: p.slice(), txt, c, t: 0, vida: 0.9 });
  }

  function actualizarEfectos(dt) {
    for (const pa of J.particulas) {
      pa.t += dt;
      pa.p = V.add(pa.p, V.esc(pa.v, dt));
      pa.v = V.esc(pa.v, Math.exp(-dt * 2.5));
    }
    J.particulas = J.particulas.filter((pa) => pa.t < pa.vida);
    for (const tx of J.textos) { tx.t += dt; tx.p[1] += dt * 0.8; }
    J.textos = J.textos.filter((tx) => tx.t < tx.vida);
    for (const tx of J.textosPantalla) tx.t += dt;
    J.textosPantalla = J.textosPantalla.filter((tx) => tx.t < tx.vida);
    for (const l of J.laseres) l.t -= dt;
    J.laseres = J.laseres.filter((l) => l.t > 0);
  }

  /* ---------------- Dibujo ---------------- */
  J.dibujar = function () {
    if (J.tipoJuego === 'esquiva' && J.estado !== 'menu') { GS.Esquiva.dibujar(); return; }
    let sx = 0, sy = 0;
    if (J.sacudida > 0.02) {
      const s = J.sacudida * 9;
      sx = U.rand(-s, s);
      sy = U.rand(-s, s);
    }
    const enJuego = J.estado === 'jugando' || J.estado === 'pausa' || J.estado === 'fin';

    // 1) Fondo: espacio (sin cámara) o viñeta sobre la cámara
    fctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    fctx.clearRect(0, 0, W, H);
    if (GS.Sensores.camaraActiva) dibujarVineta();
    else dibujarEspacio();
    if (J.usar3D && enJuego) {
      fctx.save();
      fctx.translate(sx, sy);
      dibujarEstelas();
      fctx.restore();
    }

    // 2) Aliens en 3D
    if (J.usar3D && GS.Motor3D.listo) {
      const M3 = GS.Motor3D;
      M3.comenzar(camInv, camPos, sx, sy);
      if (J.estado === 'menu') dibujarDecor3D();
      else if (enJuego) for (const e of J.entidades) dibujarEntidad3D(e);
      M3.terminar();
    }

    // 3) Capa de arriba: brillos, partículas, textos y HUD
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(sx, sy);
    if (J.usar3D) {
      if (enJuego) dibujarEfectos3D();
    } else {
      if (J.estado === 'menu') dibujarDecor();
      if (enJuego) {
        const lista = J.entidades.filter((e) => e.proy && !e.proy.detras).sort((a, b) => b.proy.z - a.proy.z);
        for (const e of lista) dibujarEntidad(e);
      }
    }
    dibujarParticulas();
    dibujarTextos();
    ctx.restore();

    if (J.estado === 'jugando' || J.estado === 'pausa') dibujarHUD();
    else if (J.estado === 'cuenta') dibujarMira();
  };

  /* ---------- Dibujo 3D ---------- */
  function haciaJugador(pos, extra) {
    const yaw = Math.atan2(camPos[0] - pos[0], camPos[2] - pos[2]);
    return extra ? Q.mult(Q.eje(0, 1, 0, yaw), extra) : Q.eje(0, 1, 0, yaw);
  }

  function visible(e) {
    const p = e.proy;
    if (!p || p.detras) return false;
    const r = e.radio * p.k * 2;
    return !(p.x < -r || p.x > W + r || p.y < -r || p.y > H + r);
  }

  function dibujarEntidad3D(e) {
    if (!visible(e)) return;
    const M = GS.Modelos, M3 = GS.Motor3D;
    const opc = { t: e.t, destello: e.golpeT > 0 ? 0.85 : 0 };
    switch (e.tipo) {
      case 'ovni':
      case 'divisor':
      case 'blindado': {
        const esc = e.radio * (e.entrada < 1 ? Math.max(0.01, U.easeOutBack(e.entrada)) : 1);
        const incl = Q.mult(Q.eje(1, 0, 0, 0.14 + Math.sin(e.t * 1.7) * 0.06), Q.eje(0, 0, 1, Math.sin(e.t * 1.3) * 0.09));
        const q = haciaJugador(e.pos, incl);
        if (e.tipo === 'divisor') opc.colores = COLORES_3D.divisor;
        if (e.tipo === 'blindado') opc.colores = COLORES_3D.blindado;
        M3.dibujarModelo(M.ovni, e.pos, q, esc, opc);
        if (e.tipo === 'blindado' && e.hp > 1) {
          // Escudo: se ve más débil con cada disparo
          M3.dibujarModelo(M.escudo, e.pos, q, esc * 1.55, { t: e.t, alfa: 0.45 + 0.3 * (e.hp - 1), destello: opc.destello });
        }
        break;
      }
      case 'dron':
      case 'teleport': {
        const incl = Q.mult(Q.eje(1, 0, 0, 0.2), Q.eje(0, 0, 1, Math.sin(e.t * 5) * 0.2));
        if (e.tipo === 'teleport') { opc.colores = COLORES_3D.teleport; opc.alfa = 0.35 + 0.65 * e.entrada; }
        else if (e.mini) opc.colores = COLORES_3D.mini;
        M3.dibujarModelo(M.dron, e.pos, haciaJugador(e.pos, incl), e.radio, opc);
        break;
      }
      case 'jefe': {
        const esc = e.radio * Math.max(0.01, U.easeOutBack(e.entrada));
        const incl = Q.eje(1, 0, 0, 0.2 + Math.sin(e.t * 0.9) * 0.05);
        opc.colores = Object.assign({}, e.colores || {}, e.expuesto || e.fase > 1 ? COLORES_FASE[e.expuesto ? 3 : 2] : {});
        if (e.alfa < 1) opc.alfa = e.alfa;
        const qj = haciaJugador(e.pos, incl);
        M3.dibujarModelo(M[e.def.modelo] || M.jefe, e.pos, qj, esc, opc);
        // Coraza de roca del Rompe-rocas
        if (e.blindado) M3.dibujarModelo(M.escudo, e.pos, qj, esc * 1.45, { t: e.t, alfa: 0.75, colores: { escudo: [0.85, 0.55, 0.3] }, destello: opc.destello });
        break;
      }
      case 'capsula': {
        const d = GS.Poderes.TIPOS[e.poder];
        const parpadeo = e.vida < 3 && Math.floor(e.t * 8) % 2 === 0;
        M3.dibujarModelo(M.capsula, e.pos, Q.eje(0, 1, 0, e.t), e.radio, { t: e.t, colores: { nucleo: d.rgb, aro: d.rgb }, alfa: parpadeo ? 0.4 : 1 });
        break;
      }
      case 'orbe':
        M3.dibujarModelo(M.orbe, e.pos, Q.identidad(), e.radio, opc);
        break;
      case 'meteoro':
        M3.dibujarModelo(M.meteoro[e.vari], e.pos, e.q, e.radio, opc);
        break;
    }
  }

  const COLORES_3D = {
    divisor: { cuerpo: [1, 0.6, 0.25], aro: [1, 0.3, 0.2], motor: [1, 0.65, 0.2] },
    blindado: { cuerpo: [0.36, 0.42, 0.55], aro: [0.35, 0.65, 1], motor: [0.4, 0.7, 1] },
    teleport: { cabeza: [0.62, 0.42, 1], cuerpo: [0.36, 0.2, 0.7], antena: [0.4, 0.95, 1] },
    mini: { cabeza: [1, 0.82, 0.3], cuerpo: [0.8, 0.5, 0.1] }
  };
  const COLORES_FASE = {
    2: { aro: [1, 0.55, 0.15], nucleo: [1, 0.6, 0.2] },
    3: { aro: [1, 0.15, 0.2], ojo: [1, 0.85, 0.85], nucleo: [1, 0.2, 0.25] }
  };

  function dibujarDecor3D() {
    for (const d of decor) {
      const pos = posDesde(d.yaw, d.dist, d.alt + Math.sin(d.t * 1.3) * 0.3);
      const incl = Q.mult(Q.eje(1, 0, 0, 0.16), Q.eje(0, 0, 1, Math.sin(d.t * 1.1) * 0.1));
      GS.Motor3D.dibujarModelo(GS.Modelos.ovni, pos, haciaJugador(pos, incl), 0.85, { t: d.t });
    }
  }

  /** Estela de fuego de los meteoros (detrás de los modelos 3D). */
  function dibujarEstelas() {
    for (const e of J.entidades) {
      if (e.tipo !== 'meteoro' || !visible(e)) continue;
      const p = e.proy, cola = proyectar(V.sub(e.pos, V.esc(V.norm(e.vel), 3.5)));
      if (cola.detras) continue;
      fctx.save();
      fctx.globalCompositeOperation = 'lighter';
      const gr = fctx.createLinearGradient(cola.x, cola.y, p.x, p.y);
      gr.addColorStop(0, 'rgba(255,90,20,0)');
      gr.addColorStop(1, 'rgba(255,150,50,0.8)');
      fctx.strokeStyle = gr;
      fctx.lineCap = 'round';
      fctx.lineWidth = e.radio * p.k * 1.5;
      fctx.beginPath();
      fctx.moveTo(cola.x, cola.y);
      fctx.lineTo(p.x, p.y);
      fctx.stroke();
      fctx.restore();
    }
  }

  /** Brillos y avisos 2D encima de los modelos 3D. */
  function dibujarEfectos3D() {
    const SP = GS.Sprites;
    ctx.globalCompositeOperation = 'lighter';
    for (const e of J.entidades) {
      if (!visible(e)) continue;
      const p = e.proy, r = e.radio * p.k;
      if (e.tipo === 'orbe') {
        const w = r * 4.2 * (1 + Math.sin(e.t * 20) * 0.08);
        ctx.drawImage(SP.orbe, p.x - w / 2, p.y - w / 2, w, w);
      } else if (e.tipo === 'capsula') {
        const w = r * 3.4 * (1 + Math.sin(e.t * 6) * 0.1);
        ctx.globalAlpha = 0.7;
        ctx.drawImage(SP.brilloVerde, p.x - w / 2, p.y - w / 2, w, w);
        ctx.globalAlpha = 1;
      } else if (e.tipo === 'teleport' && e.entrada < 1) {
        ctx.strokeStyle = 'rgba(182,140,255,' + (1 - e.entrada).toFixed(2) + ')';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * (1 + 2 * (1 - e.entrada)), 0, TAU);
        ctx.stroke();
      } else if (e.tipo === 'ovni' || e.tipo === 'divisor' || e.tipo === 'blindado') {
        const abajo = proyectar(V.add(e.pos, [0, -0.32 * e.radio, 0]));
        if (!abajo.detras) {
          const w = r * 2.2;
          ctx.globalAlpha = 0.55;
          ctx.drawImage(SP.brilloVerde, abajo.x - w / 2, abajo.y - w * 0.3, w, w * 0.6);
          ctx.globalAlpha = 1;
          if (e.tDisparo < 0.6 && J.vivo) {
            // Aviso: está cargando un disparo
            const a = 1 - e.tDisparo / 0.6, w2 = r * 1.6 * a;
            ctx.drawImage(SP.orbe, abajo.x - w2 / 2, abajo.y - w2 / 2, w2, w2);
          }
        }
        if (e.entrada < 1) {
          ctx.strokeStyle = 'rgba(56,248,255,' + (1 - e.entrada).toFixed(2) + ')';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r * 3 * (1 - e.entrada) + 2, 0, TAU);
          ctx.stroke();
        }
      } else if (e.tipo === 'meteoro') {
        const w = r * 3;
        ctx.globalAlpha = 0.45;
        ctx.drawImage(SP.brilloFuego, p.x - w / 2, p.y - w / 2, w, w);
        ctx.globalAlpha = 1;
      } else if (e.tipo === 'jefe' && e.entrada < 1) {
        ctx.strokeStyle = 'rgba(199,125,255,' + (1 - e.entrada).toFixed(2) + ')';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 2.5 * (1 - e.entrada) + 4, 0, TAU);
        ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    // Ícono del poder dentro de cada cápsula
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const e of J.entidades) {
      if (e.tipo !== 'capsula' || !visible(e)) continue;
      const p = e.proy;
      dibujarIconoPoder(ctx, GS.Poderes.TIPOS[e.poder], p.x, p.y, e.radio * p.k);
    }
    // Punto débil del jefe en la fase 3
    const jf = J.jefe;
    if (jf && jf.expuesto && jf.ojo && jf.alfa > 0.5) {
      const po = proyectar(jf.ojo);
      if (!po.detras) {
        const pul = 1 + Math.sin(performance.now() / 90) * 0.15;
        ctx.strokeStyle = J.objetivoOjo ? 'rgba(255,255,255,0.95)' : 'rgba(255,60,80,0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(po.x, po.y, (jf.radioOjo * po.k + 8) * pul, 0, TAU);
        ctx.stroke();
      }
    }
    // Anillo rojo de peligro en los meteoros
    for (const e of J.entidades) {
      if (e.tipo !== 'meteoro' || !e.alertado || !visible(e)) continue;
      const p = e.proy, r = e.radio * p.k;
      ctx.strokeStyle = 'rgba(255,60,50,0.9)';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 1.6 * (1 + Math.sin(e.t * 18) * 0.12), 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  /* ---------- Fondo ---------- */
  function dibujarVineta() {
    const ctx = fctx;
    if (!vineta) {
      vineta = ctx.createRadialGradient(cx, cy, Math.min(W, H) * 0.35, cx, cy, Math.max(W, H) * 0.75);
      vineta.addColorStop(0, 'rgba(0,0,20,0)');
      vineta.addColorStop(1, 'rgba(0,0,25,0.5)');
    }
    ctx.fillStyle = vineta;
    ctx.fillRect(0, 0, W, H);
  }

  function dibujarEspacio() {
    const ctx = fctx;
    const cielo = J.estado !== 'menu' && J.tema ? J.tema.cielo : ['#04040d', '#0b0820'];
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, cielo[0]);
    g.addColorStop(1, cielo[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.globalCompositeOperation = 'lighter';
    const colNeb = J.estado !== 'menu' && J.tema ? J.tema.nebulosas : null;
    nebulosas.forEach((n, i) => {
      const v = Q.rotar(camInv, n.d);
      if (v[2] > -0.05) return;
      const z = -v[2], x = cx + (v[0] / z) * F, y = cy - (v[1] / z) * F, r = n.r * F;
      const c = colNeb ? colNeb[i % colNeb.length] : n.c;
      const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, c + '0.22)');
      gr.addColorStop(1, c + '0)');
      ctx.fillStyle = gr;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    });
    for (const s of estrellas) {
      const v = Q.rotar(camInv, s.d);
      if (v[2] > -0.05) continue;
      const z = -v[2], x = cx + (v[0] / z) * F, y = cy - (v[1] / z) * F;
      if (x < -2 || x > W + 2 || y < -2 || y > H + 2) continue;
      ctx.fillStyle = 'rgba(255,255,255,' + (0.35 + s.b * 0.65).toFixed(2) + ')';
      ctx.fillRect(x, y, s.s, s.s);
    }
    ctx.globalCompositeOperation = 'source-over';

    // Piso holográfico para dar sensación de profundidad
    ctx.strokeStyle = (J.estado !== 'menu' && J.tema ? J.tema.suelo : 'rgba(56,248,255,') + '0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const y = -1.7, L = 24;
    for (let i = -L; i <= L; i += 2) {
      linea3D([i, y, -L], [i, y, L]);
      linea3D([-L, y, i], [L, y, i]);
    }
    ctx.stroke();
  }

  function linea3D(a, b) {
    const ctx = fctx;
    let p = aCamara(a), q = aCamara(b);
    const cerca = -0.2;
    if (p[2] > cerca && q[2] > cerca) return;
    if (p[2] > cerca) {
      const t = (cerca - p[2]) / (q[2] - p[2]);
      p = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, cerca];
    } else if (q[2] > cerca) {
      const t = (cerca - q[2]) / (p[2] - q[2]);
      q = [q[0] + (p[0] - q[0]) * t, q[1] + (p[1] - q[1]) * t, cerca];
    }
    ctx.moveTo(cx + (p[0] / -p[2]) * F, cy - (p[1] / -p[2]) * F);
    ctx.lineTo(cx + (q[0] / -q[2]) * F, cy - (q[1] / -q[2]) * F);
  }

  function dibujarDecor() {
    for (const d of decor) {
      const pos = posDesde(d.yaw, d.dist, d.alt + Math.sin(d.t * 1.3) * 0.3);
      const p = proyectar(pos);
      if (p.detras) continue;
      const sp = GS.Sprites.ovni[((d.t * 4) | 0) % 2];
      const w = 0.85 * p.k * 2.5, h = w * (sp.height / sp.width);
      ctx.drawImage(sp, p.x - w / 2, p.y - h * 0.56, w, h);
    }
  }

  function dibujarEntidad(e) {
    const p = e.proy, r = e.radio * p.k, SP = GS.Sprites;
    if (p.x < -r * 3 || p.x > W + r * 3 || p.y < -r * 3 || p.y > H + r * 3) return;

    if (e.tipo === 'meteoro') {
      // Estela de fuego
      const cola = proyectar(V.sub(e.pos, V.esc(V.norm(e.vel), 3)));
      if (!cola.detras) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const gr = ctx.createLinearGradient(cola.x, cola.y, p.x, p.y);
        gr.addColorStop(0, 'rgba(255,90,20,0)');
        gr.addColorStop(1, 'rgba(255,160,60,0.75)');
        ctx.strokeStyle = gr;
        ctx.lineCap = 'round';
        ctx.lineWidth = r * 1.4;
        ctx.beginPath();
        ctx.moveTo(cola.x, cola.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(angArriba);
    const golpeado = e.golpeT > 0;
    let tipo2D = e.tipo;
    if (tipo2D === 'divisor' || tipo2D === 'blindado') tipo2D = 'ovni';
    if (tipo2D === 'teleport') tipo2D = 'dron';
    switch (tipo2D) {
      case 'ovni': {
        const esc = e.entrada < 1 ? Math.max(0.01, U.easeOutBack(e.entrada)) : 1;
        if (e.entrada < 1) {
          ctx.strokeStyle = 'rgba(56,248,255,' + (1 - e.entrada).toFixed(2) + ')';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 0, r * 3 * (1 - e.entrada) + 2, 0, TAU);
          ctx.stroke();
        }
        if (e.tDisparo < 0.6 && J.vivo) {
          // Aviso: está cargando un disparo
          const a = 1 - e.tDisparo / 0.6;
          ctx.globalCompositeOperation = 'lighter';
          ctx.drawImage(SP.orbe, -r * 0.6 * a, r * 0.25 - r * 0.6 * a, r * 1.2 * a, r * 1.2 * a);
          ctx.globalCompositeOperation = 'source-over';
        }
        const sp = golpeado ? SP.ovniBlanco : SP.ovni[((e.t * 4) | 0) % 2];
        const w = r * 2.5 * esc, h = w * (sp.height / sp.width);
        ctx.drawImage(sp, -w / 2, -h * 0.56, w, h);
        break;
      }
      case 'dron': {
        ctx.rotate(Math.sin(e.t * 5) * 0.15);
        const sp = golpeado ? SP.dronBlanco : SP.dron[((e.t * 12) | 0) % 2];
        const w = r * 2.6;
        ctx.drawImage(sp, -w / 2, -w * 0.45, w, w);
        break;
      }
      case 'jefe': {
        const esc = Math.max(0.01, U.easeOutBack(e.entrada));
        const sp = golpeado ? SP.jefeBlanco : SP.jefe;
        const w = r * 2.4 * esc, h = w * (sp.height / sp.width);
        ctx.drawImage(sp, -w / 2, -h * 0.57, w, h);
        break;
      }
      case 'orbe': {
        ctx.globalCompositeOperation = 'lighter';
        const w = r * 3.2 * (1 + Math.sin(e.t * 20) * 0.08);
        ctx.drawImage(SP.orbe, -w / 2, -w / 2, w, w);
        break;
      }
      case 'capsula': {
        // Cápsula de poder (dibujo 2D de respaldo)
        const d = GS.Poderes.TIPOS[e.poder] || { css: '#ffffff', corto: '?' };
        const w = r * 3.2 * (1 + Math.sin(e.t * 6) * 0.1);
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(SP.brilloVerde, -w / 2, -w / 2, w, w);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(10,16,40,0.85)';
        ctx.strokeStyle = d.css;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, r * 0.95, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        dibujarIconoPoder(ctx, d, 0, 1, r * 1.2);
        break;
      }
      case 'meteoro': {
        if (e.alertado) {
          const pulso = 1 + Math.sin(e.t * 18) * 0.12;
          ctx.strokeStyle = 'rgba(255,60,50,0.9)';
          ctx.lineWidth = 3;
          ctx.setLineDash([8, 6]);
          ctx.beginPath();
          ctx.arc(0, 0, r * 1.6 * pulso, 0, TAU);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.rotate(e.rot);
        const w = r * 2.6;
        ctx.drawImage(SP.meteoro[e.vari], -w / 2, -w / 2, w, w);
        break;
      }
    }
    ctx.restore();
  }

  function dibujarParticulas() {
    ctx.globalCompositeOperation = 'lighter';
    for (const pa of J.particulas) {
      const p = proyectar(pa.p);
      if (p.detras || p.z < 0.9) continue; // demasiado cerca de la cámara: se vería como un círculo gigante
      const a = 1 - pa.t / pa.vida;
      if (pa.anillo) {
        ctx.globalAlpha = a * 0.8;
        ctx.strokeStyle = pa.c;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, pa.tam * p.k * (0.4 + (pa.t / pa.vida) * 1.6), 0, TAU);
        ctx.stroke();
        continue;
      }
      ctx.globalAlpha = a;
      ctx.fillStyle = pa.c;
      ctx.beginPath();
      ctx.arc(p.x, p.y, U.clamp(pa.tam * p.k * (0.5 + a * 0.5), 1, 28), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function dibujarTextos() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const tx of J.textos) {
      const p = proyectar(tx.p);
      if (p.detras) continue;
      ctx.globalAlpha = 1 - tx.t / tx.vida;
      ctx.font = '800 ' + Math.round(U.clamp(p.k * 0.45, 14, 34)) + 'px Orbitron, sans-serif';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.strokeText(tx.txt, p.x, p.y);
      ctx.fillStyle = tx.c;
      ctx.fillText(tx.txt, p.x, p.y);
    }
    for (const tx of J.textosPantalla) {
      ctx.globalAlpha = 1 - tx.t / tx.vida;
      ctx.font = '800 20px Orbitron, sans-serif';
      ctx.fillStyle = tx.c;
      ctx.fillText(tx.txt, cx, cy - 64 - tx.t * 30);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------- HUD dibujado ---------------- */
  function dibujarHUD() {
    dibujarLaseres();
    dibujarIndicadores();
    dibujarMira();
    dibujarRadar();
    dibujarBarraJefe();
    dibujarMedidorEsquive();

    if (J.alertaT > 0) {
      ctx.strokeStyle = 'rgba(255,40,40,' + (0.35 + 0.35 * Math.sin(performance.now() / 60)).toFixed(2) + ')';
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, W - 10, H - 10);
    }
    J.dibujarAuras(ctx, W, H);
  }

  /** Destellos de pantalla (daño, bomba, escudo) y borde del escudo/cámara lenta. Lo usan los dos modos. */
  J.dibujarAuras = function (g, W, H) {
    dibujarMarcasGolpe(g, W, H);
    const c = J.flashColor || '255,0,40';
    if (J.flash > 0) {
      const gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.7);
      gr.addColorStop(0, 'rgba(' + c + ',0)');
      gr.addColorStop(1, 'rgba(' + c + ',' + Math.min(0.75, J.flash * 1.4).toFixed(2) + ')');
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
    }
    const P = GS.Poderes;
    if (P.activo('escudo') || P.activo('lento')) {
      const col = P.activo('escudo') ? '56,248,255' : '199,125,255';
      const a = 0.25 + 0.12 * Math.sin(performance.now() / 220);
      const gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.72);
      gr.addColorStop(0, 'rgba(' + col + ',0)');
      gr.addColorStop(1, 'rgba(' + col + ',' + a.toFixed(2) + ')');
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
    }
  };

  /** Nombre corto del poder escrito sobre la cápsula (ESCUDO, x2, BOMBA…). */
  function dibujarIconoPoder(g, d, x, y, tam) {
    g.save();
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '800 ' + Math.round(U.clamp(tam * (d.corto.length > 3 ? 0.36 : 0.6), 8, 22)) + 'px Orbitron, sans-serif';
    g.fillStyle = '#ffffff';
    g.shadowColor = d.css;
    g.shadowBlur = 8;
    g.fillText(d.corto, x, y);
    g.restore();
  }
  J.dibujarIconoPoder = dibujarIconoPoder;

  /** Arcos en el borde que señalan de dónde vino cada golpe. */
  function dibujarMarcasGolpe(g, W, H) {
    if (!J.golpesDir || !J.golpesDir.length) return;
    const rx = W * 0.43, ry = H * 0.4, cxp = W / 2, cyp = H / 2;
    g.save();
    g.lineCap = 'round';
    for (const m of J.golpesDir) {
      const a = Math.max(0, 1 - m.t / 1.1), pul = 1 + Math.sin(m.t * 22) * 0.08 * a;
      const col = 'rgba(' + m.c + ',' + (0.9 * a).toFixed(2) + ')';
      g.strokeStyle = col;
      g.fillStyle = col;
      g.shadowColor = 'rgba(' + m.c + ',1)';
      g.shadowBlur = 18;
      g.lineWidth = 9 * pul;
      g.beginPath();
      g.ellipse(cxp, cyp, rx, ry, 0, m.ang - 0.32, m.ang + 0.32);
      g.stroke();
      // Flecha que apunta hacia afuera, hacia el atacante
      const ca = Math.cos(m.ang), sa = Math.sin(m.ang);
      const px = cxp + (rx + 16) * ca, py = cyp + (ry + 16) * sa;
      g.beginPath();
      g.moveTo(px + ca * 16, py + sa * 16);
      g.lineTo(px - sa * 15 - ca * 6, py + ca * 15 - sa * 6);
      g.lineTo(px + sa * 15 - ca * 6, py - ca * 15 - sa * 6);
      g.closePath();
      g.fill();
    }
    g.restore();
  }

  function dibujarLaseres() {
    const colorLaser = GS.Progreso.nave().laser;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const l of J.laseres) {
      const a = l.t / 0.09;
      const x0 = l.lado ? W * 0.86 : W * 0.14, y0 = H + 10;
      ctx.strokeStyle = 'rgba(' + colorLaser + ',' + (0.35 * a).toFixed(2) + ')';
      ctx.lineWidth = GS.Poderes.activo('rafaga') ? 16 : 12;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(cx, cy); ctx.stroke();
      ctx.strokeStyle = 'rgba(220,255,255,' + (0.9 * a).toFixed(2) + ')';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(cx, cy); ctx.stroke();
      ctx.fillStyle = 'rgba(180,255,255,' + (0.6 * a).toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(cx, cy, 10 * a + 3, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function dibujarMira() {
    const obj = J.estado === 'jugando' ? J.objetivo : null;
    const roca = obj && obj.tipo === 'meteoro';
    const color = obj ? (roca ? '#ffb347' : '#ff3355') : 'rgba(255,255,255,0.92)';
    const r = obj ? 15 : 20;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(r + 4, 0);
      ctx.lineTo(r + 12, 0);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, 2.2, 0, TAU);
    ctx.fill();
    if (J.marcaGolpe > 0) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.rotate(Math.PI / 4);
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(16, 0);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function dibujarIndicadores() {
    const t = performance.now() / 1000;
    for (const e of J.entidades) {
      const p = e.proy;
      if (!p) continue;
      if (!p.detras && p.x > 0 && p.x < W && p.y > 0 && p.y < H) continue;
      let dx = p.v[0], dy = -p.v[1];
      if (Math.abs(dx) < 1e-3 && Math.abs(dy) < 1e-3) dy = 1;
      const ang = Math.atan2(dy, dx), c = Math.cos(ang), s = Math.sin(ang);
      const mx = W / 2 - 30, my = H / 2 - 74;
      const k = Math.min(mx / Math.max(Math.abs(c), 1e-4), my / Math.max(Math.abs(s), 1e-4));
      const peligro = e.tipo === 'orbe' || e.tipo === 'meteoro' || (e.tipo === 'dron' && V.dist(e.pos, camPos) < 8);
      const tam = (e.tipo === 'jefe' ? 16 : 11) * (peligro ? 1 + 0.25 * Math.sin(t * 14) : 1);
      ctx.save();
      ctx.translate(cx + c * k, cy + s * k);
      ctx.rotate(ang);
      ctx.fillStyle = COLOR_INDICADOR[e.tipo];
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(tam, 0);
      ctx.lineTo(-tam * 0.7, tam * 0.75);
      ctx.lineTo(-tam * 0.35, 0);
      ctx.lineTo(-tam * 0.7, -tam * 0.75);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function dibujarRadar() {
    const R = 46, zurdo = GS.Ajustes.get('zurdo');
    const x0 = zurdo ? W - 18 - R - seguro.r : 18 + R + seguro.l, y0 = H - 18 - R - seguro.b;
    J.zonaRadar = { x: x0, y: y0, r: R };
    ctx.save();
    ctx.fillStyle = 'rgba(5,10,30,0.55)';
    ctx.strokeStyle = 'rgba(56,248,255,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x0, y0, R, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(56,248,255,0.2)';
    ctx.beginPath(); ctx.arc(x0, y0, R * 0.5, 0, TAU); ctx.stroke();
    const fov = Math.atan(W / 2 / F);
    ctx.fillStyle = 'rgba(56,248,255,0.13)';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.arc(x0, y0, R, -Math.PI / 2 - fov, -Math.PI / 2 + fov);
    ctx.closePath();
    ctx.fill();
    for (const e of J.entidades) {
      const rel = V.sub(e.pos, camPos), d = Math.hypot(rel[0], rel[2]);
      const ang = Math.atan2(-rel[0], -rel[2]) - camYaw; // + = a tu izquierda
      const rr = Math.min(d / 22, 1) * (R - 5);
      ctx.fillStyle = COLOR_INDICADOR[e.tipo];
      ctx.beginPath();
      ctx.arc(x0 - Math.sin(ang) * rr, y0 - Math.cos(ang) * rr, e.tipo === 'jefe' ? 5 : e.enemigo ? 3.2 : 2.2, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x0, y0 - 5);
    ctx.lineTo(x0 + 4, y0 + 4);
    ctx.lineTo(x0 - 4, y0 + 4);
    ctx.closePath();
    ctx.fill();
    ctx.font = '700 9px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(159,179,200,0.8)';
    ctx.fillText('TOCA: CENTRAR', x0, y0 + R + 10);
    ctx.restore();
  }

  function dibujarBarraJefe() {
    const e = J.jefe;
    if (!e) return;
    const w = Math.min(280, W * 0.62), x = cx - w / 2, y = 92 + seguro.t;
    ctx.save();
    ctx.fillStyle = 'rgba(5,8,25,0.7)';
    ctx.fillRect(x - 2, y - 2, w + 4, 14);
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#ff3355');
    g.addColorStop(1, '#c77dff');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w * Math.max(0, e.hp / e.hpMax), 10);
    // Marcas de las fases
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    if (e.fases >= 2) ctx.fillRect(x + w * 0.6 - 1, y - 2, 2, 14);
    if (e.fases >= 3) ctx.fillRect(x + w * 0.3 - 1, y - 2, 2, 14);
    ctx.font = '800 10px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd0d8';
    const nombre = e.def.nombre;
    ctx.fillText(nombre + (e.fases > 1 ? '  ·  FASE ' + e.fase + '/' + e.fases : ''), cx, y + 24);
    ctx.restore();
  }

  function dibujarMedidorEsquive() {
    const w = 120, x = cx - w / 2, y = H - 40 - seguro.b;
    const amenaza = J.alertaT > 0;
    ctx.save();
    ctx.fillStyle = 'rgba(5,10,30,0.55)';
    ctx.strokeStyle = amenaza ? 'rgba(255,60,50,0.9)' : 'rgba(56,248,255,0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 6, y - 6); ctx.arcTo(x + w, y - 6, x + w, y + 6, 6);
    ctx.arcTo(x + w, y + 6, x, y + 6, 6); ctx.arcTo(x, y + 6, x, y - 6, 6);
    ctx.arcTo(x, y - 6, x + w, y - 6, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(56,248,255,0.25)';
    ctx.fillRect(cx - 1, y - 4, 2, 8);
    const px = cx + (J.jugadorX / CONFIG.distanciaEsquive) * (w / 2 - 8);
    ctx.fillStyle = amenaza ? '#ff5544' : '#38f8ff';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(px, y, 5, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.font = '700 9px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = amenaza ? '#ffb0a8' : 'rgba(159,179,200,0.8)';
    ctx.fillText('◄  ESQUIVA  ►', cx, y + 18);
    ctx.restore();
  }
})(window.GS);
