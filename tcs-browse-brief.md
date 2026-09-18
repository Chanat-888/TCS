# Surface brief — TCS browse / marketplace home

Scope: the app's main function page (`tcs-browse.html`). Visitor mode: Operate.

Audience: a returning buyer or seller checking listings, same product as [PRODUCT.md](PRODUCT.md). Task: find a card to bid on or buy, understand its price/urgency/seller trust at a glance. Constraint: static design only, no backend — listing data is illustrative sample content, labelled as such where needed; no invented prices claimed as real transactions.

Structure is user-pinned, not rolled: search bar on top → category tabs → featured-auction/announcement banner → product listing grid. This overrides the concept-seed dealt options from the prior round per "a user- or brief-pinned direction beats the roll, always."

## Direction contract

**THESIS:** The browse screen reads like an auction floor, not a generic storefront — urgency (countdowns), provenance (seller trust), and the escrow promise stay visible in the everyday grid, not just on the marketing page.

**OWN-WORLD:** Inherits [DESIGN.md](DESIGN.md) in full — now extended from landing-only to the whole app per the user's explicit choice this session. Near-black ground, Vanguard blue primary, circuit-cyan for live/urgent state (countdowns, closing-soon), card white text, steel secondary. Space Grotesk / Inter / JetBrains Mono (mono reserved for prices, countdowns, order/rarity codes).

**STORY:** Visitor lands, searches or picks a category, sees this week's featured auction, then scans the grid for a card to act on — price, time left, and seller trust readable without opening the listing.

**FIRST VIEWPORT:** Sticky blurred header (brand + search input), category tab row directly below, featured-auction banner as the first large object, grid teased at the fold.

**FORM:** User-specified structure (search → tabs → banner → grid), shaped directly; concept-seed's dealt surface cards (auction-clock feed / search-first / category-bank) were superseded by this explicit answer, not built.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
