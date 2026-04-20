#!/usr/bin/env python3
"""
merge-all-sources-into-markdown.py

Rebuilds all 64 oracle/ul-cards/*.md files by combining every available data source.

Usage:
    python3 scripts/merge-all-sources-into-markdown.py           # full batch
    python3 scripts/merge-all-sources-into-markdown.py --dry-run # preview cards 1, 2, 14

Sources used:
  REPO  oracle/synthesis/key_N.json        — synthesis text, essence, reference table
  REPO  oracle/cards/1.json                — card 1 richer hand-authored expanded text
  SRC   cards/oracle_cards_enriched.json   — base data + I Ching translations + trigrams
  SRC   gene_keys_data.json               — Gene Keys prose excerpts (shadow/gift/siddhi)
  SRC   acupresence_data.json             — victim + dilemma fields

Never touches any file outside oracle/ul-cards/.
"""

import json
import sys
import re
from pathlib import Path

REPO = Path(__file__).parent.parent
SOURCE = Path("/Users/adrianrasmussen/Documents/Files/1 Projects/Oracle Cards/Universal Langauge/Source Material")


def load(path: Path) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def title_case(s: str) -> str:
    """Convert ALL CAPS string to title case, keeping small words lowercase."""
    small = {"a", "an", "the", "and", "but", "or", "for", "nor", "on", "at",
             "to", "by", "in", "of", "up", "as", "is"}
    words = s.lower().split()
    result = []
    for i, w in enumerate(words):
        result.append(w if (i > 0 and w in small) else w.capitalize())
    return " ".join(result)


def card_slug(num: int, card_map: dict) -> str:
    if num not in card_map:
        return f"{num:02d} - Unknown"
    name = card_map[num]["card_name"].replace("'", "").replace("\u2019", "")
    return f"{num:02d} - {name}"


def pair_hex(n: int) -> int:
    """I Ching King Wen sequence: odd hex pairs with next, even hex pairs with previous."""
    return n + 1 if n % 2 == 1 else n - 1


def flatten_cards(codon_ring_data: list) -> tuple[dict, dict]:
    """Return (number→card_dict, number→ring_dict) from codon_rings list."""
    card_map = {}
    ring_map = {}
    for ring in codon_ring_data:
        for card in ring.get("cards", []):
            n = card["number"]
            card_map[n] = card
            ring_map[n] = {
                "name": ring["ring_name"],
                "tarot": ring.get("tarot", ""),
                "description": ring.get("description", ""),
            }
    return card_map, ring_map


def para(text: str) -> str:
    """Ensure text ends with a single newline."""
    return text.strip() + "\n"


