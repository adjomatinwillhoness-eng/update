"""UpDate : génère les enregistrements audio (voix féminine « f » et masculine « h ») d'une ou plusieurs fiches.

Usage : python3 gen_audio.py <dossier_du_site> <id> [<id> ...]
  - lit <site>/fiches.json, écrit <site>/<id>-f.mp3 et <site>/<id>-h.mp3 (à la racine du dépôt),
  - enregistre les repères de lecture dans fiches.json (champ "audio").
Dépendances : pip install --break-system-packages piper-tts numpy ; ffmpeg.
Les modèles de voix (Piper, licence CC-BY 4.0 / domaine public selon la voix) sont téléchargés depuis GitHub (sherpa-onnx).
"""
import json, re, html, subprocess, sys, os, tarfile, io, urllib.request
import numpy as np
from piper import PiperVoice
from piper.config import SynthesisConfig

CACHE = os.path.expanduser("~/.cache/update-voices")
MODELS = {"f": "siwis-medium", "h": "tom-medium"}
URL = "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-fr_FR-{}.tar.bz2"

def model(name):
    d = f"{CACHE}/vits-piper-fr_FR-{name}"
    if not os.path.exists(d):
        os.makedirs(CACHE, exist_ok=True)
        subprocess.run(f"curl -sSL {URL.format(name)} | tar xj -C {CACHE}", shell=True, check=True)
    return f"{d}/fr_FR-{name}"

ORD = ["", "premier", "deuxième", "troisième", "quatrième", "cinquième", "sixième", "septième", "huitième", "neuvième", "dixième",
       "onzième", "douzième", "treizième", "quatorzième", "quinzième", "seizième", "dix-septième", "dix-huitième", "dix-neuvième",
       "vingtième", "vingt-et-unième"]
def roman(r):
    m = {"I": 1, "V": 5, "X": 10, "L": 50}; t = 0
    for i, c in enumerate(r):
        a = m[c]; b = m.get(r[i+1], 0) if i+1 < len(r) else 0
        t += -a if a < b else a
    return t

# Réécritures de prononciation. Ajouter ici toute nouvelle abréviation mal lue.
REPS = [(r"av\. J\.-C\.", "avant Jésus-Christ"), (r"\bSTS-(\d+)", r"S T S \1"), (r"\bA-0\b", "A zéro"),
        (r"\bMark II\b", "Mark deux"), (r"\bMark I\b", "Mark un"), (r"\bCOBOL\b", "Cobol"),
        (r"\bNASA\b", "Nasa"), (r"\bESA\b", "E S A"), (r"\bEFSA\b", "E F S A"), (r"\bEPIC\b", "Épic"),
        (r"\bBnF\b", "B N F"), (r"\bADN\b", "A D N"), (r"\bDsup\b", "D sup"), (r"FOTON-M3", "Foton M 3"),
        (r"\bDSCOVR\b", "Discover"), (r"\bL1\b", "L un"), (r"\bL2\b", "L deux"), (r"~\s?", "environ "),
        (r"\bUS Navy\b", "U S Navy"), (r"\bUS Air Force\b", "U S Air Force"), (r"\bmg\b", "milligrammes"),
        (r"\bkm\b", "kilomètres"), (r"(\d) %", r"\1 pour cent"), (r"«\s*|\s*»", ""), (r"Felis lybica", "Félis libica"),
        (r"Ptolémée V\b", "Ptolémée cinq"), (r"Skłodowska", "Sklodovska"), (r"1/299 792 458", "un, divisé par 299 792 458,"),
        (r"\b(\d{4})-(\d{4})\b", r"\1 ou \2"), (r"\bUHF\b", "U H F")]
def say(t):
    t = html.unescape(re.sub(r"<[^>]+>", "", t))
    t = re.sub(r"\b([IVX][IVXL]*|L[IVX]+)(?:e|ème)\b", lambda m: ORD[roman(m.group(1))] if roman(m.group(1)) < len(ORD) else m.group(0), t)
    for a, b in REPS: t = re.sub(a, b, t)
    return t.strip()

def segments(f):
    segs = [f["title"] + ".", f["lede"]]
    segs += [b[1] + ("." if b[0] == "h" else "") for b in f["body"] if b[0] in ("h", "p")]
    segs.append("À retenir. " + " ".join(f["keep"]))
    return segs

def main():
    site, ids = sys.argv[1], sys.argv[2:]
    path = f"{site}/fiches.json"; data = json.load(open(path))
    byid = {f["id"]: f for f in data}
    for vk, name in MODELS.items():
        m = model(name); voice = PiperVoice.load(m + ".onnx", m + ".onnx.json"); sr = voice.config.sample_rate
        cfg = SynthesisConfig(length_scale=1.0, noise_scale=0.6, noise_w_scale=0.8)
        for fid in ids:
            f = byid[fid]; pcm = []; starts = []; n = 0
            for k, s in enumerate(segments(f)):
                starts.append(round(n / sr, 2))
                for ch in voice.synthesize(say(s), syn_config=cfg):
                    a = ch.audio_int16_array; pcm += [a, np.zeros(int(sr * 0.28), dtype=np.int16)]; n += len(a) + int(sr * 0.28)
                g = int(sr * (0.75 if k < 2 else 0.55)); pcm.append(np.zeros(g, dtype=np.int16)); n += g
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "s16le", "-ar", str(sr), "-ac", "1", "-i", "-",
                            "-af", "loudnorm=I=-16:TP=-1.5", "-ar", "22050", "-c:a", "libmp3lame", "-b:a", "48k",
                            f"{site}/{fid}-{vk}.mp3"], input=np.concatenate(pcm).tobytes(), check=True)
            f.setdefault("audio", {})[vk] = {"starts": starts, "dur": round(n / sr, 1)}
            print(vk, fid, round(n / sr), "s", flush=True)
    json.dump(data, open(path, "w"), ensure_ascii=False, indent=1)

if __name__ == "__main__":
    main()
