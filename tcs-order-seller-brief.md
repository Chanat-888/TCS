# Surface brief — TCS order tracking (seller view)

Scope: `tcs-order-seller.html` — the seller's side of the same order thread (#TCS-240915-0847) shown in [tcs-order.html](tcs-order.html), shown earlier in its timeline (right after payment, before shipping) since that is the seller's actionable moment. Visitor mode: Operate.

Audience: a seller (DragonForge) who has just been paid and needs to ship. Task: confirm the money really is held (safe to ship), enter courier + tracking number, understand that after that the ball is in the buyer's/courier's court, and get paid once the buyer approves. Constraint: static/no backend — marking as shipped is simulated client-side; buyer identity is masked (`ผู้ซื้อ ···XXX`), matching the anonymized-bidder convention already used on [tcs-auction.html](tcs-auction.html).

## Direction contract

**THESIS:** The escrow promise runs both directions — this page proves it from the seller's side (money is already safely held, you will be paid once the buyer approves) the same way the buyer's page proves it from theirs, so "trust is the product" isn't a buyer-only feature.

**OWN-WORLD:** Inherits [DESIGN.md](DESIGN.md) unchanged. Reuses the timeline component from [tcs-order.html](tcs-order.html) (done / active / pending states) and its chat panel, mirrored to the seller's perspective.

**STORY:** Seller opens the order, sees payment is confirmed held, enters courier + tracking number, marks it shipped, and sees the remaining steps (delivery, buyer approval) laid out as pending — not theirs to act on — while payout is explicitly promised once the buyer approves or the auto-approve timer fires.

**FIRST VIEWPORT:** Order summary + status timeline at the top, exactly like the buyer's page, so the two surfaces read as two views of one system rather than two different products.

**FORM:** Shaped directly from the Delivery tracking section of [vanguard-card-app-mvp.md](vanguard-card-app-mvp.md) — conventional shipping-confirmation form.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
