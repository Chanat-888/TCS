# Design

<!-- impeccable:design-schema 1 -->

## Scope

This file records the visual system for TCS as a whole, now that the black/blue/cyan world has been extended from the landing page to the app itself. It originated in [tcs-landing.html](tcs-landing.html) (Persuade) and now also covers [tcs-browse.html](tcs-browse.html), [tcs-profile.html](tcs-profile.html), [tcs-login.html](tcs-login.html), [tcs-auction.html](tcs-auction.html), [tcs-checkout.html](tcs-checkout.html), [tcs-order.html](tcs-order.html), [tcs-dispute.html](tcs-dispute.html), [tcs-create-listing.html](tcs-create-listing.html), [tcs-order-seller.html](tcs-order-seller.html), [tcs-admin-dispute.html](tcs-admin-dispute.html), [tcs-review.html](tcs-review.html), and [tcs-edit-listing.html](tcs-edit-listing.html) (Operate). This supersedes [tcs-home-design.html](tcs-home-design.html)'s purple/lavender direction as the app's visual identity, per the user's explicit choice — see [tcs-browse-brief.md](tcs-browse-brief.md) and [tcs-profile-brief.md](tcs-profile-brief.md). Extend this file for any further TCS surface, landing or app.

Added a gold token for tier/achievement recognition, distinct from the blue/cyan interactive accent: `--gold: #E8B84F`, used only for the tier badge and achievement icons — never for interactive elements, so it stays a status signal, not a competing accent.

## Color

Near-black, blue + cyan world, pinned by the user from a real Cardfight!! Vanguard card back (circuit-glow pattern).

| Token | Hex | Role |
|---|---|---|
| `--bg` | `#0A0C10` | Page base |
| `--panel` | `#12161D` | Card / decorative-card surface |
| `--panel-2` | `#171C25` | Elevated surface (card front face) |
| `--blue` | `#2F8FE8` | Primary accent |
| `--blue-dim` | `#1E5C99` | Muted blue (secondary label ink on panel) |
| `--cyan` | `#5FD4FF` | Glow / motion / signature accent |
| `--white` | `#F4F5F7` | Headline text on black |
| `--steel` | `#8C93A3` | Secondary text, borders |
| `--steel-dim` | `#565D6C` | Tertiary text, scrollbar |
| `--danger` | `#E8664F` | Problem/risk markers only |

Color strategy: Drenched — the near-black ground is the surface itself, with blue/cyan carrying identity at page scale, not as scattered accents. Legitimate here because the user pinned it directly from real product photography, not defaulted into it.

## Typography

- **Display / headings:** Space Grotesk 500–700. Geometric, technical character — echoes the card's circuit-line engraving.
- **Body:** Inter 400–600.
- **Data / status / mono:** JetBrains Mono 400–500, used only for prices, order statuses, and timers (e.g. `PAID_HELD`, `COMPLETED`) — never as a generic "technical" costume.

Loaded via Google Fonts (`Space+Grotesk`, `Inter`, `JetBrains+Mono`).

## Motifs

- **Card object:** rounded-rect (16px radius) card at real card proportions (~220:308), with a back face (circuit-line SVG, center glyph, `TCS` wordmark, mono status label) and a front face (approval glyph, mono status label), joined by a 3D `rotateY` flip. This is the page's signature interaction, not decoration.
- **Decorative background cards:** small (74×104) dark rounded-rect cards bearing one glowing cyan glyph (burst / star / sparkle), scattered at low opacity as background texture — directly from the user's own reference image.
- **Brand mark:** two fanned cards (blue behind, black card with a cyan diamond glyph in front) — used in the nav and footer.

## Motion

- Scroll reveal: GSAP + ScrollTrigger, fade + 24px rise, `power2.out`, per-element.
- Signature interaction: the "what TCS is" mechanism card flips face-down → face-up, scroll-scrubbed (not autoplay), tied to the escrow story.
- How-it-works: a vertical progress line fills as the visitor scrolls the step list.
- All motion respects `prefers-reduced-motion: reduce` (final state rendered immediately, no scrub/flip/idle-tilt).

## Components

