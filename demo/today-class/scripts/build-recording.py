#!/usr/bin/env python3
# Build the ~60s classroom fallback recording from real captured frames. Every frame carries a persistent
# honest banner: DESKTOP SOFTWARE DEMONSTRATION · NOT BEAM PRO DEVICE VALIDATION. Not device evidence.
import os, subprocess
from PIL import Image, ImageDraw, ImageFont

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
FR = os.path.join(REPO, "demo", "today-class", ".recframes")
OUTDIR = os.path.join(REPO, "demo", "today-class", "recording")
os.makedirs(OUTDIR, exist_ok=True)
W, H = 1600, 1000

def font(sz, bold=True):
    for p in (["/System/Library/Fonts/Supplemental/Arial Bold.ttf"] if bold else []) + \
             ["/System/Library/Fonts/Supplemental/Arial.ttf", "/System/Library/Fonts/Helvetica.ttc"]:
        if os.path.exists(p):
            try: return ImageFont.truetype(p, sz)
            except Exception: pass
    return ImageFont.load_default()

def frame(src, caption, idx):
    if src:
        im = Image.open(src).convert("RGB")
        im.thumbnail((W, H - 150), Image.LANCZOS)
        canvas = Image.new("RGB", (W, H), (12, 15, 22))
        canvas.paste(im, ((W - im.width)//2, 96 + ((H-150) - im.height)//2))
    else:
        canvas = Image.new("RGB", (W, H), (12, 15, 22))
    d = ImageDraw.Draw(canvas)
    # top caption bar
    d.rectangle([0, 0, W, 88], fill=(20, 26, 38))
    d.text((28, 22), caption, font=font(34), fill=(235, 240, 246))
    # bottom persistent honest banner (red)
    d.rectangle([0, H-56, W, H], fill=(150, 20, 24))
    d.text((28, H-44), "DESKTOP SOFTWARE DEMONSTRATION · NOT BEAM PRO DEVICE VALIDATION", font=font(26), fill=(255,255,255))
    out = os.path.join(OUTDIR, f"frame-{idx:02d}.png")
    canvas.save(out)
    return out

def title_card(lines, idx):
    canvas = Image.new("RGB", (W, H), (9, 12, 18))
    d = ImageDraw.Draw(canvas)
    y = 360
    for ln, sz, col in lines:
        f = font(sz); w = d.textlength(ln, font=f); d.text(((W-w)//2, y), ln, font=f, fill=col); y += sz + 22
    d.rectangle([0, H-56, W, H], fill=(150, 20, 24))
    d.text((28, H-44), "DESKTOP SOFTWARE DEMONSTRATION · NOT BEAM PRO DEVICE VALIDATION", font=font(26), fill=(255,255,255))
    out = os.path.join(OUTDIR, f"frame-{idx:02d}.png"); canvas.save(out); return out

U = os.path.join(REPO, "media", "spatial-ux-v11", "unity", "05-tracking-lost.png")
# (frame_path, seconds)
plan = [
    (title_card([("Shadow — banking evidence workflow", 52, (240,244,250)),
                 ("integrity · tamper localization · independent offline verifier", 30, (150,170,190))], 0), 5),
    (frame(os.path.join(FR,"f1-opener.png"),      "1 · A banking decision — sources, model activity, human review", 1), 7),
    (frame(os.path.join(FR,"f2-verify-empty.png"),"2 · Independent offline verifier — load the sealed evidence bundle", 2), 6),
    (frame(os.path.join(FR,"f3-verified.png"),    "3 · VERIFIED — proves the record is signed + unchanged, NOT that the conclusion is correct", 3), 15),
    (frame(os.path.join(FR,"f4-failed.png"),      "4 · One early record changed → FAILED · first failure seq 2 · downstream seq 2…4", 4), 16),
    (frame(U if os.path.exists(U) else None,      "5 · Also implemented in Unity, prepared for XREAL — device validation PENDING", 5), 7),
    (title_card([("Evidence you can inspect and verify independently — offline.", 40, (240,244,250)),
                 ("No device validation claimed. Not production-ready.", 28, (150,170,190))], 6), 6),
]

# ffmpeg concat with per-frame durations
concat = os.path.join(OUTDIR, "concat.txt")
with open(concat, "w") as f:
    for p, secs in plan:
        f.write(f"file '{os.path.basename(p)}'\nduration {secs}\n")
    f.write(f"file '{os.path.basename(plan[-1][0])}'\n")  # last frame repeated (ffmpeg concat quirk)

mp4 = os.path.join(OUTDIR, "shadow-desktop-demo.mp4")
subprocess.run(["ffmpeg","-y","-f","concat","-safe","0","-i","concat.txt",
                "-vf","fps=25,format=yuv420p","-c:v","libx264","-preset","medium","-crf","23",
                os.path.basename(mp4)], cwd=OUTDIR, check=True,
               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
total = sum(s for _, s in plan)
print(f"wrote {mp4} (~{total}s)")
