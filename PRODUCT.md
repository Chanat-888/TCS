# Product

<!-- impeccable:product-schema 1 -->

## Implementation update — Google and phone authentication

Phone OTP now calls Supabase Auth, uses verified per-user sessions, supports resend and logout, and provisions profiles through migration 0006. SMS delivery and hosted verification still require project/provider configuration; see [auth setup](docs/auth-setup.md). Google OAuth now supports browsing without a verified phone. Trading mutations require phone verification; adding a phone to a Google account preserves its UUID. Phone-first users can link Google from their profile. Google provider setup and manual linking must be configured in Supabase before live use. The older surface inventory below describes design prototypes and is not a current implementation checklist. Payments remain simulated.

## Platform

web

## Stack

Next.js (PWA). Supabase (Postgres, Auth with phone OTP, Realtime for live bidding, Storage). Escrow/payments via Omise or 2C2P (Thai, PromptPay support, marketplace split) — provider TBD between the two. Timers (auction end, auto-approve) via Supabase cron / Edge Functions. Hosting on Vercel. Estimated launch cost: 0–1,500 THB/month. PWA first; native app only after there are real sellers.

## Users

- **Seller** — has trading cards, wants a faster and safer sale than Facebook auction groups.
- **Buyer** — wants the card, does not want to lose money to a scam.
- **Admin** — resolves disputes between buyer and seller.

## Product Purpose

TCS is a trading-card marketplace for the Thai market where the app holds payment in escrow until the buyer approves the card, replacing the current de facto market of slow, escrow-less Facebook group auctions. Trust is the product; auction is just the selling mechanism. Success: sellers stop using Facebook for auctions in favor of TCS.

## Positioning

Facebook groups have no escrow (buyer pays first and hopes), no real identity (a scammer just makes a new account), and no structured dispute process. TCS's mechanism a neighboring product can't casually copy: money is held by a licensed payment provider until buyer approval (or an auto-approve timer), gated by phone-OTP + bank-name-matched identity, with mandatory unboxing-video evidence before any dispute can be opened.

## Operating Context

Launch scope is Vanguard-first: TCS launches focused on Cardfight!! Vanguard to seed a real seller base, with multi-TCG expansion (Pokémon, Yu-Gi-Oh, etc.) planned for later. The full money flow: auction ends → winner pays into escrow (`PAID_HELD`) → seller ships and adds tracking (`SHIPPED`) → courier marks delivered (`DELIVERED`) → buyer records a required unboxing video → buyer approves (`COMPLETED`, payout to seller) or opens a dispute within 48h (`DISPUTED`, admin decides) or does nothing for 48h (auto-approve → `COMPLETED`). Listing photos (front/back) lock after the first bid. Anti-sniping: a bid in the last 2 minutes extends the auction by 2 minutes. Unpaid winners auto-cancel after 24h. Primary language/market: Thai (UI copy in Thai, THB pricing).

## Capabilities and Constraints

**Video policy (always, every order):** TCS requires video evidence from BOTH sides on every order. The seller records a packing video (putting the sold card into its sleeve/box) before shipping or before a meet-up hand-over, and cannot confirm shipment without it. The buyer records an unboxing video on receipt, and cannot approve or open a dispute without it. Both are stored, byte-validated MP4/MOV files visible to the other party and the admin. This is a standing product rule, not a per-order option.

**Ship-date agreement (every order):** after payment the seller proposes a ship (or meet-up hand-over) date with a reason and the buyer accepts or declines. Until the card ships, either side can ask to postpone (new date + reason) or to cancel the order, and the other side accepts or declines; accepting a cancellation cancels the order and refunds the buyer. Proposals are limited to 1 hour–14 days ahead, only one is open at a time, and each step is echoed into the order chat. Timer rules that build on this: an order auto-completes 2 days after the package is delivered without the buyer acting, and unpaid orders auto-cancel after 24 hours.

In scope for MVP: phone-OTP signup (one phone = one account) with bank-name-matched verified badge; card listings (photos, name, set, condition, start/buy-now price, auction end time); live bidding with anti-sniping and increment rules; escrow held by a licensed payment provider (app never touches money directly); delivery tracking; required in-app/uploaded unboxing video as dispute evidence; 48h dispute window with admin review; per-order buyer/seller chat visible to admin during disputes; post-order reviews (no fake reviews — only from completed orders); profile trust signals (completed sales, dispute count, join date, verified badge).