def build_frontmatter(n: int, card: dict, ring: dict, synth: dict,
                       gk_data: dict, card_map: dict) -> str:
    ref = synth.get("reference", {})
    gk = card.get("gene_keys", {})
    iching = card.get("iching", {})
    upper = iching.get("upper_trigram", {})
    lower = iching.get("lower_trigram", {})

    card_name = card["card_name"]

    # Subtitle from chapter title
    chapter = gk_data.get("chapter_title", "")
    subtitle = title_case(chapter) if chapter else ""

    # Keywords: synthesis keywords first (richer), fall back to gene_keys names
    synth_kw = synth.get("keywords", [])
    keywords_yaml = "\n".join(f"  - {k}" for k in synth_kw) if synth_kw else (
        f"  - {gk.get('shadow', '')}\n  - {gk.get('gift', '')}\n  - {gk.get('siddhi', '')}"
    )

    # Programming partner
    pp_num = gk_data.get("programming_partner") or ref.get("programming_partner")
    pp_name = card_map[pp_num]["card_name"] if (pp_num and pp_num in card_map) else ""

    # Siblings (exclude self)
    siblings = [s for s in card.get("codon_ring_siblings", []) if s != n]

    # Ring amino acid from gk_data (stored in ALL CAPS, convert to title case)
    amino = title_case(gk_data.get("amino_acid", ref.get("body_amino_acid", "")))

    # I Ching fields
    hex_name = iching.get("hexagram_name", "")
    eranos_name = ""  # derived below from hex_name pattern
    pair_n = pair_hex(n)
    pair_name = card_map[pair_n]["card_name"] if pair_n in card_map else ""

    # Judgement / image lines from synthesis (authoritative)
    synth_iching = synth.get("synthesis", {}).get("iching", {})
    j_lines = synth_iching.get("judgement_lines", [])
    img_lines = synth_iching.get("image_lines", [])

    def yaml_lines(lines):
        return "\n".join(f"    - \"{l}\"" for l in lines)

    # HD fields
    hd = card.get("human_design", {})
    harmonic = ref.get("hd_harmonic_gate", hd.get("harmonic_gate", ""))

    # Reference fields
    binary = ref.get("binary", "")
    hex_symbol = ref.get("hexagram_symbol", "")
    tarot_card = ref.get("tarot_card", "")
    hebrew_letter = ref.get("hebrew_letter", "")
    hebrew_meaning = ref.get("hebrew_meaning", "")
    path = ref.get("path", "")
    path_connects = ref.get("path_connects", "")
    astrology = ref.get("astrology", "")
    queen_color = ref.get("queen_scale_color", "")

    traditional_colors = card.get("traditional_colors", "")

    # Sibling wiki-links for frontmatter list
    siblings_list = json.dumps(siblings) if siblings else "[]"

    pp_block = ""
    if pp_num:
        pp_block = f"""  programming_partner:
    number: {pp_num}
    name: {pp_name}"""
    else:
        pp_block = f"  programming_partner: ~"

    # Build the judgement/image YAML safely
    j_yaml = "\n".join(f'    - "{l}"' for l in j_lines) if j_lines else ""
    img_yaml = "\n".join(f'    - "{l}"' for l in img_lines) if img_lines else ""

    subtitle_line = f'subtitle: "{subtitle}"' if subtitle else ""
    pair_block = f"""  pair_hexagram: {pair_n}
  pair_name: {pair_name}""" if pair_n in card_map else ""

    fm = f"""---
number: {n}
card_name: "{card_name}"
{subtitle_line}
element: "{card.get('element', '')}"
keywords:
{keywords_yaml}

codon_ring:
  name: {ring['name']}
  tarot: {ring['tarot']}
  amino_acid: {amino}
  siblings: {siblings_list}

gene_keys:
  shadow: {gk.get('shadow', '')}
  gift: {gk.get('gift', '')}
  siddhi: {gk.get('siddhi', '')}
  physiology: {title_case(gk_data.get('physiology', ref.get('body_physiology', '').lower()))}
{pp_block}

iching:
  hexagram_number: {n}
  hexagram_name: "{hex_name}"
  upper_trigram:
    name: "{upper.get('name', '')}"
    glyph: {upper.get('symbol', '')}
    nature: "{upper.get('nature', '')}"
  lower_trigram:
    name: "{lower.get('name', '')}"
    glyph: {lower.get('symbol', '')}
    nature: "{lower.get('nature', '')}"
{pair_block}
  judgement_lines:
{j_yaml}
  image_lines:
{img_yaml}

human_design:
  gate: {hd.get('gate', n)}
  keyword: {hd.get('keyword', '')}
  center: {ref.get('hd_center', '')}
  circuit: {ref.get('hd_circuit', '')}
  harmonic_gate: "{harmonic}"

reference:
  binary: {binary}
  hexagram_symbol: {hex_symbol}
  tarot_card: {tarot_card}
  hebrew_letter: {hebrew_letter}
  hebrew_meaning: "{hebrew_meaning}"
  path: {path}
  path_connects: {path_connects}
  astrology: {astrology}
  queen_scale_color: {queen_color}

traditional_colors: "{traditional_colors}"

content_policy:
  gene_keys: All Gene Keys text excerpted from The Gene Keys by Richard Rudd. No language altered.
  i_ching: Sources include Eranos Yijing (Ritsema & Sabbadini), Wilhelm translation, and Practical Guide to the I Ching.
  attributions:
    gene_keys: https://genekeys.com/gene-key-{n}/
    i_ching_eranos: Eranos Yijing, Rudolf Ritsema & Shantena Augusto Sabbadini
    i_ching_wilhelm: The I Ching or Book of Changes, Richard Wilhelm translation
---"""

    return fm


