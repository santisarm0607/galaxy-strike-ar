/* =========================================================
   GALAXY STRIKE AR — sprites.js
   Dibuja los aliens una sola vez en lienzos ocultos (sin
   imágenes externas). Luego el juego solo los copia y escala.
   ========================================================= */
'use strict';

(function (GS) {
  const TAU = Math.PI * 2;

  function lienzo(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  /** Silueta blanca para el destello cuando le das a un enemigo. */
  function blanco(src) {
    const c = lienzo(src.width, src.height), g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, c.width, c.height);
    return c;
  }

  function brillo(g, x, y, r, color) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, color);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  }

  /* ---------- Ovni (platillo con alien piloto) ---------- */
  function ovni(fase) {
    const w = 256, h = 168, c = lienzo(w, h), g = c.getContext('2d');
    const cx = w / 2, cy = h * 0.56;

    // Halo verde debajo (círculo aplastado para que no tenga bordes duros)
    g.save();
    g.translate(cx, cy + 28);
    g.scale(1, 0.4);
    let gr = g.createRadialGradient(0, 0, 4, 0, 0, 112);
    gr.addColorStop(0, 'rgba(120,255,170,0.5)');
    gr.addColorStop(1, 'rgba(120,255,170,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, 112, 0, TAU);
    g.fill();
    g.restore();

    // Cúpula de vidrio
    gr = g.createLinearGradient(cx - 50, cy - 80, cx + 40, cy);
    gr.addColorStop(0, 'rgba(200,255,255,0.95)');
    gr.addColorStop(0.5, 'rgba(80,200,255,0.75)');
    gr.addColorStop(1, 'rgba(20,60,120,0.9)');
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(cx, cy - 12, 52, 56, 0, Math.PI, 0);
    g.fill();

    // Piloto
    g.fillStyle = '#7CFF4F';
    g.beginPath();
    g.ellipse(cx, cy - 30, 20, 23, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#061505';
    g.beginPath(); g.ellipse(cx - 8, cy - 31, 6, 9.5, -0.5, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(cx + 8, cy - 31, 6, 9.5, 0.5, 0, TAU); g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(cx - 9, cy - 34, 2, 0, TAU); g.fill();
    g.beginPath(); g.arc(cx + 7, cy - 34, 2, 0, TAU); g.fill();

    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.beginPath();
    g.ellipse(cx - 24, cy - 44, 8, 16, -0.6, 0, TAU);
    g.fill();

    // Disco metálico
    gr = g.createLinearGradient(0, cy - 26, 0, cy + 28);
    gr.addColorStop(0, '#f4f7ff');
    gr.addColorStop(0.42, '#9eabc4');
    gr.addColorStop(0.56, '#4a566e');
    gr.addColorStop(1, '#1b2132');
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(cx, cy, 122, 30, 0, 0, TAU);
    g.fill();

    g.strokeStyle = 'rgba(56,248,255,0.9)';
    g.lineWidth = 3;
    g.beginPath();
    g.ellipse(cx, cy + 3, 108, 19, 0, 0.12, Math.PI - 0.12);
    g.stroke();

    // Luces que parpadean (dos fases)
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (0.12 + (0.76 * i) / 6);
      const x = cx + Math.cos(a) * 100, y = cy + 4 + Math.sin(a) * 16;
      const encendida = (i + fase) % 2 === 0;
      const col = encendida ? (i % 3 === 0 ? '#ff3df2' : '#ffe14d') : '#5a4a2a';
      if (encendida) brillo(g, x, y, 13, i % 3 === 0 ? 'rgba(255,61,242,0.8)' : 'rgba(255,225,77,0.8)');
      g.fillStyle = col;
      g.beginPath();
      g.arc(x, y, 5, 0, TAU);
      g.fill();
    }
    return c;
  }

  /* ---------- Dron kamikaze (alien con jetpack) ---------- */
  function dron(fase) {
    const s = 200, c = lienzo(s, s), g = c.getContext('2d'), cx = s / 2;
    const largo = fase ? 52 : 38;

    // Llama del jetpack
    let gr = g.createLinearGradient(0, 140, 0, 140 + largo);
    gr.addColorStop(0, 'rgba(255,240,150,1)');
    gr.addColorStop(0.4, 'rgba(255,140,40,0.9)');
    gr.addColorStop(1, 'rgba(255,60,20,0)');
    g.fillStyle = gr;
    [-16, 16].forEach((dx) => {
      g.beginPath();
      g.moveTo(cx + dx - 9, 140);
      g.quadraticCurveTo(cx + dx, 140 + largo * 1.1, cx + dx + 9, 140);
      g.fill();
    });

    // Jetpack
    g.fillStyle = '#5b6680';
    g.fillRect(cx - 28, 112, 20, 30);
    g.fillRect(cx + 8, 112, 20, 30);
    g.fillStyle = '#9aa6bf';
    g.fillRect(cx - 28, 112, 20, 6);
    g.fillRect(cx + 8, 112, 20, 6);

    // Cuerpo
    g.fillStyle = '#3aa62a';
    g.beginPath();
    g.ellipse(cx, 126, 24, 22, 0, 0, TAU);
    g.fill();

    // Cabeza
    gr = g.createRadialGradient(cx - 18, 56, 8, cx, 78, 70);
    gr.addColorStop(0, '#d2ffaf');
    gr.addColorStop(0.45, '#6ee845');
    gr.addColorStop(1, '#2a8a1c');
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(cx, 78, 56, 50, 0, 0, TAU);
    g.fill();

    // Antenas
    g.strokeStyle = '#2a8a1c';
    g.lineWidth = 4;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(cx - 20, 36); g.lineTo(cx - 34, 10);
    g.moveTo(cx + 20, 36); g.lineTo(cx + 34, 10);
    g.stroke();
    brillo(g, cx - 34, 10, 14, 'rgba(255,61,242,0.9)');
    brillo(g, cx + 34, 10, 14, 'rgba(255,61,242,0.9)');
    g.fillStyle = '#ff9bf5';
    g.beginPath(); g.arc(cx - 34, 10, 5, 0, TAU); g.fill();
    g.beginPath(); g.arc(cx + 34, 10, 5, 0, TAU); g.fill();

    // Ojos grandes
    g.fillStyle = '#040804';
    g.beginPath(); g.ellipse(cx - 22, 84, 16, 25, -0.55, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(cx + 22, 84, 16, 25, 0.55, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.beginPath(); g.ellipse(cx - 27, 76, 4, 6, -0.5, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(cx + 17, 76, 4, 6, 0.5, 0, TAU); g.fill();

    // Boca
    g.strokeStyle = '#173f10';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(cx, 106, 8, 0.2, Math.PI - 0.2);
    g.stroke();
    return c;
  }

  /* ---------- Nave nodriza (jefe) ---------- */
  function jefe() {
    const w = 512, h = 300, c = lienzo(w, h), g = c.getContext('2d');
    const cx = w / 2, cy = 172;

    g.save();
    g.translate(cx, cy);
    g.scale(1, 0.5);
    brillo(g, 0, 0, 250, 'rgba(199,125,255,0.35)');
    g.restore();

    // Domo superior
    let gr = g.createLinearGradient(0, cy - 120, 0, cy);
    gr.addColorStop(0, '#7a3cc2');
    gr.addColorStop(1, '#1e0b36');
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(cx, cy - 20, 150, 100, 0, Math.PI, 0);
    g.fill();

    // Paneles del domo
    g.strokeStyle = 'rgba(201,179,255,0.35)';
    g.lineWidth = 2;
    for (let i = 1; i < 6; i++) {
      g.beginPath();
      g.ellipse(cx, cy - 20, 150 * (i / 6), 100, 0, Math.PI, 0);
      g.stroke();
    }

    // Disco principal
    gr = g.createLinearGradient(0, cy - 50, 0, cy + 55);
    gr.addColorStop(0, '#d6c4ff');
    gr.addColorStop(0.45, '#6b44a8');
    gr.addColorStop(0.6, '#341a5c');
    gr.addColorStop(1, '#10051c');
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(cx, cy, 248, 54, 0, 0, TAU);
    g.fill();

    // Púas
    g.fillStyle = '#2a1347';
    [-1, 1].forEach((lado) => {
      g.beginPath();
      g.moveTo(cx + lado * 230, cy - 8);
      g.lineTo(cx + lado * 256, cy - 40);
      g.lineTo(cx + lado * 214, cy - 20);
      g.closePath();
      g.fill();
    });

    // Ojo central rojo
    brillo(g, cx, cy - 48, 70, 'rgba(255,51,85,0.75)');
    g.fillStyle = '#2b0010';
    g.beginPath(); g.arc(cx, cy - 48, 30, 0, TAU); g.fill();
    gr = g.createRadialGradient(cx, cy - 48, 2, cx, cy - 48, 24);
    gr.addColorStop(0, '#ffffff');
    gr.addColorStop(0.3, '#ff6b81');
    gr.addColorStop(1, '#a3001c');
    g.fillStyle = gr;
    g.beginPath(); g.arc(cx, cy - 48, 24, 0, TAU); g.fill();

    // Luces rojas
    for (let i = 0; i < 11; i++) {
      const a = Math.PI * (0.08 + (0.84 * i) / 10);
      const x = cx + Math.cos(a) * 205, y = cy + 6 + Math.sin(a) * 30;
      brillo(g, x, y, 14, 'rgba(255,51,85,0.8)');
      g.fillStyle = '#ffd0d8';
      g.beginPath(); g.arc(x, y, 4, 0, TAU); g.fill();
    }
    return c;
  }

  /* ---------- Orbe de plasma (disparo enemigo) ---------- */
  function orbe() {
    const s = 128, c = lienzo(s, s), g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, '#ffffff');
    gr.addColorStop(0.22, '#ffb3f8');
    gr.addColorStop(0.5, 'rgba(255,61,242,0.65)');
    gr.addColorStop(1, 'rgba(255,61,242,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
    return c;
  }

  /* ---------- Meteoro (solo se esquiva) ---------- */
  function meteoro(variante) {
    const s = 192, c = lienzo(s, s), g = c.getContext('2d'), m = s / 2;
    brillo(g, m, m, 94, 'rgba(255,120,30,0.55)');

    let semilla = 17 + variante * 101;
    const azar = () => ((semilla = (semilla * 9301 + 49297) % 233280) / 233280);

    const pts = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU, r = 50 + (azar() - 0.5) * 22;
      pts.push([m + Math.cos(a) * r, m + Math.sin(a) * r]);
    }
    const gr = g.createRadialGradient(m - 18, m - 18, 6, m, m, 62);
    gr.addColorStop(0, '#c99a72');
    gr.addColorStop(0.5, '#73503a');
    gr.addColorStop(1, '#2c1c14');
    g.fillStyle = gr;
    g.beginPath();
    pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(255,170,80,0.8)';
    g.lineWidth = 3;
    g.stroke();

    g.fillStyle = 'rgba(30,18,12,0.55)';
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.ellipse(m + (azar() - 0.5) * 60, m + (azar() - 0.5) * 60, 5 + azar() * 9, 4 + azar() * 7, azar() * 3, 0, TAU);
      g.fill();
    }
    return c;
  }

  /* ---------- Brillos suaves (para la versión 3D) ---------- */
  function brilloSuave(rgb) {
    const s = 128, c = lienzo(s, s), g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(' + rgb + ',0.9)');
    gr.addColorStop(0.4, 'rgba(' + rgb + ',0.35)');
    gr.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
    return c;
  }

  const SP = (GS.Sprites = {});

  SP.crear = function () {
    SP.brilloVerde = brilloSuave('120,255,170');
    SP.brilloFuego = brilloSuave('255,130,40');
    SP.ovni = [ovni(0), ovni(1)];
    SP.ovniBlanco = blanco(SP.ovni[0]);
    SP.dron = [dron(0), dron(1)];
    SP.dronBlanco = blanco(SP.dron[0]);
    SP.jefe = jefe();
    SP.jefeBlanco = blanco(SP.jefe);
    SP.orbe = orbe();
    SP.meteoro = [meteoro(0), meteoro(1), meteoro(2)];
  };
})(window.GS);
