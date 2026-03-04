#!/usr/bin/env python3
"""
Generate TypeScript Artwork entries from upload-manifest.json.

Reads the manifest (which was derived from catalog_products.csv) and produces
a TypeScript file with all 133 Artwork objects ready to paste into mockData.ts.
"""

import json
import re
import html
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
MANIFEST = SCRIPT_DIR / "upload-manifest.json"
OUTPUT = SCRIPT_DIR / "generated-artworks.ts"


def strip_html(text: str) -> str:
    """Strip HTML tags and decode entities, clean up whitespace."""
    if not text:
        return ""
    # Remove HTML tags
    text = re.sub(r"<[^>]+>", " ", text)
    # Decode HTML entities
    text = html.unescape(text)
    # Replace &nbsp; and non-breaking spaces
    text = text.replace("\xa0", " ")
    # Collapse whitespace
    text = re.sub(r"\s+", " ", text).strip()
    return text


def parse_dimensions(raw: str) -> str | None:
    """Parse dimensions from Wix HTML field into clean string."""
    if not raw:
        return None
    text = strip_html(raw)
    if not text:
        return None
    # Remove "This measures " prefix variants
    text = re.sub(r"^This measures\s*(around\s*)?", "", text, flags=re.IGNORECASE)
    # Clean up remaining text
    text = text.strip().rstrip(".")
    if not text:
        return None
    return text


def clean_title(name: str) -> str:
    """Clean product name for display title."""
    # Strip leading dashes/spaces
    name = re.sub(r"^[-\s]+", "", name)
    # Remove "copy of" prefixes
    name = re.sub(r"^copy\s+of\s+", "", name, flags=re.IGNORECASE)
    # Title case if all lower
    if name == name.lower():
        name = name.title()
    return name.strip()


def determine_category_and_series(product: dict) -> tuple[str, str | None, str | None, bool]:
    """
    Returns (category, series, subcategory, isSignaturePiece).
    """
    collection = product["collection"]
    desc = product["description"]
    folder = product["folder"]

    if collection == "Mandalas":
        return ("Multidimensional Art", "Mandala", None, False)

    if collection == "Light Codes":
        # Determine subcategory from description
        subcategory = None
        for sub in ["Resonant Formations", "Frequency Foundations", "Embodied Vibrations"]:
            if sub in desc:
                subcategory = sub
                break
        return ("Multidimensional Art", "Light Codes", subcategory, False)

    if collection == "Fine Art":
        if "There's a language" in desc or "There\u2019s a language" in desc:
            return ("Multidimensional Art", "Universal Language", None, False)
        else:
            return ("Multidimensional Art", None, None, True)

    if collection == "Sphere Stands":
        return ("Objects", None, None, False)

    # Uncategorized - check folder for hints
    if "mandala" in folder:
        return ("Multidimensional Art", "Mandala", None, False)
    if "signature" in folder:
        return ("Multidimensional Art", None, None, True)
    if "uncategorized" in folder:
        # Leave as uncategorized for Adrian to sort
        return ("Multidimensional Art", None, None, True)

    return ("Multidimensional Art", None, None, False)


def determine_availability(visible: str) -> str:
    """Map Wix visible field to AvailabilityStatus."""
    if visible.lower() == "false":
        return "SOLD"
    return "READY_TO_SHIP"


def generate_id(collection: str, series: str | None, is_sig: bool, counters: dict) -> str:
    """Generate a unique ID like MAN-001, LC-001, etc.

    Starts after hand-coded entries in mockData.ts:
    - UL: 001, 009 exist -> start at 100
    - LC: 042 exists -> start at 100
    - SIG: 001 exists -> start at 100
    - ILLUM: 001 exists -> start at 100
    """
    if series == "Mandala":
        prefix = "MAN"
    elif series == "Light Codes":
        prefix = "LC"
    elif series == "Universal Language":
        prefix = "UL"
    elif is_sig:
        prefix = "SIG"
    elif collection == "Sphere Stands":
        prefix = "OBJ"
    else:
        prefix = "UNC"

    # Start at 100 for prefixes that have hand-coded entries
    if prefix not in counters:
        start_offsets = {"UL": 99, "LC": 99, "SIG": 99, "MAN": 0, "OBJ": 0, "UNC": 0}
        counters[prefix] = start_offsets.get(prefix, 0)

    counters[prefix] = counters[prefix] + 1
    return f"{prefix}-{counters[prefix]:03d}"


def escape_ts_string(s: str) -> str:
    """Escape a string for TypeScript single-quoted literal."""
    s = s.replace("\\", "\\\\")
    s = s.replace("'", "\\'")
    s = s.replace("\n", "\\n")
    return s