def build_iching_section(n: int, card: dict, synth: dict, card_map: dict,
                          card1_expanded: dict = None) -> str:
    iching = card.get("iching", {})
    upper = iching.get("upper_trigram", {})
    lower = iching.get("lower_trigram", {})
    synth_iching = synth.get("synthesis", {}).get("iching", {})

    hex_name = iching.get("hexagram_name", f"Hexagram {n}")
    j_lines = synth_iching.get("judgement_lines", [])
    img_lines = synth_iching.get("image_lines", [])
    trigram_combo = synth_iching.get("trigram_combination", "")
    reading = synth_iching.get("reading", "")

    # I Ching text from enriched card (blends Eranos + Wilhelm + Practical)
    oracle_image = iching.get("essence", "")        # Eranos oracle image
    eranos_desc = iching.get("situation", "")       # Eranos description
    wisdom = iching.get("wisdom", "")               # Eranos patterns of wisdom
    wilhelm_j = iching.get("judgement", "")         # Wilhelm judgement
    wilhelm_img = iching.get("image", "")           # Wilhelm image
    oracle_text = iching.get("oracle", "")          # Practical guide

    # Pair
    pair_n = pair_hex(n)
    pair_name = card_map[pair_n]["card_name"] if pair_n in card_map else ""
    pair_slug = card_slug(pair_n, card_map) if pair_n in card_map else ""

    lines = []
    lines.append(f"\n## I Ching — Hexagram {n}: {hex_name}\n")
    lines.append("*Eranos Yijing, Rudolf Ritsema & Shantena Augusto Sabbadini*\n")

    # Card 1: use the richer cards/1.json structure
    if n == 1 and card1_expanded:
        c1 = card1_expanded
        c1_iching = c1.get("i_ching", {})

        img_sit = c1_iching.get("image_of_the_situation", {})
        if img_sit.get("text"):
            lines.append("\n### Image of the Situation\n")
            lines.append(img_sit["text"] + "\n")
            fom = img_sit.get("fields_of_meaning", "")
            if fom:
                lines.append(f"\n> {fom}\n")

        if j_lines:
            lines.append("\n### Judgement\n")
            lines.append("  \n".join(j_lines) + "\n")

        if img_lines:
            lines.append("\n### Image\n")
            lines.append("  \n".join(img_lines) + "\n")

        pow_block = c1_iching.get("patterns_of_wisdom", {})
        if pow_block:
            lines.append("\n### Patterns of Wisdom\n")
            lines.append(pow_block.get("nature_image", "") + "\n")
            lines.append("\n" + pow_block.get("guidance", "") + "\n")
            ctx = pow_block.get("context", {}).get("text", "")
            if ctx:
                lines.append(f"\n{ctx}\n")

        img_trad = c1_iching.get("image_tradition", {})
        if img_trad.get("text"):
            lines.append("\n### Image Tradition\n")
            lines.append(img_trad["text"] + "\n")

        # Trigrams
        trig = c1_iching.get("trigrams", {})
        if trig:
            lines.append("\n### Trigrams\n")
            overview = trig.get("overview", {}).get("text", "")
            if overview:
                lines.append(overview + "\n")
            outer = trig.get("outer", {})
            if outer:
                glyph = outer.get("glyph", upper.get("symbol", ""))
                lines.append(f"\n**Outer trigram — {outer.get('trigram_name', upper.get('name', ''))} ({glyph}): what the world around you is doing**\n")
                lines.append("\n" + outer.get("nature_image", upper.get("nature", "")) + "\n")
                ctx = outer.get("context", {}).get("text", "")
                if ctx:
                    lines.append("\n" + ctx + "\n")
            inner = trig.get("inner", {})
            if inner:
                glyph = inner.get("glyph", lower.get("symbol", ""))
                lines.append(f"\n**Inner trigram — {inner.get('trigram_name', lower.get('name', ''))} ({glyph}): what is moving through you**\n")
                lines.append("\n" + inner.get("nature_image", lower.get("nature", "")) + "\n")
                ctx = inner.get("context", {}).get("text", "")
                if ctx:
                    lines.append("\n" + ctx + "\n")
            fd = trig.get("family_dynamic", {}).get("text", "")
            if fd:
                lines.append("\n" + fd + "\n")
        if trigram_combo:
            lines.append("\n" + trigram_combo + "\n")

        if reading:
            lines.append("\n### Synthesis Reading\n")
            lines.append(reading + "\n")

        pairs = c1_iching.get("hexagrams_in_pairs", {})
        if pairs:
            pair_hex_n = pairs.get("pair_hexagram", pair_n)
            pair_hex_name = pairs.get("pair_name", pair_name)
            lines.append(f"\n### In Pairs — Hexagram {n} and {pair_hex_n}\n")
            p_text = pairs.get("text", "")
            if p_text:
                lines.append(p_text + "\n")
            p_ctx = pairs.get("context", {}).get("text", "")
            if p_ctx:
                lines.append("\n" + p_ctx + "\n")
            lines.append(f"\nPair card: [[{card_slug(pair_hex_n, card_map)}]]\n")

        refl = c1_iching.get("reflection", {}).get("text", "")
        if refl:
            lines.append("\n### Reflection\n")
            lines.append(refl + "\n")

    else:
        # Cards 2–64: use enriched card + separate translations
        if oracle_image:
            lines.append("\n### Oracle Image\n")
            lines.append(oracle_image + "\n")

        if eranos_desc:
            lines.append(f"\n> {eranos_desc}\n")

        if j_lines:
            lines.append("\n### Judgement\n")
            lines.append("  \n".join(j_lines) + "\n")

        if img_lines:
            lines.append("\n### Image\n")
            lines.append("  \n".join(img_lines) + "\n")

        if wisdom:
            lines.append("\n### Patterns of Wisdom\n")
            lines.append(wisdom + "\n")

        if wilhelm_j or wilhelm_img:
            lines.append("\n### Wilhelm Translation\n")
            lines.append("*Richard Wilhelm, rendered by Cary F. Baynes*\n")
            if wilhelm_j:
                lines.append(f"\n**Judgement:** {wilhelm_j}\n")
            if wilhelm_img:
                lines.append(f"\n**Image:** {wilhelm_img}\n")

        if oracle_text:
            lines.append("\n### Practical Oracle Reading\n")
            lines.append(oracle_text + "\n")

        # Trigrams
        if upper or lower or trigram_combo:
            lines.append("\n### Trigrams\n")
            if upper:
                lines.append(f"**Upper — {upper.get('name', '')} ({upper.get('symbol', '')})**\n")
                lines.append("\n" + upper.get("nature", "") + "\n")
            if lower:
                lines.append(f"\n**Lower — {lower.get('name', '')} ({lower.get('symbol', '')})**\n")
                lines.append("\n" + lower.get("nature", "") + "\n")
            if trigram_combo:
                lines.append("\n" + trigram_combo + "\n")

        if reading:
            lines.append("\n### Synthesis Reading\n")
            lines.append(reading + "\n")

        if pair_slug:
            lines.append(f"\n### In Pairs — Hexagram {n} and {pair_n}\n")
            lines.append(f"\nPair card: [[{pair_slug}]]\n")

    return "\n".join(lines)


