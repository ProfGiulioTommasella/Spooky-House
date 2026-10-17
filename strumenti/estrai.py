"""Estrae dal progetto Scratch (Spooky House.sb3) immagini, suoni e maschere delle stanze.

Uso:  python3 strumenti/estrai.py "percorso/Spooky House.sb3" ["cartella con gli sfondi da Canva"]

La cartella facoltativa contiene gli sfondi e i pianoforti esportati da Canva in
alta risoluzione (3840x2880, stessi nomi dello zip "Spooky House - STANZE"):
se c'è, le stanze vengono salvate a 1920x1440 invece che a 960x720.

Serve Python 3 con Pillow e numpy, e ffmpeg per convertire i suoni in mp3.
Rigenera assets/img, assets/audio e js/maschere.js.
"""
import base64, io, json, os, subprocess, sys, tempfile, zipfile

import numpy as np
from PIL import Image

QUI = os.path.dirname(os.path.abspath(__file__))
RADICE = os.path.dirname(QUI)
IMG = os.path.join(RADICE, "assets", "img")
AUDIO = os.path.join(RADICE, "assets", "audio")
CELLA = 4  # lato in pixel di una cella delle maschere di collisione (stanza 960x720)

sb3 = zipfile.ZipFile(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RADICE, "..", "Spooky House.sb3"))
CARTELLA_HD = sys.argv[2] if len(sys.argv) > 2 else None
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
# Nel progetto Scratch molti ostacoli dentro le stanze sono invisibili (i mobili
# non sono disegnati nello sfondo). Qui si disegnano mobili coperti da teli
# bianchi nei riquadri indicati, e si scurisce un po' il pavimento dove ci sono
# altri ostacoli, così si vede dove non si può camminare.
MOBILI = {
    2: [(412, 144, 492, 316), (524, 344, 704, 416)],
    3: [(340, 236, 664, 484)],
    4: [(244, 248, 344, 348)],
    5: [(284, 456, 466, 524), (500, 446, 624, 524)],
    6: [(540, 388, 652, 500), (168, 144, 292, 268)],
    7: [(432, 396, 520, 480)],
    8: [(384, 440, 576, 552), (684, 140, 804, 260), (84, 544, 244, 628), (140, 148, 228, 212)],
    11: [(720, 316, 844, 440)],
    13: [(600, 252, 824, 472)],
    14: [(648, 64, 776, 168), (100, 456, 224, 580), (664, 300, 910, 420)],
    18: [(436, 432, 524, 516)],
    19: [(424, 328, 640, 448), (370, 86, 704, 224)],
    20: [(416, 344, 552, 456), (216, 128, 392, 204)],
}
SENZA_OMBRA = {0, 15, 21}