**Trust-tier tag** (added after the browse/profile design pass): a label on the user's profile unlocked by accumulating good reviews — a tier system derived from data TCS already tracks (reviews), not a new points/currency mechanic. Exact tier names and the review-count thresholds for each are not decided yet; the user (Pan) intends to define the final tag labels.

**Achievement badges**: milestone recognition on the profile, non-monetary (no points, no redeemable value) — confirmed examples: first auction, first completed sale, 100 deals closed. Full catalog of achievements beyond these three is not decided yet.

**Edit-listing lock policy** (confirmed, extends the spec's photo-lock rule): once a listing has at least one bid, everything locks (photos, name, set, category, condition, price, buy-now price, duration) **except the description**, which stays editable so a seller can add clarifying notes. Any post-bid description edit is marked with a visible "แก้ไขแล้ว" (edited) indicator and timestamp, so bidders can see the listing's text changed after they bid — same evidence-transparency principle as unboxing video, applied to listing edits.

Out of scope for v1: card grading/price guide, in-app shipping label purchase, card-for-card trading (no money), native apps (PWA only for now), seller shops/storefronts, fees and subscriptions (launch free).

Open/undecided product facts (do not invent answers):
- Identity level — phone OTP + bank-name match, or full Thai ID (KYC)? Deferred, but must be decided before payment code is written (changes the database).
- Payment provider — Omise vs 2C2P, pending escrow/delayed-capture support and fee comparison.
- Who pays the payment fee — buyer, seller, or split.
- Condition-grading standard — allowed condition terms and dispute authority.
- Shipping — whether insured/tracked courier is required for high-value cards.
- Video size limits and retention period for unboxing videos.
- Trust-tier tag names and the review-count (or other) threshold each one requires.
- Full achievement catalog beyond the three confirmed examples above.
- Real login/session system: profile owner-vs-visitor view depends on it; phone-OTP auth is already in scope (Stack/Capabilities above) but not yet implemented — static design work assumes an authenticated-owner context until it exists.

## Brand Commitments

Product name: TCS. Existing home-page visual design (`tcs-home-design.html`) establishes a Shopee-style page structure (search → banner → shortcut icons → categories → closing-soon auctions → all auctions) with Thai-language UI copy, e.g. "เงินอยู่กับ TCS จนกว่าคุณจะกดรับการ์ด ไม่พอใจ ได้เงินคืน" (money stays with TCS until you confirm receipt; not satisfied, get a refund) and "ซื้อขายผ่าน TCS ปลอดภัยกว่า" (trading through TCS is safer). Escrow/trust messaging is a core brand element, not just a feature.

## Evidence on Hand

- [vanguard-card-app-mvp.md](vanguard-card-app-mvp.md) — MVP spec: problem statement, scope, money-flow state machine, anti-fraud rules table, tech stack, data model sketch, go-to-market plan, open questions, success metrics.
- [tcs-home-design.html](tcs-home-design.html) — Claude design-canvas file containing the current home-page mockup (light and dark artboards, "TCS — หน้าแรก"), Vanguard-card listings as sample content, Thai UI copy.
- No app code exists yet anywhere. No testimonials, case studies, press, or real pricing/fee data exist — future work must not fabricate these.
- Go-to-market seed: Pan's friend group of card players; target 20–30 committed sellers before launch.

## Surfaces

Built:
- [tcs-landing.html](tcs-landing.html) — Persuade landing page.
- [tcs-browse.html](tcs-browse.html) — Operate: marketplace home (search, category tabs, featured banner, listing grid).
- [tcs-profile.html](tcs-profile.html) — Operate: profile, owner view only (no real auth yet, see Open/undecided above).
- [tcs-login.html](tcs-login.html) — Operate: phone OTP login/sign-up (one flow for both), OTP simulated client-side, offers (not forces) bank verification afterward.
- [tcs-auction.html](tcs-auction.html) — Operate: listing/auction detail ("product page") — front/back photos, live countdown, bidding with anti-sniping (bid inside the last 2 minutes visibly extends the clock), bid history, seller trust row. Bidding is client-side only, no real persistence.
- [tcs-checkout.html](tcs-checkout.html) — Operate: checkout / pay into escrow — order summary, 24h payment deadline, shipping address, payment method (PromptPay / card, provider-agnostic since Omise vs 2C2P is still undecided), escrow reminder, and a simulated pay → `PAID_HELD` success state. No real gateway, no real card data collected.
- [tcs-order.html](tcs-order.html) — Operate: order tracking, **buyer view only** (seller's tracking-number-entry view is still remaining, see below) — status timeline (`PAID_HELD → SHIPPED → DELIVERED`), courier + tracking number, gated unboxing-video upload (simulated), approve/dispute decision with 48h auto-approve countdown, and per-order chat. Approving reaches `COMPLETED`.
- [tcs-dispute.html](tcs-dispute.html) — Operate: dispute, **buyer-side filing flow only** (admin-side review screen is still remaining, see below) — reason selection, optional description, the unboxing video shown already attached as evidence, a neutral explainer of both possible outcomes (refund or release), simulated submit → `DISPUTED` confirmation. No real admin queue exists yet.
- [tcs-create-listing.html](tcs-create-listing.html) — Operate: seller create-listing flow — required front/back photo upload (simulated), name/set/category/condition, start price + optional buy-now price + auction duration, an upfront notice that photos lock at first bid, simulated publish → preview of the listing as it would appear in the browse grid. Edit-listing (same form, photos disabled once a bid exists) not built separately yet.
- [tcs-order-seller.html](tcs-order-seller.html) — Operate: order tracking, **seller view**, same order thread as `tcs-order.html` shown at an earlier point (right after payment). Escrow strip restated from the seller's side ("safe to ship, you'll be paid once..."), status timeline (only the ship step is seller-actionable — everything after is out of their hands), courier + tracking number entry (simulated, matches the tracking number already shown on the buyer's page), and per-order chat.
- [tcs-admin-dispute.html](tcs-admin-dispute.html) — Operate: **Admin role**, reviewing the dispute filed in `tcs-dispute.html` — case summary, buyer's stated reason/claim, a three-way evidence comparison (listing front photo / listing back photo / unboxing video, each labeled with its source), the order's chat log, and a neutral refund-vs-release decision with a required resolution note. Reached as a direct deep link; no admin queue/dashboard exists yet.
- [tcs-review.html](tcs-review.html) — Operate: leave-a-review flow, reached only from a completed order (`tcs-order.html`'s "ให้คะแนนร้านค้า", now pointed here instead of dead-linking to the profile) — 5-star rating (required) with a plain-language label per value, optional multi-select quick tags, optional comment, submit → preview rendered with the exact review-item component used on `tcs-profile.html`.
- [tcs-edit-listing.html](tcs-edit-listing.html) — Operate: editing a listing that already has bids — everything (photos, name, set, category, condition, price, buy-now, duration) shown read-only per the edit-lock policy above; only the description stays editable, and saving a genuine change shows a visible "แก้ไขแล้ว" (edited) badge with a timestamp. `tcs-profile.html`'s per-listing edit button for this item now links here instead of doing nothing.

Core money-flow is now fully built end to end for buyer, seller, and admin.

Remaining, secondary (UI hooks already exist and currently go nowhere):
- Search results page (browse header's search bar).
- Filter panel (browse header's filter icon).
- Notifications (bell/settings icons on page headers).
- Account settings — bank info for payout, phone number (profile's settings icon).
- Admin dashboard — the queue/list of all cases and orders; `tcs-admin-dispute.html` reviews one case reached by direct link, but there's no home base listing them yet.

## Product Principles

1. Trust is the product — every design and product decision should reinforce that money is safe with TCS, not just that the app is easy to use.
2. Escrow beats speed — the app is allowed to be slower than a raw Facebook-group auction if that slowness is what makes money safe.
3. Identity accountability — a scammer should not be able to simply create a new account and continue; verification friction is a feature, not a cost to minimize away.
4. Evidence-based disputes — every dispute must be decidable from recorded evidence (listing photos, unboxing video, chat log), not he-said/she-said.
5. Vanguard-first, not Vanguard-only — near-term decisions should favor a single-TCG marketplace done well over spreading thin across card games, while not foreclosing later multi-TCG expansion.
