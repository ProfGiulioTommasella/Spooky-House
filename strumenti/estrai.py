"""Estrae dal progetto Scratch (Spooky House.sb3) immagini, suoni e maschere delle stanze.

Uso:  python3 strumenti/estrai.py "percorso/Spooky House.sb3" ["cartella Canva" ...]

Le cartelle facoltative contengono i file esportati da Canva in alta risoluzione
(3840x2880, con lo sfondo trasparente, stessi nomi degli zip "Spooky House - STANZE"
e "Spooky House"): stanze, copertine, ritratti, pianoforte e alcuni sprite.
Con questi file le stanze e le copertine vengono salvate a 1920x1440 invece che a 960x720.

Serve Python 3 con Pillow e numpy, e ffmpeg per convertire i suoni in mp3.
Rigenera assets/img, assets/audio e js/maschere.js.
"""
import base64, io, json, os, subprocess, sys, tempfile, zipfile

import numpy as np
from PIL import Image, ImageDraw

QUI = os.path.dirname(os.path.abspath(__file__))
RADICE = os.path.dirname(QUI)
IMG = os.path.join(RADICE, "assets", "img")
AUDIO = os.path.join(RADICE, "assets", "audio")
CELLA = 4  # lato in pixel di una cella delle maschere di collisione (stanza 960x720)

sb3 = zipfile.ZipFile(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RADICE, "..", "Spooky House.sb3"))
CARTELLE_HD = sys.argv[2:]  # cartelle con i file Canva in alta risoluzione (facoltative)


def file_hd(nome):
    """Il percorso del file Canva con questo nome, cercato in tutte le cartelle date."""
    for cartella in CARTELLE_HD:
        percorso = os.path.join(cartella, nome + ".png")
        if os.path.exists(percorso):
            return percorso
    return None
progetto = json.loads(sb3.read("project.json"))
SPRITE = {t["name"]: t for t in progetto["targets"]}


def costume(sprite, nome):
    for c in SPRITE[sprite]["costumes"]:
        if c["name"] == nome:
            return c
    raise KeyError(f"{sprite} / {nome}")


def immagine(sprite, nome):
    """Il costume come immagine RGBA a doppia risoluzione (1 unità Scratch = 2 pixel)."""
    c = costume(sprite, nome)
    im = Image.open(io.BytesIO(sb3.read(c["md5ext"]))).convert("RGBA")
    s = 2 / c.get("bitmapResolution", 1)
    if s != 1:
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    return im, c["rotationCenterX"] * s, c["rotationCenterY"] * s


def sulla_scena(sprite, nome, x=0, y=0):
    """Il costume posato sulla stanza 960x720, con lo sprite in (x, y) coordinate Scratch."""
    im, cx, cy = immagine(sprite, nome)
    tela = Image.new("RGBA", (960, 720), (0, 0, 0, 0))
    tela.paste(im, (round(480 + 2 * x - cx), round(360 - 2 * y - cy)), im)
    return tela


def ritaglia(im):
    box = im.getbbox()
    return im.crop(box), box


def salva_png(im, nome):
    im.save(os.path.join(IMG, nome), optimize=True)


