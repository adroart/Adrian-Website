# Fix the piece configurator before the shop launches

Three code bugs in the buy-a-piece wizard. None are visible today (the shop is off and requests route to the inquiry page), but all three block the shop launch.

## 1. Remove the duplicated wizard between PiecePage and PieceConfigurator

There are two copies of the same wizard state, pricing math, helpers, and buy handler. Any pricing change means editing both. Fix: delete the wizard JSX and state from `PiecePage` and render `<PieceConfigurator art={art} initialSize={preferredSize} />` instead.

Blocker to handle: `PiecePage`'s sticky mobile bottom bar reads the live total and selected size from local state. Either lift state up (the configurator becomes controlled and `PiecePage` owns state), or simplify the sticky bar to "From $X · View options" plus a scroll-to-purchase.

## 2. Add the edition-closed gate to PieceConfigurator

When the shop turns on, a sold-out edition can still be bought through the inline buy wizard, because the extracted `PieceConfigurator` skips the gate that `PiecePage` has. Mirror the sold-out check (`editionSize && (editionSold ?? 0) >= editionSize`) at the top of `PieceConfigurator`.

## 3. Auto-scroll when the wizard advances from step 1 to step 2

On short phones, "Continue to options" leaves the new step below the fold, in both the buy sheet and `PiecePage`. Fix: when the step becomes 2, scroll the step-2 container (or nearest scrollable ancestor) into view smoothly.
