// ================================================================
//  SPOOKY HOUSE · motore di gioco
//  Brani e testi sono in js/contenuti.js, la casa in js/stanze.js.
// ================================================================
(() => {
  "use strict";

  const W = 1280;
  const H = 720;
  const RW = 960; // la stanza occupa la parte sinistra dello schermo
  const RH = 720;
  const VELOCITA = 250; // pixel al secondo del ragazzo
  const RAGGIO = 13; // raggio del ragazzo per gli urti con i muri
  const VEL_GUARDIANI = 135;
  const SCALA_FANTASMA = 0.3;
  const SCALA_RAGAZZO = 0.75;
  const OGGETTI_ZAINO = ["chiave-piccola", "torcia", "chiave-torre", "pallone"];

  const $ = (id) => document.getElementById(id);
  const schermo = $("schermo");
  const canvas = $("scena");
  const ctx = canvas.getContext("2d");

  // ---------------------------------------------------------------
  //  Adattamento allo schermo (PC, tablet e LIM in orizzontale)
  // ---------------------------------------------------------------
  let k = 1; // scala interna del canvas
  let scalaSchermo = 1;
  function adatta() {
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    scalaSchermo = s;
    schermo.style.transform = `scale(${s})`;
    schermo.style.left = `${(window.innerWidth - W * s) / 2}px`;
    schermo.style.top = `${(window.innerHeight - H * s) / 2}px`;
    const dpr = window.devicePixelRatio || 1;
    k = Math.max(1, Math.min(2, s * dpr));
    canvas.width = Math.round(W * k);
    canvas.height = Math.round(H * k);
  }
  window.addEventListener("resize", adatta);
  window.addEventListener("orientationchange", () => setTimeout(adatta, 300));
  adatta();

  // coordinate Scratch -> pixel della stanza
  const P = ([x, y]) => [480 + 2 * x, 360 - 2 * y];
  const caso = (a, b) => a + Math.random() * (b - a);
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

  // ---------------------------------------------------------------
  //  Immagini
  // ---------------------------------------------------------------
  const img = {};
  function carica(nome, src) {
    return new Promise((ok) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => ok(null);
      i.src = src;
      img[nome] = i;
    });
  }
  const pronte = [];
  for (const n of Object.keys(STANZE)) if (n !== "21") pronte.push(carica("stanza" + n, `assets/img/stanze/${n}.jpg?v=4`));
  img.stanza21 = img.stanza0;
  for (const n of ["copertina", "casa", "casa-fantasmi"]) pronte.push(carica(n, `assets/img/${n}.jpg?v=${n === "copertina" ? 3 : 2}`));
  for (const n of ["ragazzo-fermo", "ragazzo-passo1", "ragazzo-passo2", "ragazzo-torcia-fermo", "ragazzo-torcia-passo1", "ragazzo-torcia-passo2",
    "fantasma-sx", "fantasma-dx", "fantasma-libro-sx", "fantasma-libro-dx", "gargoyle-1", "gargoyle-2", "amici", "torcia",
    "chiave-piccola", "chiave-torre", "pallone", "armatura", "armadio"]) pronte.push(carica(n, `assets/img/${n}.png?v=4`));
  for (const pf of PIANOFORTI) pronte.push(carica("piano" + pf.stanza, `assets/img/piano-${pf.stanza}.png?v=2`));
  // ritratti e pianoforte grande: basta che siano già nella cache quando servono
  for (const c of Object.keys(COMPOSITORI)) for (const u of ["mistero", "serio", "felice", "arrabbiato"]) new Image().src = `assets/img/${c}-${u}.png?v=2`;
  for (let i = 0; i < 4; i++) new Image().src = `assets/img/pianoforte-${i}.png?v=4`;
  new Image().src = "assets/img/fine.jpg";
  new Image().src = "assets/img/pergamena.png?v=2";
  for (const s of ["blu", "carta", "legno"]) new Image().src = `assets/img/sfondo-${s}.jpg`;

  // ---------------------------------------------------------------
  //  Maschere di collisione (da js/maschere.js)
  // ---------------------------------------------------------------
  const CELLA = MASCHERE.cella;
  const GW = RW / CELLA;
  const GH = RH / CELLA;
  const maschere = {};
  function decodifica(b64) {
    const bin = atob(b64);
    const a = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return a;
  }
  function maschera(stanza, tipo) {
    const chiave = stanza + tipo;
    if (!(chiave in maschere)) {
      const d = MASCHERE.stanze[stanza];
      maschere[chiave] = d && d[tipo] ? decodifica(d[tipo]) : null;
    }
    return maschere[chiave];
  }
  // fuoriPieno: fuori dalla stanza conta come muro (ostacoli) o come vuoto (buchi)
  function pieno(m, x, y, fuoriPieno) {
    if (!m) return false;
    const cx = Math.floor(x / CELLA);
    const cy = Math.floor(y / CELLA);
    if (cx < 0 || cy < 0 || cx >= GW || cy >= GH) return fuoriPieno;
    const i = cy * GW + cx;
    return ((m[i >> 3] >> (7 - (i & 7))) & 1) === 1;
  }
  const cerchioRettangolo = (x, y, r, b, margine = 0) => {
    const nx = Math.max(b[0] - margine, Math.min(x, b[2] + margine));
    const ny = Math.max(b[1] - margine, Math.min(y, b[3] + margine));
    return (x - nx) ** 2 + (y - ny) ** 2 < r * r;
  };

  // ---------------------------------------------------------------
  //  Suoni
  // ---------------------------------------------------------------
  const NOMI_SUONI = ["passi", "caduta", "porta", "chiuso", "fantasma", "risata", "bambino", "magia", "raccogli", "giusto",
    "sbagliato", "ingranaggi", "armatura", "schiocco", "pietra", "ringhio", "calcio", "vetri",
    "cigolio1", "cigolio2", "cigolio3", "cigolio4"];
  const leggi = (c) => { try { return localStorage.getItem(c) === "1"; } catch (e) { return false; } };
  const scrivi = (c, v) => { try { localStorage.setItem(c, v ? "1" : "0"); } catch (e) { /* niente */ } };
  let mutoEffetti = leggi("sh-muto-effetti");
  let mutoAtmosfera = leggi("sh-muto-atmosfera");

  // Gli effetti passano dalla Web Audio API (più affidabile su tablet e telefoni);
  // se la pagina è aperta da file, o il browser non la supporta, si usano gli <audio>.
  let actx = null;
  let volumeEffetti = null;
  function contesto() {
    if (actx) return actx;
    try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    volumeEffetti = actx.createGain();
    volumeEffetti.gain.value = mutoEffetti ? 0 : 1;
    volumeEffetti.connect(actx.destination);
    return actx;
  }
  // su iPhone e iPad l'audio si sente anche con il tasto silenzioso attivo
  try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) { /* niente */ }

  const buffer = {};
  const suoni = {};
  const inCorso = {};
  function preparaSuoni() {
    const c = contesto();
    NOMI_SUONI.forEach((n) => {
      const file = `assets/audio/${n}.mp3`;
      const riserva = () => {
        if (suoni[n]) return;
        const a = new Audio(file);
        a.preload = "auto";
        suoni[n] = a;
      };
      if (!c || location.protocol === "file:" || !window.fetch) { riserva(); return; }
      fetch(file)
        .then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then((dati) => new Promise((ok, ko) => { const p = c.decodeAudioData(dati, ok, ko); if (p && p.then) p.then(ok, ko); }))
        .then((b) => { buffer[n] = b; })
        .catch(riserva);
    });
  }

  let audioSbloccato = false;
  // da chiamare dentro un clic o un tocco: i browser fanno partire l'audio solo così
  function sbloccaAudio() {
    const c = contesto();
    if (c && c.state !== "running") { try { c.resume(); } catch (e) { /* niente */ } }
    if (audioSbloccato) return;
    audioSbloccato = true;
    if (c) {
      // un suono muto di un istante sblocca l'audio su iPhone e iPad
      try {
        const s = c.createBufferSource();
        s.buffer = c.createBuffer(1, 1, 22050);
        s.connect(c.destination);
        s.start(0);
      } catch (e) { /* niente */ }
    }
    avviaAtmosfera();
  }
  preparaSuoni();
  ["pointerdown", "keydown", "touchend"].forEach((ev) => document.addEventListener(ev, sbloccaAudio, true));

  function suona(nome, volume = 1, velocita = 1) {
    if (mutoEffetti) return;
    if (buffer[nome] && actx) {
      try {
        if (actx.state !== "running") actx.resume();
        zittisci(nome);
        const s = actx.createBufferSource();
        s.buffer = buffer[nome];
        s.playbackRate.value = velocita;
        const v = actx.createGain();
        v.gain.value = volume;
        s.connect(v).connect(volumeEffetti);
        s.onended = () => { if (inCorso[nome] === s) delete inCorso[nome]; };
        s.start();
        inCorso[nome] = s;
      } catch (e) { /* audio non disponibile */ }
      return;
    }
    if (!suoni[nome]) {
      // il suono non è ancora pronto per la Web Audio: si usa un <audio>
      suoni[nome] = new Audio(`assets/audio/${nome}.mp3`);
    }
    const a = suoni[nome];
    try {
      a.pause();
      a.currentTime = 0;
      a.volume = volume;
      const p = a.play();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* audio non disponibile */ }
  }
  function zittisci(nome) {
    if (inCorso[nome]) { try { inCorso[nome].stop(); } catch (e) { /* niente */ } delete inCorso[nome]; }
    const a = suoni[nome];
    if (a) { a.pause(); a.currentTime = 0; }
  }

  // Passi del ragazzo: sul legno suonano un po' più cupi e ogni tanto le assi cigolano
  const PAVIMENTO_LEGNO = new Set([1, 3, 6, 8, 11, 13, 14, 15, 17, 18, 19, 20]);
  let prossimoCigolio = 0;
  let ultimoCigolio = 0;
  function passo() {
    const legno = PAVIMENTO_LEGNO.has(Number(g.stanza));
    const varia = 0.94 + Math.random() * 0.12;
    suona("passi", legno ? 0.3 : 0.25, legno ? varia * 0.88 : varia);
    if (!legno) return;
    const ora = performance.now();
    if (ora < prossimoCigolio || Math.random() > 0.3) return;
    let n;
    do n = 1 + Math.floor(Math.random() * 4); while (n === ultimoCigolio);
    ultimoCigolio = n;
    prossimoCigolio = ora + 1500 + Math.random() * 2000;
    suona("cigolio" + n, 0.16 + Math.random() * 0.08, 0.9 + Math.random() * 0.2);
  }

  // Rumori di fondo della casa: vento e un bordone grave, generati dal browser
  let volumeFondo = null;
  function avviaAtmosfera() {
    if (volumeFondo || !contesto()) return;
    volumeFondo = actx.createGain();
    volumeFondo.gain.value = 0;
    volumeFondo.connect(actx.destination);
    // vento: rumore filtrato con un filtro che si muove lentamente
    const buf = actx.createBuffer(1, actx.sampleRate * 3, actx.sampleRate);
    const d = buf.getChannelData(0);
    let ultimo = 0;
    for (let i = 0; i < d.length; i++) { ultimo = 0.97 * ultimo + 0.03 * (Math.random() * 2 - 1); d[i] = ultimo * 6; }
    const rumore = actx.createBufferSource();
    rumore.buffer = buf;
    rumore.loop = true;
    const filtro = actx.createBiquadFilter();
    filtro.type = "bandpass";
    filtro.frequency.value = 420;
    filtro.Q.value = 0.9;
    const lfo = actx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoAmp = actx.createGain();
    lfoAmp.gain.value = 260;
    lfo.connect(lfoAmp).connect(filtro.frequency);
    const vento = actx.createGain();
    vento.gain.value = 0.9;
    rumore.connect(filtro).connect(vento).connect(volumeFondo);
    // bordone: due note gravi leggermente stonate
    for (const f of [55, 82.6, 110.4]) {
      const o = actx.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      const gg = actx.createGain();
      gg.gain.value = f === 55 ? 0.22 : 0.09;
      o.connect(gg).connect(volumeFondo);
      o.start();
    }
    rumore.start();
    lfo.start();
    aggiornaAtmosfera();
  }
  function aggiornaAtmosfera() {
    if (!actx || !volumeFondo) return;
    const fuori = g.stanza === 0 || g.stanza === 21;
    const attiva = !mutoAtmosfera && (stato === "gioco" || stato === "dialogo" || stato === "intro") && !document.hidden;
    const v = attiva ? (fuori ? 0.035 : 0.06) : 0;
    try {
      if (actx.state === "suspended" && attiva) actx.resume();
      volumeFondo.gain.setTargetAtTime(v, actx.currentTime, 0.6);
    } catch (e) { /* niente */ }
  }

  function aggiornaPulsantiAudio() {
    $("btn-atmosfera").classList.toggle("spento", mutoAtmosfera);
    $("btn-atmosfera").title = mutoAtmosfera ? "Accendi i rumori di fondo" : "Spegni i rumori di fondo";
    $("btn-audio").classList.toggle("spento", mutoEffetti);
    $("btn-audio").textContent = mutoEffetti ? "🔇" : "🔊";
    $("btn-audio").title = mutoEffetti ? "Accendi gli effetti sonori" : "Spegni gli effetti sonori";
    Object.values(suoni).forEach((a) => { a.muted = mutoEffetti; });
    if (volumeEffetti) volumeEffetti.gain.value = mutoEffetti ? 0 : 1;
    if (mutoEffetti) NOMI_SUONI.forEach(zittisci);
    aggiornaAtmosfera();
  }
  $("btn-atmosfera").addEventListener("click", () => {
    sbloccaAudio();
    mutoAtmosfera = !mutoAtmosfera;
    scrivi("sh-muto-atmosfera", mutoAtmosfera);
    aggiornaPulsantiAudio();
  });
  $("btn-audio").addEventListener("click", () => {
    mutoEffetti = !mutoEffetti;
    scrivi("sh-muto-effetti", mutoEffetti);
    aggiornaPulsantiAudio();
  });
  $("btn-schermo").addEventListener("click", () => {
    const d = document;
    if (d.fullscreenElement || d.webkitFullscreenElement) {
      (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    } else {
      const el = d.documentElement;
      const f = el.requestFullscreen || el.webkitRequestFullscreen;
      if (f) f.call(el);
    }
  });
  document.addEventListener("visibilitychange", aggiornaAtmosfera);

  // ---------------------------------------------------------------
  //  Versione bilingue: l'italiano resta sempre, la traduzione va sotto
  // ---------------------------------------------------------------
  const LINGUE = { sq: "Shqip", es: "Español", zh: "中文" };
  let lingua = "";
  try { lingua = localStorage.getItem("sh-lingua") || ""; } catch (e) { /* niente */ }
  if (!LINGUE[lingua] || typeof TRADUZIONI === "undefined") lingua = "";
  const riempi = (testo, val = {}) => testo.replace(/\{(\w+)\}/g, (_, c) => (c in val ? val[c] : ""));
  function tr(it, val = {}) {
    if (!lingua || !it) return "";
    const t = TRADUZIONI[lingua][it];
    if (!t) return "";
    const v = {};
    for (const c in val) v[c] = typeof val[c] === "string" ? tr(val[c]) || val[c] : val[c];
    return riempi(t, v);
  }
  function aggiungiTraduzione(el, it, val = {}) {
    const t = tr(it, val);
    if (!t) return;
    const sp = document.createElement("span");
    sp.className = "trad";
    sp.lang = lingua;
    sp.textContent = t;
    el.appendChild(sp);
  }
  // scrive in un elemento il testo italiano e, sotto, la traduzione
  function scriviTesto(el, it, val = {}) {
    el.textContent = riempi(it, val);
    aggiungiTraduzione(el, it, val);
  }
  function scriviPulsante(el, prima, it) {
    el.textContent = prima + it;
    aggiungiTraduzione(el, it);
  }
  function impostaLingua(l) {
    lingua = LINGUE[l] ? l : "";
    try { localStorage.setItem("sh-lingua", lingua); } catch (e) { /* niente */ }
    document.querySelectorAll("#scelta-lingua button").forEach((b) => b.classList.toggle("scelta", b.dataset.lingua === lingua));
    scriviTesto($("trama-1"), "Un gioco per riconoscere la musica di Bach, Vivaldi, Mozart e Beethoven.");
    scriviTesto($("nota-comandi"), "Si cammina con le frecce o W A S D, oppure tenendo premuto il dito (o il mouse) dove si vuole andare.");
    scriviPulsante($("btn-inizia"), "▶ ", "INIZIA");
    scriviPulsante($("btn-rigioca"), "↻ ", "GIOCA ANCORA");
    for (const [id, it] of [["et-pianoforti", "Pianoforti suonati"], ["et-punti", "Brani riconosciuti"], ["et-zaino", "Nello zaino"]]) scriviTesto($(id), it);
    if (stato === "gioco") aggiornaPannello();
  }
  document.querySelectorAll("#scelta-lingua button").forEach((b) => b.addEventListener("click", () => impostaLingua(b.dataset.lingua)));

  // ---------------------------------------------------------------
  //  Stato della partita
  // ---------------------------------------------------------------
  let stato = "titolo"; // titolo | intro | gioco | dialogo | piano | finale
  const g = {};
  function nuovaPartita() {
    Object.assign(g, {
      stanza: 0,
      x: 0, y: 0,
      ang: 0,
      ingresso: [0, 0],
      oggetti: new Set(),
      pianiFatti: new Set(),
      risposte: FRAMMENTI.map(() => null),
      visitate: new Set(),
      eventi: new Set(),
      spaventi: 0,
      tempo: 0,
      tStanza: 0,
      armato: false,
      invuln: 0,
      caduta: 0,
      inMoto: false,
      fasePasso: 0,
      timerPassi: 0,
      fermo: 0,
      fantasma: null,
      guardiani: [],
      gargoyle: [],
      torciaCade: 0,
      armadio: 0, // 0 chiuso, 1 spostato del tutto
      armadioArmato: true,
      transizione: null,
      velo: 1,
      lampo: 0,
      scossa: 0,
      scritte: [],
      amiciPausa: 0,
      sottoLatch: false,
    });
  }
  nuovaPartita();
  const ha = (o) => g.oggetti.has(o);
  const tuttiIPianoforti = () => g.pianiFatti.size === PIANOFORTI.length;
  const punti = () => g.risposte.filter((r) => r === true).length;

  // ---------------------------------------------------------------
  //  Comandi: tastiera, mouse, dito
  // ---------------------------------------------------------------
  const tasti = new Set();
  const puntatore = { attivo: false, x: 0, y: 0, id: null };
  // dove sta il mouse (anche senza clic): il ragazzo guarda da quella parte
  const mira = { attivo: false, x: 0, y: 0 };
  window.addEventListener("keydown", (e) => {
    tasti.add(e.key.toLowerCase());
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(e.key.toLowerCase())) e.preventDefault();
    tastoPremuto(e);
  });
  window.addEventListener("keyup", (e) => tasti.delete(e.key.toLowerCase()));
  window.addEventListener("blur", () => { tasti.clear(); puntatore.attivo = false; });
  function nellaStanza(e) {
    const r = schermo.getBoundingClientRect();
    return [(e.clientX - r.left) / scalaSchermo, (e.clientY - r.top) / scalaSchermo];
  }
  canvas.addEventListener("pointerdown", (e) => {
    sbloccaAudio();
    if (stato !== "gioco") return;
    const [x, y] = nellaStanza(e);
    if (x > RW) return;
    puntatore.attivo = true;
    puntatore.id = e.pointerId;
    puntatore.x = x;
    puntatore.y = y;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* niente */ }
  });
  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerType === "mouse") {
      [mira.x, mira.y] = nellaStanza(e);
      mira.attivo = mira.x <= RW;
    }
    if (!puntatore.attivo || e.pointerId !== puntatore.id) return;
    [puntatore.x, puntatore.y] = nellaStanza(e);
  });
  const lascia = (e) => { if (e.pointerId === puntatore.id) puntatore.attivo = false; };
  canvas.addEventListener("pointerup", lascia);
  canvas.addEventListener("pointercancel", lascia);
  canvas.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") mira.attivo = false; });

  // ---------------------------------------------------------------
  //  Pensieri, banner e voci
  // ---------------------------------------------------------------
  let timerPensiero = null;
  function pensiero(chiave, opz = {}) {
    const testo = PENSIERI[chiave] || chiave;
    const el = $("pensiero");
    scriviTesto(el, testo);
    el.classList.toggle("grosso", !!opz.grosso);
    el.classList.remove("nascosto");
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "";
    clearTimeout(timerPensiero);
    const durata = opz.durata || Math.max(2.4, testo.split(" ").length * 0.33 + 1.2);
    timerPensiero = setTimeout(() => el.classList.add("nascosto"), durata * 1000);
  }
  function nascondiPensiero() {
    clearTimeout(timerPensiero);
    $("pensiero").classList.add("nascosto");
  }
  function banner(piccolo, grande) {
    const b = $("banner");
    scriviTesto($("banner-piccolo"), piccolo);
    scriviTesto($("banner-grande"), grande);
    b.classList.remove("nascosto");
    b.style.animation = "none";
    void b.offsetWidth;
    b.style.animation = "";
  }
  function scritta(testo, x, y, colore = "#fff") {
    g.scritte.push({ testo, x, y, t: 0, colore });
  }

  let dopoDialogo = null;
  let righeDialogo = [];
  function dialogo(righe, ritratti, poi) {
    stato = "dialogo";
    righeDialogo = righe.slice();
    dopoDialogo = poi;
    const r = $("dialogo-ritratti");
    r.innerHTML = "";
    for (const c of ritratti) {
      // ritratto e nome, così si ripassano i volti dei compositori
      const f = document.createElement("figure");
      const i = document.createElement("img");
      i.src = `assets/img/${c}-serio.png?v=2`;
      i.alt = COMPOSITORI[c].nomeCompleto;
      const n = document.createElement("figcaption");
      n.textContent = COMPOSITORI[c].nome;
      f.append(i, n);
      r.appendChild(f);
    }
    $("dialogo").classList.remove("nascosto");
    prossimaRiga();
    aggiornaAtmosfera();
  }
  function prossimaRiga() {
    if (!righeDialogo.length) {
      $("dialogo").classList.add("nascosto");
      stato = "gioco";
      aggiornaAtmosfera();
      const f = dopoDialogo;
      dopoDialogo = null;
      if (f) f();
      return;
    }
    scriviTesto($("dialogo-testo"), righeDialogo.shift());
    scriviPulsante($("btn-dialogo"), "", righeDialogo.length ? "Avanti" : "Iniziamo!");
  }
  $("btn-dialogo").addEventListener("click", prossimaRiga);

  // ---------------------------------------------------------------
  //  Pannello laterale
  // ---------------------------------------------------------------
  const pianofortiEl = $("pianoforti");
  PIANOFORTI.forEach(() => { const d = document.createElement("div"); d.className = "pf"; d.textContent = "♪"; pianofortiEl.appendChild(d); });
  const zainoEl = $("zaino");
  const TITOLI_ZAINO = { "chiave-piccola": "Chiave piccola", torcia: "Torcia", "chiave-torre": "Chiave della torre", pallone: "Pallone" };
  OGGETTI_ZAINO.forEach((o) => {
    const d = document.createElement("div");
    d.className = "slot";
    d.dataset.oggetto = o;
    d.title = TITOLI_ZAINO[o];
    const i = document.createElement("img");
    i.src = `assets/img/${o}.png?v=3`;
    i.alt = TITOLI_ZAINO[o];
    d.appendChild(i);
    zainoEl.appendChild(d);
  });
  function aggiornaPannello() {
    const s = STANZE[g.stanza];
    scriviTesto($("dove-piano"), PIANI[s.piano]);
    scriviTesto($("dove-stanza"), s.nome);
    [...pianofortiEl.children].forEach((d, i) => {
      const fatto = g.pianiFatti.has(PIANOFORTI[i].stanza);
      d.classList.toggle("fatto", fatto);
      d.textContent = fatto ? "🎹" : "♪";
    });
    $("n-punti").textContent = punti();
    [...zainoEl.children].forEach((d) => d.classList.toggle("preso", ha(d.dataset.oggetto)));
    $("spaventi").textContent = "👻 " + g.spaventi;
    disegnaMappa();
  }
  function aggiornaTempo() {
    const s = Math.floor(g.tempo);
    $("tempo").textContent = `⏱ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  // La mappa del piano: solo le stanze già visitate e le porte che si conoscono
  const mappa = $("mappa");
  const mctx = mappa.getContext("2d");
  function disegnaMappa() {
    const piano = STANZE[g.stanza].piano;
    const pianta = PIANTA[piano];
    mctx.clearRect(0, 0, mappa.width, mappa.height);
    if (!pianta) return;
    let maxC = 0;
    let maxR = 0;
    for (const [c, r, w, h] of Object.values(pianta)) { maxC = Math.max(maxC, c + w); maxR = Math.max(maxR, r + h); }
    let minC = Infinity;
    let minR = Infinity;
    for (const [c, r] of Object.values(pianta)) { minC = Math.min(minC, c); minR = Math.min(minR, r); }
    const cols = maxC - minC;
    const rows = maxR - minR;
    const cella = Math.min((mappa.width - 40) / cols, (mappa.height - 30) / rows, 130);
    const ox = (mappa.width - cols * cella) / 2 - minC * cella;
    const oy = (mappa.height - rows * cella) / 2 - minR * cella;
    const centro = (id) => { const [c, r, w, h] = pianta[id]; return [ox + (c + w / 2) * cella, oy + (r + h / 2) * cella]; };
    const conosciute = new Set();
    for (const id of Object.keys(pianta)) {
      if (!g.visitate.has(+id)) continue;
      conosciute.add(+id);
      for (const p of STANZE[id].porte) if (pianta[p.verso]) conosciute.add(p.verso);
    }
    // collegamenti
    mctx.lineWidth = 6;
    mctx.strokeStyle = "#4a4266";
    for (const id of Object.keys(pianta)) {
      if (!g.visitate.has(+id)) continue;
      for (const p of STANZE[id].porte) {
        if (!pianta[p.verso]) continue;
        const [x1, y1] = centro(id);
        const [x2, y2] = centro(p.verso);
        mctx.beginPath(); mctx.moveTo(x1, y1); mctx.lineTo(x2, y2); mctx.stroke();
      }
    }
    for (const id of conosciute) {
      const [c, r, w, h] = pianta[id];
      const x = ox + c * cella + 6;
      const y = oy + r * cella + 6;
      const ww = w * cella - 12;
      const hh = h * cella - 12;
      const visitata = g.visitate.has(id);
      const qui = id === g.stanza;
      mctx.save();
      mctx.beginPath();
      mctx.roundRect ? mctx.roundRect(x, y, ww, hh, 10) : mctx.rect(x, y, ww, hh);
      if (visitata) {
        mctx.fillStyle = qui ? "#4c6b62" : "#2e2942";
        if (qui) { mctx.shadowColor = "rgba(159,232,200,0.9)"; mctx.shadowBlur = 16; }
        mctx.fill();
        mctx.shadowBlur = 0;
        mctx.lineWidth = 3;
        mctx.strokeStyle = qui ? "#9fe8c8" : "#5a5080";
        mctx.stroke();
      } else {
        mctx.setLineDash([8, 6]);
        mctx.lineWidth = 3;
        mctx.strokeStyle = "#5a5080";
        mctx.stroke();
        mctx.setLineDash([]);
      }
      mctx.textAlign = "center";
      mctx.textBaseline = "middle";
      const [cx, cy] = [x + ww / 2, y + hh / 2];
      const pf = PIANOFORTI.find((p) => p.stanza === id);
      if (!visitata) {
        mctx.fillStyle = "#6e6690";
        mctx.font = "bold 34px Alegreya, serif";
        mctx.fillText("?", cx, cy);
      } else if (pf) {
        const fatto = g.pianiFatti.has(id);
        mctx.font = "34px serif";
        mctx.fillStyle = fatto ? "#f7d77a" : "#fff";
        mctx.fillText(fatto ? "🎹" : "♪", cx, cy + (qui ? -10 : 0));
      }
      if (visitata && STANZE[id].porte.some((p) => p.scale && !portaNascosta(p))) {
        mctx.font = "bold 22px sans-serif";
        mctx.fillStyle = "#b9a8e0";
        mctx.fillText("⇅", x + ww - 14, y + 16);
      }
      if (qui) {
        mctx.fillStyle = "#9fe8c8";
        mctx.beginPath();
        mctx.arc(cx, cy + (pf ? 22 : 0), 8, 0, Math.PI * 2);
        mctx.fill();
      }
      mctx.restore();
    }
  }

  // ---------------------------------------------------------------
  //  Ingresso nelle stanze
  // ---------------------------------------------------------------
  function vai(verso, arrivo) {
    if (g.transizione) return;
    suona("porta", 0.7);
    g.transizione = { fase: "buio", t: 0, verso, arrivo };
    puntatore.attivo = false;
  }
  function entra(id, arrivo) {
    const prima = g.stanza;
    g.stanza = id;
    [g.x, g.y] = P(arrivo);
    g.ingresso = [g.x, g.y];
    g.armato = false;
    g.invuln = 1.2;
    g.tStanza = 0;
    g.guardiani = [];
    g.sottoLatch = false;
    g.scritte = [];
    zittisci("fantasma");
    const f = STANZE[id].fantasma;
    g.fantasma = f ? { def: f, attivo: false, alfa: 0, i: 0, t: 0, durata: caso(...f.tempo), x: 0, y: 0, verso: 1 } : null;
    if (g.fantasma) [g.fantasma.x, g.fantasma.y] = P(f.giro[0]);
    g.gargoyle = id === 0 || id === 21 ? [
      { x: 544, y: 222, ang: -26, base: -26, img: "gargoyle-1", sveglio: false },
      { x: 544, y: 502, ang: -164, base: -164, img: "gargoyle-2", sveglio: false },
    ] : [];
    // tornando dal seminterrato l'armadio è già spostato
    if (id === 8 && prima === 18) { g.eventi.add("armadioAperto"); g.armadio = 1; }
    const nuova = !g.visitate.has(id);
    g.visitate.add(id);
    if (id !== 0 && id !== 21 && STANZE[prima].piano !== STANZE[id].piano || nuova || id === 1) {
      banner(PIANI[STANZE[id].piano], STANZE[id].nome);
    }
    // si preparano i brani del pianoforte della stanza
    const pf = PIANOFORTI.find((p) => p.stanza === id);
    if (pf && !g.pianiFatti.has(id)) pf.frammenti.forEach((n) => preparaBrano(n));
    aggiornaPannello();
    aggiornaAtmosfera();
    eventiIngresso(id, nuova);
  }
  function eventiIngresso(id, nuova) {
    if (id === 1 && !g.eventi.has("benvenuto")) {
      g.eventi.add("benvenuto");
      // il ragazzo resta fermo finché i compositori non si presentano, così il dialogo arriva subito e qui
      g.fermo = 1.6;
      setTimeout(() => { suona("porta"); g.scossa = 0.35; pensiero("portaChiusaDietro"); }, 250);
      setTimeout(() => {
        if (stato !== "gioco" || g.stanza !== 1) return;
        nascondiPensiero();
        suona("risata", 0.8);
        dialogo(BENVENUTO, ["bach", "vivaldi", "mozart", "beethoven"]);
      }, 1500);
    }
    if (id === 7) {
      if (!ha("torcia")) { suona("bambino", 0.7); setTimeout(() => pensiero("buioSenzaTorcia"), 600); }
      else if (!g.eventi.has("buioConTorcia")) { g.eventi.add("buioConTorcia"); setTimeout(() => pensiero("buioConTorcia"), 600); }
    }
    if (id === 14 && !g.eventi.has("torcia")) {
      g.eventi.add("torcia");
      g.torciaCade = 1;
      suona("caduta");
      setTimeout(() => pensiero("torciaCaduta"), 1100);
    }
    if (id === 20 && tuttiIPianoforti() && !ha("pallone")) setTimeout(() => pensiero("palloneVisto"), 500);
    if (id === 21) setTimeout(() => pensiero("Ce l'ho fatta! Ora raggiungo i miei amici."), 500);
    const pf = PIANOFORTI.find((p) => p.stanza === id);
    if (pf && nuova && !g.pianiFatti.has(id)) setTimeout(() => { if (g.stanza === id && stato === "gioco") pensiero("pianoforteVicino"); }, 1400);
  }

  // ---------------------------------------------------------------
  //  Movimento e urti
  // ---------------------------------------------------------------
  function libero(x, y) {
    const m = maschera(g.stanza, "ostacoli");
    if (pieno(m, x, y, true)) return false;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      if (pieno(m, x + Math.cos(a) * RAGGIO, y + Math.sin(a) * RAGGIO, true)) return false;
    }
    const piano = MASCHERE.stanze[g.stanza].piano;
    if (piano && cerchioRettangolo(x, y, RAGGIO, piano)) return false;
    if (g.stanza === 8 && cerchioRettangolo(x, y, RAGGIO, armadioBox())) return false;
    if (corridoioChiuso() && x > LIMITE_BUIO) return false;
    if (g.stanza === 0 || g.stanza === 21) {
      if (cerchioRettangolo(x, y, RAGGIO, amiciBox())) return false;
      for (const gr of g.gargoyle) if (dist(x, y, gr.x, gr.y) < 30 + RAGGIO) return false;
    }
    return true;
  }
  function muovi(dt) {
    let vx = 0;
    let vy = 0;
    if (tasti.has("arrowleft") || tasti.has("a")) vx -= 1;
    if (tasti.has("arrowright") || tasti.has("d")) vx += 1;
    if (tasti.has("arrowup") || tasti.has("w")) vy -= 1;
    if (tasti.has("arrowdown") || tasti.has("s")) vy += 1;
    if (puntatore.attivo) {
      const dx = puntatore.x - g.x;
      const dy = puntatore.y - g.y;
      const d = Math.hypot(dx, dy);
      if (d > 10) { vx = dx / d; vy = dy / d; }
    }
    if (g.fermo > 0) { g.fermo -= dt; vx = 0; vy = 0; }
    const l = Math.hypot(vx, vy);
    g.inMoto = false;
    const fermo = !l || g.caduta > 0 || g.transizione;
    // lo sguardo segue il mouse; senza mouse, la direzione in cui si cammina
    let guarda = null;
    if (mira.attivo && dist(mira.x, mira.y, g.x, g.y) > 4) guarda = Math.atan2(mira.y - g.y, mira.x - g.x);
    else if (!fermo) guarda = Math.atan2(vy, vx);
    if (guarda !== null) {
      const diff = Math.atan2(Math.sin(guarda - g.ang), Math.cos(guarda - g.ang));
      g.ang += diff * Math.min(1, dt * 14);
    }
    if (fermo) return;
    vx /= l;
    vy /= l;
    const dir = Math.atan2(vy, vx);
    const nx = g.x + vx * VELOCITA * dt;
    const ny = g.y + vy * VELOCITA * dt;
    const x0 = g.x;
    const y0 = g.y;
    if (libero(nx, ny)) { g.x = nx; g.y = ny; }
    else if (vx && libero(nx, g.y)) g.x = nx;
    else if (vy && libero(g.x, ny)) g.y = ny;
    else {
      // scivola lungo i muri obliqui
      const a1 = dir + 0.7;
      const a2 = dir - 0.7;
      for (const a of [a1, a2]) {
        const sx = g.x + Math.cos(a) * VELOCITA * dt * 0.7;
        const sy = g.y + Math.sin(a) * VELOCITA * dt * 0.7;
        if (libero(sx, sy)) { g.x = sx; g.y = sy; break; }
      }
    }
    g.inMoto = Math.hypot(g.x - x0, g.y - y0) > 0.3;
  }

  // ---------------------------------------------------------------
  //  Porte, oggetti, buchi, fantasmi, armature
  // ---------------------------------------------------------------
  // Nel corridoio buio senza torcia la seconda metà è nera e non ci si va: si può solo tornare indietro.
  const LIMITE_BUIO = 400;
  const corridoioChiuso = () => g.stanza === 7 && !ha("torcia");
  function controllaBuioTotale(dt) {
    g.pausaBuio = Math.max(0, (g.pausaBuio || 0) - dt);
    if (corridoioChiuso() && g.x > LIMITE_BUIO - RAGGIO - 6 && !g.pausaBuio) {
      g.pausaBuio = 4;
      suona("bambino", 0.5);
      pensiero("troppoBuio");
    }
  }
  function soddisfa(req) {
    if (req === "piano19") return g.pianiFatti.has(19);
    return ha(req);
  }
  // la porta segreta non si vede finché l'armadio non si è spostato
  const portaNascosta = (p) => p.segreta && g.armadio < 1;

  // L'armadio dello studio: con la chiave del bagno scivola lungo il muro
  // e scopre il passaggio per il seminterrato.
  const CORSA_ARMADIO = 170;
  function armadioBox() {
    const [x, y] = MASCHERE.posizioni.armadio;
    const { w, h } = MASCHERE.oggetti.armadio;
    const e = 1 - (1 - g.armadio) ** 3;
    const dy = -CORSA_ARMADIO * e;
    return [x, y + dy, x + w, y + h + dy];
  }
  function controllaArmadio(dt) {
    if (g.stanza !== 8) return;
    if (g.eventi.has("armadioAperto")) {
      if (g.armadio < 1) g.armadio = Math.min(1, g.armadio + dt / 1.8);
      return;
    }
    const vicino = cerchioRettangolo(g.x, g.y, RAGGIO, armadioBox(), 6);
    if (!vicino) { g.armadioArmato = true; return; }
    if (!g.armadioArmato) return;
    g.armadioArmato = false;
    if (!ha("chiave-piccola")) { suona("chiuso"); pensiero("armadioChiuso"); return; }
    g.eventi.add("armadioAperto");
    suona("raccogli");
    setTimeout(() => suona("pietra"), 250);
    g.scossa = 0.3;
    pensiero("passaggioSegreto");
  }
  function portaChiusa(p) {
    return (p.vietata && ha(p.vietata)) || (p.serve && !soddisfa(p.serve));
  }
  function controllaPorte() {
    const s = STANZE[g.stanza];
    const box = MASCHERE.stanze[g.stanza].porte;
    let tocca = null;
    for (const p of s.porte) {
      const b = box[p.p];
      if (b && !portaNascosta(p) && cerchioRettangolo(g.x, g.y, RAGGIO, b, 3)) { tocca = p; break; }
    }
    if (!tocca) { g.armato = true; return; }
    if (!g.armato) return;
    g.armato = false;
    if (tocca.vietata && ha(tocca.vietata)) { suona("chiuso"); pensiero("nonCiTorno"); return; }
    if (tocca.serve && !soddisfa(tocca.serve)) { suona("chiuso"); pensiero(tocca.pensiero); return; }
    vai(tocca.verso, tocca.arrivo);
  }

  function posizioneOggetto(o) {
    if (POSIZIONI_OGGETTI[o]) return P(POSIZIONI_OGGETTI[o]);
    return MASCHERE.posizioni[o];
  }
  function oggettoVisibile() {
    const o = STANZE[g.stanza].oggetto;
    if (!o || ha(o)) return null;
    if (o === "pallone" && !tuttiIPianoforti()) return null;
    if (o === "torcia" && g.torciaCade > 0) return null;
    return o;
  }
  function controllaOggetti() {
    const o = oggettoVisibile();
    if (!o) return;
    const [ox, oy] = posizioneOggetto(o);
    if (dist(g.x, g.y, ox, oy) > 36) return;
    g.oggetti.add(o);
    scritta("✦", ox, oy - 20, "#ffe08a");
    suona(o === "torcia" ? "schiocco" : "raccogli");
    setTimeout(() => suona("magia", 0.8), 150);
    if (o === "chiave-piccola") { pensiero("chiaveUtile"); setTimeout(() => suona("risata", 0.8), 900); }
    if (o === "torcia") pensiero("torciaPresa");
    if (o === "pallone") { pensiero("pallonePreso"); g.lampo = 0.6; }
    if (o === "chiave-torre") {
      pensiero("guardiani");
      setTimeout(() => { suona("ingranaggi"); setTimeout(() => suona("risata", 0.8), 400); }, 300);
      g.guardiani = STANZE[17].guardiani.map((p) => { const [x, y] = P(p); return { x, y, ritardo: 1.1, fase: Math.random() * 6 }; });
    }
    aggiornaPannello();
  }

  function controllaBuchi() {
    if (g.caduta > 0) return;
    const m = maschera(g.stanza, "buchi");
    if (!m || !pieno(m, g.x, g.y, false)) return;
    g.caduta = 1;
    puntatore.attivo = false;
    suona("caduta");
    pensiero("ahia", { grosso: true, durata: 1.6 });
  }

  function controllaPianoforte() {
    const box = MASCHERE.stanze[g.stanza].piano;
    if (!box || g.pianiFatti.has(g.stanza)) return;
    if (cerchioRettangolo(g.x, g.y, RAGGIO, box, 14)) apriPianoforte(g.stanza);
  }

  function attivoFantasma(f) {
    const q = f.def.quando;
    if (g.tStanza < 0.8) return false;
    if (q === "sempre") return true;
    if (q === "dopoPiano") return g.pianiFatti.has(g.stanza);
    if (q.dopo) return ha(q.dopo);
    if (q.sottoY !== undefined) {
      if (g.y > 360 - 2 * q.sottoY) g.sottoLatch = true;
      return g.sottoLatch;
    }
    return false;
  }
  // I fantasmi: fanno il loro giro su curve morbide, con qualche pausa; ogni tanto svaniscono
  // e ricompaiono più avanti. Se il ragazzo si avvicina lo notano (si fermano, si illuminano
  // di rosso) e lo inseguono piano per qualche secondo, poi tornano al giro.
  // Nelle stanze buie il fascio della torcia li respinge: arretrano e, se insisti, svaniscono.
  const FANTASMA = {
    vista: 150, // a che distanza notano il ragazzo
    preavviso: 0.7, // secondi fermi prima di inseguire
    inseguimento: [2.5, 3.5], // per quanti secondi inseguono
    velocitaInseguimento: 95, // il ragazzo va a 250
    riposo: 4, // secondi prima di poter notare di nuovo
    sparizione: [7, 12], // ogni quanti secondi svaniscono e ricompaiono più avanti
    fascio: { lunghezza: 230, apertura: 0.45 }, // il fascio stretto della torcia (raggio in pixel, mezzo angolo)
    respintoPerSvanire: 1.6, // secondi nel fascio prima di svanire
  };
  // punto del giro: curva che passa per i punti (Catmull-Rom), con partenza e arrivo dolci
  function puntoGiro(giro, i, t) {
    const n = giro.length;
    const q = (k) => P(giro[(i + k + n) % n]);
    const [p0, p1, p2, p3] = [q(-1), q(0), q(1), q(2)];
    const u = t * t * (3 - 2 * t);
    const c = (a, b, cc, d) => 0.5 * (2 * b + (-a + cc) * u + (2 * a - 5 * b + 4 * cc - d) * u * u + (-a + 3 * b - 3 * cc + d) * u * u * u);
    return [c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])];
  }
  function nelFascio(f, margine = 1) {
    if (!STANZE[g.stanza].buio || !ha("torcia")) return false;
    const dx = f.x - g.x;
    const dy = f.y - g.y;
    if (Math.hypot(dx, dy) > FANTASMA.fascio.lunghezza * margine) return false;
    const diff = Math.atan2(Math.sin(Math.atan2(dy, dx) - g.ang), Math.cos(Math.atan2(dy, dx) - g.ang));
    return Math.abs(diff) < FANTASMA.fascio.apertura;
  }
  function svanisci(f, lontano) {
    f.stato = "svanisce";
    f.timer = 0.5;
    f.lontano = lontano;
  }
  function aggiornaFantasma(dt) {
    const f = g.fantasma;
    if (!f) return;
    if (!f.attivo && attivoFantasma(f)) {
      f.attivo = true;
      f.stato = "giro";
      f.pausa = 0;
      f.riposo = 1.5;
      f.prossimaSparizione = caso(...FANTASMA.sparizione);
      f.scia = [];
      suona("fantasma", 0.35);
    }
    if (!f.attivo) return;
    const giro = f.def.giro;
    const x0 = f.x;
    const y0 = f.y;
    f.riposo = Math.max(0, f.riposo - dt);
    const vicino = dist(f.x, f.y, g.x, g.y) < FANTASMA.vista && g.invuln <= 0 && g.caduta <= 0;
    const verso = (tx, ty, v) => {
      const d = dist(f.x, f.y, tx, ty);
      if (d > 1) { const k = Math.min(1, (v * dt) / d); f.x += (tx - f.x) * k; f.y += (ty - f.y) * k; }
      return d;
    };
    // il fascio della torcia vince su tutto
    if (f.alfa > 0.5 && f.stato !== "svanisce" && f.stato !== "ricompare" && nelFascio(f)) {
      if (f.stato !== "respinto") { f.stato = "respinto"; f.timer = 0; }
    }
    switch (f.stato) {
      case "giro": {
        f.alfa = Math.min(1, f.alfa + dt * 1.5);
        if (f.pausa > 0) f.pausa -= dt;
        else {
          f.t += dt;
          if (f.t >= f.durata) {
            f.t = 0;
            f.i = (f.i + 1) % giro.length;
            f.durata = caso(...f.def.tempo) * 1.15;
            if (Math.random() < 0.35) f.pausa = caso(0.4, 0.9);
          }
        }
        [f.x, f.y] = puntoGiro(giro, f.i, f.t / f.durata);
        f.prossimaSparizione -= dt;
        if (vicino && !f.riposo) { f.stato = "nota"; f.timer = FANTASMA.preavviso; suona("fantasma", 0.5); }
        else if (f.prossimaSparizione <= 0) svanisci(f, false);
        break;
      }
      case "nota":
        f.timer -= dt;
        if (g.x !== f.x) f.verso = g.x > f.x ? 1 : -1;
        if (f.timer <= 0) { f.stato = "insegue"; f.timer = caso(...FANTASMA.inseguimento); }
        break;
      case "insegue":
        f.timer -= dt;
        verso(g.x, g.y + 6, FANTASMA.velocitaInseguimento);
        if (f.timer <= 0) { f.stato = "torna"; f.riposo = FANTASMA.riposo; }
        break;
      case "torna": {
        f.alfa = Math.min(1, f.alfa + dt * 1.5);
        const [tx, ty] = puntoGiro(giro, f.i, f.t / f.durata);
        if (verso(tx, ty, 120) < 6) f.stato = "giro";
        break;
      }
      case "respinto": {
        f.timer += dt;
        // finché la luce lo tiene (con un po' di margine) arretra fino al bordo del fascio e lì resta;
        // se non ha più spazio (muro della stanza) o la luce insiste, svanisce
        if (!nelFascio(f, 1.35)) { f.stato = "torna"; f.riposo = FANTASMA.riposo; break; }
        const a = Math.atan2(f.y - g.y, f.x - g.x);
        if (dist(f.x, f.y, g.x, g.y) < FANTASMA.fascio.lunghezza) {
          f.x += Math.cos(a) * 75 * dt;
          f.y += Math.sin(a) * 75 * dt;
        }
        const bordo = f.x < 50 || f.x > RW - 50 || f.y < 50 || f.y > RH - 50;
        f.x = Math.max(50, Math.min(RW - 50, f.x));
        f.y = Math.max(50, Math.min(RH - 50, f.y));
        if (bordo || f.timer > FANTASMA.respintoPerSvanire) { svanisci(f, true); suona("fantasma", 0.4); }
        break;
      }
      case "svanisce":
        f.alfa = Math.max(0, f.alfa - dt * 2);
        f.timer -= dt;
        if (f.timer <= 0) {
          // ricompare più avanti nel giro (lontano dal ragazzo, se l'ha respinto la torcia)
          let migliore = (f.i + 1 + Math.floor(Math.random() * Math.max(1, giro.length - 1))) % giro.length;
          if (f.lontano) {
            let dmax = -1;
            giro.forEach((pt, k) => { const [x, y] = P(pt); const d = dist(x, y, g.x, g.y); if (d > dmax) { dmax = d; migliore = k; } });
          }
          f.i = migliore;
          f.t = 0;
          f.durata = caso(...f.def.tempo) * 1.15;
          [f.x, f.y] = puntoGiro(giro, f.i, 0);
          f.scia = [];
          f.stato = "ricompare";
          f.prossimaSparizione = caso(...FANTASMA.sparizione);
          f.riposo = FANTASMA.riposo / 2;
        }
        break;
      case "ricompare":
        f.alfa = Math.min(1, f.alfa + dt * 2);
        if (f.alfa >= 1) f.stato = "giro";
        break;
    }
    // velocità (per allungare il lenzuolo) e scia
    const vx = (f.x - x0) / Math.max(dt, 1e-3);
    const vy = (f.y - y0) / Math.max(dt, 1e-3);
    f.vel = Math.min(1, Math.hypot(vx, vy) / 200);
    if (Math.abs(vx) > 8 && f.stato !== "nota") f.verso = vx > 0 ? 1 : -1;
    f.scia.unshift([f.x, f.y]);
    if (f.scia.length > 14) f.scia.pop();
    if (f.alfa > 0.7 && g.invuln <= 0 && g.caduta <= 0 && Math.abs(f.x - g.x) < 40 && Math.abs(f.y - 6 - g.y) < 36) {
      spavento();
      f.stato = "torna";
      f.riposo = FANTASMA.riposo;
    }
  }
  function spavento() {
    g.spaventi++;
    suona("risata");
    g.scossa = 0.45;
    g.lampo = 0.8;
    scritta(PENSIERI.spavento, g.x, g.y - 40, "#e9fff5");
    [g.x, g.y] = g.ingresso;
    g.invuln = 1.8;
    g.armato = false;
    puntatore.attivo = false;
    aggiornaPannello();
  }

  function aggiornaGuardiani(dt) {
    for (const a of g.guardiani) {
      a.fase += dt * 8;
      if (a.ritardo > 0) { a.ritardo -= dt; continue; }
      const dx = g.x - a.x;
      const dy = g.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      a.x += (dx / d) * VEL_GUARDIANI * dt;
      a.y += (dy / d) * VEL_GUARDIANI * dt;
      a.ang = Math.atan2(dy, dx);
      if (d < 36 && g.invuln <= 0) {
        suona("armatura");
        setTimeout(() => suona("risata", 0.8), 250);
        g.oggetti.delete("chiave-torre");
        g.guardiani = [];
        g.scossa = 0.4;
        [g.x, g.y] = g.ingresso;
        g.invuln = 1.2;
        g.armato = false;
        puntatore.attivo = false;
        pensiero("presoDaiGuardiani");
        aggiornaPannello();
        return;
      }
    }
  }

  // gli amici occupano tutta la figura (la posizione è il centro dell'immagine)
  function amiciBox() {
    const [ax, ay] = MASCHERE.posizioni.amici;
    return [ax - 32, ay - 70, ax + 32, ay + 72];
  }
  function aggiornaFuori(dt) {
    // ogni gargoyle si sveglia solo quando gli si passa accanto, ringhia, e si riaddormenta quando ci si allontana
    for (const gr of g.gargoyle) {
      const d = dist(g.x, g.y, gr.x, gr.y);
      if (!gr.sveglio && d < 120) {
        gr.sveglio = true;
        suona("pietra", 0.7);
        setTimeout(() => suona("ringhio", 0.6), 350);
      } else if (gr.sveglio && d > 170) {
        gr.sveglio = false;
      }
      const obiettivo = gr.sveglio ? (Math.atan2(g.y - gr.y, g.x - gr.x) * 180) / Math.PI + 90 : gr.base;
      const diff = ((obiettivo - gr.ang + 540) % 360) - 180;
      gr.ang += diff * Math.min(1, dt * (gr.sveglio ? 5 : 2));
    }
    const vicino = cerchioRettangolo(g.x, g.y, RAGGIO, amiciBox(), 14);
    g.amiciPausa -= dt;
    if (g.stanza === 0 && vicino && g.amiciPausa <= 0) {
      g.amiciPausa = 4.5;
      pensiero(FRASI_AMICI[Math.floor(Math.random() * FRASI_AMICI.length)]);
    }
    if (g.stanza === 21 && vicino && !g.transizione) {
      g.transizione = { fase: "finale", t: 0 };
    }
  }

  // ---------------------------------------------------------------
  //  Ciclo principale
  // ---------------------------------------------------------------
  let ultimo = performance.now();
  let secondoPrima = -1;
  function ciclo(ora) {
    const dt = Math.min(0.05, (ora - ultimo) / 1000);
    ultimo = ora;
    aggiorna(dt);
    disegna(ora / 1000);
    requestAnimationFrame(ciclo);
  }

  function aggiorna(dt) {
    g.lampo = Math.max(0, g.lampo - dt * 2.2);
    g.scossa = Math.max(0, g.scossa - dt);
    g.scritte = g.scritte.filter((s) => (s.t += dt) < 1.4);
    aggiornaPolvere(dt);
    if (stato === "intro") { aggiornaIntro(dt); return; }
    if (stato === "gioco" || stato === "piano" || stato === "dialogo") {
      g.tempo += dt;
      if (Math.floor(g.tempo) !== secondoPrima) { secondoPrima = Math.floor(g.tempo); aggiornaTempo(); }
    }
    // transizioni fra le stanze
    const tr_ = g.transizione;
    if (tr_) {
      tr_.t += dt;
      if (tr_.fase === "buio") {
        g.velo = Math.min(1, tr_.t / 0.22);
        if (tr_.t >= 0.25) { entra(tr_.verso, tr_.arrivo); tr_.fase = "luce"; tr_.t = 0; }
      } else if (tr_.fase === "luce") {
        g.velo = Math.max(0, 1 - tr_.t / 0.3);
        if (tr_.t >= 0.3) g.transizione = null;
      } else if (tr_.fase === "finale") {
        g.velo = Math.min(1, tr_.t / 1.2);
        if (tr_.t >= 1.3) { g.transizione = null; finale(); }
      } else if (tr_.fase === "inizio") {
        g.velo = Math.max(0, 1 - tr_.t / 0.8);
        if (tr_.t >= 0.8) g.transizione = null;
      }
    }
    if (stato !== "gioco") return;
    g.tStanza += dt;
    g.invuln = Math.max(0, g.invuln - dt);
    if (g.torciaCade > 0) g.torciaCade = Math.max(0, g.torciaCade - dt / 1.1);
    if (g.caduta > 0) {
      g.caduta -= dt / 0.9;
      if (g.caduta <= 0) {
        g.caduta = 0;
        [g.x, g.y] = g.ingresso;
        g.invuln = 0.8;
        g.armato = false;
      }
      return;
    }
    if (g.transizione) return;
    muovi(dt);
    if (g.inMoto) {
      g.fasePasso += dt;
      g.timerPassi -= dt;
      if (g.timerPassi <= 0) { g.timerPassi = 0.42; passo(); }
    } else {
      g.timerPassi = 0;
    }
    controllaPorte();
    if (g.transizione) return;
    controllaArmadio(dt);
    controllaBuioTotale(dt);
    controllaOggetti();
    controllaBuchi();
    controllaPianoforte();
    aggiornaFantasma(dt);
    aggiornaGuardiani(dt);
    if (g.stanza === 0 || g.stanza === 21) aggiornaFuori(dt);
  }

  // ---------------------------------------------------------------
  //  Disegno
  // ---------------------------------------------------------------
  const vignetta = document.createElement("canvas");
  vignetta.width = RW;
  vignetta.height = RH;
  {
    const v = vignetta.getContext("2d");
    const gr = v.createRadialGradient(RW / 2, RH / 2, 220, RW / 2, RH / 2, 640);
    gr.addColorStop(0, "rgba(0,0,0,0)");
    gr.addColorStop(1, "rgba(5,2,15,0.72)");
    v.fillStyle = gr;
    v.fillRect(0, 0, RW, RH);
  }
  const buio = document.createElement("canvas");
  buio.width = RW / 2;
  buio.height = RH / 2;
  const bctx = buio.getContext("2d");

  const polvere = Array.from({ length: 28 }, () => ({ x: Math.random() * RW, y: Math.random() * RH, v: caso(4, 14), f: Math.random() * 6, r: caso(1, 2.4) }));
  function aggiornaPolvere(dt) {
    for (const p of polvere) {
      p.f += dt * 0.6;
      p.y -= p.v * dt;
      p.x += Math.sin(p.f) * 6 * dt;
      if (p.y < -5) { p.y = RH + 5; p.x = Math.random() * RW; }
    }
  }

  function disegnaImg(nome, x, y, scala = 1, ang = 0, alfa = 1, cx, cy) {
    const i = img[nome];
    if (!i || !i.complete || !i.naturalWidth) return;
    const info = MASCHERE.oggetti[nome];
    const px = cx !== undefined ? cx : info ? info.cx : i.naturalWidth / 2;
    const py = cy !== undefined ? cy : info ? info.cy : i.naturalHeight / 2;
    ctx.save();
    ctx.globalAlpha *= alfa;
    ctx.translate(x, y);
    if (ang) ctx.rotate(ang);
    ctx.scale(scala, scala);
    // le immagini possono essere in alta risoluzione: si disegnano sempre alla dimensione di js/maschere.js
    if (info) ctx.drawImage(i, -px, -py, info.w, info.h);
    else ctx.drawImage(i, -px, -py);
    ctx.restore();
  }
  function ombra(x, y, rx, ry, a = 0.35) {
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  function luce(x, y, r, colore, alfa) {
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, colore.replace("A", alfa));
    gr.addColorStop(1, colore.replace("A", 0));
    ctx.fillStyle = gr;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function disegna(t) {
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    if (stato === "titolo" || stato === "intro") { disegnaIntro(t); return; }
    if (stato === "finale") return;
    ctx.save();
    if (g.scossa > 0) ctx.translate(Math.sin(t * 70) * 7 * g.scossa, Math.cos(t * 53) * 5 * g.scossa);
    ctx.beginPath();
    ctx.rect(0, 0, RW, RH);
    ctx.clip();
    disegnaStanza(t);
    ctx.restore();
    // velo nero delle transizioni e lampo bianco degli spaventi
    if (g.velo > 0) { ctx.fillStyle = `rgba(0,0,0,${g.velo})`; ctx.fillRect(0, 0, RW, RH); }
    if (g.lampo > 0) { ctx.fillStyle = `rgba(220,255,240,${g.lampo * 0.5})`; ctx.fillRect(0, 0, RW, RH); }
  }

  function disegnaStanza(t) {
    const id = g.stanza;
    const sfondo = img["stanza" + id];
    if (sfondo && sfondo.naturalWidth) ctx.drawImage(sfondo, 0, 0, RW, RH);
    const s = STANZE[id];
    const dati = MASCHERE.stanze[id];

    // pianoforte della stanza
    if (dati.piano) {
      const [x1, y1, x2, y2] = dati.piano;
      const fatto = g.pianiFatti.has(id);
      if (!fatto) luce((x1 + x2) / 2, (y1 + y2) / 2, 120, "rgba(255,200,110,A)", 0.35 + 0.08 * Math.sin(t * 7));
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.7)";
      ctx.shadowBlur = 12;
      // l'immagine è in alta risoluzione: si disegna grande come il riquadro del pianoforte
      if (img["piano" + id] && img["piano" + id].naturalWidth) ctx.drawImage(img["piano" + id], x1, y1, x2 - x1, y2 - y1);
      ctx.restore();
      if (!fatto) {
        ctx.save();
        ctx.font = "bold 30px serif";
        ctx.textAlign = "center";
        for (let i = 0; i < 3; i++) {
          const f = (t * 0.5 + i / 3) % 1;
          ctx.globalAlpha = Math.sin(f * Math.PI);
          ctx.fillStyle = "#ffe08a";
          ctx.shadowColor = "#ffb84a";
          ctx.shadowBlur = 10;
          ctx.fillText(i % 2 ? "♫" : "♪", (x1 + x2) / 2 + Math.sin(f * 6 + i) * 22, y1 - 6 - f * 60);
        }
        ctx.restore();
      }
    }

    // oggetti
    const o = oggettoVisibile();
    if (o) {
      const [ox, oy] = posizioneOggetto(o);
      const sale = Math.sin(t * 3) * 4;
      luce(ox, oy, 60, "rgba(255,230,140,A)", 0.45 + 0.15 * Math.sin(t * 5));
      const sc = o === "pallone" ? 0.2 : 1;
      // le posizioni sono il centro dell'immagine
      const info = MASCHERE.oggetti[o];
      disegnaImg(o, ox, oy + sale, sc, o === "pallone" ? t : 0, 1, info.w / 2, info.h / 2);
    }
    if (id === 14 && g.torciaCade > 0) {
      const [ox, oy] = posizioneOggetto("torcia");
      disegnaImg("torcia", ox, oy, 1 + g.torciaCade * 1.2, g.torciaCade * 5);
    }

    // studio: l'armadio che nasconde il passaggio
    if (id === 8) disegnaArmadio();

    // fuori: amici e gargoyle
    if (id === 0 || id === 21) {
      const [ax, ay] = MASCHERE.posizioni.amici;
      ombra(ax, ay + 70, 34, 10);
      disegnaImg("amici", ax, ay, 1, 0, 1, 38, 77);
      for (const gr of g.gargoyle) {
        if (gr.sveglio) luce(gr.x, gr.y, 50, "rgba(255,40,30,A)", 0.35 + 0.15 * Math.sin(t * 9));
        disegnaImg(gr.img, gr.x, gr.y, 1, ((gr.ang - 90) * Math.PI) / 180);
      }
    }

    // armature: ferme finché la chiave è al suo posto
    if (g.stanza === 17 && !g.guardiani.length && !ha("chiave-torre")) {
      for (const p of STANZE[17].guardiani) {
        const [x, y] = P(p);
        ombra(x, y + 26, 28, 9);
        // ferme si guardano: spalle al muro, quelle in alto verso il basso e viceversa
        disegnaImg("armatura", x, y, 0.7, (y < RH / 2 ? 0 : Math.PI), 0.85);
      }
    }
    for (const a of g.guardiani) {
      ombra(a.x, a.y + 26, 28, 9);
      const passo = a.ritardo > 0 ? Math.sin(a.fase * 3) * 0.08 : Math.sin(a.fase) * 0.12;
      disegnaImg("armatura", a.x, a.y, 0.7, (a.ang || 0) + Math.PI / 2 + passo);
    }

    // il ragazzo
    disegnaRagazzo(t);

    // il fantasma (al buio si disegna sopra l'oscurità: brilla di luce propria)
    if (!s.buio) disegnaFantasma(t);

    // polvere nell'aria
    ctx.save();
    ctx.fillStyle = "rgba(230,220,255,0.35)";
    for (const p of polvere) { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();

    // buio e torcia
    if (s.buio) { disegnaBuio(t); disegnaFantasma(t); }
    ctx.drawImage(vignetta, 0, 0);

    // porte, visibili anche al buio
    disegnaPorte(t);

    // scritte che salgono
    for (const sc of g.scritte) {
      ctx.save();
      ctx.globalAlpha = 1 - sc.t / 1.4;
      ctx.font = "64px Creepster, serif";
      ctx.textAlign = "center";
      ctx.fillStyle = sc.colore;
      ctx.shadowColor = "#000";
      ctx.shadowBlur = 8;
      ctx.fillText(sc.testo, sc.x, sc.y - sc.t * 50);
      ctx.restore();
    }
  }

  function disegnaFantasma(t) {
    const f = g.fantasma;
    if (f && f.attivo && f.alfa > 0.01) {
      const libro = f.def.libro;
      const nome = (libro ? "fantasma-libro-" : "fantasma-") + (f.verso < 0 ? "sx" : "dx");
      const bob = Math.sin(t * 3.2) * 6;
      const arrabbiato = f.stato === "nota" || f.stato === "insegue";
      const respinto = f.stato === "respinto";
      // il lenzuolo si allunga quando va veloce; quando ti nota si gonfia e trema
      let sx = 1 + 0.12 * (f.vel || 0);
      let sy = 1 - 0.08 * (f.vel || 0);
      let scatto = 0;
      if (f.stato === "nota") { const k = 1 - f.timer / FANTASMA.preavviso; sx = sy = 1 + 0.15 * k; scatto = Math.sin(t * 60) * 2.5 * k; }
      const tremolio = respinto ? 0.45 + 0.35 * Math.abs(Math.sin(t * 22)) : 0.8 + 0.12 * Math.sin(t * 5);
      ombra(f.x, f.y + 40, 30 * f.alfa, 8 * f.alfa, 0.25);
      // scia leggera
      if (f.scia && f.vel > 0.15) {
        for (let k = 4; k < f.scia.length; k += 4) {
          const [px, py] = f.scia[k];
          disegnaImg(nome, px, py + bob, SCALA_FANTASMA, 0, f.alfa * 0.12 * (1 - k / f.scia.length));
        }
      }
      ctx.save();
      ctx.shadowColor = arrabbiato ? "rgba(255,60,40,0.95)" : "rgba(160,255,220,0.9)";
      ctx.shadowBlur = arrabbiato ? 34 : 24;
      ctx.translate(f.x + scatto, f.y + bob);
      ctx.scale(sx, sy);
      disegnaImg(nome, 0, 0, SCALA_FANTASMA, Math.sin(t * 2) * 0.05 + (f.vel || 0) * 0.12 * (f.verso || 1), f.alfa * tremolio);
      ctx.restore();
    }
  }

  function disegnaArmadio() {
    const [ax, ay] = armadioBox();
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.75)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetX = -6;
    ctx.shadowOffsetY = 6;
    disegnaImg("armadio", ax, ay, 1, 0, 1, 0, 0);
    ctx.restore();
  }

  function disegnaRagazzo(t) {
    // la torcia in mano solo nelle stanze buie
    const torcia = ha("torcia") && !!STANZE[g.stanza].buio;
    let nome = torcia ? "ragazzo-torcia-fermo" : "ragazzo-fermo";
    if (g.inMoto) {
      const passo = Math.floor(g.fasePasso / 0.2) % 2;
      nome = torcia ? (passo ? "ragazzo-torcia-passo2" : "ragazzo-torcia-passo1") : passo ? "ragazzo-passo2" : "ragazzo-passo1";
    }
    let scala = SCALA_RAGAZZO;
    let ang = g.ang;
    let alfa = 1;
    if (g.caduta > 0) {
      const p = 1 - g.caduta;
      scala *= Math.max(0.05, 1 - p * 1.1);
      ang += p * 8;
      alfa = 1 - p * 0.6;
    } else {
      ombra(g.x + 3, g.y + 5, 18, 14, 0.3);
    }
    if (g.invuln > 0 && g.caduta <= 0) alfa *= 0.55 + 0.45 * Math.sin(t * 30);
    disegnaImg(nome, g.x, g.y, scala, ang, alfa);
  }

  function disegnaBuio(t) {
    const torcia = ha("torcia");
    bctx.globalCompositeOperation = "source-over";
    bctx.clearRect(0, 0, buio.width, buio.height);
    bctx.fillStyle = "rgba(4,2,10,0.965)";
    bctx.fillRect(0, 0, buio.width, buio.height);
    bctx.globalCompositeOperation = "destination-out";
    const buca = (x, y, r, forza = 1) => {
      const gr = bctx.createRadialGradient(x / 2, y / 2, 0, x / 2, y / 2, r / 2);
      gr.addColorStop(0, `rgba(0,0,0,${forza})`);
      gr.addColorStop(0.6, `rgba(0,0,0,${forza * 0.8})`);
      gr.addColorStop(1, "rgba(0,0,0,0)");
      bctx.fillStyle = gr;
      bctx.fillRect(0, 0, buio.width, buio.height);
    };
    const tremola = Math.sin(t * 13) * 5 + Math.sin(t * 7.3) * 4;
    if (torcia) {
      // la luce è spostata in avanti: poca alle spalle, di più dove si guarda
      const cx = Math.cos(g.ang);
      const cy = Math.sin(g.ang);
      buca(g.x - cx * 10, g.y - cy * 10, 120 + tremola * 0.6, 0.95);
      buca(g.x + cx * 85, g.y + cy * 85, 150 + tremola, 0.95);
      buca(g.x + cx * 165, g.y + cy * 165, 115 + tremola, 0.7);
    } else {
      buca(g.x, g.y, 90 + tremola * 0.5, 0.95);
    }
    const piano = MASCHERE.stanze[g.stanza].piano;
    if (piano && !g.pianiFatti.has(g.stanza)) buca((piano[0] + piano[2]) / 2, (piano[1] + piano[3]) / 2, 170 + tremola, 0.85);
    const o = oggettoVisibile();
    if (o) { const [ox, oy] = posizioneOggetto(o); buca(ox, oy, 90, 0.8); }
    ctx.drawImage(buio, 0, 0, RW, RH);
    if (corridoioChiuso()) {
      const gr = ctx.createLinearGradient(LIMITE_BUIO - 140, 0, LIMITE_BUIO, 0);
      gr.addColorStop(0, "rgba(2,1,6,0)");
      gr.addColorStop(1, "rgba(2,1,6,1)");
      ctx.fillStyle = gr;
      ctx.fillRect(LIMITE_BUIO - 140, 0, RW - LIMITE_BUIO + 140, RH);
    }
    if (torcia) luce(g.x + Math.cos(g.ang) * 80, g.y + Math.sin(g.ang) * 80, 180, "rgba(255,170,80,A)", 0.12);
  }

  function disegnaPorte(t) {
    const s = STANZE[g.stanza];
    const box = MASCHERE.stanze[g.stanza].porte;
    for (const p of s.porte) {
      const b = box[p.p];
      if (!b || portaNascosta(p)) continue;
      const chiusa = portaChiusa(p);
      const [x1, y1, x2, y2] = b;
      const cx = (x1 + x2) / 2;
      const cy = (y1 + y2) / 2;
      const orizzontale = x2 - x1 > y2 - y1;
      ctx.save();
      const a = 0.22 + 0.1 * Math.sin(t * 3 + p.p);
      ctx.fillStyle = chiusa ? `rgba(255,70,50,${a})` : `rgba(159,232,200,${a})`;
      ctx.shadowColor = chiusa ? "rgba(255,70,50,0.9)" : "rgba(159,232,200,0.9)";
      ctx.shadowBlur = 18;
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      ctx.shadowBlur = 0;
      ctx.translate(cx, cy);
      // verso dove porta la porta: dal centro della stanza verso il muro
      let ang;
      if (orizzontale) ang = cy < RH / 2 ? -Math.PI / 2 : Math.PI / 2;
      else ang = cx < RW / 2 ? Math.PI : 0;
      if (chiusa) {
        ctx.font = "26px serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🔒", 0, 0);
      } else {
        ctx.rotate(ang);
        ctx.strokeStyle = "rgba(230,255,245,0.85)";
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        const sp = (t * 14) % 10;
        for (let i = -1; i <= 0; i++) {
          const dx = i * 12 + sp - 4;
          ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 4);
          ctx.beginPath();
          ctx.moveTo(dx - 5, -10);
          ctx.lineTo(dx + 5, 0);
          ctx.lineTo(dx - 5, 10);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  // ---------------------------------------------------------------
  //  Titolo e scena iniziale
  // ---------------------------------------------------------------
  const intro = { fase: "attesa", t: 0, quadro: "copertina", palla: null };
  function disegnaIntro(t) {
    const q = img[intro.quadro];
    if (q && q.naturalWidth) ctx.drawImage(q, 0, 0, RW, RH);
    // colonna destra: un cielo notturno con un po' di nebbia
    const gr = ctx.createLinearGradient(RW, 0, W, H);
    gr.addColorStop(0, "#15121f");
    gr.addColorStop(1, "#07060c");
    ctx.fillStyle = gr;
    ctx.fillRect(RW, 0, W - RW, H);
    ctx.save();
    ctx.globalAlpha = 0.25;
    for (let i = 0; i < 6; i++) {
      const x = RW + ((t * (8 + i * 3) + i * 70) % 380) - 30;
      luce(x, 120 + i * 100, 120, "rgba(170,150,220,A)", 0.35);
    }
    ctx.restore();
    if (intro.palla) {
      const p = intro.palla;
      const s = Math.min(1, p.t / 0.7);
      const x = 6 + (724 - 6) * s;
      const y = 714 - (714 - 440) * s - Math.sin(s * Math.PI) * 120;
      disegnaImg("pallone", x, y, 0.32 * (1 - s * 0.75), s * 12);
    }
    if (intro.quadro !== "copertina") ctx.drawImage(vignetta, 0, 0);
    if (g.lampo > 0) { ctx.fillStyle = `rgba(255,255,255,${g.lampo * 0.6})`; ctx.fillRect(0, 0, RW, RH); }
    if (g.velo > 0 && stato === "intro") { ctx.fillStyle = `rgba(0,0,0,${g.velo})`; ctx.fillRect(0, 0, W, H); }
  }
  function aggiornaIntro(dt) {
    intro.t += dt;
    if (intro.palla) {
      intro.palla.t += dt;
      if (intro.palla.t >= 0.7) {
        intro.palla = null;
        suona("vetri");
        g.lampo = 0.7;
        intro.quadro = "casa";
        intro.fase = "casa";
        intro.t = 0;
      }
    }
    if (intro.fase === "casa" && intro.t > 1.2) {
      intro.fase = "fantasmi";
      intro.quadro = "casa-fantasmi";
      intro.t = 0;
      g.lampo = 0.5;
      g.scossa = 0.3;
      suona("risata");
    }
    if (intro.fase === "fantasmi" && intro.t > 1.6) {
      intro.fase = "didascalie";
      mostraDidascalia(0);
    }
    if (intro.fase === "fine") {
      g.velo = Math.min(1, intro.t / 0.6);
      if (intro.t > 0.7) iniziaGioco();
    }
  }
  let didascaliaN = 0;
  function mostraDidascalia(n) {
    didascaliaN = n;
    const el = $("didascalia");
    if (n >= DIDASCALIE.length) {
      el.classList.add("nascosto");
      $("btn-salta").classList.add("nascosto");
      intro.fase = "fine";
      intro.t = 0;
      return;
    }
    scriviTesto(el, DIDASCALIE[n]);
    el.classList.remove("nascosto");
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "";
    $("btn-salta").classList.remove("nascosto");
  }
  $("didascalia").addEventListener("click", () => mostraDidascalia(didascaliaN + 1));
  $("btn-salta").addEventListener("click", () => mostraDidascalia(DIDASCALIE.length));

  function avvia() {
    if (stato !== "titolo") return;
    sbloccaAudio();
    stato = "intro";
    $("titolo").classList.add("nascosto");
    $("comandi").classList.remove("nascosto");
    intro.fase = "palla";
    intro.t = 0;
    intro.palla = { t: 0 };
    g.velo = 0;
    suona("calcio");
    aggiornaAtmosfera();
  }
  $("btn-inizia").addEventListener("click", avvia);
  $("btn-start").addEventListener("click", avvia);

  function iniziaGioco() {
    nuovaPartita();
    stato = "gioco";
    $("pannello").classList.remove("nascosto");
    $("didascalia").classList.add("nascosto");
    $("btn-salta").classList.add("nascosto");
    $("finale").classList.add("nascosto");
    entra(0, STANZE[0].partenza);
    g.velo = 1;
    g.transizione = { fase: "inizio", t: 0 };
    secondoPrima = -1;
    aggiornaTempo();
    aggiornaAtmosfera();
    setTimeout(() => { if (g.stanza === 0) pensiero(FRASI_AMICI[0]); }, 1200);
  }

  // ---------------------------------------------------------------
  //  Il pianoforte
  // ---------------------------------------------------------------
  // I frammenti passano anch'essi dalla Web Audio API, che il primo tocco ha già sbloccato:
  // con un <audio> alcuni browser (Safari) li fermavano appena partiti.
  // L'<audio> resta come riserva, e serve anche per riascoltarli nel finale.
  const brani = {};
  const buffer_brani = {};
  function preparaBrano(n) {
    const c = contesto();
    if (c && !buffer_brani[n] && location.protocol !== "file:" && window.fetch) {
      buffer_brani[n] = fetch(FRAMMENTI[n].file)
        .then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then((dati) => new Promise((ok, ko) => { const p = c.decodeAudioData(dati, ok, ko); if (p && p.then) p.then(ok, ko); }))
        .catch(() => null);
    }
    if (brani[n]) return brani[n];
    const a = new Audio(FRAMMENTI[n].file);
    a.preload = "auto";
    brani[n] = a;
    return a;
  }
  // stessa interfaccia di un <audio> per quello che serve qui: durata, posizione, fine e sfumatura
  function suonaBuffer(buf) {
    const c = contesto();
    if (c.state !== "running") c.resume();
    const v = c.createGain();
    v.connect(c.destination);
    const sorgente = c.createBufferSource();
    sorgente.buffer = buf;
    sorgente.connect(v);
    const t0 = c.currentTime;
    let finito = false;
    sorgente.onended = () => { finito = true; };
    sorgente.start();
    return {
      duration: buf.duration,
      get currentTime() { return Math.min(buf.duration, c.currentTime - t0); },
      get ended() { return finito; },
      sfuma(secondi) {
        v.gain.setTargetAtTime(0, c.currentTime, secondi / 4);
        setTimeout(() => { try { sorgente.stop(); } catch (e) { /* già fermo */ } }, secondi * 1000);
      },
    };
  }
  const pf = { corrente: null, parte: 0, audio: null, risposto: false, puoi: false, inizio: 0, anim: null, primo: true };

  // lo sfondo dietro al pianoforte, stanza per stanza (come nello Scratch)
  const SFONDI_PIANO = { 3: "blu", 6: "carta", 8: "blu", 9: "carta", 11: "carta", 13: "blu", 19: "legno", 20: "legno" };
  function apriPianoforte(id) {
    const def = PIANOFORTI.find((p) => p.stanza === id);
    if (!def) return;
    stato = "piano";
    puntatore.attivo = false;
    tasti.clear();
    nascondiPensiero();
    zittisci("fantasma");
    aggiornaAtmosfera();
    pf.corrente = def;
    pf.parte = 0;
    scriviTesto($("piano-stanza"), STANZE[id].nome);
    $("piano").style.setProperty("--sfondo", `url("${new URL(`assets/img/sfondo-${SFONDI_PIANO[id]}.jpg`, location.href).href}")`);
    $("piano").classList.remove("nascosto");
    preparaParte();
  }
  function preparaParte() {
    const def = pf.corrente;
    pf.risposto = false;
    pf.puoi = false;
    scriviTesto($("piano-frammento"), TESTI_PIANO.frammento, { n: pf.parte + 1 });
    [0, 1].forEach((i) => {
      const b = $("ritratto-" + i);
      const c = def.scelta[i];
      b.className = "ritratto";
      b.disabled = true;
      b.querySelector("img").src = `assets/img/${c}-mistero.png?v=2`;
      b.querySelector("img").alt = COMPOSITORI[c].nomeCompleto;
      // il nome si scopre solo dopo la risposta: il compositore va riconosciuto dal ritratto
      scriviNome(b, i, "? ? ?");
    });
    $("piano-esito").classList.add("nascosto");
    $("piano-strumento").classList.remove("nascosto");
    $("piano-img").src = "assets/img/pianoforte-0.png?v=4";
    $("piano-barra-pieno").style.width = "0";
    if (pf.primo && pf.parte === 0) scriviTesto($("piano-messaggio"), TESTI_PIANO.istruzioni);
    else $("piano-messaggio").textContent = "";
    $("btn-ascolta").classList.remove("nascosto");
    scriviPulsante($("btn-ascolta"), "▶ ", "ASCOLTA");
  }
  function ascolta() {
    if (stato !== "piano" || pf.audio) return;
    const n = pf.corrente.frammenti[pf.parte];
    const riserva = preparaBrano(n);
    pf.audio = riserva; // segnaposto finché il buffer non è pronto
    $("btn-ascolta").classList.add("nascosto");
    scriviTesto($("piano-messaggio"), "Ascolta con attenzione...");
    const parti = (a) => {
      if (stato !== "piano" || pf.audio !== riserva) return;
      if (!a) {
        a = riserva;
        a.currentTime = 0;
        a.volume = 1;
        a.muted = false;
        const p = a.play();
        if (p && p.catch) p.catch(() => {});
      }
      avviaAscolto(a);
    };
    if (buffer_brani[n]) buffer_brani[n].then((buf) => parti(buf ? suonaBuffer(buf) : null));
    else parti(null);
  }
  function avviaAscolto(a) {
    pf.audio = a;
    pf.primo = false;
    pf.inizio = performance.now();
    let fotogramma = 1;
    clearInterval(pf.anim);
    pf.anim = setInterval(() => {
      fotogramma = (fotogramma % 3) + 1;
      $("piano-img").src = `assets/img/pianoforte-${fotogramma}.png?v=4`;
      const d = a.duration || 1;
      $("piano-barra-pieno").style.width = `${Math.min(100, (a.currentTime / d) * 100)}%`;
      const secondi = (performance.now() - pf.inizio) / 1000;
      // si risponde dopo aver ascoltato almeno tre quarti del brano (o se il browser non è riuscito a farlo partire)
      const ascoltato = a.duration ? a.currentTime / a.duration : 0;
      if (!pf.puoi && (ascoltato >= QUOTA_ASCOLTO || a.ended || secondi > (a.duration || 60) + 3)) permettiRisposta();
      if (a.ended) fermaAnimazionePiano();
    }, 300);
  }
  function scriviNome(b, i, testo) {
    const nome = b.querySelector(".nome");
    nome.innerHTML = `<span class="tasto">${i + 1}</span>`;
    nome.appendChild(document.createTextNode(testo));
  }
  function permettiRisposta() {
    pf.puoi = true;
    [0, 1].forEach((i) => {
      const b = $("ritratto-" + i);
      b.disabled = false;
      b.querySelector("img").src = `assets/img/${pf.corrente.scelta[i]}-serio.png?v=2`;
    });
    scriviTesto($("piano-messaggio"), TESTI_PIANO.chi);
  }
  function fermaAnimazionePiano() {
    clearInterval(pf.anim);
    pf.anim = null;
    $("piano-img").src = "assets/img/pianoforte-0.png?v=4";
  }
  function sfumaBrano(a) {
    if (!a) return;
    if (a.sfuma) { a.sfuma(1.2); return; }
    const inizio = performance.now();
    const v0 = a.volume;
    const passo = () => {
      const s = Math.min(1, (performance.now() - inizio) / 1200);
      try { a.volume = v0 * (1 - s); } catch (e) { /* iOS */ }
      if (s < 1) requestAnimationFrame(passo); else { a.pause(); a.volume = 1; }
    };
    passo();
  }
  function scegli(i) {
    if (stato !== "piano" || !pf.puoi || pf.risposto) return;
    pf.risposto = true;
    const def = pf.corrente;
    const n = def.frammenti[pf.parte];
    const fr = FRAMMENTI[n];
    const scelto = def.scelta[i];
    const giusto = scelto === fr.autore;
    g.risposte[n] = giusto;
    sfumaBrano(pf.audio);
    pf.audio = null;
    fermaAnimazionePiano();
    [0, 1].forEach((j) => {
      const b = $("ritratto-" + j);
      const c = def.scelta[j];
      b.disabled = true;
      let umore = "serio";
      if (j === i) umore = giusto ? "felice" : "arrabbiato";
      b.querySelector("img").src = `assets/img/${c}-${umore}.png?v=2`;
      scriviNome(b, j, COMPOSITORI[c].nome.toUpperCase());
      if (j === i) b.classList.add(giusto ? "scelto-giusto" : "scelto-sbagliato");
    });
    suona(giusto ? "giusto" : "sbagliato");
    // esito con il cartiglio del brano
    const t = $("esito-titolo");
    scriviTesto(t, giusto ? TESTI_PIANO.giusto : TESTI_PIANO.sbagliato);
    t.className = giusto ? "giusto" : "sbagliato";
    const c = COMPOSITORI[fr.autore];
    const autore = $("esito-autore");
    autore.textContent = `${c.nomeCompleto}!`;
    if (!giusto) {
      autore.textContent = "";
      autore.appendChild(document.createTextNode(riempi(TESTI_PIANO.eraDi, { autore: c.nome })));
      autore.appendChild(document.createElement("br"));
      autore.appendChild(document.createTextNode(`${c.nomeCompleto}!`));
      aggiungiTraduzione(autore, TESTI_PIANO.eraDi, { autore: c.nome });
    }
    const brano = $("esito-brano");
    brano.textContent = `«${fr.titolo}»`;
    if (fr.da) { const s = document.createElement("span"); s.className = "da"; s.textContent = `da ${fr.da}`; brano.appendChild(s); }
    aggiungiTraduzione(brano, fr.titolo);
    if (fr.da) aggiungiTraduzione(brano, "da " + fr.da);
    const scheda = $("esito-scheda");
    scheda.textContent = `${c.date} · ${c.epoca}. ${c.scheda}`;
    const ts = tr(c.scheda);
    if (ts) { const sp = document.createElement("span"); sp.className = "trad"; sp.lang = lingua; sp.textContent = `${tr(c.epoca) || c.epoca}. ${ts}`; scheda.appendChild(sp); }
    scriviPulsante($("btn-avanti"), "", pf.parte === 0 ? TESTI_PIANO.avanti : TESTI_PIANO.fine);
    setTimeout(() => {
      $("piano-strumento").classList.add("nascosto");
      $("piano-esito").classList.remove("nascosto");
    }, 700);
  }
  function avantiPiano() {
    if (stato !== "piano" || !pf.risposto || $("piano-esito").classList.contains("nascosto")) return;
    if (pf.parte === 0) { pf.parte = 1; preparaParte(); return; }
    chiudiPianoforte();
  }
  function chiudiPianoforte() {
    const id = pf.corrente.stanza;
    pf.corrente.frammenti.forEach((n) => { delete buffer_brani[n]; }); // libera la memoria
    $("piano").classList.add("nascosto");
    stato = "gioco";
    g.pianiFatti.add(id);
    g.invuln = 2;
    aggiornaPannello();
    aggiornaAtmosfera();
    const f = STANZE[id].fantasma;
    if (tuttiIPianoforti()) {
      if (g.stanza === 20) { setTimeout(() => { suona("magia"); pensiero("palloneVisto"); }, 400); }
      else setTimeout(() => { suona("bambino", 0.6); pensiero("tuttiIPianoforti"); }, 400);
    } else if (f && f.quando === "dopoPiano") {
      setTimeout(() => pensiero(TESTI_PIANO.fantasmaSveglio), 300);
    }
  }
  $("btn-ascolta").addEventListener("click", ascolta);
  $("ritratto-0").addEventListener("click", () => scegli(0));
  $("ritratto-1").addEventListener("click", () => scegli(1));
  $("btn-avanti").addEventListener("click", avantiPiano);

  // ---------------------------------------------------------------
  //  Finale
  // ---------------------------------------------------------------
  let branoFinale = null;
  function finale() {
    stato = "finale";
    aggiornaAtmosfera();
    zittisci("fantasma");
    nascondiPensiero();
    $("pannello").classList.add("nascosto");
    const p = punti();
    const fin = FINALI.find((f) => p >= f.min);
    scriviTesto($("finale-titolo"), fin.titolo);
    scriviTesto($("finale-testo"), fin.testo, { p: `${p}/16` });
    const s = Math.floor(g.tempo);
    const dati = $("finale-dati");
    scriviTesto(dati, "Tempo: {t} · Spaventi: {s}", { t: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`, s: g.spaventi });
    const lista = $("finale-lista");
    lista.innerHTML = "";
    FRAMMENTI.forEach((fr, i) => {
      const li = document.createElement("li");
      const r = g.risposte[i];
      const segno = document.createElement("span");
      segno.className = "segno " + (r ? "ok" : "no");
      segno.textContent = r ? "✓" : "✗";
      const chi = document.createElement("span");
      chi.className = "chi";
      chi.textContent = COMPOSITORI[fr.autore].nome;
      const cosa = document.createElement("span");
      cosa.className = "cosa";
      cosa.textContent = fr.titolo + (fr.da ? ` (${fr.da})` : "");
      aggiungiTraduzione(cosa, fr.titolo);
      const b = document.createElement("button");
      b.textContent = "▶";
      b.title = "Riascolta";
      b.addEventListener("click", () => {
        const gia = b.classList.contains("suona");
        lista.querySelectorAll("button").forEach((x) => { x.classList.remove("suona"); x.textContent = "▶"; });
        if (branoFinale) { branoFinale.pause(); branoFinale = null; }
        if (gia) return;
        branoFinale = preparaBrano(i);
        branoFinale.currentTime = 0;
        branoFinale.volume = 1;
        const pr = branoFinale.play();
        if (pr && pr.catch) pr.catch(() => {});
        b.classList.add("suona");
        b.textContent = "■";
        branoFinale.onended = () => { b.classList.remove("suona"); b.textContent = "▶"; };
      });
      li.append(segno, chi, cosa, b);
      lista.appendChild(li);
    });
    $("finale").classList.remove("nascosto");
    suona("magia");
  }
  $("btn-rigioca").addEventListener("click", () => {
    if (branoFinale) { branoFinale.pause(); branoFinale = null; }
    iniziaGioco();
  });

  // ---------------------------------------------------------------
  //  Tastiera nelle schermate
  // ---------------------------------------------------------------
  function tastoPremuto(e) {
    const t = e.key;
    const invio = t === "Enter" || t === " ";
    if (stato === "titolo" && t === "Enter") { avvia(); return; }
    if (stato === "intro" && intro.fase === "didascalie" && invio) { mostraDidascalia(didascaliaN + 1); return; }
    if (stato === "dialogo" && invio) { prossimaRiga(); return; }
    if (stato === "piano") {
      if (t === "1") scegli(0);
      else if (t === "2") scegli(1);
      else if (invio) {
        if (!$("piano-esito").classList.contains("nascosto")) avantiPiano();
        else if (!pf.audio && !pf.risposto) ascolta();
      }
    }
  }

  // ---------------------------------------------------------------
  //  Avvio
  // ---------------------------------------------------------------
  impostaLingua(lingua);
  aggiornaPulsantiAudio();
  Promise.all(pronte).then(() => { /* tutte le immagini sono pronte */ });
  requestAnimationFrame(ciclo);

  // Scorciatoia per provare il gioco: index.html#stanza=8 parte da una stanza
  // con tutti gli oggetti (utile al docente per controllare una stanza).
  const prova = /stanza=(\d+)/.exec(location.hash);
  if (prova && STANZE[prova[1]]) {
    stato = "gioco";
    $("titolo").classList.add("nascosto");
    $("pannello").classList.remove("nascosto");
    nuovaPartita();
    if (!/vuoto/.test(location.hash)) ["chiave-piccola", "torcia", "chiave-torre"].forEach((o) => g.oggetti.add(o));
    if (/tutti/.test(location.hash)) PIANOFORTI.forEach((p) => g.pianiFatti.add(p.stanza));
    const s = +prova[1];
    const arrivo = Object.values(STANZE).flatMap((x) => x.porte).find((p) => p.verso === s);
    entra(s, arrivo ? arrivo.arrivo : STANZE[0].partenza);
    g.velo = 0;
    window.statoGioco = g; // per le prove automatiche
  }
})();
