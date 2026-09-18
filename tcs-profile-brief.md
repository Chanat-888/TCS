# Surface brief — TCS profile page (owner view)

Scope: `tcs-profile.html`, the seller/buyer profile page, owner-context view only (no visitor/toggle — see [PRODUCT.md](PRODUCT.md), real auth is not built yet). Visitor mode: Operate.

Audience: the signed-in user viewing/managing their own profile. Task: check their trust standing (verified badge, tier, stats, reviews), see their achievements, manage their active listings. Constraint: static design, sample data — trust-tier names/thresholds and the full achievement catalog are explicitly undecided in PRODUCT.md; this build uses the confirmed three achievement examples and illustrative (clearly-placeholder) tier names, not invented final copy.

## Direction contract

**THESIS:** The profile is the trust record made visible — stats, tier, and reviews sit above the fold with the same weight a shop's storefront would give its products, because on TCS the seller's trustworthiness *is* the product.

**OWN-WORLD:** Inherits [DESIGN.md](DESIGN.md) in full — same tokens, fonts, and listing-card component as [tcs-browse.html](tcs-browse.html). Reuses that page's product card unchanged for "available product" to keep the system consistent across surfaces.

**STORY:** Owner opens their profile, immediately sees their verified status, tier, and stats, can edit identity fields, scans reviews and achievements, and manages what they currently have listed.

**FIRST VIEWPORT:** Identity header — avatar, name, verified badge, tier tag, edit affordance — directly above a stat row (completed sales, dispute count, rating, join date).

**FORM:** Shaped directly: header/identity → stats → achievements → reviews → available products. Conventional profile structure by design — Operate mode favors native expectation over novelty here.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
