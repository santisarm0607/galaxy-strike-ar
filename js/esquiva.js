/* =========================================================
   GALAXY STRIKE AR — esquiva.js
   Modo «ESQUIVA MARCIANOS» (pensado para PC).
   Pilotas una nave 3D vista desde atrás; los marcianos vienen
   hacia ti y tienes que esquivarlos. Mouse, WASD/flechas o
   arrastrar el dedo para moverte; Espacio/clic para el impulso.
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
    velBase: 16,           // velocidad inicial de los marcianos
    velPorNivel: 1.7,
    velMax: 42,
    segundosPorNivel: 20,
    jefeCada: 4,           // la nave nodriza sale cada 4 niveles
    impulsoEnfriamiento: 2.2,
    impulsoDuracion: 0.32,
    cristalesPorVida: 12,
    distanciaAparicion: 130
  };
  const PUNTOS = { porPoco: 25, cristal: 50, jefe: 500 };

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
  let jefe = null, nivel = 1, vel = CFG.velBase, tiempoVivo = 0;
  let tSpawn = 0, tCristal = 0, tFormacion = 0, acumPuntos = 0, tAvisoPuntos = 0;
  let impulsoEnfr = 0, impulsoT = 0, finEn = -1, sueloOffset = 0, alertaT = 0;
  let porPoco = 0, cristales = 0;
  let camQ = Q.identidad(), camInv = Q.identidad(), camPos = [0, 1.5, 8.5];
  let C = null; // capas de dibujo que presta juego.js

  /* Límites y cámara según la pantalla: en PC (horizontal) el área es ancha;
     en un celular vertical se angosta y la cámara abre más el ángulo. */
  let LX = CFG.limX, LY = CFG.limY, FE = 800, distCam = 8.5, seguir = 0.5, altCam = 1.5;
  function ajustarPantalla() {
    if (C.W >= C.H) {
      LX = CFG.limX; LY = CFG.limY; FE = C.F; distCam = 8.5; seguir = 0.5; altCam = 1.5;
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
    obs = []; items = []; parts = []; textos = []; ataques = [];
    jefe = null; impulsoT = 0; impulsoEnfr = 0;
    if (!rayas.length) crearRayas();
  };

  E.iniciar = function () {
    E.preparar();
    nivel = 1; vel = CFG.velBase; tiempoVivo = 0;
    tSpawn = 1.2; tCristal = 2; tFormacion = 10; acumPuntos = 0; tAvisoPuntos = 0;
    finEn = -1; alertaT = 0; porPoco = 0; cristales = 0;
    J.oleada = 1;
    J.emitir('oleada', 1, false);
  };

  E.estadisticas = () => ({ nivel, tiempo: tiempoVivo, porPoco, cristales });

  /** Solo para pruebas: saltar a un momento de la partida y ver el estado. */
  E.depurar = {
    tiempo: (s) => { tiempoVivo = s; },
    estado: () => ({ nave: { ...nave }, obs: obs.map((e) => ({ tipo: e.tipo, x: e.x, y: e.y, z: e.z, radio: e.radio })), items: items.length, jefe: !!jefe, vel, nivel })
  };

  /* ---------------- Controles ---------------- */
  E.apuntar = function (mx, my, w, h) {
    if (!C) return;
    nave.tx = U.clamp((mx / w - 0.5) * 2 * LX * 1.15, -LX, LX);
    nave.ty = U.clamp(-(my / h - 0.5) * 2 * LY * 1.25, -LY, LY);
  };
  E.arrastrar = function (dx, dy, w, h) {
    if (!C) return;
    nave.tx = U.clamp(nave.tx + dx * ((2 * LX) / w) * 1.4, -LX, LX);
    nave.ty = U.clamp(nave.ty - dy * ((2 * LY) / h) * 1.8, -LY, LY);
  };
  E.tecla = function (nombre, on) { teclas[nombre] = on; };
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
  };

  /** Multijugador: un rival te manda una estampida de marcianos. */
  E.recibirAtaque = function (nombre, n) {
    if (J.estado !== 'jugando' || !J.vivo) return;
    for (let i = 0; i < n * 2; i++) ataques.push(0.5 + i * 0.35);
    J.emitir('aviso', '👾 ¡' + nombre + ' te mandó una estampida!', 'peligro');
    GS.Sonido.ataque();
  };

  /* ---------------- Aparición de marcianos ----------------
     Siempre se usa el mismo número de llamadas a J.rng para que,
     en multijugador, todos tengan la misma lluvia de marcianos. */
  function aparecer() {
    const r = J.rng;
    const a = r(), b = r(), c = r(), d = r(), f = r();
    const apuntado = d < 0.35; // algunos vienen directo hacia donde estás
    const x = apuntado ? U.clamp(nave.x + (b - 0.5) * 2, -LX, LX) : (b * 2 - 1) * LX;
    const y = apuntado ? U.clamp(nave.y + (c - 0.5) * 1.6, -LY, LY) : (c * 2 - 1) * LY;
    let tipo = 'dron';
    if (nivel >= 2 && a < 0.22) tipo = 'ovni';
    else if (a < 0.55) tipo = 'meteoro';
    const o = { tipo, x, y, x0: x, y0: y, z: -CFG.distanciaAparicion, t: 0, fase: f * TAU, extra: 0 };
    if (tipo === 'dron') { o.radio = 0.85; o.extra = 4; }
    else if (tipo === 'ovni') { o.radio = 1.15; o.extra = 1; }
    else {
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
    const h2 = nivel < 6 ? h2r : -1;
    for (let j = 0; j < filas; j++) {
      for (let i = 0; i < cols; i++) {
        const k = j * cols + i;
        if (k === h1 || k === h2) continue;
        const x = -LX + (i + 0.5) * ((2 * LX) / cols);
        const y = -LY + (j + 0.5) * ((2 * LY) / filas);
        obs.push({ tipo: 'dron', formacion: true, x, y, x0: x, y0: y, z: -CFG.distanciaAparicion, t: k * 0.3, fase: 0, extra: 0, radio: 0.85 });
      }
    }
    J.emitir('aviso', '⚠️ ¡MURO DE MARCIANOS! Busca el hueco', 'peligro');
    GS.Sonido.alerta();
  }

  function aparecerCristal() {
    const r = J.rng;
    const x = (r() * 2 - 1) * LX * 0.9, y = (r() * 2 - 1) * LY * 0.9;
    items.push({ x, y, z: -CFG.distanciaAparicion, t: 0, radio: 0.45 });
  }

  function disparoJefe() {
    const origen = [jefe.x, jefe.y - 1.2, jefe.z];
    const obj = [nave.x + nave.vx * 0.25, nave.y + nave.vy * 0.25, 0];
    const rap = vel + 10;
    const dir = V.norm(V.sub(obj, origen));
    obs.push({ tipo: 'orbe', x: origen[0], y: origen[1], z: origen[2], vx: dir[0] * rap, vy: dir[1] * rap, vz: dir[2] * rap, t: 0, radio: 0.42, extra: 0 });
    GS.Sonido.orbe();
  }

  /* ---------------- Actualización ---------------- */
  E.actualizar = function (dt) {
    C = J.capas();
    ajustarPantalla();
    if (J.estado === 'pausa') { actualizarCamara(); return; }
    const enJuego = J.estado === 'jugando';
    nave.t += dt;
    moverNave(dt);
    const vFondo = enJuego ? vel : 10;
    for (const s of rayas) {
      s.z += vFondo * 1.4 * dt;
      if (s.z > 10) s.z -= 230;
    }
    sueloOffset = (sueloOffset + vFondo * dt) % 5;
    actualizarCamara();
    actualizarEfectos(dt);
    if (!enJuego) return;

    J.tTotal += dt;
    if (J.modo === 'online' && J.duracion > 0) {
      J.tiempo = Math.max(0, J.tiempo - dt);
      if (J.tiempo <= 0) { J.terminar('tiempo'); return; }
    }
    if (finEn > 0) {
      finEn -= dt;
      if (finEn <= 0) { J.terminar('derrota'); return; }
    }
    J.invul -= dt; J.flash -= dt; alertaT -= dt;
    J.sacudida *= Math.exp(-dt * 7);
    impulsoT -= dt;
    impulsoEnfr = Math.max(0, impulsoEnfr - dt);
    if (J.comboT > 0) {
      J.comboT -= dt;
      if (J.comboT <= 0) { J.combo = 0; J.emitir('combo'); }
    }

    if (J.vivo) {
      tiempoVivo += dt;
      const n = 1 + Math.floor(tiempoVivo / CFG.segundosPorNivel);
      if (n !== nivel) {
        nivel = n;
        J.oleada = n;
        const conJefe = n % CFG.jefeCada === 0;
        J.emitir('oleada', n, conJefe);
        GS.Sonido.oleada();
        if (conJefe) { jefe = { x: 0, y: 5.2, z: -120, t: 0, dur: 12, tDisparo: 2.5, entrada: 0 }; GS.Sonido.alerta(); }
      }
      vel = Math.min(CFG.velMax, CFG.velBase + (nivel - 1) * CFG.velPorNivel);

      // Puntos por sobrevivir
      acumPuntos += dt * 10 * nivel;
      if (acumPuntos >= 1) { const p = Math.floor(acumPuntos); acumPuntos -= p; J.puntos += p; }
      tAvisoPuntos -= dt;
      if (tAvisoPuntos <= 0) { tAvisoPuntos = 0.2; J.emitir('puntos'); }

      const intervalo = Math.max(0.22, 0.95 - nivel * 0.07) * (jefe ? 1.7 : 1);
      tSpawn -= dt;
      while (tSpawn <= 0) { aparecer(); tSpawn += intervalo * J.rng.rango(0.7, 1.3); }
      tCristal -= dt;
      while (tCristal <= 0) { aparecerCristal(); tCristal += J.rng.rango(1.8, 3.2); }
      if (nivel >= 3) {
        tFormacion -= dt;
        if (tFormacion <= 0) { formacion(); tFormacion = J.rng.rango(7, 10); }
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

    // Nave nodriza
    if (jefe) {
      jefe.t += dt;
      jefe.entrada = Math.min(1, jefe.entrada + dt * 0.5);
      jefe.x = Math.sin(jefe.t * 0.6) * LX * 0.55;
      if (jefe.t < jefe.dur) {
        jefe.z = -120 + 78 * U.easeOutBack(jefe.entrada); // llega volando hasta z = -42
        jefe.tDisparo -= dt;
        if (jefe.tDisparo <= 0 && J.vivo) { disparoJefe(); jefe.tDisparo = Math.max(0.5, 1.1 - nivel * 0.03); }
      } else {
        jefe.y += dt * 6;
        jefe.z -= dt * 30;
        if (jefe.z < -160) {
          jefe = null;
          if (J.vivo) {
            J.puntos += PUNTOS.jefe;
            J.emitir('puntos');
            J.emitir('aviso', '¡SOBREVIVISTE A LA NAVE NODRIZA! +' + PUNTOS.jefe, 'exito');
          }
        }
      }
    }

    // Marcianos
    const rN = CFG.radioNave;
    for (const e of obs) {
      e.t += dt;
      const zPrev = e.z;
      if (e.tipo === 'orbe') {
        e.x += e.vx * dt; e.y += e.vy * dt; e.z += e.vz * dt;
      } else {
        e.z += (vel + e.extra) * dt;
        if (e.tipo === 'dron' && !e.formacion) {
          e.x = e.x0 + Math.sin(e.t * 2.6 + e.fase) * 0.7;
          e.y = e.y0 + Math.cos(e.t * 2.1 + e.fase) * 0.45;
        } else if (e.tipo === 'ovni') {
          e.x = U.clamp(e.x0 + Math.sin(e.t * 1.3 + e.fase) * 3.2, -LX - 1, LX + 1);
          e.y = e.y0 + Math.sin(e.t * 2 + e.fase) * 0.3;
        } else if (e.tipo === 'meteoro') {
          e.q = Q.normalizar(Q.mult(Q.eje(e.eje[0], e.eje[1], e.eje[2], e.vrot * dt), e.q));
        }
      }
      const rs = e.radio + rN;
      const dxy = Math.hypot(e.x - nave.x, e.y - nave.y);
      const cruzo = zPrev < 0 && e.z >= 0;
      const dist = cruzo ? dxy : Math.hypot(dxy, e.z);
      if (dist < rs && J.vivo && choque(e)) { e.muerto = true; continue; }
      if (cruzo && !e.cerca && dxy >= rs && dxy < rs + 1.1 && J.vivo) { e.cerca = true; bonoPorPoco(e); }
      if (e.z > 12) e.muerto = true;
    }
    obs = obs.filter((e) => !e.muerto);

    // Cristales
    for (const c of items) {
      c.t += dt;
      const zPrev = c.z;
      c.z += vel * dt;
      const dxy = Math.hypot(c.x - nave.x, c.y - nave.y);
      const cruzo = zPrev < 0 && c.z >= 0;
      if (J.vivo && (cruzo ? dxy : Math.hypot(dxy, c.z)) < 1.25) { c.muerto = true; recoger(c); }
      if (c.z > 12) c.muerto = true;
    }
    items = items.filter((c) => !c.muerto);
  };

  function moverNave(dt) {
    const kx = (teclas.der ? 1 : 0) - (teclas.izq ? 1 : 0);
    const ky = (teclas.arriba ? 1 : 0) - (teclas.abajo ? 1 : 0);
    if (kx || ky) {
      nave.tx = U.clamp(nave.tx + kx * 13 * dt, -LX, LX);
      nave.ty = U.clamp(nave.ty + ky * 10 * dt, -LY, LY);
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

  function choque(e) {
    if (J.invul > 0 || impulsoT > 0) return false; // atraviesas sin daño
    J.vidas--;
    J.invul = 1.6;
    J.flash = 0.55;
    J.sacudida = 1.1;
    if (J.combo) { J.combo = 0; J.comboT = 0; J.emitir('combo'); }
    explosion([e.x, e.y, e.z], e.tipo, 26);
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
    if (J.combo >= 3) GS.Sonido.combo(Math.min(J.combo, 12));
    J.emitir('combo');
    if (J.modo === 'online') {
      J.carga++;
      if (J.carga >= J.CONFIG.killsParaAtaque) { J.carga = 0; J.emitir('ataque', 3); }
    }
  }

  function bonoPorPoco() {
    porPoco++;
    sumarCombo();
    const pts = PUNTOS.porPoco * J.multiplicador();
    J.puntos += pts;
    textos.push({ txt: '¡POR POCO! +' + pts, c: '#38f8ff', t: 0, vida: 0.9, x: nave.x, y: nave.y + 0.9 });
    GS.Sonido.porPoco();
    J.emitir('puntos');
  }

  function recoger(c) {
    cristales++;
    sumarCombo();
    const pts = PUNTOS.cristal * J.multiplicador();
    J.puntos += pts;
    textos.push({ txt: '+' + pts, c: '#7CFF4F', t: 0, vida: 0.8, x: c.x, y: c.y + 0.6 });
    explosion([c.x, c.y, 0], 'cristal', 14);
    GS.Sonido.cristal();
    if (cristales % CFG.cristalesPorVida === 0 && J.vidas < CFG.vidas) {
      J.vidas++;
      J.emitir('vidas');
      J.emitir('aviso', '💎 ¡' + CFG.cristalesPorVida + ' cristales! +1 ❤', 'exito');
    }
    J.emitir('puntos');
  }

  /* ---------------- Efectos ---------------- */
  const COLORES = {
    dron: ['#7CFF4F', '#ffd23f', '#b6ff8f'], ovni: ['#7CFF4F', '#38f8ff', '#ffffff'],
    meteoro: ['#ffb347', '#ff6a2b', '#8a6a50'], orbe: ['#ff3df2', '#ffb3f8'],
    nave: ['#38f8ff', '#ffffff', '#ff3df2', '#ffd23f'], cristal: ['#7CFF4F', '#c8ffe8']
  };
  function explosion(p, tipo, n) {
    const cols = COLORES[tipo] || ['#ffffff'];
    for (let i = 0; i < n; i++) {
      const d = V.norm([Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1]);
      parts.push({ p: p.slice(), v: V.esc(d, 3 + Math.random() * 5), t: 0, vida: 0.5 + Math.random() * 0.5, tam: 0.1 + Math.random() * 0.12, c: cols[(Math.random() * cols.length) | 0] });
    }
  }
  function actualizarEfectos(dt) {
    const arrastre = J.estado === 'jugando' ? vel * 0.5 : 0;
    for (const pa of parts) {
      pa.t += dt;
      pa.p = V.add(pa.p, V.esc(pa.v, dt));
      pa.p[2] += arrastre * dt;
      pa.v = V.esc(pa.v, Math.exp(-dt * 2.5));
    }
    parts = parts.filter((pa) => pa.t < pa.vida);
    for (const tx of textos) { tx.t += dt; tx.y += dt * 1.2; }
    textos = textos.filter((tx) => tx.t < tx.vida);
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
        M3.dibujarModelo(M.jefe, [jefe.x, jefe.y, jefe.z], Q.eje(1, 0, 0, 0.35), 4.2, { t: jefe.t });
      }
      for (const e of obs) {
        const pos = [e.x, e.y, e.z];
        if (e.tipo === 'dron') M3.dibujarModelo(M.dron, pos, Q.mult(Q.eje(1, 0, 0, 0.15), Q.eje(0, 0, 1, Math.sin(e.t * 5) * 0.2)), e.radio, { t: e.t });
        else if (e.tipo === 'ovni') M3.dibujarModelo(M.ovni, pos, Q.mult(Q.eje(1, 0, 0, 0.3), Q.eje(0, 0, 1, Math.cos(e.t * 1.3 + e.fase) * 0.25)), e.radio, { t: e.t });
        else if (e.tipo === 'meteoro') M3.dibujarModelo(M.meteoro[e.vari], pos, e.q, e.radio, { t: e.t });
        else if (e.tipo === 'orbe') M3.dibujarModelo(M.orbe, pos, Q.identidad(), e.radio, { t: e.t });
      }
      for (const c of items) M3.dibujarModelo(M.cristal, [c.x, c.y, c.z], Q.identidad(), 1, { t: c.t });
      if (naveVisible()) M3.dibujarModelo(M.nave, [nave.x, nave.y + Math.sin(nave.t * 2) * 0.05, 0], orientacionNave(), 0.9, { t: nave.t });
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
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#05040f');
    gr.addColorStop(0.55, '#140a2e');
    gr.addColorStop(1, '#2a0b3d');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    g.save();
    g.translate(sx, sy);
    // Sol de neón en el horizonte
    const sol = proyectar([0, -4, -400]);
    if (!sol.detras) {
      const r = Math.min(W, H) * 0.5;
      const gs = g.createRadialGradient(sol.x, sol.y, 0, sol.x, sol.y, r);
      gs.addColorStop(0, 'rgba(255,90,200,0.45)');
      gs.addColorStop(0.35, 'rgba(160,60,255,0.18)');
      gs.addColorStop(1, 'rgba(60,20,120,0)');
      g.fillStyle = gs;
      g.fillRect(sol.x - r, sol.y - r, r * 2, r * 2);
    }
    // Estrellas estiradas por la velocidad
    const largo = 0.6 + (J.estado === 'jugando' ? vel : 10) * 0.09;
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
    g.strokeStyle = 'rgba(255,61,242,0.28)';
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
      const rs = e.radio + rN;
      const dxy = Math.hypot(e.x - nave.x, e.y - nave.y);
      if (dxy > rs + 2.5) continue;
      const p = proyectar([e.x, e.y, 0]);
      if (p.detras) continue;
      const a = U.clamp(1 - -e.z / 32, 0, 1);
      const peligro = dxy < rs;
      g.strokeStyle = peligro ? 'rgba(255,70,60,' + (0.35 + a * 0.6).toFixed(2) + ')' : 'rgba(255,255,255,' + (a * 0.35).toFixed(2) + ')';
      g.lineWidth = peligro ? 3 : 1.5;
      g.setLineDash(peligro ? [] : [6, 6]);
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
      else if (e.tipo === 'meteoro') { const w = r * 3; g.globalAlpha = 0.35; g.drawImage(SP.brilloFuego, p.x - w / 2, p.y - w / 2, w, w); g.globalAlpha = 1; }
      else if (e.tipo === 'ovni') { const w = r * 2.2; g.globalAlpha = 0.5; g.drawImage(SP.brilloVerde, p.x - w / 2, p.y - w * 0.05, w, w * 0.6); g.globalAlpha = 1; }
    }
    for (const c of items) {
      const p = proyectar([c.x, c.y, c.z]);
      if (p.detras) continue;
      const w = p.k * 1.6;
      g.globalAlpha = 0.6;
      g.drawImage(SP.brilloVerde, p.x - w / 2, p.y - w / 2, w, w);
      g.globalAlpha = 1;
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
      const p = proyectar([tx.x, tx.y, 0]);
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
      if (e.tipo === 'dron') { sp = SP.dron[((e.t * 12) | 0) % 2]; w = h = r * 2.6; }
      else if (e.tipo === 'ovni') { sp = SP.ovni[((e.t * 4) | 0) % 2]; w = r * 2.5; h = w * (sp.height / sp.width); }
      else if (e.tipo === 'jefe') { sp = SP.jefe; w = r * 2.4; h = w * (sp.height / sp.width); }
      else if (e.tipo === 'meteoro') { sp = SP.meteoro[e.vari]; w = h = r * 2.6; }
      else if (e.tipo === 'orbe') { sp = SP.orbe; w = h = r * 3.2; }
      if (sp) { g.drawImage(sp, p.x - w / 2, p.y - h / 2, w, h); continue; }
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
      g.fillText('⚠ NAVE NODRIZA: ' + Math.ceil(jefe.dur - jefe.t) + 's', W / 2, 96 + seguro.t);
    }
    g.restore();
    if (J.flash > 0) {
      const gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.7);
      gr.addColorStop(0, 'rgba(255,0,40,0)');
      gr.addColorStop(1, 'rgba(255,0,40,' + Math.min(0.75, J.flash * 1.4).toFixed(2) + ')');
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
    }
  }
})(window.GS);
