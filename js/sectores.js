/* =========================================================
   GALAXY STRIKE AR — sectores.js
   La campaña: 4 sectores, cada uno con sus colores, sus
   oleadas (modo Disparos AR) y su configuración para el modo
   Esquiva marcianos. Aquí es fácil inventar oleadas nuevas.

   Oleada (Disparos AR):
     nombre, grupos: [{ tipo, n, cada, desde, detras }]
       tipo: ovni | dron | divisor | teleport | blindado
       n: cuántos · cada: segundos entre uno y otro
       desde: segundo en que empieza el grupo
       detras: true = aparecen a tu espalda (¡emboscada!)
     meteoros: cada cuántos segundos cae un meteoro (opcional)
     jefe: { hp, fases } (opcional)
   ========================================================= */
'use strict';

(function (GS) {
  const S = (GS.Sectores = {});

  S.lista = [
    {
      id: 1, nombre: 'Órbita Lunar', lema: 'Los exploradores de Zorp llegan a la Tierra',
      tema: {
        cielo: ['#04040d', '#0b0820'], suelo: 'rgba(56,248,255,', sol: 'rgba(80,190,255,', acento: '#38f8ff',
        nebulosas: ['rgba(140,60,255,', 'rgba(0,200,255,', 'rgba(255,60,200,', 'rgba(60,255,160,']
      },
      oleadas: [
        { nombre: 'Primer contacto', grupos: [{ tipo: 'ovni', n: 3, cada: 1.3 }] },
        { nombre: 'Patrulla', grupos: [{ tipo: 'ovni', n: 4, cada: 1.1 }, { tipo: 'dron', n: 2, cada: 1.8, desde: 3 }] },
        { nombre: 'Enjambre', grupos: [{ tipo: 'dron', n: 7, cada: 0.9 }] },
        { nombre: 'Escuadrón', grupos: [{ tipo: 'ovni', n: 5, cada: 0.9 }, { tipo: 'dron', n: 3, cada: 1.6, desde: 4 }] },
        { nombre: 'Guardián lunar', jefe: { hp: 14, fases: 2 }, grupos: [{ tipo: 'ovni', n: 2, cada: 2, desde: 3 }] }
      ],
      esquiva: { vel: 16, intervalo: 0.9, pesos: { dron: 4, meteoro: 3 }, anillos: true, laseres: 0, muros: 0, jefeFases: 1 }
    },
    {
      id: 2, nombre: 'Cinturón de Asteroides', lema: 'Rocas por todos lados… y marcianos escondidos',
      tema: {
        cielo: ['#0a0604', '#1f1008'], suelo: 'rgba(255,150,60,', sol: 'rgba(255,140,40,', acento: '#ffb347',
        nebulosas: ['rgba(255,120,40,', 'rgba(255,200,80,', 'rgba(200,60,40,', 'rgba(255,90,140,']
      },
      oleadas: [
        { nombre: 'Lluvia de rocas', meteoros: 3.5, grupos: [{ tipo: 'ovni', n: 3, cada: 1.4 }] },
        { nombre: 'Divisores', meteoros: 5, grupos: [{ tipo: 'divisor', n: 4, cada: 1.4 }, { tipo: 'ovni', n: 2, cada: 2, desde: 3 }] },
        { nombre: 'Emboscada', meteoros: 4.5, grupos: [{ tipo: 'dron', n: 5, cada: 1.2, detras: true }, { tipo: 'ovni', n: 3, cada: 1.5, desde: 2 }] },
        { nombre: 'Tormenta', meteoros: 3, grupos: [{ tipo: 'divisor', n: 4, cada: 1.2 }, { tipo: 'dron', n: 4, cada: 1.3, desde: 3 }] },
        { nombre: 'Rompe-rocas', meteoros: 5, jefe: { hp: 20, fases: 2 }, grupos: [] }
      ],
      esquiva: { vel: 19, intervalo: 0.72, pesos: { meteoro: 6, dron: 2, ovni: 2 }, anillos: true, laseres: 0, muros: 12, jefeFases: 2 }
    },
    {
      id: 3, nombre: 'Nebulosa Zorp', lema: 'Aliens que desaparecen y naves con escudo',
      tema: {
        cielo: ['#020a06', '#0d1a12'], suelo: 'rgba(124,255,79,', sol: 'rgba(124,255,79,', acento: '#7CFF4F',
        nebulosas: ['rgba(124,255,79,', 'rgba(255,61,242,', 'rgba(60,255,200,', 'rgba(180,60,255,']
      },
      oleadas: [
        { nombre: 'Fantasmas de Zorp', grupos: [{ tipo: 'teleport', n: 4, cada: 1.5 }, { tipo: 'ovni', n: 2, cada: 2, desde: 3 }] },
        { nombre: 'Muralla', grupos: [{ tipo: 'blindado', n: 3, cada: 1.8 }, { tipo: 'dron', n: 4, cada: 1.3, desde: 3 }] },
        { nombre: 'Caos', meteoros: 6, grupos: [{ tipo: 'teleport', n: 4, cada: 1.3 }, { tipo: 'divisor', n: 3, cada: 1.6, desde: 2 }] },
        { nombre: 'Ataque total', grupos: [{ tipo: 'blindado', n: 3, cada: 1.8 }, { tipo: 'teleport', n: 3, cada: 1.5, desde: 2 }, { tipo: 'dron', n: 5, cada: 1, desde: 4, detras: true }] },
        { nombre: 'Reina de la nebulosa', jefe: { hp: 26, fases: 3 }, grupos: [{ tipo: 'teleport', n: 2, cada: 3, desde: 4 }] }
      ],
      esquiva: { vel: 21, intervalo: 0.62, pesos: { dron: 3, teleport: 3, ovni: 2, meteoro: 2 }, anillos: true, laseres: 7, muros: 0, jefeFases: 2 }
    },
    {
      id: 4, nombre: 'Nave Nodriza', lema: 'La batalla final contra Zorp, el emperador',
      tema: {
        cielo: ['#0a0206', '#200612'], suelo: 'rgba(255,51,85,', sol: 'rgba(255,51,85,', acento: '#ff3355',
        nebulosas: ['rgba(255,51,85,', 'rgba(199,125,255,', 'rgba(255,120,60,', 'rgba(255,61,242,']
      },
      oleadas: [
        { nombre: 'Defensas', meteoros: 5, grupos: [{ tipo: 'blindado', n: 4, cada: 1.6 }, { tipo: 'ovni', n: 4, cada: 1.2, desde: 2 }] },
        { nombre: 'Hangar', grupos: [{ tipo: 'dron', n: 10, cada: 0.6 }, { tipo: 'divisor', n: 3, cada: 1.5, desde: 3 }] },
        { nombre: 'Espejismo', meteoros: 4, grupos: [{ tipo: 'teleport', n: 6, cada: 1.1 }, { tipo: 'blindado', n: 2, cada: 2, desde: 3 }] },
        { nombre: 'Último muro', meteoros: 4, grupos: [
          { tipo: 'ovni', n: 4, cada: 1.2 }, { tipo: 'divisor', n: 3, cada: 1.4, desde: 2 }, { tipo: 'teleport', n: 3, cada: 1.4, desde: 4 },
          { tipo: 'blindado', n: 3, cada: 1.8, desde: 5 }, { tipo: 'dron', n: 4, cada: 1, desde: 6, detras: true }] },
        { nombre: 'ZORP, EL EMPERADOR', meteoros: 7, jefe: { hp: 40, fases: 3, final: true }, grupos: [] }
      ],
      esquiva: { vel: 24, intervalo: 0.52, pesos: { dron: 3, teleport: 2, ovni: 2, meteoro: 3 }, anillos: true, laseres: 6, muros: 9, jefeFases: 3 }
    }
  ];

  S.total = S.lista.length;
  S.get = (id) => S.lista[(id - 1 + S.total) % S.total];

  /** Tema de colores para una oleada / nivel del modo infinito (cambia cada 5). */
  S.temaInfinito = (n) => S.lista[Math.floor((n - 1) / 5) % S.total];

  /**
   * Oleada del modo infinito: se arma con los enemigos del sector
   * en el que vas, cada vez con más marcianos. Usa siempre la misma
   * cantidad de números de `rng` para que en multijugador sea igual.
   */
  const POOL = [['ovni', 'dron'], ['ovni', 'dron', 'divisor'], ['ovni', 'dron', 'divisor', 'teleport', 'blindado'], ['ovni', 'dron', 'divisor', 'teleport', 'blindado']];
  S.oleadaInfinita = function (n, rng) {
    const idx = Math.min(3, Math.floor((n - 1) / 5));
    const pool = POOL[idx];
    const tema = S.temaInfinito(n);
    if (n % 5 === 0) {
      return { nombre: '¡Nave nodriza!', jefe: { hp: 14 + n * 2, fases: Math.min(3, 1 + Math.floor(n / 10)) }, meteoros: n >= 10 ? 6 : 0,
        grupos: [{ tipo: 'ovni', n: 2, cada: 1.5, desde: 2.5 }], tema };
    }
    const grupos = [];
    const nGrupos = 1 + Math.min(3, Math.floor(n / 3));
    let desde = 0.4;
    for (let i = 0; i < nGrupos; i++) {
      const a = rng(), b = rng(), c = rng();
      const tipo = pool[Math.floor(a * pool.length)];
      const cant = Math.max(2, Math.round((1.5 + n * 0.45) / nGrupos + b * 2));
      grupos.push({ tipo, n: Math.min(cant, 8), cada: 0.8 + c * 0.9, desde, detras: n >= 7 && b > 0.8 });
      desde += 1.5 + c * 2;
    }
    const nombres = ['Avanzada', 'Patrulla', 'Enjambre', 'Escuadrón', 'Asalto', 'Invasión', 'Oleada salvaje', 'Furia de Zorp'];
    return { nombre: nombres[(n - 1) % nombres.length], grupos, meteoros: n >= 3 ? Math.max(3.2, 8.5 - n * 0.35) : 0, tema };
  };
})(window.GS);
