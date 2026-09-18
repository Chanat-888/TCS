# Surface brief — TCS listing / auction detail

Scope: `tcs-auction.html`, the "product page" — a single listing's full view. Visitor mode: Operate.

Audience: a buyer deciding whether to bid, and checking the listing is legit. Task: see the card (front/back), understand price/time/increment, place a bid with confidence the seller and escrow are trustworthy. Sample content: reuses "Dragonic Overlord SP" from DragonForge (same seller/stats as [tcs-profile.html](tcs-profile.html), same listing as shown in [tcs-browse.html](tcs-browse.html)) for continuity across surfaces. Constraint: static/no backend — bidding updates client-side state only, no real persistence; buy-now/checkout is out of scope for this listing (it has no buy-now price, matching its browse-card display).

## Direction contract

**THESIS:** The bid panel proves the mechanic live — placing a bid inside the last 2 minutes visibly extends the clock, so anti-sniping isn't a line of copy, it's something that happens on screen.

**OWN-WORLD:** Inherits [DESIGN.md](DESIGN.md) unchanged. Front/back card photography reuses the established card-object language (large-scale here): a distinct front face for this specific card, and the same circuit-glow back face already established as TCS's card-back identity across the landing hero and elsewhere.

**STORY:** Visitor sees the card, checks the seller's trust signals inline (not just a name), watches the live countdown and bid history, places a bid, and sees the escrow promise restated at the moment money is about to be on the line.

**FIRST VIEWPORT:** Photo (front/back toggle) on one side, title + price + countdown + bid action on the other — the decision-relevant facts above the fold, detail/seller/history below.

**FORM:** Shaped directly from the Listing/Auction/Escrow sections of [vanguard-card-app-mvp.md](vanguard-card-app-mvp.md) — conventional product-detail structure, Operate mode favors clarity over novelty here.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
