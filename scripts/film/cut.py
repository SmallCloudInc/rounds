# The film: a line on the canvas's own paper before each shot, long real shots, half-second
# crossfades, and the name at the end.
#   python3 scripts/film/cut.py <desktop|phone> <shots dir> <out.mp4>
import json, os, subprocess, sys

view, SRC, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
W, H = (1920, 1080) if view == "desktop" else (1080, 1350)
TMP = os.path.join(SRC, f"cut-{view}")
os.makedirs(TMP, exist_ok=True)
ENC = ["-c:v", "libx264", "-preset", "slow", "-crf", "12", "-pix_fmt", "yuv420p", "-r", "60"]
X = 0.35  # every join is a crossfade this long


def run(args):
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y"] + args, check=True)


def length(f):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", f], capture_output=True, text=True).stdout
    return float(json.loads(out)["format"]["duration"])


paper = os.path.join(SRC, f"{view}-paper.mp4")


def lines(src, out, spans):
    # words laid over a shot: each (png, from, to) fades in and out over the footage
    args, fc, prev = ["-i", src], [], "[0]"
    for i, (name, t0, t1) in enumerate(spans, 1):
        args += ["-loop", "1", "-framerate", "60", "-i", os.path.join(SRC, f"{view}-{name}.png")]
        fc.append(f"[{i}]scale={W}:{H}:flags=lanczos,format=rgba,fade=in:st={t0:.3f}:d=0.3:alpha=1,fade=out:st={t1 - 0.3:.3f}:d=0.3:alpha=1[o{i}]")
        fc.append(f"{prev}[o{i}]overlay=0:0:shortest=1[v{i}]")
        prev = f"[v{i}]"
    run(args + ["-filter_complex", ";".join(fc), "-map", prev, "-an"] + ENC + [out])
    return out


def lead(dur):
    run(["-ss", "0.4", "-i", paper, "-t", str(dur)] + ENC + [f"{TMP}/lead.mp4"])
    return f"{TMP}/lead.mp4"


def end(dur, at):
    # the name, then how to get it
    png = os.path.join(SRC, f"{view}-end.png")
    run(["-ss", str(at), "-i", paper, "-loop", "1", "-framerate", "60", "-i", png, "-t", str(dur), "-filter_complex",
         f"[1]scale={W}:{H}:flags=lanczos,format=rgba,fade=in:st=0.15:d=0.5:alpha=1[t];[0][t]overlay=0:0:shortest=1"] + ENC + [f"{TMP}/end.mp4"])
    return f"{TMP}/end.mp4"


def shot(name, start=0.0, trim_end=0.0):
    src = os.path.join(SRC, f"{view}-{name}.mp4")
    dur = length(src) - start - trim_end
    run(["-ss", str(start), "-i", src, "-t", str(dur), "-an"] + ENC + [f"{TMP}/{name}.mp4"])
    return f"{TMP}/{name}.mp4"


marks = json.load(open(os.path.join(SRC, f"{view}-marks.json")))
f = lambda shot, what: marks[shot][what] / 60
lands, loop, time = (shot(n) for n in ("lands", "loop", "time"))
SEG = [
    lead(0.5),
    lines(lands, f"{TMP}/lands-words.mp4", [("o1", 0.45, f("lands", "frames") - 0.2)]),
    lines(loop, f"{TMP}/loop-words.mp4", [("o2", f("loop", "pinned") - 0.15, f("loop", "sent") + 0.5), ("o3", f("loop", "answered") - 0.1, f("loop", "frames") - 0.2)]),
    lines(time, f"{TMP}/time-words.mp4", [("o4", f("time", "stack") / 1 + 0.45, f("time", "frames") - 0.2)]),
    end(2.6, 1.2),
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
