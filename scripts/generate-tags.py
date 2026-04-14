#!/usr/bin/env python3
"""Generate individual SVG tag files for all 64 Universal Language pieces,
plus a combined 8×8 laser-cut sheet."""

import json
import re
import os

# ── Paths ──────────────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(SCRIPT_DIR)
JSON_PATH = os.path.join(ROOT, "oracle", "oracle_cards_complete.json")
TAGS_DIR = os.path.join(ROOT, "tags")
COMBINED_PATH = os.path.join(TAGS_DIR, "all-tags-laser-cut.svg")

# ── Trigram line patterns ──────────────────────────────────────────────────
# Each entry: (bottom_line, middle_line, top_line)  1=yang(solid), 0=yin(broken)
TRIGRAM = {
    "\u2630": (1, 1, 1),  # ☰ Heaven
    "\u2631": (1, 1, 0),  # ☱ Lake
    "\u2632": (1, 0, 1),  # ☲ Fire
    "\u2633": (1, 0, 0),  # ☳ Thunder
    "\u2634": (0, 1, 1),  # ☴ Wind
    "\u2635": (0, 1, 0),  # ☵ Water
    "\u2636": (0, 0, 1),  # ☶ Mountain
    "\u2637": (0, 0, 0),  # ☷ Earth
}

def hexagram_top_to_bottom(upper_sym, lower_sym):
    """Return 6-element list [line6, line5, line4, line3, line2, line1]
    i.e. top-to-bottom in SVG, where 1=yang/solid, 0=yin/broken."""
    u = TRIGRAM[upper_sym]  # (bottom, middle, top) of upper trigram
    l = TRIGRAM[lower_sym]  # (bottom, middle, top) of lower trigram
    # line6=upper-top, line5=upper-mid, line4=upper-bot,
    # line3=lower-top, line2=lower-mid, line1=lower-bot
    return [u[2], u[1], u[0], l[2], l[1], l[0]]


def hexagram_svg_lines(upper_sym, lower_sym):
    """Return SVG elements for the 6 hexagram lines."""
    Y_POSITIONS = [26, 29, 32, 35, 38, 41]
    lines = hexagram_top_to_bottom(upper_sym, lower_sym)
    parts = []
    for y, yang in zip(Y_POSITIONS, lines):
        if yang:
            parts.append(
                f'  <line x1="4.5" y1="{y}" x2="21" y2="{y}" stroke="black" stroke-width="1.5"/>'
            )
        else:
            parts.append(
                f'  <line x1="4.5" y1="{y}" x2="11.25" y2="{y}" stroke="black" stroke-width="1.5"/>'
            )
            parts.append(
                f'  <line x1="14.25" y1="{y}" x2="21" y2="{y}" stroke="black" stroke-width="1.5"/>'
            )
    return "\n".join(parts)


def clean_hexagram_name(raw):
    """Strip Chinese name in parentheses, e.g. 'The Creative (Ch'ien)' → 'The Creative'."""
    return re.sub(r"\s*\(.*\)", "", raw).strip()


def slugify(name):
    slug = name.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")


def tag_filename(number, card_name):
    return f"tag-ul-{number:02d}-{slugify(card_name)}.svg"


def render_tag_svg(card):
    """Return full SVG string for one tag."""
    num = card["number"]
    name = card["card_name"]
    upper_sym = card["iching"]["upper_trigram"]["symbol"]
    lower_sym = card["iching"]["lower_trigram"]["symbol"]
    hex_name = clean_hexagram_name(card["iching"]["hexagram_name"])
    shadow = card["gene_keys"]["shadow"]
    gift = card["gene_keys"]["gift"]
    siddhi = card["gene_keys"]["siddhi"]

    hexa = hexagram_svg_lines(upper_sym, lower_sym)

    return f"""<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 100 50"
     width="100mm" height="50mm">

  <rect x="0" y="0" width="100" height="50" fill="white"/>
  <rect x="1.2" y="1.2" width="97.6" height="47.6" fill="none" stroke="black" stroke-width="0.5"/>
  <rect x="2.4" y="2.4" width="95.2" height="45.2" fill="none" stroke="black" stroke-width="0.15"/>

  <text x="50" y="8" text-anchor="middle"
        font-family="Arial, sans-serif" font-size="2.8" font-weight="bold"
        letter-spacing="1.4" fill="black">UNIVERSAL LANGUAGE  ·  {num}</text>

  <text x="50" y="15.5" text-anchor="middle"
        font-family="Georgia, serif" font-size="6.5" font-style="italic"
        fill="black">{name}</text>

  <line x1="4.5" y1="19" x2="95.5" y2="19" stroke="black" stroke-width="0.35"/>

{hexa}

  <text x="95.5" y="24" text-anchor="end"
        font-family="Arial, sans-serif" font-size="2.8" font-weight="bold"
        letter-spacing="1" fill="black">I CHING</text>

  <text x="95.5" y="30" text-anchor="end"
        font-family="Georgia, serif" font-size="4.5"
        fill="black">{hex_name}</text>

  <line x1="26" y1="33" x2="95.5" y2="33" stroke="black" stroke-width="0.15"/>

  <text x="95.5" y="38" text-anchor="end"
        font-family="Arial, sans-serif" font-size="2.8" font-weight="bold"
        letter-spacing="1" fill="black">GENE KEYS</text>

  <text x="95.5" y="44" text-anchor="end"
        font-family="Georgia, serif" font-size="3.2"
        fill="black">{shadow} · {gift} · {siddhi}</text>

</svg>"""


