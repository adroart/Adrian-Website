# Archive — finished todos

Completed items move here from `TODO.md` in the same commit as the work, per the workspace
convention. Nothing is deleted; lineage is kept.

- [x] Answer the four aesthetic questions so screens can be designed _(band: you-required | effort: quick)_ — answered 2026-08-09, recorded verbatim in [the-collector-build.md](plans/the-collector-build.md) Stage 1 and [collector-design-handoff.md](plans/collector-design-handoff.md); the wording work that followed lives in [collector-screen-wording.md](plans/collector-screen-wording.md).

## 2026-08-21 — Admin artwork consolidation, and succession given a home

- [ ] **Consolidate the admin artwork section and give succession a home.** _(band: agent-runnable | effort: deep)_ The Artwork menu grew to nine links against an approved design of three, the per-artwork page that was built to be the hub was never added to the menu, and the Successor's Handbook is invisible inside the admin. Also closes a real defect: records written before launch keep serving a placeholder forever and the rebuild path has no button. → Plan: [admin-artwork-consolidation.md](todo/plans/admin-artwork-consolidation.md) · Handbook: [registry-custodian-guide.md](docs/registry-custodian-guide.md)

**Shipped.** The Artwork menu went from nine links to two, opening an artwork
became the way into the desk, and every specialist kept its address and is now
reached from the piece it belongs to. Private viewings moved to Sales. The desk
was dressed in the collector journey's own visual language, which turned out to
cost almost nothing because the stylesheet already held that palette. The kit
learned to dress a page that flows and scrolls, and two of its laws were scoped
rather than broken.

Three real defects closed along the way. Activation could report failure on a
plate it had just irreversibly activated, then answer the retry with a conflict.
Claiming, transferring and adding to a piece wrote no new record, so a record
went stale the moment someone received the work. Shine removals wrote a fresh
record every time by comparing hashes that always differ.

The Successor's Handbook came out of its zip and became `/admin/succession`,
which reports what it can genuinely check and admits the three things nothing on
the server knows. A collector can now reach the permanent record from the page a
scanned plate opens.

1139 tests, typecheck clean, deployed and verified live.

Plan: [admin-artwork-consolidation.md](plans/archive/admin-artwork-consolidation.md)
