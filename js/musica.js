/* =========================================================
   GALAXY STRIKE AR — musica.js
   Música synthwave hecha por código (sin archivos de audio).
   Bajo, batería, pads y arpegios; sube de intensidad con el
   nivel y cambia de acordes cuando aparece una nave nodriza.
   ========================================================= */
'use strict';

(function (GS) {
  const M = (GS.Musica = {});
  const BPM = 104;
  const S16 = 60 / BPM / 4; // duración de una semicorchea
  const VOLUMEN = 0.3;
  const PROG = {
    normal: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], // Lam – Fa – Do – Sol
    jefe: [[50, 53, 57], [46, 50, 53], [48, 52, 55], [45, 49, 52]]   // Rem – Sib – Do – La
  };
  const frec = (m) => 440 * Math.pow(2, (m - 69) / 12);

  let ctx = null, salida = null, ruido = null, iv = null;
  let siguiente = 0, paso = 0, modo = 'menu', nivel = 1, sonando = false;

  function preparar() {
    if (ctx) return true;
    ctx = GS.Sonido.contexto();
    if (!ctx) return false;
    salida = ctx.createGain();
    salida.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    salida.connect(comp);
    comp.connect(ctx.destination);
    const n = Math.floor(ctx.sampleRate * 0.5);
    ruido = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = ruido.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  function nota(tipo, f, t, dur, vol, corte, desafinar = 0) {
    const o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
    o.type = tipo;
    o.frequency.setValueAtTime(f, t);
    o.detune.value = desafinar;
    fl.type = 'lowpass';
    fl.frequency.setValueAtTime(corte, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(fl); fl.connect(g); g.connect(salida);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function bombo(t, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.18);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g); g.connect(salida);
    o.start(t); o.stop(t + 0.25);
  }

  function golpeRuido(t, dur, vol, tipoFiltro, f) {
    const s = ctx.createBufferSource(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
    s.buffer = ruido;
    fl.type = tipoFiltro;
    fl.frequency.value = f;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(salida);
    s.start(t); s.stop(t + dur + 0.02);
  }

  function tocarPaso(p, t) {
    const prog = modo === 'jefe' ? PROG.jefe : PROG.normal;
    const acorde = prog[Math.floor(p / 16) % 4];
    const i = p % 16;
    const n = modo === 'menu' ? 0 : nivel;

    // Pad: un acorde largo por compás
    if (i === 0) acorde.forEach((m) => { nota('sawtooth', frec(m), t, S16 * 16, 0.022, 900, -8); nota('sawtooth', frec(m), t, S16 * 16, 0.022, 900, 8); });

    // Bajo
    if (n >= 1 && i % 2 === 0) nota('sawtooth', frec(acorde[0] - 24 + (i % 8 === 6 ? 12 : 0)), t, S16 * 1.7, 0.085, 650);
    else if (n === 0 && i % 8 === 0) nota('triangle', frec(acorde[0] - 24), t, S16 * 7, 0.08, 500);

    // Batería
    if (n >= 1) {
      if (i % 4 === 0) bombo(t, 0.5);
      if (i === 4 || i === 12) golpeRuido(t, 0.16, 0.22, 'bandpass', 1800);
      if (n >= 2 && i % 2 === 1) golpeRuido(t, 0.04, 0.08, 'highpass', 7000);
    }

    // Arpegio
    const arpegio = [acorde[0] + 12, acorde[1] + 12, acorde[2] + 12, acorde[1] + 24];
    if (n >= 2 || modo === 'jefe') nota('square', frec(arpegio[i % 4]), t, S16 * 0.9, 0.03, 2600);
    else if (n === 0 && i % 2 === 0) nota('triangle', frec(arpegio[(i / 2) % 4]), t, S16 * 1.6, 0.03, 2200);

    // Melodía suave en intensidad alta
    if (n >= 3 && (i === 0 || i === 6 || i === 10)) nota('triangle', frec(acorde[2] + 12 + (i === 6 ? 2 : 0)), t, S16 * 3, 0.045, 3000);
  }

  function programar() {
    if (!ctx) return;
    if (siguiente < ctx.currentTime - 0.2) siguiente = ctx.currentTime + 0.05; // volvió de segundo plano
    while (siguiente < ctx.currentTime + 0.15) {
      tocarPaso(paso, siguiente);
      siguiente += S16;
      paso = (paso + 1) % 64;
    }
  }

  const habilitada = () => !GS.Ajustes || GS.Ajustes.get('musica') !== false;

  /** modo: 'menu' | 'juego' | 'jefe' */
  M.tocar = function (nuevo) {
    modo = nuevo || modo;
    if (!habilitada() || !preparar()) return;
    if (!sonando) {
      sonando = true;
      siguiente = ctx.currentTime + 0.08;
      paso = 0;
      iv = setInterval(programar, 25);
      salida.gain.cancelScheduledValues(ctx.currentTime);
      salida.gain.setTargetAtTime(VOLUMEN, ctx.currentTime, 0.4);
    }
  };

  M.nivel = function (n) { nivel = Math.max(1, Math.min(3, n | 0)); };

  M.parar = function () {
    if (!sonando || !ctx) return;
    sonando = false;
    clearInterval(iv);
    salida.gain.cancelScheduledValues(ctx.currentTime);
    salida.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
  };

  M.alternar = function () {
    const on = !habilitada();
    GS.Ajustes.set('musica', on);
    if (on) M.tocar(); else M.parar();
    return on;
  };
})(window.GS);
