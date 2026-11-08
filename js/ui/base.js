/* =========================================================
   GALAXY STRIKE AR — ui/base.js
   Base de la interfaz: utilidades, pantallas, avisos, pantalla completa,
   orientación, permisos de sensores y cuenta regresiva.
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

  // Estado compartido entre los módulos de la interfaz
  Object.assign(st, {
    accionPendiente: null,
    camDespues: null,
    control: 'normal',
    ivCuenta: null,
    pantalla: 'pInicio',
    sectorElegido: null,
    tipoElegido: 'ar',
    ultimoSegundo: -1,
    ultimoTextoOleada: '',
    volverDesdeAjustes: 'pInicio',
    volverDesdeIphone: 'pInicio',
    wakeLock: null
  });


  const DURACION_ONLINE = 180; // segundos por partida en línea
  const MAX_JUGADORES = 4;






  const Sala = {
    jugadores: [], estados: {}, hostId: null, enPartida: false, partida: null, tipo: 'ar', coop: false, meta: 0,
    esperando: null, timerLobby: null, timerEstado: null, reviveEn: -1
  };
  const META_COOP_POR_JUGADOR = 6000; // puntos de equipo por piloto en el modo cooperativo




  /* Tipo de juego: 'ar' (Disparos AR, para celular) o 'esquiva' (Esquiva marcianos, para PC) */
  const NOMBRE_TIPO = { ar: '🎯 Disparos AR', esquiva: '👾 Esquiva marcianos' };
  const esPC = () => !(window.matchMedia && matchMedia('(pointer: coarse)').matches);

  /* Control de Esquiva marcianos: 'normal' (mouse, teclado o dedo) o 'camara' (cuerpo y manos) */


  /* ---------------- Utilidades de interfaz ---------------- */
  function mostrar(id) {
    document.querySelectorAll('.pantalla').forEach((p) => p.classList.toggle('activa', p.id === id));
    st.pantalla = id;
    document.body.dataset.pantalla = id || '';
    // El botón ⛶ de la esquina solo se ve en los menús
    document.body.classList.toggle('sin-boton-pantalla', !id || id === 'pCuenta');
  }
  UI.mostrar = mostrar;

  let tToast = null;
  function toast(txt, ms = 2800) {
    const t = $('toast');
    t.textContent = txt;
    t.classList.add('visible');
    clearTimeout(tToast);
    tToast = setTimeout(() => t.classList.remove('visible'), ms);
  }
  UI.toast = toast;

  function aviso(txt, clase = 'info', ms = 1900) {
    const cont = $('avisos');
    while (cont.children.length >= 3) cont.removeChild(cont.firstChild);
    const d = document.createElement('div');
    d.className = 'aviso ' + clase;
    d.textContent = txt;
    d.style.animationDuration = ms + 'ms';
    cont.appendChild(d);
    setTimeout(() => d.remove(), ms);
  }

  function limpiarNombre(n) {
    return String(n == null ? '' : n).replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 14) || 'Piloto';
  }
  function numero(v, min = 0, max = 1e9) {
    v = Number(v);
    return Number.isFinite(v) ? U.clamp(Math.round(v), min, max) : 0;
  }
  function nombre() { return limpiarNombre($('inpNombre').value); }

  function leer(clave, def) { try { const v = localStorage.getItem(clave); return v == null ? def : v; } catch (e) { return def; } }
  function guardar(clave, v) { try { localStorage.setItem(clave, v); } catch (e) { /* nada */ } }

  /* ---------------- Pantalla completa y orientación ----------------
     - Android y PC: API de pantalla completa (+ bloqueo horizontal en Android).
     - iPhone: Safari no la tiene; se explica cómo esconder la barra de Safari. */
  const esTactil = () => !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
  const esIOS = () => /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const enPantallaCompleta = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  function puedePantallaCompleta() {
    const el = document.documentElement;
    const hay = typeof el.requestFullscreen === 'function' || typeof el.webkitRequestFullscreen === 'function';
    const permitido = document.fullscreenEnabled !== false || document.webkitFullscreenEnabled === true;
    return hay && permitido;
  }

  function bloquearHorizontal() {
    if (!esTactil()) return;
    try {
      const o = screen.orientation;
      if (o && typeof o.lock === 'function') { const r = o.lock('landscape'); if (r && r.catch) r.catch(() => {}); }
    } catch (e) { /* no soportado (iPhone) */ }
  }

  function entrarPantallaCompleta() {
    const el = document.documentElement;
    try {
      const r = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen();
      if (r && r.then) r.then(bloquearHorizontal, () => {});
      else setTimeout(bloquearHorizontal, 300);
    } catch (e) { /* rechazado */ }
  }

  function salirPantallaCompleta() {
    try {
      const f = document.exitFullscreen || document.webkitExitFullscreen;
      const r = f && f.call(document);
      if (r && r.catch) r.catch(() => {});
    } catch (e) { /* nada */ }
  }


  /** Botón ⛶: agranda o achica la pantalla. */
  function alternarPantallaCompleta() {
    if (enPantallaCompleta()) { salirPantallaCompleta(); return; }
    if (puedePantallaCompleta()) { entrarPantallaCompleta(); return; }
    if (esIOS()) {
      st.volverDesdeIphone = st.pantalla || 'pInicio';
      mostrar('pIphone');
      return;
    }
    toast(esTactil() ? 'Este navegador no permite pantalla completa aquí.' : 'Este navegador no permite pantalla completa aquí. Prueba con la tecla F11.', 3500);
  }

  /** Al empezar a jugar en un celular, agranda la pantalla sola (si se puede). */
  function pedirPantallaCompleta() {
    if (!esTactil() || enPantallaCompleta() || !puedePantallaCompleta()) return;
    entrarPantallaCompleta();
  }

  function actualizarBotonesPantalla() {
    const activa = enPantallaCompleta();
    $('btnPantalla').classList.toggle('activa', activa);
    $('btnPantalla').title = activa ? 'Salir de pantalla completa' : 'Pantalla completa';
    $('btnPantallaPausa').textContent = activa ? '⛶ Salir de pantalla completa' : '⛶ Pantalla completa';
  }

  /* El juego es horizontal: en un celular vertical sale el aviso de girar. */
  const mqVertical = window.matchMedia ? matchMedia('(pointer: coarse) and (orientation: portrait)') : null;
  const bloqueadoVertical = () => !!(mqVertical && mqVertical.matches && !document.body.classList.contains('permitir-vertical'));
  let alQuedarHorizontal = null;
  function cuandoHorizontal(fn) {
    if (!bloqueadoVertical()) { fn(); return; }
    alQuedarHorizontal = fn;
  }
  function revisarOrientacion() {
    if (bloqueadoVertical()) {
      if (J.estado === 'jugando' && J.modo === 'solo') K.pausar();
      return;
    }
    if (alQuedarHorizontal) { const fn = alQuedarHorizontal; alQuedarHorizontal = null; setTimeout(fn, 250); }
  }

  async function pedirWakeLock() {
    try { if ('wakeLock' in navigator && !st.wakeLock) st.wakeLock = await navigator.wakeLock.request('screen'); }
    catch (e) { st.wakeLock = null; }
  }
  function soltarWakeLock() {
    try { if (st.wakeLock) st.wakeLock.release(); } catch (e) { /* nada */ }
    st.wakeLock = null;
  }

  /* ---------------- Permisos ---------------- */
  function conSensores(accion) {
    if (S.preparado) return accion();
    st.accionPendiente = accion;
    mostrar('pPermisos');
  }

  async function activarSensores() {
    // Primero el giroscopio: iOS solo lo permite pedir justo en el toque.
    const promesa = S.preparar($('camara'));
    A.iniciar();
    pedirPantallaCompleta();
    const btn = $('btnPermitir');
    btn.disabled = true;
    btn.textContent = 'Activando…';
    const r = await promesa;
    btn.disabled = false;
    btn.textContent = 'Activar y continuar';
    document.body.classList.toggle('con-camara', S.camaraActiva);
    document.body.dataset.modo = S.modo;
    if (r.modo === 'giro' && !r.camara) toast('Sin cámara: verás un fondo espacial, pero apuntas moviendo el celular.', 4200);
    else if (r.modo === 'tactil') toast('No se pudo usar el giroscopio: arrastra el dedo para apuntar.', 4200);
    else if (r.modo === 'mouse') toast('Modo PC: mueve el mouse para apuntar, clic para disparar y A / D para esquivar.', 4800);
    const acc = st.accionPendiente;
    st.accionPendiente = null;
    if (acc) acc();
  }

  /* ---------------- Cuenta regresiva ---------------- */

  function cuentaRegresiva(alTerminar, pista) {
    clearInterval(st.ivCuenta);
    J.estado = 'cuenta';
    // Si el celular está vertical, esperamos a que lo gire antes de contar
    if (bloqueadoVertical()) {
      $('hud').classList.add('oculto');
      mostrar('pCuenta');
      $('txtCuenta').textContent = '';
      cuandoHorizontal(() => cuentaRegresiva(alTerminar, pista));
      return;
    }
    $('hud').classList.add('oculto');
    mostrar('pCuenta');
    const el = $('txtCuenta');
    $('txtCuentaPista').textContent = pista || (J.tipoJuego === 'esquiva' ? '¡Prepárate para esquivar!' : 'Apunta el celular al frente');
    if (GS.Esquiva.camara) $('txtCuentaPista').textContent = (pista ? pista + ' · ' : '') + '🧍 Quédate en el centro';
    let n = 3;
    const pintar = (txt) => {
      el.textContent = txt;
      el.classList.remove('pulso');
      void el.offsetWidth; // reinicia la animación
      el.classList.add('pulso');
    };
    pintar(n);
    A.cuenta(false);
    st.ivCuenta = setInterval(() => {
      n--;
      if (n > 0) { pintar(n); A.cuenta(false); }
      else if (n === 0) { pintar('¡YA!'); A.cuenta(true); S.recentrar(); if (GS.Esquiva.camara) GS.Cuerpo.calibrar(); }
      else {
        clearInterval(st.ivCuenta);
        mostrar(null);
        $('hud').classList.remove('oculto');
        pedirWakeLock();
        alTerminar();
      }
    }, 750);
  }


  Object.assign(K, { DURACION_ONLINE, MAX_JUGADORES, META_COOP_POR_JUGADOR, NOMBRE_TIPO, Sala, activarSensores, actualizarBotonesPantalla, alternarPantallaCompleta, aviso, conSensores, cuentaRegresiva, esPC, guardar, leer, limpiarNombre, mostrar, mqVertical, nombre, numero, pedirPantallaCompleta, pedirWakeLock, revisarOrientacion, soltarWakeLock, toast });
})(window.GS);
