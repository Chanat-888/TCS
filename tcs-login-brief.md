# Surface brief — TCS login / sign-up

Scope: `tcs-login.html`. Visitor mode: Operate. One flow serves both login and sign-up, since the product has no separate account-creation step — one phone number is one account (see [PRODUCT.md](PRODUCT.md)).

Audience: a new or returning user who needs to get into the app before anything else works. Task: enter phone → verify OTP → (optionally) start bank verification for the trust badge. Constraint: static/no backend — OTP is simulated client-side, not sent or checked for real.

## Direction contract

**THESIS:** Getting in is the first trust moment, not paperwork — one phone number, one code, and you're in; bank verification (the thing that actually unlocks payouts) is offered right after, not forced before someone can even look around.

**OWN-WORLD:** Inherits [DESIGN.md](DESIGN.md) unchanged. A focused, centered auth card replaces the app chrome (no nav/search/tabs) — this screen's only job is task completion.

**STORY:** Visitor lands, enters their phone, gets a 6-digit code (simulated), verifies, and is offered — not forced into — bank verification for the verified badge.

**FIRST VIEWPORT:** Centered card on the world's near-black ground, brand mark above it, single phone-number field and one primary action, nothing else competing for attention.

**FORM:** Three linear steps (phone → OTP → welcome/bank-verify offer), shaped directly from the account-and-identity section of [vanguard-card-app-mvp.md](vanguard-card-app-mvp.md) — a conventional auth flow by design, not a novelty surface.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
