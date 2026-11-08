/* =========================================================
   GALAXY STRIKE AR — ui/camara.js
   Control con cámara (Esquiva marcianos): elegir el control,
   pantalla de preparación con la silueta guía y modo de juego.
   Los módulos de la interfaz comparten GS.UI.k (funciones) y
   GS.UI.k.st (estado). Ver js/interfaz.js.
   ========================================================= */
'use strict';

(function (GS) {
  const U = GS.U, J = GS.Juego, S = GS.Sensores, A = GS.Sonido, R = GS.Red;
  const $ = (id) => document.getElementById(id);
  const UI = (GS.UI = GS.UI || {});
  const K = (UI.k = UI.k || {});
  const st = (K.st = K.st || {});
  const { guardar, leer, mostrar, toast } = K; // de los módulos que cargan antes

  /* ---------------- Control con cámara (Esquiva marcianos) ---------------- */
  function pintarControl() {
    $('ctrlNormal').classList.toggle('activo', st.control === 'normal');
    $('ctrlCamara').classList.toggle('activo', st.control === 'camara');
    $('txtModoPista').textContent = st.tipoElegido === 'esquiva'
      ? st.control === 'camara'
        ? GS.Cuerpo.modo === 'manos'
          ? 'Con cámara, sentado: tu mano mueve la nave y, en forma de pistola, dispara al frente.'
          : 'Con cámara: tu cuerpo mueve la nave y con la mano en pistola le disparas a los marcianos.'
        : 'Ideal para PC: mueve tu nave con el mouse y esquiva a los marcianos.'
      : 'Para celular: apunta moviéndolo y dispara a los aliens en tu cuarto.';
  }

  function elegirControl(c) {
    st.control = c === 'camara' ? 'camara' : 'normal';
    guardar('gs_control', st.control);
    if (st.control === 'normal') {
      if (GS.Cuerpo.estado === 'listo') GS.Cuerpo.detener();
      GS.Esquiva.usarCamara(false);
      document.body.classList.remove('con-cuerpo');
    }
    pintarControl();
  }

  /** ¿Esta partida se juega con la cámara? */
  function camaraEnUso() {
    return J.tipoJuego === 'esquiva' && st.control === 'camara' && GS.Cuerpo.estado === 'listo';
  }

  /** Antes de jugar Esquiva con cámara: permiso, carga del detector y comprobar que te ve. */
  let ivCam = null;
  function conCamara(fn) {
    const CU = GS.Cuerpo;
    if (st.tipoElegido !== 'esquiva' || st.control !== 'camara' || CU.estado === 'listo') { fn(); return; }
    st.camDespues = fn;
    $('huecoCam').appendChild($('camCuerpo'));
    document.body.classList.add('cam-grande');
    CU.guia = true;
    pintarModoCam();
    $('btnCamListo').disabled = true;
    $('btnCamListo').textContent = 'Esperando…';
    $('txtCamEstado').textContent = '📷 Pidiendo permiso para la cámara…';
    mostrar('pCamara');
    CU.iniciar($('videoCuerpo')).then((ok) => {
      if (st.pantalla !== 'pCamara') return;
      if (!ok) {
        $('txtCamEstado').textContent = '⚠️ ' + CU.error + ' Puedes reintentar o jugar con el control normal.';
        $('btnCamListo').textContent = '🔄 Reintentar';
        $('btnCamListo').disabled = false;
        return;
      }
      CU.reanudarVideo();
      clearInterval(ivCam);
      ivCam = setInterval(() => {
        if (st.pantalla !== 'pCamara') { clearInterval(ivCam); return; }
        const c = CU.consejo();
        $('txtCamEstado').textContent = c.texto;
        $('btnCamListo').disabled = !c.ok;
        $('btnCamListo').textContent = c.ok ? '¡Listo, a jugar!' : 'Esperando…';
      }, 250);
    });
  }

  /** Botones «De pie / Sentado» y la lista de instrucciones de la pantalla de cámara. */
  function pintarModoCam() {
    const manos = GS.Cuerpo.modo === 'manos';
    $('camModoCuerpo').classList.toggle('activo', !manos);
    $('camModoManos').classList.toggle('activo', manos);
    const items = manos
      ? [['✋', 'Mueve la mano', ': la nave la sigue (como un mouse en el aire).'],
         ['🔫', 'Mano en pistola', ' y baja el pulgar: disparas al frente de la nave.'],
         ['🖐️', 'Abre la mano', ': impulso.'],
         ['💡', 'Siéntate a unos 50 cm', ', con luz de frente. Con la otra mano también puedes apuntar.']]
      : [['🧍', 'Muévete', ' de lado o agáchate: la nave te sigue.'],
         ['🔫', 'Mano en pistola', ' (índice estirado): apuntas. Baja el pulgar: disparas.'],
         ['✋', 'Mano abierta', ': impulso.'],
         ['💡', 'Aléjate 1–2 metros', ', con luz de frente, y ponte dentro de la silueta.']];
    const ul = $('listaCam');
    ul.innerHTML = '';
    items.forEach(([ico, b, txt]) => { const li = document.createElement('li'); const bb = document.createElement('b'); bb.textContent = b; li.append(ico + ' ', bb, txt); ul.appendChild(li); });
    pintarControl();
  }

  function cerrarCamara(seguir) {
    clearInterval(ivCam);
    GS.Cuerpo.guia = false;
    $('lienzo').after($('camCuerpo')); // la mini ventana vuelve a su esquina
    document.body.classList.remove('cam-grande');
    GS.Cuerpo.reanudarVideo();
    const fn = st.camDespues;
    st.camDespues = null;
    if (seguir && fn) fn();
  }

  function prepararCuerpo() {
    const CU = GS.Cuerpo, E = GS.Esquiva;
    // Solo detecta cuando hace falta (ahorra batería)
    CU.necesario = () => st.pantalla === 'pCamara' || (E.camara && (J.estado === 'jugando' || J.estado === 'cuenta'));
    CU.alImpulso = () => { if (E.camara && J.estado === 'jugando') E.impulso(); };
    CU.alProgreso = (txt) => { if (st.pantalla === 'pCamara') $('txtCamEstado').textContent = txt; };
    CU.alLento = () => {
      toast('🐢 Este equipo va lento con la cámara: vuelvo al control normal.', 4500);
      elegirControl('normal');
    };
    st.control = leer('gs_control', 'normal') === 'camara' ? 'camara' : 'normal';
  }


  Object.assign(K, { camaraEnUso, cerrarCamara, conCamara, elegirControl, pintarControl, pintarModoCam, prepararCuerpo });
})(window.GS);
