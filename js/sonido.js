/* =========================================================
   GALAXY STRIKE AR — sonido.js
   Efectos de sonido sintetizados con Web Audio (sin archivos).
   ========================================================= */
'use strict';

(function (GS) {
  let ctx = null, maestro = null, bufRuido = null;
  let activo = true;
  try { activo = localStorage.getItem('gs_sonido') !== '0'; } catch (e) { /* sin almacenamiento */ }

  function iniciar() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { ctx = new AC(); } catch (e) { return; }
      maestro = ctx.createGain();
      maestro.gain.value = activo ? 0.55 : 0;
      maestro.connect(ctx.destination);
      const n = ctx.sampleRate;
      bufRuido = ctx.createBuffer(1, n, ctx.sampleRate);
      const d = bufRuido.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function tono(tipo, f0, f1, dur, vol, retardo = 0) {
    if (!ctx || !activo) return;
    const t = ctx.currentTime + retardo;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(maestro);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function ruido(dur, vol, f0, f1, retardo = 0, filtro = 'lowpass') {
    if (!ctx || !activo) return;
    const t = ctx.currentTime + retardo;
    const s = ctx.createBufferSource();
    s.buffer = bufRuido;
    const fl = ctx.createBiquadFilter();
    fl.type = filtro;
    fl.frequency.setValueAtTime(f0, t);
    if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl);
    fl.connect(g);
    g.connect(maestro);
    s.start(t);
    s.stop(t + dur + 0.05);
  }

  GS.Sonido = {
    iniciar,
    contexto: () => ctx,
    get activo() { return activo; },
    alternar() {
      activo = !activo;
      try { localStorage.setItem('gs_sonido', activo ? '1' : '0'); } catch (e) { /* nada */ }
      if (maestro) maestro.gain.value = activo ? 0.55 : 0;
      return activo;
    },
    disparo() { tono('square', 1100, 220, 0.11, 0.11); tono('sawtooth', 1800, 400, 0.07, 0.05); },
    impacto() { tono('triangle', 520, 260, 0.08, 0.2); },
    explosion(grande) {
      ruido(grande ? 0.9 : 0.45, grande ? 0.7 : 0.45, 2400, 120);
      tono('sine', grande ? 110 : 170, 35, grande ? 0.8 : 0.35, 0.45);
    },
    orbe() { tono('sine', 300, 700, 0.18, 0.1); },
    danio() { tono('sawtooth', 140, 45, 0.45, 0.35); ruido(0.3, 0.4, 900, 100); },
    esquivado() { tono('triangle', 660, 1320, 0.14, 0.18); tono('triangle', 990, 1980, 0.12, 0.12, 0.07); },
    alerta() { tono('square', 880, 880, 0.09, 0.12); tono('square', 660, 660, 0.09, 0.12, 0.12); },
    rebote() { tono('triangle', 1500, 900, 0.05, 0.12); },
    meteoro() { ruido(1.2, 0.25, 300, 1400, 0, 'bandpass'); },
    oleada() { [523, 659, 784, 1046].forEach((f, i) => tono('triangle', f, f, 0.16, 0.16, i * 0.09)); },
    cuenta(final) { const f = final ? 1046 : 523; tono('square', f, f, final ? 0.35 : 0.12, 0.13); },
    ataque() { for (let i = 0; i < 3; i++) tono('sawtooth', 500, 900, 0.18, 0.11, i * 0.2); },
    combo(n) { tono('triangle', 400 + n * 60, 600 + n * 80, 0.1, 0.11); },
    finJuego() { [784, 659, 523, 392].forEach((f, i) => tono('triangle', f, f * 0.98, 0.25, 0.15, i * 0.18)); },
    clic() { tono('sine', 700, 900, 0.05, 0.08); },
    impulso() { ruido(0.35, 0.3, 600, 3000, 0, 'bandpass'); tono('sawtooth', 220, 880, 0.22, 0.08); },
    cristal() { tono('triangle', 1320, 1320, 0.08, 0.12); tono('triangle', 1760, 1760, 0.12, 0.1, 0.06); },
    poder() { [660, 880, 1320].forEach((f, i) => tono('triangle', f, f * 1.01, 0.12, 0.13, i * 0.06)); },
    escudo() { tono('sine', 300, 1200, 0.25, 0.15); ruido(0.2, 0.15, 3000, 800, 0, 'highpass'); },
    teleport() { tono('sine', 1800, 200, 0.18, 0.1); },
    logro() { [784, 988, 1175, 1568].forEach((f, i) => tono('triangle', f, f, 0.18, 0.13, i * 0.08)); },
    anillo() { tono('sine', 990, 1980, 0.15, 0.12); tono('triangle', 1480, 1480, 0.1, 0.08, 0.05); },
    laser() { tono('sawtooth', 120, 90, 0.4, 0.06); },
    porPoco() { ruido(0.25, 0.25, 2000, 400, 0, 'bandpass'); tono('triangle', 700, 1400, 0.12, 0.12, 0.05); }
  };
})(window.GS);