def arreda(n, sfondo, ostacoli):
    """sfondo: la stanza a 960x720 o a una risoluzione multipla (es. 1920x1440);
    ostacoli: il costume degli ostacoli posato sulla stanza 960x720."""
    from PIL import ImageDraw, ImageFilter
    s = sfondo.width / 960
    S = lambda v: max(1, round(v * s))
    dispari = lambda v: S(v) | 1
    rng = np.random.default_rng(n)
    alfa = np.array(sfondo.split()[3]).astype(float) / 255.0
    base = np.array(sfondo.convert("RGB")).astype(float) * alfa[:, :, None]
    pieno = np.array(ostacoli.resize(sfondo.size, Image.BILINEAR))[:, :, 3] > 100
    # il pavimento: la parte non trasparente della stanza, chiudendo le fessure sottili fra le assi
    pavimento = Image.fromarray((alfa > 0.5).astype(np.uint8) * 255)
    pavimento = pavimento.filter(ImageFilter.MaxFilter(dispari(15))).filter(ImageFilter.MinFilter(dispari(15)))
    pavimento = np.array(pavimento.filter(ImageFilter.MinFilter(dispari(9)))) > 0
    teli = np.zeros(pieno.shape, bool)
    for x1, y1, x2, y2 in MOBILI.get(n, []):
        teli[S(y1):S(y2), S(x1):S(x2)] |= pieno[S(y1):S(y2), S(x1):S(x2)]
    teli &= pavimento
    if n not in SENZA_OMBRA:
        resto = pieno & pavimento & ~teli
        ombra = np.array(Image.fromarray(resto.astype(np.uint8) * 255).filter(ImageFilter.GaussianBlur(S(6)))) / 255.0
        base *= (1 - 0.45 * ombra)[:, :, None]
    if teli.any():
        forma = Image.fromarray(teli.astype(np.uint8) * 255).filter(ImageFilter.GaussianBlur(S(3))).point(lambda v: 255 if v > 110 else 0)
        forma = forma.filter(ImageFilter.GaussianBlur(s * 0.7))
        f = np.array(forma) / 255.0
        # ombra portata
        om = np.array(forma.transform(forma.size, Image.AFFINE, (1, 0, -S(7), 0, 1, -S(10))).filter(ImageFilter.GaussianBlur(S(9)))) / 255.0
        base *= (1 - 0.6 * om * (1 - f))[:, :, None]
        # il telo: chiaro in alto, più scuro in basso, con pieghe e polvere
        h, w = f.shape
        yy = np.linspace(0, 1, h)[:, None]
        telo = np.zeros((h, w, 3))
        telo[:] = np.array([226, 220, 206])
        telo *= (1.02 - 0.16 * yy)[:, :, None]
        pieghe = Image.new("L", (w, h), 0)
        d = ImageDraw.Draw(pieghe)
        for x1, y1, x2, y2 in MOBILI.get(n, []):
            for _ in range(max(3, (x2 - x1) * (y2 - y1) // 2500)):
                px, py = rng.uniform(x1, x2) * s, rng.uniform(y1, y2) * s
                ang = rng.uniform(-0.9, 0.9) + (np.pi / 2 if rng.random() < 0.5 else 0)
                lun = rng.uniform(25, 80) * s
                d.line([(px - np.cos(ang) * lun, py - np.sin(ang) * lun), (px + np.cos(ang) * lun, py + np.sin(ang) * lun)], fill=int(rng.uniform(90, 170)), width=S(rng.uniform(3, 7)))
        pg = np.array(pieghe.filter(ImageFilter.GaussianBlur(S(4)))) / 255.0
        telo *= (1 - 0.28 * pg)[:, :, None]
        luci = np.array(pieghe.transform(pieghe.size, Image.AFFINE, (1, 0, S(3), 0, 1, S(3))).filter(ImageFilter.GaussianBlur(S(3)))) / 255.0
        telo += (18 * luci * (1 - pg))[:, :, None]
        bordo = f - np.array(forma.filter(ImageFilter.GaussianBlur(S(7)))) / 255.0
        telo *= (1 - 0.35 * np.clip(bordo, 0, 1) * 2)[:, :, None]
        telo += rng.normal(0, 5, (h, w))[:, :, None]
        polvere = rng.random((h, w)) < 0.004 / (s * s)
        telo[polvere] *= 0.75
        base = base * (1 - f[:, :, None]) + telo * f[:, :, None]
    out = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8)).convert("RGBA")
    out.putalpha(sfondo.split()[3])
    return out


# Nomi dei file ad alta risoluzione esportati da Canva
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
}
LATO_HD = 2  # le stanze in alta risoluzione sono 960x720 moltiplicato per questo


def alta_risoluzione(file, basso):
    """L'immagine di Canva (fondo bianco, nessuna trasparenza) ridotta a 1920x1440,
    con la trasparenza presa dal costume Scratch corrispondente (basso, 960x720)."""
    if not CARTELLA_HD:
        return None
    percorso = os.path.join(CARTELLA_HD, file + ".png")
    if not os.path.exists(percorso):
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


