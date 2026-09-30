#!/bin/sh
# Regenerates every favicon: a full yin-yang, turned 45 degrees, on a transparent
# background. Needs Pillow (pip install pillow).
python3 - <<'PY'
from PIL import Image, ImageDraw

RADIUS = 0.44  # radius of the whole yin-yang circle, as a share of the canvas size
EYE = 0.2      # dot radius, as a share of RADIUS
RING = 0.05    # black outline width, as a share of RADIUS, so the white half
               # still reads on a light tab bar
ROTATE = 45    # turn it this many degrees clockwise
SUPERSAMPLE = 16

def disc(draw, cx, cy, r, fill):
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill)

def yinyang(size):
    big = size * SUPERSAMPLE
    img = Image.new("RGBA", (big, big), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)
    c = big / 2
    r = RADIUS * big
    white, black = (255, 255, 255, 255), (0, 0, 0, 255)
    # A black disc, its right half white, plus the white top bulb and the black
    # bottom bulb, each with a dot of the other color
    disc(draw, c, c, r, black)
    draw.pieslice([c - r, c - r, c + r, c + r], -90, 90, fill=white)
    disc(draw, c, c - r / 2, r / 2, white)
    disc(draw, c, c + r / 2, r / 2, black)
    disc(draw, c, c - r / 2, EYE * r, black)
    disc(draw, c, c + r / 2, EYE * r, white)
    # The outline goes on last, over the edge of the white half
    draw.ellipse([c - r, c - r, c + r, c + r], outline=black, width=round(RING * r))
    img = img.rotate(-ROTATE, resample=Image.BICUBIC)
    return img.resize((size, size), Image.LANCZOS)

for name, size in [("favicon-16", 16), ("favicon-32", 32), ("favicon-192", 192),
                   ("favicon-512", 512), ("apple-touch-icon", 180)]:
    yinyang(size).save(f"images/{name}.png")

yinyang(64).save("favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
PY
