# Vanguard Card App — MVP Spec

Card trading app for the Thai market.
Status: concept. Not built yet.
Last updated: 2026-09-14

---

## 1. Problem

- The only real market today is Facebook groups.
- Auctions are slow. Comments are the bidding system.
- No escrow. Buyer sends money first and hopes.
- When fraud happens, the victim can only post a warning. The scammer makes a new account.
- No real identity. One person can have many accounts.

## 2. What this app is

A trading app where money is held by the app until the buyer approves the card.
Trust is the product. Auction is just the way to sell.

## 3. Users

- Seller — has cards, wants a faster and safer sale than Facebook.
- Buyer — wants the card, does not want to lose money.
- Admin — resolves disputes.

## 4. MVP scope

### In scope

1. Account and identity
   - Sign up with phone number (OTP).
   - One phone number = one account.
   - Bank account name must match the profile name before any payout.
   - Verified badge on profile once bank name is matched.

2. Listing
   - Seller uploads photos: front and back, required.
   - Card name, set, condition, start price, buy-now price (optional), auction end time.
   - Photos lock after the first bid. Seller cannot edit them.

3. Auction
   - Live bid updates. No page refresh.
   - Bid increment rules.
   - Anti-sniping: a bid in the last 2 minutes adds 2 more minutes.
   - Auto-cancel if the winner does not pay in 24 hours. Seller can re-list.

4. Escrow (core)
   - Buyer pays into escrow after winning.
   - App holds the money. Seller does not get it yet.
   - Seller ships only after seeing "payment held".
   - Money releases to the seller only when the buyer approves, or after the auto-approve timer.

5. Delivery tracking
   - Seller enters courier and tracking number.
   - App shows delivery status to both sides.

6. Unboxing video (dispute evidence)
   - Buyer records an unboxing video in the app, or uploads one.
   - Required before the buyer can open a dispute.
   - Video is stored and shown to admin during a dispute.

7. Dispute
   - 48-hour window after delivery.
   - Buyer opens a dispute with the unboxing video.
   - Admin reviews listing photos vs unboxing video.
   - Admin decides: release to seller, or refund the buyer.

8. Chat
   - Buyer and seller chat per order.
   - Chat is saved and visible to admin during a dispute.

9. Review / trust
   - Review only after a completed order. No fake reviews.
   - Profile shows: completed sales, dispute count, join date, verified badge.

### Out of scope (v1)

- Card grading or price guide
- Shipping label purchase inside the app
- Trade card-for-card (no money)
- Web + native apps (PWA only)
- Seller shops / storefronts
- Fees and subscriptions (launch free to get sellers in)

---

## 5. Core flow — the money

```
Auction ends
  → Winner pays into escrow          [status: PAID_HELD]
  → Seller ships, adds tracking      [status: SHIPPED]
  → Courier marks delivered          [status: DELIVERED]
  → Buyer records unboxing video
  → Buyer taps "Approve"             [status: COMPLETED] → payout to seller
       OR
  → Buyer opens dispute in 48h       [status: DISPUTED]  → admin decides
       OR
  → Buyer does nothing for 48h       [status: COMPLETED] → auto payout
```

Rules:

- The app never touches the money directly. A licensed payment provider holds it.
- Auto-approve timer stops sellers being blocked by silent buyers.
- No unboxing video means no dispute. The buyer is told this before paying.

---

## 6. Anti-fraud rules

| Risk | Control |
|---|---|
| Seller takes money, sends nothing | Escrow. Money only moves on buyer approval. |
| Seller sends a different / damaged card | Locked listing photos + unboxing video + admin review. |
| Scammer returns with a new account | Phone OTP + bank name match. New account has no history. |
| Buyer lies to get a free card | Unboxing video required. Admin compares to listing photos. |
| Buyer wins and never pays | 24h payment timer. Auto-cancel + strike on the account. |
| Fake reviews | Reviews only from completed, paid orders. |

---

## 7. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js, PWA | One codebase, works on phone, no app store wait |
| Backend / DB | Supabase (Postgres) | Auth, database, realtime, storage in one |
| Live bidding | Supabase Realtime | No separate websocket server |
| Auth | Supabase Auth + phone OTP | One phone, one account |
| Images / video | Supabase Storage or Cloudflare R2 | R2 is cheaper if video gets big |
| Payments / escrow | Omise or 2C2P (Thai) | PromptPay support, marketplace split, they hold the money |
| Timers (auction end, auto-approve) | Supabase cron / Edge Functions | No extra server |
| Hosting | Vercel | Free to start |

Estimated cost at launch: about 0–1,500 THB per month.

Decision: PWA first. Native app only after there are real sellers.

---

## 8. Data model sketch

- `users` — id, phone, display_name, verified, bank_name_matched, created_at
- `listings` — id, seller_id, title, set, condition, photos[], start_price, buynow_price, ends_at, status, photos_locked
- `bids` — id, listing_id, bidder_id, amount, created_at
- `orders` — id, listing_id, buyer_id, seller_id, amount, status, escrow_ref, paid_at, approved_at, auto_approve_at
- `shipments` — order_id, courier, tracking_no, status, delivered_at
- `evidence` — order_id, type (unboxing_video), file_url, uploaded_at
- `disputes` — order_id, opened_by, reason, admin_decision, decided_at
- `reviews` — order_id, rater_id, ratee_id, score, comment
- `messages` — order_id, sender_id, body, created_at

Order status: `PENDING_PAYMENT → PAID_HELD → SHIPPED → DELIVERED → COMPLETED` / `DISPUTED` / `CANCELLED` / `REFUNDED`

---

## 9. Go to market

- Seed users: Pan's friend group of players.
- Target before launch: 20–30 sellers with real stock. Empty auctions kill the app.
- First move: ask those sellers to commit to listing on day one.

---

## 10. Open questions

1. Identity level — is phone OTP + bank name match enough, or is Thai ID (KYC) needed? (Deferred. Must decide before writing payment code — it changes the database.)
2. Which payment provider — Omise or 2C2P? Need to check escrow / delayed-capture support and fees.
3. Who pays the payment fee — buyer, seller, or split?
4. Condition grading standard — what words are allowed for "condition", and who is right in a dispute?
5. Shipping — required insured/tracked courier for high-value cards?
6. Video size limits and how long videos are kept.

---

## 11. Success test for the MVP

- 20+ sellers listing in month 1.
- 50 completed escrow orders.
- Dispute rate under 5%.
- At least one seller says they stopped using Facebook for auctions.
