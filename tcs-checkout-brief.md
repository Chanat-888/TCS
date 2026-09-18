# Surface brief — TCS checkout / pay into escrow

Scope: `tcs-checkout.html` — the page a winning bidder (or buy-now buyer) lands on to actually pay. Visitor mode: Operate.

Audience: a buyer who just won or bought, about to hand over real money. Task: confirm what they're paying for, give a shipping address, pick a payment method, and pay — with the escrow promise restated at the exact moment it matters most. Constraint: static/no backend — "payment" is simulated client-side (loading → success state), no real gateway is called and no real card data is collected; per [PRODUCT.md](PRODUCT.md) the payment provider (Omise vs 2C2P) and who pays the processing fee are both still undecided, so this page shows PromptPay/card as generic method choices (not provider-branded) and a total with no invented fee line, consistent with "launch free."

## Direction contract

**THESIS:** This is the highest-stakes screen in the product — the page doesn't just take payment, it re-proves the escrow claim right where a visitor is most likely to hesitate: total, address, method, then the same trust line one more time, right above the button that moves money.

**OWN-WORLD:** Inherits [DESIGN.md](DESIGN.md) unchanged. Reuses the order-summary/seller-row language from [tcs-auction.html](tcs-auction.html) and the countdown-timer component (this is the 24h pay-or-lose-it timer, not an auction clock, but the same visual grammar).

**STORY:** Buyer arrives already committed (they won or bought), sees exactly what they owe and to whom, fills shipping + payment, pays, and immediately sees the money is held, not sent — with a concrete next step (seller ships).

**FIRST VIEWPORT:** Order summary + 24h payment countdown at the top; address, payment method, and the final pay action follow in one linear flow — no dashboard, no distractions, this is a task to finish.

**FORM:** Shaped directly from the Escrow section of [vanguard-card-app-mvp.md](vanguard-card-app-mvp.md) — a conventional linear checkout, Operate mode favors completing the task over any novelty here.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