def main():
    os.makedirs(os.path.join(IMG, "stanze"), exist_ok=True)
    os.makedirs(os.path.join(AUDIO, "frammenti"), exist_ok=True)
    dati = {"cella": CELLA, "stanze": {}, "oggetti": {}}

    for n, (sf, ost, porte, vuoto) in STANZE.items():
        ostacoli = sulla_scena("Ostacoli", ost)
        if n != 21:
            basso = sulla_scena("Sfondo", sf)
            sfondo = alta_risoluzione(FILE_HD.get(n, ""), basso) or basso
            salva_jpg(arreda(n, sfondo, ostacoli), f"stanze/{n}.jpg")
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
            salva_png(pezzo, f"piano-{n}.png")
            s["piano"] = list(box)
        dati["stanze"][n] = s

    # Copertine
    for nome, file in [("Copertina 1 ", "copertina"), ("Copertina 2", "casa"), ("Copertina 3", "casa-fantasmi"), ("Copertina END", "fine")]:
        salva_jpg(sulla_scena("Sfondo", nome), f"{file}.jpg")

    # Sprite ritagliati: si salva l'immagine e dove sta il punto di rotazione
    def sprite_png(sprite, nome, file, x=0, y=0):
        im, cx, cy = immagine(sprite, nome)
        pezzo, box = ritaglia(im)
        salva_png(pezzo, file)
        dati["oggetti"][file[:-4]] = {"w": pezzo.width, "h": pezzo.height, "cx": round(cx - box[0], 1), "cy": round(cy - box[1], 1)}

    for nome, file in [("idle", "ragazzo-fermo"), ("step1", "ragazzo-passo1"), ("step2", "ragazzo-passo2"),
                       ("idle torch", "ragazzo-torcia-fermo"), ("step3", "ragazzo-torcia-passo1"), ("step 2 torch", "ragazzo-torcia-passo2")]:
        sprite_png("Player", nome, file + ".png")
    for nome, file in [("ghost L", "fantasma-sx"), ("ghost R", "fantasma-dx"), ("book L", "fantasma-libro-sx"), ("book R", "fantasma-libro-dx")]:
        sprite_png("ghost 1", nome, file + ".png")
    sprite_png("Gargoyle su", "Gargoyle su", "gargoyle-1.png")
    sprite_png("Gargoyle su2", "Gargoyle giù", "gargoyle-2.png")
    sprite_png("EXIT amici", "EXIT amici", "amici.png")
    sprite_png("Torcia", "torcia 2-Photoroom", "torcia.png")
    sprite_png("Chiave bagno", "Chiave bagno PT x ", "chiave-piccola.png")
    sprite_png("Pulsante Start 1", "Icona pallone Start", "pallone.png")
    sprite_png("Pulsante Start 1", "Pulsante Start 1", "start.png")
    sprite_png("Chiave torre", "Chiave torre x semint", "chiave-torre.png")
    sprite_png("Guardiani", "armatura", "armatura.png")
    for c in ["Bach", "Vivaldi", "Mozart", "Beethoven"]:
        for i, umore in enumerate(["mistero", "serio", "felice", "arrabbiato"]):
            nome = SPRITE[c]["costumes"][i]["name"]
            im, _, _ = immagine(c, nome)
            pezzo, _ = ritaglia(im)
            salva_png(pezzo, f"{c.lower()}-{umore}.png")
    for i, nome in enumerate(["Piano 1 fermo", "Piano 2 luce", "Piano 3 luce", "Piano 4 luce"]):
        im = sulla_scena("Piano", nome)
        pezzo, box = ritaglia(im)
        hd = alta_risoluzione(nome, im)
        if hd:
            pezzo = hd.crop(tuple(v * LATO_HD for v in box))
        salva_png(pezzo, f"pianoforte-{i}.png")
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
                cmd += ["-af", filtro]
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
    for file, (sp, nome) in effetti.items():
        mp3(suono(sp, nome), file + ".mp3")
    for s in SPRITE["Piano"]["sounds"]:
        n = int(s["name"].split()[0])
        mp3(s["md5ext"], f"frammenti/{n:02d}.mp3", mono=False, kbps=128, filtro="loudnorm=I=-18:TP=-1.5")
    sprite_alta_risoluzione()
    if CARTELLA_HD:
        stanza_camino(dati)
        armadio_segreto(dati)
        with open(os.path.join(RADICE, "js", "maschere.js"), "w") as f:
            f.write("// Generato da strumenti/estrai.py: maschere di collisione, porte e posizioni ricavate dal progetto Scratch.\n")
            f.write("// Le maschere sono bitset in base64, una cella ogni " + str(CELLA) + " pixel della stanza (960x720).\n")
            f.write("const MASCHERE = " + json.dumps(dati, separators=(",", ":")) + ";\n")
    print("Fatto.")


