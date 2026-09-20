#!/bin/sh
# Regenerates every favicon: half of a yin-yang (the white fish, with its black
# dot) on a transparent background. Needs Pillow (pip install pillow).
python3 - <<'PY'
from PIL import Image, ImageDraw, ImageOps

RADIUS = 0.44  # radius of the whole yin-yang circle, as a share of the canvas size
EYE = 0.2      # dot radius, as a share of RADIUS
ROTATE = 270   # degrees clockwise
FLIP = True    # then mirror top to bottom
SUPERSAMPLE = 16

def disc(draw, cx, cy, r, fill):
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill)

def fish(size):
    big = size * SUPERSAMPLE
    img = Image.new("RGBA", (big, big), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)
    c = big / 2
    r = RADIUS * big
    white, clear, black = (255, 255, 255, 255), (255, 255, 255, 0), (0, 0, 0, 255)
    # Right half of the circle, plus the top bulb, minus the bottom bulb
    draw.pieslice([c - r, c - r, c + r, c + r], -90, 90, fill=white)
    disc(draw, c, c - r / 2, r / 2, white)
    disc(draw, c, c + r / 2, r / 2, clear)
    # The black dot sits in the middle of the top bulb
    disc(draw, c, c - r / 2, EYE * r, black)
    img = img.rotate(-ROTATE, resample=Image.BICUBIC)
    if FLIP:
        img = ImageOps.flip(img)
    return img.resize((size, size), Image.LANCZOS)

for name, size in [("favicon-16", 16), ("favicon-32", 32), ("favicon-192", 192),
                   ("favicon-512", 512), ("apple-touch-icon", 180)]:
    fish(size).save(f"images/{name}.png")

fish(64).save("favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
PY