def pianoforte_disegnato(w, h, s=4):
    """Pianoforte verticale visto dall'alto, tastiera in basso, a w x h unità (176 x 86) per s pixel."""
    S = 4 * s  # disegno sovracampionato, poi ridotto
    W, H = round(w * S), round(h * S)
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    u = lambda v: round(v * S)
    sx = w / 176; sy = h / 86
    X = lambda v: round(v * sx * S); Y = lambda v: round(v * sy * S)
    scuro, medio, coperchio = (72, 46, 42), (79, 51, 47), (104, 69, 65)
    # corpo posteriore e coperchio
    d.rounded_rectangle((X(1), Y(1), X(175), Y(52)), radius=u(2), fill=medio, outline=(52, 33, 30), width=u(0.8))
    d.rectangle((X(2), Y(2), X(174), Y(5)), fill=(92, 60, 55))
    d.rounded_rectangle((X(1), Y(23), X(175), Y(52)), radius=u(1.5), fill=coperchio, outline=(70, 45, 41), width=u(0.6))
    d.rectangle((X(3), Y(25), X(173), Y(28)), fill=(118, 80, 75))  # riflesso sul coperchio
    d.line((X(2), Y(50), X(174), Y(50)), fill=(86, 56, 51), width=u(1.2))
    # fianchi
    for x0 in (4, 164):
        d.rounded_rectangle((X(x0), Y(50), X(x0 + 8), Y(85)), radius=u(1), fill=scuro, outline=(50, 31, 28), width=u(0.6))
    # cassa della tastiera
    d.rectangle((X(12), Y(52), X(164), Y(81)), fill=(68, 42, 43))
    d.rectangle((X(12), Y(52), X(164), Y(55)), fill=(88, 57, 52))
    # tasti bianchi
    k0, k1, ky0, ky1 = 19, 157, 55.5, 77
    n = 36
    passo = (k1 - k0) / n
    d.rectangle((X(k0), Y(ky0), X(k1), Y(ky1)), fill=(236, 220, 208))
    for i in range(n):
        x = k0 + i * passo
        d.rectangle((X(x), Y(ky0), X(x + passo), Y(ky1)), fill=(238, 224, 212) if i % 2 else (230, 214, 202))
        d.line((X(x), Y(ky0), X(x), Y(ky1)), fill=(150, 128, 120), width=max(1, u(0.35)))
    d.line((X(k0), Y(ky1), X(k1), Y(ky1)), fill=(170, 150, 140), width=u(0.6))
    # tasti neri (2 e 3 per ottava)
    for i in range(n - 1):
        if i % 7 in (0, 1, 3, 4, 5):
            cx = k0 + (i + 1) * passo
            d.rounded_rectangle((X(cx - passo * 0.32), Y(ky0), X(cx + passo * 0.32), Y(ky0 + 12)), radius=u(0.4), fill=(28, 22, 22))
            d.line((X(cx - passo * 0.12), Y(ky0 + 1), X(cx - passo * 0.12), Y(ky0 + 10)), fill=(70, 62, 60), width=max(1, u(0.3)))
    # listello sotto la tastiera
    d.rectangle((X(12), Y(77.5), X(164), Y(81)), fill=(62, 39, 36))
    im = im.resize((round(w * s), round(h * s)), Image.LANCZOS)
    return im


def pianoforte_ruotato(pezzo, s=4):
    """Il pianoforte dello Scratch ridisegnato nitido: si sceglie la rotazione che più gli somiglia."""
    rif = np.asarray(pezzo.convert("RGBA")).astype(float)
    migliore = None
    for giri in range(4):
        w, h = (pezzo.width, pezzo.height) if giri % 2 == 0 else (pezzo.height, pezzo.width)
        im = pianoforte_disegnato(w, h, s).rotate(90 * giri, expand=True)
        prova = np.asarray(im.resize(pezzo.size, Image.LANCZOS)).astype(float)
        diff = np.abs(prova - rif).mean()
        if migliore is None or diff < migliore[0]:
            migliore = (diff, im)
    return migliore[1]


def salva_jpg(im, nome, q=None):
    if q is None:
        q = 93 if im.width <= 960 else 86  # le stanze in alta risoluzione reggono una compressione maggiore
    sfondo = Image.new("RGB", im.size, (0, 0, 0))
    sfondo.paste(im, (0, 0), im)
    sfondo.save(os.path.join(IMG, nome), quality=q, subsampling=0, optimize=True, progressive=True)


