#!/usr/bin/env python3
# OST (optical see-through) simulation for V11 design review. Models an ADDITIVE display: the glasses ADD
# light to the real world, so dark pixels in the render are transparent and bright pixels emit over the
# background. DESIGN-REVIEW APPROXIMATION ONLY — NOT physically accurate, NOT device evidence. Every output
# is stamped "SIMULATED OST BACKGROUND / NOT DEVICE VALIDATED".
#   python3 scripts/ost-simulate.py
import os, glob
import numpy as np
from PIL import Image, ImageDraw, ImageFont

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAP = os.path.join(REPO, "media", "spatial-ux-v11", "unity")
OUT = os.path.join(REPO, "media", "spatial-ux-v11", "ost-simulations")
os.makedirs(OUT, exist_ok=True)
W, H = 1600, 1000
BG_SUB = np.array([9, 11, 17], dtype=np.int16)  # harness camera bg → "no emission"

def load_font(size):
    for p in ["/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/System/Library/Fonts/Helvetica.ttc"]:
        if os.path.exists(p):
            try: return ImageFont.truetype(p, size)
            except Exception: pass
    return ImageFont.load_default()

def bright_office():
    y = np.linspace(0, 1, H)[:, None]
    r = (210 + 30 * (1 - y)); g = (205 + 30 * (1 - y)); b = (190 + 25 * (1 - y))
    img = np.zeros((H, W, 3), np.float32)
    img[..., 0] = r; img[..., 1] = g; img[..., 2] = b
    img[120:560, 1050:1480] = [245, 246, 250]  # bright window (worst case for dark UI)
    return np.clip(img, 0, 255).astype(np.uint8)

def dark_room():
    y = np.linspace(0, 1, H)[:, None]
    v = (18 + 26 * y)
    img = np.zeros((H, W, 3), np.float32)
    img[..., 0] = v; img[..., 1] = v * 1.05; img[..., 2] = v * 1.2
    return np.clip(img, 0, 255).astype(np.uint8)

def patterned():
    xx, yy = np.meshgrid(np.arange(W), np.arange(H))
    s = ((xx + yy) // 46) % 2
    img = np.where(s[..., None] == 0, np.array([120, 118, 128]), np.array([86, 90, 104]))
    return img.astype(np.uint8)

def composite_additive(cap_np, bg_np):
    emit = np.clip(cap_np.astype(np.int16) - BG_SUB, 0, 255)
    return np.clip(bg_np.astype(np.int16) + emit, 0, 255).astype(np.uint8)

def stamp(np_img, scene):
    im = Image.fromarray(np_img)
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, 66], fill=(150, 20, 24))
    d.text((20, 12), "SIMULATED OST BACKGROUND — NOT DEVICE VALIDATED", font=load_font(38), fill=(255, 255, 255))
    d.text((20, H - 34), f"additive-composite design approximation · bg={scene} · not physically accurate · not device evidence", font=load_font(23), fill=(15, 15, 15))
    return im

def main():
    src = os.path.join(CAP, "02-first-failure-en.png")
    if not os.path.exists(src):
        src = sorted(glob.glob(os.path.join(CAP, "*.png")))[0]
    cap_np = np.array(Image.open(src).convert("RGB"))
    print("compositing", os.path.basename(src))
    for name, fn in [("bright-office", bright_office), ("dark-room", dark_room), ("patterned-background", patterned)]:
        out = composite_additive(cap_np, fn())
        stamp(out, name).save(os.path.join(OUT, name + "-simulation.png"))
        print("wrote", name + "-simulation.png")

if __name__ == "__main__":
    main()
