/* =========================================================
   GALAXY STRIKE AR — ui/sala.js
   Multijugador en línea: sala, marcador en vivo, resultados,
   mensajes de la red y reacciones (emojis).
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
  const { DURACION_ONLINE, MAX_JUGADORES, META_COOP_POR_JUGADOR, NOMBRE_TIPO, Sala, aviso, cuentaRegresiva, esPC, fila, limpiarNombre, mostrar, nombre, numero, pedirPantallaCompleta, prepararHUD, toast } = K; // de los módulos que cargan antes

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
      Object.assign(Sala, { jugadores: [{ id: R.miId, nombre: nombre(), host: true }], hostId: R.miId, enPartida: false, estados: {}, partida: null, tipo: st.tipoElegido, coop: false });
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
    if (st.pantalla === 'pSala') {
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
        if (st.pantalla === 'pSala') renderSala();
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
        if (st.pantalla === 'pFin' && J.modo === 'online') renderRanking();
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


  Object.assign(K, { abrirOnline, crearSala, difundirLobby, empezarComoHost, enlazarEmojis, enviarEstado, renderMarcador, renderRanking, renderSala, revisarTodosEliminados, salirSala, unirseSala, volverASala });
})(window.GS);
