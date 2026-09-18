# Surface brief — TCS leave a review

Scope: `tcs-review.html` — reached from [tcs-order.html](tcs-order.html)'s completed-order state ("ให้คะแนนร้านค้า", which previously dead-linked to the profile page). Visitor mode: Operate.

Audience: a buyer whose order just completed. Task: rate the seller, optionally tag what went well, optionally write a comment, submit. Constraint: static/no backend — submission is simulated; per [PRODUCT.md](PRODUCT.md)/spec, reviews only exist after a completed order and there are no fake reviews, which this page satisfies structurally (it's only reachable from a completed order, never a bare "write a review" entry point).

## Direction contract

**THESIS:** Reviewing is fast because the order already proved itself (delivered, video, approved) — the form doesn't ask the buyer to re-litigate the transaction, just to rate and optionally say why.

**OWN-WORLD:** Inherits [DESIGN.md](DESIGN.md) unchanged. The submitted-review preview reuses the exact review-item component from [tcs-profile.html](tcs-profile.html), so what the buyer sees at the end is literally what will appear there.

**STORY:** Buyer sees the order they're reviewing, picks a star rating (with a plain-language label that updates per star), optionally taps a few quick tags and writes a comment, submits, and sees their review rendered exactly as it will appear on the seller's profile.

**FIRST VIEWPORT:** Order context + the star rating control — rating is the one required decision, everything below it is optional detail.

**FORM:** Shaped directly from the Review/trust section of [vanguard-card-app-mvp.md](vanguard-card-app-mvp.md) — a short, conventional review form.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
