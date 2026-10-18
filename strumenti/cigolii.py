"""Genera i cigolii del pavimento di legno (assets/audio/cigolio1..4.mp3).

Uso:  python3 strumenti/cigolii.py

I suoni sono sintetizzati da zero, quindi non hanno vincoli di licenza.
Un cigolio è un "attrito a scatti" (stick-slip): una raffica di piccoli impulsi
la cui frequenza sale e scende, filtrati da alcune risonanze tipiche di un'asse di legno.
Serve Python 3 con numpy, e ffmpeg per convertire in mp3.
"""
import os, subprocess

import numpy as np

QUI = os.path.dirname(os.path.abspath(__file__))
AUDIO = os.path.join(os.path.dirname(QUI), "assets", "audio")
SR = 48000


def risonatore(x, f, q, guadagno):
    """Filtro passa-banda a due poli (una risonanza del legno)."""
    w = 2 * np.pi * f / SR
    r = np.exp(-w / (2 * q))
    a1, a2 = -2 * r * np.cos(w), r * r
    y = np.zeros_like(x)
    y1 = y2 = 0.0
    g = (1 - r) * guadagno
    for i in range(len(x)):
        v = g * x[i] - a1 * y1 - a2 * y2
        y[i] = v
        y2, y1 = y1, v
    return y


def cigolio(seme, durata, f_inizio, f_picco, f_fine, risonanze):
    rng = np.random.default_rng(seme)
    n = int(durata * SR)
    t = np.arange(n) / SR
    # frequenza degli scatti: sale fino al picco e poi ridiscende, con un po' di tremolio
    meta = durata * rng.uniform(0.35, 0.6)
    f = np.where(t < meta,
                 f_inizio + (f_picco - f_inizio) * np.sin(0.5 * np.pi * t / meta),
                 f_picco + (f_fine - f_picco) * np.clip((t - meta) / (durata - meta), 0, 1) ** 1.5)
    f *= 1 + 0.06 * np.sin(2 * np.pi * rng.uniform(5, 9) * t) + 0.03 * rng.standard_normal(n).cumsum() / np.sqrt(n)
    fase = np.cumsum(f) / SR
    impulsi = np.zeros(n)
    scatti = np.flatnonzero(np.diff(np.floor(fase)) > 0)
    impulsi[scatti] = rng.uniform(0.5, 1.0, len(scatti))
    # ogni scatto è un piccolo colpo smorzato, non un clic secco
    colpo = np.exp(-np.arange(48) / 9.0) * np.sin(np.arange(48) * 0.9)
    eccitazione = np.convolve(impulsi, colpo)[:n] + 0.015 * rng.standard_normal(n)
    y = sum(risonatore(eccitazione, fr, q, gq) for fr, q, gq in risonanze)
    # inviluppo: attacco rapido, coda morbida, con l'intensità che "respira"
    inv = np.minimum(1, t / 0.04) * np.minimum(1, (durata - t) / 0.12)
    inv *= 0.75 + 0.25 * np.sin(np.pi * t / durata)
    y *= inv
    # un filo di saturazione rende lo scricchiolio più ruvido
    y = np.tanh(1.6 * y / np.abs(y).max()) / np.tanh(1.6)
    return 0.7 * y / np.abs(y).max()


VARIANTI = [
    # seme, durata, frequenze degli scatti (inizio, picco, fine), risonanze (Hz, Q, guadagno)
    (1, 0.55, 45, 160, 70, [(480, 18, 1.0), (1150, 22, 0.8), (2300, 25, 0.45), (3600, 30, 0.2)]),
    (2, 0.42, 70, 210, 110, [(620, 20, 1.0), (1400, 24, 0.7), (2650, 28, 0.4)]),
    (3, 0.75, 35, 120, 55, [(390, 16, 1.0), (960, 20, 0.85), (1850, 24, 0.5), (3100, 30, 0.25)]),
    (4, 0.5, 90, 260, 140, [(540, 20, 0.9), (1250, 22, 0.8), (2050, 26, 0.5), (4200, 30, 0.2)]),
]

for k, (seme, durata, fi, fp, ff, ris) in enumerate(VARIANTI, 1):
    y = cigolio(seme, durata, fi, fp, ff, ris).astype(np.float32)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-",
           "-b:a", "96k", os.path.join(AUDIO, f"cigolio{k}.mp3")]
    subprocess.run(cmd, input=y.tobytes(), check=True)
    print(f"cigolio{k}.mp3  {durata:.2f} s")
