/* =========================================================
   GALAXY STRIKE AR — cuerpo.js
   Control con la CÁMARA para «Esquiva marcianos».
   Usa MediaPipe (de Google, gratis) para detectar:
   - el CUERPO (hombros): te mueves de lado o te agachas y la
     nave te sigue.
   - las MANOS: con la mano en forma de pistola apuntas con el
     índice y disparas bajando el pulgar; con la mano abierta
     usas el impulso.
   Hay dos formas de jugar:
   - 'cuerpo' (de pie): tu cuerpo mueve la nave.
   - 'manos' (sentado): una mano mueve la nave y dispara al
     frente; cansa menos y sirve con la cámara cerca.
   La librería y los modelos se descargan de internet solo
   cuando eliges este control (la primera vez tarda un poco).
   ========================================================= */
'use strict';

(function (GS) {
  const U = GS.U;

  const VERSION_MP = '1.2.2';
  const CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + VERSION_MP;
  const MODELOS = {
    pose: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
    manos: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
  };

  /* ---------------- Ajustes (cámbialos a tu gusto) ---------------- */
  const CFG = {
    rangoX: 1.25,        // cuántos «anchos de hombros» te mueves de lado para llegar al borde
    rangoY: 0.85,        // cuántos anchos de hombros subes o bajas para llegar arriba o abajo
    zoomMira: 1.5,       // >1: la mira llega al borde sin estirar tanto el brazo
    suavizadoCuerpo: 12, // más alto = la nave responde más rápido (y tiembla más)
    suavizadoMira: 16,
    gatilloAbajo: 0.42,  // pulgar pegado al índice (menos que esto) = disparar
    gatilloArriba: 0.58, // pulgar levantado (más que esto) = dejar de disparar
    abiertaSeg: 0.18,    // segundos con la mano abierta para el impulso
    rangoManoX: 0.26,    // modo «solo manos»: cuánto mueves la mano (fracción de la imagen) para llegar al borde
    rangoManoY: 0.2,
    fpsPC: 30,           // detecciones por segundo en PC
    fpsCelular: 15,      // y en celular (para que no se caliente)
    lentoMs: 160         // si cada detección tarda más que esto, el equipo va lento
  };

  const C = (GS.Cuerpo = {
    CFG,
    estado: 'apagado',  // apagado | cargando | listo | error
    modo: (function () { try { return localStorage.getItem('gs_cam_modo') === 'manos' ? 'manos' : 'cuerpo'; } catch (e) { return 'cuerpo'; } })(),
    guia: false,        // la interfaz lo pone en true en la pantalla de preparación (dibuja la silueta)
    gatilloProbado: false,
    error: '',
    persona: false,     // ¿se ve a alguien frente a la cámara?
    x: 0, y: 0,         // posición del cuerpo (-1..1) respecto al centro calibrado
    manos: [],          // [{ id, x, y (0..1, como espejo), pistola, gatillo, abierta }]
    lento: false,
    necesario: () => true, // la interfaz dice cuándo hay que detectar (para ahorrar batería)
    alImpulso: null,       // se llama al abrir la mano
    alLento: null,         // se llama si el equipo no aguanta
    alProgreso: null       // textos mientras carga
  });

  const esMovil = () => !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  let video = null, stream = null, pose = null, manosLM = null, cargando = null;
  let corriendo = false, tUltimo = -1, tVideo = -1, tiempos = [];
  let crudo = null, centro = null, tSinPersona = 0, ultimoPose = null, ultimasManos = [];
  let centroMano = null, pilotoId = null; // modo «solo manos»
  const estadoMano = {};

  function progreso(txt) { if (C.alProgreso) try { C.alProgreso(txt); } catch (e) { /* nada */ } }

  function mensajeError(e) {
    const n = e && e.name;
    if (n === 'NotAllowedError' || n === 'SecurityError') return 'No diste permiso para usar la cámara.';
    if (n === 'NotFoundError' || n === 'OverconstrainedError' || (e && e.message === 'sin-camara')) return 'No se encontró una cámara.';
    if (n === 'NotReadableError') return 'La cámara la está usando otra app.';
    return 'No se pudo cargar el detector. Revisa tu internet.';
  }

  async function crear(Clase, archivos, url, extra) {
    const opc = (delegate) => Object.assign({ baseOptions: { modelAssetPath: url, delegate }, runningMode: 'VIDEO' }, extra);
    try { return await Clase.createFromOptions(archivos, opc('GPU')); }
    catch (e) { return await Clase.createFromOptions(archivos, opc('CPU')); } // sin GPU: más lento pero funciona
  }

  /** Prende la cámara frontal y carga los detectores. Devuelve true si quedó listo. */
  C.iniciar = function (videoEl) {
    if (C.estado === 'listo') return Promise.resolve(true);
    if (cargando) return cargando;
    video = videoEl;
    C.estado = 'cargando';
    C.error = '';
    C.lento = false;
    cargando = (async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('sin-camara');
        progreso('Pidiendo permiso para la cámara…');
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
        });
        video.muted = true;
        video.playsInline = true;
        video.srcObject = stream;
        try { await video.play(); } catch (e) { /* se reintenta abajo */ }
        progreso('Cargando el detector… (la primera vez tarda un poco)');
        const mp = await import(CDN + '/vision_bundle.mjs');
        const archivos = await mp.FilesetResolver.forVisionTasks(CDN + '/wasm');
        progreso('Cargando el detector del cuerpo…');
        pose = await crear(mp.PoseLandmarker, archivos, MODELOS.pose, { numPoses: 1, minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5 });
        progreso('Cargando el detector de manos…');
        manosLM = await crear(mp.HandLandmarker, archivos, MODELOS.manos, { numHands: 2, minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5 });
        if (C.estado !== 'cargando') return false; // lo apagaron mientras cargaba
        C.estado = 'listo';
        arrancar();
        return true;
      } catch (e) {
        console.warn('Cámara/detector:', e);
        C.detener();
        C.estado = 'error';
        C.error = mensajeError(e);
        return false;
      } finally {
        cargando = null;
      }
    })();
    return cargando;
  };

  /** Apaga la cámara y libera los detectores. */
  C.detener = function () {
    corriendo = false;
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    if (video) video.srcObject = null;
    try { if (pose) pose.close(); } catch (e) { /* nada */ }
    try { if (manosLM) manosLM.close(); } catch (e) { /* nada */ }
    pose = manosLM = null;
    C.estado = 'apagado';
    C.persona = false;
    C.manos = [];
    centro = crudo = null;
    centroMano = null;
    pilotoId = null;
    Object.keys(estadoMano).forEach((k) => delete estadoMano[k]);
  };

  /** Cambia entre 'cuerpo' (de pie) y 'manos' (sentado). */
  C.elegirModo = function (m) {
    C.modo = m === 'manos' ? 'manos' : 'cuerpo';
    try { localStorage.setItem('gs_cam_modo', C.modo); } catch (e) { /* nada */ }
    centro = centroMano = null;
    pilotoId = null;
    C.x = C.y = 0;
    C.persona = false;
  };

  /** Toma tu posición actual como el centro. */
  C.calibrar = function () {
    if (C.modo === 'manos') {
      const p = estadoMano[pilotoId];
      centroMano = p ? { x: p.px, y: p.py } : { x: 0.5, y: 0.55 };
      C.x = 0; C.y = 0;
      return !!p;
    }
    if (!crudo) return false;
    centro = { x: crudo.x, y: crudo.y, ancho: Math.max(0.06, crudo.ancho) };
    C.x = 0; C.y = 0;
    return true;
  };

  /** Si el video se pausó (por ejemplo al moverlo de lugar), lo vuelve a reproducir. */
  C.reanudarVideo = function () { if (video && stream && video.paused) { const p = video.play(); if (p && p.catch) p.catch(() => {}); } };

  function arrancar() {
    corriendo = true;
    tUltimo = -1;
    tVideo = -1;
    tiempos = [];
    requestAnimationFrame(bucle);
  }

  function bucle() {
    if (!corriendo) return;
    requestAnimationFrame(bucle);
    if (!video || video.readyState < 2 || !C.necesario()) return;
    const ahora = performance.now();
    const intervalo = 1000 / (esMovil() ? CFG.fpsCelular : CFG.fpsPC);
    if (tUltimo >= 0 && ahora - tUltimo < intervalo) return;
    if (video.currentTime === tVideo) return; // todavía no hay un cuadro nuevo
    const dt = tUltimo < 0 ? 1 / 30 : Math.min(0.25, (ahora - tUltimo) / 1000);
    tUltimo = ahora;
    tVideo = video.currentTime;
    let rp = null, rm = null;
    const t0 = performance.now();
    try {
      // En «solo manos» no hace falta buscar el cuerpo: va más rápido
      rp = C.modo === 'manos' ? null : pose.detectForVideo(video, ahora);
      rm = manosLM.detectForVideo(video, ahora);
    } catch (e) { console.warn(e); return; }
    medir(performance.now() - t0);
    C.procesar(rp, rm, dt);
    dibujarMini();
  }

  function medir(ms) {
    tiempos.push(ms);
    if (tiempos.length > 40) tiempos.shift();
    if (C.lento || tiempos.length < 40) return;
    const prom = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
    if (prom > CFG.lentoMs) { C.lento = true; if (C.alLento) C.alLento(); }
  }

  const visible = (p) => p && (p.visibility == null || p.visibility > 0.4);

  /** Convierte lo que ve MediaPipe en movimientos del juego. (También sirve para pruebas.) */
  C.procesar = function (rp, rm, dt) {
    // ---- Cuerpo: punto medio de los hombros (11 y 12) ----
    const lm = rp && rp.landmarks && rp.landmarks[0];
    ultimoPose = lm || null;
    if (C.modo === 'manos') {
      // nada: en este modo la nave la mueve la mano (más abajo)
    } else if (lm && visible(lm[11]) && visible(lm[12])) {
      crudo = {
        x: 1 - (lm[11].x + lm[12].x) / 2, // 1 - x: como un espejo (te mueves a la derecha y la nave va a la derecha)
        y: (lm[11].y + lm[12].y) / 2,
        ancho: dist(lm[11], lm[12])
      };
      if (!centro) C.calibrar();
      const nx = U.clamp((crudo.x - centro.x) / (centro.ancho * CFG.rangoX), -1, 1);
      const ny = U.clamp((centro.y - crudo.y) / (centro.ancho * CFG.rangoY), -1, 1);
      const k = 1 - Math.exp(-dt * CFG.suavizadoCuerpo);
      C.x += (nx - C.x) * k;
      C.y += (ny - C.y) * k;
      C.persona = true;
      tSinPersona = 0;
    } else {
      tSinPersona += dt;
      if (tSinPersona > 0.7) C.persona = false;
    }

    // ---- Manos ----
    const listas = (rm && rm.landmarks) || [];
    const lados = (rm && (rm.handedness || rm.handednesses)) || [];
    ultimasManos = listas;
    const vistas = {};
    listas.forEach((m, i) => {
      const cat = lados[i] && lados[i][0];
      let id = cat && cat.categoryName ? cat.categoryName : 'M' + i;
      if (vistas[id]) id += i;
      vistas[id] = true;
      const st = estadoMano[id] || (estadoMano[id] = { id, x: 0.5, y: 0.5, gatillo: false, abiertaT: 0, impulsoUsado: false, nueva: true });
      analizarMano(m, st, dt);
      st.perdida = 0;
    });
    Object.keys(estadoMano).forEach((id) => {
      if (vistas[id]) return;
      const st = estadoMano[id];
      st.perdida = (st.perdida || 0) + dt;
      if (st.perdida > 0.35) delete estadoMano[id];
    });
    // ---- Modo «solo manos»: una mano (la piloto) mueve la nave ----
    if (C.modo === 'manos') {
      if (!estadoMano[pilotoId] || estadoMano[pilotoId].perdida) {
        const libre = Object.values(estadoMano).find((st) => !st.perdida);
        pilotoId = libre ? libre.id : null;
      }
      const pl = estadoMano[pilotoId];
      if (pl && !pl.perdida) {
        if (!centroMano) centroMano = { x: pl.px, y: pl.py };
        const nx = U.clamp((pl.px - centroMano.x) / CFG.rangoManoX, -1, 1);
        const ny = U.clamp((centroMano.y - pl.py) / CFG.rangoManoY, -1, 1);
        const k = 1 - Math.exp(-dt * CFG.suavizadoCuerpo);
        C.x += (nx - C.x) * k;
        C.y += (ny - C.y) * k;
        C.persona = true;
        tSinPersona = 0;
      } else {
        tSinPersona += dt;
        if (tSinPersona > 0.7) C.persona = false;
      }
    }
    C.manos = Object.values(estadoMano).filter((s) => !s.perdida).map((s) => ({
      id: s.id, x: s.x, y: s.y, pistola: s.pistola, gatillo: s.pistola && s.gatillo, abierta: s.abierta,
      carga: s.pistola ? s.carga : 0, piloto: C.modo === 'manos' && s.id === pilotoId
    }));
    if (C.manos.some((m) => m.gatillo)) C.gatilloProbado = true;
  };

  /** Consejo para la pantalla de preparación: { ok, texto }. */
  C.consejo = function () {
    const pistola = C.manos.some((m) => m.pistola);
    if (C.modo === 'manos') {
      if (!C.persona) return { ok: false, texto: 'Muestra una mano a la cámara (a unos 50 cm).' };
      if (!pistola && !C.gatilloProbado) return { ok: true, texto: '¡Te veo! Ahora haz una pistola con la mano.' };
      if (!C.gatilloProbado) return { ok: true, texto: 'Baja el pulgar como un gatillo para probar.' };
      return { ok: true, texto: '¡Listo! Mueve la mano para mover la nave.' };
    }
    if (!C.persona || !crudo) return { ok: false, texto: 'Párate frente a la cámara, que se vean tus hombros…' };
    if (crudo.ancho < 0.14) return { ok: true, texto: 'Acércate un poco a la cámara.' };
    if (crudo.ancho > 0.42) return { ok: true, texto: 'Aléjate un poco: así te puedes mover más.' };
    if (crudo.x < 0.33) return { ok: true, texto: 'Muévete un poco a tu derecha, al centro de la silueta.' };
    if (crudo.x > 0.67) return { ok: true, texto: 'Muévete un poco a tu izquierda, al centro de la silueta.' };
    if (crudo.y < 0.28) return { ok: true, texto: 'Baja un poco la cámara (o aléjate).' };
    if (crudo.y > 0.78) return { ok: true, texto: 'Sube un poco la cámara.' };
    if (!pistola && !C.gatilloProbado) return { ok: true, texto: '¡Perfecto! Prueba a hacer una pistola con la mano.' };
    if (!C.gatilloProbado) return { ok: true, texto: 'Baja el pulgar como un gatillo para probar.' };
    return { ok: true, texto: '¡Perfecto! Quédate ahí y empieza.' };
  };
  /** ¿Está bien ubicado? (para pintar la silueta de verde) */
  C.bienUbicado = function () {
    if (C.modo === 'manos') return C.persona;
    return !!(C.persona && crudo && crudo.ancho >= 0.14 && crudo.ancho <= 0.42 && crudo.x >= 0.33 && crudo.x <= 0.67 && crudo.y >= 0.28 && crudo.y <= 0.78);
  };

  /** ¿El dedo está estirado? (la punta está más lejos de la muñeca que la articulación del medio) */
  const estirado = (m, punta, medio) => dist(m[0], m[punta]) > dist(m[0], m[medio]) * 1.12;

  function analizarMano(m, st, dt) {
    const tam = dist(m[0], m[9]) || 0.1; // tamaño de la palma: así no importa si estás cerca o lejos
    const indice = estirado(m, 8, 6), medio = estirado(m, 12, 10), anular = estirado(m, 16, 14), menique = estirado(m, 20, 18);
    st.abierta = indice && medio && anular && menique;
    st.pistola = indice && !anular && !menique;

    // Pulgar: levantado = listo; pegado al índice = ¡gatillo!
    const pulgar = Math.min(dist(m[4], m[5]), dist(m[4], m[6])) / tam;
    if (pulgar < CFG.gatilloAbajo) st.gatillo = true;
    else if (pulgar > CFG.gatilloArriba) st.gatillo = false;
    // Qué tan cerca está el pulgar de disparar (0 = arriba, 1 = gatillo): se ve en la mira
    st.carga = st.gatillo ? 1 : U.clamp((CFG.gatilloArriba + 0.15 - pulgar) / (CFG.gatilloArriba + 0.15 - CFG.gatilloAbajo), 0, 1);
    // Centro de la palma (modo «solo manos»)
    st.px = 1 - (m[0].x * 0.4 + m[9].x * 0.6);
    st.py = m[0].y * 0.4 + m[9].y * 0.6;

    // Mira: entre la base y la punta del índice (así no salta al bajar el pulgar)
    const px = 1 - (m[8].x * 0.6 + m[5].x * 0.4);
    const py = m[8].y * 0.6 + m[5].y * 0.4;
    const ax = U.clamp(0.5 + (px - 0.5) * CFG.zoomMira, 0, 1);
    const ay = U.clamp(0.5 + (py - 0.5) * CFG.zoomMira, 0, 1);
    if (st.nueva) { st.x = ax; st.y = ay; st.nueva = false; }
    const k = 1 - Math.exp(-dt * CFG.suavizadoMira);
    st.x += (ax - st.x) * k;
    st.y += (ay - st.y) * k;

    // Mano abierta un momento = impulso (una vez por cada vez que la abres)
    if (st.abierta) {
      st.abiertaT += dt;
      if (st.abiertaT >= CFG.abiertaSeg && !st.impulsoUsado) {
        st.impulsoUsado = true;
        if (C.alImpulso) C.alImpulso();
      }
    } else {
      st.abiertaT = 0;
      st.impulsoUsado = false;
    }
  }

  /* ---------------- Mini ventana (espejo con tus puntos) ---------------- */
  C.dibujarMini = () => dibujarMini(); // (también sirve para pruebas)
  /** Silueta donde debes ponerte (verde cuando estás bien ubicado). */
  function dibujarSilueta(g, w, h) {
    const ok = C.bienUbicado();
    g.save();
    g.lineWidth = 3;
    g.setLineDash(ok ? [] : [9, 7]);
    g.strokeStyle = ok ? 'rgba(124,255,79,0.95)' : 'rgba(255,255,255,0.75)';
    g.fillStyle = ok ? 'rgba(124,255,79,0.12)' : 'rgba(255,255,255,0.06)';
    g.beginPath();
    if (C.modo === 'manos') {
      // Recuadro para la mano, en el centro
      const bw = w * 0.42, bh = h * 0.5, x = w / 2 - bw / 2, y = h * 0.28;
      g.rect(x, y, bw, bh);
      g.fill(); g.stroke();
      g.setLineDash([]);
      g.font = '800 ' + Math.round(h * 0.07) + 'px Orbitron, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = ok ? 'rgba(124,255,79,0.7)' : 'rgba(255,255,255,0.7)';
      g.fillText('MANO AQUÍ', w / 2, y + bh / 2);
    } else {
      // Cabeza y hombros
      const cx = w / 2, r = h * 0.085;
      g.arc(cx, h * 0.3, r, 0, Math.PI * 2);
      g.moveTo(cx - w * 0.17, h * 0.98);
      g.bezierCurveTo(cx - w * 0.17, h * 0.6, cx - w * 0.15, h * 0.5, cx, h * 0.48);
      g.bezierCurveTo(cx + w * 0.15, h * 0.5, cx + w * 0.17, h * 0.6, cx + w * 0.17, h * 0.98);
      g.fill(); g.stroke();
    }
    g.restore();
  }

  const CONEXIONES_MANO = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]];
  function dibujarMini() {
    const lz = document.getElementById('lienzoCuerpo');
    if (!lz || !lz.offsetWidth) return;
    const w = lz.offsetWidth, h = lz.offsetHeight;
    if (lz.width !== w || lz.height !== h) { lz.width = w; lz.height = h; }
    const g = lz.getContext('2d');
    g.clearRect(0, 0, w, h);
    // El video se ve como espejo (CSS); los puntos también se voltean.
    const P = (p) => [(1 - p.x) * w, p.y * h];
    if (C.guia) dibujarSilueta(g, w, h);
    if (ultimoPose) {
      g.strokeStyle = 'rgba(56,248,255,0.9)';
      g.lineWidth = 3;
      g.beginPath();
      [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24]].forEach(([a, b]) => {
        if (!visible(ultimoPose[a]) || !visible(ultimoPose[b])) return;
        const pa = P(ultimoPose[a]), pb = P(ultimoPose[b]);
        g.moveTo(pa[0], pa[1]); g.lineTo(pb[0], pb[1]);
      });
      g.stroke();
      if (visible(ultimoPose[0])) {
        const n = P(ultimoPose[0]);
        g.fillStyle = '#38f8ff';
        g.beginPath(); g.arc(n[0], n[1], 5, 0, Math.PI * 2); g.fill();
      }
    }
    ultimasManos.forEach((m, i) => {
      const st = C.manos[i];
      g.strokeStyle = st && st.gatillo ? '#ff3df2' : st && st.pistola ? '#7cff4f' : 'rgba(255,255,255,0.8)';
      g.lineWidth = 2;
      g.beginPath();
      CONEXIONES_MANO.forEach(([a, b]) => { const pa = P(m[a]), pb = P(m[b]); g.moveTo(pa[0], pa[1]); g.lineTo(pb[0], pb[1]); });
      g.stroke();
    });
    if (!C.persona) {
      g.fillStyle = 'rgba(5,6,15,0.55)';
      g.fillRect(0, h / 2 - 14, w, 28);
      g.fillStyle = '#ffd0d8';
      g.font = '700 12px "Exo 2", sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('No te veo', w / 2, h / 2);
    }
  }
})(window.GS);
