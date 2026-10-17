"""Estrae dal progetto Scratch (Spooky House.sb3) immagini, suoni e maschere delle stanze.

Uso:  python3 strumenti/estrai.py "percorso/Spooky House.sb3"

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


def salva_jpg(im, nome, q=93):
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
    from PIL import ImageDraw, ImageFilter
    rng = np.random.default_rng(n)
    base = np.array(sfondo.convert("RGB")).astype(float)
    luce = base.mean(axis=2)
    pieno = np.array(ostacoli)[:, :, 3] > 40
    pavimento = np.array(Image.fromarray((luce > 28).astype(np.uint8) * 255).filter(ImageFilter.MinFilter(9))) > 0
    teli = np.zeros(pieno.shape, bool)
    for x1, y1, x2, y2 in MOBILI.get(n, []):
        teli[y1:y2, x1:x2] |= pieno[y1:y2, x1:x2]
    chiuso = Image.fromarray(pavimento.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(21)).filter(ImageFilter.MinFilter(21))
    teli &= np.array(chiuso) > 0
    if n not in SENZA_OMBRA:
        resto = pieno & pavimento & ~teli
        ombra = np.array(Image.fromarray(resto.astype(np.uint8) * 255).filter(ImageFilter.GaussianBlur(6))) / 255.0
        base *= (1 - 0.45 * ombra)[:, :, None]
    if teli.any():
        forma = Image.fromarray(teli.astype(np.uint8) * 255).filter(ImageFilter.GaussianBlur(3)).point(lambda v: 255 if v > 110 else 0)
        f = np.array(forma) / 255.0
        # ombra portata
        om = np.array(forma.transform(forma.size, Image.AFFINE, (1, 0, -7, 0, 1, -10)).filter(ImageFilter.GaussianBlur(9))) / 255.0
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
                px, py = rng.uniform(x1, x2), rng.uniform(y1, y2)
                ang = rng.uniform(-0.9, 0.9) + (np.pi / 2 if rng.random() < 0.5 else 0)
                lun = rng.uniform(25, 80)
                d.line([(px - np.cos(ang) * lun, py - np.sin(ang) * lun), (px + np.cos(ang) * lun, py + np.sin(ang) * lun)], fill=int(rng.uniform(90, 170)), width=int(rng.uniform(3, 7)))
        pg = np.array(pieghe.filter(ImageFilter.GaussianBlur(4))) / 255.0
        telo *= (1 - 0.28 * pg)[:, :, None]
        luci = np.array(pieghe.transform(pieghe.size, Image.AFFINE, (1, 0, 3, 0, 1, 3)).filter(ImageFilter.GaussianBlur(3))) / 255.0
        telo += (18 * luci * (1 - pg))[:, :, None]
        bordo = f - np.array(forma.filter(ImageFilter.GaussianBlur(7))) / 255.0
        telo *= (1 - 0.35 * np.clip(bordo, 0, 1) * 2)[:, :, None]
        telo += rng.normal(0, 5, (h, w))[:, :, None]
        polvere = rng.random((h, w)) < 0.004
        telo[polvere] *= 0.75
        base = base * (1 - f[:, :, None]) + telo * f[:, :, None]
    out = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8)).convert("RGBA")
    out.putalpha(sfondo.split()[3])
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
            salva_jpg(arreda(n, sulla_scena("Sfondo", sf), ostacoli), f"stanze/{n}.jpg")
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
        pezzo, _ = ritaglia(im)
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
    print("Fatto.")


if __name__ == "__main__":
    main()
