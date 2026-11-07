/* =========================================================
   GALAXY STRIKE AR — interfaz.js
   Pantallas, botones, HUD y el flujo del multijugador.
   ========================================================= */
'use strict';

(function (GS) {
  const U = GS.U, J = GS.Juego, S = GS.Sensores, A = GS.Sonido, R = GS.Red;
  const $ = (id) => document.getElementById(id);
  const UI = (GS.UI = {});

  const DURACION_ONLINE = 180; // segundos por partida en línea
  const MAX_JUGADORES = 4;

  let pantalla = 'pInicio';
  let accionPendiente = null;
  let wakeLock = null;
  let ultimoSegundo = -1;

  const Sala = {
    jugadores: [], estados: {}, hostId: null, enPartida: false, partida: null, tipo: 'ar',
    esperando: null, timerLobby: null, timerEstado: null
  };

  /* Tipo de juego: 'ar' (Disparos AR, para celular) o 'esquiva' (Esquiva marcianos, para PC) */
  const NOMBRE_TIPO = { ar: '🎯 Disparos AR', esquiva: '👾 Esquiva marcianos' };
  const esPC = () => !(window.matchMedia && matchMedia('(pointer: coarse)').matches);
  let tipoElegido = 'ar';
  const claveRecord = (tipo) => (tipo === 'esquiva' ? 'gs_record_esquiva' : 'gs_record');

  /* ---------------- Utilidades de interfaz ---------------- */
  function mostrar(id) {
    document.querySelectorAll('.pantalla').forEach((p) => p.classList.toggle('activa', p.id === id));
    pantalla = id;
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
     - iPhone: Safari no la tiene; la mejor opción es instalarlo como app
       (Compartir → Agregar a pantalla de inicio). */
  const esTactil = () => !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
  const esIOS = () => /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const esAppInstalada = () => navigator.standalone === true ||
    (window.matchMedia && (matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches));
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

  let volverDesdeIphone = 'pInicio';
  /** Botón ⛶: agranda o achica la pantalla. */
  function alternarPantallaCompleta() {
    if (enPantallaCompleta()) { salirPantallaCompleta(); return; }
    if (puedePantallaCompleta()) { entrarPantallaCompleta(); return; }
    if (esIOS() && GS.MODO_PRUEBA) {
      toast('En iPhone, la pantalla completa se logra instalando el juego publicado como app (el botón ⛶ te explica cómo allá).', 4500);
      return;
    }
    if (esIOS() && !esAppInstalada()) {
      volverDesdeIphone = pantalla || 'pInicio';
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
      if (J.estado === 'jugando' && J.modo === 'solo') pausar();
      return;
    }
    if (alQuedarHorizontal) { const fn = alQuedarHorizontal; alQuedarHorizontal = null; setTimeout(fn, 250); }
  }

  async function pedirWakeLock() {
    try { if ('wakeLock' in navigator && !wakeLock) wakeLock = await navigator.wakeLock.request('screen'); }
    catch (e) { wakeLock = null; }
  }
  function soltarWakeLock() {
    try { if (wakeLock) wakeLock.release(); } catch (e) { /* nada */ }
    wakeLock = null;
  }

  /* ---------------- Permisos ---------------- */
  function conSensores(accion) {
    if (S.preparado) return accion();
    accionPendiente = accion;
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
    const acc = accionPendiente;
    accionPendiente = null;
    if (acc) acc();
  }

  /* ---------------- Cuenta regresiva ---------------- */
  let ivCuenta = null;
  function cuentaRegresiva(alTerminar) {
    clearInterval(ivCuenta);
    J.estado = 'cuenta';
    // Si el celular está vertical, esperamos a que lo gire antes de contar
    if (bloqueadoVertical()) {
      $('hud').classList.add('oculto');
      mostrar('pCuenta');
      $('txtCuenta').textContent = '';
      cuandoHorizontal(() => cuentaRegresiva(alTerminar));
      return;
    }
    $('hud').classList.add('oculto');
    mostrar('pCuenta');
    const el = $('txtCuenta');
    $('txtCuentaPista').textContent = J.tipoJuego === 'esquiva' ? '¡Prepárate para esquivar!' : 'Apunta el celular al frente';
    let n = 3;
    const pintar = (txt) => {
      el.textContent = txt;
      el.classList.remove('pulso');
      void el.offsetWidth; // reinicia la animación
      el.classList.add('pulso');
    };
    pintar(n);
    A.cuenta(false);
    ivCuenta = setInterval(() => {
      n--;
      if (n > 0) { pintar(n); A.cuenta(false); }
      else if (n === 0) { pintar('¡YA!'); A.cuenta(true); S.recentrar(); }
      else {
        clearInterval(ivCuenta);
        mostrar(null);
        $('hud').classList.remove('oculto');
        pedirWakeLock();
        alTerminar();
      }
    }, 750);
  }

  /* ---------------- HUD ---------------- */
  function prepararHUD(modo) {
    document.body.dataset.partida = modo;
    document.body.dataset.juego = J.tipoJuego;
    $('btnDisparo').textContent = J.tipoJuego === 'esquiva' ? 'IMPULSO' : 'FUEGO';
    $('pistaTeclas').textContent = J.tipoJuego === 'esquiva'
      ? 'Mouse o WASD / flechas: mover la nave · Clic o Espacio: impulso · Esc: pausa'
      : 'Mouse: apuntar · Clic / Espacio: disparar · A / D: esquivar · R: centrar';
    renderVidas();
    $('capaEliminado').classList.add('oculto');
    $('avisos').innerHTML = '';
    $('hudTiempo').textContent = modo === 'online' ? formatoTiempo(DURACION_ONLINE) : '';
    $('hudOleada').textContent = 'PREPÁRATE';
    ultimoSegundo = -1;
    renderMarcador();
  }

  function formatoTiempo(s) {
    s = Math.ceil(s);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function renderVidas() {
    const cont = $('hudVidas');
    cont.innerHTML = '';
    for (let i = 0; i < (J.vidasMax || J.CONFIG.vidasMax); i++) {
      const s = document.createElement('span');
      s.textContent = '❤';
      if (i >= J.vidas) s.className = 'vacia';
      cont.appendChild(s);
    }
    cont.classList.remove('golpe');
    void cont.offsetWidth;
    cont.classList.add('golpe');
  }

  UI.tick = function () {
    if (J.estado !== 'jugando') return;
    if (J.modo === 'online') {
      const s = Math.ceil(J.tiempo);
      if (s !== ultimoSegundo) {
        ultimoSegundo = s;
        $('hudTiempo').textContent = formatoTiempo(J.tiempo);
        $('hudTiempo').classList.toggle('urgente', J.tiempo <= 15);
      }
      $('barraCarga').style.width = Math.round((J.carga / J.CONFIG.killsParaAtaque) * 100) + '%';
    }
  };

  /* ---------------- Eventos del juego ---------------- */
  J.on('puntos', () => { $('hudPuntos').textContent = J.puntos.toLocaleString('es-CO'); });
  J.on('vidas', renderVidas);
  J.on('combo', () => {
    const m = J.multiplicador();
    $('hudCombo').textContent = J.combo >= 2 ? 'COMBO ' + J.combo + (m > 1 ? ' · x' + m : '') : '';
  });
  J.on('oleada', (n, jefe) => {
    const etq = J.tipoJuego === 'esquiva' ? 'NIVEL ' : 'OLEADA ';
    $('hudOleada').textContent = etq + n;
    aviso(jefe ? '⚠️ ¡NAVE NODRIZA!' : etq + n, jefe ? 'peligro' : 'info');
  });
  J.on('oleadaSuperada', (n) => aviso('¡OLEADA ' + n + ' SUPERADA!', 'exito'));
  J.on('aviso', (txt, clase) => aviso(txt, clase, 2200));
  J.on('muerte', () => {
    if (J.modo === 'online') {
      $('capaEliminado').classList.remove('oculto');
      enviarEstado();
      revisarTodosEliminados();
    }
  });
  J.on('ataque', (n) => {
    if (!R.conectado) return;
    R.enviar({ t: 'ataque', nombre: nombre(), n });
    aviso('🚀 ¡Lluvia de meteoros enviada a tus rivales!', 'exito');
  });
  J.on('fin', mostrarFin);

  /* ---------------- Fin de partida ---------------- */
  function fila(etq, valor, destacado) {
    const d = document.createElement('div');
    d.className = 'stat' + (destacado ? ' destacado' : '');
    const a = document.createElement('span');
    a.textContent = etq;
    const b = document.createElement('b');
    b.textContent = valor;
    d.append(a, b);
    return d;
  }

  function mostrarFin() {
    $('hud').classList.add('oculto');
    $('capaEliminado').classList.add('oculto');
    soltarWakeLock();
    A.finJuego();
    const cont = $('finContenido');
    cont.innerHTML = '';
    if (J.modo === 'solo') {
      const clave = claveRecord(J.tipoJuego);
      const record = numero(leer(clave, '0'));
      const nuevo = J.puntos > record;
      if (nuevo) guardar(clave, String(J.puntos));
      mostrarRecord();
      $('txtFinTitulo').textContent = nuevo ? '¡NUEVO RÉCORD!' : 'FIN DEL JUEGO';
      if (J.tipoJuego === 'esquiva') {
        const st = GS.Esquiva.estadisticas();
        cont.append(
          fila('Puntos', J.puntos.toLocaleString('es-CO'), true),
          fila('Nivel alcanzado', String(st.nivel)),
          fila('Tiempo vivo', formatoTiempo(st.tiempo)),
          fila('¡Por poco!', String(st.porPoco)),
          fila('Cristales', String(st.cristales)),
          fila('Récord', Math.max(record, J.puntos).toLocaleString('es-CO'))
        );
      } else {
        const precision = J.disparos ? Math.round((J.aciertos / J.disparos) * 100) : 0;
        cont.append(
          fila('Puntos', J.puntos.toLocaleString('es-CO'), true),
          fila('Oleada alcanzada', String(J.oleada)),
          fila('Aliens destruidos', String(J.kills)),
          fila('Esquivados', String(J.esquivados)),
          fila('Precisión', precision + '%'),
          fila('Récord', Math.max(record, J.puntos).toLocaleString('es-CO'))
        );
      }
      $('btnOtraVez').textContent = 'Jugar otra vez';
    } else {
      clearInterval(Sala.timerEstado);
      enviarEstado(true);
      setTimeout(() => enviarEstado(true), 1000);
      setTimeout(() => enviarEstado(true), 2500);
      $('txtFinTitulo').textContent = 'RESULTADOS';
      renderRanking();
      $('btnOtraVez').textContent = R.conectado ? 'Volver a la sala' : 'Multijugador';
    }
    mostrar('pFin');
  }

  function ordenarEstados() {
    return Object.keys(Sala.estados)
      .map((id) => Object.assign({ id }, Sala.estados[id]))
      .sort((a, b) => b.puntos - a.puntos);
  }

  function renderRanking() {
    const cont = $('finContenido');
    cont.innerHTML = '';
    const lista = ordenarEstados();
    const medallas = ['🥇', '🥈', '🥉', '4°'];
    if (lista.length) {
      const yoPrimero = lista[0].id === R.miId;
      const t = document.createElement('p');
      t.className = 'ganador';
      t.textContent = yoPrimero ? '¡GANASTE LA PARTIDA!' : 'Ganó ' + lista[0].nombre;
      cont.appendChild(t);
    }
    lista.forEach((j, i) => {
      const d = document.createElement('div');
      d.className = 'fila-ranking' + (j.id === R.miId ? ' yo' : '');
      const a = document.createElement('span');
      a.textContent = (medallas[i] || i + 1 + '°') + '  ' + j.nombre + (j.id === R.miId ? ' (tú)' : '');
      const b = document.createElement('b');
      b.textContent = j.puntos.toLocaleString('es-CO');
      d.append(a, b);
      cont.appendChild(d);
    });
    const nota = document.createElement('p');
    nota.className = 'nota';
    nota.textContent = lista.some((j) => !j.fin) ? 'Esperando los puntajes finales…' : '';
    cont.appendChild(nota);
  }

  /* ---------------- Marcador en vivo (multijugador) ---------------- */
  function renderMarcador() {
    const cont = $('marcador');
    cont.innerHTML = '';
    if (J.modo !== 'online' && document.body.dataset.partida !== 'online') return;
    ordenarEstados().forEach((j, i) => {
      const d = document.createElement('div');
      d.className = 'fila-marcador' + (j.id === R.miId ? ' yo' : '') + (j.vivo ? '' : ' fuera');
      const a = document.createElement('span');
      a.textContent = i + 1 + '. ' + j.nombre + (j.salio ? ' (salió)' : '');
      const b = document.createElement('b');
      b.textContent = (j.vivo || j.salio ? '' : '💀 ') + j.puntos.toLocaleString('es-CO');
      d.append(a, b);
      cont.appendChild(d);
    });
  }

  function enviarEstado(final) {
    const est = {
      nombre: nombre(), puntos: J.puntos | 0, vidas: J.vidas | 0, vivo: !!J.vivo,
      fin: !!final || J.estado === 'fin'
    };
    Sala.estados[R.miId] = est;
    if (R.conectado) R.enviar(Object.assign({ t: 'estado' }, est));
    renderMarcador();
  }

  function revisarTodosEliminados() {
    if (J.modo !== 'online' || J.estado !== 'jugando' || J.vivo) return;
    const todos = Object.keys(Sala.estados).every((id) => !Sala.estados[id].vivo);
    if (todos) setTimeout(() => J.terminar('todos'), 1500);
  }

  /* ---------------- Multijugador: sala ---------------- */
  function errorOnline(txt) { $('txtOnlineError').textContent = txt || ''; }

  function setCargando(si, txt) {
    ['btnCrear', 'btnUnirse'].forEach((id) => { $(id).disabled = si; });
    $('txtOnlineEstado').textContent = si ? txt : '';
  }

  async function abrirOnline() {
    errorOnline('');
    mostrar('pOnline');
    setCargando(true, 'Preparando conexión…');
    const ok = await R.preparar();
    setCargando(false);
    if (!ok) {
      errorOnline(GS.MODO_PRUEBA
        ? 'El multijugador no está disponible en esta vista de prueba. En el juego publicado funciona con PeerJS.'
        : 'No se pudo cargar el módulo multijugador (PeerJS). Revisa tu conexión a internet y recarga.');
      ['btnCrear', 'btnUnirse'].forEach((id) => { $(id).disabled = true; });
    }
  }

  function difundirLobby() {
    if (!R.esHost) return;
    R.enviar({ t: 'lobby', tipo: Sala.tipo, jugadores: Sala.jugadores.map((j) => ({ id: j.id, nombre: j.nombre, host: j.host })), enPartida: Sala.enPartida });
  }

  function entrarSala() {
    $('txtCodigo').textContent = R.codigo;
    renderSala();
    mostrar('pSala');
  }

  function renderSala() {
    const ul = $('listaJugadores');
    ul.innerHTML = '';
    Sala.jugadores.forEach((j) => {
      const li = document.createElement('li');
      li.textContent = (j.host ? '👑 ' : '🛸 ') + j.nombre + (j.id === R.miId ? ' (tú)' : '');
      ul.appendChild(li);
    });
    for (let i = Sala.jugadores.length; i < MAX_JUGADORES; i++) {
      const li = document.createElement('li');
      li.className = 'libre';
      li.textContent = 'Esperando piloto…';
      ul.appendChild(li);
    }
    $('btnEmpezar').classList.toggle('oculto', !R.esHost);
    $('txtSalaEstado').textContent = R.esHost
      ? (Sala.jugadores.length < 2 ? 'Comparte el código con tus amigos. Puedes empezar tú solo para probar.' : '¡Listos! Empieza cuando quieras.')
      : 'Esperando a que el anfitrión empiece la partida…';
    $('btnCompartir').classList.toggle('oculto', typeof navigator.share !== 'function');
    $('txtModoSala').textContent = 'Modo: ' + NOMBRE_TIPO[Sala.tipo];
    // Sala de Disparos AR en un celular que aún no activó cámara y sensores
    $('btnSensoresSala').classList.toggle('oculto', !(Sala.tipo === 'ar' && !S.preparado && !esPC()));
  }

  function esperarLobby() {
    return new Promise((res, rej) => {
      const hola = () => R.enviar({ t: 'hola', nombre: nombre() });
      hola();
      const iv = setInterval(hola, 1500);
      const to = setTimeout(() => { terminar(); rej(new Error('noexiste')); }, 9000);
      function terminar() { clearInterval(iv); clearTimeout(to); Sala.esperando = null; }
      Sala.esperando = { ok: () => { terminar(); res(); }, mal: (m) => { terminar(); rej(new Error(m)); } };
    });
  }

  async function crearSala() {
    errorOnline('');
    pedirPantallaCompleta();
    setCargando(true, 'Creando sala…');
    try {
      await R.crear();
      Object.assign(Sala, { jugadores: [{ id: R.miId, nombre: nombre(), host: true }], hostId: R.miId, enPartida: false, estados: {}, partida: null, tipo: tipoElegido });
      clearInterval(Sala.timerLobby);
      Sala.timerLobby = setInterval(() => { if (R.esHost && !Sala.enPartida) difundirLobby(); }, 3000);
      entrarSala();
    } catch (e) {
      R.salir();
      errorOnline('No se pudo crear la sala. Revisa tu internet e inténtalo de nuevo.');
      console.warn(e);
    }
    setCargando(false);
  }

  async function unirseSala() {
    errorOnline('');
    const codigo = ($('inpCodigo').value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (codigo.length !== 4) { errorOnline('El código tiene 4 caracteres.'); return; }
    pedirPantallaCompleta();
    setCargando(true, 'Conectando con la sala ' + codigo + '…');
    try {
      Object.assign(Sala, { jugadores: [], hostId: null, enPartida: false, estados: {}, partida: null });
      await R.unirse(codigo);
      await esperarLobby();
      entrarSala();
    } catch (e) {
      R.salir();
      const m = e && e.message;
      errorOnline(m === 'noexiste' ? 'No encontramos la sala ' + codigo + '. Revisa el código.' : m === 'llena' ? 'Esa sala ya está llena (máximo ' + MAX_JUGADORES + ').' : 'No se pudo conectar. Inténtalo de nuevo.');
    }
    setCargando(false);
  }

  function salirSala() {
    if (R.conectado) R.enviar({ t: 'adios' });
    R.salir();
    clearInterval(Sala.timerLobby);
    clearInterval(Sala.timerEstado);
    Object.assign(Sala, { jugadores: [], estados: {}, hostId: null, enPartida: false, partida: null });
  }

  function empezarComoHost() {
    A.iniciar();
    pedirPantallaCompleta();
    const msg = {
      t: 'inicio', tipo: Sala.tipo, semilla: (Math.random() * 1e9) >>> 0, duracion: DURACION_ONLINE, partida: U.id(8),
      jugadores: Sala.jugadores.map((j) => ({ id: j.id, nombre: j.nombre }))
    };
    // Se repite por si algún mensaje se pierde; los demás ignoran los repetidos.
    R.enviar(msg);
    setTimeout(() => R.enviar(msg), 600);
    setTimeout(() => R.enviar(msg), 1400);
    empezarOnline(msg);
  }

  function empezarOnline(msg) {
    Sala.enPartida = true;
    Sala.partida = msg.partida;
    Sala.estados = {};
    (msg.jugadores || []).slice(0, MAX_JUGADORES).forEach((j) => {
      Sala.estados[String(j.id)] = { nombre: limpiarNombre(j.nombre), puntos: 0, vidas: J.CONFIG.vidasMax, vivo: true, fin: false };
    });
    if (!Sala.estados[R.miId]) Sala.estados[R.miId] = { nombre: nombre(), puntos: 0, vidas: J.CONFIG.vidasMax, vivo: true, fin: false };
    const tipo = msg.tipo === 'esquiva' ? 'esquiva' : 'ar';
    J.modo = 'online';
    J.prepararTipo(tipo);
    prepararHUD('online');
    cuentaRegresiva(() => {
      J.iniciar({ modo: 'online', tipo, semilla: msg.semilla >>> 0, duracion: U.clamp(msg.duracion | 0, 30, 600) });
      clearInterval(Sala.timerEstado);
      Sala.timerEstado = setInterval(() => { if (J.estado === 'jugando') enviarEstado(); }, 700);
    });
  }

  function quitarJugador(id) {
    if (!id) return;
    if (id === Sala.hostId && !R.esHost) { hostPerdido(); return; }
    const antes = Sala.jugadores.length;
    const j = Sala.jugadores.find((x) => x.id === id);
    Sala.jugadores = Sala.jugadores.filter((x) => x.id !== id);
    if (Sala.estados[id]) Object.assign(Sala.estados[id], { fin: true, vivo: false, salio: true });
    if (Sala.jugadores.length !== antes) {
      if (j) toast(j.nombre + ' salió de la sala.');
      if (R.esHost) difundirLobby();
      renderSala();
      renderMarcador();
    }
  }

  function hostPerdido() {
    if (!R.conectado) return;
    R.salir();
    clearInterval(Sala.timerEstado);
    toast('El anfitrión cerró la sala.', 3500);
    if (pantalla === 'pSala') {
      mostrar('pOnline');
      errorOnline('El anfitrión cerró la sala.');
    }
  }

  function volverASala() {
    Sala.enPartida = false;
    J.estado = 'menu';
    if (!R.conectado) { abrirOnline(); return; }
    entrarSala();
    if (R.esHost) difundirLobby();
  }

  /* ---------------- Mensajes de la red ---------------- */
  R.alRecibir((msg) => {
    if (!msg || typeof msg !== 'object' || typeof msg.t !== 'string') return;
    const de = typeof msg.de === 'string' ? msg.de.slice(0, 24) : null;
    switch (msg.t) {
      case 'hola': {
        if (!R.esHost || !de) return;
        if (!Sala.jugadores.some((j) => j.id === de)) {
          if (Sala.jugadores.length >= MAX_JUGADORES) { R.enviar({ t: 'llena', para: de }); return; }
          const nuevo = { id: de, nombre: limpiarNombre(msg.nombre), host: false };
          Sala.jugadores.push(nuevo);
          toast('🛸 ' + nuevo.nombre + ' se unió a la sala');
          A.clic();
        }
        difundirLobby();
        renderSala();
        break;
      }
      case 'lobby': {
        if (R.esHost || !Array.isArray(msg.jugadores)) return;
        if (Sala.hostId && de !== Sala.hostId) return;
        Sala.hostId = de;
        Sala.tipo = msg.tipo === 'esquiva' ? 'esquiva' : 'ar';
        Sala.jugadores = msg.jugadores.slice(0, MAX_JUGADORES).map((j) => ({
          id: String(j && j.id).slice(0, 24), nombre: limpiarNombre(j && j.nombre), host: !!(j && j.host)
        }));
        if (Sala.esperando && Sala.jugadores.some((j) => j.id === R.miId)) Sala.esperando.ok();
        if (pantalla === 'pSala') renderSala();
        break;
      }
      case 'llena':
        if (msg.para === R.miId && Sala.esperando) Sala.esperando.mal('llena');
        break;
      case 'inicio': {
        if (R.esHost || de !== Sala.hostId || msg.partida === Sala.partida) return;
        if (!Array.isArray(msg.jugadores) || !msg.jugadores.some((j) => j && j.id === R.miId)) return;
        empezarOnline(msg);
        break;
      }
      case 'estado': {
        if (!de || de === R.miId) return;
        Sala.estados[de] = {
          nombre: limpiarNombre(msg.nombre), puntos: numero(msg.puntos), vidas: numero(msg.vidas, 0, 9),
          vivo: !!msg.vivo, fin: !!msg.fin
        };
        renderMarcador();
        if (pantalla === 'pFin' && J.modo === 'online') renderRanking();
        revisarTodosEliminados();
        break;
      }
      case 'ataque':
        if (de && de !== R.miId && J.modo === 'online') J.recibirAtaque(limpiarNombre(msg.nombre), U.clamp(msg.n | 0, 1, 5));
        break;
      case 'adios':
      case '_salio':
        quitarJugador(de);
        break;
      case '_hostPerdido':
        hostPerdido();
        break;
    }
  });

  /* ---------------- Controles ---------------- */
  const gat = { lienzo: false, boton: false, tecla: false };
  function actualizarGatillo() {
    J.gatillo = J.estado === 'jugando' && (gat.lienzo || gat.boton || gat.tecla);
    $('btnDisparo').classList.toggle('activo', gat.boton || gat.lienzo || gat.tecla);
  }
  let arrastre = null, punteroGatillo = null;

  function pausar() {
    if (J.estado !== 'jugando') return;
    if (J.modo === 'solo') J.estado = 'pausa';
    gat.lienzo = gat.boton = gat.tecla = false;
    actualizarGatillo();
    $('txtPausaNota').textContent = J.modo === 'online' ? 'La partida en línea sigue corriendo.' : '';
    $('btnSonido').textContent = A.activo ? '🔊 Sonido: sí' : '🔇 Sonido: no';
    mostrar('pPausa');
  }
  function reanudar() {
    mostrar(null);
    if (J.estado === 'pausa') J.estado = 'jugando';
  }
  function salirAlMenu() {
    if (J.modo === 'online') salirSala();
    clearInterval(ivCuenta);
    J.estado = 'menu';
    J.entidades = [];
    soltarWakeLock();
    $('hud').classList.add('oculto');
    document.body.dataset.partida = '';
    mostrar('pInicio');
  }

  function enlazarControles() {
    const lz = $('lienzo');
    lz.addEventListener('contextmenu', (e) => e.preventDefault());
    lz.addEventListener('pointerdown', (ev) => {
      if (J.tipoJuego === 'esquiva' && (J.estado === 'jugando' || J.estado === 'cuenta')) {
        if (ev.pointerType === 'mouse') { if (J.estado === 'jugando') GS.Esquiva.impulso(); }
        else arrastre = { id: ev.pointerId, x: ev.clientX, y: ev.clientY };
        return;
      }
      if (J.estado !== 'jugando') return;
      const z = J.zonaRadar;
      if (z && Math.hypot(ev.clientX - z.x, ev.clientY - z.y) < z.r + 8) {
        S.recentrar();
        toast('Mira centrada', 1200);
        return;
      }
      if (S.modo === 'tactil') {
        arrastre = { id: ev.pointerId, x: ev.clientX, y: ev.clientY };
        return;
      }
      gat.lienzo = true;
      punteroGatillo = ev.pointerId;
      actualizarGatillo();
    });
    window.addEventListener('pointermove', (ev) => {
      const esq = J.tipoJuego === 'esquiva';
      if (esq && ev.pointerType === 'mouse') GS.Esquiva.apuntar(ev.clientX, ev.clientY, window.innerWidth, window.innerHeight);
      else if (S.modo === 'mouse' && ev.pointerType === 'mouse') S.mouse(ev.clientX, ev.clientY, window.innerWidth, window.innerHeight);
      if (arrastre && ev.pointerId === arrastre.id) {
        if (esq) GS.Esquiva.arrastrar(ev.clientX - arrastre.x, ev.clientY - arrastre.y, window.innerWidth, window.innerHeight);
        else S.arrastrar(ev.clientX - arrastre.x, ev.clientY - arrastre.y);
        arrastre.x = ev.clientX;
        arrastre.y = ev.clientY;
      }
    });
    const soltar = (ev) => {
      if (arrastre && ev.pointerId === arrastre.id) arrastre = null;
      if (ev.pointerId === punteroGatillo) { gat.lienzo = false; punteroGatillo = null; actualizarGatillo(); }
    };
    window.addEventListener('pointerup', soltar);
    window.addEventListener('pointercancel', soltar);

    const fuego = $('btnDisparo');
    fuego.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (J.tipoJuego === 'esquiva') { GS.Esquiva.impulso(); return; }
      gat.boton = true;
      actualizarGatillo();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((n) => fuego.addEventListener(n, () => { gat.boton = false; actualizarGatillo(); }));

    [['btnIzq', 'izq'], ['btnDer', 'der']].forEach(([id, lado]) => {
      const b = $(id);
      b.addEventListener('pointerdown', (ev) => { ev.preventDefault(); S.tecla(lado, true); });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach((n) => b.addEventListener(n, () => S.tecla(lado, false)));
    });

    const TECLAS_ESQUIVA = { ArrowLeft: 'izq', KeyA: 'izq', ArrowRight: 'der', KeyD: 'der', ArrowUp: 'arriba', KeyW: 'arriba', ArrowDown: 'abajo', KeyS: 'abajo' };
    window.addEventListener('keydown', (ev) => {
      if (ev.target && ev.target.tagName === 'INPUT') return;
      const k = ev.code;
      if (J.tipoJuego === 'esquiva' && J.estado !== 'menu') {
        if (TECLAS_ESQUIVA[k]) GS.Esquiva.tecla(TECLAS_ESQUIVA[k], true);
        else if (k === 'Space') GS.Esquiva.impulso();
        else if (k === 'Escape' || k === 'KeyP') { if (pantalla === 'pPausa') reanudar(); else pausar(); }
        else return;
        ev.preventDefault();
        return;
      }
      if (k === 'ArrowLeft' || k === 'KeyA') S.tecla('izq', true);
      else if (k === 'ArrowRight' || k === 'KeyD') S.tecla('der', true);
      else if (k === 'Space') { gat.tecla = true; actualizarGatillo(); }
      else if (k === 'KeyR') S.recentrar();
      else if (k === 'Escape' || k === 'KeyP') { if (pantalla === 'pPausa') reanudar(); else pausar(); }
      else return;
      ev.preventDefault();
    });
    window.addEventListener('keyup', (ev) => {
      const k = ev.code;
      if (TECLAS_ESQUIVA[k]) GS.Esquiva.tecla(TECLAS_ESQUIVA[k], false);
      if (k === 'ArrowLeft' || k === 'KeyA') S.tecla('izq', false);
      else if (k === 'ArrowRight' || k === 'KeyD') S.tecla('der', false);
      else if (k === 'Space') { gat.tecla = false; actualizarGatillo(); }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (J.estado === 'jugando' && J.modo === 'solo') pausar(); }
      else if (J.estado === 'jugando') { wakeLock = null; pedirWakeLock(); }
    });
  }

  /* ---------------- Botones de las pantallas ---------------- */
  function enlazarBotones() {
    const clic = (id, fn) => $(id).addEventListener('click', (ev) => { A.iniciar(); A.clic(); fn(ev); });

    clic('btnSolo', () => {
      guardar('gs_nombre', nombre());
      pedirPantallaCompleta();
      if (tipoElegido === 'esquiva') empezarSolo();
      else conSensores(empezarSolo);
    });
    clic('btnOnline', () => {
      guardar('gs_nombre', nombre());
      if (tipoElegido === 'esquiva') abrirOnline();
      else conSensores(abrirOnline);
    });
    clic('modoAR', () => elegirTipo('ar'));
    clic('modoEsquiva', () => elegirTipo('esquiva'));
    clic('btnSensoresSala', async () => {
      const promesa = S.preparar($('camara'));
      const r = await promesa;
      document.body.classList.toggle('con-camara', S.camaraActiva);
      document.body.dataset.modo = S.modo;
      toast(r.giro ? 'Cámara y sensores listos.' : 'No se pudo usar el giroscopio: arrastra el dedo para apuntar.');
      renderSala();
    });
    clic('btnComo', () => mostrar('pComo'));
    clic('btnComoListo', () => mostrar('pInicio'));
    clic('btnPermitir', activarSensores);
    clic('btnVolverPerm', () => { accionPendiente = null; mostrar('pInicio'); });

    clic('btnCrear', crearSala);
    clic('btnUnirse', unirseSala);
    clic('btnVolverOnline', () => mostrar('pInicio'));
    $('inpCodigo').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4); });
    $('inpCodigo').addEventListener('keydown', (e) => { if (e.key === 'Enter') unirseSala(); });

    clic('btnEmpezar', empezarComoHost);
    clic('btnSalirSala', () => { salirSala(); mostrar('pOnline'); });
    clic('btnCopiar', () => {
      const cod = R.codigo || '';
      const ok = () => toast('Código ' + cod + ' copiado');
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(cod).then(ok, () => toast('Código de la sala: ' + cod));
        else toast('Código de la sala: ' + cod);
      } catch (e) { toast('Código de la sala: ' + cod); }
    });
    clic('btnCompartir', () => {
      const cod = R.codigo || '';
      const url = location.href.split('#')[0] + '#' + cod;
      try {
        const r = navigator.share({ title: 'Galaxy Strike AR', text: '¡Únete a mi sala de Galaxy Strike AR! Código: ' + cod, url });
        if (r && r.catch) r.catch(() => {});
      } catch (e) { toast('Código de la sala: ' + cod); }
    });

    clic('btnPausa', pausar);
    clic('btnContinuar', reanudar);
    clic('btnRecentrar', () => { S.recentrar(); reanudar(); toast('Mira centrada', 1200); });
    clic('btnSonido', () => { const on = A.alternar(); $('btnSonido').textContent = on ? '🔊 Sonido: sí' : '🔇 Sonido: no'; });
    clic('btnPantalla', alternarPantallaCompleta);
    clic('btnPantallaPausa', alternarPantallaCompleta);
    clic('btnIphoneListo', () => mostrar(volverDesdeIphone));
    clic('btnSeguirVertical', () => { document.body.classList.add('permitir-vertical'); revisarOrientacion(); });
    clic('btnSalirJuego', salirAlMenu);

    clic('btnOtraVez', () => {
      if (J.modo === 'solo') { pedirPantallaCompleta(); empezarSolo(); }
      else volverASala();
    });
    clic('btnMenu', salirAlMenu);
  }

  function empezarSolo() {
    J.modo = 'solo';
    J.prepararTipo(tipoElegido);
    prepararHUD('solo');
    cuentaRegresiva(() => J.iniciar({ modo: 'solo', tipo: tipoElegido, semilla: (Math.random() * 1e9) >>> 0 }));
  }

  function mostrarRecord() {
    $('txtRecord').textContent = numero(leer(claveRecord(tipoElegido), '0')).toLocaleString('es-CO');
  }

  function elegirTipo(tipo) {
    tipoElegido = tipo === 'esquiva' ? 'esquiva' : 'ar';
    guardar('gs_tipo', tipoElegido);
    $('modoAR').classList.toggle('activo', tipoElegido === 'ar');
    $('modoEsquiva').classList.toggle('activo', tipoElegido === 'esquiva');
    $('txtModoPista').textContent = tipoElegido === 'esquiva'
      ? 'Ideal para PC: mueve tu nave con el mouse y esquiva a los marcianos.'
      : 'Para celular: apunta moviéndolo y dispara a los aliens en tu cuarto.';
    mostrarRecord();
  }

  /* ---------------- Inicio ---------------- */
  UI.iniciar = function () {
    if (esAppInstalada()) document.body.classList.add('app-instalada');
    document.addEventListener('fullscreenchange', actualizarBotonesPantalla);
    document.addEventListener('webkitfullscreenchange', actualizarBotonesPantalla);
    if (mqVertical) {
      if (mqVertical.addEventListener) mqVertical.addEventListener('change', revisarOrientacion);
      else if (mqVertical.addListener) mqVertical.addListener(revisarOrientacion);
    }
    window.addEventListener('orientationchange', () => setTimeout(revisarOrientacion, 300));
    $('inpNombre').value = limpiarNombre(leer('gs_nombre', 'Piloto' + ((Math.random() * 90 + 10) | 0)));
    elegirTipo(leer('gs_tipo', esPC() ? 'esquiva' : 'ar'));
    S.modo = esPC() ? 'mouse' : 'tactil';
    document.body.dataset.modo = S.modo;
    if (GS.MODO_PRUEBA) document.body.classList.add('modo-prueba');
    enlazarControles();
    enlazarBotones();
    renderVidas();
    // Enlace compartido con código de sala: ...index.html#ABCD
    const m = /^#([A-Za-z0-9]{4})$/.exec(location.hash || '');
    if (m) {
      $('inpCodigo').value = m[1].toUpperCase();
      toast('Código de sala ' + m[1].toUpperCase() + ' listo: toca «Multijugador en línea».', 4500);
    }
  };
})(window.GS);
