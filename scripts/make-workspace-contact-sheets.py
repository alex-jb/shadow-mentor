#!/usr/bin/env python3
# Compose Audit Workspace contact sheets from the real captures. Labeled grids for review.
import os, hashlib, json
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), "..")
CAP = os.path.join(ROOT, "media", "spatial-ux-v11", "audit-workspace")
OUT = os.path.join(CAP, "contact-sheets")
os.makedirs(OUT, exist_ok=True)
TW = 640  # thumb width

def font(sz):
    for p in ["/System/Library/Fonts/Helvetica.ttc", "/System/Library/Fonts/Supplemental/Arial.ttf"]:
        if os.path.exists(p):
            return ImageFont.truetype(p, sz)
    return ImageFont.load_default()

def thumb(path):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    return im.resize((TW, int(h * TW / w)))

def sheet(name, rows, title):
    # rows: list of (label, [paths])
    imgs = [[(lab, thumb(os.path.join(CAP, p))) for p in ps] for lab, ps in rows]
    cols = max(len(r) for r in imgs)
    th = imgs[0][0][1].size[1]
    pad, lab_h, top = 12, 26, 40
    cw = TW + pad
    rh = th + lab_h + pad
    W = cols * cw + pad
    H = top + len(imgs) * rh + pad
    canvas = Image.new("RGB", (W, H), (18, 20, 26))
    d = ImageDraw.Draw(canvas)
    d.text((pad, 10), title + "   —   NOT DEVICE VALIDATED", font=font(20), fill=(230, 235, 240))
    for ri, row in enumerate(imgs):
        for ci, (lab, im) in enumerate(row):
            x = pad + ci * cw
            y = top + ri * rh
            canvas.paste(im, (x, y + lab_h))
            d.text((x + 2, y + 4), lab, font=font(15), fill=(180, 190, 200))
    outp = os.path.join(OUT, name)
    canvas.save(outp)
    return outp

sheets = [
    ("01-layout-evolution.png", "Layout evolution — BEFORE(overlap) / INTERMEDIATE(partial) / AFTER(accepted)", [
        ("BEFORE — FAILED (total overlap)", ["BEFORE-overlap/01-overview-en.png"]),
        ("INTERMEDIATE — PARTIAL", ["INTERMEDIATE-partial/01-overview-en.png"]),
        ("AFTER — ACCEPTED (localized + spaced)", ["overview__en__DesktopDark.png"]),
    ]),
    ("02-first-failure-profiles.png", "First failure across profiles", [
        ("DesktopDark", ["first-failure__en__DesktopDark.png"]),
        ("XrealOstBright (SIMULATED)", ["first-failure__en__XrealOstBright.png"]),
        ("AccessibilityHighContrast", ["first-failure__en__AccessibilityHighContrast.png"]),
    ]),
    ("04-review-vs-approval.png", "Review ≠ Approval", [
        ("human-review-recorded", ["human-review-recorded__en__DesktopDark.png"]),
        ("approval-not-present", ["approval-not-present__en__DesktopDark.png"]),
        ("approval-present", ["approval-present__en__DesktopDark.png"]),
    ]),
    ("05-first-failure-vs-downstream.png", "First failure ≠ Downstream affected", [
        ("first-failure", ["first-failure__en__DesktopDark.png"]),
        ("downstream-affected", ["downstream-affected__en__DesktopDark.png"]),
    ]),
    ("06-tracking-states.png", "Tracking states — scanning / limited / lost / recovering", [
        ("scanning", ["tracking-scanning__en__DesktopDark.png"]),
        ("limited", ["tracking-limited__en__DesktopDark.png"]),
        ("lost", ["tracking-lost__en__DesktopDark.png"]),
        ("recovering", ["tracking-recovering__en__DesktopDark.png"]),
    ]),
    ("07-english-vs-chinese.png", "English vs Simplified Chinese", [
        ("first-failure EN", ["first-failure__en__DesktopDark.png"]),
        ("first-failure zh-CN", ["first-failure__zh-CN__DesktopDark.png"]),
    ]),
]
made = []
for name, title, rows in sheets:
    try:
        made.append(sheet(name, rows, title))
    except FileNotFoundError as e:
        print("skip", name, e)
print("wrote", len(made), "contact sheets")
