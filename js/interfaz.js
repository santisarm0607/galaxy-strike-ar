/* =========================================================
   GALAXY STRIKE AR — interfaz.js
   Arranque de la interfaz. El resto está dividido en js/ui/:
   - base.js     utilidades, pantallas, pantalla completa y permisos
   - partida.js  HUD, eventos del juego, fin de partida y controles
   - sala.js     multijugador en línea y reacciones
   - menus.js    botones, sectores, reto del día, perfil y ajustes
   - camara.js   control con cámara de Esquiva marcianos
   Comparten funciones en GS.UI.k y el estado en GS.UI.k.st.
   ========================================================= */
'use strict';

(function (GS) {
  const U = GS.U, J = GS.Juego, S = GS.Sensores, A = GS.Sonido, R = GS.Red;
  const $ = (id) => document.getElementById(id);
  const UI = (GS.UI = GS.UI || {});
  const K = (UI.k = UI.k || {});
  const st = (K.st = K.st || {});
  const { actualizarBotonesPantalla, elegirTipo, enlazarBotones, enlazarControles, esPC, leer, limpiarNombre, migrarRecords, mostrarRecord, mqVertical, prepararCuerpo, renderVidas, revisarOrientacion, toast } = K; // de los módulos que cargan antes

  /* ---------------- Inicio ---------------- */
  UI.iniciar = function () {
    document.addEventListener('fullscreenchange', () => actualizarBotonesPantalla());
    document.addEventListener('webkitfullscreenchange', () => actualizarBotonesPantalla());
    if (mqVertical) {
      if (mqVertical.addEventListener) mqVertical.addEventListener('change', () => revisarOrientacion());
      else if (mqVertical.addListener) mqVertical.addListener(() => revisarOrientacion());
    }
    window.addEventListener('orientationchange', () => setTimeout(() => revisarOrientacion(), 300));
    $('inpNombre').value = limpiarNombre(leer('gs_nombre', 'Piloto' + ((Math.random() * 90 + 10) | 0)));
    prepararCuerpo();
    elegirTipo(leer('gs_tipo', esPC() ? 'esquiva' : 'ar'));
    S.modo = esPC() ? 'mouse' : 'tactil';
    document.body.dataset.modo = S.modo;
    if (GS.MODO_PRUEBA) document.body.classList.add('modo-prueba');
    migrarRecords();
    enlazarControles();
    enlazarBotones();
    renderVidas();
    mostrarRecord();
    // La música se pausa si cambias de app o de pestaña
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) GS.Musica.parar();
      else if (st.pantalla !== 'pPausa') GS.Musica.tocar();
    });
    // Enlace compartido con código de sala: ...index.html#ABCD
    const m = /^#([A-Za-z0-9]{4})$/.exec(location.hash || '');
    if (m) {
      $('inpCodigo').value = m[1].toUpperCase();
      toast('Código de sala ' + m[1].toUpperCase() + ' listo: toca «Multijugador en línea».', 4500);
    }
  };
})(window.GS);
