/* =========================================================
   GALAXY STRIKE AR — progreso.js
   Todo lo que se guarda entre partidas:
   - sectores completados y estrellas
   - logros y contadores
   - naves desbloqueables (colores de la nave y del láser)
   - top 10 de récords (en el dispositivo)
   - récords mundiales (opcional, con Supabase: ver js/config.js)
   ========================================================= */
'use strict';

(function (GS) {
  function leer(clave, def) {
    try { const v = JSON.parse(localStorage.getItem(clave) || 'null'); return v == null ? def : v; } catch (e) { return def; }
  }
  function guardar(clave, v) {
    try { localStorage.setItem(clave, JSON.stringify(v)); } catch (e) { /* nada */ }
  }

  const P = (GS.Progreso = {});

  /* ---------------- Logros ---------------- */
  P.LOGROS = [
    { id: 'primer_alien', icono: '👾', nombre: 'Primer contacto', desc: 'Destruye tu primer alien.' },
    { id: 'combo10', icono: '🔥', nombre: 'Imparable', desc: 'Haz un combo de 10.' },
    { id: 'cazajefes', icono: '🛸', nombre: 'Cazajefes', desc: 'Derrota a un jefe en Disparos AR.' },
    { id: 'sobreviviente', icono: '🛡️', nombre: 'Sobreviviente', desc: 'Sobrevive a un jefe en Esquiva marcianos.' },
    { id: 'esquivador', icono: '💨', nombre: 'Por un pelo', desc: 'Logra 25 «¡por poco!» en una partida.' },
    { id: 'meteorologo', icono: '☄️', nombre: 'Meteorólogo', desc: 'Esquiva 30 meteoros en Disparos AR (en total).' },
    { id: 'coleccionista', icono: '💎', nombre: 'Coleccionista', desc: 'Junta 100 cristales (en total).' },
    { id: 'intocable', icono: '✨', nombre: 'Intocable', desc: 'Aguanta 60 segundos sin recibir daño.' },
    { id: 'poderoso', icono: '⚡', nombre: 'Poderoso', desc: 'Usa 10 poderes (en total).' },
    { id: 'exterminador', icono: '💥', nombre: 'Exterminador', desc: 'Destruye 500 aliens (en total).' },
    { id: 'perfecto', icono: '⭐', nombre: 'Perfecto', desc: 'Gana 3 estrellas en un sector.' },
    { id: 'conquistador', icono: '👑', nombre: 'Conquistador', desc: 'Completa los 4 sectores de un modo.' },
    { id: 'leyenda', icono: '🏆', nombre: 'Leyenda', desc: 'Haz 25.000 puntos en una partida.' },
    { id: 'campeon', icono: '🥇', nombre: 'Campeón', desc: 'Gana una partida en línea.' },
    { id: 'en_equipo', icono: '🤝', nombre: 'Trabajo en equipo', desc: 'Cumple la meta en una partida cooperativa.' },
    { id: 'retador', icono: '📅', nombre: 'Retador', desc: 'Juega el reto del día.' }
  ];

  const est = leer('gs_progreso', { logros: {}, cont: {} });
  est.logros = est.logros || {};
  est.cont = est.cont || {};
  const oyentesLogro = [];
  P.alLograr = (fn) => oyentesLogro.push(fn);
  P.logrado = (id) => !!est.logros[id];
  P.contador = (k) => est.cont[k] || 0;

  function lograr(id) {
    if (est.logros[id]) return;
    est.logros[id] = Date.now();
    guardar('gs_progreso', est);
    const l = P.LOGROS.find((x) => x.id === id);
    if (l) oyentesLogro.forEach((fn) => { try { fn(l); } catch (e) { console.error(e); } });
  }
  function sumar(k, n = 1) {
    est.cont[k] = (est.cont[k] || 0) + n;
    guardar('gs_progreso', est);
    return est.cont[k];
  }

  /** Los modos de juego avisan aquí lo que va pasando. */
  P.evento = function (nombre, valor) {
    switch (nombre) {
      case 'kill': { const t = sumar('kills'); if (t >= 1) lograr('primer_alien'); if (t >= 500) lograr('exterminador'); break; }
      case 'combo': if (valor >= 10) lograr('combo10'); break;
      case 'jefe': sumar('jefes'); lograr('cazajefes'); break;
      case 'jefeEsquiva': sumar('jefesEsquiva'); lograr('sobreviviente'); break;
      case 'porPoco': if (valor >= 25) lograr('esquivador'); break;
      case 'meteoro': if (sumar('meteoros') >= 30) lograr('meteorologo'); break;
      case 'cristal': if (sumar('cristales') >= 100) lograr('coleccionista'); break;
      case 'sinDanio': if (valor >= 60) lograr('intocable'); break;
      case 'poder': if (sumar('poderes') >= 10) lograr('poderoso'); break;
      case 'puntos': if (valor >= 25000) lograr('leyenda'); break;
      case 'victoriaOnline': sumar('victorias'); lograr('campeon'); break;
      case 'metaCoop': lograr('en_equipo'); break;
      case 'reto': lograr('retador'); break;
    }
  };

  /* ---------------- Sectores ---------------- */
  const sec = leer('gs_sectores', { ar: {}, esquiva: {} });
  sec.ar = sec.ar || {};
  sec.esquiva = sec.esquiva || {};

  P.sector = function (tipo, id) {
    const t = sec[tipo] || {};
    const d = t[id] || null;
    return { estrellas: d ? d.e : 0, mejor: d ? d.m : 0, completado: !!d, desbloqueado: id === 1 || !!t[id - 1] };
  };

  P.completarSector = function (tipo, id, estrellas, puntos) {
    const t = (sec[tipo] = sec[tipo] || {});
    const antes = t[id];
    const nuevoDesbloqueo = !antes && id < GS.Sectores.total;
    t[id] = { e: Math.max(estrellas, antes ? antes.e : 0), m: Math.max(puntos, antes ? antes.m : 0) };
    guardar('gs_sectores', sec);
    if (estrellas >= 3) lograr('perfecto');
    let todos = true;
    for (let i = 1; i <= GS.Sectores.total; i++) if (!t[i]) todos = false;
    if (todos) lograr('conquistador');
    return { nuevoDesbloqueo };
  };

  /* ---------------- Naves desbloqueables ---------------- */
  P.NAVES = [
    { id: 'estandar', nombre: 'Estándar', requiere: null,
      colores: { casco: [0.88, 0.9, 0.97], alas: [0.2, 0.7, 1.0], franja: [0.22, 0.97, 1.0], aleta: [1, 0.25, 0.95], llama: [0.35, 0.95, 1.0] }, laser: '56,248,255' },
    { id: 'neon', nombre: 'Neón Rosa', requiere: 'combo10',
      colores: { casco: [0.95, 0.85, 0.95], alas: [1, 0.25, 0.85], franja: [1, 0.5, 0.95], aleta: [0.3, 0.9, 1], llama: [1, 0.4, 0.9] }, laser: '255,61,242' },
    { id: 'zorp', nombre: 'Verde Zorp', requiere: 'coleccionista',
      colores: { casco: [0.75, 0.95, 0.7], alas: [0.35, 0.9, 0.25], franja: [0.6, 1, 0.4], aleta: [1, 0.85, 0.3], llama: [0.6, 1, 0.4] }, laser: '124,255,79' },
    { id: 'dorada', nombre: 'Dorada', requiere: 'perfecto',
      colores: { casco: [1, 0.84, 0.4], alas: [0.95, 0.6, 0.15], franja: [1, 0.95, 0.6], aleta: [1, 0.4, 0.2], llama: [1, 0.75, 0.3] }, laser: '255,210,63' },
    { id: 'sigilo', nombre: 'Sigilo', requiere: 'conquistador',
      colores: { casco: [0.16, 0.17, 0.22], alas: [0.1, 0.1, 0.14], franja: [1, 0.2, 0.3], aleta: [1, 0.2, 0.3], llama: [1, 0.25, 0.35] }, laser: '255,51,85' }
  ];
  let naveElegida = leer('gs_nave', 'estandar');
  P.naveDisponible = (id) => { const n = P.NAVES.find((x) => x.id === id); return !!n && (!n.requiere || P.logrado(n.requiere)); };
  P.nave = () => P.NAVES.find((x) => x.id === naveElegida && P.naveDisponible(x.id)) || P.NAVES[0];
  P.elegirNave = (id) => { if (P.naveDisponible(id)) { naveElegida = id; guardar('gs_nave', id); } };

  /* ---------------- Récords (top 10 en el dispositivo) ---------------- */
  const top = leer('gs_top', { ar: [], esquiva: [] });
  P.top = (tipo) => (top[tipo] || []).slice();
  /** Guarda un puntaje del modo infinito. Devuelve el puesto (1-10) o 0 si no entró. */
  P.agregarRecord = function (tipo, nombre, puntos) {
    if (!puntos) return 0;
    const l = (top[tipo] = top[tipo] || []);
    const fila = { n: nombre, p: puntos, f: Date.now() };
    l.push(fila);
    l.sort((a, b) => b.p - a.p);
    l.length = Math.min(l.length, 10);
    guardar('gs_top', top);
    const i = l.indexOf(fila);
    return i >= 0 ? i + 1 : 0;
  };
  P.mejor = (tipo) => ((top[tipo] || [])[0] || { p: 0 }).p;

  /* ---------------- Récords mundiales (opcional, Supabase) ---------------- */
  const cfg = () => GS.CONFIG_GLOBAL || {};
  // Las llaves «anon» viejas son JWT (empiezan con eyJ) y van también en Authorization;
  // las «publishable» nuevas (sb_publishable_…) van solo en apikey.
  const cabeceras = (extra) => {
    const k = cfg().supabaseKey;
    const h = Object.assign({ apikey: k }, extra || {});
    if (/^eyJ/.test(k)) h.Authorization = 'Bearer ' + k;
    return h;
  };
  P.global = {
    activo: () => !!(cfg().supabaseUrl && cfg().supabaseKey) && !GS.MODO_PRUEBA,
    async enviar(tipo, nombre, puntos) {
      if (!P.global.activo() || !puntos) return false;
      try {
        const r = await fetch(cfg().supabaseUrl.replace(/\/$/, '') + '/rest/v1/records', {
          method: 'POST',
          headers: cabeceras({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
          body: JSON.stringify({ nombre: String(nombre).slice(0, 14), puntos: Math.round(puntos), tipo })
        });
        return r.ok;
      } catch (e) { return false; }
    },
    /** Top 10 mundial. desde (opcional): solo los puntajes desde esa fecha ISO (para el reto del día). */
    async leer(tipo, desde) {
      if (!P.global.activo()) return null;
      try {
        let url = cfg().supabaseUrl.replace(/\/$/, '') + '/rest/v1/records?select=nombre,puntos&tipo=eq.' + encodeURIComponent(tipo) + '&order=puntos.desc&limit=10';
        if (desde) url += '&creado=gte.' + encodeURIComponent(desde);
        const r = await fetch(url, { headers: cabeceras() });
        if (!r.ok) return null;
        const d = await r.json();
        return Array.isArray(d) ? d.map((x) => ({ n: String(x.nombre || '').slice(0, 14), p: Number(x.puntos) || 0 })) : null;
      } catch (e) { return null; }
    }
  };
})(window.GS);