def build_gene_keys_section(n: int, card: dict, synth: dict, gk_data: dict,
                              card_map: dict, card1_expanded: dict = None) -> str:
    gk = card.get("gene_keys", {})
    shadow_name = gk.get("shadow", "")
    gift_name = gk.get("gift", "")
    siddhi_name = gk.get("siddhi", "")

    synth_gk = synth.get("synthesis", {}).get("gene_keys", {})

    pp_num = gk_data.get("programming_partner")
    pp_slug = card_slug(pp_num, card_map) if pp_num else None

    siblings = [s for s in card.get("codon_ring_siblings", []) if s != n]
    ring_name = ""
    # We'll get ring_name from outside; pass ring dict if needed
    # For now inline it from gk_data
    ring_label = title_case(gk_data.get("codon_ring", ""))

    sibling_links = ", ".join(f"[[{card_slug(s, card_map)}]]" for s in siblings)

    lines = []
    lines.append(f"\n## Gene Keys — Key {n}\n")
    lines.append("*Excerpted from The Gene Keys by Richard Rudd*\n")
    lines.append(f"\n**Shadow: {shadow_name} · Gift: {gift_name} · Siddhi: {siddhi_name}**\n")

    if pp_slug:
        lines.append(f"\n**Programming partner:** [[{pp_slug}]]\n")

    if siblings:
        ring_display = ring_label if ring_label else f"Ring"
        lines.append(f"\n**Codon Ring — {ring_display}:** {sibling_links}\n")

    pp_text = synth_gk.get("programming_partner", "")
    if pp_text:
        lines.append(f"\n{pp_text}\n")

    lines.append("\n---\n")

    # --- SHADOW ---
    lines.append(f"\n### Shadow: {shadow_name}\n")

    if n == 1 and card1_expanded:
        c1_gk = card1_expanded.get("gene_keys", {})
        c1_shadow = c1_gk.get("shadow", {})
        contemp = c1_shadow.get("contemplation_title", "")
        if contemp:
            lines.append(f"\n*{contemp}*\n")
        expanded = c1_shadow.get("expanded", {}).get("text", "") or c1_shadow.get("collapsed", {}).get("text", "")
        if expanded:
            lines.append(f"\n{expanded}\n")
    else:
        shadow_essence = gk_data.get("shadow", {}).get("essence", "")
        if shadow_essence:
            lines.append(f"\n{shadow_essence}\n")

    synth_shadow = synth_gk.get("shadow", "")
    if synth_shadow:
        lines.append(f"\n**Synthesis:** {synth_shadow}\n")

    # Repressive
    rep_data = gk_data.get("shadow", {}).get("repressive", {})
    rep_name = rep_data.get("name", "Repressive")
    rep_desc = rep_data.get("description", "")

    if n == 1 and card1_expanded:
        c1_rep = card1_expanded.get("gene_keys", {}).get("shadow", {}).get("repressive_nature", {})
        rep_name = c1_rep.get("label", rep_name)
        rep_desc = c1_rep.get("description", rep_desc)

    if rep_desc:
        lines.append(f"\n**Repressive — {rep_name}:** {rep_desc}\n")
    synth_rep = synth_gk.get("repressive", "")
    if synth_rep:
        lines.append(f"\n{synth_rep}\n")

    # Reactive
    react_data = gk_data.get("shadow", {}).get("reactive", {})
    react_name = react_data.get("name", "Reactive")
    react_desc = react_data.get("description", "")

    if n == 1 and card1_expanded:
        c1_react = card1_expanded.get("gene_keys", {}).get("shadow", {}).get("reactive_nature", {})
        react_name = c1_react.get("label", react_name)
        react_desc = c1_react.get("description", react_desc)

    if react_desc:
        lines.append(f"\n**Reactive — {react_name}:** {react_desc}\n")
    synth_react = synth_gk.get("reactive", "")
    if synth_react:
        lines.append(f"\n{synth_react}\n")

    lines.append("\n---\n")

    # --- GIFT ---
    lines.append(f"\n### Gift: {gift_name}\n")

    if n == 1 and card1_expanded:
        c1_gk = card1_expanded.get("gene_keys", {})
        c1_gift = c1_gk.get("gift", {})
        contemp = c1_gift.get("contemplation_title", "")
        if contemp:
            lines.append(f"\n*{contemp}*\n")
        expanded = c1_gift.get("expanded", {}).get("text", "") or c1_gift.get("collapsed", {}).get("text", "")
        if expanded:
            lines.append(f"\n{expanded}\n")
    else:
        gift_essence = gk_data.get("gift", {}).get("essence", "")
        if gift_essence:
            lines.append(f"\n{gift_essence}\n")

    synth_gift = synth_gk.get("gift", "")
    if synth_gift:
        lines.append(f"\n**Synthesis:** {synth_gift}\n")

    lines.append("\n---\n")

    # --- SIDDHI ---
    lines.append(f"\n### Siddhi: {siddhi_name}\n")

    if n == 1 and card1_expanded:
        c1_gk = card1_expanded.get("gene_keys", {})
        c1_siddhi = c1_gk.get("siddhi", {})
        contemp = c1_siddhi.get("contemplation_title", "")
        if contemp:
            lines.append(f"\n*{contemp}*\n")
        expanded = c1_siddhi.get("expanded", {}).get("text", "") or c1_siddhi.get("collapsed", {}).get("text", "")
        if expanded:
            lines.append(f"\n{expanded}\n")
    else:
        siddhi_essence = gk_data.get("siddhi", {}).get("essence", "")
        if siddhi_essence:
            lines.append(f"\n{siddhi_essence}\n")

    synth_siddhi = synth_gk.get("siddhi", "")
    if synth_siddhi:
        lines.append(f"\n**Synthesis:** {synth_siddhi}\n")

    return "\n".join(lines)


