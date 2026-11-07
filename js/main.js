/* =========================================================
   GALAXY STRIKE AR — main.js
   Arranque y bucle principal del juego.
   ========================================================= */
'use strict';

(function (GS) {
  function arrancar() {
    GS.Sprites.crear();
    GS.Juego.iniciarLienzo(
      document.getElementById('lienzo'),
      document.getElementById('fondo'),
      document.getElementById('capa3d')
    );
    GS.UI.iniciar();
    GS.Red.preparar(); // carga el multijugador en segundo plano

    window.addEventListener('resize', () => GS.Juego.redimensionar());

    let ultimo = performance.now();
    function bucle(ahora) {
      const dt = Math.min(0.05, Math.max(0, (ahora - ultimo) / 1000));
      ultimo = ahora;
      try {
        GS.Juego.actualizar(dt);
        GS.Juego.dibujar();
        GS.UI.tick();
      } catch (e) {
        console.error(e);
      }
      requestAnimationFrame(bucle);
    }
    requestAnimationFrame(bucle);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();
})(window.GS);
