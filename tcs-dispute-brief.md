# Surface brief — TCS dispute (buyer-side, file a dispute)

Scope: `tcs-dispute.html` — reached from [tcs-order.html](tcs-order.html)'s "เปิดข้อพิพาท" button, same order thread (#TCS-240915-0847). Visitor mode: Operate. Admin-side review screen is a separate, not-yet-built surface (its own role — see [PRODUCT.md](PRODUCT.md)).

Audience: a buyer who is not satisfied with what they received, inside the 48h window. Task: state the problem, confirm the evidence that already exists (the unboxing video is non-optional per product rules — no video, no dispute), and understand what happens to the money while admin decides. Constraint: static/no backend — submission is simulated client-side; no real admin queue exists.

## Direction contract

**THESIS:** Filing a dispute is not an accusation into a void — the page shows exactly what evidence already backs the buyer's claim (the video that was required before they could even get here) and exactly what happens to the money next, so the moment stays procedural, not anxious.

**OWN-WORLD:** Inherits [DESIGN.md](DESIGN.md) unchanged. Reuses the order-summary block from [tcs-order.html](tcs-order.html)/[tcs-checkout.html](tcs-checkout.html), the radio-option selector from checkout's payment method, and the escrow strip.

**STORY:** Buyer picks the reason, describes what's wrong, sees the unboxing video is already attached as evidence, reads the neutral two-outcome explainer (refund or release), submits, and lands on a confirmation that money stays held and admin will decide.

**FIRST VIEWPORT:** Order context at the top so the dispute is never separated from what it's about; the reason selector is the first real decision the page asks for.

**FORM:** Shaped directly from the Dispute section of [vanguard-card-app-mvp.md](vanguard-card-app-mvp.md) — a linear form, Operate mode favors clarity here over any novelty.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