def render_tag_inner(card, tx, ty):
    """Return SVG group content for the combined sheet at offset (tx, ty)."""
    num = card["number"]
    name = card["card_name"]
    upper_sym = card["iching"]["upper_trigram"]["symbol"]
    lower_sym = card["iching"]["lower_trigram"]["symbol"]
    hex_name = clean_hexagram_name(card["iching"]["hexagram_name"])
    shadow = card["gene_keys"]["shadow"]
    gift = card["gene_keys"]["gift"]
    siddhi = card["gene_keys"]["siddhi"]

    hexa_lines = hexagram_top_to_bottom(upper_sym, lower_sym)
    Y_POSITIONS = [26, 29, 32, 35, 38, 41]
    hexa_parts = []
    for y, yang in zip(Y_POSITIONS, hexa_lines):
        if yang:
            hexa_parts.append(
                f'      <line x1="4.5" y1="{y}" x2="21" y2="{y}" stroke="black" stroke-width="1.5"/>'
            )
        else:
            hexa_parts.append(
                f'      <line x1="4.5" y1="{y}" x2="11.25" y2="{y}" stroke="black" stroke-width="1.5"/>'
            )
            hexa_parts.append(
                f'      <line x1="14.25" y1="{y}" x2="21" y2="{y}" stroke="black" stroke-width="1.5"/>'
            )
    hexa = "\n".join(hexa_parts)

    slug = slugify(name)
    label = f"UL-{num:02d} {name}"

    return f"""  <!-- UL-{num:02d} {name} -->
  <g inkscape:groupmode="layer" id="layer-ul-{num:02d}" inkscape:label="{label}">
    <g transform="translate({tx},{ty})">
      <rect x="0" y="0" width="100" height="50" fill="white"/>
      <rect x="0" y="0" width="100" height="50" fill="none" stroke="red" stroke-width="0.265"/>
      <rect x="1.2" y="1.2" width="97.6" height="47.6" fill="none" stroke="black" stroke-width="0.5"/>
      <rect x="2.4" y="2.4" width="95.2" height="45.2" fill="none" stroke="black" stroke-width="0.15"/>
      <text x="50" y="8" text-anchor="middle" font-family="Arial, sans-serif" font-size="2.8" font-weight="bold" letter-spacing="1.4" fill="black">UNIVERSAL LANGUAGE  ·  {num}</text>
      <text x="50" y="15.5" text-anchor="middle" font-family="Georgia, serif" font-size="6.5" font-style="italic" fill="black">{name}</text>
      <line x1="4.5" y1="19" x2="95.5" y2="19" stroke="black" stroke-width="0.35"/>
{hexa}
      <text x="95.5" y="24" text-anchor="end" font-family="Arial, sans-serif" font-size="2.8" font-weight="bold" letter-spacing="1" fill="black">I CHING</text>
      <text x="95.5" y="30" text-anchor="end" font-family="Georgia, serif" font-size="4.5" fill="black">{hex_name}</text>
      <line x1="26" y1="33" x2="95.5" y2="33" stroke="black" stroke-width="0.15"/>
      <text x="95.5" y="38" text-anchor="end" font-family="Arial, sans-serif" font-size="2.8" font-weight="bold" letter-spacing="1" fill="black">GENE KEYS</text>
      <text x="95.5" y="44" text-anchor="end" font-family="Georgia, serif" font-size="3.2" fill="black">{shadow} · {gift} · {siddhi}</text>
    </g>
  </g>"""


# ── Load data ──────────────────────────────────────────────────────────────
with open(JSON_PATH, encoding="utf-8") as f:
    raw = json.load(f)

cards = []
for ring in raw["codon_rings"]:
    cards.extend(ring["cards"])
cards.sort(key=lambda c: c["number"])

os.makedirs(TAGS_DIR, exist_ok=True)

# ── Generate individual SVGs ───────────────────────────────────────────────
for card in cards:
    fname = tag_filename(card["number"], card["card_name"])
    path = os.path.join(TAGS_DIR, fname)
    with open(path, "w", encoding="utf-8") as f:
        f.write(render_tag_svg(card))
    print(f"  wrote {fname}")

print(f"\n✓ {len(cards)} individual SVGs written to tags/")

# ── Generate combined laser-cut sheet (8 cols × 8 rows) ───────────────────
COLS = 8
ROWS = 8
TAG_W = 100   # mm
TAG_H = 50    # mm
GAP = 2       # mm between tags
MARGIN = 50   # mm border around all tags

content_w = COLS * TAG_W + (COLS - 1) * GAP   # 814mm
content_h = ROWS * TAG_H + (ROWS - 1) * GAP   # 414mm
sheet_w = content_w + 2 * MARGIN               # 914mm
sheet_h = content_h + 2 * MARGIN               # 514mm

layers = []
for i, card in enumerate(cards):
    col = i % COLS
    row = i // COLS
    tx = MARGIN + col * (TAG_W + GAP)
    ty = MARGIN + row * (TAG_H + GAP)
    layers.append(render_tag_inner(card, tx, ty))

combined = f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
     viewBox="0 0 {sheet_w} {sheet_h}"
     width="{sheet_w}mm" height="{sheet_h}mm">

  <!-- Sheet: {sheet_w}mm × {sheet_h}mm  |  8 cols × 8 rows  |  2mm gaps  |  50mm border -->
  <rect x="0" y="0" width="{sheet_w}" height="{sheet_h}" fill="white"/>

  <!-- Red outer border: 50mm margin around all tags -->
  <rect x="{MARGIN}" y="{MARGIN}" width="{content_w}" height="{content_h}"
        fill="none" stroke="red" stroke-width="0.265"/>

{"".join(chr(10) + layer for layer in layers)}

</svg>"""

with open(COMBINED_PATH, "w", encoding="utf-8") as f:
    f.write(combined)

print(f"✓ Combined sheet written: {sheet_w}mm × {sheet_h}mm  →  tags/all-tags-laser-cut.svg")
