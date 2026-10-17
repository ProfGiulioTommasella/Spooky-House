// ================================================================
//  SPOOKY HOUSE · la casa: stanze, porte e fantasmi
//  Le coordinate sono quelle di Scratch: x da -240 a 240, y da -180 a 180
//  (y verso l'alto). Il gioco le converte nei pixel della stanza (960x720).
//  Forme di ostacoli, porte e buchi sono in js/maschere.js (generato).
// ================================================================

const PIANI = {
  fuori: "Fuori dalla casa",
  terra: "Piano terra",
  primo: "Primo piano",
  torre: "Torre",
  seminterrato: "Seminterrato",
};

// Ogni porta: "p" è lo sprite Path dello Scratch (1-4) che ne dà la forma,
// "verso" la stanza in cui porta, "arrivo" dove ci si ritrova di là.
// "serve" (facoltativo) è ciò che serve per passare; "pensiero" cosa pensa
// il ragazzo se non può passare. "vietata" chiude la porta quando si ha già
// un oggetto ("nonCiTorno").
// Il fantasma: "giro" sono i punti del percorso, "tempo" i secondi (minimo e
// massimo) per andare da un punto al successivo, "quando" se compare sempre,
// solo dopo aver suonato il pianoforte della stanza, dopo aver preso un
// oggetto, o quando il ragazzo scende sotto una certa altezza.
const STANZE = {
  0: {
    nome: "Il giardino", piano: "fuori",
    porte: [{ p: 4, verso: 1, arrivo: [-172, 3] }],
    partenza: [-142, 2],
  },
  1: {
    nome: "L'ingresso", piano: "terra",
    porte: [
      { p: 1, verso: 2, arrivo: [-64, 90] },
      { p: 2, verso: 6, arrivo: [-20, -100] },
      { p: 3, verso: 9, arrivo: [-186, -86], scale: true },
      { p: 4, verso: 21, arrivo: [175, 6], serve: "pallone", pensiero: "uscitaChiusa", uscita: true },
    ],
  },
  2: {
    nome: "Il vestibolo", piano: "terra",
    porte: [
      { p: 2, verso: 1, arrivo: [-147, -127] },
      { p: 1, verso: 3, arrivo: [-149, -28] },
    ],
    fantasma: { quando: { sottoY: 40 }, giro: [[-56, -92], [79, -96], [66, -65], [-20, 39], [-98, -25]], tempo: [1.5, 2.5] },
  },
  3: {
    nome: "La sala da pranzo", piano: "terra",
    porte: [
      { p: 2, verso: 2, arrivo: [109, -66] },
      { p: 1, verso: 4, arrivo: [-170, -2] },
    ],
    fantasma: { quando: "dopoPiano", giro: [[-134, -89], [130, -89], [130, 85], [-113, 89]], tempo: [1.5, 2] },
  },
  4: {
    nome: "Il corridoio", piano: "terra",
    porte: [
      { p: 2, verso: 3, arrivo: [157, 75] },
      { p: 1, verso: 5, arrivo: [-113, -4], vietata: "chiave-piccola" },
    ],
    fantasma: { quando: "sempre", giro: [[182, 31], [-2, 31], [-41, 31], [-44, 66], [159, 66]], tempo: [0.6, 1.4] },
  },
  5: {
    nome: "Il bagno", piano: "terra",
    porte: [{ p: 2, verso: 4, arrivo: [182, -3] }],
    oggetto: "chiave-piccola",
    fantasma: { quando: { dopo: "chiave-piccola" }, giro: [[-104, -2], [35, 70], [-106, 69]], tempo: [1.2, 1.8] },
  },
  6: {
    nome: "La biblioteca", piano: "terra",
    porte: [
      { p: 1, verso: 1, arrivo: [-115, 116] },
      { p: 2, verso: 7, arrivo: [-182, 1] },
    ],
    fantasma: { quando: "dopoPiano", libro: true, giro: [[-95, -83], [143, -83], [143, 48], [-95, 48]], tempo: [1.5, 2] },
  },
  7: {
    nome: "Il corridoio buio", piano: "terra", buio: true,
    porte: [
      { p: 1, verso: 6, arrivo: [173, 14] },
      { p: 2, verso: 8, arrivo: [-176, 9], serve: "torcia", pensiero: "troppoBuio" },
    ],
  },
  8: {
    nome: "Lo studio", piano: "terra", buio: true,
    porte: [
      { p: 1, verso: 7, arrivo: [190, 2] },
      // dietro l'armadio: si apre con la chiave del bagno (vedi gioco.js, "armadio")
      { p: 2, verso: 22, arrivo: [-172, 17], serve: "armadio", segreta: true, scale: true },
    ],
    fantasma: { quando: "dopoPiano", giro: [[180, 100], [60, 100], [60, 60], [180, 60]], tempo: [1.2, 1.8] },
  },
  9: {
    nome: "Il salone", piano: "primo",
    porte: [
      { p: 1, verso: 1, arrivo: [188, 0], scale: true },
      { p: 3, verso: 10, arrivo: [-194, 68] },
    ],
    fantasma: { quando: "dopoPiano", giro: [[163, 103], [-126, -98], [-120, 98], [163, -103]], tempo: [1.5, 2] },
  },
  10: {
    nome: "Il corridoio del primo piano", piano: "primo",
    porte: [
      { p: 1, verso: 9, arrivo: [180, 108] },
      { p: 2, verso: 15, arrivo: [146, 0], scale: true },
      { p: 3, verso: 11, arrivo: [-155, 67] },
    ],
    fantasma: { quando: "sempre", giro: [[181, 69], [-180, 69], [-112, 119], [108, 119]], tempo: [1.2, 2.5] },
  },
  11: {
    nome: "Il salotto", piano: "primo",
    porte: [
      { p: 1, verso: 10, arrivo: [189, 70] },
      { p: 2, verso: 12, arrivo: [4, 106] },
      { p: 3, verso: 13, arrivo: [-181, -2] },
      { p: 4, verso: 14, arrivo: [-185, -2] },
    ],
    fantasma: { quando: "dopoPiano", giro: [[-143, 70], [-143, -95], [-15, 70]], tempo: [1.5, 2] },
  },
  12: {
    nome: "Il bagno del primo piano", piano: "primo",
    porte: [{ p: 1, verso: 11, arrivo: [-1, -92] }],
    fantasma: { quando: "sempre", giro: [[-107, -66], [56, -9], [-41, 53]], tempo: [0.8, 2] },
  },
  13: {
    nome: "La camera da letto", piano: "primo",
    porte: [{ p: 1, verso: 11, arrivo: [158, 61] }],
  },
  14: {
    nome: "La cameretta", piano: "primo",
    porte: [{ p: 1, verso: 11, arrivo: [158, -74] }],
    oggetto: "torcia",
    fantasma: { quando: "sempre", giro: [[98, -114], [-37, -63], [103, 68], [-120, 20]], tempo: [1.5, 2.2] },
  },
  15: {
    nome: "La passerella della torre", piano: "torre",
    porte: [
      { p: 1, verso: 10, arrivo: [100, 39], scale: true },
      { p: 2, verso: 16, arrivo: [-65, 111] },
    ],
  },
  16: {
    nome: "La guardiola", piano: "torre",
    porte: [
      { p: 1, verso: 15, arrivo: [-152, -111] },
      { p: 2, verso: 17, arrivo: [-179, -3], vietata: "chiave-torre" },
    ],
  },
  17: {
    nome: "La torre", piano: "torre",
    porte: [{ p: 1, verso: 16, arrivo: [104, -68] }],
    oggetto: "chiave-torre",
    // Le armature si svegliano quando si prende la chiave.
    guardiani: [[10, 105], [115, 105], [125, -105], [23, -105]],
  },
  18: {
    nome: "Il corridoio del seminterrato", piano: "seminterrato", buio: true,
    porte: [
      { p: 1, verso: 22, arrivo: [165, 103] },
      { p: 2, verso: 19, arrivo: [-175, 94] },
    ],
    fantasma: { quando: "sempre", giro: [[182, 15], [12, -47]], tempo: [1.5, 1.5] },
  },
  19: {
    nome: "La cucina", piano: "seminterrato", buio: true,
    porte: [
      { p: 3, verso: 18, arrivo: [187, -107] },
      { p: 2, verso: 20, arrivo: [-158, -77], serve: "piano19", pensiero: "cucinaChiusa" },
    ],
    fantasma: { quando: "dopoPiano", giro: [[110, -67], [110, 26], [182, 26], [182, -67]], tempo: [0.8, 2] },
  },
  20: {
    nome: "Lo scantinato", piano: "seminterrato", buio: true,
    porte: [{ p: 1, verso: 19, arrivo: [178, -103] }],
    fantasma: { quando: "dopoPiano", giro: [[-46, -94], [-46, 45], [-172, 45], [-120, -94]], tempo: [1, 2.5] },
  },
  // La stanza segreta: non c'è nel progetto Scratch, si disegna dai file Canva
  // (strumenti/estrai.py). Il pianoforte vicino al muro è solo un ostacolo.
  22: {
    nome: "La stanza del camino", piano: "seminterrato",
    porte: [
      { p: 1, verso: 8, arrivo: [170, -75], scale: true },
      { p: 2, verso: 18, arrivo: [-185, 90], serve: "chiave-torre", pensiero: "serveChiave" },
    ],
    oggetto: "pallone",
    fantasma: { quando: "sempre", giro: [[-100, -110], [100, -110], [100, 20], [-60, 40]], tempo: [1.8, 2.6] },
  },
  21: {
    nome: "Il giardino", piano: "fuori",
    porte: [],
  },
};