def build_hd_section(card: dict, synth: dict) -> str:
    hd = card.get("human_design", {})
    gate = hd.get("gate", "")
    keyword = hd.get("keyword", "")
    desc = hd.get("description", "")

    ref = synth.get("reference", {})
    center = ref.get("hd_center", "")
    circuit = ref.get("hd_circuit", "")
    harmonic = ref.get("hd_harmonic_gate", "")

    synth_hd = synth.get("synthesis", {}).get("human_design", {})

    lines = []
    lines.append(f"\n## Human Design — Gate {gate}: {keyword}\n")
    lines.append(f"\n**Center:** {center} · **Circuit:** {circuit} · **Harmonic Gate:** {harmonic}\n")

    if desc:
        lines.append(f"\n{desc}\n")

    gate_text = synth_hd.get("gate", "")
    if gate_text and gate_text != desc:
        lines.append(f"\n{gate_text}\n")

    channel_text = synth_hd.get("channel", "")
    if channel_text:
        lines.append(f"\n**Channel:**\n\n{channel_text}\n")

    circuit_text = synth_hd.get("circuit", "")
    if circuit_text:
        lines.append(f"\n**Circuit:**\n\n{circuit_text}\n")

    return "\n".join(lines)


def build_tarot_section(n: int, ring: dict, synth: dict, card_map: dict) -> str:
    ref = synth.get("reference", {})
    tarot_card = ref.get("tarot_card", "")
    path = ref.get("path", "")
    path_connects = ref.get("path_connects", "")
    astrology = ref.get("astrology", "")
    hebrew_letter = ref.get("hebrew_letter", "")
    hebrew_meaning = ref.get("hebrew_meaning", "")

    synth_tarot = synth.get("synthesis", {}).get("tarot", {})
    ring_role = synth_tarot.get("ring_role", "")
    resonance = synth_tarot.get("tarot_resonance", "")

    ring_name = ring["name"]
    ring_tarot = ring["tarot"]

    # Sibling keys in same ring (for the subtitle line)
    siblings = []
    for nn, rd in [(n, ring)]:
        pass  # ring_map not passed; we'll skip the keys list

    lines = []
    lines.append(f"\n## Tarot — {tarot_card}\n")
    sub_parts = []
    if ring_name:
        sub_parts.append(ring_name)
    if path:
        sub_parts.append(f"Path {path}")
    if path_connects:
        sub_parts.append(path_connects)
    if astrology:
        sub_parts.append(astrology)
    if hebrew_letter:
        sub_parts.append(f"Hebrew: {hebrew_letter}")
    if sub_parts:
        lines.append(f"\n*{' · '.join(sub_parts)}*\n")
    if hebrew_meaning:
        lines.append(f"\n*{hebrew_meaning}*\n")

    if ring_role:
        lines.append(f"\n{ring_role}\n")

    if resonance:
        lines.append(f"\n{resonance}\n")

    return "\n".join(lines)