- Fixed nav: `rgba(10,12,16,0.72)` + `backdrop-filter: blur(14px)`, not a flat gradient — needed so scrolling content never visually merges with the logo/status pill.
- Status pill / CTA badge: pill shape, mono type, 1px cyan-tinted border, no drop shadow.
- Problem list: plain rows with a small warning glyph, not a card grid (card-grid-of-icon+heading+text was avoided as the category default).
- Search field: pill-cornered input on `--panel`, cyan border on focus, leading search icon.
- Category tabs: pill buttons, inactive on transparent/steel border, active filled `--blue` with dark ink text (`#071523`) for contrast.
- Featured banner: large rounded panel with circuit-line SVG watermark, card object on one side, trust microcopy reusing the established escrow line.
- Product listing card: thumbnail with mono status chip (cyan = time-pressured/closing, steel = buy-now) and rarity tag, name, mono price, seller row (verified glyph + shop name, truncated with ellipsis + sales count, never wrapping). On the owner's own profile the same card gets a small floating edit button over the thumbnail instead of a seller row.
- Identity header (profile): circular avatar with a small circular edit-pencil overlay (owner-only affordance), name + inline edit icon, verified badge (cyan) and tier badge (gold) as pill chips, bio, join date, standalone "edit profile" button.
- Stat grid: 2–4 up, hairline-divided cells (not individual bordered cards), mono numeric value, plain-language label below.
- Achievement card: icon tile + name + either "ปลดล็อกแล้ว" or a thin progress track with an `n / target` mono readout; unlocked = cyan icon tile, locked = steel/dim icon tile. Same family covers repeatable milestones (e.g. deal-count tiers) without inventing a new component per tier.
- Review list: plain hairline-divided rows (not cards) — avatar-initial circle, name, star row, relative date, comment, and the order/card the review is tied to.
- Add-new item: dashed-border ghost card matching the grid's cell size, centered plus-in-circle + label — used instead of a filled button when the action is "add another card to this grid."
- Auth card (login/OTP): single centered card, no app chrome — used only for the login surface, where task focus outranks navigation. Linear step reveal (`.step.is-active`), not a wizard with visible step numbers. OTP input is six separate mono boxes with auto-advance-on-fill and backspace-to-previous; the resend action is a countdown that swaps into a link, never a disabled link with no feedback.
- Loading state on primary buttons: label fades out, a small spinner (2px ring, `border-top-color` only) fades in in its place — used instead of full-button skeletons for a single momentary action (send OTP, verify).
- Photo viewer (listing detail): large face swap (front/back) inside one sticky frame, small thumbnail row below drives the swap; the card-back face reuses the same circuit-glow asset established on the landing hero, so "this is a TCS card" reads identically everywhere it appears.
- Bid panel: price and countdown share one row (value left, time right, never stacked as separate cards); a stepper input (−/amount/+) with a computed minimum-bid note below it, never a bare numeric field. An inline "extended" note appears only when the anti-snipe rule actually fires — it is state feedback, not permanent copy.
- Compact seller row (used inside another page, e.g. a listing): avatar + name + verified/tier mini-badges + one stat line, the whole row a link to the full profile — smaller version of the profile identity header's badge language, not a new visual idea.

## Known layout pitfall

CSS Grid and flex children default to `min-width: auto`, which lets a long unbreakable run of text (a title, a stepper input) blow out past its track/flex-basis instead of wrapping or shrinking — hit twice while building this system (the listing title, the bid-amount input). Any grid item or flex child that holds free-form text or an `<input>` gets an explicit `min-width: 0`. [tcs-checkout.html](tcs-checkout.html) sets `min-width: 0` on the universal `*` reset instead of chasing it case by case — do this on any new page from the start rather than fixing it after the fact.

## Additional components (checkout)

- Linear task page: single centered column (`max-width: 640px`), no two-column layout — used when the page is one task to finish (checkout), as opposed to a browse/detail page that has room to spare.
- Payment method selector: radio-card rows (icon + label + one-line sub), not a dropdown — selecting one reveals only the fields that method needs (e.g. card number/expiry/CVV appear only for "card").
- Deadline banner: same countdown language as the auction timer, but calmer framing (no pulsing urgency color change) since a 24h payment window is a different kind of time pressure than a closing auction.
- Success/checkout state swap: two sibling containers (`#checkout-view` / `#success-view`), one `is-hidden` / `is-active` toggle on submit — not a route change, so page identity (title, footer) stays put while the task's own content swaps out.

## Additional components (order tracking)

- Order timeline: reuses the "how we work" flow-line grammar from the landing page (node + connecting line), but per-order: each step is `is-done` (green check), `is-active` (cyan, current gate), or neutral/pending (hollow node) — the same three-state language should cover any future step-based status surface.
- Gated action: the video-upload card and the approve/dispute decision panel are two separate blocks, and the second only reveals (`.is-visible`) once the first genuinely completes — never show an action whose precondition (the unboxing video) hasn't been met, even in a static demo.
- Inline chat: bubbles aligned left (them) / right (you, `.is-me`, tinted with `--blue-dim`) inside one panel — used for a lightweight per-thread conversation attached to a task, not a full messaging app chrome (no sidebar, no thread list).
- Auto-approve / deadline timers reuse the countdown-timer component (established on the auction and checkout pages) rather than inventing a new timer style per page.

## Additional components (dispute)

- Danger primary action: the one place a primary button uses `--danger` instead of `--blue` — reserved for an action that is genuinely adversarial (opening a dispute against the seller), never for ordinary negative actions like "cancel" or "remove."
- Evidence-attached card: same visual language as the order page's "video uploaded" confirmation (green icon tile + filename + subtext) — reused verbatim rather than re-designed, since it is the same fact (this video exists) shown a second time in a new context.
- Numbered explainer list: circular mono-numbered badges + prose, used only when the sequence is real chronological order the reader needs (money stays held → admin reviews → outcome) — not decorative step numbers on parallel content, which the craft floor bans.

