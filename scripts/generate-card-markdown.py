#!/usr/bin/env python3
"""
Generate Markdown files for all 64 Universal Language oracle cards.
Output: oracle/ul-cards/NN - Card Name.md

Sources:
  oracle/oracle_cards_complete.json  — base data for all 64 cards
  oracle/cards/{n}.json              — expanded I Ching + Gene Keys text (card 1 only so far)
  oracle/synthesis/key_{n}.json      — synthesis readings for all 64 cards
"""

import json
import os
import re
from pathlib import Path

ROOT = Path(__file__).parent.parent
OUT_DIR = ROOT / "oracle" / "ul-cards"
OUT_DIR.mkdir(exist_ok=True)

# ── Load base data ──────────────────────────────────────────────────────────

with open(ROOT / "oracle" / "oracle_cards_complete.json") as f:
    complete = json.load(f)

# Build flat card list with ring context
all_cards = {}
for ring in complete["codon_rings"]:
    for card in ring["cards"]:
        all_cards[card["number"]] = {
            **card,
            "ring_name": ring["ring_name"],
            "ring_tarot": ring["tarot"],
            "ring_description": ring["description"],
        }

# Build number → filename map for wiki-links
def filename_stem(number, name):
    slug = re.sub(r"['\u2019]", "", name)   # strip apostrophes
    slug = re.sub(r"[^\w\s\-]", "", slug).strip()
    return f"{number:02d} - {slug}"

CARD_FILENAME = {n: filename_stem(n, c["card_name"]) for n, c in all_cards.items()}

def wikilink(number):
    return f"[[{CARD_FILENAME[number]}]]"

# ── Helpers ─────────────────────────────────────────────────────────────────

def load_json(path):
    if path.exists():
        with open(path) as f:
            return json.load(f)
    return None

def yaml_str(val):
    """Escape a string for inline YAML."""
    if val is None:
        return '""'
    val = str(val)
    if any(c in val for c in [':', '#', '[', ']', '{', '}', ',', '&', '*', '?', '|', '<', '>', '=', '!', '%', '@', '`', '"', "'"]):
        return f'"{val.replace(chr(34), chr(92) + chr(34))}"'
    return val

def block(text):
    """Return text or empty string."""
    return (text or "").strip()

# ── Card generator ───────────────────────────────────────────────────────────

