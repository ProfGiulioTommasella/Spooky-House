// ================================================================
//  SPOOKY HOUSE · contenuti del gioco
//  Questo è il file da modificare per cambiare brani, testi e punteggi.
//  - FRAMMENTI: i 16 brani da riconoscere (file in assets/audio/frammenti/).
//  - PIANOFORTI: in quale stanza si trova ogni pianoforte, quali due
//    frammenti fa ascoltare e fra quali due compositori si sceglie.
//  Le stanze, le porte e i fantasmi stanno in js/stanze.js.
// ================================================================

// I quattro compositori: nome sul pulsante, date, città e una riga di presentazione.
const COMPOSITORI = {
  bach: {
    nome: "Bach",
    nomeCompleto: "Johann Sebastian Bach",
    date: "1685 – 1750",
    epoca: "Barocco",
    scheda: "Organista e compositore tedesco, lavorò a lungo a Lipsia. È il maestro del contrappunto: fughe, invenzioni e corali.",
  },
  vivaldi: {
    nome: "Vivaldi",
    nomeCompleto: "Antonio Vivaldi",
    date: "1678 – 1741",
    epoca: "Barocco",
    scheda: "Violinista e sacerdote veneziano, detto «il Prete rosso». Scrisse centinaia di concerti, fra cui Le Quattro Stagioni.",
  },
  mozart: {
    nome: "Mozart",
    nomeCompleto: "Wolfgang Amadeus Mozart",
    date: "1756 – 1791",
    epoca: "Classicismo",
    scheda: "Nato a Salisburgo, fu un bambino prodigio: a cinque anni già componeva. Scrisse opere, sinfonie, sonate e il Requiem.",
  },
  beethoven: {
    nome: "Beethoven",
    nomeCompleto: "Ludwig van Beethoven",
    date: "1770 – 1827",
    epoca: "Dal Classicismo al Romanticismo",
    scheda: "Nato a Bonn, visse a Vienna. Diventò sordo, ma continuò a comporre capolavori come la Quinta e la Nona Sinfonia.",
  },
};

// I 16 frammenti, nell'ordine del progetto Scratch.
const FRAMMENTI = [
  { file: "assets/audio/frammenti/01.mp3", autore: "bach", titolo: "Aria sulla quarta corda", da: "Suite per orchestra n. 3" },
  { file: "assets/audio/frammenti/02.mp3", autore: "vivaldi", titolo: "La Primavera", da: "Le Quattro Stagioni" },
  { file: "assets/audio/frammenti/03.mp3", autore: "vivaldi", titolo: "L'Inverno", da: "Le Quattro Stagioni" },
  { file: "assets/audio/frammenti/04.mp3", autore: "vivaldi", titolo: "L'Autunno", da: "Le Quattro Stagioni" },
  { file: "assets/audio/frammenti/05.mp3", autore: "bach", titolo: "Invenzione n. 4 in Re minore", da: "" },
  { file: "assets/audio/frammenti/06.mp3", autore: "vivaldi", titolo: "L'Estate", da: "Le Quattro Stagioni" },
  { file: "assets/audio/frammenti/07.mp3", autore: "bach", titolo: "Toccata e Fuga in Re minore", da: "" },
  { file: "assets/audio/frammenti/08.mp3", autore: "bach", titolo: "Suite n. 1 in Sol per violoncello", da: "" },
  { file: "assets/audio/frammenti/09.mp3", autore: "beethoven", titolo: "Inno alla gioia", da: "Sinfonia n. 9" },
  { file: "assets/audio/frammenti/10.mp3", autore: "mozart", titolo: "Eine kleine Nachtmusik", da: "" },
  { file: "assets/audio/frammenti/11.mp3", autore: "beethoven", titolo: "Sonata al chiaro di luna", da: "Sonata per pianoforte n. 14" },
  { file: "assets/audio/frammenti/12.mp3", autore: "beethoven", titolo: "Per Elisa", da: "Bagatella n. 25" },
  { file: "assets/audio/frammenti/13.mp3", autore: "mozart", titolo: "Sonata per pianoforte n. 16 in Do, K 545", da: "" },
  { file: "assets/audio/frammenti/14.mp3", autore: "mozart", titolo: "Rondò alla turca", da: "Sonata per pianoforte n. 11" },
  { file: "assets/audio/frammenti/15.mp3", autore: "mozart", titolo: "Lacrimosa", da: "Messa da Requiem" },
  { file: "assets/audio/frammenti/16.mp3", autore: "beethoven", titolo: "Sinfonia n. 5", da: "" },
];

// Gli otto pianoforti: stanza, frammenti (posizione in FRAMMENTI, contando da 0)
// e i due compositori fra cui scegliere (a sinistra e a destra).
const PIANOFORTI = [
  { stanza: 3, frammenti: [0, 1], scelta: ["vivaldi", "bach"] },
  { stanza: 6, frammenti: [2, 3], scelta: ["vivaldi", "bach"] },
  { stanza: 8, frammenti: [4, 5], scelta: ["vivaldi", "bach"] },
  { stanza: 9, frammenti: [6, 7], scelta: ["vivaldi", "bach"] },
  { stanza: 11, frammenti: [8, 9], scelta: ["mozart", "beethoven"] },
  { stanza: 13, frammenti: [10, 11], scelta: ["mozart", "beethoven"] },
  { stanza: 19, frammenti: [12, 13], scelta: ["mozart", "beethoven"] },
  { stanza: 20, frammenti: [14, 15], scelta: ["mozart", "beethoven"] },
];


