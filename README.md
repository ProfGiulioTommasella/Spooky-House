# Spooky House

Gioco di ascolto per riconoscere la musica di **Bach, Vivaldi, Mozart e Beethoven**,
tra Barocco e Classicismo.

> Un pomeriggio d'autunno tu e i tuoi amici giocate a pallone davanti alla vecchia casa
> abbandonata. Un tiro troppo forte e il pallone sfonda una finestra! Dicono che nella casa
> abitino i fantasmi di quattro grandi compositori...

La casa si vede dall'alto ed è divisa in 21 stanze su quattro livelli: piano terra, primo piano,
torre e seminterrato. Appena si entra la porta si chiude alle spalle e i fantasmi dei compositori
spiegano la sfida: in casa ci sono **otto pianoforti** e il pallone torna solo dopo averli fatti
suonare tutti. Ogni pianoforte fa ascoltare **due frammenti**: per ognuno si sceglie chi l'ha scritto
(Vivaldi o Bach al piano terra e nel salone, Mozart o Beethoven nelle altre stanze).
Dopo ogni risposta compare il cartiglio con il titolo del brano e una breve scheda del compositore.

Per arrivare a tutti i pianoforti bisogna:

- nella cameretta al primo piano cade una **torcia**: senza, le stanze buie non si attraversano;
- trovare la **chiave piccola** nel bagno: apre l'armadio dello studio, che nasconde il
  passaggio per la **stanza segreta del camino**;
- prendere la **chiave della torre** e scappare dalle **armature** che si svegliano
  (se ti prendono, la chiave torna al suo posto): dalla stanza del camino apre la porta
  per il resto del seminterrato;
- schivare i **fantasmi** e non cadere nei **buchi** del pavimento (si torna all'ingresso della stanza).

Nelle stanze con un pianoforte il fantasma si sveglia solo dopo averlo suonato.
Quando tutti i pianoforti hanno suonato, il pallone compare nella stanza del camino: lo si prende,
si corre all'uscita nell'ingresso e si raggiungono gli amici in giardino.
Il finale dipende dai frammenti riconosciuti (16, 13-15, 9-12, 5-8, 0-4) e mostra l'elenco
dei 16 brani, che si possono riascoltare.

## Come si gioca

Funziona su PC e tablet in orizzontale. Si cammina con le frecce o W A S D, oppure tenendo
premuto il dito (o il mouse) nel punto dove si vuole andare. Al pianoforte si risponde
toccando il ritratto, oppure con i tasti 1 e 2; Invio per andare avanti.
A destra ci sono la mappa del piano (si scopre man mano), i pianoforti suonati, i brani
riconosciuti e lo zaino. In alto a destra 🎵 spegne i rumori di fondo, 🔊 gli effetti sonori
e ⛶ mette il gioco a schermo intero.

## Pubblicarlo con GitHub Pages

1. Nel repository apri **Settings → Pages**.
2. In *Build and deployment* scegli **Deploy from a branch**, branch `main`, cartella `/ (root)`.
3. Dopo un minuto il gioco è online all'indirizzo
   `https://profgiuliotommasella.github.io/Spooky-House/`.

Si può anche giocare offline aprendo `index.html` nel browser.

Dopo una modifica ai file in `js/` o `css/`, aumenta di uno il numero `?v=` nelle righe
di `index.html` che li caricano: così i browser scaricano subito la versione nuova
invece di usare quella vecchia in memoria.

## Versione bilingue

Nella schermata del titolo si sceglie la lingua: solo italiano, oppure italiano con
albanese (Shqip), spagnolo (Español) o cinese semplificato (中文). Ogni testo resta in
italiano e la traduzione compare subito sotto. Le traduzioni sono in `js/traduzioni.js`
(una bozza da far rivedere): la chiave è il testo italiano esatto, quindi se si cambia un
testo in `js/contenuti.js` va cambiata anche lì. Un testo senza traduzione compare solo in italiano.

## Modificare brani e testi

I contenuti stanno in [`js/contenuti.js`](js/contenuti.js): i 16 frammenti (file, autore,
titolo), quale pianoforte li fa ascoltare e fra quali compositori si sceglie, le schede dei
compositori, i pensieri del ragazzo e i finali. `SECONDI_PRIMA_DI_RISPONDERE` dice dopo quanti
secondi di ascolto si può già rispondere.
Stanze, porte, oggetti e percorsi dei fantasmi sono in [`js/stanze.js`](js/stanze.js).

Per provare una stanza si apre `index.html#stanza=8` (si parte lì con tutti gli oggetti;
`#stanza=22&tutti` anche con tutti i pianoforti suonati, `#stanza=17&vuoto` senza oggetti).

## Cosa cambia rispetto al progetto Scratch

- Il pallone compare appena tutti i pianoforti hanno suonato, in qualunque ordine
  (nello Scratch si poteva restare bloccati).
- La stanza segreta del camino, dietro l'armadio dello studio, che si apre con la chiave del
  bagno: c'era solo nei file Canva, il pavimento di pietra e il fuoco sono nuovi.
- La torcia è davvero necessaria per attraversare il corridoio buio; nelle stanze buie si vede
  solo il cono di luce.
- I mobili che nello Scratch erano ostacoli invisibili ora sono disegnati, coperti da teli
  bianchi, e il pavimento è più scuro dove non si può camminare.
- Mappa del piano, zaino, contatore dei brani riconosciuti, tempo e spaventi.
- Al pianoforte ogni risposta mostra subito titolo, opera e scheda del compositore;
  nel finale i 16 brani si possono riascoltare.
- Dopo uno spavento o una caduta si ha un attimo di tregua; i fantasmi compaiono e svaniscono
  con calma, e le porte mostrano con una freccia o un lucchetto se si può passare.
- Rumori di fondo (vento e bordone), schermo intero, tablet e versione bilingue.

## Struttura

```
index.html            pagina del gioco
css/stile.css         grafica dell'interfaccia
js/contenuti.js       brani, compositori e testi (da modificare liberamente)
js/stanze.js          stanze, porte, oggetti e fantasmi
js/maschere.js        ostacoli, porte e buchi di ogni stanza (generato)
js/traduzioni.js      traduzioni per la versione bilingue
js/gioco.js           motore di gioco
assets/img/           sfondi delle stanze (da Canva, 1920x1440), personaggi e ritratti dal progetto Scratch
assets/audio/         effetti sonori e i 16 frammenti dal progetto Scratch
strumenti/estrai.py   rigenera assets e js/maschere.js dal file .sb3 (Pillow, numpy, ffmpeg);
                      con la cartella degli sfondi Canva come secondo argomento, le stanze escono a 1920x1440
                      e si generano anche la stanza del camino e l'armadio dello studio
```