def maschera(im, soglia=40):
    """Bitset (base64) di celle CELLA x CELLA: 1 se almeno un pixel della cella è pieno."""
    a = np.array(im)[:, :, 3] > soglia
    h, w = a.shape
    a = a.reshape(h // CELLA, CELLA, w // CELLA, CELLA).any(axis=(1, 3))
    return base64.b64encode(np.packbits(a.flatten()).tobytes()).decode()


def riquadro(im, soglia=40):
    a = np.array(im)[:, :, 3] > soglia
    ys, xs = np.nonzero(a)
    if len(xs) == 0:
        return None
    return [int(xs.min()), int(ys.min()), int(xs.max() + 1), int(ys.max() + 1)]


# ------------------------------------------------------------------
# Ogni stanza è fatta di livelli sovrapposti: sfondo, poi il vuoto (se c'è),
# poi gli ostacoli (muri e mobili). Dal progetto Scratch si prendono i costumi
# corrispondenti; con la cartella Canva gli stessi livelli in alta risoluzione.
VUOTO_SOTTO = {15}


def componi(livelli):
    tela = Image.new("RGBA", livelli[0].size, (0, 0, 0, 0))
    for im in livelli:
        tela.alpha_composite(im.convert("RGBA").resize(tela.size, Image.LANCZOS))
    return tela


# Nomi dei file ad alta risoluzione esportati da Canva: "... sfondo", "... ostacoli" e, dove
# ci sono buchi nel pavimento, "... vuoto".
FILE_HD = {
    0: "Exit sfondo", 1: "PT_ ingresso sfondo", 2: "PT_ vestibolo sfondo", 3: "PT_ pranzo sfondo",
    4: "PT_ corridoio 1 sfondo", 5: "PT_ bagno sfondo", 6: "PT_ biblio sfondo", 7: "PT_ corridoio 2 sfondo",
    8: "PT_ studio sfondo", 9: "P1_ salone sfondo", 10: "P1_ corr 3 sfondo", 11: "P1_ salotto sfondo",
    12: "P1_ bagno sfondo", 13: "P1_ camera1 sfondo", 14: "P1_ camera2 sfondo", 15: "T_ corr 3 sfondo",
    16: "T_ guardiola sfondo", 17: "T_ torre sfondo", 18: "S_ corr 5 sfondo", 19: "S_ cucina sfondo",
    20: "S_ scantinato sfondo",
}
# Sprite esportati da Canva con lo sfondo trasparente: si ritagliano e si salvano al doppio
# della dimensione usata nel gioco (il gioco li disegna sempre alla dimensione di js/maschere.js).
SPRITE_HD = {
    "gargoyle-1": "Gargoyle su", "gargoyle-2": "Gargoyle giù", "armatura": "armatura", "amici": "EXIT amici",
    "chiave-torre": "Chiave torre x semint", "chiave-piccola": "Chiave bagno PT x ...1", "pergamena": "pergamena",
    "pallone": "Icona pallone Start", "start": "Pulsante Start 1", "fantasma-sx": "ghost 1",
    "fantasma-libro-dx": "ghost book",
}
LATO_HD = 2  # le stanze in alta risoluzione sono 960x720 moltiplicato per questo
ALTEZZA_RITRATTO = 720  # i ritratti si vedono alti 360 pixel
LARGHEZZA_PIANOFORTE = 1300  # il pianoforte dell'ascolto si vede largo 600 pixel
SPECCHIO = {"fantasma-sx": "fantasma-dx", "fantasma-libro-dx": "fantasma-libro-sx"}  # sprite che si salvano anche girati


def alta_risoluzione(file, basso):
    """L'immagine di Canva (fondo bianco, nessuna trasparenza) ridotta a 1920x1440,
    con la trasparenza presa dal costume Scratch corrispondente (basso, 960x720)."""
    percorso = file_hd(file)
    if not percorso:
        return None
    dim = (960 * LATO_HD, 720 * LATO_HD)
    originale = Image.open(percorso)
    if originale.mode == "RGBA" and originale.getextrema()[3][0] < 255:
        # esportato da Canva con lo sfondo trasparente: va bene così com'è
        return originale.resize(dim, Image.LANCZOS)
    hd = np.array(originale.convert("RGB").resize(dim, Image.LANCZOS)).astype(float)
    grande = basso.resize(dim, Image.BICUBIC)
    alfa = np.array(grande.split()[3]).astype(float) / 255.0
    # sui bordi semitrasparenti il bianco di Canva farebbe un alone: lì si usa il colore di Scratch
    bordo = (alfa < 0.98)[:, :, None]
    rgb = np.where(bordo, np.array(grande.convert("RGB")).astype(float), hd)
    out = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).convert("RGBA")
    out.putalpha(Image.fromarray((alfa * 255).astype(np.uint8)))
    return out


