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
    jugadores: [], estados: {}, hostId: null, enPartida: false, partida: null, tipo: 'ar', coop: false, meta: 0,
    esperando: null, timerLobby: null, timerEstado: null, reviveEn: -1
  };
  const META_COOP_POR_JUGADOR = 6000; // puntos de equipo por piloto en el modo cooperativo
  let sectorElegido = null;           // 1-4 = campaña, null = infinito
  let volverDesdeAjustes = 'pInicio';
  let ultimoTextoOleada = '';

  /* Tipo de juego: 'ar' (Disparos AR, para celular) o 'esquiva' (Esquiva marcianos, para PC) */
  const NOMBRE_TIPO = { ar: '🎯 Disparos AR', esquiva: '👾 Esquiva marcianos' };
  const esPC = () => !(window.matchMedia && matchMedia('(pointer: coarse)').matches);
  let tipoElegido = 'ar';
  /* Control de Esquiva marcianos: 'normal' (mouse, teclado o dedo) o 'camara' (cuerpo y manos) */
  let control = 'normal';

  /* ---------------- Utilidades de interfaz ---------------- */
  function mostrar(id) {
    document.querySelectorAll('.pantalla').forEach((p) => p.classList.toggle('activa', p.id === id));
    pantalla = id;
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

  let volverDesdeIphone = 'pInicio';
  /** Botón ⛶: agranda o achica la pantalla. */
  function alternarPantallaCompleta() {
    if (enPantallaCompleta()) { salirPantallaCompleta(); return; }
    if (puedePantallaCompleta()) { entrarPantallaCompleta(); return; }
    if (esIOS()) {
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
  function cuentaRegresiva(alTerminar, pista) {
    clearInterval(ivCuenta);
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
    ivCuenta = setInterval(() => {
      n--;
      if (n > 0) { pintar(n); A.cuenta(false); }
      else if (n === 0) { pintar('¡YA!'); A.cuenta(true); S.recentrar(); if (GS.Esquiva.camara) GS.Cuerpo.calibrar(); }
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
    const conCam = camaraEnUso();
    GS.Esquiva.usarCamara(conCam);
    document.body.classList.toggle('con-cuerpo', conCam);
    $('pistaTeclas').textContent = conCam
      ? '🧍 Muévete: la nave te sigue · 🔫 Mano en pistola + baja el pulgar: disparar · ✋ Mano abierta: impulso · Esc: pausa'
      : J.tipoJuego === 'esquiva'
        ? 'Mouse o WASD / flechas: mover la nave · Clic o Espacio: impulso · Esc: pausa'
        : 'Mouse: apuntar · Clic / Espacio: disparar · A / D: esquivar · R: centrar';
    renderVidas();
    $('capaEliminado').classList.add('oculto');
    $('avisos').innerHTML = '';
    $('hudTiempo').textContent = modo === 'online' ? formatoTiempo(DURACION_ONLINE) : '';
    $('hudOleada').textContent = 'PREPÁRATE';
    $('hudCombo').textContent = '';
    $('hudPuntos').textContent = '0';
    $('reacciones').innerHTML = '';
    $('equipo').classList.toggle('oculto', !(modo === 'online' && Sala.coop));
    $('cargaAtaque').querySelector('span').textContent = Sala.coop && modo === 'online' ? '🛡️ AYUDA' : J.tipoJuego === 'esquiva' ? '👾 ESTAMPIDA' : '☄️ ATAQUE';
    GS.Poderes.reiniciar();
    ultimoSegundo = -1;
    ultimoTextoOleada = '';
    Sala.reviveEn = -1;
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

  UI.tick = function (dt) {
    if (J.estado !== 'jugando') return;
    if (J.tipoJuego === 'esquiva') {
      const t = GS.Esquiva.progreso();
      if (t !== ultimoTextoOleada) { ultimoTextoOleada = t; $('hudOleada').textContent = t; }
    }
    // Cooperativo: volver a la partida después de caer
    if (Sala.reviveEn > 0) {
      Sala.reviveEn -= dt || 0;
      $('txtEliminado').textContent = 'Vuelves en ' + Math.max(1, Math.ceil(Sala.reviveEn)) + ' s… tu equipo sigue sumando.';
      if (Sala.reviveEn <= 0) { Sala.reviveEn = -1; $('capaEliminado').classList.add('oculto'); J.revivir(); enviarEstado(); }
    }
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
  J.on('oleada', (n, jefe, nombreOleada) => {
    if (J.tutorial) return;
    if (J.tipoJuego === 'esquiva') {
      aviso(J.campana ? 'SECTOR ' + J.campana + ' · ' + (nombreOleada || '') : jefe ? '⚠️ ¡NAVE NODRIZA!' : 'NIVEL ' + n, jefe ? 'peligro' : 'info');
      return;
    }
    const total = J.totalOleadas();
    $('hudOleada').textContent = J.campana ? 'SECTOR ' + J.campana + ' · OLEADA ' + n + '/' + total : 'OLEADA ' + n;
    const txt = (jefe ? '⚠️ ' : 'OLEADA ' + n + (total ? '/' + total : '') + ' · ') + (nombreOleada || '');
    aviso(txt, jefe ? 'peligro' : 'info', 2300);
  });
  J.on('oleadaSuperada', (n) => aviso('¡OLEADA ' + n + ' SUPERADA!', 'exito'));
  J.on('aviso', (txt, clase) => aviso(txt, clase, 2200));
  J.on('muerte', () => {
    if (J.modo !== 'online') return;
    $('capaEliminado').classList.remove('oculto');
    if (Sala.coop) {
      Sala.reviveEn = 10;
      $('txtEliminadoTitulo').textContent = 'CAÍSTE';
    } else {
      $('txtEliminadoTitulo').textContent = 'ELIMINADO';
      $('txtEliminado').textContent = 'Mira el marcador: la partida termina cuando acabe el tiempo.';
    }
    enviarEstado();
    revisarTodosEliminados();
  });
  J.on('ataque', (n) => {
    if (!R.conectado) return;
    if (Sala.coop) {
      R.enviar({ t: 'ayuda', nombre: nombre() });
      aviso('🛡️ ¡Le mandaste un escudo a tu equipo!', 'exito');
      return;
    }
    R.enviar({ t: 'ataque', nombre: nombre(), n });
    aviso(J.tipoJuego === 'esquiva' ? '🚀 ¡Estampida enviada a tus rivales!' : '🚀 ¡Lluvia de meteoros enviada a tus rivales!', 'exito');
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

  function estrellasTexto(n) { return '★'.repeat(n) + '☆'.repeat(3 - n); }

  function mostrarFin(motivo) {
    $('hud').classList.add('oculto');
    $('capaEliminado').classList.add('oculto');
    GS.Tutorial.cancelar();
    soltarWakeLock();
    GS.Musica.tocar('menu');
    A.finJuego();
    const cont = $('finContenido');
    cont.innerHTML = '';
    const extra = $('btnFinExtra');
    extra.classList.add('oculto');
    $('finEstrellas').textContent = '';
    if (J.modo === 'solo') {
      const tipo = J.tipoJuego;
      if (tipo === 'esquiva') {
        const st = GS.Esquiva.estadisticas();
        cont.append(
          fila('Puntos', J.puntos.toLocaleString('es-CO'), true),
          fila(J.campana ? 'Sector' : 'Nivel alcanzado', String(J.campana || st.nivel)),
          fila('Tiempo vivo', formatoTiempo(st.tiempo)),
          fila('¡Por poco!', String(st.porPoco)),
          fila('Cristales', String(st.cristales)),
          fila('Anillos', String(st.anillos))
        );
      } else {
        const precision = J.disparos ? Math.round((J.aciertos / J.disparos) * 100) : 0;
        cont.append(
          fila('Puntos', J.puntos.toLocaleString('es-CO'), true),
          fila(J.campana ? 'Oleada' : 'Oleada alcanzada', J.campana ? J.oleada + '/' + J.totalOleadas() : String(J.oleada)),
          fila('Aliens destruidos', String(J.kills)),
          fila('Esquivados', String(J.esquivados)),
          fila('Precisión', precision + '%'),
          fila('Vidas perdidas', String(J.vidasPerdidas))
        );
      }
      if (J.campana) {
        const sec = GS.Sectores.get(J.campana);
        if (motivo === 'victoria') {
          const est = J.vidasPerdidas === 0 ? 3 : J.vidasPerdidas <= 2 ? 2 : 1;
          const r = GS.Progreso.completarSector(tipo, J.campana, est, J.puntos);
          $('txtFinTitulo').textContent = J.campana === GS.Sectores.total ? '👑 ¡CAMPAÑA COMPLETADA!' : '¡SECTOR COMPLETADO!';
          $('finEstrellas').textContent = estrellasTexto(est);
          if (r.nuevoDesbloqueo) toast('🔓 Desbloqueaste el sector ' + (J.campana + 1) + ': ' + GS.Sectores.get(J.campana + 1).nombre, 4000);
          if (J.campana < GS.Sectores.total) {
            $('btnOtraVez').textContent = 'Siguiente sector ▶';
            $('btnOtraVez').dataset.accion = 'siguiente';
            extra.textContent = 'Repetir ' + sec.nombre;
            extra.dataset.accion = 'repetir';
            extra.classList.remove('oculto');
          } else {
            $('btnOtraVez').textContent = '♾️ Jugar Infinito';
            $('btnOtraVez').dataset.accion = 'infinito';
            extra.textContent = 'Repetir el sector final';
            extra.dataset.accion = 'repetir';
            extra.classList.remove('oculto');
          }
        } else {
          $('txtFinTitulo').textContent = 'MISIÓN FALLIDA';
          $('btnOtraVez').textContent = 'Reintentar ' + sec.nombre;
          $('btnOtraVez').dataset.accion = 'repetir';
        }
      } else {
        const puesto = GS.Progreso.agregarRecord(tipo, nombre(), J.puntos);
        $('txtFinTitulo').textContent = puesto === 1 ? '¡NUEVO RÉCORD!' : 'FIN DEL JUEGO';
        if (puesto) cont.appendChild(fila('Tu top 10', 'Puesto #' + puesto));
        $('btnOtraVez').textContent = 'Jugar otra vez';
        $('btnOtraVez').dataset.accion = 'repetir';
        if (GS.Progreso.global.activo() && J.puntos > 0) {
          const nota = document.createElement('p');
          nota.className = 'nota';
          nota.textContent = '🌎 Enviando tu puntaje a la tabla mundial…';
          cont.appendChild(nota);
          GS.Progreso.global.enviar(tipo, nombre(), J.puntos).then((ok) => { nota.textContent = ok ? '🌎 ¡Puntaje enviado a la tabla mundial!' : '🌎 No se pudo enviar a la tabla mundial.'; });
        }
      }
      mostrarRecord();
    } else {
      clearInterval(Sala.timerEstado);
      enviarEstado(true);
      setTimeout(() => enviarEstado(true), 1000);
      setTimeout(() => enviarEstado(true), 2500);
      $('txtFinTitulo').textContent = Sala.coop ? 'MISIÓN EN EQUIPO' : 'RESULTADOS';
      renderRanking();
      $('btnOtraVez').dataset.accion = R.conectado && R.esHost ? 'revancha' : 'sala';
      $('btnOtraVez').textContent = !R.conectado ? 'Multijugador' : R.esHost ? '🔁 Revancha' : 'Volver a la sala';
      if (R.conectado && R.esHost) {
        extra.textContent = 'Volver a la sala';
        extra.dataset.accion = 'sala';
        extra.classList.remove('oculto');
      }
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
    if (Sala.coop) {
      const total = lista.reduce((a, j) => a + j.puntos, 0);
      const logrado = total >= Sala.meta;
      const t = document.createElement('p');
      t.className = 'ganador';
      t.textContent = logrado ? '🤝 ¡MISIÓN CUMPLIDA!' : 'Casi… les faltaron ' + (Sala.meta - total).toLocaleString('es-CO') + ' puntos';
      cont.appendChild(t);
      cont.appendChild(fila('Puntos del equipo', total.toLocaleString('es-CO') + ' / ' + Sala.meta.toLocaleString('es-CO'), true));
      if (logrado && !Sala.logroCoop) { Sala.logroCoop = true; GS.Progreso.evento('metaCoop'); }
    } else if (lista.length) {
      const yoPrimero = lista[0].id === R.miId;
      const t = document.createElement('p');
      t.className = 'ganador';
      t.textContent = yoPrimero ? '¡GANASTE LA PARTIDA!' : 'Ganó ' + lista[0].nombre;
      cont.appendChild(t);
      if (yoPrimero && lista.length > 1 && !Sala.logroVictoria && !lista.some((j) => !j.fin)) { Sala.logroVictoria = true; GS.Progreso.evento('victoriaOnline'); }
    }
    lista.forEach((j, i) => {
      const d = document.createElement('div');
      d.className = 'fila-ranking' + (j.id === R.miId ? ' yo' : '');
      const a = document.createElement('span');
      a.textContent = (Sala.coop ? (i === 0 ? '⭐ ' : '🛸 ') : (medallas[i] || i + 1 + '°') + '  ') + j.nombre + (j.id === R.miId ? ' (tú)' : '') + (Sala.coop && i === 0 ? ' · MVP' : '');
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
    if (Sala.coop) {
      const total = Object.keys(Sala.estados).reduce((a, id) => a + (Sala.estados[id].puntos || 0), 0);
      $('txtEquipo').textContent = '🤝 EQUIPO ' + total.toLocaleString('es-CO') + ' / ' + Sala.meta.toLocaleString('es-CO');
      $('barraEquipo').style.width = Math.min(100, Math.round((total / Math.max(1, Sala.meta)) * 100)) + '%';
    }
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
    if (J.modo !== 'online' || J.estado !== 'jugando' || J.vivo || Sala.coop) return;
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
    R.enviar({ t: 'lobby', tipo: Sala.tipo, coop: Sala.coop, jugadores: Sala.jugadores.map((j) => ({ id: j.id, nombre: j.nombre, host: j.host })), enPartida: Sala.enPartida });
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
    $('btnTipoPartida').textContent = Sala.coop ? '🤝 Cooperativo: sumen puntos juntos' : '⚔️ Competencia: gana el que más puntos haga';
    $('btnTipoPartida').disabled = !R.esHost;
    $('btnTipoPartida').classList.toggle('solo-lectura', !R.esHost);
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
      Object.assign(Sala, { jugadores: [{ id: R.miId, nombre: nombre(), host: true }], hostId: R.miId, enPartida: false, estados: {}, partida: null, tipo: tipoElegido, coop: false });
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
      t: 'inicio', tipo: Sala.tipo, coop: Sala.coop, semilla: (Math.random() * 1e9) >>> 0, duracion: DURACION_ONLINE, partida: U.id(8),
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
    Sala.coop = !!msg.coop;
    Sala.meta = META_COOP_POR_JUGADOR * Math.max(1, Object.keys(Sala.estados).length);
    Sala.logroCoop = false;
    Sala.logroVictoria = false;
    J.modo = 'online';
    J.prepararTipo(tipo);
    prepararHUD('online');
    cuentaRegresiva(() => {
      J.iniciar({ modo: 'online', tipo, coop: Sala.coop, semilla: msg.semilla >>> 0, duracion: U.clamp(msg.duracion | 0, 30, 600) });
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
        Sala.coop = !!msg.coop;
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
        if (de && de !== R.miId && J.modo === 'online' && !Sala.coop) J.recibirAtaque(limpiarNombre(msg.nombre), U.clamp(msg.n | 0, 1, 5));
        break;
      case 'ayuda':
        if (de && de !== R.miId && J.modo === 'online' && Sala.coop && J.estado === 'jugando' && J.vivo) {
          GS.Poderes.activar('escudo');
          aviso('🛡️ ¡' + limpiarNombre(msg.nombre) + ' te mandó un escudo!', 'exito');
        }
        break;
      case 'emoji':
        if (de && de !== R.miId) mostrarReaccion(limpiarNombre(msg.nombre), U.clamp(msg.e | 0, 0, EMOJIS.length - 1));
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
    if (J.modo === 'solo') GS.Musica.parar();
    mostrar('pPausa');
  }
  function reanudar() {
    mostrar(null);
    if (J.estado === 'pausa') J.estado = 'jugando';
    GS.Musica.tocar();
  }
  function salirAlMenu() {
    if (J.modo === 'online') salirSala();
    clearInterval(ivCuenta);
    GS.Tutorial.cancelar();
    GS.Poderes.reiniciar();
    GS.Musica.tocar('menu');
    J.estado = 'menu';
    J.entidades = [];
    soltarWakeLock();
    $('hud').classList.add('oculto');
    document.body.dataset.partida = '';
    document.body.classList.remove('con-cuerpo');
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
      if (esq && ev.pointerType === 'mouse' && GS.Esquiva.camara) { /* con cámara manda tu cuerpo, no el mouse */ }
      else if (esq && ev.pointerType === 'mouse') GS.Esquiva.apuntar(ev.clientX, ev.clientY, window.innerWidth, window.innerHeight);
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
    const clic = (id, fn) => $(id).addEventListener('click', (ev) => {
      A.iniciar();
      A.clic();
      if (J.estado === 'menu') GS.Musica.tocar('menu');
      fn(ev);
    });

    clic('btnSolo', () => {
      guardar('gs_nombre', nombre());
      pedirPantallaCompleta();
      if (tipoElegido === 'esquiva') conCamara(abrirSectores);
      else conSensores(abrirSectores);
    });
    clic('btnOnline', () => {
      guardar('gs_nombre', nombre());
      if (tipoElegido === 'esquiva') conCamara(abrirOnline);
      else conSensores(abrirOnline);
    });
    clic('modoAR', () => elegirTipo('ar'));
    clic('modoEsquiva', () => elegirTipo('esquiva'));
    clic('ctrlNormal', () => elegirControl('normal'));
    clic('ctrlCamara', () => elegirControl('camara'));
    clic('btnCamListo', () => {
      const CU = GS.Cuerpo;
      if (CU.estado === 'listo') { cerrarCamara(true); return; }
      const fn = camDespues; // reintentar
      cerrarCamara(false);
      conCamara(fn);
    });
    clic('btnCamCancelar', () => { elegirControl('normal'); cerrarCamara(true); });
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
    clic('btnPracticar', () => {
      const lanzar = () => { J.modo = 'solo'; J.prepararTipo(tipoElegido); prepararHUD('solo'); empezarTutorial(salirAlMenu); };
      if (tipoElegido === 'esquiva') conCamara(lanzar); else conSensores(lanzar);
    });
    clic('btnPerfil', () => abrirPerfil('logros'));
    clic('btnAjustes', () => { volverDesdeAjustes = 'pInicio'; abrirAjustes(); });
    clic('btnAjustesPausa', () => { volverDesdeAjustes = 'pPausa'; abrirAjustes(); });
    clic('btnAjustesListo', () => mostrar(volverDesdeAjustes));
    clic('btnPerfilListo', () => mostrar('pInicio'));
    clic('btnSectoresVolver', () => mostrar('pInicio'));
    clic('btnSaltarTutorial', () => GS.Tutorial.saltar());
    clic('btnTipoPartida', () => { if (!R.esHost) return; Sala.coop = !Sala.coop; difundirLobby(); renderSala(); });
    document.querySelectorAll('[data-pestana]').forEach((b) => b.addEventListener('click', () => { A.clic(); abrirPerfil(b.dataset.pestana); }));
    enlazarAjustes();
    enlazarEmojis();
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
    clic('btnPantalla', alternarPantallaCompleta);
    clic('btnPantallaPausa', alternarPantallaCompleta);
    clic('btnIphoneListo', () => mostrar(volverDesdeIphone));
    clic('btnSeguirVertical', () => { document.body.classList.add('permitir-vertical'); revisarOrientacion(); });
    clic('btnSalirJuego', salirAlMenu);

    const accionFin = (accion) => {
      if (accion === 'revancha') {
        if (R.conectado && R.esHost) { Sala.enPartida = false; empezarComoHost(); } else volverASala();
        return;
      }
      if (accion === 'sala') { volverASala(); return; }
      pedirPantallaCompleta();
      if (accion === 'siguiente') sectorElegido = Math.min(GS.Sectores.total, (J.campana || 0) + 1);
      else if (accion === 'infinito') sectorElegido = null;
      empezarSolo();
    };
    clic('btnOtraVez', () => accionFin($('btnOtraVez').dataset.accion || 'repetir'));
    clic('btnFinExtra', () => accionFin($('btnFinExtra').dataset.accion || 'repetir'));
    clic('btnMenu', salirAlMenu);
  }

  function empezarSolo() {
    J.modo = 'solo';
    J.prepararTipo(tipoElegido);
    prepararHUD('solo');
    // La primera vez de cada modo, primero el tutorial
    if (!GS.Tutorial.hecho(tipoElegido)) { empezarTutorial(empezarSolo); return; }
    const sec = sectorElegido ? GS.Sectores.get(sectorElegido) : null;
    const pista = sec ? 'SECTOR ' + sec.id + ' · ' + sec.nombre : '♾️ MODO INFINITO';
    cuentaRegresiva(() => J.iniciar({ modo: 'solo', tipo: tipoElegido, sector: sectorElegido, semilla: (Math.random() * 1e9) >>> 0 }), pista);
  }

  function empezarTutorial(despues) {
    GS.Tutorial.alTerminar = () => {
      GS.Tutorial.alTerminar = null;
      J.estado = 'cuenta';
      J.entidades = [];
      GS.Poderes.reiniciar();
      toast('✅ ¡Tutorial completado!', 2000);
      despues();
    };
    cuentaRegresiva(() => { J.iniciar({ modo: 'solo', tipo: tipoElegido, tutorial: true }); $('hudOleada').textContent = '🎓 TUTORIAL'; }, '🎓 TUTORIAL');
  }

  function mostrarRecord() {
    $('txtRecord').textContent = GS.Progreso.mejor(tipoElegido).toLocaleString('es-CO');
  }

  function elegirTipo(tipo) {
    tipoElegido = tipo === 'esquiva' ? 'esquiva' : 'ar';
    guardar('gs_tipo', tipoElegido);
    $('modoAR').classList.toggle('activo', tipoElegido === 'ar');
    $('modoEsquiva').classList.toggle('activo', tipoElegido === 'esquiva');
    $('selectorControl').classList.toggle('oculto', tipoElegido !== 'esquiva');
    // La cámara frontal se apaga si cambias a Disparos AR
    if (tipoElegido !== 'esquiva' && GS.Cuerpo.estado === 'listo') GS.Cuerpo.detener();
    pintarControl();
    mostrarRecord();
  }

  /* ---------------- Control con cámara (Esquiva marcianos) ---------------- */
  function pintarControl() {
    $('ctrlNormal').classList.toggle('activo', control === 'normal');
    $('ctrlCamara').classList.toggle('activo', control === 'camara');
    $('txtModoPista').textContent = tipoElegido === 'esquiva'
      ? control === 'camara'
        ? 'Con cámara: tu cuerpo mueve la nave y con la mano en pistola le disparas a los marcianos.'
        : 'Ideal para PC: mueve tu nave con el mouse y esquiva a los marcianos.'
      : 'Para celular: apunta moviéndolo y dispara a los aliens en tu cuarto.';
  }

  function elegirControl(c) {
    control = c === 'camara' ? 'camara' : 'normal';
    guardar('gs_control', control);
    if (control === 'normal') {
      if (GS.Cuerpo.estado === 'listo') GS.Cuerpo.detener();
      GS.Esquiva.usarCamara(false);
      document.body.classList.remove('con-cuerpo');
    }
    pintarControl();
  }

  /** ¿Esta partida se juega con la cámara? */
  function camaraEnUso() {
    return J.tipoJuego === 'esquiva' && control === 'camara' && GS.Cuerpo.estado === 'listo';
  }

  /** Antes de jugar Esquiva con cámara: permiso, carga del detector y comprobar que te ve. */
  let camDespues = null, ivCam = null;
  function conCamara(fn) {
    const CU = GS.Cuerpo;
    if (tipoElegido !== 'esquiva' || control !== 'camara' || CU.estado === 'listo') { fn(); return; }
    camDespues = fn;
    $('huecoCam').appendChild($('camCuerpo'));
    document.body.classList.add('cam-grande');
    $('btnCamListo').disabled = true;
    $('btnCamListo').textContent = 'Esperando…';
    $('txtCamEstado').textContent = '📷 Pidiendo permiso para la cámara…';
    mostrar('pCamara');
    CU.iniciar($('videoCuerpo')).then((ok) => {
      if (pantalla !== 'pCamara') return;
      if (!ok) {
        $('txtCamEstado').textContent = '⚠️ ' + CU.error + ' Puedes reintentar o jugar con el control normal.';
        $('btnCamListo').textContent = '🔄 Reintentar';
        $('btnCamListo').disabled = false;
        return;
      }
      CU.reanudarVideo();
      clearInterval(ivCam);
      ivCam = setInterval(() => {
        if (pantalla !== 'pCamara') { clearInterval(ivCam); return; }
        const teVe = CU.persona;
        const pistola = CU.manos.some((m) => m.pistola);
        $('txtCamEstado').textContent = !teVe
          ? '🧍 Párate frente a la cámara, que se vean tus hombros…'
          : pistola ? '🔫 ¡Esa es la pistola! Baja el pulgar para disparar.' : '✅ ¡Te veo! Prueba a hacer una pistola con la mano.';
        $('btnCamListo').disabled = !teVe;
        $('btnCamListo').textContent = teVe ? '¡Listo, a jugar!' : 'Esperando…';
      }, 250);
    });
  }

  function cerrarCamara(seguir) {
    clearInterval(ivCam);
    $('lienzo').after($('camCuerpo')); // la mini ventana vuelve a su esquina
    document.body.classList.remove('cam-grande');
    GS.Cuerpo.reanudarVideo();
    const fn = camDespues;
    camDespues = null;
    if (seguir && fn) fn();
  }

  function prepararCuerpo() {
    const CU = GS.Cuerpo, E = GS.Esquiva;
    // Solo detecta cuando hace falta (ahorra batería)
    CU.necesario = () => pantalla === 'pCamara' || (E.camara && (J.estado === 'jugando' || J.estado === 'cuenta'));
    CU.alImpulso = () => { if (E.camara && J.estado === 'jugando') E.impulso(); };
    CU.alProgreso = (txt) => { if (pantalla === 'pCamara') $('txtCamEstado').textContent = txt; };
    CU.alLento = () => {
      toast('🐢 Este equipo va lento con la cámara: vuelvo al control normal.', 4500);
      elegirControl('normal');
    };
    control = leer('gs_control', 'normal') === 'camara' ? 'camara' : 'normal';
  }

  /* ---------------- Sectores (campaña) ---------------- */
  function abrirSectores() {
    const cont = $('listaSectores');
    cont.innerHTML = '';
    $('txtSectoresModo').textContent = NOMBRE_TIPO[tipoElegido] + ' · Dificultad ' + GS.Ajustes.dif().nombre;
    GS.Sectores.lista.forEach((sec) => {
      const p = GS.Progreso.sector(tipoElegido, sec.id);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tarjeta-sector' + (p.desbloqueado ? '' : ' bloqueada') + (p.completado ? ' completada' : '');
      b.style.setProperty('--c', sec.tema.acento);
      b.disabled = !p.desbloqueado;
      const num = document.createElement('span'); num.className = 'ts-num'; num.textContent = p.desbloqueado ? 'SECTOR ' + sec.id : '🔒 SECTOR ' + sec.id;
      const nom = document.createElement('strong'); nom.textContent = sec.nombre;
      const lema = document.createElement('small'); lema.textContent = p.desbloqueado ? sec.lema : 'Completa el sector ' + (sec.id - 1) + ' para abrirlo';
      const est = document.createElement('span'); est.className = 'ts-estrellas'; est.textContent = estrellasTexto(p.estrellas);
      const mej = document.createElement('small'); mej.className = 'ts-mejor'; mej.textContent = p.mejor ? 'Mejor: ' + p.mejor.toLocaleString('es-CO') : (tipoElegido === 'esquiva' ? 'Sobrevive y vence al jefe' : '5 oleadas + jefe');
      b.append(num, nom, lema, est, mej);
      b.addEventListener('click', () => { A.iniciar(); A.clic(); sectorElegido = sec.id; empezarSolo(); });
      cont.appendChild(b);
    });
    const inf = document.createElement('button');
    inf.type = 'button';
    inf.className = 'tarjeta-sector infinito';
    const n1 = document.createElement('span'); n1.className = 'ts-num'; n1.textContent = 'SIN FIN';
    const n2 = document.createElement('strong'); n2.textContent = '♾️ Infinito';
    const n3 = document.createElement('small'); n3.textContent = 'Oleadas cada vez más difíciles. ¡Bate tu récord!';
    const n4 = document.createElement('small'); n4.className = 'ts-mejor'; n4.textContent = 'Récord: ' + GS.Progreso.mejor(tipoElegido).toLocaleString('es-CO');
    inf.append(n1, n2, n3, n4);
    inf.addEventListener('click', () => { A.iniciar(); A.clic(); sectorElegido = null; empezarSolo(); });
    cont.appendChild(inf);
    mostrar('pSectores');
  }

  /* ---------------- Perfil: logros, récords y naves ---------------- */
  let pestanaPerfil = 'logros';
  function abrirPerfil(pestana) {
    pestanaPerfil = pestana || pestanaPerfil;
    document.querySelectorAll('[data-pestana]').forEach((b) => b.classList.toggle('activo', b.dataset.pestana === pestanaPerfil));
    const cont = $('perfilContenido');
    cont.innerHTML = '';
    const P = GS.Progreso;
    if (pestanaPerfil === 'logros') {
      const hechos = P.LOGROS.filter((l) => P.logrado(l.id)).length;
      $('txtPerfilResumen').textContent = '🏅 ' + hechos + ' de ' + P.LOGROS.length + ' logros';
      const grid = document.createElement('div');
      grid.className = 'grid-logros';
      P.LOGROS.forEach((l) => {
        const d = document.createElement('div');
        d.className = 'logro' + (P.logrado(l.id) ? ' hecho' : '');
        const i = document.createElement('span'); i.className = 'logro-ico'; i.textContent = P.logrado(l.id) ? l.icono : '🔒';
        const t = document.createElement('strong'); t.textContent = l.nombre;
        const x = document.createElement('small'); x.textContent = l.desc;
        d.append(i, t, x);
        grid.appendChild(d);
      });
      cont.appendChild(grid);
    } else if (pestanaPerfil === 'records') {
      $('txtPerfilResumen').textContent = '🏆 Top 10 del modo Infinito en este dispositivo';
      const cols = document.createElement('div');
      cols.className = 'cols-records';
      ['ar', 'esquiva'].forEach((tipo) => {
        const c = document.createElement('div');
        c.className = 'col-record';
        const h = document.createElement('h3'); h.textContent = NOMBRE_TIPO[tipo];
        c.appendChild(h);
        const lista = document.createElement('ol');
        const top = P.top(tipo);
        if (!top.length) { const li = document.createElement('li'); li.className = 'vacio'; li.textContent = 'Todavía no hay récords'; lista.appendChild(li); }
        top.forEach((r) => { const li = document.createElement('li'); const a = document.createElement('span'); a.textContent = r.n; const b = document.createElement('b'); b.textContent = r.p.toLocaleString('es-CO'); li.append(a, b); lista.appendChild(li); });
        c.appendChild(lista);
        if (P.global.activo()) {
          const h2 = document.createElement('h4'); h2.textContent = '🌎 Mundial';
          const lg = document.createElement('ol'); lg.className = 'mundial';
          const cargando = document.createElement('li'); cargando.className = 'vacio'; cargando.textContent = 'Cargando…'; lg.appendChild(cargando);
          c.append(h2, lg);
          P.global.leer(tipo).then((filas) => {
            lg.innerHTML = '';
            if (!filas || !filas.length) { const li = document.createElement('li'); li.className = 'vacio'; li.textContent = filas ? 'Sé el primero 🚀' : 'Sin conexión'; lg.appendChild(li); return; }
            filas.forEach((r) => { const li = document.createElement('li'); const a = document.createElement('span'); a.textContent = r.n; const b = document.createElement('b'); b.textContent = r.p.toLocaleString('es-CO'); li.append(a, b); lg.appendChild(li); });
          });
        }
        cols.appendChild(c);
      });
      cont.appendChild(cols);
      if (!P.global.activo()) {
        const n = document.createElement('p'); n.className = 'nota';
        n.textContent = GS.MODO_PRUEBA ? 'La tabla mundial funciona en la versión publicada (ver README).' : 'Tabla mundial: actívala con Supabase en js/config.js (ver README).';
        cont.appendChild(n);
      }
    } else {
      $('txtPerfilResumen').textContent = '🚀 Hangar: elige el color de tu nave y de tu láser';
      const grid = document.createElement('div');
      grid.className = 'grid-naves';
      P.NAVES.forEach((n) => {
        const ok = P.naveDisponible(n.id);
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'nave-carta' + (ok ? '' : ' bloqueada') + (P.nave().id === n.id ? ' activo' : '');
        b.disabled = !ok;
        const muestra = document.createElement('span');
        muestra.className = 'nave-muestra';
        const css = (c) => 'rgb(' + c.map((v) => Math.round(v * 255)).join(',') + ')';
        muestra.style.background = 'linear-gradient(135deg,' + css(n.colores.alas) + ' 0 45%,' + css(n.colores.casco) + ' 45% 70%,' + css(n.colores.franja) + ' 70%)';
        muestra.style.boxShadow = '0 0 14px rgb(' + n.laser + ')';
        const t = document.createElement('strong'); t.textContent = n.nombre;
        const req = n.requiere ? P.LOGROS.find((l) => l.id === n.requiere) : null;
        const x = document.createElement('small'); x.textContent = ok ? (P.nave().id === n.id ? '✔ En uso' : 'Toca para usar') : '🔒 Logro: ' + (req ? req.nombre : '');
        b.append(muestra, t, x);
        b.addEventListener('click', () => { A.clic(); P.elegirNave(n.id); abrirPerfil('naves'); });
        grid.appendChild(b);
      });
      cont.appendChild(grid);
    }
    if (pantalla !== 'pPerfil') mostrar('pPerfil');
  }

  /* ---------------- Ajustes ---------------- */
  function abrirAjustes() {
    const Aj = GS.Ajustes;
    document.querySelectorAll('[data-ajuste]').forEach((g) => {
      const k = g.dataset.ajuste;
      const v = k === 'sonido' ? A.activo : Aj.get(k);
      g.querySelectorAll('button[data-valor]').forEach((b) => b.classList.toggle('activo', String(v) === b.dataset.valor));
    });
    $('rngSensibilidad').value = Aj.get('sensibilidad');
    $('txtSensibilidad').textContent = Math.round(Aj.get('sensibilidad') * 100) + '%';
    const enJuego = volverDesdeAjustes === 'pPausa';
    $('btnRepetirTutorial').classList.toggle('oculto', enJuego);
    $('notaDificultad').textContent = enJuego ? 'La dificultad se aplica desde la próxima partida.' : 'En línea todos juegan en Normal para que sea justo.';
    mostrar('pAjustes');
  }

  function enlazarAjustes() {
    const Aj = GS.Ajustes;
    document.querySelectorAll('[data-ajuste]').forEach((g) => {
      const k = g.dataset.ajuste;
      g.querySelectorAll('button[data-valor]').forEach((b) => b.addEventListener('click', () => {
        A.iniciar();
        let v = b.dataset.valor;
        if (v === 'true' || v === 'false') v = v === 'true';
        if (k === 'sonido') { if (A.activo !== v) A.alternar(); }
        else Aj.set(k, v);
        A.clic();
        abrirAjustes();
      }));
    });
    $('rngSensibilidad').addEventListener('input', (ev) => {
      const v = U.clamp(parseFloat(ev.target.value) || 1, 0.5, 1.6);
      Aj.set('sensibilidad', v);
      $('txtSensibilidad').textContent = Math.round(v * 100) + '%';
    });
    $('btnRepetirTutorial').addEventListener('click', () => {
      A.clic();
      GS.Tutorial.olvidar();
      toast('🎓 El tutorial volverá a salir en tu próxima partida.', 2600);
    });
    Aj.alCambiar((k, v) => {
      if (k === 'zurdo') document.body.classList.toggle('zurdo', !!v);
      if (k === 'calidad') { GS.Ajustes._autoBaja = false; J.redimensionar(); }
      if (k === 'musica') { if (v) GS.Musica.tocar(J.estado === 'jugando' ? undefined : 'menu'); else GS.Musica.parar(); }
    });
    document.body.classList.toggle('zurdo', !!Aj.get('zurdo'));
  }

  /* ---------------- Reacciones (emojis en línea) ---------------- */
  const EMOJIS = ['🔥', '😂', '😱', '👏'];
  let ultimoEmoji = 0;
  function mostrarReaccion(quien, i) {
    const cont = $('reacciones');
    if (cont.children.length > 6) cont.firstChild.remove();
    const d = document.createElement('div');
    d.className = 'reaccion';
    d.style.left = (12 + Math.random() * 70) + '%';
    const e = document.createElement('span'); e.textContent = EMOJIS[i];
    const n = document.createElement('small'); n.textContent = quien;
    d.append(e, n);
    cont.appendChild(d);
    setTimeout(() => d.remove(), 2600);
  }
  function enlazarEmojis() {
    const cont = $('barraEmojis');
    EMOJIS.forEach((em, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = em;
      b.setAttribute('aria-label', 'Reacción ' + em);
      const enviar = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const ahora = performance.now();
        if (ahora - ultimoEmoji < 1200 || !R.conectado) return;
        ultimoEmoji = ahora;
        R.enviar({ t: 'emoji', nombre: nombre(), e: i });
        mostrarReaccion('Tú', i);
      };
      b.addEventListener('pointerdown', (ev) => ev.stopPropagation());
      b.addEventListener('click', enviar);
      cont.appendChild(b);
    });
  }

  /* ---------------- Logros ---------------- */
  GS.Progreso.alLograr((l) => {
    A.logro();
    const naves = GS.Progreso.NAVES.filter((n) => n.requiere === l.id);
    const caja = $('logroToast');
    $('logroIcono').textContent = l.icono;
    $('logroNombre').textContent = l.nombre;
    $('logroExtra').textContent = naves.length ? '🚀 Nave desbloqueada: ' + naves[0].nombre : l.desc;
    caja.classList.remove('oculto', 'entra');
    void caja.offsetWidth;
    caja.classList.add('entra');
    clearTimeout(caja._t);
    caja._t = setTimeout(() => caja.classList.add('oculto'), 3600);
  });

  /** Pasa los récords de la versión 1 a la tabla nueva. */
  function migrarRecords() {
    [['ar', 'gs_record'], ['esquiva', 'gs_record_esquiva']].forEach(([tipo, clave]) => {
      const v = numero(leer(clave, '0'));
      if (v > 0 && GS.Progreso.mejor(tipo) < v) GS.Progreso.agregarRecord(tipo, limpiarNombre(leer('gs_nombre', 'Piloto')), v);
      if (v > 0) { try { localStorage.removeItem(clave); } catch (e) { /* nada */ } }
    });
  }

  /* ---------------- Inicio ---------------- */
  UI.iniciar = function () {
    document.addEventListener('fullscreenchange', actualizarBotonesPantalla);
    document.addEventListener('webkitfullscreenchange', actualizarBotonesPantalla);
    if (mqVertical) {
      if (mqVertical.addEventListener) mqVertical.addEventListener('change', revisarOrientacion);
      else if (mqVertical.addListener) mqVertical.addListener(revisarOrientacion);
    }
    window.addEventListener('orientationchange', () => setTimeout(revisarOrientacion, 300));
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
      else if (pantalla !== 'pPausa') GS.Musica.tocar();
    });
    // Enlace compartido con código de sala: ...index.html#ABCD
    const m = /^#([A-Za-z0-9]{4})$/.exec(location.hash || '');
    if (m) {
      $('inpCodigo').value = m[1].toUpperCase();
      toast('Código de sala ' + m[1].toUpperCase() + ' listo: toca «Multijugador en línea».', 4500);
    }
  };
})(window.GS);
