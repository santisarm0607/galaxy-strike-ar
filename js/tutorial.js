/* =========================================================
   GALAXY STRIKE AR — tutorial.js
   Tutorial interactivo la primera vez que juegas cada modo:
   te pide hacer cada cosa y avanza cuando la haces.
   (Durante el tutorial no pierdes vidas.)
   ========================================================= */
'use strict';

(function (GS) {
  const J = GS.Juego, U = GS.U;
  const T = (GS.Tutorial = { activo: false, tipo: null, alTerminar: null });
  let pasos = [], i = 0, contador = 0, timers = [];

  const $ = (id) => document.getElementById(id);
  const esPC = () => !(window.matchMedia && matchMedia('(pointer: coarse)').matches);
  const despues = (ms, fn) => { timers.push(setTimeout(() => { if (T.activo && J.estado !== 'menu') fn(); }, ms)); };

  T.hecho = (tipo) => { try { return localStorage.getItem('gs_tut_' + tipo) === '1'; } catch (e) { return true; } };
  T.olvidar = () => { try { localStorage.removeItem('gs_tut_ar'); localStorage.removeItem('gs_tut_esquiva'); } catch (e) { /* nada */ } };

  function pasosAR() {
    const S = GS.Sensores;
    const comoApuntar = S.modo === 'giro' ? 'Mueve el celular' : S.modo === 'tactil' ? 'Arrastra el dedo' : 'Mueve el mouse';
    const comoDisparar = S.modo === 'mouse' ? 'haz clic' : 'toca la pantalla';
    return [
      { texto: '' + comoApuntar + ' para apuntar y ' + comoDisparar + ' para dispararle al ovni.',
        entrar: () => J.tut.ovni(J.tut.yawCamara() + 0.22, 8, 0.5), tutKill: siguiente },
      { texto: 'Hay un alien escondido: sigue la flecha del borde, gira y dispárale.',
        entrar: () => J.tut.ovni(J.tut.yawCamara() + (S.modo === 'giro' ? 1.9 : 1.15) * (Math.random() < 0.5 ? -1 : 1), 9, 0.8), tutKill: siguiente },
      { texto: '¡Meteoro! No se puede destruir: ' + S.textoEsquivar().toLowerCase() + ' para esquivarlo.',
        entrar: () => despues(900, J.tut.meteoro), tutEsquivo: siguiente,
        tutGolpe: () => { mensaje('¡Te dio! Vamos otra vez: ' + S.textoEsquivar().toLowerCase() + ' hacia un lado.'); despues(1400, J.tut.meteoro); } },
      { texto: 'Dispárale a la cápsula para ganar un poder.',
        entrar: () => J.tut.capsula('escudo', 0.15, 6), tutPoder: siguiente },
      { texto: '¡Listo, piloto! Ahora sí: la invasión de verdad…', entrar: () => despues(2200, terminar) }
    ];
  }

  function pasosEsquiva() {
    const E = GS.Esquiva;
    const cam = E.camara;
    const soloManos = cam && GS.Cuerpo && GS.Cuerpo.modo === 'manos';
    const mover = soloManos ? 'mueve la mano' : cam ? 'muévete de lado o agáchate' : esPC() ? 'mouse o WASD' : 'arrastra el dedo';
    const anillo = () => { const L = E.tut.limites(); E.tut.anillo((Math.random() < 0.5 ? -1 : 1) * L.x * 0.5, (Math.random() - 0.3) * L.y); };
    const blanco = () => { const n = E.tut.nave(), L = E.tut.limites(); E.tut.dron(U.clamp(-n.x * 0.6, -L.x, L.x), U.clamp(n.y * 0.4 + 0.8, -L.y, L.y), -75); };
    const impulso = cam ? 'abre la mano' : esPC() ? 'clic o Espacio' : 'botón IMPULSO';
    return [
      { texto: 'Mueve la nave (' + mover + ') y pasa por dentro del anillo dorado.',
        entrar: anillo, tutAnillo: siguiente, tutFallo: () => despues(500, anillo) },
      { texto: '¡Esquiva a los marcianos! El círculo rojo te avisa si te van a pegar.',
        entrar: () => {
          contador = 0;
          for (let k = 0; k < 4; k++) despues(k * 1000, () => { const n = E.tut.nave(); E.tut.dron(n.x + (Math.random() - 0.5), n.y + (Math.random() - 0.5) * 0.6, -95); });
        },
        tutPaso: () => { contador++; if (contador >= 4) siguiente(); } },
      // Solo con cámara: dispararle a un marciano con la mano
      ...(cam ? [{ texto: (soloManos ? 'Haz una pistola con la mano, pon la nave frente al marciano y baja el pulgar para disparar.' : 'Haz una pistola con la mano (índice estirado, pulgar arriba), apunta al marciano y baja el pulgar para disparar.'),
        entrar: blanco, tutDisparo: siguiente, tutPaso: () => despues(300, blanco) }] : []),
      { texto: 'Usa el impulso (' + impulso + '): mientras dura, nada te hace daño.', tutImpulso: siguiente },
      { texto: 'Atraviesa la cápsula para ganar un poder.',
        entrar: () => { const n = E.tut.nave(); E.tut.capsula('iman', n.x * 0.5, n.y * 0.5); }, tutPoder: siguiente,
        tutFallo: () => despues(400, () => { const n = E.tut.nave(); E.tut.capsula('iman', n.x * 0.5, n.y * 0.5); }) },
      { texto: '¡Listo! Esquiva, junta cristales y sobrevive a la nave nodriza.', entrar: () => despues(2200, terminar) }
    ];
  }

  function mostrar() {
    const caja = $('tutorialCaja');
    caja.classList.remove('oculto');
    $('tutContador').textContent = 'TUTORIAL · ' + (i + 1) + '/' + pasos.length;
    $('tutTexto').textContent = pasos[i].texto;
    caja.classList.remove('nuevo');
    void caja.offsetWidth;
    caja.classList.add('nuevo');
  }
  function mensaje(txt) { $('tutTexto').textContent = txt; }

  function siguiente() {
    if (!T.activo) return;
    i++;
    if (i >= pasos.length) { terminar(); return; }
    GS.Sonido.esquivado();
    mostrar();
    if (pasos[i].entrar) pasos[i].entrar();
  }

  function terminar() {
    if (!T.activo) return;
    T.activo = false;
    timers.forEach(clearTimeout);
    timers = [];
    try { localStorage.setItem('gs_tut_' + T.tipo, '1'); } catch (e) { /* nada */ }
    $('tutorialCaja').classList.add('oculto');
    if (T.alTerminar) T.alTerminar(T.tipo);
  }

  T.iniciar = function (tipo) {
    T.activo = true;
    T.tipo = tipo;
    pasos = tipo === 'esquiva' ? pasosEsquiva() : pasosAR();
    i = 0;
    mostrar();
    despues(600, () => { if (pasos[0].entrar) pasos[0].entrar(); });
  };
  T.saltar = terminar;
  T.cancelar = function () {
    T.activo = false;
    timers.forEach(clearTimeout);
    timers = [];
    const caja = $('tutorialCaja');
    if (caja) caja.classList.add('oculto');
  };

  // Eventos que mandan los modos de juego
  ['tutDisparo', 'tutKill', 'tutEsquivo', 'tutGolpe', 'tutPoder', 'tutAnillo', 'tutFallo', 'tutPaso', 'tutImpulso', 'tutCristal'].forEach((ev) => {
    J.on(ev, (...args) => { if (T.activo && pasos[i] && pasos[i][ev]) pasos[i][ev](...args); });
  });
})(window.GS);