# ------------------------------------------------------------------
# Stanze: sfondo, ostacoli, porte (sprite Path 1-4) e buchi (sprite Vuoto)
# ------------------------------------------------------------------
STANZE = {
    0: ("0 Exit", "Exit ostacoli no Garg", ["0 E inizio", "0 E inizio", None, "0 Exit"], None),
    1: ("1 PT ingresso", "1 PT ingresso ostacoli", ["1 PT ingresso porte", "1 PT ingresso porte", "1 PT ingresso porte", "1 ingresso"], None),
    2: (" 2 PT vestibolo", "2 PT vestibolo ostacoli", ["2 PT vestibolo porte2", "2 PT vestibolo porte", None, None], None),
    3: ("3 PT pranzo", "3 PT pranzo ostacoli", ["3 PT pranzo porte2", "3 PT pranzo porte", None, None], None),
    4: ("4 PT corridoio 1", "4 PT corridoio 1 ostacoli", ["4 PT corridoio 1 porte2", "4 PT corridoio 1 porte", None, None], None),
    5: ("5 PT bagno", "5 PT bagno ostacoli", [None, "5 PT bagno porta", None, None], None),
    6: ("6 PT biblio", "6 PT biblio ostacoli", ["6 PT biblio porte", "6 PT biblio porte", None, None], None),
    7: ("7 PT corridoio 2", "7 PT corridoio 2 ostacoli", ["7 PT corridoio 2 porte", "7 PT corridoio 2 porte", None, None], None),
    8: ("8 PT studio", "8 PT studio ostacoli", ["8 PT studio porte", "8 PT studio porte", None, None], None),
    9: ("9 P1 salone", "9 P1 salone ostacoli", ["9 P1 salone porte", None, "9 salone ", None], None),
    10: ("10 P1 corr 3", "10 P1 corr 3 ostacoli", ["10 P1 corr 3 porte", "10 P1 corr 3 porte", "10 corridoio 3", None], None),
    11: ("11 P1 salotto", "11 P1 salotto ostacoli", ["11 P1 salottino", "11 P1 salottino", "11 salottino", "11 salottino"], None),
    12: ("12 P1 bagno", "12 P1 bagno ostacoli", ["12 P1 bagno porte", None, None, None], None),
    13: ("13 P1 camera1", "13 P1 camera1 ostacoli", ["13 P1 camera1 porte", None, None, None], None),
    14: ("14 P1 camera2", "14 P1 camera2 ostacoli", ["14 P1 camera2 porte", None, None, None], None),
    15: ("15 T corr 4", "15 T corr 4 ostacoli", ["15 T corr 4", "15 T corr 4", None, None], "15 T corr 4 vuoto"),
    16: ("16 T guardiola", "16 T guardiola ostacoli", ["16 T guardiola", "16 T guardiola", None, None], "16 T guardiola vuoto"),
    17: ("17 T torre", "17 T torre ostacoli", ["17 T torre", None, None, None], None),
    18: ("18 S corr 5", "18 S corr 5 ostacoli", ["18 corr 5", "18 S corr 5", None, None], None),
    19: ("19 S cucina", "19 S cucina ostacoli", [None, "19 S cucina", "19 cucina", None], "19 S cucina vuoto"),
    20: ("20 S scantinato", "20 S scantinato ostacoli", ["20 scantinato", None, None, None], "20 S scantinato vuoto"),
    21: ("0 Exit", "0 Exit ostacoli", [None, None, None, None], None),
}
PIANOFORTI = {3: "3 PF pranzo", 6: "6 PF biblio", 8: "8 PF studio", 9: "9 PF salone",
              11: "11 PF salotto", 13: "13 PF camera 1", 19: "19 PF cucina", 20: "20 PF scantinato"}
# gli stessi pianoforti esportati da Canva in alta risoluzione
PIANOFORTI_HD = {3: "PT pranzo piano 1", 6: "PT biblio Piano 2", 8: "PT studio Piano 3", 9: "P1 salone Piano 4",
                 11: "P1 salotto Piano 5", 13: "P1 camera1 Piano 6", 19: "S cucina piano 7", 20: "S scantinato piano 8"}