// Dove compaiono gli oggetti (coordinate Scratch); se manca, la posizione
// viene da js/maschere.js.
const POSIZIONI_OGGETTI = {
  pallone: [40, -90],
};

// Pianta schematica di ogni piano per la mappa a lato: [colonna, riga, larghezza, altezza].
const PIANTA = {
  terra: { 1: [1, 1, 1, 1], 2: [1, 2, 1, 1], 3: [2, 2, 1, 1], 4: [3, 2, 1, 1], 5: [4, 2, 1, 1], 6: [1, 0, 1, 1], 7: [2, 0, 1, 1], 8: [3, 0, 1, 1] },
  primo: { 9: [0, 1, 1, 1], 10: [1, 1, 1, 1], 11: [2, 1, 1, 1], 12: [2, 2, 1, 1], 13: [3, 0.5, 1, 1], 14: [3, 1.5, 1, 1] },
  torre: { 15: [1, 0, 1, 1], 16: [1, 1, 1, 1], 17: [2, 1, 1, 1] },
  seminterrato: { 22: [0, 1, 1, 1], 18: [1, 1, 1, 1], 19: [2, 1, 1, 1], 20: [3, 1, 1, 1] },
  fuori: { 0: [1, 1, 2, 1], 21: [1, 1, 2, 1] },
};
