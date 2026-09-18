# Surface brief — TCS create listing (seller)

Scope: `tcs-create-listing.html` — a seller publishing a new card for sale. Visitor mode: Operate. Edit-listing (same form, but with photos locked once a bid exists) is a close variant, not built separately yet — see [PRODUCT.md](PRODUCT.md).

Audience: a seller (e.g. DragonForge) listing a card. Task: upload both required photos, describe the card accurately, set a price and auction duration, and understand upfront that photos lock the moment someone bids. Constraint: static/no backend — photo "upload" is simulated (placeholder art, not a real file picker result); publishing is simulated client-side.

## Direction contract

**THESIS:** The form itself teaches the rule that protects buyers — photos are required before anything else and the page states plainly, before publishing, that they lock at the first bid — so "trust is the product" shows up in the seller's own workflow, not just the buyer's.

**OWN-WORLD:** Inherits [DESIGN.md](DESIGN.md) unchanged. Reuses the checkout page's field/section/validation language (this is the same "linear task form" pattern), and the browse-page listing-card component for the published-preview at the end.

**STORY:** Seller uploads front + back photos, fills in what the card is and its condition, sets a starting price and (optionally) a buy-now price and a duration, is reminded that photos lock at first bid, publishes, and sees their own listing rendered exactly as a buyer would see it in the browse grid.

**FIRST VIEWPORT:** Photos first — both required upload slots are the first thing the seller has to deal with, before any text field, because a listing without photos isn't a listing.

**FORM:** Shaped directly from the Listing section of [vanguard-card-app-mvp.md](vanguard-card-app-mvp.md) — conventional create-listing form, Operate mode favors completing the task over novelty.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