def main():
    os.makedirs(os.path.join(IMG, "stanze"), exist_ok=True)
    os.makedirs(os.path.join(AUDIO, "frammenti"), exist_ok=True)
    dati = {"cella": CELLA, "stanze": {}, "oggetti": {}}

    for n, (sf, ost, porte, vuoto) in STANZE.items():
        ostacoli = sulla_scena("Ostacoli", ost)
        if n != 21:
            livelli = [("sfondo", sulla_scena("Sfondo", sf))]
            if vuoto:
                # nella passerella della torre il vuoto sta sotto lo sfondo, che ha le assi sopra il baratro
                livelli.insert(0 if n in VUOTO_SOTTO else 1, ("vuoto", sulla_scena("Vuoto", vuoto)))
            livelli.append(("ostacoli", ostacoli))
            basso = [im for _, im in livelli]
            hd = [alta_risoluzione(FILE_HD[n].replace(" sfondo", " " + tipo), im) for tipo, im in livelli]
            salva_jpg(componi(hd if all(hd) else basso), f"stanze/{n}.jpg")
        s = {"ostacoli": maschera(ostacoli), "porte": {}}
        for i, p in enumerate(porte):
            if p:
                s["porte"][i + 1] = riquadro(sulla_scena(f"Path {i + 1}", p))
        if vuoto:
            s["buchi"] = maschera(sulla_scena("Vuoto", vuoto))
        if n in PIANOFORTI:
            sp = PIANOFORTI[n]
            im = sulla_scena(sp, SPRITE[sp]["costumes"][0]["name"])
            pezzo, box = ritaglia(im)
            hd = file_hd(PIANOFORTI_HD[n])
            if hd:
                # il pianoforte di Canva, già al suo posto nella stanza (3840x2880)
                grande = Image.open(hd).convert("RGBA")
                scala = grande.width / 960
                b = grande.getbbox()
                salva_png(grande.crop(b), f"piano-{n}.png")
                s["piano"] = [round(v / scala, 2) for v in b]
            else:
                # il disegno dello Scratch è piccolo: lo si ridisegna nitido, a 4 volte la grandezza della stanza
                salva_png(pianoforte_ruotato(pezzo), f"piano-{n}.png")
                s["piano"] = list(box)
        dati["stanze"][n] = s

    # Copertine e sfondi del pianoforte (in Canva hanno lo stesso nome, senza spazi in fondo)
    for nome, file in [("Copertina 1 ", "copertina"), ("Copertina 2", "casa"), ("Copertina 3", "casa-fantasmi"), ("Copertina END", "fine")]:
        hd = file_hd(nome.strip())
        if hd and file == "copertina":
            # in Canva la copertina ha due strisce di riempimento ai lati (84 px su 3840): si tolgono,
            # e per restare in 4:3 si toglie un po' anche sopra e sotto (sotto c'è la firma)
            im = Image.open(hd).convert("RGBA")
            w, h = im.size
            x0, x1 = round(w * 84 / 3840), w - round(w * 85 / 3840)
            alto = round((x1 - x0) * 3 / 4)
            y0 = round((h - alto) * 0.7)
            salva_jpg(im.crop((x0, y0, x1, y0 + alto)).resize((960 * LATO_HD, 720 * LATO_HD), Image.LANCZOS), f"{file}.jpg")
            continue
        salva_jpg(Image.open(hd).convert("RGBA").resize((960 * LATO_HD, 720 * LATO_HD), Image.LANCZOS) if hd else sulla_scena("Sfondo", nome), f"{file}.jpg")
    for colore in ["blu", "carta", "legno"]:
        nome = "sfondo " + colore
        hd = file_hd(nome)
        if hd:
            im = Image.open(hd).convert("RGBA").resize((960 * LATO_HD, 720 * LATO_HD), Image.LANCZOS)
        else:
            c = costume("Stage", nome)
            im = Image.open(io.BytesIO(sb3.read(c["md5ext"]))).convert("RGBA").resize((960, 720), Image.LANCZOS)
        salva_jpg(im, f"sfondo-{colore}.jpg")

    # Sprite ritagliati: si salva l'immagine e dove sta il punto di rotazione
    def sprite_png(sprite, nome, file, x=0, y=0):
        im, cx, cy = immagine(sprite, nome)
        pezzo, box = ritaglia(im)
        salva_png(pezzo, file)
        dati["oggetti"][file[:-4]] = {"w": pezzo.width, "h": pezzo.height, "cx": round(cx - box[0], 1), "cy": round(cy - box[1], 1)}

    # Il ragazzo: i costumi nuovi (564x564, testa al centro) sono in strumenti/ragazzo; nel gioco
    # si salvano a 298 px e si disegnano a 149, grandi come i vecchi costumi dello Scratch.
    for file in ["ragazzo-fermo", "ragazzo-passo1", "ragazzo-passo2",
                 "ragazzo-torcia-fermo", "ragazzo-torcia-passo1", "ragazzo-torcia-passo2"]:
        im = Image.open(os.path.join(RADICE, "strumenti", "ragazzo", file + ".png")).convert("RGBA")
        salva_png(im.resize((298, 298), Image.LANCZOS), file + ".png")
        dati["oggetti"][file] = {"w": 149, "h": 149, "cx": 74.5, "cy": 74.5}
    for nome, file in [("ghost L", "fantasma-sx"), ("ghost R", "fantasma-dx"), ("book L", "fantasma-libro-sx"), ("book R", "fantasma-libro-dx")]:
        sprite_png("ghost 1", nome, file + ".png")
    sprite_png("Gargoyle su", "Gargoyle su", "gargoyle-1.png")
    sprite_png("Gargoyle su2", "Gargoyle giù", "gargoyle-2.png")
    sprite_png("EXIT amici", "EXIT amici", "amici.png")
    # la torcia da raccogliere: il disegno nuovo (strumenti/torcia.png), largo 84 pixel nella stanza
    torcia = Image.open(os.path.join(RADICE, "strumenti", "torcia.png")).convert("RGBA")
    alta = round(84 * torcia.height / torcia.width)
    salva_png(torcia.resize((84 * 4, alta * 4), Image.LANCZOS), "torcia.png")
    dati["oggetti"]["torcia"] = {"w": 84, "h": alta, "cx": 42.0, "cy": alta / 2}
    sprite_png("Chiave bagno", "Chiave bagno PT x ", "chiave-piccola.png")
    sprite_png("Pulsante Start 1", "Icona pallone Start", "pallone.png")
    sprite_png("Pulsante Start 1", "Pulsante Start 1", "start.png")
    sprite_png("Chiave torre", "Chiave torre x semint", "chiave-torre.png")
    sprite_png("Guardiani", "armatura", "armatura.png")
    for c in ["Bach", "Vivaldi", "Mozart", "Beethoven"]:
        if ritratti_alta_risoluzione(c):
            continue
        for i, umore in enumerate(["mistero", "serio", "felice", "arrabbiato"]):
            nome = SPRITE[c]["costumes"][i]["name"]
            im, _, _ = immagine(c, nome)
            pezzo, _ = ritaglia(im)
            salva_png(pezzo, f"{c.lower()}-{umore}.png")
    if not pianoforti_alta_risoluzione():
        fotogrammi = [sulla_scena("Piano", n) for n in ["Piano 1 fermo", "Piano 2 luce", "Piano 3 luce", "Piano 4 luce"]]
        box = unione([im.getbbox() for im in fotogrammi])
        for i, im in enumerate(fotogrammi):
            salva_png(im.crop(box), f"pianoforte-{i}.png")
    im = sulla_scena("Consigli", "pergamena vuota")
    salva_png(ritaglia(im)[0], "pergamena.png")

    # Posizioni degli oggetti nelle stanze (centro in pixel della stanza)
    def centro(im):
        b = riquadro(im)
        return [round((b[0] + b[2]) / 2), round((b[1] + b[3]) / 2)]
    dati["posizioni"] = {
        "chiave-torre": centro(sulla_scena("Chiave torre", "Chiave torre x semint")),
        "chiave-piccola": centro(sulla_scena("Chiave bagno", "Chiave bagno PT x ")),
        "torcia": centro(sulla_scena("Torcia", "torcia 2-Photoroom", 167, -110)),
        "amici": centro(sulla_scena("EXIT amici", "EXIT amici")),
    }

    with open(os.path.join(RADICE, "js", "maschere.js"), "w") as f:
        f.write("// Generato da strumenti/estrai.py: maschere di collisione, porte e posizioni ricavate dal progetto Scratch.\n")
        f.write("// Le maschere sono bitset in base64, una cella ogni " + str(CELLA) + " pixel della stanza (960x720).\n")
        f.write("const MASCHERE = " + json.dumps(dati, separators=(",", ":")) + ";\n")

    # Suoni
    def mp3(md5ext, file, mono=True, kbps=96, filtro=None):
        with tempfile.NamedTemporaryFile(suffix=os.path.splitext(md5ext)[1]) as t:
            t.write(sb3.read(md5ext)); t.flush()
            cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", t.name]
            if filtro:
                # loudnorm lavora a 192 kHz: si torna a 48 kHz, altrimenti l'mp3 può uscire muto dopo il primo secondo
                cmd += ["-af", filtro, "-ar", "48000"]
            cmd += ["-ac", "1" if mono else "2", "-b:a", f"{kbps}k", os.path.join(AUDIO, file)]
            subprocess.run(cmd, check=True)

    def suono(sprite, nome):
        for s in SPRITE[sprite]["sounds"]:
            if s["name"] == nome:
                return s["md5ext"]
        raise KeyError(nome)

    effetti = {
        "passi": ("Player", "Footsteps3"), "caduta": ("Player", "caduta"), "porta": ("Path 1", "chiudendo serratura"),
        "chiuso": ("Player", "chiuso lucchetto"), "fantasma": ("ghost 1", "Ghost hover vintage synth effect"),
        "risata": ("ghost 1", "Risata malvagia 2"), "bambino": ("ghost 1", "Horror Creepy Ghost Child Sound Effect ~ Free Horror Sounds"),
        "magia": ("Chiave torre", "Magic Spell2"), "raccogli": ("Chiave torre", "Collect"), "giusto": ("Bach", "Magic Spell"),
        "sbagliato": ("Bach", "Risata malvagia 1"), "ingranaggi": ("Guardiani", "Ingranaggi2"), "armatura": ("Guardiani", "armatura"),
        "schiocco": ("Torcia", "Finger Snap"), "pietra": ("Gargoyle su", "stone-moving"), "ringhio": ("Gargoyle su", "cane-che-ringhia"),
        "calcio": ("Pulsante Start 1", "Calcio a pallone"), "vetri": ("Pulsante Start 1", "Finestra rotta"),
    }
    # passi e bambino nell'originale sono quasi impercettibili: si alzano (picco a circa -6 e -14 dB)
    filtri = {"passi": "volume=31dB", "bambino": "volume=18dB"}
    for file, (sp, nome) in effetti.items():
        mp3(suono(sp, nome), file + ".mp3", filtro=filtri.get(file))
    for s in SPRITE["Piano"]["sounds"]:
        n = int(s["name"].split()[0])
        mp3(s["md5ext"], f"frammenti/{n:02d}.mp3", mono=False, kbps=128, filtro="loudnorm=I=-18:TP=-1.5")
    sprite_alta_risoluzione(dati)
    if CARTELLE_HD:
        armadio_segreto(dati)
        with open(os.path.join(RADICE, "js", "maschere.js"), "w") as f:
            f.write("// Generato da strumenti/estrai.py: maschere di collisione, porte e posizioni ricavate dal progetto Scratch.\n")
            f.write("// Le maschere sono bitset in base64, una cella ogni " + str(CELLA) + " pixel della stanza (960x720).\n")
            f.write("const MASCHERE = " + json.dumps(dati, separators=(",", ":")) + ";\n")
    print("Fatto.")


