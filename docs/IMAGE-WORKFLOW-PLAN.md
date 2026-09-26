# Image Workflow Plan: Adrian Rasmussen Art Website

> **Superseded 2026-09-24. Do not follow the delivery parts of this plan.**
> Images are no longer served from res.cloudinary.com and `utils/cloudinary.ts`
> does not exist. Originals live in the R2 bucket `adrian-website-media` and are
> served and resized at `/media/image/<id>` by the media Worker
> (`workers/media.js`). The real mechanism is in [MEDIA-DELIVERY.md](MEDIA-DELIVERY.md).
> The naming scheme and metadata sections below still describe the public IDs in use.

> This document is a complete, self-contained plan for replacing all placeholder
> images on adrianrasmussen.com with real artwork photography, served through
> Cloudinary. It is written so that any AI agent (or human) can pick it up and
> execute each phase without needing additional context.

---

## Table of Contents

1. [Context and Current State](#1-context-and-current-state)
2. [Phase 1: Cloudinary Account Setup](#2-phase-1-cloudinary-account-setup)
3. [Phase 2: Image Naming Convention](#3-phase-2-image-naming-convention)
4. [Phase 3: Rename and Tag Images with Claude](#4-phase-3-rename-and-tag-images-with-claude)
5. [Phase 4: Upload to Cloudinary](#5-phase-4-upload-to-cloudinary)
6. [Phase 5: Build the img() Helper in the Codebase](#6-phase-5-build-the-img-helper-in-the-codebase)
7. [Phase 6: Update ArtImage Component](#7-phase-6-update-artimage-component)
8. [Phase 7: Replace All Placeholder URLs in mockData.ts](#8-phase-7-replace-all-placeholder-urls-in-mockdatats)
9. [Phase 8: Replace Hardcoded Placeholder URLs in Components](#9-phase-8-replace-hardcoded-placeholder-urls-in-components)
10. [Phase 9: Testing and QA](#10-phase-9-testing-and-qa)
11. [Future: Migrating to Cloudflare Images](#11-future-migrating-to-cloudflare-images)
12. [Appendix: File Reference](#12-appendix-file-reference)

---

## 1. Context and Current State

### Tech Stack
- Vite + React 18 + React Router v7 + Tailwind CSS 4.2 + TypeScript
- No backend. All data lives in `data/mockData.ts`
- Deployed on Cloudflare Pages (merging to `main` triggers deploy)
- Site: adrianrasmussen.com

### Current Image Situation
- **Every image on the site is a placeholder** from `picsum.photos`
- URLs look like: `https://picsum.photos/1000/1000?random=1`
- These appear in two places:
  1. **`data/mockData.ts`** (artwork `coverImage`, `images[]`, product `image`, story `image`, series `image`)
  2. **Hardcoded in components** (hero, about page, illuminated works page, inquire page, multidimensional art page)

### Data Types (from `types.ts`)
```
Artwork {
  coverImage: string        // Main display image
  images: string[]          // Gallery images (detail shots, angles, etc.)
}

Product {
  image: string             // Single product image
}

Story {
  image?: string            // Optional header image for writings
}
```

### Existing Image Infrastructure
- **`components/ArtImage.tsx`** is already a centralized image component used across the site
- It supports variants: `gallery`, `tile`, `product`, `cover`
- It handles hover effects, fade-in on load, and inactive states
- It passes through all standard `<img>` attributes including `src`

### Why Cloudinary
- Free tier: 25 credits/month (more than enough for a portfolio site)
- Auto-format negotiation (WebP/AVIF based on browser)
- URL-based resizing (no build step, no image processing pipeline)
- Easy drag-and-drop media library for managing uploads
- Full export capability if migrating to Cloudflare later

---

## 2. Phase 1: Cloudinary Account Setup

### Steps
1. Go to https://cloudinary.com and sign up for a free account
2. After signup, note your **Cloud Name** from the dashboard (e.g., `adrianrasmussen`)
   - This appears in Settings > Account > Cloud name
   - It will be used in all image URLs: `https://res.cloudinary.com/{cloud-name}/image/upload/...`
3. In the Media Library, create the following folder structure:

```
adrian-website/
  creations/
    universal-language/
    mandala/
    light-codes/
    signature-pieces/
    jewelry/
    oracle-cards/
    tables/
    installations/
    objects/
    spaces/
  illuminated/
  shop/
  stories/
  site/
    hero/
    about/
    inquire/
```

4. **Optional but recommended:** In Settings > Upload, create an "Upload Preset" called `art-portfolio` with:
   - Folder: `adrian-website`
   - Format: Auto
   - Quality: Auto

---

## 3. Phase 2: Image Naming Convention

Every image uploaded to Cloudinary gets a "Public ID" which is its path + filename (without extension). Use this consistent naming scheme:

### Format
```
{category}/{series-or-context}/{descriptive-name}
```

### Examples
```
creations/universal-language/hexagram-01-creative-force
creations/universal-language/hexagram-01-creative-force-detail-1
creations/universal-language/hexagram-01-creative-force-detail-2
creations/mandala/seed-of-life-gold-leaf
creations/mandala/seed-of-life-gold-leaf-detail-1
creations/light-codes/frequency-foundations-azure-grid
creations/signature-pieces/phoenix-rising-layered-wood
creations/jewelry/sacred-geometry-pendant-silver
creations/oracle-cards/deck-spread-full
creations/tables/river-table-walnut-resin
creations/installations/immersive-light-room-bali
creations/objects/altar-bowl-bronze-patina
creations/spaces/tea-house-bamboo-exterior
shop/mandala-print-seed-of-life
stories/universal-language-essay-header
site/hero/studio-creation-process
site/about/adrian-portrait-bali
site/about/studio-atmosphere
site/about/tea-ceremony
site/inquire/commission-workspace
illuminated/mandala-glow-warm-light
illuminated/light-code-uv-detail
```

### Rules
- All lowercase, hyphens only (no spaces, no underscores)
- Descriptive of visual content (not just `IMG_4523`)
- Cover images: base name (e.g., `hexagram-01-creative-force`)
- Detail/gallery images: base name + `-detail-1`, `-detail-2`, etc.
- Keep names under 60 characters

---

## 4. Phase 3: Rename and Tag Images with Claude

Adrian has hundreds of art images on his computer that need descriptive filenames and alt text before uploading.

### Option A: Claude Chat (for batches of 5-10)

Upload images to claude.ai and prompt:

```
Here are [N] images from my [category] art series. For each one, give me:

1. A filename following this format: {series-slug}/{descriptive-name}
   - All lowercase, hyphens only
   - Describe the visual content: geometry, colors, materials, finish
   - Under 60 characters
2. Alt text (1 sentence describing what the viewer sees)
3. A short description (2-3 sentences for the website data file)

Series context: [describe the series]
```

### Option B: Batch Script Using Claude API (for hundreds of images)

Create a Python script that processes an entire folder:

```python
#!/usr/bin/env python3
"""
batch_rename_art.py
Reads images from a folder, sends each to Claude's vision API,
and generates: renamed file, alt text, description, and a manifest.

Requirements: pip install anthropic pillow

Usage: python batch_rename_art.py ./my-photos --category universal-language
"""

import anthropic
import base64
import json
import os
import sys
from pathlib import Path

client = anthropic.Anthropic()  # Uses ANTHROPIC_API_KEY env var

def process_image(image_path: str, category: str) -> dict:
    with open(image_path, "rb") as f:
        image_data = base64.standard_b64encode(f.read()).decode("utf-8")

    ext = Path(image_path).suffix.lower()
    media_type = {
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".png": "image/png", ".webp": "image/webp",
    }.get(ext, "image/jpeg")

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=500,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": media_type,
                        "data": image_data,
                    },
                },
                {
                    "type": "text",
                    "text": f"""You are helping an artist catalog artwork images.
Category: {category}

Analyze this artwork image and return JSON (no markdown):
{{
  "filename": "{category}/descriptive-name-here",
  "alt": "One sentence describing what the viewer sees",
  "description": "2-3 sentence description for a website",
  "tags": ["tag1", "tag2", "tag3"],
  "dominant_colors": ["color1", "color2"],
  "material_guess": "wood, acrylic, gold leaf, etc."
}}

Filename rules:
- All lowercase, hyphens only
- Describe the visual content: geometry pattern, colors, materials, finish
- Under 60 characters total"""
                }
            ],
        }],
    )

    return json.loads(response.content[0].text)

def main():
    folder = sys.argv[1]
    category = sys.argv[2] if len(sys.argv) > 2 else "uncategorized"

    image_extensions = {".jpg", ".jpeg", ".png", ".webp", ".tiff"}
    images = sorted([
        f for f in Path(folder).iterdir()
        if f.suffix.lower() in image_extensions
    ])

    print(f"Found {len(images)} images in {folder}")
    manifest = []

    for i, img_path in enumerate(images):
        print(f"  [{i+1}/{len(images)}] Processing {img_path.name}...")
        try:
            result = process_image(str(img_path), category)
            result["original_filename"] = img_path.name
            manifest.append(result)

            # Rename the file
            new_name = result["filename"].split("/")[-1] + img_path.suffix.lower()
            new_path = img_path.parent / new_name
            img_path.rename(new_path)
            result["renamed_to"] = str(new_path)
            print(f"    -> {new_name}")
        except Exception as e:
            print(f"    ERROR: {e}")
            manifest.append({
                "original_filename": img_path.name,
                "error": str(e)
            })

    # Write manifest
    manifest_path = Path(folder) / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    print(f"\nDone! Manifest written to {manifest_path}")
    print(f"Processed {len([m for m in manifest if 'error' not in m])}/{len(images)} images successfully")

if __name__ == "__main__":
    main()
```

### Running the Script

```bash
# Install dependencies
pip install anthropic pillow

# Set your API key
export ANTHROPIC_API_KEY="sk-ant-..."

# Process a folder of Universal Language pieces
python batch_rename_art.py ~/art-photos/universal-language universal-language

# Process mandala pieces
python batch_rename_art.py ~/art-photos/mandalas mandala

# Process light codes
python batch_rename_art.py ~/art-photos/light-codes light-codes
```

### Output

Each folder gets a `manifest.json`:
```json
[
  {
    "original_filename": "IMG_4523.jpg",
    "filename": "universal-language/hexagram-01-creative-force-gold-wood",
    "alt": "Layered wood mandala with gold leaf center radiating six-pointed geometry",
    "description": "A hexagram from the Universal Language series. Layers of laser-cut birch build depth around a gold leaf center, with concentric geometric patterns expanding outward.",
    "tags": ["hexagram", "gold-leaf", "sacred-geometry", "birch"],
    "dominant_colors": ["gold", "natural-wood", "cream"],
    "material_guess": "laser-cut birch, gold leaf, acrylic",
    "renamed_to": "/Users/adrian/art-photos/universal-language/hexagram-01-creative-force-gold-wood.jpg"
  }
]
```

---

## 5. Phase 4: Upload to Cloudinary

### Option A: Drag and Drop (small batches)
1. Open Cloudinary Media Library
2. Navigate to the correct folder (e.g., `adrian-website/creations/universal-language/`)
3. Drag and drop renamed images
4. Cloudinary auto-assigns the Public ID from the filename

### Option B: Cloudinary CLI (large batches, recommended)

```bash
# Install Cloudinary CLI
pip install cloudinary-cli

# Configure
cld config -url cloudinary://API_KEY:API_SECRET@CLOUD_NAME

# Upload an entire folder, preserving the subfolder as Cloudinary folder path
cld uploader upload "universal-language/*.jpg" folder="adrian-website/creations/universal-language" resource_type=image

cld uploader upload "mandala/*.jpg" folder="adrian-website/creations/mandala" resource_type=image

# Or upload everything at once from a structured folder
cld uploader upload "creations/**/*.jpg" folder="adrian-website" resource_type=image use_filename=true unique_filename=false
```

### Important Upload Settings
- `use_filename=true` preserves your carefully chosen filenames as the Public ID
- `unique_filename=false` prevents Cloudinary from appending random characters
- Files are accessible immediately after upload

### After Upload: Verify
Each image will be accessible at:
```
https://res.cloudinary.com/CLOUD_NAME/image/upload/adrian-website/creations/universal-language/hexagram-01-creative-force-gold-wood.jpg
```

With transformations:
```
https://res.cloudinary.com/CLOUD_NAME/image/upload/w_800,f_auto,q_auto/adrian-website/creations/universal-language/hexagram-01-creative-force-gold-wood.jpg
```

---

## 6. Phase 5: Build the img() Helper in the Codebase

Create a new file `utils/cloudinary.ts`:

```typescript
// utils/cloudinary.ts
// Centralized Cloudinary image URL builder.
// If we ever migrate to Cloudflare Images, only this file changes.

const CLOUD_NAME = 'REPLACE_WITH_YOUR_CLOUD_NAME';
const BASE = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload`;

export interface ImgOptions {
  /** Width in pixels. Omit for original size. */
  w?: number;
  /** Height in pixels. Omit for proportional scaling. */
  h?: number;
  /** Crop mode. Default: 'fill' (covers the area). Use 'fit' to contain. */
  crop?: 'fill' | 'fit' | 'scale' | 'thumb';
  /** Image quality. Default: 'auto' (Cloudinary optimizes). */
  quality?: number | 'auto';
  /** Gravity for crop. Default: 'auto' (AI-based smart crop). */
  gravity?: 'auto' | 'center' | 'face' | 'faces';
}

/**
 * Build a Cloudinary delivery URL with automatic format negotiation
 * and optional resizing.
 *
 * @param publicId - The image's Public ID in Cloudinary
 *                   (e.g., "adrian-website/creations/mandala/seed-of-life")
 * @param opts     - Transformation options
 * @returns        Full CDN URL ready for an <img> src
 *
 * @example
 * img('adrian-website/creations/mandala/seed-of-life', { w: 800 })
 * // => "https://res.cloudinary.com/xxx/image/upload/f_auto,q_auto,w_800,c_fill,g_auto/adrian-website/creations/mandala/seed-of-life"
 */
export function img(publicId: string, opts: ImgOptions = {}): string {
  const transforms: string[] = [
    'f_auto',                              // Auto WebP/AVIF
    `q_${opts.quality ?? 'auto'}`,         // Auto quality
  ];

  if (opts.w) transforms.push(`w_${opts.w}`);
  if (opts.h) transforms.push(`h_${opts.h}`);
  if (opts.w || opts.h) {
    transforms.push(`c_${opts.crop ?? 'fill'}`);
    transforms.push(`g_${opts.gravity ?? 'auto'}`);
  }

  return `${BASE}/${transforms.join(',')}/${publicId}`;
}

/**
 * Generate a srcset string for responsive images.
 *
 * @param publicId - Cloudinary Public ID
 * @param widths   - Array of widths to generate (default: [400, 800, 1200, 1600])
 * @returns        srcset attribute value
 *
 * @example
 * <img src={img(id, { w: 800 })} srcSet={srcset(id)} sizes="(max-width: 768px) 100vw, 50vw" />
 */
export function srcset(
  publicId: string,
  widths: number[] = [400, 800, 1200, 1600]
): string {
  return widths
    .map(w => `${img(publicId, { w })} ${w}w`)
    .join(', ');
}
```

---

## 7. Phase 6: Update ArtImage Component

Modify `components/ArtImage.tsx` to optionally accept a Cloudinary Public ID and auto-generate responsive srcsets:

```typescript
// Add to ArtImage.tsx props:
export interface ArtImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'className'> {
    variant?: ArtVariant;
    inactive?: boolean;
    className?: string;
    /** Cloudinary Public ID. If provided, generates optimized src + srcSet automatically. */
    publicId?: string;
}
```

In the component body, add before the return:

```typescript
// If publicId is provided, generate Cloudinary URLs
let cloudinarySrc = rest.src;
let cloudinarySrcSet: string | undefined;

if (publicId) {
    const variantWidths: Record<ArtVariant, number[]> = {
        gallery: [400, 800, 1200],
        tile: [300, 600],
        product: [400, 800],
        cover: [800, 1200, 1800],
    };
    cloudinarySrc = img(publicId, { w: variantWidths[variant][1] ?? 800 });
    cloudinarySrcSet = srcset(publicId, variantWidths[variant]);
}
```

Then in the `<img>` tag, use:
```typescript
src={cloudinarySrc}
srcSet={cloudinarySrcSet}
sizes={rest.sizes ?? (variant === 'cover' ? '100vw' : '(max-width: 768px) 100vw, 50vw')}
```

This is **backwards compatible**: existing `src=` props still work. New code can use `publicId=` instead.

---

## 8. Phase 7: Replace All Placeholder URLs in mockData.ts

### What to Change

In `data/mockData.ts`, every `picsum.photos` URL becomes a Cloudinary Public ID. The `img()` helper is called wherever these are rendered, not in the data file itself. The data file stores only the Public ID string.

**Before:**
```typescript
coverImage: 'https://picsum.photos/1000/1000?random=1',
images: ['https://picsum.photos/1000/1000?random=1a', 'https://picsum.photos/1000/1000?random=1b'],
```

**After:**
```typescript
coverImage: 'adrian-website/creations/universal-language/hexagram-01-creative-force',
images: [
  'adrian-website/creations/universal-language/hexagram-01-creative-force-detail-1',
  'adrian-website/creations/universal-language/hexagram-01-creative-force-detail-2',
],
```

### Scope of Changes in mockData.ts

The following sections contain placeholder URLs that need replacing:

1. **SERIES_DATA** (~3 entries) - each has an `image` field
2. **ARTWORKS** (~8 hand-coded + ~56 generated) - each has `coverImage` and `images[]`
3. **PRODUCTS** (derived from artworks + ~5 standalone) - each has `image`
4. **STORIES** (~3 entries) - each has an optional `image`

### Generated Artworks (the loop)

There is a loop in mockData.ts that generates ~56 placeholder artworks:
```typescript
coverImage: `https://picsum.photos/${w}/${h}?random=${100 + i}`,
```

Once real images exist, this loop should be replaced with real artwork entries. Each real artwork entry should have its actual Cloudinary Public ID.

---

## 9. Phase 8: Replace Hardcoded Placeholder URLs in Components

Several components have `picsum.photos` URLs hardcoded directly (not from mockData). These all need to be replaced with calls to `img()`:

| Component | Line(s) | What It Is |
|---|---|---|
| `components/Hero.tsx` | ~54 | Hero video source (Wix static video, not picsum, but may want to replace) |
| `components/Home.tsx` | ~72 | Commission section image |
| `components/About.tsx` | ~396, ~403, ~514, ~541, ~549 | Portrait photos, interstitial images, studio shots |
| `components/IlluminatedWorks.tsx` | ~23 | Hero image for illuminated works page |
| `components/Inquire.tsx` | ~319 | Hero image for inquiry page |
| `components/MultidimensionalArt.tsx` | ~28 | Category tile images (in a loop) |

**Example change:**

Before:
```tsx
src="https://picsum.photos/800/1200?random=about1"
```

After:
```tsx
src={img('adrian-website/site/about/adrian-portrait', { w: 800 })}
```

---

## 10. Phase 9: Testing and QA

### Checklist
- [ ] Run `npm run dev` and check every page loads images
- [ ] Open browser DevTools > Network tab, filter by "image"
  - Verify URLs point to `res.cloudinary.com`
  - Verify format is `webp` or `avif` (not jpg/png)
  - Verify images are appropriately sized (not loading 4000px images for 400px containers)
- [ ] Test on mobile (or Chrome DevTools mobile emulation)
  - Verify smaller image variants are loaded
- [ ] Check Lighthouse performance score
  - Target: 90+ on Performance
  - Images should show as "properly sized" and "next-gen formats"
- [ ] Verify Cloudinary dashboard shows reasonable credit usage
- [ ] Test all pages:
  - Homepage (hero, selected works, stories, commission image)
  - Creations landing page (category tiles)
  - Multidimensional Art hub (subcategory tiles)
  - Individual piece pages (cover image + gallery)
  - Illuminated Works page (hero image)
  - Shop (product images)
  - Writings (story images)
  - About (portrait, interstitials, studio shots)
  - Inquire (hero image)

---

## 11. Future: Migrating to Cloudflare Images

If you outgrow the free tier or want everything under Cloudflare, here's the migration path:

### Steps
1. **Export from Cloudinary:** Use the CLI sync command:
   ```bash
   cld sync --pull adrian-website ./backup-images
   ```
   This downloads all originals. You also keep them on your computer already.

2. **Export metadata:** Export tags and alt text as CSV from Cloudinary dashboard, or use the manifest.json files from the rename step.

3. **Upload to Cloudflare Images:** Use the Cloudflare API or dashboard to upload all images.

4. **Change ONE file in the codebase:**
   Replace `utils/cloudinary.ts` with:

   ```typescript
   // utils/cloudinary.ts (now Cloudflare)
   const ACCOUNT_HASH = 'REPLACE_WITH_CLOUDFLARE_ACCOUNT_HASH';
   const BASE = `https://imagedelivery.net/${ACCOUNT_HASH}`;

   export interface ImgOptions {
     w?: number;
     h?: number;
     fit?: 'cover' | 'contain' | 'scale-down';
     quality?: number;
   }

   export function img(publicId: string, opts: ImgOptions = {}): string {
     const variant = opts.w ? `w=${opts.w}` : 'public';
     return `${BASE}/${publicId}/${variant}`;
   }

   export function srcset(
     publicId: string,
     widths: number[] = [400, 800, 1200, 1600]
   ): string {
     return widths
       .map(w => `${img(publicId, { w })} ${w}w`)
       .join(', ');
   }
   ```

5. **Done.** No other files change. The `img()` function is the only abstraction layer.

### Cost Comparison Recap
| | Cloudinary Free | Cloudflare Images |
|---|---|---|
| Monthly cost | $0 | ~$5-6 |
| When you'd need to upgrade | 50K+ visitors/month | N/A (pay as you go) |
| Upgrade price | $89/month | Still ~$5-6 at portfolio scale |

---

## 12. Appendix: File Reference

### Files to Create
| File | Purpose |
|---|---|
| `utils/cloudinary.ts` | `img()` and `srcset()` helper functions |
| `batch_rename_art.py` | Script to rename images using Claude API (run locally, not part of site) |

### Files to Modify
| File | What Changes |
|---|---|
| `components/ArtImage.tsx` | Add optional `publicId` prop, generate responsive srcsets |
| `data/mockData.ts` | Replace all `picsum.photos` URLs with Cloudinary Public IDs |
| `components/Hero.tsx` | Replace placeholder video/image |
| `components/Home.tsx` | Replace commission section placeholder image |
| `components/About.tsx` | Replace 5 placeholder images (portraits, interstitials) |
| `components/IlluminatedWorks.tsx` | Replace hero placeholder image |
| `components/Inquire.tsx` | Replace hero placeholder image |
| `components/MultidimensionalArt.tsx` | Replace category tile placeholder images |
| `components/PiecePage.tsx` | Update to use `img()` when rendering artwork images |
| `components/GalleryTileCard.tsx` | Update to use `img()` for cover images |
| `components/Store.tsx` | Update to use `img()` for product images |
| `components/Writings.tsx` | Update to use `img()` for story images |
| `components/SubcategoryPage.tsx` | Update to use `img()` for series header images |

### Files That Don't Change
| File | Why |
|---|---|
| `types.ts` | Image fields stay as `string`. They just hold Public IDs now instead of full URLs. |
| `App.tsx` | No routing changes needed |
| `index.css` | No style changes needed |

---

## Execution Order Summary

```
1. Create Cloudinary account, note cloud name
2. Create folder structure in Cloudinary Media Library
3. Gather all art images on your computer into category folders
4. Use Claude (chat or batch script) to rename images and generate alt text
5. Upload renamed images to Cloudinary (drag-and-drop or CLI)
6. Create utils/cloudinary.ts with img() helper
7. Update ArtImage.tsx to support publicId prop
8. Replace picsum URLs in mockData.ts with Cloudinary Public IDs
9. Replace hardcoded picsum URLs in components with img() calls
10. Test every page, check DevTools for proper image delivery
11. Deploy to Cloudflare Pages
```

Steps 1-5 are done outside the codebase (account setup, image prep).
Steps 6-10 are code changes (can be done by an AI agent with codebase access).
Step 11 is just merging to main.
