/* =========================================================
   GALAXY STRIKE AR — sensores.js
   Cámara trasera + giroscopio (el celular es el arma).
   Si no hay giroscopio se usa mouse (PC) o arrastrar el dedo.
   ========================================================= */
'use strict';

(function (GS) {
  const U = GS.U, Q = GS.Q, DEG = U.DEG;

  const S = (GS.Sensores = {
    modo: 'mouse',        // 'giro' | 'tactil' | 'mouse'
    camaraActiva: false,
    giroActivo: false,
    preparado: false,
    inclinacion: 0        // -1 (izquierda) … 0 … 1 (derecha)
  });

  let evento = null;      // última lectura del giroscopio
  let qSuave = null;      // rotación suavizada del celular
  let yawCal = 0;         // "frente" calibrado

  // Controles alternativos (mouse / dedo / teclado)
  let yaw = 0, pitch = 0, yawObj = 0, pitchObj = 0, incTeclas = 0;
  const teclas = { izq: false, der: false };

  function alOrientar(e) {
    if (e.alpha == null && e.beta == null && e.gamma == null) return;
    evento = { a: e.alpha || 0, b: e.beta || 0, g: e.gamma || 0 };
  }

  function anguloPantalla() {
    if (screen.orientation && typeof screen.orientation.angle === 'number') return screen.orientation.angle;
    return window.orientation || 0;
  }

  /** Pide permiso del giroscopio (iOS lo exige dentro de un toque) y espera una lectura real. */
  S.pedirGiroscopio = function () {
    if (typeof window.DeviceOrientationEvent === 'undefined') return Promise.resolve(false);
    let permiso = 'granted';
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      try { permiso = DeviceOrientationEvent.requestPermission(); } // debe llamarse de inmediato en el clic
      catch (e) { permiso = 'denied'; }
    }
    return Promise.resolve(permiso)
      .then((r) => {
        if (r !== 'granted') return false;
        window.addEventListener('deviceorientation', alOrientar, true);
        // Los PC tienen la API pero no el sensor: esperamos un dato real.
        return new Promise((res) => {
          const t0 = performance.now();
          (function revisar() {
            if (evento) res(true);
            else if (performance.now() - t0 > 1500) res(false);
            else setTimeout(revisar, 80);
          })();
        });
      })
      .catch(() => false);
  };

  /** Enciende la cámara trasera y la muestra en el <video> de fondo. */
  S.pedirCamara = function (video) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return Promise.resolve(false);
    let p;
    try {
      p = navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
    } catch (e) {
      return Promise.resolve(false);
    }
    return p
      .then((stream) => {
        S.stream = stream;
        video.muted = true;
        video.setAttribute('muted', '');
        video.setAttribute('playsinline', '');
        video.srcObject = stream;
        const pl = video.play();
        if (pl && pl.catch) pl.catch(() => {});
        S.camaraActiva = true;
        return true;
      })
      .catch(() => false);
  };

  /**
   * Prepara todo. Debe llamarse desde un toque del usuario.
   * La cámara solo se usa si hay giroscopio: sin él la imagen no
   * seguiría al celular y la realidad aumentada se vería rara.
   */
  S.preparar = function (video) {
    return S.pedirGiroscopio().then((giro) => {
      S.giroActivo = giro;
      const tactil = window.matchMedia && matchMedia('(pointer: coarse)').matches;
      S.modo = giro ? 'giro' : tactil ? 'tactil' : 'mouse';
      const cam = giro ? S.pedirCamara(video) : Promise.resolve(false);
      return cam.then((ok) => {
        S.preparado = true;
        return { giro, camara: ok, modo: S.modo };
      });
    });
  };

  /** Rotación de la cámara del juego en este cuadro. */
  S.actualizar = function (dt) {
    let q;
    if (S.modo === 'giro' && evento) {
      const qd = U.quatDispositivo(evento.a * DEG, evento.b * DEG, evento.g * DEG, anguloPantalla() * DEG);
      qSuave = qSuave ? Q.nlerp(qSuave, qd, 1 - Math.exp(-dt * 30)) : qd;
      q = Q.mult(Q.eje(0, 1, 0, -yawCal), qSuave);
      // Inclinar el celular hacia un lado (como un timón) = esquivar
      const derecha = Q.rotar(q, [1, 0, 0]);
      const roll = Math.asin(U.clamp(derecha[1], -1, 1));
      const fuerza = U.clamp((Math.abs(roll) - 7 * DEG) / (23 * DEG), 0, 1);
      S.inclinacion = -Math.sign(roll) * fuerza;
    } else {
      const objetivo = (teclas.der ? 1 : 0) - (teclas.izq ? 1 : 0);
      incTeclas = U.lerp(incTeclas, objetivo, 1 - Math.exp(-dt * 10));
      S.inclinacion = incTeclas;
      yaw = U.lerp(yaw, yawObj, 1 - Math.exp(-dt * 14));
      pitch = U.lerp(pitch, pitchObj, 1 - Math.exp(-dt * 14));
      q = Q.mult(Q.eje(0, 1, 0, yaw), Q.mult(Q.eje(1, 0, 0, pitch), Q.eje(0, 0, 1, -incTeclas * 7 * DEG)));
    }
    return q;
  };

  /** Lo que tengas al frente ahora pasa a ser "el frente" del juego. */
  S.recentrar = function () {
    if (S.modo === 'giro' && qSuave) {
      const f = Q.rotar(qSuave, [0, 0, -1]);
      yawCal = Math.atan2(-f[0], -f[2]);
    } else {
      yaw = yawObj = 0;
      pitch = pitchObj = 0;
    }
  };

  /** PC: la posición del mouse decide hacia dónde miras. */
  S.mouse = function (x, y, w, h) {
    if (S.modo !== 'mouse') return;
    const k = GS.Ajustes ? GS.Ajustes.get('sensibilidad') || 1 : 1;
    yawObj = U.clamp(-(x / w - 0.5) * 2 * 95 * k, -110, 110) * DEG;
    pitchObj = U.clamp(-(y / h - 0.5) * 2 * 40 * k, -55, 55) * DEG;
  };

  /** Celular sin giroscopio: arrastrar el dedo gira la vista. */
  S.arrastrar = function (dx, dy) {
    const k = GS.Ajustes ? GS.Ajustes.get('sensibilidad') || 1 : 1;
    yawObj -= dx * 0.3 * k * DEG;
    pitchObj = U.clamp(pitchObj - dy * 0.26 * k * DEG, -55 * DEG, 55 * DEG);
  };

  S.tecla = function (lado, presionada) {
    teclas[lado] = presionada;
  };

  /** Qué tan abierto puede aparecer el enemigo (grados a cada lado). */
  S.arcoMax = function () {
    return S.modo === 'giro' ? 150 : S.modo === 'tactil' ? 120 : 85;
  };

  S.textoEsquivar = function () {
    return S.modo === 'giro' ? 'Inclina el celular' : S.modo === 'tactil' ? 'Usa ◄ ►' : 'Usa A / D';
  };
})(window.GS);
