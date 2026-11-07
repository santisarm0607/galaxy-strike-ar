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

    // Calidad automática: si el juego va lento (menos de ~40 FPS) durante
    // unos segundos de partida, baja la resolución y los efectos.
    const fps = { cuadros: 0, tiempo: 0, lentos: 0 };
    function medirFPS(dt) {
      const Aj = GS.Ajustes;
      if (Aj.get('calidad') !== 'auto' || Aj._autoBaja || GS.Juego.estado !== 'jugando' || document.hidden) { fps.cuadros = fps.tiempo = 0; return; }
      fps.cuadros++;
      fps.tiempo += dt;
      if (fps.tiempo < 2) return;
      const promedio = fps.cuadros / fps.tiempo;
      fps.cuadros = fps.tiempo = 0;
      fps.lentos = promedio < 40 ? fps.lentos + 1 : 0;
      if (fps.lentos >= 2) {
        Aj._autoBaja = true;
        GS.Juego.redimensionar();
        if (GS.UI.toast) GS.UI.toast('🔋 Bajamos la calidad gráfica para que vaya más fluido.', 2600);
      }
    }

    let ultimo = performance.now();
    function bucle(ahora) {
      const real = Math.max(0, (ahora - ultimo) / 1000);
      const dt = Math.min(0.05, real);
      ultimo = ahora;
      try {
        medirFPS(real);
        GS.Juego.actualizar(dt);
        GS.Juego.dibujar();
        GS.UI.tick(dt);
      } catch (e) {
        console.error(e);
      }
      requestAnimationFrame(bucle);
    }
    requestAnimationFrame(bucle);

    // El juego es solo web: si quedó guardado un service worker de una versión
    // anterior (por ejemplo, de probar con Live Server), se borra.
    if ('serviceWorker' in navigator && navigator.serviceWorker.getRegistrations) {
      navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();
})(window.GS);
