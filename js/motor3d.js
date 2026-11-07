/* =========================================================
   GALAXY STRIKE AR — motor3d.js
   Motor 3D pequeño hecho con WebGL (sin librerías):
   - Geometrías: elipsoides, tornos (superficies de revolución),
     cilindros/conos, toros y rocas facetadas.
   - Render con luz direccional, brillo especular, luz de borde
     y partes emisivas (luces que brillan).
   La cámara 3D usa exactamente la misma rotación y distancia
   focal que el resto del juego, así todo coincide en pantalla.
   ========================================================= */
'use strict';

(function (GS) {
  const Q = GS.Q;

  /* ---------------- Matrices 4x4 (orden de columnas, como WebGL) ---------------- */
  const M4 = {};
  M4.mult = (a, b) => {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      }
    }
    return o;
  };
  /** Posición + rotación (cuaternión) + escala (número o [x, y, z]). */
  M4.trs = (p, q, s) => {
    const sx = Array.isArray(s) ? s[0] : s, sy = Array.isArray(s) ? s[1] : s, sz = Array.isArray(s) ? s[2] : s;
    const x = q[0], y = q[1], z = q[2], w = q[3];
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;
    return new Float32Array([
      (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
      (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
      (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
      p[0], p[1], p[2], 1
    ]);
  };
  GS.M4 = M4;

  /* ---------------- Geometrías ---------------- */
  const G = (GS.Geo = {});

  function normalizar(v) {
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  }

  /** Elipsoide. v0..v1 recorta de arriba (0) a abajo (1): 0..0.5 = cúpula. */
  G.elipsoide = function (rx, ry, rz, su = 20, sv = 14, v0 = 0, v1 = 1) {
    const pos = [], nor = [], idx = [];
    for (let j = 0; j <= sv; j++) {
      const phi = (v0 + (v1 - v0) * (j / sv)) * Math.PI;
      for (let i = 0; i <= su; i++) {
        const th = (i / su) * Math.PI * 2;
        const x = rx * Math.sin(phi) * Math.cos(th), y = ry * Math.cos(phi), z = rz * Math.sin(phi) * Math.sin(th);
        pos.push(x, y, z);
        const n = normalizar([x / (rx * rx), y / (ry * ry), z / (rz * rz)]);
        nor.push(n[0], n[1], n[2]);
      }
    }
    for (let j = 0; j < sv; j++) {
      for (let i = 0; i < su; i++) {
        const a = j * (su + 1) + i, b = a + su + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    return { pos, nor, idx };
  };

  G.esfera = (r, su = 18, sv = 12) => G.elipsoide(r, r, r, su, sv);

  /**
   * Superficie de revolución a partir de un perfil [[radio, altura], ...]
   * ordenado de arriba hacia abajo. Las uniones suaves se suavizan y
   * las esquinas marcadas quedan con filo.
   */
  G.torno = function (perfil, seg = 32) {
    const pos = [], nor = [], idx = [];
    const ns = [];
    for (let k = 0; k < perfil.length - 1; k++) {
      const dr = perfil[k + 1][0] - perfil[k][0], dy = perfil[k + 1][1] - perfil[k][1];
      const l = Math.hypot(dr, dy) || 1;
      ns.push([-dy / l, dr / l]);
    }
    const suave = (a, b) => a[0] * b[0] + a[1] * b[1] > 0.64;
    for (let k = 0; k < perfil.length - 1; k++) {
      let nA = ns[k], nB = ns[k];
      if (k > 0 && suave(ns[k - 1], ns[k])) nA = normalizar([ns[k - 1][0] + ns[k][0], ns[k - 1][1] + ns[k][1], 0]);
      if (k < ns.length - 1 && suave(ns[k], ns[k + 1])) nB = normalizar([ns[k][0] + ns[k + 1][0], ns[k][1] + ns[k + 1][1], 0]);
      const base = pos.length / 3;
      [[perfil[k], nA], [perfil[k + 1], nB]].forEach(([p, n]) => {
        for (let i = 0; i <= seg; i++) {
          const th = (i / seg) * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
          pos.push(p[0] * c, p[1], p[0] * s);
          nor.push(n[0] * c, n[1], n[0] * s);
        }
      });
      for (let i = 0; i < seg; i++) {
        const a = base + i, b = base + seg + 1 + i;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    return { pos, nor, idx };
  };

  /** Cilindro o cono (rArriba = 0) centrado en el origen, a lo largo de Y. */
  G.cilindro = function (rArriba, rAbajo, alto, seg = 16) {
    const h = alto / 2;
    return G.torno([[0, h], [rArriba, h], [rAbajo, -h], [0, -h]], seg);
  };

  /** Toro (dona) acostado en el plano XZ. */
  G.toro = function (R, r, sR = 40, sT = 10) {
    const pos = [], nor = [], idx = [];
    for (let j = 0; j <= sR; j++) {
      const u = (j / sR) * Math.PI * 2, cu = Math.cos(u), su = Math.sin(u);
      for (let i = 0; i <= sT; i++) {
        const v = (i / sT) * Math.PI * 2, cv = Math.cos(v), sv = Math.sin(v);
        pos.push((R + r * cv) * cu, r * sv, (R + r * cv) * su);
        nor.push(cv * cu, sv, cv * su);
      }
    }
    for (let j = 0; j < sR; j++) {
      for (let i = 0; i < sT; i++) {
        const a = j * (sT + 1) + i, b = a + sT + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    return { pos, nor, idx };
  };

  /** Roca facetada: icosaedro subdividido con relieve aleatorio. */
  G.roca = function (radio, semilla) {
    let s = semilla * 9301 + 49297;
    const azar = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const t = (1 + Math.sqrt(5)) / 2;
    let v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(normalizar);
    let caras = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    // Una subdivisión
    const cache = {};
    const medio = (a, b) => {
      const k = a < b ? a + '_' + b : b + '_' + a;
      if (cache[k] == null) { v.push(normalizar([(v[a][0] + v[b][0]) / 2, (v[a][1] + v[b][1]) / 2, (v[a][2] + v[b][2]) / 2])); cache[k] = v.length - 1; }
      return cache[k];
    };
    const nuevas = [];
    caras.forEach(([a, b, c]) => {
      const ab = medio(a, b), bc = medio(b, c), ca = medio(c, a);
      nuevas.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    });
    caras = nuevas;
    const desp = v.map(() => radio * (0.78 + azar() * 0.4));
    const vp = v.map((p, i) => [p[0] * desp[i], p[1] * desp[i] * 0.9, p[2] * desp[i]]);
    const pos = [], nor = [], idx = [];
    caras.forEach(([a, b, c]) => {
      const A = vp[a], B = vp[b], C = vp[c];
      const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], w = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
      let n = normalizar([u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]);
      const centro = [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3, (A[2] + B[2] + C[2]) / 3];
      if (n[0] * centro[0] + n[1] * centro[1] + n[2] * centro[2] < 0) n = [-n[0], -n[1], -n[2]];
      const base = pos.length / 3;
      [A, B, C].forEach((P) => { pos.push(P[0], P[1], P[2]); nor.push(n[0], n[1], n[2]); });
      idx.push(base, base + 1, base + 2);
    });
    return { pos, nor, idx };
  };

  /* ---------------- Render WebGL ---------------- */
  const VS = [
    'attribute vec3 aPos;',
    'attribute vec3 aNor;',
    'uniform mat4 uModelo;',
    'uniform mat4 uVista;',
    'uniform mat4 uProy;',
    'varying vec3 vN;',
    'varying vec3 vP;',
    'void main() {',
    '  vec4 p = uVista * uModelo * vec4(aPos, 1.0);',
    '  vP = p.xyz;',
    '  vN = (uVista * uModelo * vec4(aNor, 0.0)).xyz;',
    '  gl_Position = uProy * p;',
    '}'
  ].join('\n');

  const FS = [
    'precision mediump float;',
    'varying vec3 vN;',
    'varying vec3 vP;',
    'uniform vec3 uColor;',
    'uniform vec3 uLuz;',
    'uniform float uEmisivo;',
    'uniform float uAlfa;',
    'uniform float uBrillo;',
    'uniform float uDestello;',
    'void main() {',
    '  vec3 n = normalize(vN);',
    '  vec3 v = normalize(-vP);',
    '  if (dot(n, v) < 0.0) n = -n;',
    '  float dif = max(dot(n, uLuz), 0.0);',
    '  float rim = pow(1.0 - max(dot(n, v), 0.0), 2.2);',
    '  float esp = pow(max(dot(n, normalize(uLuz + v)), 0.0), 36.0) * uBrillo;',
    '  vec3 c = uColor * (0.22 + 0.8 * dif) + vec3(esp) + rim * 0.35 * (uColor + vec3(0.15, 0.3, 0.4));',
    '  c = mix(c, uColor * 1.35 + 0.1, uEmisivo);',
    '  c = mix(c, vec3(1.0), uDestello);',
    '  gl_FragColor = vec4(c * uAlfa, uAlfa);',
    '}'
  ].join('\n');

  const M3 = (GS.Motor3D = { listo: false });
  let gl = null, prog = null, loc = {}, W = 1, H = 1, F = 500;
  let vista = null, proy = null, luzVista = [0, 1, 0];
  const LUZ_MUNDO = normalizar([0.35, 0.85, 0.4]); // luz desde arriba, como el techo
  let transparentes = [];

  function compilar(tipo, src) {
    const s = gl.createShader(tipo);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  M3.iniciar = function (canvas) {
    try {
      gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true }) ||
        canvas.getContext('experimental-webgl', { alpha: true, antialias: true, premultipliedAlpha: true });
      if (!gl) return false;
      prog = gl.createProgram();
      gl.attachShader(prog, compilar(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, compilar(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      ['aPos', 'aNor'].forEach((n) => { loc[n] = gl.getAttribLocation(prog, n); });
      ['uModelo', 'uVista', 'uProy', 'uColor', 'uLuz', 'uEmisivo', 'uAlfa', 'uBrillo', 'uDestello'].forEach((n) => { loc[n] = gl.getUniformLocation(prog, n); });
      gl.enableVertexAttribArray(loc.aPos);
      gl.enableVertexAttribArray(loc.aNor);
      gl.enable(gl.DEPTH_TEST);
      gl.clearColor(0, 0, 0, 0);
      canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); M3.listo = false; });
      M3.listo = true;
      return true;
    } catch (e) {
      console.warn('WebGL no disponible:', e);
      M3.listo = false;
      return false;
    }
  };

  M3.redimensionar = function (canvas, ancho, alto, dpr, focal) {
    W = ancho; H = alto; F = focal;
    canvas.width = Math.round(ancho * dpr);
    canvas.height = Math.round(alto * dpr);
    if (gl) gl.viewport(0, 0, canvas.width, canvas.height);
  };

  /** Sube una geometría a la tarjeta gráfica. */
  M3.malla = function (geo) {
    const m = { n: geo.idx.length };
    m.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, m.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geo.pos), gl.STATIC_DRAW);
    m.nbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, m.nbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geo.nor), gl.STATIC_DRAW);
    m.ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(geo.idx), gl.STATIC_DRAW);
    return m;
  };

  /** Empieza un cuadro con la cámara del juego (rotación inversa + posición) y la sacudida en píxeles. */
  M3.comenzar = function (camInv, camPos, sx = 0, sy = 0, focal = F) {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const t = Q.rotar(camInv, [-camPos[0], -camPos[1], -camPos[2]]);
    vista = M4.trs(t, camInv, 1);
    const n = 0.1, f = 250;
    proy = new Float32Array([
      (2 * focal) / W, 0, 0, 0,
      0, (2 * focal) / H, 0, 0,
      -(2 * sx) / W, (2 * sy) / H, -(f + n) / (f - n), -1,
      0, 0, (-2 * f * n) / (f - n), 0
    ]);
    luzVista = normalizar(Q.rotar(camInv, LUZ_MUNDO));
    gl.useProgram(prog);
    gl.uniformMatrix4fv(loc.uVista, false, vista);
    gl.uniformMatrix4fv(loc.uProy, false, proy);
    gl.uniform3fv(loc.uLuz, luzVista);
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    transparentes = [];
  };

  function dibujarParte(malla, modelo, p) {
    gl.uniformMatrix4fv(loc.uModelo, false, modelo);
    gl.uniform3fv(loc.uColor, p.color);
    gl.uniform1f(loc.uEmisivo, p.emisivo);
    gl.uniform1f(loc.uAlfa, p.alfa);
    gl.uniform1f(loc.uBrillo, p.brillo);
    gl.uniform1f(loc.uDestello, p.destello);
    gl.bindBuffer(gl.ARRAY_BUFFER, malla.vbo);
    gl.vertexAttribPointer(loc.aPos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, malla.nbo);
    gl.vertexAttribPointer(loc.aNor, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, malla.ibo);
    gl.drawElements(gl.TRIANGLES, malla.n, gl.UNSIGNED_SHORT, 0);
  }

  /**
   * Dibuja un modelo (lista de partes) en una posición, rotación y escala.
   * opc: { t (tiempo, para animar), destello (0..1), apagado (bool),
   *        colores: { rol: [r, g, b] } (pinta de otro color las piezas con ese rol),
   *        alfa: 0..1 (hace todo el modelo más transparente) }
   */
  M3.dibujarModelo = function (partes, pos, rot, esc, opc = {}) {
    const base = M4.trs(pos, rot, esc);
    const t = opc.t || 0;
    for (const pa of partes) {
      let lpos = pa.pos, lrot = pa.rot, lesc = pa.esc;
      if (pa.giro) {
        const qg = Q.eje(0, 1, 0, t * pa.giro);
        lpos = Q.rotar(qg, lpos);
        lrot = Q.mult(qg, lrot);
      }
      if (pa.llama) {
        const k = 0.75 + 0.35 * Math.abs(Math.sin(t * 37 + pa.llama));
        lesc = [pa.esc, pa.esc * k, pa.esc];
      }
      let emisivo = pa.emisivo;
      if (pa.parpadeo != null) emisivo = ((Math.floor(t * 4) + pa.parpadeo) % 2) ? 1 : 0.1;
      if (opc.apagado && pa.emisivo > 0.5) emisivo = 0.15;
      const color = (opc.colores && pa.rol && opc.colores[pa.rol]) || pa.color;
      const alfa = opc.alfa != null ? pa.alfa * opc.alfa : pa.alfa;
      const datos = { color, emisivo, alfa, brillo: pa.brillo, destello: opc.destello || 0 };
      const modelo = M4.mult(base, M4.trs(lpos, lrot, lesc));
      if (alfa < 1) transparentes.push([pa.malla, modelo, datos]);
      else dibujarParte(pa.malla, modelo, datos);
    }
  };

  /** Termina el cuadro: dibuja lo transparente (vidrios) al final. */
  M3.terminar = function () {
    if (!transparentes.length) return;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    for (const [m, modelo, d] of transparentes) dibujarParte(m, modelo, d);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    transparentes = [];
  };

  M3.limpiar = function () {
    if (gl) gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  };
})(window.GS);