def sprite_alta_risoluzione(dati):
    for file, nome in SPRITE_HD.items():
        percorso = file_hd(nome)
        if not percorso:
            continue
        hd = Image.open(percorso).convert("RGBA")
        if hd.getextrema()[3][0] == 255:
            continue  # senza trasparenza non si può usare
        if file in dati["oggetti"]:
            dim = (dati["oggetti"][file]["w"] * LATO_HD, dati["oggetti"][file]["h"] * LATO_HD)
        else:
            attuale = Image.open(os.path.join(IMG, file + ".png"))
            dim = (attuale.width * LATO_HD, attuale.height * LATO_HD)
        pezzo = hd.crop(hd.getbbox()).resize(dim, Image.LANCZOS)
        salva_png(pezzo, file + ".png")
        if file in SPECCHIO:
            salva_png(pezzo.transpose(Image.FLIP_LEFT_RIGHT), SPECCHIO[file] + ".png")


def ritratti_alta_risoluzione(compositore):
    """I quattro ritratti ("Bach 1" ... "Bach 4"), ognuno ritagliato sulla sua cornice
    (il gioco li centra nello stesso spazio)."""
    file = [file_hd(f"{compositore} {i}") for i in range(1, 5)]
    if not all(file):
        return False
    immagini = [Image.open(f).convert("RGBA") for f in file]
    # si ritaglia la sola cornice, senza l'ombra sfumata (l'ombra la aggiunge il gioco)
    for im, umore in zip(immagini, ["mistero", "serio", "felice", "arrabbiato"]):
        pezzo = im.crop(cornice(im))
        pezzo = pezzo.resize((round(pezzo.width * ALTEZZA_RITRATTO / pezzo.height), ALTEZZA_RITRATTO), Image.LANCZOS)
        salva_png(pezzo, f"{compositore.lower()}-{umore}.png")
    return True


