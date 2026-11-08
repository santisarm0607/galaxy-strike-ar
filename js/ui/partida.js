/* =========================================================
   GALAXY STRIKE AR — ui/partida.js
   Durante la partida: HUD, eventos del juego, pantalla de fin,
   controles (toques, mouse, teclado) y pausa.
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
  const { DURACION_ONLINE, Sala, aviso, mostrar, nombre, pedirWakeLock, soltarWakeLock, toast } = K; // de los módulos que cargan antes

  /* ---------------- HUD ---------------- */
  function prepararHUD(modo) {
    document.body.dataset.partida = modo;
    document.body.dataset.juego = J.tipoJuego;
    $('btnDisparo').textContent = J.tipoJuego === 'esquiva' ? 'IMPULSO' : 'FUEGO';
    const conCam = K.camaraEnUso();
    GS.Esquiva.usarCamara(conCam);
    document.body.classList.toggle('con-cuerpo', conCam);
    $('pistaTeclas').textContent = conCam
      ? GS.Cuerpo.modo === 'manos'
        ? 'Mueve la mano: la nave te sigue · Pistola + baja el pulgar: disparar al frente · Abre la mano: impulso · Esc: pausa'
        : 'Muévete: la nave te sigue · Mano en pistola + baja el pulgar: disparar · Mano abierta: impulso · Esc: pausa'
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
    $('cargaAtaque').querySelector('span').textContent = Sala.coop && modo === 'online' ? 'AYUDA' : J.tipoJuego === 'esquiva' ? 'ESTAMPIDA' : 'ATAQUE';
    GS.Poderes.reiniciar();
    st.ultimoSegundo = -1;
    st.ultimoTextoOleada = '';
    Sala.reviveEn = -1;
    K.renderMarcador();
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
      s.textContent = '❤︎';
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
      if (t !== st.ultimoTextoOleada) { st.ultimoTextoOleada = t; $('hudOleada').textContent = t; }
    }
    // Cooperativo: volver a la partida después de caer
    if (Sala.reviveEn > 0) {
      Sala.reviveEn -= dt || 0;
      $('txtEliminado').textContent = 'Vuelves en ' + Math.max(1, Math.ceil(Sala.reviveEn)) + ' s… tu equipo sigue sumando.';
      if (Sala.reviveEn <= 0) { Sala.reviveEn = -1; $('capaEliminado').classList.add('oculto'); J.revivir(); K.enviarEstado(); }
    }
    if (J.modo === 'online') {
      const s = Math.ceil(J.tiempo);
      if (s !== st.ultimoSegundo) {
        st.ultimoSegundo = s;
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
      aviso(J.campana ? 'SECTOR ' + J.campana + ' · ' + (nombreOleada || '') : jefe ? '¡LLEGA UN JEFE!' : 'NIVEL ' + n, jefe ? 'peligro' : 'info');
      return;
    }
    const total = J.totalOleadas();
    $('hudOleada').textContent = J.campana ? 'SECTOR ' + J.campana + ' · OLEADA ' + n + '/' + total : 'OLEADA ' + n;
    const txt = (jefe ? '' : 'OLEADA ' + n + (total ? '/' + total : '') + ' · ') + (nombreOleada || '');
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
    K.enviarEstado();
    K.revisarTodosEliminados();
  });
  J.on('ataque', (n) => {
    if (!R.conectado) return;
    if (Sala.coop) {
      R.enviar({ t: 'ayuda', nombre: nombre() });
      aviso('¡Le mandaste un escudo a tu equipo!', 'exito');
      return;
    }
    R.enviar({ t: 'ataque', nombre: nombre(), n });
    aviso(J.tipoJuego === 'esquiva' ? '¡Estampida enviada a tus rivales!' : '¡Lluvia de meteoros enviada a tus rivales!', 'exito');
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
          $('txtFinTitulo').textContent = J.campana === GS.Sectores.total ? '¡CAMPAÑA COMPLETADA!' : '¡SECTOR COMPLETADO!';
          $('finEstrellas').textContent = estrellasTexto(est);
          if (r.nuevoDesbloqueo) toast('Desbloqueaste el sector ' + (J.campana + 1) + ': ' + GS.Sectores.get(J.campana + 1).nombre, 4000);
          if (J.campana < GS.Sectores.total) {
            $('btnOtraVez').textContent = 'Siguiente sector ▶︎';
            $('btnOtraVez').dataset.accion = 'siguiente';
            extra.textContent = 'Repetir ' + sec.nombre;
            extra.dataset.accion = 'repetir';
            extra.classList.remove('oculto');
          } else {
            $('btnOtraVez').textContent = 'Jugar Infinito';
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
      } else if (J.reto) {
        const r = GS.Reto.registrar(tipo, J.puntos);
        $('txtFinTitulo').textContent = r.nuevoMejor && r.intentos > 1 ? '¡NUEVO MEJOR DE HOY!' : 'RETO DEL DÍA';
        cont.appendChild(fila('Reto de hoy', J.reto.nombre));
        cont.appendChild(fila('Tu mejor de hoy', r.mejor.toLocaleString('es-CO') + ' (intento ' + r.intentos + ')'));
        $('btnOtraVez').textContent = 'Reintentar el reto';
        $('btnOtraVez').dataset.accion = 'reto';
        if (GS.Progreso.global.activo() && J.puntos > 0) {
          const nota = document.createElement('p');
          nota.className = 'nota';
          nota.textContent = 'Enviando tu puntaje a la tabla del día…';
          cont.appendChild(nota);
          GS.Progreso.global.enviar(GS.Reto.tipoGlobal(tipo), nombre(), J.puntos).then((ok) => {
            nota.textContent = ok ? '¡Enviado! Mira la tabla del día en Logros → Récords.' : 'No se pudo enviar a la tabla del día.';
          });
        } else {
          const nota = document.createElement('p');
          nota.className = 'nota';
          nota.textContent = 'Mañana sale un reto nuevo. Comparte tu puntaje: hoy todos juegan la misma partida.';
          cont.appendChild(nota);
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
          nota.textContent = 'Enviando tu puntaje a la tabla mundial…';
          cont.appendChild(nota);
          GS.Progreso.global.enviar(tipo, nombre(), J.puntos).then((ok) => { nota.textContent = ok ? '¡Puntaje enviado a la tabla mundial!' : 'No se pudo enviar a la tabla mundial.'; });
        }
      }
      K.mostrarRecord();
    } else {
      clearInterval(Sala.timerEstado);
      K.enviarEstado(true);
      setTimeout(() => K.enviarEstado(true), 1000);
      setTimeout(() => K.enviarEstado(true), 2500);
      $('txtFinTitulo').textContent = Sala.coop ? 'MISIÓN EN EQUIPO' : 'RESULTADOS';
      K.renderRanking();
      $('btnOtraVez').dataset.accion = R.conectado && R.esHost ? 'revancha' : 'sala';
      $('btnOtraVez').textContent = !R.conectado ? 'Multijugador' : R.esHost ? 'Revancha' : 'Volver a la sala';
      if (R.conectado && R.esHost) {
        extra.textContent = 'Volver a la sala';
        extra.dataset.accion = 'sala';
        extra.classList.remove('oculto');
      }
    }
    mostrar('pFin');
  }

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
    if (J.modo === 'online') K.salirSala();
    clearInterval(st.ivCuenta);
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
        else if (k === 'Escape' || k === 'KeyP') { if (st.pantalla === 'pPausa') reanudar(); else pausar(); }
        else return;
        ev.preventDefault();
        return;
      }
      if (k === 'ArrowLeft' || k === 'KeyA') S.tecla('izq', true);
      else if (k === 'ArrowRight' || k === 'KeyD') S.tecla('der', true);
      else if (k === 'Space') { gat.tecla = true; actualizarGatillo(); }
      else if (k === 'KeyR') S.recentrar();
      else if (k === 'Escape' || k === 'KeyP') { if (st.pantalla === 'pPausa') reanudar(); else pausar(); }
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
      else if (J.estado === 'jugando') { st.wakeLock = null; pedirWakeLock(); }
    });
  }


  Object.assign(K, { enlazarControles, estrellasTexto, fila, pausar, prepararHUD, reanudar, renderVidas, salirAlMenu });
})(window.GS);
