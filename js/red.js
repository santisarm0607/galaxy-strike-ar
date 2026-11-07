/* =========================================================
   GALAXY STRIKE AR — red.js
   Multijugador en línea con salas de 4 letras.

   Dos "transportes" con la misma interfaz:
   1) PeerJS (WebRTC): conexión directa entre celulares, sin
      servidor propio. Es el que usa el juego publicado.
   2) Sala de Claude: solo para probar dentro del artefacto.

   El que crea la sala es el ANFITRIÓN: recibe los mensajes de
   todos y los reenvía a los demás.
   ========================================================= */
'use strict';

(function (GS) {
  const PREFIJO = 'galaxystrike-ar-v1-';
  const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  const R = (GS.Red = { miId: GS.U.id(10), esHost: false, codigo: null, conectado: false, transporte: null });
  const oyentes = [];
  R.alRecibir = (fn) => oyentes.push(fn);
  function entregar(msg) {
    oyentes.forEach((fn) => {
      try { fn(msg); } catch (e) { console.error(e); }
    });
  }

  function codigoAleatorio() {
    let s = '';
    for (let i = 0; i < 4; i++) s += ALFABETO[(Math.random() * ALFABETO.length) | 0];
    return s;
  }

  /* ---------------- Transporte 1: PeerJS ---------------- */
  const TPeer = {
    nombre: 'peerjs',
    peer: null,
    conns: [],
    host: null,

    disponible() {
      return typeof window.Peer === 'function' && typeof window.RTCPeerConnection === 'function';
    },

    crear(codigo) {
      return new Promise((res, rej) => {
        let abierto = false;
        const p = new window.Peer(PREFIJO + codigo, { debug: 0 });
        const to = setTimeout(() => {
          if (abierto) return;
          try { p.destroy(); } catch (e) { /* nada */ }
          rej(new Error('timeout'));
        }, 12000);
        p.on('open', () => { abierto = true; clearTimeout(to); TPeer.peer = p; res(); });
        p.on('connection', (c) => TPeer.registrar(c));
        p.on('error', (err) => {
          if (!abierto) {
            clearTimeout(to);
            try { p.destroy(); } catch (e) { /* nada */ }
            rej(err);
          } else console.warn('PeerJS:', err && err.type);
        });
        p.on('disconnected', () => {
          if (TPeer.peer === p && !p.destroyed) { try { p.reconnect(); } catch (e) { /* nada */ } }
        });
      });
    },

    /** Anfitrión: nueva conexión de un jugador. */
    registrar(c) {
      c.on('open', () => { if (!TPeer.conns.includes(c)) TPeer.conns.push(c); });
      c.on('data', (d) => {
        if (!d || typeof d !== 'object') return;
        if (c.metadata && c.metadata.id) d.de = String(c.metadata.id);
        TPeer.conns.forEach((o) => {
          if (o !== c && o.open) { try { o.send(d); } catch (e) { /* nada */ } }
        });
        entregar(d);
      });
      const cerrar = () => {
        if (!TPeer.conns.includes(c)) return;
        TPeer.conns = TPeer.conns.filter((o) => o !== c);
        const id = c.metadata && c.metadata.id;
        if (!id) return;
        TPeer.conns.forEach((o) => { if (o.open) { try { o.send({ t: 'adios', de: String(id) }); } catch (e) { /* nada */ } } });
        entregar({ t: '_salio', de: String(id) });
      };
      c.on('close', cerrar);
      c.on('error', cerrar);
    },

    unirse(codigo) {
      return new Promise((res, rej) => {
        let listo = false;
        const p = new window.Peer({ debug: 0 });
        const fallar = (e) => {
          if (listo) return;
          listo = true;
          clearTimeout(to);
          try { p.destroy(); } catch (x) { /* nada */ }
          rej(e);
        };
        const to = setTimeout(() => fallar(new Error('noexiste')), 12000);
        p.on('open', () => {
          const c = p.connect(PREFIJO + codigo, { reliable: true, metadata: { id: R.miId } });
          c.on('open', () => {
            if (listo) return;
            listo = true;
            clearTimeout(to);
            TPeer.peer = p;
            TPeer.host = c;
            res();
          });
          c.on('data', (d) => { if (d && typeof d === 'object') entregar(d); });
          c.on('close', () => {
            if (TPeer.host === c) { TPeer.host = null; entregar({ t: '_hostPerdido' }); }
          });
        });
        p.on('error', (err) => {
          if (!listo) fallar(err && err.type === 'peer-unavailable' ? new Error('noexiste') : err);
          else console.warn('PeerJS:', err && err.type);
        });
      });
    },

    enviar(msg) {
      if (TPeer.host) {
        if (TPeer.host.open) TPeer.host.send(msg);
      } else {
        TPeer.conns.forEach((c) => { if (c.open) { try { c.send(msg); } catch (e) { /* nada */ } } });
      }
    },

    salir() {
      const p = TPeer.peer;
      TPeer.peer = null;
      TPeer.host = null;
      TPeer.conns = [];
      if (p) { try { p.destroy(); } catch (e) { /* nada */ } }
    }
  };

  /* ---------------- Transporte 2: sala de Claude (artefacto) ---------------- */
  const TSala = {
    nombre: 'sala',
    room: null,
    sala: null,
    quitar: [],
    peerAId: {},

    async preparar() {
      if (!window.claude || typeof window.claude.use !== 'function') return false;
      try { TSala.room = await window.claude.use('room'); } catch (e) { TSala.room = null; }
      return !!TSala.room;
    },

    async entrar(codigo) {
      TSala.sala = await TSala.room.join('gstrike-' + codigo.toLowerCase());
      TSala.quitar.push(
        TSala.sala.on('gs', (m) => {
          if (!m || m.sameTab || !m.data || typeof m.data !== 'object') return;
          if (typeof m.data.de === 'string') TSala.peerAId[m.peer] = m.data.de;
          entregar(m.data);
        })
      );
      TSala.quitar.push(
        TSala.sala.onPeers((cambio) => {
          (cambio.left || []).forEach((p) => {
            const id = TSala.peerAId[p.peer];
            if (!id) return;
            delete TSala.peerAId[p.peer];
            entregar({ t: '_salio', de: id });
          });
        })
      );
    },

    crear(codigo) { return TSala.entrar(codigo); },
    unirse(codigo) { return TSala.entrar(codigo); },

    enviar(msg) {
      if (TSala.sala) TSala.sala.emit('gs', msg).catch((e) => console.warn('sala:', e && e.code));
    },

    salir() {
      TSala.quitar.forEach((fn) => { try { fn(); } catch (e) { /* nada */ } });
      TSala.quitar = [];
      const s = TSala.sala;
      TSala.sala = null;
      TSala.peerAId = {};
      if (s) s.leave().catch(() => {});
    }
  };

  /* ---------------- Interfaz común ---------------- */
  let preparando = null;
  R.preparar = function () {
    if (!preparando) {
      preparando = (async () => {
        if (TPeer.disponible()) { R.transporte = TPeer; return true; }
        if (await TSala.preparar()) { R.transporte = TSala; return true; }
        return false;
      })();
    }
    return preparando;
  };

  R.disponible = () => !!R.transporte;

  R.crear = async function () {
    await R.preparar();
    if (!R.transporte) throw new Error('sinred');
    for (let i = 0; i < 4; i++) {
      const codigo = codigoAleatorio();
      try {
        await R.transporte.crear(codigo);
        Object.assign(R, { codigo, esHost: true, conectado: true });
        return codigo;
      } catch (e) {
        if (!(e && e.type === 'unavailable-id')) throw e; // código ocupado: probar otro
      }
    }
    throw new Error('ocupado');
  };

  R.unirse = async function (codigo) {
    await R.preparar();
    if (!R.transporte) throw new Error('sinred');
    await R.transporte.unirse(codigo);
    Object.assign(R, { codigo, esHost: false, conectado: true });
  };

  R.enviar = function (msg) {
    if (!R.conectado || !R.transporte) return;
    msg.de = R.miId;
    try { R.transporte.enviar(msg); } catch (e) { console.warn(e); }
  };

  R.salir = function () {
    if (R.transporte) { try { R.transporte.salir(); } catch (e) { /* nada */ } }
    Object.assign(R, { conectado: false, esHost: false, codigo: null });
  };
})(window.GS);
