/* =========================================================
   GALAXY STRIKE AR — poderes.js
   Poderes que sueltan los aliens (Disparos AR: dispárale a la
   cápsula) o que flotan en el camino (Esquiva: atraviésala).
   ========================================================= */
'use strict';

(function (GS) {
  const P = (GS.Poderes = {});

  P.TIPOS = {
    escudo: { corto: 'ESCUDO', nombre: 'Escudo', dur: 15, css: '#38f8ff', rgb: [0.3, 0.9, 1], modos: ['ar', 'esquiva'], desc: 'Aguanta un golpe' },
    lento:  { corto: 'LENTO', nombre: 'Cámara lenta', dur: 6, css: '#c77dff', rgb: [0.75, 0.5, 1], modos: ['ar', 'esquiva'], desc: 'Todo va más lento' },
    doble:  { corto: 'x2', nombre: 'Puntos x2', dur: 10, css: '#ffd23f', rgb: [1, 0.85, 0.25], modos: ['ar', 'esquiva'], desc: 'Puntos dobles' },
    rafaga: { corto: 'RÁFAGA', nombre: 'Ráfaga', dur: 8, css: '#ff8a3d', rgb: [1, 0.5, 0.15], modos: ['ar'], desc: 'Disparas mucho más rápido' },
    bomba:  { corto: 'BOMBA', nombre: 'Bomba', dur: 0, css: '#ff3355', rgb: [1, 0.2, 0.3], modos: ['ar'], desc: 'Destruye a los aliens que ves' },
    iman:   { corto: 'IMÁN', nombre: 'Imán', dur: 10, css: '#7CFF4F', rgb: [0.45, 1, 0.35], modos: ['esquiva'], desc: 'Atrae los cristales' },
    // Nuevos (v3.1)
    vida:     { corto: 'VIDA', nombre: 'Vida extra', dur: 0, css: '#ff4d6d', rgb: [1, 0.3, 0.42], modos: ['ar', 'esquiva'], desc: 'Recuperas un corazón' },
    congelar: { corto: 'HIELO', nombre: 'Congelar', dur: 4, css: '#9be7ff', rgb: [0.6, 0.9, 1], modos: ['ar'], desc: 'Los aliens se quedan quietos' },
    rebote:   { corto: 'REBOTE', nombre: 'Rebote', dur: 10, css: '#5dffb0', rgb: [0.36, 1, 0.69], modos: ['ar'], desc: 'Tu disparo salta al alien más cercano' },
    fantasma: { corto: 'FANTASMA', nombre: 'Fantasma', dur: 5, css: '#e0d4ff', rgb: [0.88, 0.83, 1], modos: ['esquiva'], desc: 'Atraviesas todo sin daño' }
  };

  const activos = {}; // tipo → segundos que quedan
  const oyentes = [];
  P.alActivar = (fn) => oyentes.push(fn);

  P.reiniciar = function () {
    Object.keys(activos).forEach((k) => delete activos[k]);
    pintar(true);
  };

  /** Un poder al azar que sirva en este modo de juego. */
  P.azar = function (tipoJuego) {
    const J = GS.Juego;
    const faltaVida = J && J.vidas < J.vidasMax;
    // VIDA solo sale si te falta un corazón, y sale menos que los demás
    const lista = Object.keys(P.TIPOS).filter((k) => P.TIPOS[k].modos.includes(tipoJuego) && (k !== 'vida' || faltaVida));
    let tipo = lista[(Math.random() * lista.length) | 0];
    if (tipo === 'vida' && Math.random() < 0.5) tipo = lista[(Math.random() * lista.length) | 0];
    return tipo;
  };

  P.activar = function (tipo) {
    const d = P.TIPOS[tipo];
    if (!d) return;
    if (d.dur > 0) activos[tipo] = d.dur;
    GS.Sonido.poder();
    if (GS.Progreso) GS.Progreso.evento('poder');
    oyentes.forEach((fn) => { try { fn(tipo, d); } catch (e) { console.error(e); } });
    pintar(true);
  };

  P.activo = (tipo) => (activos[tipo] || 0) > 0;
  P.restante = (tipo) => activos[tipo] || 0;

  /** El escudo se gasta al recibir un golpe. Devuelve true si te salvó. */
  P.usarEscudo = function () {
    if (!P.activo('escudo')) return false;
    delete activos.escudo;
    pintar(true);
    return true;
  };

  /** Multiplicadores que usan los modos de juego. */
  P.escalaTiempo = () => (P.activo('lento') ? 0.45 : 1);
  P.multPuntos = () => (P.activo('doble') ? 2 : 1);

  /** Corre con el tiempo real (la cámara lenta no alarga los poderes). */
  P.actualizar = function (dt) {
    let cambio = false;
    for (const k of Object.keys(activos)) {
      activos[k] -= dt;
      if (activos[k] <= 0) { delete activos[k]; cambio = true; }
    }
    pintar(cambio);
  };

  /* ---------------- Fichas del HUD ---------------- */
  let ultimas = '';
  function pintar(forzar) {
    const cont = document.getElementById('poderes');
    if (!cont) return;
    const claves = Object.keys(activos).join(',');
    if (forzar || claves !== ultimas) {
      ultimas = claves;
      cont.innerHTML = '';
      Object.keys(activos).forEach((k) => {
        const d = P.TIPOS[k];
        const chip = document.createElement('div');
        chip.className = 'chip-poder';
        chip.style.setProperty('--c', d.css);
        chip.dataset.tipo = k;
        const ico = document.createElement('span');
        ico.textContent = d.corto;
        ico.className = 'corto';
        const barra = document.createElement('i');
        chip.append(ico, barra);
        cont.appendChild(chip);
      });
    }
    cont.querySelectorAll('.chip-poder').forEach((chip) => {
      const k = chip.dataset.tipo, d = P.TIPOS[k];
      const barra = chip.querySelector('i');
      if (barra && d) barra.style.width = Math.max(0, Math.min(100, ((activos[k] || 0) / d.dur) * 100)) + '%';
    });
  }
})(window.GS);