## Additional components (create listing)

- Photo upload slot: a `.photo-box` wrapper carries the `aspect-ratio` and `position: relative`; the dashed upload zone and the filled preview both sit inside it as `position: absolute; inset: 0` layers, so removing/re-adding a photo never collapses the box's height. Never put the aspect-ratio on the upload zone itself when a sibling preview needs to occupy the same footprint — the box, not either state, owns the size.
- Toggle switch: pill track + sliding thumb (cyan when on), used for a single binary product setting (buy-now on/off) that reveals a dependent field — not for anything that needs a label change or three-plus states, where the tab/select components apply instead.
- Inline info strip (neutral/procedural): same cyan strip visual as the escrow reminder, reused here for a different fact (photos lock at first bid) — the strip means "important context, not a warning," regardless of which fact it's carrying.

## Additional components (seller order view)

- Masked counterpart identity: `ผู้ซื้อ ···832` — same masking convention as the auction page's bid history, reused wherever one party sees the other's identity without a real account system to resolve it to (a display name, a shop) yet.
- Timeline, seller variant: only two states are meaningful to a seller — `is-done` (they finished it) and neutral/pending (out of their hands) — there is no seller-facing `is-active` state past their one actionable step (ship), unlike the buyer timeline where every step can gate an action.
- Escrow strip, seller-facing copy: same visual component as the buyer-facing one, restated from the other side ("money is held, safe to ship" / "you'll be paid once...") — the component is symmetric even though its message never is.

## Additional components (admin dispute review)

- Internal-tool density: the first surface in this world that uses a two-column `case-grid` (evidence/case detail left, sticky decision panel right) instead of a single linear column — reserved for a power-user/ops task where comparison matters more than a guided narrative. Applies `min-width: 0` on every grid child from the start (see the layout pitfall note above).
- Evidence comparison row: three equal-weight boxes (listing front, listing back, unboxing video) in one grid, each carrying a small `label + source` caption — the source line (who supplied it, when) is what makes it evidence rather than decoration.
- Video evidence box: same aspect-box pattern as a photo slot, with a centered play button and duration badge; clicking swaps to a "กำลังเล่น..." state. There's no real video, so this is presented honestly as an interactive placeholder, not a fake scrubber/timeline.
- Neutral bifurcated decision: two `decision-option` radio cards (refund / release) with identical visual weight — deliberately not colored danger/success, since the component must not editorialize which outcome is "correct." Same radio-card pattern as the buyer dispute-reason selector and checkout's payment-method selector; one interaction language for "pick one of a few mutually exclusive options" everywhere in this system.
- `ADMIN` role tag: mono, gold-tinted pill in the header — the one signal on the page that this is a staff surface, not a consumer one, without changing the underlying visual world.

## Additional components (leave a review)

- Star picker (input): five large tappable star buttons, gold when on, hover previews the value before committing — distinct from `.stars` (display-only, small, used in profile/review-list contexts). Never reuse the input version where only a read display is needed, or vice versa.
- Rating label: plain-language word under the stars (แย่มาก / ไม่ค่อยดี / ปานกลาง / ดี / ดีมาก) that appears only once a value is picked — turns an abstract 1–5 into a sentence a person actually said.
- Multi-select tag chip: same pill shape as a category tab, but toggled independently (any number can be active) rather than mutually exclusive — visually distinguished from the single-select tab row only by that behavior, not by a different look.
- Submitted-review preview: the exact `.review-item` markup from [tcs-profile.html](tcs-profile.html) rendered with the just-submitted data — proves to the reviewer this is really what ships, and keeps the two pages from silently drifting into two different review-card designs over time.

## Additional components (edit listing, post-bid)

- Read-only recap row (`spec-row`): plain `label / value` line, no border-per-field, no disabled-input styling — the correct way to show a fact the user cannot change here. A grayed-out disabled `<input>` is never the right way to say "locked"; it reads as broken, not intentional.
- Locked-photo overlay: same photo-box footprint as the editable upload version on create-listing, but the overlay shows a lock glyph + "แก้ไขไม่ได้" instead of an upload icon + prompt — same shape, opposite affordance, so the two states of one component stay visually related.
- Small `lock-badge` pill next to a field label: the compact way to mark one locked field inline, distinct from the full-width `lock-notice` strip that explains the policy once at the top of the page.
- Edited indicator: a cyan mono pill (`แก้ไขแล้ว · <time>`) that only appears after a genuinely-changed field is saved — never shown pre-emptively, and compares against the original value rather than firing on every save click. This is the one field this page lets change post-bid, and the badge is what keeps that change honest to bidders.

## Open / not yet built

- No production signup or contact endpoint exists; the closing CTA is intentionally a non-interactive "coming soon" badge (see [PRODUCT.md](PRODUCT.md) — no backend yet). Replace with a real action once one exists.
- Copy is Thai-first, matching the existing app mockup's established voice; not yet reviewed by a native-Thai marketing eye beyond this build.