def build_body_section(synth: dict) -> str:
    ref = synth.get("reference", {})
    physiology = ref.get("body_physiology", "")
    amino_acid = ref.get("body_amino_acid", "")

    synth_body = synth.get("synthesis", {}).get("body", {})
    phys_text = synth_body.get("physiology", "")
    amino_text = synth_body.get("amino_acid", "")

    if not physiology and not amino_acid:
        return ""

    lines = []
    lines.append(f"\n## Body — {physiology} and {amino_acid}\n")
    if phys_text:
        lines.append(f"\n**{physiology}:** {phys_text}\n")
    if amino_text:
        lines.append(f"\n**{amino_acid}:** {amino_text}\n")

    return "\n".join(lines)


def build_card_markdown(n: int, card: dict, ring: dict, synth: dict,
                         gk_data: dict, acup: dict, card_map: dict,
                         card1_expanded: dict = None) -> str:
    acup_gk = acup.get("gene_keys", {})
    victim = acup_gk.get("victim", "")
    dilemma = acup_gk.get("dilemma", "")

    gk = card.get("gene_keys", {})

    parts = []

    # Frontmatter
    parts.append(build_frontmatter(n, card, ring, synth, gk_data, card_map))

    # Nature
    nature = card.get("nature", "")
    if nature:
        parts.append(f"\n## Nature\n\n{nature}\n")

    # Essence (from synthesis)
    essence = synth.get("essence", "")
    if essence:
        parts.append(f"\n## Essence\n\n{essence}\n")

    # Color
    color = card.get("color_inspiration", "")
    if color:
        parts.append(f"\n## Color\n\n{color}\n")

    # Victim / Dilemma (inline after Color if available)
    if victim or dilemma:
        vd_parts = []
        if victim:
            vd_parts.append(f"**Victim pattern:** {victim}")
        if dilemma:
            vd_parts.append(f"**Dilemma:** {dilemma}")
        parts.append("\n" + "  \n".join(vd_parts) + "\n")

    parts.append("\n---\n")

    # I Ching
    parts.append(build_iching_section(n, card, synth, card_map, card1_expanded))

    parts.append("\n---\n")

    # Gene Keys
    parts.append(build_gene_keys_section(n, card, synth, gk_data, card_map, card1_expanded))

    parts.append("\n---\n")

    # Human Design
    parts.append(build_hd_section(card, synth))

    parts.append("\n---\n")

    # Tarot
    parts.append(build_tarot_section(n, ring, synth, card_map))

    parts.append("\n---\n")

    # Body
    body_section = build_body_section(synth)
    if body_section:
        parts.append(body_section)
        parts.append("\n---\n")

    # Creator's Voice
    parts.append("\n## Creator's Voice\n\n*To be written.*\n")

    return "\n".join(parts)


