/* =========================================================
   GALAXY STRIKE AR — ajustes.js
   Preferencias del jugador (se guardan en el dispositivo):
   dificultad, música, sonido, vibración, sensibilidad,
   modo zurdo y calidad gráfica.
   ========================================================= */
'use strict';

(function (GS) {
  const CLAVE = 'gs_ajustes';
  const DEF = {
    dificultad: 'normal',  // facil | normal | dificil
    musica: true,
    vibracion: true,
    sensibilidad: 1,       // 0.5 … 1.6
    zurdo: false,
    calidad: 'auto'        // auto | alta | baja
  };

  /** Cuánto cambia el juego con cada dificultad. */
  const DIFICULTAD = {
    facil:   { nombre: 'Fácil',   velocidad: 0.8,  cadenciaEnemiga: 1.35, vidasExtra: 1,  puntos: 0.8 },
    normal:  { nombre: 'Normal',  velocidad: 1,    cadenciaEnemiga: 1,    vidasExtra: 0,  puntos: 1 },
    dificil: { nombre: 'Difícil', velocidad: 1.25, cadenciaEnemiga: 0.75, vidasExtra: -1, puntos: 1.4 }
  };

  let datos = Object.assign({}, DEF);
  try { Object.assign(datos, JSON.parse(localStorage.getItem(CLAVE) || '{}')); } catch (e) { /* sin almacenamiento */ }
  if (!DIFICULTAD[datos.dificultad]) datos.dificultad = 'normal';

  const oyentes = [];
  const A = (GS.Ajustes = {
    DIFICULTAD,
    get: (k) => datos[k],
    set(k, v) {
      datos[k] = v;
      try { localStorage.setItem(CLAVE, JSON.stringify(datos)); } catch (e) { /* nada */ }
      oyentes.forEach((fn) => { try { fn(k, v); } catch (e) { console.error(e); } });
    },
    alCambiar: (fn) => oyentes.push(fn),
    dif: () => DIFICULTAD[datos.dificultad] || DIFICULTAD.normal
  });

  /** Calidad efectiva: «auto» empieza en alta y baja si el equipo va lento. */
  A.calidadBaja = () => datos.calidad === 'baja' || (datos.calidad === 'auto' && A._autoBaja === true);
  A._autoBaja = false;
})(window.GS);
