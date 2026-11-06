# Piece configurator adoption — completed 6 November 2026

[PR #158](https://github.com/adroart/Adrian-Website/pull/158), reviewed head `6b7b940a9e112227ad0cdd0c76930a5649170403`, is verified live through merge `34ffd2b1c29aca480bc13ce688d075fb505729c6`, deployment `850b8580-b476-4456-99ac-4526e6b52c08`. Immutable and public-site bytes, exact release marker and protected account-route revision agree.

## One wizard

PiecePage now mounts `PieceConfigurator`. Removed its duplicate variant selection, add-on state, pricing and cart handler. The mobile variant bar shows the catalog starting price and opens View options; selected configuration stays with the wizard and reaches the inquiry. Supported cart serialization shipped separately through #156.

## Edition guard

Adopted the saved #153 extracted-component guard while retaining the page's closed-edition path. An edition at or above its size offers a similar-piece inquiry rather than configuration. This closes the previous unmounted-source residual; it does not assert a historical live bypass.

## Phone review navigation

Explicit Continue/review actions scroll the new review section into view and respect reduced motion. A supplied initial size skips selection only when it exists in the catalog. Desktop and phone journeys verify selected58cm+crystals, catalog total$1,141 and the same configuration on the inquiry form. Existing failed-send retry remains intact.

The candidate passed1,349 unit checks, typecheck/build and10 production-build browser journeys. Checkout and Living Legacy remain off. Fixed shipping/lead-time promises were removed; actual logistics and publication remain owner decisions. There is no selectable finish field and no new claim of signed-in cross-device purchase, live payment, physical delivery or collector ownership acceptance.
