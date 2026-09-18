# Surface brief — TCS admin dispute review

Scope: `tcs-admin-dispute.html` — the Admin role (see [PRODUCT.md](PRODUCT.md) Users) reviewing one filed dispute for order #TCS-240915-0847. Visitor mode: Operate, but an internal ops tool rather than a consumer surface — density and comparison matter more than persuasion here.

Audience: an admin (TCS staff) deciding a case. Task: read the buyer's claim, compare the listing's original photos against the buyer's unboxing video, read the order chat for context, and decide — refund the buyer or release to the seller — with a resolution note both parties will see. Constraint: static/no backend; decision is simulated client-side. No admin queue/dashboard exists yet, so this is reached as a direct deep link into one case.

## Direction contract

**THESIS:** The decision is evidence-first, not narrative-first — the comparison (listing photos vs. unboxing video) sits at the visual center of the page, above the chat and above the decision controls, because that comparison is literally what the product rule says a dispute is decided from.

**OWN-WORLD:** Inherits [DESIGN.md](DESIGN.md) unchanged. Denser two-column layout than the consumer pages (evidence + chat on the left, a sticky decision panel on the right) — Operate mode for an internal tool favors information density over the single-column linear forms used elsewhere.

**STORY:** Admin opens the case, reads why the buyer disputed, compares the seller's original listing photos against the buyer's unboxing video side by side, skims the order chat for anything relevant, then picks refund-or-release via a neutral radio choice (no color bias toward either outcome) plus a required resolution note, and confirms.

**FIRST VIEWPORT:** Case summary (parties, amount, reason) immediately followed by the photo-vs-video comparison — the evidence, not a dashboard chrome, is the point of the page.

**FORM:** Shaped directly from the Dispute section of [vanguard-card-app-mvp.md](vanguard-card-app-mvp.md) ("Admin reviews listing photos vs unboxing video... Admin decides: release to seller, or refund the buyer") — conventional case-review structure.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
