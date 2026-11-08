/* =========================================================
   GALAXY STRIKE AR — reto.js
   RETO DEL DÍA: cada día hay una partida especial, igual para
   todos (misma semilla = mismas oleadas) y con un modificador
   distinto. Puedes intentarlo las veces que quieras: cuenta tu
   mejor puntaje del día. Al día siguiente sale otro reto.
   ========================================================= */
'use strict';

(function (GS) {
  const R = (GS.Reto = {});

  /** Los modificadores posibles (sale uno cada día). */
  R.MODS = [
    { id: 'meteoros', icono: '☄️', nombre: 'Lluvia de meteoros', desc: 'Caen el doble de meteoros.' },
    { id: 'fragil', icono: '💔', nombre: 'Frágil', desc: 'Solo tienes 3 vidas.' },
    { id: 'poderes', icono: '⚡', nombre: 'Poderes de sobra', desc: 'Salen el doble de cápsulas de poder.' },
    { id: 'turbo', icono: '🚀', nombre: 'Turbo', desc: 'Todo va 20 % más rápido, y da 20 % más puntos.' },
    { id: 'jefes', icono: '👑', nombre: 'Directo al jefe', desc: 'Empiezas justo antes del primer jefe.' }
  ];

  const dos = (n) => (n < 10 ? '0' : '') + n;
  /** Fecha de hoy en tu zona horaria: '2026-11-07'. */
  R.hoy = function () {
    const d = new Date();
    return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate());
  };
  /** Medianoche de hoy (en tu zona) en formato ISO, para pedir la tabla mundial del día. */
  R.inicioDelDia = function () {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  };

  /** Número a partir de un texto (siempre el mismo para el mismo texto). */
  function hash(txt) {
    let h = 2166136261;
    for (let i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  R.semilla = (tipo) => hash('galaxy-strike|' + R.hoy() + '|' + tipo);
  R.mod = () => R.MODS[hash('mod|' + R.hoy()) % R.MODS.length];

  /* ---------- Puntajes del día (en este dispositivo) ---------- */
  function leer() {
    try {
      const d = JSON.parse(localStorage.getItem('gs_reto') || 'null');
      if (d && d.fecha === R.hoy()) return d;
    } catch (e) { /* nada */ }
    return { fecha: R.hoy(), ar: { mejor: 0, intentos: 0 }, esquiva: { mejor: 0, intentos: 0 } };
  }
  function guardar(d) { try { localStorage.setItem('gs_reto', JSON.stringify(d)); } catch (e) { /* nada */ } }

  R.mejor = (tipo) => (leer()[tipo] || { mejor: 0 }).mejor;
  R.intentos = (tipo) => (leer()[tipo] || { intentos: 0 }).intentos;

  /** Guarda el resultado de un intento. Devuelve { nuevoMejor, mejor, intentos }. */
  R.registrar = function (tipo, puntos) {
    const d = leer();
    const t = (d[tipo] = d[tipo] || { mejor: 0, intentos: 0 });
    t.intentos++;
    const nuevoMejor = puntos > t.mejor;
    if (nuevoMejor) t.mejor = puntos;
    guardar(d);
    GS.Progreso.evento('reto');
    return { nuevoMejor, mejor: t.mejor, intentos: t.intentos };
  };

  /** Tipo con que se guarda en la tabla mundial (Supabase). */
  R.tipoGlobal = (tipo) => 'reto_' + tipo;
})(window.GS);