def sprite_alta_risoluzione():
    if not CARTELLA_HD:
        return
    for file, nome in SPRITE_HD.items():
        percorso = os.path.join(CARTELLA_HD, nome + ".png")
        if not os.path.exists(percorso):
            continue
        hd = Image.open(percorso).convert("RGBA")
        if hd.getextrema()[3][0] == 255:
            continue  # senza trasparenza non si può usare
        attuale = Image.open(os.path.join(IMG, file + ".png"))
        pezzo = hd.crop(hd.getbbox()).resize((attuale.width * LATO_HD, attuale.height * LATO_HD), Image.LANCZOS)
        salva_png(pezzo, file + ".png")


# ------------------------------------------------------------------
# La stanza segreta (22), il seminterrato col camino dietro l'armadio dello studio.
# Nel progetto Scratch non c'è: muri, casse, porte e pianoforte vengono dai file Canva,
# il pavimento di pietra e il camino si disegnano qui.
# ------------------------------------------------------------------
CAMINO = ["A_ muro semint camino", "A_ porte semint camino", "A_ ostacoli semint camino", "A_ piano semint camino"]
FOCOLARE = (548, 40, 712, 126)  # il camino nel muro in alto (pixel della stanza 960x720)


def pavimento_di_pietra(w, h, s, rng):
    """Lastre di pietra irregolari, a righe sfalsate, con fughe scure."""
    from PIL import ImageDraw, ImageFilter
    base = np.zeros((h, w, 3))
    fughe = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(fughe)
    y = 0
    while y < h:
        alt = rng.uniform(44, 62) * s
        x = -rng.uniform(0, 60) * s
        while x < w:
            lar = rng.uniform(55, 110) * s
            c = np.array([84, 77, 70]) * rng.uniform(0.8, 1.12) + rng.normal(0, 1.5, 3)
            x1, y1, x2, y2 = int(max(x, 0)), int(y), int(min(x + lar, w)), int(min(y + alt, h))
            base[y1:y2, x1:x2] = c
            d.rectangle([x, y, x + lar, y + alt], outline=255, width=max(2, round(3 * s)))
            x += lar
        y += alt
    # macchie e consumo della pietra
    grana = Image.fromarray((rng.random((h // 8, w // 8)) * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
    grana = np.array(grana.filter(ImageFilter.GaussianBlur(6 * s))) / 255.0
    base *= (0.82 + 0.3 * grana)[:, :, None]
    base += rng.normal(0, 6, (h, w))[:, :, None]
    f = np.array(fughe.filter(ImageFilter.GaussianBlur(1.2 * s))) / 255.0
    base = base * (1 - 0.75 * f[:, :, None]) + np.array([24, 20, 18]) * 0.75 * f[:, :, None]
    # bordo chiaro in alto a sinistra di ogni lastra
    luce = np.array(fughe.transform(fughe.size, Image.AFFINE, (1, 0, -3 * s, 0, 1, -3 * s)).filter(ImageFilter.GaussianBlur(2 * s))) / 255.0
    base += (14 * luce * (1 - f))[:, :, None]
    return base


def disegna_camino(tela, s, rng):
    from PIL import ImageDraw, ImageFilter
    S = lambda v: round(v * s)
    x1, y1, x2, y2 = FOCOLARE
    # ombra del camino sul pavimento
    om = Image.new("L", tela.size, 0)
    ImageDraw.Draw(om).rectangle([S(x1 - 6), S(y1), S(x2 + 10), S(y2 + 14)], fill=170)
    nero = Image.new("RGBA", tela.size, (0, 0, 0, 255))
    nero.putalpha(om.filter(ImageFilter.GaussianBlur(S(12))))
    tela.alpha_composite(nero)
    d = ImageDraw.Draw(tela)
    # cornice di pietra: blocchi chiari
    d.rectangle([S(x1), S(y1), S(x2), S(y2)], fill=(122, 112, 100, 255), outline=(52, 44, 38, 255), width=S(3))
    for i, yy in enumerate(range(y1, y2, 17)):
        off = 0 if i % 2 else 14
        for xx in range(x1 - off, x2, 28):
            c = tuple(int(v * rng.uniform(0.85, 1.1)) for v in (128, 117, 104)) + (255,)
            if min(xx + 28, x2) - max(xx, x1) < 8 or min(yy + 17, y2) - yy < 8:
                continue
            d.rectangle([S(max(xx, x1) + 2), S(yy + 2), S(min(xx + 28, x2) - 2), S(min(yy + 17, y2) - 2)], fill=c)
    # mensola in alto
    d.rectangle([S(x1 - 8), S(y1 - 2), S(x2 + 8), S(y1 + 12)], fill=(92, 62, 40, 255), outline=(48, 30, 18, 255), width=S(2))
    # bocca del camino, nera di fuliggine
    bx1, by1, bx2, by2 = x1 + 26, y1 + 16, x2 - 26, y2 - 12
    d.rectangle([S(bx1), S(by1), S(bx2), S(by2)], fill=(18, 12, 10, 255))
    # ceppi e braci (la fiamma si anima nel gioco)
    for (ax, ay, bx, by) in [(bx1 + 12, by2 - 14, bx2 - 18, by2 - 22), (bx1 + 22, by2 - 24, bx2 - 10, by2 - 12)]:
        d.line([S(ax), S(ay), S(bx), S(by)], fill=(70, 42, 24, 255), width=S(9))
    brace = Image.new("RGBA", tela.size, (0, 0, 0, 0))
    db = ImageDraw.Draw(brace)
    db.ellipse([S(bx1 + 4), S(by2 - 30), S(bx2 - 4), S(by2 + 4)], fill=(255, 110, 30, 200))
    for _ in range(22):
        px, py = rng.uniform(bx1 + 10, bx2 - 10), rng.uniform(by2 - 22, by2 - 6)
        r = rng.uniform(1.5, 3)
        db.ellipse([S(px - r), S(py - r), S(px + r), S(py + r)], fill=(255, int(rng.uniform(150, 220)), 70, 255))
    tela.alpha_composite(brace.filter(ImageFilter.GaussianBlur(S(2.5))))
    d = ImageDraw.Draw(tela)
    # gradino del focolare
    d.rectangle([S(x1 - 4), S(y2 - 8), S(x2 + 4), S(y2)], fill=(104, 96, 88, 255), outline=(52, 44, 38, 255), width=S(2))


def riempi(libero, da):
    """Le celle libere raggiungibili dal punto da (riga, colonna)."""
    fatto = np.zeros(libero.shape, bool)
    fatto[da] = True
    while True:
        nuovo = fatto.copy()
        nuovo[1:] |= fatto[:-1]; nuovo[:-1] |= fatto[1:]
        nuovo[:, 1:] |= fatto[:, :-1]; nuovo[:, :-1] |= fatto[:, 1:]
        nuovo &= libero
        if (nuovo == fatto).all():
            return fatto
        fatto = nuovo


def stanza_camino(dati):
    from PIL import ImageDraw, ImageFilter
    pezzi = [os.path.join(CARTELLA_HD, f + ".png") for f in CAMINO]
    if not all(os.path.exists(p) for p in pezzi):
        return
    dim = (960 * LATO_HD, 720 * LATO_HD)
    s = LATO_HD
    rng = np.random.default_rng(22)
    muro, porte, casse, piano = [Image.open(p).convert("RGBA").resize(dim, Image.LANCZOS) for p in pezzi]
    # pavimento, scaldato dalla luce del camino e più scuro negli angoli
    w, h = dim
    base = pavimento_di_pietra(w, h, s, rng)
    yy, xx = np.mgrid[0:h, 0:w]
    fx, fy = (FOCOLARE[0] + FOCOLARE[2]) / 2 * s, FOCOLARE[3] * s
    caldo = np.exp(-(((xx - fx) / (330 * s)) ** 2 + ((yy - fy) / (260 * s)) ** 2))
    base = base * (0.62 + 0.5 * caldo)[:, :, None] + np.array([60, 26, 0]) * caldo[:, :, None]
    tela = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8)).convert("RGBA")
    # ombre di muri, casse e pianoforte
    for pezzo, dist in [(muro, 10), (casse, 8), (piano, 8)]:
        a = pezzo.split()[3].transform(dim, Image.AFFINE, (1, 0, -dist * s, 0, 1, -dist * s)).filter(ImageFilter.GaussianBlur(9 * s))
        nero = Image.new("RGBA", dim, (0, 0, 0, 255))
        nero.putalpha(a.point(lambda v: v * 0.6))
        tela.alpha_composite(nero)
    for pezzo in (casse, piano, porte, muro):
        tela.alpha_composite(pezzo)
    disegna_camino(tela, s, rng)
    # fuori dai muri resta nero, come nelle altre stanze
    a = lambda im: np.array(im.resize((960, 720), Image.BILINEAR).split()[3]) > 40
    pieno_muro, pieno_porte = a(muro), a(porte)
    dentro = riempi(~(pieno_muro | pieno_porte), (360, 480))
    casa = Image.fromarray((dentro * 255).astype(np.uint8)).resize(dim, Image.NEAREST)
    casa = np.maximum(np.array(casa), np.maximum(np.array(muro.split()[3]), np.array(porte.split()[3])))
    tela.putalpha(Image.fromarray(casa))
    salva_jpg(tela, "stanze/22.jpg")

    # maschere a 960x720: fuori dalla stanza, muri, casse, pianoforte e camino sono ostacoli
    x1, y1, x2, y2 = FOCOLARE
    ost = ~(dentro | pieno_porte) | a(casse) | a(piano)
    ost[y1:y2, x1 - 8:x2 + 8] = True
    ostacoli = Image.new("RGBA", (960, 720))
    ostacoli.putalpha(Image.fromarray((ost * 255).astype(np.uint8)))
    st = {"ostacoli": maschera(ostacoli), "porte": {}}
    ys, xs = np.nonzero(pieno_porte)
    for n, lato in [(1, xs < 480), (2, xs >= 480)]:
        st["porte"][n] = [int(xs[lato].min()), int(ys[lato].min()), int(xs[lato].max() + 1), int(ys[lato].max() + 1)]
    st["camino"] = list(FOCOLARE)
    dati["stanze"][22] = st


def armadio_segreto(dati):
    """L'armadio dello studio che nasconde il passaggio per la stanza segreta."""
    percorso = os.path.join(CARTELLA_HD, "PT_ studio secret door.png")
    if not os.path.exists(percorso):
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
