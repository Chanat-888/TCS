# Surface brief — TCS order tracking (buyer view)

Scope: `tcs-order.html`, buyer-side view of one order. Visitor mode: Operate. Seller's tracking-number-entry view is a separate, not-yet-built surface (see [PRODUCT.md](PRODUCT.md)).

Audience: a buyer whose card has been delivered and now has to do the two things only they can do — record the unboxing video, then approve or dispute. Task: understand exactly where the order is, satisfy the video requirement, and make the approve/dispute call with the 48h window visible. Sample content continues the DragonForge / Dragonic Overlord SP thread from [tcs-auction.html](tcs-auction.html) and [tcs-checkout.html](tcs-checkout.html). Constraint: static/no backend — video "upload" and chat are simulated client-side.

## Direction contract

**THESIS:** The page proves the money flow is evidence-based, not trust-me-based — you cannot even see the approve/dispute buttons until the unboxing video exists, because that video is the one thing a dispute can be decided from.

**OWN-WORLD:** Inherits [DESIGN.md](DESIGN.md) unchanged. The status timeline reuses the vertical progress-line grammar from the landing page's "how we work" section — same mechanism, now showing one real order's own history instead of the abstract flow.

**STORY:** Buyer opens the order, sees everything that already happened (paid, shipped with courier/tracking, delivered), is blocked from approving until they upload the unboxing video, uploads it, then decides: approve (pays the seller) or dispute (48h window, admin review) — with the escrow promise restated right at that decision.

**FIRST VIEWPORT:** Order summary + status pill at the top, the full timeline immediately below it — the buyer should see exactly where they stand without scrolling into an ambiguous state.

**FORM:** Shaped directly from the Delivery tracking / Unboxing video / Dispute sections of [vanguard-card-app-mvp.md](vanguard-card-app-mvp.md) — conventional order-status structure.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