// Didascalie della scena iniziale.
const DIDASCALIE = [
  "Un pomeriggio d'autunno, tu e i tuoi amici giocate a pallone davanti alla vecchia casa abbandonata.",
  "Un tiro troppo forte... e il pallone sfonda una finestra!",
  "Dicono che nella casa abitino i fantasmi di quattro grandi compositori. Qualcuno deve andare a riprenderlo...",
];

// Le voci dei fantasmi quando si entra nella casa.
const BENVENUTO = [
  "Chi osa entrare nella nostra casa?",
  "Il tuo pallone ce l'abbiamo noi. In questa casa ci sono otto pianoforti: ascolta la nostra musica e riconosci chi l'ha scritta.",
  "Solo quando avrai fatto suonare tutti i pianoforti riavrai il tuo pallone. Ma attento ai fantasmi... e ai buchi nel pavimento!",
];

// Frasi degli amici fuori dalla casa (una a caso quando ci si avvicina).
const FRASI_AMICI = [
  "Dai fifone cosa vuoi che sia, entri, trovi il pallone ed esci subito!",
  "Su che poi ho allenamento...",
  "Dai che mia mamma mi vuole a casa per le 16:00!",
  "Potevi calciarlo più piano...",
  "Dopotutto il pallone è tuo!",
  "Era meglio stare a casa a studiare musica!",
  "Dai che poi voglio tornare a casa a studiare musica!",
];

// Pensieri del protagonista.
const PENSIERI = {
  portaChiusaDietro: "La porta si è chiusa alle mie spalle! Per uscire devo trovare quel pallone...",
  uscitaChiusa: "È chiusa... devo trovare quel pallone!",
  nonCiTorno: "Ho quello che mi serve, io là non ci torno!",
  chiaveUtile: "Una chiave... può tornarmi utile!",
  buioSenzaTorcia: "Hmm... prima di proseguire sarà meglio trovare una torcia!",
  troppoBuio: "È troppo buio per andare avanti: mi serve una torcia!",
  buioConTorcia: "Non fa molta luce, ma meglio di niente. Dovrò fare attenzione!",
  serveChiave: "Serve una chiave per proseguire...",
  torciaCaduta: "È caduta una torcia dal piano superiore... qualcuno è già stato qui.",
  torciaPresa: "Una torcia! Ora posso esplorare le stanze buie.",
  cucinaChiusa: "Chiusa... forse mi è sfuggito un pianoforte...",
  ahia: "AHIA!",
  spavento: "BUUU!",
  guardiani: "Le armature si sono svegliate! Scappa!",
  presoDaiGuardiani: "Le armature mi hanno preso la chiave!",
  palloneVisto: "Il mio pallone! Finalmente!",
  pallonePreso: "Ce l'ho! Ora corro all'uscita, nell'ingresso.",
  tuttiIPianoforti: "Hai fatto suonare tutti i pianoforti! Dallo scantinato arriva un rumore...",
  armadioChiuso: "Questo armadio è strano... ha una piccola serratura. Forse si apre con una chiave.",
  passaggioSegreto: "La chiave del bagno apre l'armadio... c'è un passaggio segreto!",
  pianoforteVicino: "Un pianoforte! Avvicinati per ascoltarlo.",
};

// Messaggi del pianoforte.
const TESTI_PIANO = {
  istruzioni: "Ascolterai 2 frammenti. Poi sceglierai quale compositore li ha scritti... ma scegli con attenzione!",
  ascolta: "▶ ASCOLTA",
  frammento: "Frammento {n} di 2",
  chi: "Chi l'ha scritto?",
  attendi: "Ascolta ancora un po'...",
  giusto: "GIUSTO!",
  sbagliato: "SBAGLIATO!",
  eraDi: "Era di {autore}:",
  avanti: "Avanti",
  fine: "Torna a esplorare",
  fantasmaSveglio: "Il pianoforte tace... e il fantasma della stanza si è svegliato!",
};

// Finali, come nel progetto Scratch: dipendono dai frammenti riconosciuti (su 16).
const FINALI = [
  { min: 16, titolo: "PERFETTO!", testo: "Il tuo punteggio è {p}: perfetto, sei il nostro eroe!" },
  { min: 13, titolo: "QUASI PERFETTO!", testo: "Il tuo punteggio è {p}: bene dai, manca poco alla perfezione!" },
  { min: 9, titolo: "NON MALE!", testo: "Il tuo punteggio è {p}: non male, si può sempre fare meglio!" },
  { min: 5, titolo: "BENINO...", testo: "Il tuo punteggio è {p}: benino dai..." },
  { min: 0, titolo: "SALVO PER UN PELO!", testo: "Il tuo punteggio è {p}: potevi fare meglio!" },
];
