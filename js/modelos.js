/* =========================================================
   GALAXY STRIKE AR — modelos.js
   Modelos 3D de los enemigos armados con piezas simples.
   Cada pieza: geometría, color, posición, rotación y escala.
   El frente de cada modelo mira hacia +Z (hacia el jugador).

   Opciones de pieza:
   - emisivo: 0..1  (1 = brilla con luz propia)
   - alfa:    0..1  (menos de 1 = transparente, como vidrio)
   - brillo:  0..1  (reflejo metálico)
   - giro:    rad/s (gira alrededor del eje vertical del modelo)
   - parpadeo: 0/1  (luz que prende y apaga)
   - llama:   número (llama que tiembla)
   ========================================================= */
'use strict';

(function (GS) {
  const Q = GS.Q, G = GS.Geo;

  const ID = [0, 0, 0, 1];
  const rotX = (a) => Q.eje(1, 0, 0, a);
  const rotY = (a) => Q.eje(0, 1, 0, a);
  const rotZ = (a) => Q.eje(0, 0, 1, a);

  const COLOR = {
    plata: [0.62, 0.67, 0.78],
    cian: [0.22, 0.97, 1.0],
    vidrio: [0.55, 0.9, 1.0],
    verdeAlien: [0.42, 0.92, 0.28],
    verdeOscuro: [0.22, 0.6, 0.16],
    negro: [0.03, 0.04, 0.03],
    blanco: [1, 1, 1],
    amarillo: [1, 0.86, 0.3],
    magenta: [1, 0.25, 0.95],
    rojo: [1, 0.2, 0.32],
    morado: [0.5, 0.36, 0.78],
    moradoOscuro: [0.28, 0.12, 0.45],
    metal: [0.5, 0.55, 0.65],
    fuego: [1, 0.55, 0.15],
    roca: [0.5, 0.36, 0.26]
  };

  const MOD = (GS.Modelos = {});

  MOD.crear = function () {
    const M3 = GS.Motor3D;
    const cache = {};
    const malla = (clave, fn) => cache[clave] || (cache[clave] = M3.malla(fn()));

    function pieza(m, color, o = {}) {
      return {
        malla: m, color, pos: o.pos || [0, 0, 0], rot: o.rot || ID, esc: o.esc == null ? 1 : o.esc,
        emisivo: o.emisivo || 0, alfa: o.alfa == null ? 1 : o.alfa, brillo: o.brillo == null ? 0.4 : o.brillo,
        giro: o.giro || 0, parpadeo: o.parpadeo, llama: o.llama
      };
    }

    const esferaChica = malla('esf8', () => G.esfera(1, 10, 8));
    const esfera = malla('esf', () => G.esfera(1, 20, 14));

    /* ---------- OVNI ---------- */
    const ovni = [
      pieza(malla('ovniCuerpo', () => G.torno([[0, 0.2], [0.5, 0.18], [0.95, 0.1], [1.3, 0.0], [1.3, -0.04], [0.95, -0.15], [0.45, -0.24], [0, -0.26]], 40)), COLOR.plata, { brillo: 1 }),
      pieza(malla('ovniMotor', () => G.elipsoide(0.42, 0.12, 0.42, 20, 8)), [0.45, 1, 0.6], { pos: [0, -0.26, 0], emisivo: 1 }),
      pieza(malla('ovniAro', () => G.toro(1.17, 0.045, 48, 8)), COLOR.cian, { pos: [0, 0.03, 0], emisivo: 0.9 }),
      pieza(malla('ovniCabeza', () => G.elipsoide(0.22, 0.25, 0.22, 16, 12)), COLOR.verdeAlien, { pos: [0, 0.36, 0], brillo: 0.5 }),
      pieza(esferaChica, COLOR.negro, { pos: [-0.09, 0.39, 0.17], rot: rotZ(0.5), esc: [0.065, 0.1, 0.05], brillo: 1 }),
      pieza(esferaChica, COLOR.negro, { pos: [0.09, 0.39, 0.17], rot: rotZ(-0.5), esc: [0.065, 0.1, 0.05], brillo: 1 }),
      pieza(malla('ovniCupula', () => G.elipsoide(0.55, 0.52, 0.55, 24, 10, 0, 0.5)), COLOR.vidrio, { pos: [0, 0.16, 0], alfa: 0.38, brillo: 1 })
    ];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ovni.push(pieza(esferaChica, i % 2 ? COLOR.magenta : COLOR.amarillo, {
        pos: [Math.cos(a) * 1.2, -0.05, Math.sin(a) * 1.2], esc: 0.085, emisivo: 1, parpadeo: i % 2, giro: 0.9
      }));
    }
    MOD.ovni = ovni;

    /* ---------- DRON (alien con jetpack) ---------- */
    const dron = [
      pieza(malla('dronCabeza', () => G.elipsoide(0.72, 0.62, 0.66, 24, 16)), COLOR.verdeAlien, { pos: [0, 0.2, 0], brillo: 0.55 }),
      pieza(esfera, COLOR.verdeOscuro, { pos: [0, -0.56, 0], esc: [0.32, 0.3, 0.3] }),
      pieza(esfera, COLOR.negro, { pos: [0, -0.1, 0.6], esc: [0.1, 0.03, 0.05] }) // boca
    ];
    [-1, 1].forEach((lado) => {
      // Ojos grandes y rasgados
      dron.push(pieza(esfera, COLOR.negro, { pos: [lado * 0.29, 0.22, 0.52], rot: Q.mult(rotY(lado * 0.45), rotZ(-lado * 0.55)), esc: [0.2, 0.3, 0.1], brillo: 1 }));
      dron.push(pieza(esferaChica, COLOR.blanco, { pos: [lado * 0.24, 0.33, 0.62], esc: 0.045, emisivo: 1 }));
      // Antenas
      dron.push(pieza(malla('antena', () => G.cilindro(0.025, 0.025, 0.5, 8)), COLOR.verdeOscuro, { pos: [lado * 0.3, 0.88, 0], rot: rotZ(-lado * 0.4) }));
      dron.push(pieza(esferaChica, COLOR.magenta, { pos: [lado * 0.4, 1.1, 0], esc: 0.09, emisivo: 1 }));
      // Jetpack y llamas
      dron.push(pieza(malla('tanque', () => G.cilindro(0.13, 0.13, 0.45, 14)), COLOR.metal, { pos: [lado * 0.2, -0.55, -0.3], brillo: 1 }));
      dron.push(pieza(malla('llama', () => G.cilindro(0.11, 0.0, 0.45, 12)), COLOR.fuego, { pos: [lado * 0.2, -0.98, -0.3], emisivo: 1, llama: lado + 2 }));
    });
    MOD.dron = dron;

    /* ---------- NAVE NODRIZA (jefe) ---------- */
    const jefe = [
      pieza(malla('jefeDisco', () => G.torno([[0, 0.12], [0.6, 0.12], [1.05, 0.05], [1.25, -0.02], [1.25, -0.06], [1.0, -0.16], [0.55, -0.26], [0, -0.28]], 56)), COLOR.morado, { brillo: 0.8 }),
      pieza(malla('jefeDomo', () => G.elipsoide(0.62, 0.5, 0.62, 28, 12, 0, 0.5)), COLOR.moradoOscuro, { pos: [0, 0.1, 0], brillo: 0.9 }),
      pieza(esfera, COLOR.rojo, { pos: [0, 0.33, 0.5], esc: 0.17, emisivo: 1 }),
      pieza(malla('jefeIris', () => G.toro(0.17, 0.035, 28, 8)), [0.15, 0, 0.05], { pos: [0, 0.33, 0.51], rot: rotX(Math.PI / 2) }),
      pieza(esfera, [0.05, 0, 0.02], { pos: [0, 0.33, 0.655], esc: [0.05, 0.1, 0.03], brillo: 1 }), // pupila
      pieza(malla('jefeAro', () => G.toro(1.1, 0.05, 64, 8)), COLOR.magenta, { pos: [0, -0.03, 0], emisivo: 0.9 }),
      pieza(malla('jefeNucleo', () => G.elipsoide(0.42, 0.12, 0.42, 20, 8)), [1, 0.35, 0.3], { pos: [0, -0.28, 0], emisivo: 1 })
    ];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      jefe.push(pieza(esferaChica, COLOR.rojo, { pos: [Math.cos(a) * 1.17, -0.09, Math.sin(a) * 1.17], esc: 0.05, emisivo: 1, parpadeo: i % 2, giro: -0.5 }));
    }
    for (let i = 0; i < 3; i++) {
      const a = Math.PI / 2 + Math.PI / 3 + (i / 3) * Math.PI * 2; // ninguna tapa el ojo
      jefe.push(pieza(malla('pua', () => G.cilindro(0, 0.09, 0.42, 10)), [0.2, 0.08, 0.32], {
        pos: [Math.cos(a) * 0.86, 0.25, Math.sin(a) * 0.86], rot: Q.mult(rotY(-a), rotZ(-0.5)), brillo: 0.6
      }));
    }
    MOD.jefe = jefe;

    /* ---------- ORBE de plasma ---------- */
    MOD.orbe = [pieza(esfera, [1, 0.45, 0.95], { esc: 0.75, emisivo: 1 })];

    /* ---------- METEOROS (tres formas distintas) ---------- */
    MOD.meteoro = [1, 2, 3].map((s) => [pieza(malla('roca' + s, () => G.roca(1, s * 7)), COLOR.roca, { brillo: 0.12 })]);

    /* ---------- NAVE DEL JUGADOR (modo Esquiva) ----------
       Esta mira hacia -Z (se aleja de la cámara). */
    const haciaAdelante = rotX(-Math.PI / 2); // el eje Y del torno pasa a apuntar a -Z
    const nave = [
      pieza(malla('naveCuerpo', () => G.torno([[0, 1.35], [0.17, 0.95], [0.3, 0.35], [0.33, -0.35], [0.26, -0.8], [0, -0.86]], 24)), [0.88, 0.9, 0.97], { rot: haciaAdelante, brillo: 1 }),
      pieza(esfera, COLOR.vidrio, { pos: [0, 0.19, -0.25], esc: [0.17, 0.12, 0.42], alfa: 0.65, brillo: 1, emisivo: 0.25 }),
      pieza(esfera, [0.2, 0.7, 1.0], { pos: [0, -0.04, 0.22], esc: [1.15, 0.05, 0.4], brillo: 0.9 }), // alas
      pieza(esfera, COLOR.magenta, { pos: [0, 0.33, 0.55], esc: [0.035, 0.32, 0.28], brillo: 0.6 }), // aleta
      pieza(esfera, COLOR.cian, { pos: [0, -0.01, 0.22], esc: [1.0, 0.055, 0.05], emisivo: 0.9 }) // franja que brilla
    ];
    [-1, 1].forEach((lado) => {
      nave.push(pieza(malla('canon', () => G.cilindro(0.045, 0.06, 0.7, 10)), COLOR.metal, { pos: [lado * 1.08, -0.02, 0.05], rot: haciaAdelante, brillo: 1 }));
      nave.push(pieza(malla('motorNave', () => G.cilindro(0.13, 0.16, 0.5, 14)), COLOR.metal, { pos: [lado * 0.3, -0.02, 0.72], rot: haciaAdelante, brillo: 1 }));
      nave.push(pieza(malla('llamaNave', () => G.cilindro(0.13, 0.0, 0.6, 12)), [0.35, 0.95, 1.0], { pos: [lado * 0.3, -0.02, 1.25], rot: haciaAdelante, emisivo: 1, llama: lado + 5 }));
      nave.push(pieza(esferaChica, COLOR.rojo, { pos: [lado * 1.17, -0.03, 0.3], esc: 0.05, emisivo: 1, parpadeo: lado > 0 ? 1 : 0 }));
    });
    MOD.nave = nave;

    /* ---------- CRISTAL de energía (se recoge) ---------- */
    MOD.cristal = [
      pieza(malla('cristal', () => G.torno([[0, 0.55], [0.3, 0], [0, -0.55]], 6)), [0.3, 1, 0.85], { emisivo: 0.55, brillo: 1, giro: 2.5 })
    ];
  };
})(window.GS);
