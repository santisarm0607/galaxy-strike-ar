/* =========================================================
   GALAXY STRIKE AR — ui/menus.js
   Menús: botones de las pantallas, empezar partidas, sectores,
   reto del día, perfil (logros, récords, naves) y ajustes.
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
  const { NOMBRE_TIPO, Sala, abrirOnline, activarSensores, alternarPantallaCompleta, conSensores, crearSala, cuentaRegresiva, difundirLobby, empezarComoHost, enlazarEmojis, estrellasTexto, guardar, leer, limpiarNombre, mostrar, nombre, numero, pausar, pedirPantallaCompleta, prepararHUD, reanudar, renderSala, revisarOrientacion, salirAlMenu, salirSala, toast, unirseSala, volverASala } = K; // de los módulos que cargan antes

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
      if (st.tipoElegido === 'esquiva') K.conCamara(abrirSectores);
      else conSensores(abrirSectores);
    });
    clic('btnOnline', () => {
      guardar('gs_nombre', nombre());
      if (st.tipoElegido === 'esquiva') K.conCamara(() => abrirOnline());
      else conSensores(() => abrirOnline());
    });
    clic('modoAR', () => elegirTipo('ar'));
    clic('modoEsquiva', () => elegirTipo('esquiva'));
    clic('ctrlNormal', () => K.elegirControl('normal'));
    clic('ctrlCamara', () => K.elegirControl('camara'));
    clic('btnCamListo', () => {
      const CU = GS.Cuerpo;
      if (CU.estado === 'listo') { K.cerrarCamara(true); return; }
      const fn = st.camDespues; // reintentar
      K.cerrarCamara(false);
      K.conCamara(fn);
    });
    clic('btnCamCancelar', () => { K.elegirControl('normal'); K.cerrarCamara(true); });
    clic('camModoCuerpo', () => { GS.Cuerpo.elegirModo('cuerpo'); K.pintarModoCam(); });
    clic('camModoManos', () => { GS.Cuerpo.elegirModo('manos'); K.pintarModoCam(); });
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
      const lanzar = () => { J.modo = 'solo'; J.prepararTipo(st.tipoElegido); prepararHUD('solo'); empezarTutorial(() => salirAlMenu()); };
      if (st.tipoElegido === 'esquiva') K.conCamara(lanzar); else conSensores(lanzar);
    });
    clic('btnPerfil', () => abrirPerfil('logros'));
    clic('btnAjustes', () => { st.volverDesdeAjustes = 'pInicio'; abrirAjustes(); });
    clic('btnAjustesPausa', () => { st.volverDesdeAjustes = 'pPausa'; abrirAjustes(); });
    clic('btnAjustesListo', () => mostrar(st.volverDesdeAjustes));
    clic('btnPerfilListo', () => mostrar('pInicio'));
    clic('btnSectoresVolver', () => mostrar('pInicio'));
    clic('btnSaltarTutorial', () => GS.Tutorial.saltar());
    clic('btnTipoPartida', () => { if (!R.esHost) return; Sala.coop = !Sala.coop; difundirLobby(); renderSala(); });
    document.querySelectorAll('[data-pestana]').forEach((b) => b.addEventListener('click', () => { A.clic(); abrirPerfil(b.dataset.pestana); }));
    enlazarAjustes();
    enlazarEmojis();
    clic('btnPermitir', () => activarSensores());
    clic('btnVolverPerm', () => { st.accionPendiente = null; mostrar('pInicio'); });

    clic('btnCrear', () => crearSala());
    clic('btnUnirse', () => unirseSala());
    clic('btnVolverOnline', () => mostrar('pInicio'));
    $('inpCodigo').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4); });
    $('inpCodigo').addEventListener('keydown', (e) => { if (e.key === 'Enter') unirseSala(); });

    clic('btnEmpezar', () => empezarComoHost());
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

    clic('btnPausa', () => pausar());
    clic('btnContinuar', () => reanudar());
    clic('btnRecentrar', () => { S.recentrar(); reanudar(); toast('Mira centrada', 1200); });
    clic('btnPantalla', () => alternarPantallaCompleta());
    clic('btnPantallaPausa', () => alternarPantallaCompleta());
    clic('btnIphoneListo', () => mostrar(st.volverDesdeIphone));
    clic('btnSeguirVertical', () => { document.body.classList.add('permitir-vertical'); revisarOrientacion(); });
    clic('btnSalirJuego', () => salirAlMenu());

    const accionFin = (accion) => {
      if (accion === 'revancha') {
        if (R.conectado && R.esHost) { Sala.enPartida = false; empezarComoHost(); } else volverASala();
        return;
      }
      if (accion === 'sala') { volverASala(); return; }
      pedirPantallaCompleta();
      if (accion === 'siguiente') st.sectorElegido = Math.min(GS.Sectores.total, (J.campana || 0) + 1);
      else if (accion === 'infinito') st.sectorElegido = null;
      else if (accion === 'reto') st.sectorElegido = 'reto';
      empezarSolo();
    };
    clic('btnOtraVez', () => accionFin($('btnOtraVez').dataset.accion || 'repetir'));
    clic('btnFinExtra', () => accionFin($('btnFinExtra').dataset.accion || 'repetir'));
    clic('btnMenu', () => salirAlMenu());
  }

  function empezarSolo() {
    J.modo = 'solo';
    J.prepararTipo(st.tipoElegido);
    prepararHUD('solo');
    // La primera vez de cada modo, primero el tutorial
    if (!GS.Tutorial.hecho(st.tipoElegido)) { empezarTutorial(empezarSolo); return; }
    if (st.sectorElegido === 'reto') {
      const mod = GS.Reto.mod();
      cuentaRegresiva(() => J.iniciar({ modo: 'solo', tipo: st.tipoElegido, sector: null, reto: mod, semilla: GS.Reto.semilla(st.tipoElegido) }),
        'RETO DEL DÍA · ' + mod.nombre);
      return;
    }
    const sec = st.sectorElegido ? GS.Sectores.get(st.sectorElegido) : null;
    const pista = sec ? 'SECTOR ' + sec.id + ' · ' + sec.nombre : 'MODO INFINITO';
    cuentaRegresiva(() => J.iniciar({ modo: 'solo', tipo: st.tipoElegido, sector: st.sectorElegido, semilla: (Math.random() * 1e9) >>> 0 }), pista);
  }

  function empezarTutorial(despues) {
    GS.Tutorial.alTerminar = () => {
      GS.Tutorial.alTerminar = null;
      J.estado = 'cuenta';
      J.entidades = [];
      GS.Poderes.reiniciar();
      toast('¡Tutorial completado!', 2000);
      despues();
    };
    cuentaRegresiva(() => { J.iniciar({ modo: 'solo', tipo: st.tipoElegido, tutorial: true }); $('hudOleada').textContent = 'TUTORIAL'; }, 'TUTORIAL');
  }

  function mostrarRecord() {
    $('txtRecord').textContent = GS.Progreso.mejor(st.tipoElegido).toLocaleString('es-CO');
  }

  function elegirTipo(tipo) {
    st.tipoElegido = tipo === 'esquiva' ? 'esquiva' : 'ar';
    guardar('gs_tipo', st.tipoElegido);
    $('modoAR').classList.toggle('activo', st.tipoElegido === 'ar');
    $('modoEsquiva').classList.toggle('activo', st.tipoElegido === 'esquiva');
    $('selectorControl').classList.toggle('oculto', st.tipoElegido !== 'esquiva');
    // La cámara frontal se apaga si cambias a Disparos AR
    if (st.tipoElegido !== 'esquiva' && GS.Cuerpo.estado === 'listo') GS.Cuerpo.detener();
    K.pintarControl();
    mostrarRecord();
  }

  /* ---------------- Sectores (campaña) ---------------- */
  function abrirSectores() {
    const cont = $('listaSectores');
    cont.innerHTML = '';
    $('txtSectoresModo').textContent = NOMBRE_TIPO[st.tipoElegido] + ' · Dificultad ' + GS.Ajustes.dif().nombre;
    GS.Sectores.lista.forEach((sec) => {
      const p = GS.Progreso.sector(st.tipoElegido, sec.id);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tarjeta-sector' + (p.desbloqueado ? '' : ' bloqueada') + (p.completado ? ' completada' : '');
      b.style.setProperty('--c', sec.tema.acento);
      b.disabled = !p.desbloqueado;
      const num = document.createElement('span'); num.className = 'ts-num'; num.textContent = p.desbloqueado ? 'SECTOR ' + sec.id : 'SECTOR ' + sec.id + ' · BLOQUEADO';
      const nom = document.createElement('strong'); nom.textContent = sec.nombre;
      const lema = document.createElement('small'); lema.textContent = p.desbloqueado ? sec.lema : 'Completa el sector ' + (sec.id - 1) + ' para abrirlo';
      const est = document.createElement('span'); est.className = 'ts-estrellas'; est.textContent = estrellasTexto(p.estrellas);
      const mej = document.createElement('small'); mej.className = 'ts-mejor'; mej.textContent = p.mejor ? 'Mejor: ' + p.mejor.toLocaleString('es-CO') : (st.tipoElegido === 'esquiva' ? 'Sobrevive y vence al jefe' : '5 oleadas + jefe');
      b.append(num, nom, lema, est, mej);
      b.addEventListener('click', () => { A.iniciar(); A.clic(); st.sectorElegido = sec.id; empezarSolo(); });
      cont.appendChild(b);
    });
    // Reto del día
    const mod = GS.Reto.mod(), mejorHoy = GS.Reto.mejor(st.tipoElegido);
    const reto = document.createElement('button');
    reto.type = 'button';
    reto.className = 'tarjeta-sector reto';
    const r1 = document.createElement('span'); r1.className = 'ts-num'; r1.textContent = 'RETO DEL DÍA';
    const r2 = document.createElement('strong'); r2.textContent = mod.nombre;
    const r3 = document.createElement('small'); r3.textContent = mod.desc + ' Igual para todos hoy.';
    const r4 = document.createElement('small'); r4.className = 'ts-mejor'; r4.textContent = mejorHoy ? 'Tu mejor hoy: ' + mejorHoy.toLocaleString('es-CO') : '¡Todavía no lo juegas hoy!';
    reto.append(r1, r2, r3, r4);
    reto.addEventListener('click', () => { A.iniciar(); A.clic(); st.sectorElegido = 'reto'; empezarSolo(); });
    cont.appendChild(reto);

    const inf = document.createElement('button');
    inf.type = 'button';
    inf.className = 'tarjeta-sector infinito';
    const n1 = document.createElement('span'); n1.className = 'ts-num'; n1.textContent = 'SIN FIN';
    const n2 = document.createElement('strong'); n2.textContent = 'Infinito';
    const n3 = document.createElement('small'); n3.textContent = 'Oleadas cada vez más difíciles. ¡Bate tu récord!';
    const n4 = document.createElement('small'); n4.className = 'ts-mejor'; n4.textContent = 'Récord: ' + GS.Progreso.mejor(st.tipoElegido).toLocaleString('es-CO');
    inf.append(n1, n2, n3, n4);
    inf.addEventListener('click', () => { A.iniciar(); A.clic(); st.sectorElegido = null; empezarSolo(); });
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
      $('txtPerfilResumen').textContent = '' + hechos + ' de ' + P.LOGROS.length + ' logros';
      const grid = document.createElement('div');
      grid.className = 'grid-logros';
      P.LOGROS.forEach((l) => {
        const d = document.createElement('div');
        d.className = 'logro' + (P.logrado(l.id) ? ' hecho' : '');
        const t = document.createElement('strong'); t.textContent = l.nombre;
        const x = document.createElement('small'); x.textContent = l.desc;
        const e = document.createElement('span'); e.className = 'logro-estado'; e.textContent = P.logrado(l.id) ? '★ LOGRADO' : 'BLOQUEADO';
        d.append(e, t, x);
        grid.appendChild(d);
      });
      cont.appendChild(grid);
    } else if (pestanaPerfil === 'records') {
      $('txtPerfilResumen').textContent = 'Top 10 del modo Infinito en este dispositivo';
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
          const h2 = document.createElement('h4'); h2.textContent = 'Mundial';
          const lg = document.createElement('ol'); lg.className = 'mundial';
          const cargando = document.createElement('li'); cargando.className = 'vacio'; cargando.textContent = 'Cargando…'; lg.appendChild(cargando);
          c.append(h2, lg);
          P.global.leer(tipo).then((filas) => {
            lg.innerHTML = '';
            if (!filas || !filas.length) { const li = document.createElement('li'); li.className = 'vacio'; li.textContent = filas ? 'Sé el primero' : 'Sin conexión'; lg.appendChild(li); return; }
            filas.forEach((r) => { const li = document.createElement('li'); const a = document.createElement('span'); a.textContent = r.n; const b = document.createElement('b'); b.textContent = r.p.toLocaleString('es-CO'); li.append(a, b); lg.appendChild(li); });
          });
        }
        cols.appendChild(c);
      });
      cont.appendChild(cols);
      // Reto del día
      const mod = GS.Reto.mod();
      const hr = document.createElement('h3');
      hr.className = 'titulo-reto';
      hr.textContent = 'Reto de hoy: ' + mod.nombre;
      cont.appendChild(hr);
      const colsR = document.createElement('div');
      colsR.className = 'cols-records';
      ['ar', 'esquiva'].forEach((tipo) => {
        const c = document.createElement('div');
        c.className = 'col-record';
        const h = document.createElement('h4'); h.textContent = NOMBRE_TIPO[tipo];
        const lista = document.createElement('ol');
        const li = document.createElement('li');
        const mejor = GS.Reto.mejor(tipo);
        if (mejor) { const a = document.createElement('span'); a.textContent = 'Tu mejor hoy'; const b = document.createElement('b'); b.textContent = mejor.toLocaleString('es-CO'); li.append(a, b); }
        else { li.className = 'vacio'; li.textContent = 'Todavía no lo juegas hoy'; }
        lista.appendChild(li);
        c.append(h, lista);
        if (P.global.activo()) {
          const lg = document.createElement('ol'); lg.className = 'mundial';
          const cargando = document.createElement('li'); cargando.className = 'vacio'; cargando.textContent = 'Cargando la tabla del día…'; lg.appendChild(cargando);
          c.appendChild(lg);
          P.global.leer(GS.Reto.tipoGlobal(tipo), GS.Reto.inicioDelDia()).then((filas) => {
            lg.innerHTML = '';
            if (!filas || !filas.length) { const x = document.createElement('li'); x.className = 'vacio'; x.textContent = filas ? 'Nadie lo ha jugado hoy' : 'Sin conexión'; lg.appendChild(x); return; }
            filas.forEach((r) => { const x = document.createElement('li'); const a = document.createElement('span'); a.textContent = r.n; const b = document.createElement('b'); b.textContent = r.p.toLocaleString('es-CO'); x.append(a, b); lg.appendChild(x); });
          });
        }
        colsR.appendChild(c);
      });
      cont.appendChild(colsR);
      if (!P.global.activo()) {
        const n = document.createElement('p'); n.className = 'nota';
        n.textContent = GS.MODO_PRUEBA ? 'La tabla mundial funciona en la versión publicada (ver README).' : 'Tabla mundial: actívala con Supabase en js/config.js (ver README).';
        cont.appendChild(n);
      }
    } else {
      $('txtPerfilResumen').textContent = 'Hangar: elige el color de tu nave y de tu láser';
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
        const x = document.createElement('small'); x.textContent = ok ? (P.nave().id === n.id ? 'En uso' : 'Toca para usar') : 'Bloqueada · Logro: ' + (req ? req.nombre : '');
        b.append(muestra, t, x);
        b.addEventListener('click', () => { A.clic(); P.elegirNave(n.id); abrirPerfil('naves'); });
        grid.appendChild(b);
      });
      cont.appendChild(grid);
    }
    if (st.pantalla !== 'pPerfil') mostrar('pPerfil');
  }

  /* ---------------- Ajustes ---------------- */
  function abrirAjustes() {
    const Aj = GS.Ajustes;
    document.querySelectorAll('[data-ajuste]').forEach((g) => {
      const k = g.dataset.ajuste;
      const v = k === 'sonido' ? A.activo : k === 'camModo' ? GS.Cuerpo.modo : Aj.get(k);
      g.querySelectorAll('button[data-valor]').forEach((b) => b.classList.toggle('activo', String(v) === b.dataset.valor));
    });
    $('rngSensibilidad').value = Aj.get('sensibilidad');
    $('txtSensibilidad').textContent = Math.round(Aj.get('sensibilidad') * 100) + '%';
    const enJuego = st.volverDesdeAjustes === 'pPausa';
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
        else if (k === 'camModo') { GS.Cuerpo.elegirModo(v); K.pintarControl(); }
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
      toast('El tutorial volverá a salir en tu próxima partida.', 2600);
    });
    Aj.alCambiar((k, v) => {
      if (k === 'zurdo') document.body.classList.toggle('zurdo', !!v);
      if (k === 'calidad') { GS.Ajustes._autoBaja = false; J.redimensionar(); }
      if (k === 'musica') { if (v) GS.Musica.tocar(J.estado === 'jugando' ? undefined : 'menu'); else GS.Musica.parar(); }
    });
    document.body.classList.toggle('zurdo', !!Aj.get('zurdo'));
  }

  /* ---------------- Logros ---------------- */
  GS.Progreso.alLograr((l) => {
    A.logro();
    const naves = GS.Progreso.NAVES.filter((n) => n.requiere === l.id);
    const caja = $('logroToast');
    $('logroNombre').textContent = l.nombre;
    $('logroExtra').textContent = naves.length ? 'Nave desbloqueada: ' + naves[0].nombre : l.desc;
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


  Object.assign(K, { elegirTipo, enlazarBotones, migrarRecords, mostrarRecord });
})(window.GS);
