# Adrian Tasks

Everything that requires your hands, decisions, or creative input. Nothing here can be done by code alone.

---

## Blocks Launch

These must be done before the site can go live. Nothing else matters until these are handled.

### Photography (the big one)

The Cloudinary pipeline is built. You shoot, upload, and update the public IDs in mockData.ts (or tell Claude the filenames and it updates the code).

**Site-level images (40+ needed):**
- [ ] Homepage: commission detail photo (portrait 9:11)
- [ ] About page: portrait (3:4), tea/travels (3:4), studio creation (1:1), 2 interstitials (16:9)
- [ ] Creations category tiles: 8 square images (1:1)
- [ ] Multidimensional Art subcategory tiles: 4 square (1:1)
- [ ] Subcategory page heroes: Universal Language, Light Codes, Mandala (3:2)
- [ ] Illuminated Works hero (2:1, ideally day-to-dark transition)
- [ ] Oracle Cards: 4 deck covers (9:11), 4 sample cards (2:3), 1 ceremony interstitial (16:9)
- [ ] Writings story images: 6 landscape (3:2)
- [ ] Inquire page: hero (16:9), personal path (5:6), spatial path (6:5)

**Artwork images (per piece):**
- [ ] Every piece: cover image (1000px+ shortest side)
- [ ] Ideally 2-3 gallery images per piece (detail, angles, scale)
- [ ] Illuminated pieces: daylight + glowing/night versions

**How to upload:**
1. Photograph pieces (consistent lighting, multiple angles per piece)
2. Upload to Cloudinary under the `adrian-website/` folder structure
3. Update public IDs in `data/mockData.ts` (coverImage, images arrays)
4. Update site-level images in components (About, Inquire, IlluminatedWorks, etc.)

**Key files to update:**
- `data/mockData.ts` — 24+ artwork entries with placeholder coverImage/images
- Components using `adrian-website/placeholders/` public IDs: Home, About, Inquire, IlluminatedWorks, OracleCards, Creations, MultidimensionalArt, Store

**Notes:**
- `utils/cloudinary.ts` handles responsive srcSet generation automatically
- `ArtImage.tsx` supports both `publicId` (Cloudinary) and `src` (plain URL) props
- ArtImage has an error fallback that shows "Image unavailable" if a path doesn't exist

### Stripe + Payments
- [ ] Activate Stripe live mode
- [ ] Create Products + Prices for every ready-to-ship piece
- [ ] Create Products + Prices for all UL sizeVariants (29 cm, 58 cm, 90 cm)
- [ ] Replace all `price_REPLACE` and `_REPLACE_WITH_REAL_ID` values in mockData.ts
- [ ] Configure Shipping Rates in Stripe Dashboard
- [ ] Decide: carrier(s) from Bali, flat vs weight-based, regional rates, free shipping threshold?

**Steps:**
1. Create products in Stripe Dashboard matching your inventory
2. Create Price objects for each product (one-time prices)
3. Update `data/mockData.ts` INVENTORY entries with real `stripePriceId` values
4. Test checkout flow end-to-end on a staging deploy
5. Switch from Stripe test mode to live mode

**Key files:** `data/mockData.ts` (stripePriceId per product), `functions/api/checkout.js` (Checkout Sessions).
Cart system and checkout flow are already built. Consider setting up Stripe webhooks for order fulfillment notifications.

### Environment Variables (Cloudflare Pages Dashboard)
- [ ] `STRIPE_SECRET_KEY` (live `sk_live_...`)
- [ ] `VITE_STRIPE_PUBLISHABLE_KEY` (live `pk_live_...`)
- [ ] `RESEND_API_KEY` (`re_...`) - inquiry emails won't send without this
- [ ] Verify `VITE_KIT_FORM_ID` and `VITE_KIT_PUBLIC_API_KEY` are set

### Pricing Decisions
- [ ] Final pricing for all pieces by size tier
- [ ] Add-on pricing: crystals, wood frame, illumination (per size tier), custom frame
- [ ] Category pricing ranges: Light Codes, Jewelry, Tables, Oracle Cards
- [ ] Current UL sizeVariant placeholders: $395 / $1,111 / $2,500 - confirm or change

### Content + Policy
- [ ] **22 UL piece descriptions** - currently all say "Number [N] in the Universal Language series." Write a short unique description for each.
- [ ] **Illuminated Works voice** - 2-3 sentences in your voice (TODO in IlluminatedWorks.tsx:50-51)
- [ ] **About page "The Root"** - review for biographical accuracy
- [ ] **Shipping & returns policy** - write content covering: where pieces ship from (Bali), domestic vs international timelines, ready-to-ship (2-3 weeks typical), commissioned work (ships on completion), packaging and insurance, returns/exchanges, customs and import duties (buyer responsibility or included). Claude will create the page component and route once content is written.
- [ ] **Favicon** - pick artwork or brand mark, provide 512x512 square image
- [ ] **OG share image** - provide 1200x630 image (or source to crop). Shows when site is shared on social.

### Curation
- [ ] **Curate Selected Works for homepage** - choose 10-20 pieces for the homepage grid
- [ ] **At least one series fully populated** - all pieces with real images, descriptions, and pricing before launch

---

## Before Launch (should do, site works without them)

- [ ] Walk the site on your phone and flag issues
- [ ] Make a test purchase through checkout (use Stripe test card 4242 4242 4242 4242)

---

## First Week After Launch

- [ ] Provide images for Finishes/Options modal (Natural, Painted, Crystal, LED, Framing)
- [ ] Illumination demo videos (15-30s, loop-friendly, day-to-dark transitions for LED pieces)
- [ ] Provide tone/copy direction for post-purchase confirmation page
- [ ] Review Cloudflare Web Analytics dashboard
- [ ] Build newsletter welcome sequence in Kit dashboard (3 emails: welcome, story, invitation)
- [ ] Decide newsletter frequency approach ("as inspired, not scheduled"?)

---

## First Month

- [ ] Write intro text per category for dedicated pages (Jewelry, Oracle Cards, Tables, Installations, Objects, Spaces)
- [ ] Flesh out "Objects" category (sphere holders, incense, dimensional pieces) with descriptions
- [ ] Write more Writings content (essays, stories)
- [ ] Publish at least one piece in The Path (Writings)
- [ ] Review SEO keyword strategy (Claude drafts, you approve)
- [ ] Decide: newsletter signup link on Welcome page?
- [ ] Decide: newsletter signup in mobile hamburger menu?
