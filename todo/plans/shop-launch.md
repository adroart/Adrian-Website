# Turn the shop on

The shop is built but switched off. `LAUNCH_FLAGS.shopEnabled` is `false` in `src/launchFlags.ts`, so "Add to Cart" routes to the inquiry page and all price IDs are placeholders. The flip at the end is small; everything below has to be true first.

## Set up Stripe (live mode)

Switch to live mode and create Products and Prices for every ready-to-ship piece and all Universal Language size variants (29 / 58 / 90 cm). Replace every `price_REPLACE` and `_REPLACE_WITH_REAL_ID` in `data/mockData.ts`. Configure shipping rates in the Stripe dashboard: carrier, flat vs weight-based, regional rates, free-shipping threshold.

## Decide pricing

Final pricing for all pieces by size tier. Add-on pricing for crystals, wood frame, illumination per size tier, and custom frame. Category ranges for Light Codes, Jewelry, Tables, Oracle Cards. Current Universal Language placeholders are $395 / $1,111 / $2,500.

## Set the Cloudflare Pages environment variables

- `STRIPE_SECRET_KEY` (live `sk_live_...`)
- `VITE_STRIPE_PUBLISHABLE_KEY` (live `pk_live_...`)
- `RESEND_API_KEY` (inquiry emails are silent without this)
- Verify `VITE_KIT_FORM_ID` and `VITE_KIT_PUBLIC_API_KEY` are set.

## Write the launch content

- Shipping and returns policy content. Cover where pieces ship from, domestic vs international timelines, ready-to-ship (~2-3 weeks typical), commissioned work (ships on completion), packaging and insurance, returns and exchanges, customs and import duties. Per the no-business-location rule, do not name Bali. Claude builds the page component once the content lands.
- Universal Language piece descriptions. All 22 currently say "Number [N] in the Universal Language series." Write a short unique paragraph for each.
- Other content: Illuminated Works voice (2-3 sentences, replaces the placeholder in `IlluminatedWorks.tsx`), the About page "The Root" review for biographical accuracy, a favicon source (512x512 square), and an OG share image (1200x630).

## Curate the homepage

Choose 10-20 pieces for the homepage Selected Works grid. Ensure at least one full series is populated end-to-end (images, descriptions, pricing) before shipping.

## Flip the flag

When all of the above is true: real Stripe price IDs are in, then set `LAUNCH_FLAGS.shopEnabled` to `true`.
