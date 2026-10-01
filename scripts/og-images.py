#!/usr/bin/env python3
"""Generates the static social-preview images from the favicon's motif.

Run: python3 scripts/og-images.py

The brand lives in the SVG favicon: a dark rounded square with four terracotta
bars, the shape of an equalizer. WhatsApp and Instagram cannot read SVG, so the
share preview needs raster equivalents, and the link preview wants 1200x630
while an iOS home screen wants 180x180. Both are drawn here from the same
measurements rather than by hand, so a palette change is one edit.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent.parent / "apps" / "web" / "public"

INK = "#22211F"
BG = "#F4F2EC"
ACCENT = "#D97757"
MUTED = "#76736A"
FAVORITE_BG = "#2D2B2A"

SUPPLEMENTAL = "/System/Library/Fonts/Supplemental"
GEORGIA_BOLD = f"{SUPPLEMENTAL}/Georgia Bold.ttf"
GEORGIA_ITALIC = f"{SUPPLEMENTAL}/Georgia Italic.ttf"
ARIAL = f"{SUPPLEMENTAL}/Arial.ttf"

# The equalizer bars, straight out of favicon.svg: (x, y, height) at 48px.
BARS_48 = [(12, 21, 12), (18.4, 15, 21), (24.8, 25, 9), (31.2, 19, 16)]


def draw_bars(draw: ImageDraw.ImageDraw, x: float, y: float, size: float) -> None:
    """Draws the favicon's four bars scaled into a `size` square at (x, y)."""
    scale = size / 48
    bar_width = 3.4 * scale
    radius = bar_width / 2 - 0.5
    for bar_x, bar_y, height in BARS_48:
        left = x + bar_x * scale
        top = y + bar_y * scale
        right = left + bar_width
        bottom = top + height * scale
        draw.rounded_rectangle([left, top, right, bottom], radius=radius, fill=ACCENT)


def og_default() -> None:
    """1200x630 — the aspect the link-preview cards crop to."""
    width, height = 1200, 630
    image = Image.new("RGB", (width, height), BG)
    draw = ImageDraw.Draw(image)

    # The mark sits right of centre, big enough to survive a thumbnail crop.
    mark = 320
    mark_x, mark_y = width - mark - 140, (height - mark) // 2
    draw.rounded_rectangle([mark_x, mark_y, mark_x + mark, mark_y + mark], radius=74, fill=FAVORITE_BG)
    draw_bars(draw, mark_x, mark_y, mark)

    brand = ImageFont.truetype(GEORGIA_BOLD, 92)
    tagline = ImageFont.truetype(GEORGIA_ITALIC, 44)
    sub_text = "Anonymous song messages with a note attached."

    x = 96

    # The third line has to stop short of the mark, so it is sized to the
    # room that is actually left rather than to a number chosen by eye.
    sub_size = 30
    while sub_size > 22:
        sub = ImageFont.truetype(ARIAL, sub_size)
        if draw.textlength(sub_text, font=sub) <= mark_x - x - 48:
            break
        sub_size -= 2

    draw.text((x, 196), "TeaMusic.", font=brand, fill=INK)
    draw.text((x, 316), "Say te amo with a track.", font=tagline, fill=ACCENT)
    draw.text((x, 396), sub_text, font=sub, fill=MUTED)

    image.save(OUT / "og-default.png", "PNG", optimize=True)


def touch_icon() -> None:
    """180x180 — iOS clips the corners itself, so it wants no transparency."""
    size = 180
    image = Image.new("RGB", (size, size), FAVORITE_BG)
    draw = ImageDraw.Draw(image)
    draw_bars(draw, 0, 0, size)
    image.save(OUT / "apple-touch-icon.png", "PNG", optimize=True)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    og_default()
    touch_icon()
    for name in ("og-default.png", "apple-touch-icon.png"):
        print(f"wrote {name} ({(OUT / name).stat().st_size} bytes)")
