# The film: a line on the canvas's own paper before each shot, long real shots, half-second
# crossfades, and the name at the end.
#   python3 scripts/film/cut.py <desktop|phone> <shots dir> <out.mp4>
import json, os, subprocess, sys

view, SRC, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
W, H = (1920, 1080) if view == "desktop" else (1080, 1350)
TMP = os.path.join(SRC, f"cut-{view}")
os.makedirs(TMP, exist_ok=True)
ENC = ["-c:v", "libx264", "-preset", "slow", "-crf", "12", "-pix_fmt", "yuv420p", "-r", "60"]
X = 0.5  # every join is a crossfade this long


def run(args):
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y"] + args, check=True)


def length(f):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", f], capture_output=True, text=True).stdout
    return float(json.loads(out)["format"]["duration"])


paper = os.path.join(SRC, f"{view}-paper.mp4")


def card(name, dur, at):
    # the line comes up out of the paper and holds
    png = os.path.join(SRC, f"{view}-{name}.png")
    run(["-ss", str(at), "-i", paper, "-loop", "1", "-framerate", "60", "-i", png, "-t", str(dur), "-filter_complex",
         f"[1]scale={W}:{H}:flags=lanczos,format=rgba,fade=in:st=0.2:d=0.55:alpha=1[t];[0][t]overlay=0:0:shortest=1"] + ENC + [f"{TMP}/{name}.mp4"])
    return f"{TMP}/{name}.mp4"


def end(dur, at):
    # the name, then how to get it
    png = os.path.join(SRC, f"{view}-end.png")
    run(["-ss", str(at), "-i", paper, "-loop", "1", "-framerate", "60", "-i", png, "-t", str(dur), "-filter_complex",
         f"[1]scale={W}:{H}:flags=lanczos,format=rgba,fade=in:st=0.25:d=0.7:alpha=1[t];[0][t]overlay=0:0:shortest=1"] + ENC + [f"{TMP}/end.mp4"])
    return f"{TMP}/end.mp4"


def shot(name, start=0.0, trim_end=0.0):
    src = os.path.join(SRC, f"{view}-{name}.mp4")
    dur = length(src) - start - trim_end
    run(["-ss", str(start), "-i", src, "-t", str(dur), "-an"] + ENC + [f"{TMP}/{name}.mp4"])
    return f"{TMP}/{name}.mp4"


SEG = [
    card("c1", 2.2, 0.0),
    shot("lands"),
    card("c2", 1.9, 1.2),
    shot("open", 0.05),
    card("c3", 2.4, 2.4),
    shot("note"),
    card("c4", 1.8, 0.6),
    shot("time"),
    end(3.6, 1.2),
]
durs = [length(f) for f in SEG]
inputs, fc, prev, acc = [], [], "[0]", durs[0]
for f in SEG:
    inputs += ["-i", f]
for i in range(1, len(SEG)):
    out = f"[x{i}]"
    fc.append(f"{prev}[{i}]xfade=transition=fade:duration={X}:offset={round(acc - X, 3)}{out}")
    prev, acc = out, acc - X + durs[i]
run(inputs + ["-filter_complex", ";".join(fc), "-map", prev, "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", "-r", "60", "-movflags", "+faststart", OUT])
print(view, "length", round(acc, 2), "s", round(os.path.getsize(OUT) / 1e6, 1), "MB")