def generate(number):
    card     = all_cards[number]
    expanded = load_json(ROOT / "oracle" / "cards" / f"{number}.json")
    synth    = load_json(ROOT / "oracle" / "synthesis" / f"key_{number}.json")

    name     = card["card_name"]
    subtitle = expanded["card"]["subtitle"] if expanded else ""

    siblings = card.get("codon_ring_siblings", [])
    sibling_links = ", ".join(wikilink(s) for s in siblings) if siblings else ""

    prog_partner_num = (
        expanded["gene_keys"]["programming_partner"]["number"]
        if expanded and expanded.get("gene_keys", {}).get("programming_partner")
        else synth["reference"]["programming_partner"] if synth and synth.get("reference", {}).get("programming_partner")
        else None
    )
    prog_partner_name = (
        expanded["gene_keys"]["programming_partner"]["name"]
        if expanded and expanded.get("gene_keys", {}).get("programming_partner")
        else None
    )
    prog_partner_link = wikilink(prog_partner_num) if prog_partner_num else ""

    pair_num = (
        expanded["i_ching"]["hexagrams_in_pairs"]["pair_hexagram"]
        if expanded and expanded.get("i_ching", {}).get("hexagrams_in_pairs")
        else None
    )
    pair_link = wikilink(pair_num) if pair_num else ""

    ref = synth.get("reference", {}) if synth else {}
    syn = synth.get("synthesis", {}) if synth else {}

    keywords_base  = card.get("keywords_list") or []   # oracle_cards_complete doesn't have a keyword array
    keywords_synth = synth.get("keywords", []) if synth else []
    keywords_exp   = expanded.get("keywords", []) if expanded else []
    # prefer expanded keywords, fall back to synthesis, fall back to empty
    keywords = keywords_exp or keywords_synth

    # ── YAML frontmatter ─────────────────────────────────────────────────────

    lines = ["---"]
    lines.append(f"number: {number}")
    lines.append(f"card_name: {yaml_str(name)}")
    if subtitle:
        lines.append(f"subtitle: {yaml_str(subtitle)}")
    lines.append(f"element: {yaml_str(card.get('element', ''))}")

    if keywords:
        lines.append("keywords:")
        for kw in keywords:
            lines.append(f"  - {kw}")

    if keywords_synth and keywords_synth != keywords:
        lines.append("synthesis_keywords:")
        for kw in keywords_synth:
            lines.append(f"  - {kw}")

    lines.append("")
    lines.append("codon_ring:")
    lines.append(f"  name: {yaml_str(card['ring_name'])}")
    lines.append(f"  tarot: {yaml_str(card['ring_tarot'])}")
    if ref.get("body_amino_acid"):
        lines.append(f"  amino_acid: {yaml_str(ref['body_amino_acid'])}")
    if siblings:
        sib_str = "[" + ", ".join(str(s) for s in siblings) + "]"
        lines.append(f"  siblings: {sib_str}")

    lines.append("")
    lines.append("gene_keys:")
    lines.append(f"  shadow: {yaml_str(card['gene_keys']['shadow'])}")
    lines.append(f"  gift: {yaml_str(card['gene_keys']['gift'])}")
    lines.append(f"  siddhi: {yaml_str(card['gene_keys']['siddhi'])}")
    if ref.get("body_physiology"):
        lines.append(f"  physiology: {yaml_str(ref['body_physiology'])}")
    if prog_partner_num:
        lines.append(f"  programming_partner:")
        lines.append(f"    number: {prog_partner_num}")
        if prog_partner_name:
            lines.append(f"    name: {yaml_str(prog_partner_name)}")

    ut = card["iching"]["upper_trigram"]
    lt = card["iching"]["lower_trigram"]
    lines.append("")
    lines.append("iching:")
    lines.append(f"  hexagram_number: {number}")
    lines.append(f"  hexagram_name: {yaml_str(card['iching']['hexagram_name'])}")
    if expanded:
        lines.append(f"  chinese_name: {yaml_str(expanded['i_ching']['hexagram']['chinese_name'])}")
        lines.append(f"  eranos_name: {yaml_str(expanded['i_ching']['hexagram']['english_name'])}")
    lines.append("  upper_trigram:")
    lines.append(f"    name: {yaml_str(ut['name'])}")
    lines.append(f"    glyph: {ut['symbol']}")
    if expanded:
        exp_ut = expanded["i_ching"]["trigrams"]["outer"]
        lines.append(f"    eranos_name: {yaml_str(exp_ut['trigram_name'])}")
        lines.append(f"    action: {yaml_str(exp_ut['action'])}")
        lines.append(f"    family_role: {yaml_str(exp_ut['family_role'])}")
    lines.append(f"    nature: {yaml_str(ut['nature'])}")
    lines.append("  lower_trigram:")
    lines.append(f"    name: {yaml_str(lt['name'])}")
    lines.append(f"    glyph: {lt['symbol']}")
    if expanded:
        exp_lt = expanded["i_ching"]["trigrams"]["inner"]
        lines.append(f"    eranos_name: {yaml_str(exp_lt['trigram_name'])}")
        lines.append(f"    action: {yaml_str(exp_lt['action'])}")
        lines.append(f"    family_role: {yaml_str(exp_lt['family_role'])}")
    lines.append(f"    nature: {yaml_str(lt['nature'])}")
    if pair_num:
        lines.append(f"  pair_hexagram: {pair_num}")
        if expanded:
            lines.append(f"  pair_name: {yaml_str(expanded['i_ching']['hexagrams_in_pairs']['pair_name'])}")
    if synth and syn.get("iching", {}).get("judgement_lines"):
        lines.append("  judgement_lines:")
        for jl in syn["iching"]["judgement_lines"]:
            lines.append(f"    - {yaml_str(jl)}")
    if synth and syn.get("iching", {}).get("image_lines"):
        lines.append("  image_lines:")
        for il in syn["iching"]["image_lines"]:
            lines.append(f"    - {yaml_str(il)}")

    lines.append("")
    lines.append("human_design:")
    lines.append(f"  gate: {card['human_design']['gate']}")
    lines.append(f"  keyword: {yaml_str(card['human_design']['keyword'])}")
    if ref.get("hd_center"):
        lines.append(f"  center: {yaml_str(ref['hd_center'])}")
    if ref.get("hd_circuit"):
        lines.append(f"  circuit: {yaml_str(ref['hd_circuit'])}")
    if ref.get("hd_harmonic_gate"):
        lines.append(f"  harmonic_gate: {yaml_str(ref['hd_harmonic_gate'])}")

    if ref:
        lines.append("")
        lines.append("reference:")
        for field in ["binary", "hexagram_symbol", "tarot_card", "hebrew_letter",
                      "hebrew_meaning", "path", "path_connects", "astrology", "queen_scale_color"]:
            if ref.get(field):
                lines.append(f"  {field}: {yaml_str(ref[field])}")

    if card.get("traditional_colors"):
        lines.append("")
        lines.append(f"traditional_colors: {yaml_str(card['traditional_colors'])}")

    lines.append("")
    lines.append("content_policy:")
    lines.append("  gene_keys: All Gene Keys text excerpted from The Gene Keys by Richard Rudd. No language altered.")
    lines.append("  i_ching: Eranos Yijing translation by Rudolf Ritsema and Shantena Augusto Sabbadini. Original language preserved.")
    lines.append("  attributions:")
    if expanded:
        lines.append(f"    gene_keys: {expanded['_meta']['content_policy']['attribution_link_gene_keys']}")
        lines.append(f"    i_ching: {expanded['_meta']['content_policy']['attribution_link_i_ching']}")
    else:
        lines.append(f"    gene_keys: https://genekeys.com/gene-key-{number}/")
        lines.append("    i_ching: Eranos Yijing, Rudolf Ritsema & Shantena Augusto Sabbadini")

    lines.append("---")
    lines.append("")

    # ── Body ─────────────────────────────────────────────────────────────────

    body = []

    # Nature
    if card.get("nature"):
        body.append("## Nature\n")
        body.append(block(card["nature"]))
        body.append("")

    # Essence (synthesis)
    if synth and synth.get("essence"):
        body.append("## Essence\n")
        body.append(block(synth["essence"]))
        body.append("")

    # Color
    if card.get("color_inspiration"):
        body.append("## Color\n")
        body.append(block(card["color_inspiration"]))
        body.append("")

    body.append("---")
    body.append("")

    # ── I Ching ──────────────────────────────────────────────────────────────

    body.append(f"## I Ching — Hexagram {number}: {card['iching']['hexagram_name']}\n")
    body.append("*Eranos Yijing, Rudolf Ritsema & Shantena Augusto Sabbadini*\n")

    if expanded and expanded["i_ching"].get("image_of_the_situation"):
        ios = expanded["i_ching"]["image_of_the_situation"]
        body.append("### Image of the Situation\n")
        body.append(block(ios["text"]))
        body.append("")
        if ios.get("fields_of_meaning"):
            body.append(f"> {block(ios['fields_of_meaning'])}")
            body.append("")

    if synth and syn.get("iching", {}).get("judgement_lines"):
        body.append("### Judgement\n")
        body.append("  \n".join(syn["iching"]["judgement_lines"]))
        body.append("")

    if synth and syn.get("iching", {}).get("image_lines"):
        body.append("### Image\n")
        body.append("  \n".join(syn["iching"]["image_lines"]))
        body.append("")

    if expanded and expanded["i_ching"].get("patterns_of_wisdom"):
        pw = expanded["i_ching"]["patterns_of_wisdom"]
        body.append("### Patterns of Wisdom\n")
        body.append(block(pw["nature_image"]))
        if pw.get("guidance"):
            body.append(f"\n{block(pw['guidance'])}")
        body.append("")
        if pw.get("context", {}).get("text"):
            body.append(block(pw["context"]["text"]))
            body.append("")

    if expanded and expanded["i_ching"].get("image_tradition"):
        body.append("### Image Tradition\n")
        body.append(block(expanded["i_ching"]["image_tradition"]["text"]))
        body.append("")

    # Trigrams
    body.append("### Trigrams\n")
    if expanded and expanded["i_ching"].get("trigrams"):
        trig = expanded["i_ching"]["trigrams"]
        if trig.get("overview", {}).get("text"):
            body.append(block(trig["overview"]["text"]))
            body.append("")
        outer = trig.get("outer", {})
        inner = trig.get("inner", {})
        body.append(f"**Outer trigram — {ut['name']} ({ut['symbol']}): what the world around you is doing**\n")
        if outer.get("nature_image"):
            body.append(block(outer["nature_image"]))
            body.append("")
        if outer.get("context", {}).get("text"):
            body.append(block(outer["context"]["text"]))
            body.append("")
        body.append(f"**Inner trigram — {lt['name']} ({lt['symbol']}): what is moving through you**\n")
        if inner.get("nature_image"):
            body.append(block(inner["nature_image"]))
            body.append("")
        if inner.get("context", {}).get("text"):
            body.append(block(inner["context"]["text"]))
            body.append("")
        if trig.get("family_dynamic", {}).get("text"):
            body.append(block(trig["family_dynamic"]["text"]))
            body.append("")
    else:
        body.append(f"**Upper — {ut['name']} ({ut['symbol']})**\n")
        body.append(block(ut["nature"]))
        body.append("")
        body.append(f"**Lower — {lt['name']} ({lt['symbol']})**\n")
        body.append(block(lt["nature"]))
        body.append("")

    # I Ching synthesis reading
    if synth and syn.get("iching", {}).get("trigram_combination"):
        body.append(block(syn["iching"]["trigram_combination"]))
        body.append("")
    if synth and syn.get("iching", {}).get("reading"):
        body.append("### Synthesis Reading\n")
        body.append(block(syn["iching"]["reading"]))
        body.append("")

    # In pairs
    if pair_link:
        body.append(f"### In Pairs — Hexagram {number} and {pair_num}\n")
        if expanded and expanded["i_ching"].get("hexagrams_in_pairs"):
            hip = expanded["i_ching"]["hexagrams_in_pairs"]
            if hip.get("text"):
                body.append(block(hip["text"]))
                body.append("")
            if hip.get("context", {}).get("text"):
                body.append(block(hip["context"]["text"]))
                body.append("")
        body.append(f"Pair card: {pair_link}")
        body.append("")

    # Reflection
    if expanded and expanded["i_ching"].get("reflection", {}).get("text"):
        body.append("### Reflection\n")
        body.append(block(expanded["i_ching"]["reflection"]["text"]))
        body.append("")
    elif card["iching"].get("essence"):
        body.append("### Essence\n")
        body.append(block(card["iching"]["essence"]))
        body.append("")

    body.append("---")
    body.append("")

    # ── Gene Keys ────────────────────────────────────────────────────────────

    gk = card["gene_keys"]
    body.append(f"## Gene Keys — Key {number}\n")
    body.append("*Excerpted from The Gene Keys by Richard Rudd*\n")
    body.append(f"**Shadow: {gk['shadow']} · Gift: {gk['gift']} · Siddhi: {gk['siddhi']}**\n")

    if prog_partner_link:
        pp_ctx = (
            expanded["gene_keys"]["programming_partner"]["relationship_context"]
            if expanded and expanded.get("gene_keys", {}).get("programming_partner")
            else ""
        )
        body.append(f"**Programming partner:** {prog_partner_link}")
        if pp_ctx:
            body.append(f"\n{block(pp_ctx)}")
        body.append("")

    if expanded and expanded.get("gene_keys", {}).get("codon_ring"):
        cr = expanded["gene_keys"]["codon_ring"]
        body.append(f"**Codon Ring — {cr['name']}:**")
        if cr.get("relationship_context"):
            body.append(f" {block(cr['relationship_context'])}")
        if synth and syn.get("gene_keys", {}).get("programming_partner"):
            body.append("")
            body.append(block(syn["gene_keys"]["programming_partner"]))
        body.append("")
    elif sibling_links:
        body.append(f"**Codon Ring — {card['ring_name']}:** Siblings: {sibling_links}")
        body.append("")

    body.append("---")
    body.append("")

    # Shadow
    shadow_level = expanded["gene_keys"]["shadow"] if expanded else None
    body.append(f"### Shadow: {gk['shadow']}\n")
    if shadow_level and shadow_level.get("contemplation_title"):
        body.append(f"*{shadow_level['contemplation_title']}*\n")
    if shadow_level:
        body.append(block(shadow_level.get("expanded", {}).get("text") or shadow_level.get("collapsed", {}).get("text", "")))
        body.append("")
    if synth and syn.get("gene_keys", {}).get("shadow"):
        body.append(f"**Synthesis:** {block(syn['gene_keys']['shadow'])}")
        body.append("")
    if shadow_level and shadow_level.get("repressive_nature"):
        rn = shadow_level["repressive_nature"]
        body.append(f"**Repressive — {rn['label']}:** {block(rn['description'])}")
        body.append("")
    if synth and syn.get("gene_keys", {}).get("repressive"):
        body.append(block(syn["gene_keys"]["repressive"]))
        body.append("")
    if shadow_level and shadow_level.get("reactive_nature"):
        rn = shadow_level["reactive_nature"]
        body.append(f"**Reactive — {rn['label']}:** {block(rn['description'])}")
        body.append("")
    if synth and syn.get("gene_keys", {}).get("reactive"):
        body.append(block(syn["gene_keys"]["reactive"]))
        body.append("")

    body.append("---")
    body.append("")

    # Gift
    gift_level = expanded["gene_keys"]["gift"] if expanded else None
    body.append(f"### Gift: {gk['gift']}\n")
    if gift_level and gift_level.get("contemplation_title"):
        body.append(f"*{gift_level['contemplation_title']}*\n")
    if gift_level:
        body.append(block(gift_level.get("expanded", {}).get("text") or gift_level.get("collapsed", {}).get("text", "")))
        body.append("")
    if synth and syn.get("gene_keys", {}).get("gift"):
        body.append(f"**Synthesis:** {block(syn['gene_keys']['gift'])}")
        body.append("")

    body.append("---")
    body.append("")

    # Siddhi
    siddhi_level = expanded["gene_keys"]["siddhi"] if expanded else None
    body.append(f"### Siddhi: {gk['siddhi']}\n")
    if siddhi_level and siddhi_level.get("contemplation_title"):
        body.append(f"*{siddhi_level['contemplation_title']}*\n")
    if siddhi_level:
        body.append(block(siddhi_level.get("expanded", {}).get("text") or siddhi_level.get("collapsed", {}).get("text", "")))
        body.append("")
    if synth and syn.get("gene_keys", {}).get("siddhi"):
        body.append(f"**Synthesis:** {block(syn['gene_keys']['siddhi'])}")
        body.append("")
    if not expanded and gk.get("description"):
        body.append(block(gk["description"]))
        body.append("")

    body.append("---")
    body.append("")

    # ── Human Design ─────────────────────────────────────────────────────────

    hd = card["human_design"]
    hd_center = ref.get("hd_center", "")
    hd_circuit = ref.get("hd_circuit", "")
    hd_harmonic = ref.get("hd_harmonic_gate", "")

    center_str = f" · **Center:** {hd_center}" if hd_center else ""
    circuit_str = f" · **Circuit:** {hd_circuit}" if hd_circuit else ""
    body.append(f"## Human Design — Gate {hd['gate']}: {hd['keyword']}\n")
    if hd_center or hd_circuit or hd_harmonic:
        body.append(f"**Center:** {hd_center}{' · **Circuit:** ' + hd_circuit if hd_circuit else ''}{' · **Harmonic Gate:** ' + hd_harmonic if hd_harmonic else ''}\n")
    body.append(block(hd["description"]))
    body.append("")
    if synth and syn.get("human_design", {}).get("gate"):
        body.append(block(syn["human_design"]["gate"]))
        body.append("")
    if synth and syn.get("human_design", {}).get("channel"):
        body.append(f"**Channel:**\n\n{block(syn['human_design']['channel'])}")
        body.append("")
    if synth and syn.get("human_design", {}).get("circuit"):
        body.append(f"**Circuit:**\n\n{block(syn['human_design']['circuit'])}")
        body.append("")

    body.append("---")
    body.append("")

    # ── Tarot ────────────────────────────────────────────────────────────────

    tarot_card = ref.get("tarot_card") or card["ring_tarot"]
    hebrew = ref.get("hebrew_letter", "")
    astrology = ref.get("astrology", "")
    path = ref.get("path", "")
    body.append(f"## Tarot — {tarot_card}\n")
    meta_parts = []
    if card["ring_name"]:
        meta_parts.append(card["ring_name"])
    if sibling_links:
        meta_parts.append(f"Keys {', '.join(str(s) for s in [number] + siblings)}")
    if path:
        meta_parts.append(f"Path {path}")
    if ref.get("path_connects"):
        meta_parts.append(ref["path_connects"])
    if astrology:
        meta_parts.append(astrology)
    if hebrew:
        meta_parts.append(f"Hebrew: {hebrew}")
    if meta_parts:
        body.append(f"*{' · '.join(meta_parts)}*\n")
    if ref.get("hebrew_meaning"):
        body.append(f"*{ref['hebrew_meaning']}*\n")
    if synth and syn.get("tarot", {}).get("ring_role"):
        body.append(block(syn["tarot"]["ring_role"]))
        body.append("")
    if synth and syn.get("tarot", {}).get("tarot_resonance"):
        body.append(block(syn["tarot"]["tarot_resonance"]))
        body.append("")

    body.append("---")
    body.append("")

    # ── Body / Physiology ────────────────────────────────────────────────────

    physiology = ref.get("body_physiology", "")
    amino_acid = ref.get("body_amino_acid", "")
    if physiology or amino_acid:
        title_parts = [p for p in [physiology, amino_acid] if p]
        body.append(f"## Body — {' and '.join(title_parts)}\n")
        if synth and syn.get("body", {}).get("physiology"):
            body.append(f"**{physiology}:** {block(syn['body']['physiology'])}")
            body.append("")
        if synth and syn.get("body", {}).get("amino_acid"):
            body.append(f"**{amino_acid}:** {block(syn['body']['amino_acid'])}")
            body.append("")
        body.append("---")
        body.append("")

    # ── Creator's Voice ──────────────────────────────────────────────────────

    body.append("## Creator's Voice\n")
    creator = expanded.get("creator_voice", {}) if expanded else {}
    if creator.get("personal_reading"):
        body.append(block(creator["personal_reading"]))
    else:
        body.append("*To be written.*")
    body.append("")

    # ── Assemble ─────────────────────────────────────────────────────────────

    return "\n".join(lines) + "\n".join(body)


# ── Run ──────────────────────────────────────────────────────────────────────

generated = 0
for number in sorted(all_cards.keys()):
    card     = all_cards[number]
    stem     = CARD_FILENAME[number]
    out_path = OUT_DIR / f"{stem}.md"
    content  = generate(number)
    with open(out_path, "w") as f:
        f.write(content)
    generated += 1
    print(f"  {stem}.md")

print(f"\n{generated} cards written to oracle/ul-cards/")
