#!/usr/bin/env python3
"""
Bulk upload images from Wix to Cloudinary.
Reads upload-manifest.json, skips already-uploaded images, handles oversized files
by using Wix's built-in image resizing.
"""

import json
import os
import cloudinary
import cloudinary.uploader

# Configure from the project's MCP config
with open(os.path.join(os.path.dirname(__file__), '..', '.mcp.json')) as f:
    mcp = json.load(f)
cld_url = mcp['mcpServers']['cloudinary-asset-mgmt']['env']['CLOUDINARY_URL']

# Parse cloudinary://api_key:api_secret@cloud_name
cred_part = cld_url.replace('cloudinary://', '')
api_creds, cloud_name = cred_part.split('@')
api_key, api_secret = api_creds.split(':')

cloudinary.config(
    cloud_name=cloud_name,
    api_key=api_key,
    api_secret=api_secret
)

# Load manifest
manifest_path = os.path.join(os.path.dirname(__file__), 'upload-manifest.json')
with open(manifest_path) as f:
    manifest = json.load(f)

# Flatten all images
all_images = []
for p in manifest:
    for img in p['images']:
        all_images.append(img)

print(f"Total images to process: {len(all_images)}")

# Track results
results = {"success": [], "failed": [], "skipped": []}
results_path = os.path.join(os.path.dirname(__file__), 'upload-results.json')

# Load previous results to skip already uploaded
if os.path.exists(results_path):
    with open(results_path) as f:
        prev = json.load(f)
    already_done = set(r['public_id'] for r in prev.get('success', []))
    print(f"Already uploaded: {len(already_done)} images")
else:
    already_done = set()

for i, img in enumerate(all_images):
    pid = img['public_id']

    if pid in already_done:
        results['skipped'].append(pid)
        continue

    wix_filename = img['wix_filename']

    # Use Wix resize URL to keep under 10MB limit
    # Format: /v1/fill/w_3000,h_3000,q_85/filename
    wix_url = f"https://static.wixstatic.com/media/{wix_filename}/v1/fill/w_3000,h_3000,q_85/{wix_filename}"

    # Fallback: try original first (smaller files don't need resizing)
    wix_url_original = f"https://static.wixstatic.com/media/{wix_filename}"

    print(f"  [{i+1}/{len(all_images)}] {pid.split('/')[-1]}...", end=" ", flush=True)

    try:
        # Try original first
        result = cloudinary.uploader.upload(
            wix_url_original,
            public_id=pid,
            overwrite=True,
            unique_filename=False,
            use_filename=False,
            resource_type="image"
        )
        results['success'].append({
            'public_id': pid,
            'url': result['secure_url'],
            'width': result['width'],
            'height': result['height'],
            'bytes': result['bytes'],
            'method': 'original'
        })
        print(f"OK ({result['width']}x{result['height']}, {result['bytes']//1024}KB)")
    except Exception as e:
        if "File size too large" in str(e):
            # Retry with Wix-resized version
            try:
                result = cloudinary.uploader.upload(
                    wix_url,
                    public_id=pid,
                    overwrite=True,
                    unique_filename=False,
                    use_filename=False,
                    resource_type="image"
                )
                results['success'].append({
                    'public_id': pid,
                    'url': result['secure_url'],
                    'width': result['width'],
                    'height': result['height'],
                    'bytes': result['bytes'],
                    'method': 'resized'
                })
                print(f"OK (resized: {result['width']}x{result['height']}, {result['bytes']//1024}KB)")
            except Exception as e2:
                results['failed'].append({'public_id': pid, 'error': str(e2)})
                print(f"FAILED (even resized): {e2}")
        else:
            results['failed'].append({'public_id': pid, 'error': str(e)})
            print(f"FAILED: {e}")

    # Save progress every 10 images
    if (i + 1) % 10 == 0:
        with open(results_path, 'w') as f:
            json.dump(results, f, indent=2)

# Final save
with open(results_path, 'w') as f:
    json.dump(results, f, indent=2)

print(f"\n=== DONE ===")
print(f"Success: {len(results['success'])}")
print(f"Failed: {len(results['failed'])}")
print(f"Skipped (already done): {len(results['skipped'])}")

if results['failed']:
    print("\nFailed images:")
    for f_item in results['failed']:
        print(f"  {f_item['public_id']}: {f_item['error']}")
