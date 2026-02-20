# Stripe Cart Integration Plan

## Context

The shop at `/shop` has a full product grid with search, filtering, and "Buy Now" buttons — but they all point to `https://buy.stripe.com/PLACEHOLDER`. There is no cart, no checkout, and no payment processing. This plan adds a complete shopping cart with Stripe Checkout Sessions, deployed via Cloudflare Pages Functions.

---

## What YOU Need to Do (Manual Steps)

These cannot be done by an agent:

1. **Create a Stripe account** at https://dashboard.stripe.com/register
2. **Copy your API keys** from Developers > API keys:
   - Secret key (`sk_test_...` for testing, `sk_live_...` for production)
3. **Set environment variables in Cloudflare Dashboard:**
   - Go to your Pages project > Settings > Environment variables
   - Add `STRIPE_SECRET_KEY` = your secret key
   - Use test key for Preview, live key for Production
4. **For local development**, create a `.dev.vars` file (I'll add it to `.gitignore`):
   ```
   STRIPE_SECRET_KEY=sk_test_your_key_here
   ```

---

## What I Will Build

### New Files (6)

| File | Purpose |
|------|---------|
| `context/CartContext.tsx` | Cart state provider + `useCart()` hook with localStorage persistence |
| `components/CartDrawer.tsx` | Right-sliding cart panel (matches existing InspectionDrawer pattern) |
| `components/CartIcon.tsx` | Shopping bag icon with count badge for navigation |
| `components/CheckoutSuccess.tsx` | Post-payment success page, clears cart |
| `components/CheckoutCancel.tsx` | Cancelled checkout page, cart preserved |
| `functions/api/checkout.ts` | Cloudflare Pages Function — creates Stripe Checkout Sessions |

### Modified Files (6)

| File | Change |
|------|--------|
| `types.ts` | Add `CartItem` and `CartState` interfaces |
| `App.tsx` | Wrap with `CartProvider`, add checkout routes, mount `CartDrawer` |
| `Navigation.tsx` | Add `CartIcon` to desktop and mobile nav |
| `Store.tsx` | "Buy Now" → "Add to Cart" button in InspectionDrawer |
| `PiecePage.tsx` | "Buy Now" → "Add to Cart" button |
| `package.json` | Add `stripe` dependency, add `dev:full` script for local Wrangler |

### `.gitignore` updated to include `.dev.vars`

---

## Architecture

```
User clicks "Add to Cart"
  → CartContext adds item to state + localStorage
  → Cart drawer auto-opens showing items
  → User clicks "Checkout"
  → POST /api/checkout with cart items
  → Cloudflare Worker creates Stripe Checkout Session
  → User redirected to Stripe-hosted checkout page
  → On success: redirect to /checkout/success (cart cleared)
  → On cancel: redirect to /checkout/cancel (cart preserved)
```

### Cart State (React Context + localStorage)

- `useReducer` for state management (ADD_ITEM, REMOVE_ITEM, UPDATE_QUANTITY, CLEAR_CART)
- Items denormalized (title, price, image stored with cart item) so cart works across sessions
- 7-day expiry on localStorage data
- `isCartOpen` / `openCart` / `closeCart` co-located in context so any component can trigger the drawer
- Only `isReadyToShip` products can be added (made-to-order still goes to `/inquire`)

### Stripe Backend (Cloudflare Pages Function)

- Uses `price_data` (inline pricing) — no need to sync a Stripe product catalog
- Validates: non-empty cart, max 20 items, quantities 1-10
- Enables shipping address collection
- Returns the Stripe Checkout URL for redirect

### Cart UI (follows existing patterns)

- Right-sliding drawer via `createPortal` (same as InspectionDrawer in Store.tsx)
- Same animation, backdrop blur, body scroll lock pattern
- Existing design language: `wood-*`, `bronze-*`, `paper-*` colors, `font-mono` labels, `font-serif` content
- Quantity controls (+ / -), remove button, subtotal, checkout button
- Empty state with link to /shop

---

## Implementation Order

1. `types.ts` — add CartItem/CartState types
2. `npm install stripe` — install dependency
3. `context/CartContext.tsx` — create provider + hook
4. `components/CartIcon.tsx` — nav badge component
5. `components/CartDrawer.tsx` — cart panel UI
6. `components/CheckoutSuccess.tsx` + `CheckoutCancel.tsx` — route pages
7. `App.tsx` — wrap with CartProvider, add routes, mount CartDrawer
8. `Navigation.tsx` — add CartIcon
9. `Store.tsx` — change Buy Now → Add to Cart
10. `PiecePage.tsx` — change Buy Now → Add to Cart
11. `functions/api/checkout.ts` — Stripe serverless function
12. `.dev.vars` + `.gitignore` — environment setup
13. `package.json` — add dev:full script

---

## Verification

1. Run `npm run dev` — confirm site loads, cart icon appears in nav with 0 count
2. Go to `/shop`, open a ready-to-ship product, click "Add to Cart" — drawer opens with item
3. Add multiple items, adjust quantities, remove items — verify state and localStorage
4. Refresh page — cart items persist from localStorage
5. Run `npm run dev:full` (with `.dev.vars` configured) — test full checkout flow
6. Click "Checkout" — should redirect to Stripe test checkout page
7. Use Stripe test card `4242 4242 4242 4242` — complete payment
8. Verify redirect to `/checkout/success` and cart is cleared
9. Test cancel flow — verify redirect to `/checkout/cancel` with cart intact
10. Verify made-to-order items still link to `/inquire` (not add to cart)