def generate_entry(product: dict, counters: dict) -> str:
    """Generate a single TypeScript Artwork object."""
    category, series, subcategory, is_sig = determine_category_and_series(product)
    art_id = generate_id(product["collection"], series, is_sig, counters)
    title = clean_title(product["name"])
    description = strip_html(product["description"])
    dimensions = parse_dimensions(product["dimensions"])
    availability = determine_availability(product["visible"])
    price = float(product["price"]) if product["price"] else None

    # Image public IDs
    cover_image = product["images"][0]["public_id"] if product["images"] else "adrian-website/placeholders/artwork-square-1"
    detail_images = [img["public_id"] for img in product["images"][1:]] if len(product["images"]) > 1 else []

    # Determine material from description or defaults
    material = None
    if category == "Objects":
        material = "Laser Cut Wood"
    elif series == "Mandala":
        material = "Laser Cut Wood, Acrylic, Gemstones"
    elif series == "Light Codes":
        material = "Laser Etched Wood"
    elif series == "Universal Language":
        material = "Laser Cut Wood, Acrylic"
    elif is_sig:
        # Check description for hints
        desc_lower = description.lower()
        if "pencil" in desc_lower or "drawing" in desc_lower or "draw" in desc_lower:
            material = "Pencil on Paper"
        elif "paint" in desc_lower:
            material = "Laser Cut Wood, Acrylic"
        else:
            material = "Mixed Media"

    # Build the object
    lines = []
    lines.append("    {")
    lines.append(f"        id: '{escape_ts_string(art_id)}',")
    lines.append(f"        title: '{escape_ts_string(title)}',")
    lines.append(f"        category: '{escape_ts_string(category)}',")
    if series:
        lines.append(f"        series: '{escape_ts_string(series)}',")
    lines.append(f"        coverImage: '{escape_ts_string(cover_image)}',")
    if detail_images:
        imgs_str = ", ".join(f"'{escape_ts_string(img)}'" for img in detail_images)
        lines.append(f"        images: [{imgs_str}],")
    else:
        lines.append("        images: [],")
    lines.append(f"        description: '{escape_ts_string(description)}',")
    lines.append("        year: '2024',")
    if dimensions:
        lines.append(f"        dimensions: '{escape_ts_string(dimensions)}',")
    if material:
        lines.append(f"        material: '{escape_ts_string(material)}',")
    lines.append(f"        availability: '{availability}',")
    if price and availability != "SOLD":
        lines.append(f"        price: {int(price)},")
    elif price:
        lines.append(f"        price: {int(price)},")
    lines.append("        featured: false,")
    if is_sig:
        lines.append("        isSignaturePiece: true,")
    if subcategory:
        lines.append(f"        subcategory: '{escape_ts_string(subcategory)}',")
    lines.append("    },")

    return "\n".join(lines)


def main():
    with open(MANIFEST) as f:
        products = json.load(f)

    counters: dict[str, int] = {}
    entries = []

    # Group by collection for organized output
    collection_order = ["Fine Art", "Mandalas", "Light Codes", "Sphere Stands", ""]
    collection_labels = {
        "Fine Art": "Fine Art (Universal Language + Signature Pieces)",
        "Mandalas": "Mandalas",
        "Light Codes": "Light Codes",
        "Sphere Stands": "Sphere Stands (Objects)",
        "": "Uncategorized",
    }

    for collection in collection_order:
        items = [p for p in products if p["collection"] == collection]
        if not items:
            continue

        # Sort: UL items first within Fine Art, then alphabetical
        if collection == "Fine Art":
            def sort_key(p):
                is_ul = "There's a language" in p["description"]
                return (0 if is_ul else 1, p["name"])
            items.sort(key=sort_key)
        else:
            items.sort(key=lambda p: p["name"])

        entries.append(f"    // --- {collection_labels[collection]} ---")
        for product in items:
            entries.append(generate_entry(product, counters))
            entries.append("")  # blank line between entries

    # Write output
    output_lines = []
    output_lines.append("// Generated from catalog_products.csv via generate-mockdata.py")
    output_lines.append("// 133 products migrated from old Wix site")
    output_lines.append("// Phase 2: Adrian reviews and edits descriptions, prices, featured status")
    output_lines.append("")
    output_lines.append("// Paste these entries into the FULL_ARCHIVE array in data/mockData.ts")
    output_lines.append("// (replacing the generated for-loop at lines 441-488)")
    output_lines.append("")

    for entry in entries:
        output_lines.append(entry)

    output_text = "\n".join(output_lines)

    with open(OUTPUT, "w") as f:
        f.write(output_text)

    # Print stats
    print(f"Generated {sum(counters.values())} artwork entries:")
    for prefix, count in sorted(counters.items()):
        labels = {
            "UL": "Universal Language",
            "MAN": "Mandala",
            "LC": "Light Codes",
            "SIG": "Signature Pieces",
            "OBJ": "Objects (Sphere Stands)",
            "UNC": "Uncategorized",
        }
        print(f"  {prefix}: {count} ({labels.get(prefix, prefix)})")
    print(f"\nOutput written to: {OUTPUT}")


if __name__ == "__main__":
    main()
