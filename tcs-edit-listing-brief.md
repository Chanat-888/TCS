# Surface brief — TCS edit listing (seller, post-bid)

Scope: `tcs-edit-listing.html` — editing the same listing built in [tcs-create-listing.html](tcs-create-listing.html) / shown live in [tcs-auction.html](tcs-auction.html), now shown with its existing bid history (5 bids, current ฿4,200). Visitor mode: Operate.

Audience: DragonForge, wanting to touch up their own listing after bidding has already started. Task: understand that almost everything is locked now, and that description is the one thing they can still change — with any change to it visibly flagged as an edit. Constraint: static/no backend; saving is simulated client-side.

## Direction contract

**THESIS:** The locked state is not a disabled form — it's a receipt. Once a listing has bids, most of the page reads like a confirmed record (plain label/value rows, no input chrome) rather than grayed-out fields pretending they might still be editable.

**OWN-WORLD:** Inherits [DESIGN.md](DESIGN.md) unchanged. Reuses the locked-photo-box language and the info-strip component from create-listing, and the spec-row read-only pattern from the auction detail page.

**STORY:** Seller opens their listing, sees a clear notice that bidding has locked it, reviews everything as read-only fact (including current bid activity), edits the description if they want to add a note, saves, and sees an "แก้ไขแล้ว" (edited) badge with a timestamp confirming the change is now visible to bidders.

**FIRST VIEWPORT:** The lock notice, immediately followed by the locked photos — the seller needs to understand the rule before they even reach a field.

**FORM:** Confirmed directly with the user: lock everything except description once a bid exists; a post-bid description edit gets a visible "edited" indicator. Shaped directly from that decision plus the Listing section of [vanguard-card-app-mvp.md](vanguard-card-app-mvp.md).

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
