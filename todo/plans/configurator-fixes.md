# Fix the piece configurator before the shop launches

Remaining wizard work before shop launch. The shop stays off and requests route to the inquiry page. Cart serialization for supported size/add-on choices shipped separately through [PR #156](https://github.com/adroart/Adrian-Website/pull/156), verified live at `0fb16f18` on 2026-11-05; this does not complete the three items below or signed-in cross-device acceptance. There is no selectable finish field in the current wizard.

## 1. Remove the duplicated wizard between PiecePage and PieceConfigurator

There are two copies of the same wizard state, pricing math, helpers, and buy handler. Any pricing change means editing both. Fix: delete the wizard JSX and state from `PiecePage` and render `<PieceConfigurator art={art} initialSize={preferredSize} />` instead.

Blocker to handle: `PiecePage`'s sticky mobile bottom bar reads the live total and selected size from local state. Either lift state up (the configurator becomes controlled and `PiecePage` owns state), or simplify the sticky bar to "From $X · View options" plus a scroll-to-purchase.

## 2. Add the edition-closed gate to PieceConfigurator

The extracted `PieceConfigurator` skips the gate that the mounted `PiecePage` already has, but current source does not import or mount that extracted component. This is a latent source defect, not a demonstrated live purchase bypass. [Source PR #153](https://github.com/adroart/Adrian-Website/pull/153) mirrors the existing sold-out check (`editionSize && (editionSold ?? 0) >= editionSize`) and has synthetic desktop/phone guard checks; it remains unintegrated future work and is excluded from live #156. Preserve the mounted page's existing guard when deciding whether to adopt the extraction.

## 3. Auto-scroll when the wizard advances from step 1 to step 2

On short phones, "Continue to options" leaves the new step below the fold, in both the buy sheet and `PiecePage`. Fix: when the step becomes 2, scroll the step-2 container (or nearest scrollable ancestor) into view smoothly.
