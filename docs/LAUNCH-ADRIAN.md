# What Adrian Needs to Do

Everything that requires your hands, decisions, or creative input before (and after) launch.

---

## BEFORE LAUNCH (Blocks going live)

### Photography (The Big One)

You need real images to replace all Cloudinary placeholders. The Cloudinary pipeline is fully built. You just need to shoot, rename (or have Claude rename), and upload.

**Site-level images (41 total):**

- [ ] **Homepage:** Commission detail photo (close-up of a commissioned piece, portrait 9:11)
- [ ] **About page:** Portrait of Adrian (3:4), tea/travels photo (3:4), studio creation photo (1:1), studio atmosphere interstitial (16:9), installation space interstitial (16:9)
- [ ] **Creations category tiles (8 square images, 1:1):** Multidimensional Art, Illuminated Works, Jewelry, Oracle Cards, Tables, Installations, Objects, Spaces
- [ ] **Multidimensional Art subcategory tiles (4 square, 1:1):** Universal Language, Mandala, Light Codes, Signature Pieces
- [ ] **Subcategory page heroes (3 wide, ~3:2):** Universal Language, Light Codes, Mandala
- [ ] **Illuminated Works hero** (wide cinematic, 2:1, ideally a piece transitioning from day to dark)
- [ ] **Oracle Cards:** 4 deck covers (portrait 9:11), 4 sample cards (portrait 2:3), 1 ceremony interstitial (16:9)
- [ ] **Writings story images (6 landscape, 3:2):** Ye Ming Zhu, Mandala Series, Universal Language, Light Codes, How I Create, Way of Tea
- [ ] **Inquire page:** Hero (wide 16:9), personal commission path (portrait 5:6), spatial commission path (landscape 6:5)

**Artwork images (per piece):**
- [ ] Every piece listed on the site needs at minimum a **cover image** (1000px+ shortest side)
- [ ] Ideally 2 to 3 gallery images per piece (detail shots, alternate angles, scale reference)
- [ ] Illuminated pieces need both a daylight and a glowing/night version

**How to upload:**
1. Gather images into folders by category
2. Use Claude Chat to rename them (paste images + use the prompt in `docs/IMAGE-WORKFLOW-PLAN.md` Phase 3)
3. Upload to Cloudinary Media Library, matching the folder structure
4. Or use the Cloudinary CLI for bulk upload (see IMAGE-WORKFLOW-PLAN.md Phase 4)

### Pricing

- [ ] **Set final pricing for all pieces** by size tier
- [ ] **Set add-on pricing:** Crystals (+$?), Wood frame (+$?), Illumination by size tier
- [ ] **Set category pricing ranges:** Light Codes, Jewelry, Tables, Oracle Cards

### Stripe Setup

- [ ] **Activate Stripe live mode** in your Stripe Dashboard
- [ ] **Create real Stripe Products and Prices** for every ready-to-ship piece
- [ ] **Give the Price IDs** (e.g., `price_1T2u...`) to replace all `_REPLACE_WITH_REAL_ID` values in `mockData.ts`
- [ ] **Configure Stripe Shipping Rates** in Dashboard (Products > Shipping Rates):
  - Decide: carrier(s) from Bali (DHL, FedEx, local post?)
  - Flat rate vs. weight-based?
  - Regional rates (cheaper for SE Asia, more for Europe/US)?
  - Free shipping above a certain order value?
- [ ] **Set `STRIPE_SECRET_KEY`** (live key) in Cloudflare Pages environment variables

### Shipping & Returns Policy

- [ ] **Write or decide on:**
  - Shipping rates structure (flat rate? weight-based? regional?)
  - Customs/duties: buyer's responsibility?
  - Return policy (timeframe, conditions)
  - Damage during shipping (insurance? who bears risk?)
  - The Terms page has a basic Shipping section, but a dedicated Shipping & Returns page may be needed

### Favicon + OG Image

- [ ] **Favicon:** Pick a piece of your art or brand mark. Provide a square image (at least 512x512). I'll generate all favicon sizes.
- [ ] **OG share image:** Provide a 1200x630px image (or source image I can crop). This is what shows when your site is shared on social media.

---

## BEFORE LAUNCH (Should do, site works without them)

### Content Review

- [ ] **About page "The Root" section:** Skim for biographical accuracy. Mark anything that needs your voice.
- [ ] **Illuminated Works naming:** The page uses "Ambient Light" and "Living Light" as the two illumination modes. Change these if you have preferred terms.
- [ ] **Series hooks:** Write short intro copy for Universal Language and Mandala series (marked "Adrian: Write hooks when ready" in the code).

### Testing

- [ ] **Walk the site on your phone.** Flag any issues and I'll fix them.
- [ ] **Make a test purchase** through the full checkout flow once Stripe is live (use test card 4242 4242 4242 4242 in test mode first).

---

## FIRST WEEK AFTER LAUNCH

- [ ] Provide images for Finishes/Options modal: Natural, Painted, Crystal, LED, Framing states
- [ ] Provide tone/copy direction for post-purchase confirmation page messaging
- [ ] Review the live site analytics (Cloudflare Web Analytics is active, check the Cloudflare dashboard)

---

## FIRST MONTH (Polish + Content)

- [ ] Write intro text per category for dedicated pages (Jewelry, Oracle Cards, Tables, Installations, Objects, Spaces)
- [ ] Write more Writings content (essays, stories)
- [ ] Review SEO keyword strategy (I'll draft, you approve)

---

## FUTURE (Not for launch)

- NFT integration for legacy documentation
- QR codes on physical plaques
- Virtual tours / 3D piece viewing
- Client portal for commission progress tracking
- Events calendar
- Press / media section
- Pricing explorer tool (interactive sliders for size + finish)
- Global site search
- Welcome email sequence (requires ConvertKit/Kit automation features)
- Process videos for The Practice (Writings)
- Installation project documentation (2 to 3 projects)
