/* =========================================================
   GALAXY STRIKE AR — utilidades.js
   Matemática básica: números aleatorios con semilla,
   cuaterniones (rotaciones 3D) y el cálculo de hacia dónde
   apunta el celular a partir del giroscopio.
   ========================================================= */
'use strict';
window.GS = window.GS || {};

(function (GS) {
  const U = (GS.U = {});

  U.DEG = Math.PI / 180;
  U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.rand = (a, b) => a + Math.random() * (b - a);

  /** Identificador corto aleatorio (para jugadores y partidas). */
  U.id = function (n = 10) {
    const a = 'abcdefghijkmnpqrstuvwxyz23456789';
    let s = '';
    for (let i = 0; i < n; i++) s += a[(Math.random() * a.length) | 0];
    return s;
  };

  /**
   * Generador aleatorio con semilla (mulberry32).
   * En multijugador todos usan la misma semilla, así enfrentan
   * exactamente la misma invasión, cada uno en su propio espacio.
   */
  U.crearRNG = function (semilla) {
    let s = semilla >>> 0;
    const f = function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.rango = (a, b) => a + f() * (b - a);
    return f;
  };

  U.easeOutBack = function (t) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };

  /* ---------------- Cuaterniones [x, y, z, w] ---------------- */
  const Q = (GS.Q = {});

  Q.identidad = () => [0, 0, 0, 1];

  Q.mult = (a, b) => [
    a[0] * b[3] + a[3] * b[0] + a[1] * b[2] - a[2] * b[1],
    a[1] * b[3] + a[3] * b[1] + a[2] * b[0] - a[0] * b[2],
    a[2] * b[3] + a[3] * b[2] + a[0] * b[1] - a[1] * b[0],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
  ];

  /** Rotación de `ang` radianes alrededor del eje (ax, ay, az). */
  Q.eje = (ax, ay, az, ang) => {
    const s = Math.sin(ang / 2);
    return [ax * s, ay * s, az * s, Math.cos(ang / 2)];
  };

  Q.conj = (q) => [-q[0], -q[1], -q[2], q[3]];

  Q.normalizar = (q) => {
    const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
    return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
  };

  /** Interpolación suave entre dos rotaciones (para quitar temblor del sensor). */
  Q.nlerp = (a, b, t) => {
    const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
    const s = d < 0 ? -1 : 1;
    return Q.normalizar([
      a[0] + (s * b[0] - a[0]) * t,
      a[1] + (s * b[1] - a[1]) * t,
      a[2] + (s * b[2] - a[2]) * t,
      a[3] + (s * b[3] - a[3]) * t
    ]);
  };

  /** Euler en orden YXZ → cuaternión (igual que three.js). */
  Q.desdeEulerYXZ = (x, y, z) => {
    const c1 = Math.cos(x / 2), c2 = Math.cos(y / 2), c3 = Math.cos(z / 2);
    const s1 = Math.sin(x / 2), s2 = Math.sin(y / 2), s3 = Math.sin(z / 2);
    return [
      s1 * c2 * c3 + c1 * s2 * s3,
      c1 * s2 * c3 - s1 * c2 * s3,
      c1 * c2 * s3 - s1 * s2 * c3,
      c1 * c2 * c3 + s1 * s2 * s3
    ];
  };

  /** Rota el vector v con el cuaternión q. */
  Q.rotar = (q, v) => {
    const qx = q[0], qy = q[1], qz = q[2], qw = q[3];
    const vx = v[0], vy = v[1], vz = v[2];
    const tx = 2 * (qy * vz - qz * vy);
    const ty = 2 * (qz * vx - qx * vz);
    const tz = 2 * (qx * vy - qy * vx);
    return [
      vx + qw * tx + (qy * tz - qz * ty),
      vy + qw * ty + (qz * tx - qx * tz),
      vz + qw * tz + (qx * ty - qy * tx)
    ];
  };

  const Q_MENOS_X90 = [-Math.SQRT1_2, 0, 0, Math.SQRT1_2];

  /**
   * Convierte la orientación del celular (alpha, beta, gamma del
   * evento deviceorientation, en radianes) en la rotación de la
   * cámara del juego. La cámara mira por la parte de atrás del
   * celular, como la cámara trasera real.
   */
  U.quatDispositivo = function (alpha, beta, gamma, anguloPantalla) {
    let q = Q.desdeEulerYXZ(beta, alpha, -gamma);
    q = Q.mult(q, Q_MENOS_X90);
    q = Q.mult(q, Q.eje(0, 0, 1, -anguloPantalla));
    return q;
  };
})(window.GS);
