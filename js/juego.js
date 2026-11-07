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
    meteoro: ['#ffb347', '#ff6a2b']
  };
  const COLOR_INDICADOR = { ovni: '#7CFF4F', dron: '#ffd23f', jefe: '#c77dff', orbe: '#ff3df2', meteoro: '#ff4d3d' };

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
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    lienzo.width = Math.round(W * DPR);
    lienzo.height = Math.round(H * DPR);
    lienzoFondo.width = Math.round(W * DPR);
    lienzoFondo.height = Math.round(H * DPR);
    cx = W / 2;
    cy = H / 2;
    F = Math.max(W, H) / 2 / Math.tan(34 * DEG); // ~68° como la cámara de un celular
    GS.Motor3D.redimensionar(lienzoGL, W, H, Math.min(DPR, 1.75), F);
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
  J.iniciar = function (opc) {
    J.modo = opc.modo || 'solo';
    J.rng = U.crearRNG(opc.semilla != null ? opc.semilla : (Math.random() * 1e9) | 0);
    J.prepararTipo(opc.tipo || J.tipoJuego);
    if (J.tipoJuego === 'esquiva') {
      const vidas = GS.Esquiva.CFG.vidas;
      Object.assign(J, {
        puntos: 0, vidas, vidasMax: vidas, oleada: 1, combo: 0, comboT: 0, kills: 0, disparos: 0, aciertos: 0,
        esquivados: 0, carga: 0, tiempo: opc.duracion || 0, duracion: opc.duracion || 0, tTotal: 0,
        entidades: [], particulas: [], textos: [], textosPantalla: [], laseres: [], ataques: [],
        invul: 0, sacudida: 0, flash: 0, vivo: true, gatillo: false, objetivo: null, jefe: null
      });
      J.estado = 'jugando';
      GS.Esquiva.iniciar();
      emitir('puntos');
      emitir('vidas');
      emitir('combo');
      return;
    }
    J.vidasMax = CONFIG.vidasMax;
    Object.assign(J, {
      puntos: 0, vidas: CONFIG.vidasMax, oleada: 0, combo: 0, comboT: 0, kills: 0, disparos: 0, aciertos: 0,
      esquivados: 0, carga: 0, tiempo: opc.duracion || 0, duracion: opc.duracion || 0, tTotal: 0,
      entidades: [], particulas: [], textos: [], textosPantalla: [], laseres: [], cola: [], tOleada: 0,
      invul: 0, sacudida: 0, flash: 0, marcaGolpe: 0, enfriamiento: 0, entreOleadas: 1.0, vivo: true,
      tMeteoro: 5, jugadorX: 0, pistaMeteoro: false, pistaRebote: false, finEn: -1, ataques: [],
      gatillo: false, objetivo: null, jefe: null, canon: 0, alertaT: 0
    });
    J.estado = 'jugando';
    emitir('puntos');
    emitir('vidas');
    emitir('combo');
  };

  J.multiplicador = () => (J.combo >= 10 ? 4 : J.combo >= 6 ? 3 : J.combo >= 3 ? 2 : 1);

  J.terminar = function (motivo) {
    if (J.estado === 'fin') return;
    J.estado = 'fin';
    J.gatillo = false;
    emitir('fin', motivo);
  };

  /** Multijugador: un rival te mandó una lluvia de meteoros. */
  J.recibirAtaque = function (nombre, n) {
    if (J.tipoJuego === 'esquiva') { GS.Esquiva.recibirAtaque(nombre, n); return; }
    if (J.estado !== 'jugando' || !J.vivo) return;
    for (let i = 0; i < n; i++) J.ataques.push(0.8 + i * 0.85);
    emitir('aviso', '☄️ ¡' + nombre + ' te lanzó meteoros!', 'peligro');
    GS.Sonido.ataque();
  };

  function vibrar(patron) {
    if (GS.Sensores.modo !== 'giro') return;
    try { if (navigator.vibrate) navigator.vibrate(patron); } catch (e) { /* nada */ }
  }

  /* ---------------- Oleadas ---------------- */
  function nuevaOleada() {
    J.oleada++;
    const n = J.oleada, r = J.rng, cola = [];
    const esJefe = n % CONFIG.jefeCada === 0;
    if (esJefe) {
      cola.push({ t: 1.2, tipo: 'jefe' });
      cola.push({ t: 2.5, tipo: 'ovni' }, { t: 4.0, tipo: 'ovni' });
    } else {
      const nOvnis = Math.min(2 + n, 9);
      const nDrones = n >= 2 ? Math.min(Math.floor(n * 0.8), 8) : 0;
      let t = 0.4;
      for (let i = 0; i < nOvnis; i++) { cola.push({ t, tipo: 'ovni' }); t += r.rango(0.6, 1.6); }
      let td = 2.5;
      for (let i = 0; i < nDrones; i++) { cola.push({ t: td, tipo: 'dron' }); td += r.rango(1.2, 2.6); }
    }
    // Parámetros con semilla: en multijugador todos ven la misma oleada.
    cola.forEach((c) => { c.yaw = r.rango(-1, 1); c.alt = r(); c.dist = r(); c.vari = r(); });
    cola.sort((a, b) => a.t - b.t);
    J.cola = cola;
    J.tOleada = 0;
    emitir('oleada', n, esJefe);
  }

  function aparecer(c) {
    const n = J.oleada;
    const arco = Math.min(55 + n * 12, GS.Sensores.arcoMax()) * DEG;
    const yaw = c.yaw * arco;
    if (c.tipo === 'ovni') {
      const alt = -0.6 + c.alt * 3.2;
      J.entidades.push({
        tipo: 'ovni', enemigo: true, yaw, dist: 9 + c.dist * 6, alt0: alt, alt, radio: 0.85, hp: 1,
        t: c.vari * 10, entrada: 0, pos: posDesde(yaw, 9 + c.dist * 6, alt),
        w: (c.vari < 0.5 ? -1 : 1) * (0.08 + c.vari * 0.18) * (1 + n * 0.04),
        tDisparo: 1.8 + c.vari * 2.5
      });
    } else if (c.tipo === 'dron') {
      J.entidades.push({
        tipo: 'dron', enemigo: true, pos: posDesde(yaw, 20, -0.5 + c.alt * 2.5), radio: 0.6, hp: 1,
        t: c.vari * 10, vel: 2.0 + n * 0.12 + c.vari * 0.6
      });
    } else if (c.tipo === 'jefe') {
      const hp = 14 + n * 2;
      J.entidades.push({
        tipo: 'jefe', enemigo: true, yaw0: yaw * 0.3, yaw: yaw * 0.3, dist: 16, alt: 3, radio: 2.6,
        hp, hpMax: hp, t: 0, entrada: 0, tDisparo: 3, tDron: 5, rafaga: 0, tRafaga: 0, pos: posDesde(yaw * 0.3, 16, 3)
      });
    }
  }

  function dispararOrbe(origen, rapidez) {
    const obj = V.add(camPos, [U.rand(-0.15, 0.15), U.rand(-0.15, 0.15), U.rand(-0.15, 0.15)]);
    const vel = V.esc(V.norm(V.sub(obj, origen)), rapidez);
    J.entidades.push({ tipo: 'orbe', pos: origen.slice(), vel, radio: 0.32, radioGolpe: 0.72, hp: 1, t: 0, vida: 9, minDist: 99 });
    GS.Sonido.orbe();
  }

  function lanzarMeteoro() {
    // Aparece dentro de lo que estás viendo para que lo veas venir.
    const abierto = Math.atan(W / 2 / F) * 0.65;
    const yaw = camYaw + U.rand(-abierto, abierto), dist = 26, alt = U.rand(-0.4, 1.6);
    const pos = [-Math.sin(yaw) * dist + camPos[0], alt, -Math.cos(yaw) * dist + camPos[2]];
    const obj = V.add(camPos, [U.rand(-0.25, 0.25), U.rand(-0.2, 0.2), U.rand(-0.25, 0.25)]);
    const rapidez = U.rand(8.5, 10.5) + Math.min(J.oleada * 0.12, 2);
    J.entidades.push({
      tipo: 'meteoro', pos, vel: V.esc(V.norm(V.sub(obj, pos)), rapidez), radio: 0.75, radioGolpe: 1.05,
      hp: 99, t: 0, rot: Math.random() * TAU, vrot: U.rand(-2, 2), vida: 6, minDist: 99, vari: (Math.random() * 3) | 0,
      q: Q.normalizar([Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5]),
      eje: V.norm([Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5])
    });
    GS.Sonido.meteoro();
  }

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

    J.tTotal += dt;
    if (J.modo === 'online' && J.duracion > 0) {
      J.tiempo = Math.max(0, J.tiempo - dt);
      if (J.tiempo <= 0) { J.terminar('tiempo'); return; }
    }
    if (J.finEn > 0) {
      J.finEn -= dt;
      if (J.finEn <= 0) { J.terminar('derrota'); return; }
    }

    J.enfriamiento -= dt; J.invul -= dt; J.flash -= dt; J.marcaGolpe -= dt; J.alertaT -= dt;
    J.sacudida *= Math.exp(-dt * 7);
    if (J.comboT > 0) {
      J.comboT -= dt;
      if (J.comboT <= 0) { J.combo = 0; emitir('combo'); }
    }

    if (J.vivo) {
      if (J.entreOleadas > 0) {
        J.entreOleadas -= dt;
        if (J.entreOleadas <= 0) nuevaOleada();
      } else {
        J.tOleada += dt;
        while (J.cola.length && J.cola[0].t <= J.tOleada) aparecer(J.cola.shift());
        if (!J.cola.length && !J.entidades.some((e) => e.enemigo)) {
          J.entreOleadas = 3.2;
          emitir('oleadaSuperada', J.oleada);
          GS.Sonido.oleada();
        }
        if (J.oleada >= 3) {
          J.tMeteoro -= dt;
          if (J.tMeteoro <= 0) {
            lanzarMeteoro();
            J.tMeteoro = Math.max(3.2, 8.5 - J.oleada * 0.35) * U.rand(0.85, 1.25);
          }
        }
      }
      for (let i = J.ataques.length - 1; i >= 0; i--) {
        J.ataques[i] -= dt;
        if (J.ataques[i] <= 0) { J.ataques.splice(i, 1); lanzarMeteoro(); }
      }
    }

    J.entidades = J.entidades.filter((e) => !e.muerto && actualizarEntidad(e, dt));
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
          emitir('aviso', '☄️ ¡ESQUIVA! ' + GS.Sensores.textoEsquivar(), 'peligro');
        }
      }
    }
    actualizarEfectos(dt);
  };

  function actualizarEntidad(e, dt) {
    e.t += dt;
    if (e.golpeT > 0) e.golpeT -= dt;
    const n = J.oleada;
    switch (e.tipo) {
      case 'ovni': {
        e.entrada = Math.min(1, e.entrada + dt * 1.8);
        e.yaw += e.w * dt;
        const lim = GS.Sensores.arcoMax() * DEG;
        if (e.yaw > lim) { e.yaw = lim; e.w = -Math.abs(e.w); }
        if (e.yaw < -lim) { e.yaw = -lim; e.w = Math.abs(e.w); }
        e.dist = Math.max(7, e.dist - dt * 0.15);
        e.alt = e.alt0 + Math.sin(e.t * 1.4) * 0.35;
        e.pos = posDesde(e.yaw, e.dist, e.alt);
        e.tDisparo -= dt;
        if (e.tDisparo <= 0 && e.entrada >= 1) {
          if (J.vivo) dispararOrbe(V.add(e.pos, [0, -0.35, 0]), 5 + n * 0.25);
          e.tDisparo = Math.max(1.8, 4.6 - n * 0.22) * U.rand(0.8, 1.3);
        }
        return true;
      }
      case 'dron': {
        const d = V.sub(camPos, e.pos), dist = V.len(d);
        if (dist < 0.9) { recibirDanio(); explotar(e); return false; }
        const dir = V.esc(d, 1 / dist), lado = [-dir[2], 0, dir[0]];
        const zigzag = Math.sin(e.t * 3.2) * 1.4 * Math.min(1, dist / 6);
        e.pos = V.add(e.pos, V.add(V.esc(dir, e.vel * dt), V.esc(lado, zigzag * dt)));
        return true;
      }
      case 'jefe': {
        e.entrada = Math.min(1, e.entrada + dt * 0.8);
        e.yaw = e.yaw0 + Math.sin(e.t * 0.35) * 0.45;
        e.alt = 2.6 + Math.sin(e.t * 0.9) * 0.4;
        e.pos = posDesde(e.yaw, e.dist, e.alt);
        e.tDisparo -= dt;
        if (e.tDisparo <= 0) { e.rafaga = 3; e.tRafaga = 0; e.tDisparo = Math.max(2.2, 3.8 - n * 0.08); }
        if (e.rafaga > 0) {
          e.tRafaga -= dt;
          if (e.tRafaga <= 0) {
            if (J.vivo) dispararOrbe(V.add(e.pos, [0, -1, 0]), 6 + n * 0.2);
            e.rafaga--;
            e.tRafaga = 0.35;
          }
        }
        e.tDron -= dt;
        if (e.tDron <= 0 && J.vivo) {
          e.tDron = 6.5;
          J.entidades.push({ tipo: 'dron', enemigo: true, pos: V.add(e.pos, [0, -1.2, 0]), radio: 0.6, hp: 1, t: 0, vel: 2.4 });
        }
        return true;
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
          if (recibirDanio()) explotar(e);
          return false;
        }
        e.vida -= dt;
        const seAleja = V.dot(V.sub(e.pos, camPos), e.vel) > 0;
        if (seAleja && d > 2.5) {
          if (e.minDist < (e.tipo === 'meteoro' ? 2.6 : 2.0)) esquivado(e);
          return false;
        }
        return e.vida > 0;
      }
    }
    return true;
  }

  function buscarObjetivo() {
    let mejor = null, mejorZ = Infinity;
    for (const e of J.entidades) {
      const p = e.proy;
      if (!p || p.detras || e.muerto) continue;
      const dx = p.x - cx, dy = p.y - cy;
      const r = e.radio * p.k * 1.1 + CONFIG.ayudaApuntado;
      if (dx * dx + dy * dy <= r * r && p.z < mejorZ) { mejor = e; mejorZ = p.z; }
    }
    return mejor;
  }

  function disparar() {
    if (J.enfriamiento > 0) return;
    J.enfriamiento = CONFIG.cadencia;
    J.disparos++;
    J.canon = 1 - J.canon;
    J.laseres.push({ t: 0.09, lado: J.canon });
    GS.Sonido.disparo();
    vibrar(12);
    if (J.objetivo) golpear(J.objetivo);
  }

  function golpear(e) {
    if (e.tipo === 'meteoro') {
      chispas(e.pos, COLORES.meteoro, 8);
      GS.Sonido.rebote();
      if (!J.pistaRebote) {
        J.pistaRebote = true;
        emitir('aviso', 'Los meteoros no se destruyen: ¡esquívalos!', 'peligro');
      }
      return;
    }
    J.aciertos++;
    J.marcaGolpe = 0.16;
    e.hp--;
    e.golpeT = 0.1;
    if (e.hp > 0) {
      GS.Sonido.impacto();
      chispas(e.pos, ['#ffffff', '#c9b3ff'], 6);
      return;
    }
    e.muerto = true;
    let pts = PUNTOS[e.tipo] || 50;
    if (e.enemigo) {
      J.kills++;
      J.combo = J.comboT > 0 ? J.combo + 1 : 1;
      J.comboT = 3;
      pts *= J.multiplicador();
      if (J.combo >= 3) GS.Sonido.combo(Math.min(J.combo, 12));
      if (J.modo === 'online') {
        J.carga++;
        if (J.carga >= CONFIG.killsParaAtaque) { J.carga = 0; emitir('ataque', 3); }
      }
      emitir('combo');
    }
    J.puntos += pts;
    textoFlotante(e.pos, '+' + pts, !e.enemigo ? '#ffb3f8' : J.multiplicador() > 1 ? '#ffd23f' : '#ffffff');
    explotar(e);
    if (e.tipo === 'jefe') {
      if (J.vidas < CONFIG.vidasMax) { J.vidas++; emitir('vidas'); }
      emitir('aviso', '¡NAVE NODRIZA DESTRUIDA! +1 ❤', 'exito');
      if (J.modo === 'online') emitir('ataque', 5);
    }
    emitir('puntos');
  }

  function recibirDanio() {
    if (J.invul > 0 || !J.vivo) return false;
    J.vidas--;
    J.invul = 1.3;
    J.flash = 0.55;
    J.sacudida = 1;
    if (J.combo) { J.combo = 0; J.comboT = 0; emitir('combo'); }
    GS.Sonido.danio();
    vibrar([80, 40, 140]);
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
    const pts = e.tipo === 'meteoro' ? 50 : 25;
    J.puntos += pts;
    J.textosPantalla.push({ txt: '¡ESQUIVADO! +' + pts, c: '#38f8ff', t: 0, vida: 1 });
    GS.Sonido.esquivado();
    emitir('puntos');
  }

  /* ---------------- Efectos ---------------- */
  function explotar(e) {
    const cols = COLORES[e.tipo] || ['#ffffff'];
    const jefe = e.tipo === 'jefe';
    const n = jefe ? 70 : e.tipo === 'orbe' ? 12 : 28;
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
      case 'ovni': {
        const esc = e.radio * (e.entrada < 1 ? Math.max(0.01, U.easeOutBack(e.entrada)) : 1);
        const incl = Q.mult(Q.eje(1, 0, 0, 0.14 + Math.sin(e.t * 1.7) * 0.06), Q.eje(0, 0, 1, Math.sin(e.t * 1.3) * 0.09));
        M3.dibujarModelo(M.ovni, e.pos, haciaJugador(e.pos, incl), esc, opc);
        break;
      }
      case 'dron': {
        const incl = Q.mult(Q.eje(1, 0, 0, 0.2), Q.eje(0, 0, 1, Math.sin(e.t * 5) * 0.2));
        M3.dibujarModelo(M.dron, e.pos, haciaJugador(e.pos, incl), e.radio, opc);
        break;
      }
      case 'jefe': {
        const esc = e.radio * Math.max(0.01, U.easeOutBack(e.entrada));
        const incl = Q.eje(1, 0, 0, 0.2 + Math.sin(e.t * 0.9) * 0.05);
        M3.dibujarModelo(M.jefe, e.pos, haciaJugador(e.pos, incl), esc, opc);
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
      } else if (e.tipo === 'ovni') {
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
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#04040d');
    g.addColorStop(1, '#0b0820');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.globalCompositeOperation = 'lighter';
    for (const n of nebulosas) {
      const v = Q.rotar(camInv, n.d);
      if (v[2] > -0.05) continue;
      const z = -v[2], x = cx + (v[0] / z) * F, y = cy - (v[1] / z) * F, r = n.r * F;
      const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, n.c + '0.22)');
      gr.addColorStop(1, n.c + '0)');
      ctx.fillStyle = gr;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
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
    ctx.strokeStyle = 'rgba(56,248,255,0.16)';
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
    switch (e.tipo) {
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
      if (p.detras) continue;
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
      ctx.arc(p.x, p.y, Math.max(1, pa.tam * p.k * (0.5 + a * 0.5)), 0, TAU);
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
    if (J.flash > 0) {
      const g = ctx.createRadialGradient(cx, cy, Math.min(W, H) * 0.2, cx, cy, Math.max(W, H) * 0.7);
      g.addColorStop(0, 'rgba(255,0,40,0)');
      g.addColorStop(1, 'rgba(255,0,40,' + Math.min(0.75, J.flash * 1.4).toFixed(2) + ')');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function dibujarLaseres() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const l of J.laseres) {
      const a = l.t / 0.09;
      const x0 = l.lado ? W * 0.86 : W * 0.14, y0 = H + 10;
      ctx.strokeStyle = 'rgba(56,248,255,' + (0.35 * a).toFixed(2) + ')';
      ctx.lineWidth = 12;
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
    const R = 46, x0 = 18 + R + seguro.l, y0 = H - 18 - R - seguro.b;
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
    ctx.font = '800 10px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd0d8';
    ctx.fillText('NAVE NODRIZA', cx, y + 24);
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
