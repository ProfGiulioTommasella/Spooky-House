"""Ritaglia i cigolii del pavimento di legno (assets/audio/cigolio1..6.mp3).

Uso:  python3 strumenti/cigolii.py percorso/553377__garuda1982__creaking-squeaking-small-wooden-door-open-close-sound-effect.wav

Il file di partenza è "Creaking, squeaking small wooden door open close sound effect"
di Garuda1982, https://freesound.org/s/553377/ (licenza CC BY 4.0).
Da ogni apertura della porta si tiene solo il pezzo che cigola, senza i colpi della serratura.
Serve ffmpeg.
"""
import os, subprocess, sys

AUDIO = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "audio")

# inizio e durata (in secondi) di ogni ritaglio
TAGLI = [(1.02, 0.65), (7.85, 0.7), (12.22, 0.65), (19.10, 0.7), (23.26, 0.55), (14.55, 0.65)]

for k, (inizio, durata) in enumerate(TAGLI, 1):
    filtro = (f"highpass=f=150,afade=t=in:d=0.02,afade=t=out:st={durata - 0.15:.2f}:d=0.15,"
              "loudnorm=I=-16:TP=-3,aresample=48000")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", str(inizio), "-t", str(durata), "-i", sys.argv[1],
                    "-af", filtro, "-ac", "1", "-b:a", "96k", os.path.join(AUDIO, f"cigolio{k}.mp3")], check=True)
    print(f"cigolio{k}.mp3")
