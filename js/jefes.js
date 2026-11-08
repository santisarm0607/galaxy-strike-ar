/* =========================================================
   GALAXY STRIKE AR — jefes.js
   Los 4 jefes, uno por sector. Aquí van sus nombres, avisos
   y dónde está su punto débil. Sus ataques están en
   juego.js (Disparos AR) y esquiva.js (Esquiva marcianos).
   En el modo Infinito se turnan: 1, 2, 3, 4, 1…
   ========================================================= */
'use strict';

(function (GS) {
  const JF = (GS.Jefes = {});

  JF.lista = {
    1: {
      id: 'nodriza', modelo: 'jefe',
      nombre: 'GUARDIÁN LUNAR',
      llegada: '¡LLEGÓ EL GUARDIÁN LUNAR!',
      fases: { 2: '¡El guardián se enfurece!', final: '¡Su ojo quedó expuesto! Dispárale al ojo' },
      esquiva: { 2: '¡Dispara en abanico!', 3: '¡Láseres! Busca el hueco' },
      muerte: '¡GUARDIÁN LUNAR DESTRUIDO!',
      puntoDebil: [0, 0.33, 0.5], radioDebil: 0.2
    },
    2: {
      id: 'coloso', modelo: 'coloso',
      nombre: 'EL ROMPE-ROCAS',
      llegada: '¡EL ROMPE-ROCAS! Esquiva sus meteoros',
      fases: { 2: '¡Se cubre de rocas! Dispárale cuando se abra', final: '¡Su núcleo está al rojo vivo! Dispárale ahí' },
      esquiva: { 2: '¡Lluvia de rocas! Busca el hueco', 3: '¡Está furioso! Rocas por todos lados' },
      muerte: '¡EL ROMPE-ROCAS SE HIZO POLVO!',
      puntoDebil: [0, 0.02, 0.78], radioDebil: 0.3
    },
    3: {
      id: 'medusa', modelo: 'medusa',
      nombre: 'LA REINA DE LA NEBULOSA',
      llegada: '¡LA REINA DE LA NEBULOSA! Se teletransporta: sigue las flechas',
      fases: { 2: '¡Se teletransporta más rápido y llama a sus fantasmas!', final: '¡Su corazón brilla! Dispárale al centro' },
      esquiva: { 2: '¡Cortina de plasma! Busca el hueco', 3: '¡Salta por todos lados!' },
      muerte: '¡LA REINA DE LA NEBULOSA SE DESVANECIÓ!',
      puntoDebil: [0, 0.18, 0.42], radioDebil: 0.34
    },
    4: {
      id: 'emperador', modelo: 'emperador',
      nombre: 'ZORP, EL EMPERADOR',
      llegada: '¡ZORP, EL EMPERADOR, EN PERSONA!',
      fases: { 2: '¡Zorp llama a sus refuerzos!', final: '¡Zorp quedó al descubierto! Dispárale a la cabeza' },
      esquiva: { 2: '¡Láseres imperiales!', 3: '¡Todo su arsenal! Aguanta' },
      muerte: '¡DERROTASTE A ZORP!',
      puntoDebil: [0, 0.56, 0.44], radioDebil: 0.24
    }
  };

  JF.get = (n) => JF.lista[n] || JF.lista[1];
  /** k-ésimo jefe del modo Infinito (1, 2, 3, 4, 1, 2…). */
  JF.turno = (k) => JF.get(1 + ((Math.max(1, k) - 1) % 4));
})(window.GS);