def main():
    dry_run = "--dry-run" in sys.argv

    # Load sources
    print("Loading sources...")
    enriched = load(SOURCE / "cards/oracle_cards_enriched.json")
    gk_data_all = load(SOURCE / "gene_keys_data.json")
    acup_all = load(SOURCE / "acupresence_data.json")
    card1_expanded = load(REPO / "oracle/cards/1.json")

    card_map, ring_map = flatten_cards(enriched["codon_rings"])
    print(f"  Loaded {len(card_map)} cards from oracle_cards_enriched.json")

    # Load synthesis files
    synth_map = {}
    for i in range(1, 65):
        p = REPO / f"oracle/synthesis/key_{i}.json"
        if p.exists():
            synth_map[i] = load(p)
    print(f"  Loaded {len(synth_map)} synthesis files")

    output_dir = REPO / "oracle/ul-cards"
    output_dir.mkdir(parents=True, exist_ok=True)

    cards_to_process = [1, 2, 14] if dry_run else list(range(1, 65))
    if dry_run:
        print(f"\nDRY RUN — previewing cards {cards_to_process}\n")

    results = {"ok": [], "skip": [], "err": []}

    for n in cards_to_process:
        if n not in card_map:
            print(f"  SKIP {n:02d}: not in oracle_cards_enriched")
            results["skip"].append(n)
            continue
        if n not in synth_map:
            print(f"  SKIP {n:02d}: no synthesis/key_{n}.json found")
            results["skip"].append(n)
            continue

        card = card_map[n]
        ring = ring_map[n]
        synth = synth_map[n]
        gk_data = gk_data_all.get(str(n), {})
        acup = acup_all.get(str(n), {})
        expanded = card1_expanded if n == 1 else None

        try:
            md = build_card_markdown(n, card, ring, synth, gk_data, acup,
                                      card_map, expanded)

            card_name_clean = card["card_name"].replace("'", "").replace("\u2019", "")
            filename = f"{n:02d} - {card_name_clean}.md"
            out_path = output_dir / filename

            if dry_run:
                print(f"\n{'='*60}")
                print(f"PREVIEW: {filename}")
                print(f"{'='*60}")
                print(md[:3000])
                if len(md) > 3000:
                    print(f"\n... [{len(md) - 3000} more chars] ...")
                print()
            else:
                out_path.write_text(md, encoding="utf-8")
                line_count = md.count("\n")
                print(f"  OK  {filename} ({line_count} lines, {len(md)} chars)")
                results["ok"].append(n)

        except Exception as e:
            print(f"  ERR {n:02d}: {e}")
            results["err"].append(n)
            if dry_run:
                import traceback
                traceback.print_exc()

    if not dry_run:
        print(f"\nDone. {len(results['ok'])} written, {len(results['skip'])} skipped, {len(results['err'])} errors.")
        if results["err"]:
            print(f"Error cards: {results['err']}")


if __name__ == "__main__":
    main()