def cornice(im):
    """Il riquadro della cornice dorata: pixel opachi e chiari (l'ombra intorno è scura)."""
    a = np.array(im)
    chiaro = (a[:, :, 3] > 200) & (a[:, :, :3].max(axis=2) > 90)
    # righe e colonne con una buona parte di cornice, per non contare puntini sparsi
    righe = np.nonzero(chiaro.sum(axis=1) > chiaro.shape[1] * 0.02)[0]
    colonne = np.nonzero(chiaro.sum(axis=0) > chiaro.shape[0] * 0.02)[0]
    return (int(colonne.min()), int(righe.min()), int(colonne.max() + 1), int(righe.max() + 1))


def unione(riquadri):
    return (min(b[0] for b in riquadri), min(b[1] for b in riquadri), max(b[2] for b in riquadri), max(b[3] for b in riquadri))


def pianoforti_alta_risoluzione():
    """Il pianoforte grande dell'ascolto: i quattro fotogrammi con lo stesso riquadro, così
    alternandoli il pianoforte resta fermo e cambiano solo le candele."""
    file = [file_hd(n) for n in ["Piano 1 fermo", "Piano 2 luce", "Piano 3 luce", "Piano 4 luce"]]
    if not all(file):
        return False
    immagini = [Image.open(f).convert("RGBA") for f in file]
    if any(im.getextrema()[3][0] == 255 for im in immagini):
        return False
    box = unione([im.getbbox() for im in immagini])
    for i, im in enumerate(immagini):
        pezzo = im.crop(box)
        salva_png(pezzo.resize((LARGHEZZA_PIANOFORTE, round(pezzo.height * LARGHEZZA_PIANOFORTE / pezzo.width)), Image.LANCZOS), f"pianoforte-{i}.png")
    return True


def armadio_segreto(dati):
    """L'armadio dello studio che nasconde il passaggio per la stanza segreta."""
    percorso = file_hd("PT_ studio secret door")
    if not percorso:
        return
    hd = Image.open(percorso).convert("RGBA")
    box = hd.getbbox()
    k = hd.width / 960
    b = [round(v / k) for v in box]
    w, h = b[2] - b[0], b[3] - b[1]
    salva_png(hd.crop(box).resize((w * LATO_HD, h * LATO_HD), Image.LANCZOS), "armadio.png")
    dati["oggetti"]["armadio"] = {"w": w, "h": h, "cx": 0, "cy": 0}
    dati["posizioni"]["armadio"] = [b[0], b[1]]


if __name__ == "__main__":
    main()
