# TCS payment plan (draft, Oct 2026)

Status: **Phases 1 and 2 of Part A are written** (ledger, withdrawals, seller earnings page, admin withdrawals page; migration
`0025_ledger.sql`, branch `feat/ledger-phase1`) and Phase 2 (`0026_reconciliation.sql`, branch `feat/ledger-phase2`); both migrations are applied to the live database. Everything else in Part A is
not built. Phases 0 to 4 are written (see section 11); Phase 0 needs `PROMPTPAY_ID` and migration `0029_payin_slips.sql`.
Buyers pay by PromptPay QR and slip; Omise is dormant. Sellers are no longer paid per order through Omise
([src/lib/payout.ts](../src/lib/payout.ts) is unused and kept for Part B): a completed order credits the ledger and the
seller withdraws. Phase 1 needs `BANK_ENCRYPTION_KEY` (32 random bytes, base64; losing it makes saved account
numbers unreadable).

- **Part A (sections 1 to 20) is the current plan:** buyers pay a PromptPay QR we generate straight into a company
  account, a slip reader confirms the payment, a ledger tracks what sellers are owed, and early on we pay sellers
  by hand.
- **Part B (section 21) is the fallback:** the earlier Omise route, kept in case the lawyer or slip fraud rules
  out direct collection.

Fee, price and bank API details come from public pages, comparison sites and memory, not contracts or quotes.
Treat them as estimates. Not legal or accounting advice: every "confirm" item needs a lawyer, an accountant, the
bank or the slip-reader provider in writing.

Related decision: phone OTP is dropped on purpose (Google login only). See PRODUCT.md.

---

# Part A: current plan (direct PromptPay QR + slip reader)

## 1. The idea in one picture

```
 BUYER
   | scans a dynamic PromptPay QR made by us for this order (amount fixed, no cards)
   | uploads the transfer slip
   v
 SLIP READER (third-party service) checks the slip against the bank -> order becomes PAID_HELD
   |
 ACCOUNT B  (company bank account #2: holds SELLER money only) <- the buyer's money lands here
   |  website shows each seller a "wallet" number (a ledger in our database, not real cash)
   |  seller asks to withdraw 1,000 THB  ->  seller gets 990 THB, 10 THB (1%) is our fee
   |  early phase: admin pays the seller by hand from the bank app (later: bank bulk payment)
   v
 SELLER'S OWN BANK ACCOUNT

 ACCOUNT A  (company bank account #1: OUR money)
   <-- we manually move the commission + withdrawal fees from B to A
```

Two rules hold everything together:
1. **Seller money never mixes with our money.** B is seller money (plus an optional owner buffer). A is ours.
2. **The wallet is only a ledger.** Real cash lives in bank accounts. The ledger says who is owed what.

---

## 2. Money flow, step by step (order of 1,000 THB, 10% commission)

| # | What happens | Where the money is | Ledger / order status |
|---|---|---|---|
| 1 | Buyer scans the QR and pays 1,000, then uploads the slip | Account B (full 1,000, no gateway fee) | Slip check passes: order `PAID_HELD`. Seller sees 900 as **pending** |
| 2 | Seller ships, buyer receives, records unboxing video | Account B | `SHIPPED` -> `DELIVERED` |
| 3 | Buyer approves, or 48h auto-approve, or a dispute is decided for the seller | Account B | `COMPLETED`. 900 moves from **pending** to **available**. 100 commission recorded as ours |
| 4 | Seller requests a withdrawal of 1,000 (needs 1,000 available) | Account B | Ledger: available -1,000, payout 990 queued, our fee 10 |
| 5 | Admin pays the queued withdrawal by hand (later: a batch run through the bank) | Seller's bank | Request marked **paid** (or **failed** -> money returns to available) |
| 6 | We manually move commission + fees from B to A | Account A | Not a new income event, just our own money moving |

Refunds and disputes: a refund to a buyer is **done by hand from account B** and is written into the ledger so
the seller's balance and the refund match. Real cash is already in B, so no gateway balance is involved.

---

## 3. What we need to set up

1. **A company** (limited company registered with the DBD, with a tax ID) and **two company bank accounts.**
   A = operating (commission, fees, our costs). B = holding (seller money only). Open both at the same bank
   (free transfers between them) and ask whether B can be marked as a customer-funds account. **Tell the bank in
   writing what B is for** (customer funds for a marketplace: many small incoming transfers, payouts to many
   sellers), because banks can freeze accounts that look like pass-through accounts.
2. **Policy and legal.** Terms of service, privacy policy, registrations, lawyer and accountant answers
   (sections 8 and 16).
3. **PromptPay QR generation.** A dynamic QR per order from the company's PromptPay ID (juristic person); the
   amount is built in so the buyer cannot change it. Free, no gateway.
4. **A slip-reader service** to confirm payments (section 5). Bank API confirmation comes later.
5. **Wallet ledger in the website:** the "fake wallet number" (section 4).
6. **Later:** Corporate Cash Management from the bank (for example KBank K-Cash Connect Plus or SCB Business
   Net, names unverified) for bulk payouts. Needs a corporate account and paperwork; start manual.

---

## 4. The wallet ledger (design rules)

- Two balances per seller: **pending** (order not approved yet, dispute window open) and **available**
  (order completed). Only available can be withdrawn.
- **Immutable ledger.** Every change is a new entry (order credited, order completed, withdrawal, fee, refund).
  Never edit a balance. The balance is the sum of the entries.
- **Atomic withdrawals.** Deduct inside one database transaction so double-clicks or two tabs cannot withdraw twice.
- **Cover rule.** The balance in account B must always be at least the total of all sellers' pending + available.
  Check this every day and treat any shortfall as an alarm. Putting our own money in B as a buffer is fine
  (record it as capital or an owner's loan, not income, and only take out the excess).
- **Account-name match.** Bank payouts go straight to the seller's account and cannot be pulled back, so the
  account holder name must match the verified name (see section 9).
- **Bank details are sensitive.** We store sellers' account numbers ourselves (today Omise holds them):
  encrypt them and restrict access.
- **Withdrawal fee: 1%** (example: type 1,000, receive 990). Sellers manage their own withdrawals. A minimum
  withdrawal and one free withdrawal a week are options if sellers complain.
- **Failed payouts** return the money to the seller's available balance.
- **Unclaimed balances:** we need a rule for sellers who never withdraw (decide with the lawyer).

---

## 5. Paying in: dynamic QR + slip reader

### How it works
1. The buyer pays by a **dynamic PromptPay QR** generated by us for the order (amount built in), paid into B.
2. The buyer uploads the slip. A **third-party slip-reader service** checks it against the bank and returns
   amount, sender and time. A match sets the order to `PAID_HELD`.

### Rules for the slip check
- Server-side only: the browser never says an order is paid.
- Amount on the slip must equal the order amount exactly; also check the receiving account, the date, and that
  the slip is not older than the order.
- **Each slip reference can be used once** (unique key), so a slip cannot pay two orders.
- Optional: add odd satang to the amount so each open order has its own amount and matching is easy.
- QR and order expire together; late, wrong or double payments go to an admin queue and are refunded by hand.
- Keep the slip image and the reader's response with the order as evidence for the audit trail (section 15).
  The slip shows the buyer's name and account number, so limit who can see it and how long it is kept (PDPA).
- **Never trust the slip image alone.** Check the receiving account, the amount, and that the payment time is after
  the order was created. Treat the slip reader's answer as a check, not proof.
- **Match each payment to a line on the real bank statement before the seller can withdraw it.** A slip alone
  never releases money. The daily reconciliation compares B's balance with what is owed; this check goes one
  level lower and matches each payment.

### Slip reader vs bank API

| | Slip reader (chosen for now) | Bank API (Bill Payment QR, later) |
|---|---|---|
| Flow | Buyer uploads the slip, service verifies it | Bank calls us when the reference is paid |
| Setup | Easy: sign up, API key | Hard: corporate account, bank approval, paperwork |
| Cost | Small per-slip or monthly fee (unverified) | Bank-dependent (unverified) |
| Automatic | Mostly; buyer must upload | Fully |
| Fraud risk | Fake or edited slips, slip reuse; service checks the real bank record | Very low |
| Reliability | Depends on a third party | Bank-grade |

Move to the bank API once the corporate account is open and volume justifies it. The ledger (sections 13, 14)
does not change; only the source of the "paid" event does.

### Risks of this route
- **Legal:** with a gateway, a licensed company takes the pay-in. Here TCS receives buyers' money directly on
  behalf of sellers, which makes the Payment Systems Act and Escrow Act question (section 8) sharper. A licensed
  lawyer must answer this before launch.
- **The bank may freeze account B.** Many small transfers from unrelated people followed by payouts to many
  others looks like a pass-through account (from memory, verify). Ask the bank in writing before opening B.
- **Anti-money-laundering rules** probably apply to holding and moving customers' money. Not yet researched;
  lawyer question.
- No chargeback or KYC tooling from a gateway; a buyer's bank dispute is settled on our records alone.
- Buyers forgetting to upload the slip: show clear steps, a reminder and an expiry.
- Third-party dependency: if the slip reader is down, orders wait for an admin check.
- Tax and audit: no gateway export to match against, so the ledger and kept slips carry the proof.

---

## 6. Fees and what we keep

There is no pay-in fee, no Omise transfer fee and no 7-day hold on this route. Costs left: the slip reader (price
unknown), the bank's fees on incoming and outgoing transfers (unknown; ask), and VAT on our fees once registered.

Per 1,000 THB order, before those costs, with the 1% withdrawal fee charged on the seller share:

| Commission | We keep: commission | + withdrawal fee | Roughly kept |
|---|---|---|---|
| 5% | 50 | 9.50 | **59.50** |
| **9% (chosen)** | 90 | 9.10 | **99.10** |
| 8% | 80 | 9.20 | **89.20** |
| 10% | 100 | 9.00 | **109.00** |

Notes:
- **The commission rate is decided: 9%** (Oct 2026). The setting is `COMMISSION_RATE` in
  [src/lib/commission.ts](../src/lib/commission.ts). Facebook groups charge nothing, so a high rate may push
  sellers away, so watch seller reaction. The other rows in this table are for comparison. Examples elsewhere in this
  plan use round numbers (10%) and are not the chosen rate.
- Without a gateway fee, cheap orders are no longer the weak spot they were with Omise, but a fixed slip-reader or
  bank cost per order still matters at low prices. Fill this in when we have quotes.
- Manual payouts cost admin time instead of bank fees; that is why bulk payment comes later.
- Hand refunds: with no gateway, there is no pay-in fee to lose.

---

## 7. Tax (general, confirm with an accountant)

| Item | Treatment |
|---|---|
| Buyer's 1,000 | Not our revenue by itself; mostly held for the seller |
| Seller balances (and the matching cash in B) | A **liability**, no income tax |
| Commission | **Our revenue**, counted when the order completes |
| 1% withdrawal fee | **Our revenue**, counted when the withdrawal happens |
| Slip-reader and bank fees | **Expenses** |
| Moving money from B to A | Just a transfer between our accounts |
| Interest on account B | Probably ours; ask the accountant (see section 17) |

- **Timing:** moving money to the bank, or to A, never changes when income counts. Tax follows when income is
  earned, not when cash arrives.
- **Agent treatment:** only the commission is revenue if the terms of service say TCS collects money on the
  seller's behalf and the ledger shows it. If not, the tax office could treat the whole 1,000 as ours.
- **VAT:** registration is needed above 1.8 million THB revenue (confirm). Then VAT applies to commission and
  withdrawal fees; decide whether prices include VAT and issue tax invoices or receipts to sellers.
  VAT on bank and service fees may be recoverable.
- **Seller reporting:** one source says platforms report each seller's revenue to the Revenue Department
  within 150 days of year-end. Confirm whether this applies to us.
- **Withholding tax:** company sellers may need to withhold tax on our commission; confirm how that works when
  we deduct the commission ourselves.
- **Records:** monthly export of gross orders, commission, fees, refunds, withdrawals and closing seller balances.
- **Statements:** account B's balance looks like company cash but is mostly sellers'; show it as customer funds
  with a matching payable.

---

## 8. Legal and registrations (confirm)

- Holding customer money can be regulated. The Escrow Act B.E. 2551 limits who may act as an escrow agent
  (licensed banks and similar). The Payment Systems Act B.E. 2560 needs a Bank of Thailand licence for
  e-money and for "receiving payment on behalf of sellers" (minimum capital about 10 million THB for the latter,
  100 million for e-money; 6-9 months to get). Customer funds must be kept in separate accounts.
- Our approach is the "marketplace holding" model: our own logic and terms for holding, a closed-loop wallet.
  Because buyers pay us directly (no licensed gateway in between), the lawyer must say whether this fits
  without a licence. A closed-loop wallet may be exempt or only need registration at small size (a source
  mentioned a 50 million THB average float for multi-merchant e-money). **A lawyer must say whether TCS
  qualifies.** The screenshots about Fastwork are unverified AI summaries.
- Likely registrations (from the screenshots, unverified): DBD e-commerce registration, ETDA digital platform
  service notification, direct-sales/direct-marketing registration with the consumer protection office (สคบ.).
- Terms of service must say: TCS holds money on the seller's behalf and releases it on buyer approval or
  auto-approve; withdrawal fee; refunds by hand; unclaimed balances. See section 16 for the clickwrap and consent log.
- Card holds (authorize now, capture later) were considered and rejected: cards only, holds expire around 7 days,
  and we do not take cards.
- A wallet balance open to the public, or one that can be spent outside TCS, would be e-money and is **out of
  scope**.

### Questions to send
- **Lawyer (a licensed Thai lawyer, not only a student):** may TCS receive buyers' money directly into its own
  account on behalf of sellers; is a seller balance a permitted closed-loop wallet; any licence or registration
  needed; anti-money-laundering duties; what happens if the bank freezes B; terms wording. The full list is in
  [legal-summary.md](legal-summary.md).
- **Accountant:** agent vs principal, VAT timing and invoices, seller reporting and withholding, interest on B,
  owner buffer, year-end treatment of money held for sellers.
- **Bank:** is account B allowed to take many small transfers and pay out to many sellers, and will they note
  that purpose on the account; account B as a customer-funds account; fees on incoming and outgoing transfers;
  zero-interest account types; the corporate cash management service (fees, minimums, approval for a new company).
  **Checking a payment with the bank** (from weakest to strongest; answers decide which way we go, the ledger
  stays the same):
  1. Does account B give a **file or API feed of its transactions** (so our system reads the statement lines and
     matches orders itself instead of an admin looking them up)? Which product, fee, minimum balance, approval?
  2. Do you offer **Bill Payment QR with a callback** (the bank tells our server "reference X paid 300 baht", no
     slip needed) to a small new company? Fee, paperwork, how long?
  3. Do you offer a **slip verification API** for business customers, or which providers do you recommend?
  4. What does an **incoming-transfer line on the statement show**: sender name, sender bank, hidden account
     number, a unique transaction reference? Please show one real example. (We type the payer name and bank from it.)
  5. Is the **transaction reference printed in the slip QR** the same one that appears on our statement line, so
     one number can match slip and statement?
  6. Can we get **statements daily and in a machine-readable format** (CSV or similar)?
- **Slip-reader provider:** price per slip, uptime, which banks it covers, how it detects edited slips.

---

## 9. Seller identity and bank-name check (part of this plan)

Decision (Oct 2026): sellers prove both **who they are** and **whose bank account it is**. Buyers are not verified;
a buyer only gets money back through a refund, and every refund goes to the **same account the payment came from**.

### Seller flow
1. **Identity (eKYC):** the seller photographs their ID card and a live face check; an external eKYC provider
   checks the card is genuine and the face matches. We keep the provider's result and the verified legal name,
   not the images (see privacy below).
2. **Bank account:** the seller enters the account number. The account holder name must match the verified legal
   name from step 1.
3. **Proof of the account name that cannot be faked by the seller:** the name shown by **our own bank** when an
   admin enters the account number in the bank app to pay. In the manual-payout phase the admin compares that
   name with the verified legal name **before the first transfer** and marks the account verified. A name typed
   by the seller, or a name read from a transfer slip, is not accepted as proof.
4. A near-miss goes to an admin; changing the legal name or the account clears the verified flag and everything
   is checked again.
5. Only then does the seller get the verified badge (the `verified` column exists but nothing sets it today)
   and may withdraw. Decide whether verification is needed before listing (builds buyer trust) or only before
   the first withdrawal; the trust argument favours before listing.

### Why not the other methods
- Seller-typed names are too easy to fake. Names on slips are partly hidden and only exist for buyers.
- A 1 baht test transfer can be passed with a mule account; it proves control of an account, not whose it is.
- A bank or provider name lookup, if one exists for us, is still not proof of identity on its own.

### Buyers
- No identity check. Refunds go back to the paying account only, never to another account.
- Fraud limits instead: new-buyer spending limits, flags for repeated or unusual purchases, and every slip
  checked as in section 5.

### Privacy and law
- An ID card and a face scan are personal data, and face data is biometric (treated as sensitive under the PDPA;
  Thai ID cards also print religion). Get explicit consent, store as little as possible (provider result and name,
  not the images), restrict access and set a retention period. Ask the lawyer (see legal-summary.md).
- eKYC provider and price are not chosen; get quotes.
- Weak spot that remains: a stolen ID with a matching bank account. Liveness checks reduce it; they do not remove it.

---

## 10. What changes in the code

| Today | Under this plan |
|---|---|
| Buyers pay through Omise at checkout | Dynamic PromptPay QR per order plus a slip upload and slip-reader check |
| `payOutOrders` pays each completed order to a seller's Omise recipient (20 THB each) | Stops paying sellers. Completing an order only credits the ledger |
| Seller bank account saved as an Omise recipient | Saved by us (encrypted), name-checked |
| No seller balance | Ledger, pending/available balances, withdrawal requests, admin payout page |
| Cron runs timers + payouts | Timers stay; add the daily cover check |

The existing Omise code is the starting point for Part B if we fall back. The untracked migration
`supabase/migrations/0015_server_timers.sql` looks stale (superseded by `/api/cron/timers`, and clashes with
`0015_bid_increment.sql`); delete it after checking.

---

## 11. Build order

1. **Phase 0, pay-in. Written (Oct 2026), migration `0029_payin_slips.sql`, admin page `/admin/payments`.**
   Checkout now shows a dynamic PromptPay QR for the exact order amount (payload in `src/lib/promptpay.ts`, no
   gateway; set `PROMPTPAY_ID` to the company's 13-digit tax ID or 10-digit mobile number) and takes a slip
   upload (private bucket `payment-slips`). **An admin confirms the payment** against account B's statement
   (statement reference required, one line pays one order); that sets `PAID_HELD` and does the Phase 2 match in
   one step. A rejected slip shows its reason and the buyer can upload another; a slip for a cancelled or already
   paid order goes to "refund due" and is refunded by hand to the paying account. A slip under review extends the
   order's deadline by 48 hours so the timer does not cancel it. No slip-reader service yet (it would replace the
   admin step); the Omise code is dormant (`payOrder`, webhook, `syncCharge`) as the Part B fallback. Not built:
   random odd satang per order (buyers pay the exact price; add if matching slips to statement lines gets hard).
   Payer info (migration `0030_payer_info.sql`): the admin can type the payer name, a bank (list) and the hidden
   account digits from the slip or statement when confirming, and fix them later; stored per slip so each is linked
   to its buyer, name also stored cleaned for matching; all optional hints, the slip image stays the truth. The
   slip's own QR (transaction reference and sending bank) is read in the buyer's browser (jsQR), re-parsed by the
   server and used only to stop one slip paying twice and to pre-fill the bank; it does not prove the slip is real.
   Bank codes and the QR layout are from memory: test with real slips from each bank. Fraud flags that use the
   payer data are the next step,
   and unidentified deposits (money in B with no slip) still show only as the reconciliation surplus.
2. **Phase 1, no bank API needed. Done and hand-tested (Oct 2026).** Ledger tables; pending/available; withdrawal
   request screen; admin page with a CSV of requests and a "mark as paid" button; admin pays by hand from the bank
   app. Hand-test scripts: `supabase/test-data/`.
3. **Phase 2. Written (Oct 2026), migration `0026_reconciliation.sql`, admin page `/admin/reconciliation`.**
   Daily reconciliation (admin types B's balance; owed comes from the ledger; a shortfall shows a red alarm and
   does not block withdrawals); each payment matched by hand to a bank statement line (reference, unique) before a
   completed order's money is withdrawable; monthly CSV export for the accountant. Not built: statement CSV import
   (add when the bank and its format are chosen), the `commission_moves` table (so the difference also contains
   our unmoved commission), and matching on slip upload (Phase 0 does not exist yet).
4. **Phase 3. Written (Oct 2026), migration `0027_terms_acceptances.sql`, draft text in [terms-draft.md](terms-draft.md).**
   Draft `/terms` and `/privacy` pages (version `v0-draft`, lawyer text replaces them later), an optional tick at
   `/welcome` (skippable), and a consent step (`/terms/accept`) that sellers hit when listing or withdrawing and
   buyers hit at checkout. Bidding is not gated. Consent log is append-only: user, version, time, IP.
5. **Phase 4. Written (Oct 2026), migration `0028_seller_verification.sql`, admin page `/admin/sellers`.**
   Manual identity check, no eKYC provider yet: the seller uploads a selfie holding the ID card plus the card front
   (private bucket `id-checks`, consent tick); an admin looks, types the legal name from the card and approves or
   rejects; **the images are deleted on either decision** (only name, admin and time are kept). A second admin step
   confirms that the account holder name our own bank shows for the saved number matches that name. A seller may
   verify any time but needs both steps to withdraw (`request_withdrawal` raises `not_verified`); changing the
   account clears the name check; `profiles.verified` (the badge) follows both checks. Buyers need nothing but
   login. Not built: an eKYC provider (iApp and Didit list roughly 1 to 12 THB per check, unverified; get quotes
   that include liveness), a "name does not match" state (the admin just leaves it and tells the seller), and
   checks for a seller changing the legal name later (a new submission is blocked while approved).
6. **Phase 5.** Bank API for pay-in and bank bulk payment for payouts (corporate cash management), once the
   corporate account is open and the legal answers are in.

Open decisions: minimum withdrawal, how disputed orders affect pending balances,
unclaimed-balance rule, which slip-reader service, how many open orders may share an amount.

---

## 12. How much is safe to move from account B to account A

All buyer money lands in B as one pool. We move our share to A by hand.

Example: 10 orders of 1,000 THB, 10% commission, sellers not yet paid out:

| | Amount |
|---|---|
| Buyers paid into B | 10,000.00 |
| Owed to sellers (90%) | 9,000.00 |
| **Safe to move to A** | **1,000.00** (before the buffer) |

The safe amount is **B balance minus total owed to sellers (pending + available)**, minus a small buffer.
- The admin page should show: expected B balance, total owed, safe to move. Do not guess from the bank balance.
- Move weekly or monthly, only the safe amount. Withdrawal fees stay in B until moved. Bank fees, slip-reader costs
  paid from B, and hand refunds reduce the safe amount.
- Putting our own money into B as a buffer is fine: record it as capital or an owner's loan, not income, and only
  take out the excess above what we owe.

---

## 13. Database records (design sketch)

Do not store a mutable `total_balance` as the source of truth: a seller's balance is the **sum of ledger entries**
(a cached copy is fine).

| Table | Purpose | Main columns |
|---|---|---|
| `orders` (exists) | One row per sale | code, seller, gross, seller share, commission, `commission_bps`, status, slip reference, paid/completed dates, refunded amount |
| `payment_slips` (new) | Each uploaded slip | order, image, slip reference (unique), amount, sender, reader response, status (accepted/rejected/review) |
| `ledger_entries` (new, append-only) | Every change to a seller's money | seller, order or withdrawal link, type (order credited / order completed / withdrawal / withdrawal fee / refund / adjustment), bucket (pending/available), signed amount, date, note, unique key |
| `seller_payout_accounts` (exists; reused in Phase 1) | Where to pay | seller, bank, encrypted number, last 4, account name. The `verified` flag is added in Phase 4 |
| `withdrawals` | Seller requests | seller, amount requested, fee (1%), amount paid, status (requested/batched/paid/failed), batch, dates, bank reference |
| `commission_moves` | B to A transfers | amount, date, bank reference, the safe-to-move figure at the time |
| `reconciliation_log` | Daily check | date, B bank balance, total owed, difference |
| `terms_acceptances` (new, append-only) | Proof of consent | user, terms version, date and time, IP (section 16) |

Rules:
- Amounts are **whole satang (integers)**, never decimals.
- Never update or delete a ledger entry; a mistake gets a reversing entry.
- Pending and available balances are each the sum of that bucket's entries. Total owed = all sellers' pending + available.
- The existing `orders` table already has commission and payout columns, so most work is slips, ledger and withdrawals.

### Percentages in integers
Compute a cut once, round it to a whole satang, and give the remainder to the other side, so the parts always add up:

```
commission   = round_half_up(gross * bps / 10000)     // 8% = 800 bps, 1% = 100 bps
seller_share = gross - commission
```

| Case | Gross (satang) | Rate | Cut | Other side |
|---|---|---|---|---|
| 1,000 THB order | 100,000 | 8% | 8,000 | 92,000 |
| 199.99 THB order | 19,999 | 8% | 1,599.92 -> 1,600 | 18,399 |
| 50 satang edge | 50 | 8% | 4 | 46 |
| Withdraw 1,000 THB | 100,000 | 1% | 1,000 | 99,000 (990 THB) |

- Use one rounding rule everywhere (order page, ledger, seller display). `splitPayout` in
  [src/lib/commission.ts](../src/lib/commission.ts) already takes the commission first and gives the remainder to the
  seller, but it works in whole baht.
- Store the rate on each order (`commission_bps`) so changing the rate never alters old orders.

---

## 14. When each record is written, and where the data comes from

| When | Record | Source |
|---|---|---|
| Auction ends or buy-now | Order created: code, buyer, seller, gross, `commission_bps` | Our own listings/bids, in the timers job or buy-now action |
| Buyer uploads the slip | `payment_slips` row; if accepted, order `PAID_HELD`; ledger: seller **pending** + seller share | **Slip reader** response, checked by our server |
| Order completes (approve, 48h auto-approve, dispute for seller) | Ledger: pending -> **available**; commission recorded | Our status change, in the *same transaction* (a trigger already exists at `COMPLETED`) |
| Dispute for buyer / refund | Ledger: seller pending reversed; refund amount on the order | Admin decision; hand-refund amount entered by the admin |
| Seller requests withdrawal | `withdrawals` row; ledger: available - amount | Seller's form, but the **server** checks the balance and works out the fee |
| Withdrawal paid | Marked paid, bank reference, date | Our admin (later the bank's bulk response) |
| Withdrawal fails | Marked failed; amount returns to available | Admin or bank response |
| Commission moved B -> A | `commission_moves` row | Our admin, after moving the money |
| Every day | `reconciliation_log` row | B balance typed in (later a bank feed); owed total from the ledger |

Rules for the writes:
- Nothing comes from the browser; amounts, fees and statuses are set by the server.
- Idempotent: give each entry a unique key (for example `order-<id>-paid`) so repeated checks/cron runs add nothing.
- A status change and its ledger entries are saved together or not at all.
- Manual entries record who made them and when. Corrections are reversing entries.
- Human-supplied weak points: the slip reader's result, B's balance, hand payouts and hand refunds. Check them in the daily reconciliation.

---

## 15. Audit trail (what the tax office could see)

The tax office sees our filings and books, and may also see bank data (a Thai e-payment reporting rule exists for
accounts with many transactions or large totals; thresholds unverified, see section 17). Large inflows into B
look like gross sales, so we must be able to show that most of it is seller money.

1. Terms of service stating TCS collects on the seller's behalf and keeps a commission.
2. The unchangeable ledger: gross, seller share, commission and fees for every order.
3. Account B used only for seller money (plus any recorded buffer).
4. Monthly reconciliation of B's balance against what we owe sellers, saved as a report.
5. Invoices or receipts for our fees to sellers once VAT registered.
6. An accountant booking it as agent: only commission and fees are revenue, seller money is a payable.
7. Matching amounts between the slip, account B's statement and the ledger, so one order can be followed from
   payment to payout.

Risk if records are weak: the larger inflows could be treated as revenue and we would have to prove otherwise.

---

## 16. Policy and legal checklist (what the site needs)

Source: two AI-written summaries pasted in chat (in Thai, unverified), checked against the repo on 2026-10-03.
Nothing here is legal advice. The lawyer and accountant must confirm every item. No item below is built yet.

### What the pasted summaries say (translated, short)
**Weak point: the terms of service.** If the terms are only a page nobody has to accept, a tax officer could say
"anyone could have written that later". So we must also do:
1. **Clickwrap agreement.** Sellers must tick a checkbox accepting the terms before using the service.
2. **Consent log in the database.** Store user ID, date and time, terms version and IP address as proof that the
   seller agreed to make TCS the party that collects money for real, from the day they started selling.

**What the tax side expects:**
1. **Agency-model terms.** The terms must state that the platform is only an agent receiving payment on the
   seller's behalf, and that the goods do not belong to the platform.
2. **Company bookkeeping.** The accountant must book the 1,000 THB arriving in account B as a deposit/liability
   (900 THB owed to the seller) and as service revenue (100 THB) only.
3. **The ledger (section 13).** The reconciliation must match every bank-statement line to an order ID and a
   seller code, so the accountant or tax officer can see: this 1,000 belongs to order #123, 900 goes to
   seller A, 100 is the company's.
4. **Receipts and tax invoices.** The company issues a receipt or tax invoice to the seller for the commission and
   withdrawal fee only. Never one for the full 1,000 to the buyer (the goods invoice is the seller's job).

### Status against the code

| # | Requirement | Status | To do |
|---|---|---|---|
| 1 | Clickwrap checkbox (sellers; also buyers for delivery and dispute rules) | Missing. No terms page, no accept step; login goes to `/welcome` | Required checkbox at seller signup and at checkout, linking to the terms |
| 2 | Consent log (user, timestamp, terms version, IP) | Missing. Only `profiles.onboarded_at` exists | `terms_acceptances` table, append-only, written by the server; give the terms a version number |
| 3 | Agency-model terms (collects on seller's behalf, commission, withdrawal fee, hand refunds, unclaimed balances, release on approval or 48h auto-approve) | Missing | Lawyer writes; we publish a terms page marked "draft" until then |
| 4 | Bookkeeping (B = liability, commission and fees = revenue) | Not code; see sections 7 and 15 | Give the accountant sections 7 and 15 |
| 5 | Ledger and reconciliation tied to order ID and seller code | Planned, not built (sections 11, 13, 14); `0024_seller_payouts.sql` is the old per-order payout | Build Phases 1 and 2; keep the slip image and reader response with each order |
| 6 | Receipts / tax invoices for commission and fees only | Missing | Needed once VAT-registered; ask the accountant whether before |
| 7 | Privacy policy (PDPA: we will hold bank account numbers, delivery addresses, IP addresses, and slip images showing buyers' names and account numbers) | Missing | Lawyer-approved privacy page, linked from signup and checkout |

### Build order for the policy work
1. Terms and privacy pages (draft, versioned) and the `terms_acceptances` migration.
2. Clickwrap checkboxes at seller signup and checkout; the server refuses to continue without a recorded
   acceptance of the current version, and asks again when the version changes.
3. Ledger and reconciliation (section 11) so item 5 can be shown.
4. Invoice/receipt generation after the VAT answer.

### Open questions for the lawyer and accountant
- Is the agency wording enough, and does the closed-loop wallet need registration (section 8)?
- Exact terms text, including unclaimed balances, refund timing and dispute authority.
- Do we need seller KYC beyond the bank-name check (section 9)?
- When must receipts or tax invoices start, and what VAT applies to commission and withdrawal fees?

---

## 17. Tax follow-ups: reporting, interest, agent ruling, public view of B

All from memory and chat, unverified. The accountant and lawyer confirm.

### E-payment reporting
Banks and payment providers report accounts with many incoming transactions or a large yearly total to the
Revenue Department (remembered thresholds: about 3,000 transactions a year, or about 400 transactions with
2 million THB or more; unverified). Account B will receive many buyer payments, so these inflows may be reported
as if they were company sales. The report does not say whose money it is, so the ledger and reconciliation must
be able to show that most of it belongs to sellers.

### Interest on account B
Ask the bank for a type of account that pays no interest or very little, so the question of who owns the interest
does not arise:
- Current account (กระแสรายวัน): usually no interest; may need a chequebook and have fees.
- A business savings account at 0% or a very low rate, if the bank offers one.
- An ordinary savings account pays interest, normally with 15% withholding tax taken by the bank.

If B does pay interest, the accountant decides the booking; default is company income. The terms may say interest
belongs to TCS (lawyer to check the wording).

### Making the tax office accept agent treatment
No guarantee; it is judged on evidence and substance. What helps:
1. Terms of service stating TCS collects for the seller and keeps a commission, accepted by clickwrap with a
   consent log (section 16).
2. Conduct that matches: separate account B, ledger showing the seller as owed, no spending of seller money.
3. Books and invoices that match: B booked as a payable; only commission and fees as revenue; invoices to sellers
   for commission and fees only.
4. A reconciliation trail from every bank-statement line to an order and a seller (sections 13 to 15).
5. **Written ruling request** (หนังสือขอหารือ) to the Revenue Department describing the model and asking whether
   it agrees. The answer is slow, but a written reply is the strongest protection. Ask the accountant if it is
   worth doing before launch.
6. Consistency: do not switch between agent and principal treatment over time.

Weak spot: if TCS sets prices, decides disputes and controls the money, it may look like a seller. Get the
accountant's opinion before launch.

### Showing account B publicly (balance and transactions)
Not recommended as a live bank view. Reasons:
- Transactions carry buyer and seller names and amounts; publishing them risks the PDPA and the terms we give users.
- Competitors and fraudsters can read our volume and timing.
- It does not prove anything legally: the tax office and lawyer rely on the ledger, reconciliation and books.
- Banks do not offer a public read-only view; we would have to copy data out ourselves.

Safer ways to build trust:
- Publish only totals on the site, for example "held for sellers" and "owed to sellers", from the daily
  reconciliation, with no per-transaction detail.
- A periodic letter or report from the accountant confirming that B's balance covers what is owed to sellers.
- Clear terms on how money is held, released and refunded.

---

## 18. Is it possible with a small budget

Mostly yes, if we start small and manual.
- **Cheap:** no gateway setup or monthly fee; a second company bank account is usually free; the ledger and
  withdrawal screens are our own development; manual payouts need no corporate bank service; registrations look
  low-cost (confirm fees).
- **Cannot price yet (get quotes):** a lawyer consult, an accountant (setup and monthly), the slip-reader service,
  the bank's corporate cash management service (fees, minimum balances, approval for a new company).
- **Big saving:** the 10 million THB payment licence is avoided only if the agent + closed-loop wallet model is
  accepted, and here there is no licensed gateway in the middle. That is the whole bet; the lawyer answers it.
- **What could stop it:** the law (if TCS needs a licence, a small budget cannot cover it and we move to a provider
  that holds funds, see Part B); slip fraud or the slip reader failing; no cash for refunds and failed payouts
  (keep a few thousand baht buffer in B); low volume (fixed costs such as an accountant need a few hundred orders a
  month at 5% on 1,000 THB orders; an estimate).
- **Suggested order:** (1) book one lawyer consult and get the bank's and the slip reader's answers; (2) if fine,
  build Phases 0 to 3 (QR, slips, ledger, manual payouts, terms) and launch with few sellers; (3) add the bank API
  and bulk payment when volume justifies it.

---

## 19. Trust, fraud and account-freeze controls

Raised by a reviewer who works at the Stock Exchange of Thailand (Oct 2026). Two concerns: (1) buyers will not trust
an unknown company enough to send money first; (2) criminals may send stolen money, and the bank could freeze all of
account B, including honest sellers' money. Bank and law details are from memory and unverified.

### 19.1 Why a buyer would trust us
The escrow-style hold (money released only on approval, video evidence, dispute decisions, refunds by hand from B)
is only a mechanism; buyers must first trust TCS. Steps that help, in order of importance:
1. Verified sellers only (section 9): ID card, face check and bank-name match, and a visible verified badge.
2. Start with few, vetted sellers; cap order values for new sellers.
3. Show real company details (name, registration number, address, DBD e-commerce mark once registered).
4. Plain terms: where the money is, when it is released, how refunds and disputes work, who decides.
5. Third-party proof when ready: the accountant's letter that B covers what is owed; only totals shown, never the
   bank transactions (section 17).
6. Seller reviews and sales history (reviews already exist).
7. A refund promise we can afford: keep a cash buffer in B (section 4).

### 19.2 Stolen money and freezing
Scenario: a criminal tricks a victim into paying our QR (the QR shows TCS's name, which helps but does not stop a
victim who is being coached), the victim reports it, and the bank freezes all of B.
- **Refunds go only to the account that paid.** A criminal cannot cash out through a refund to another account.
- **Sellers are verified (section 9),** so we can trace who was paid.
- **The remaining route is a seller who is an accomplice** (the criminal "buys" from a friend who withdraws clean
  money). Controls below.
- Keep every slip and ledger entry so we can show an officer which money belongs to which order and ask for a
  partial release.
- If the bank freezes B: the terms must say what happens to sellers' and buyers' money, and the lawyer must tell
  us our duties (legal-summary.md, group G).
- Be honest about what is left: one account receiving everyone's money means a freeze hits everyone. Paying
  sellers sooner after the dispute window shortens how much sits in B, but conflicts with holding for buyers.
  This trade-off is open.

### 19.3 What to watch (unusual patterns)
- Many different buyer accounts paying from the **same bank account** (one person with many accounts, or one mule).
- One new seller receiving many high-value orders from brand-new buyers, then withdrawing at once.
- Orders from brand-new buyers at high values.
- Buy-and-refund quickly is low priority, since refunds go back to the payer.
Show flagged orders on the admin page; the action is to hold the money and ask the seller or buyer for more.

### 19.4 Unidentified deposits (money in B with no slip)
- The bank statement for B is the source of truth about who paid; the sender name is often partly hidden and the
  detail depends on the bank (ask).
- If someone pays the QR but never uploads a slip, the order stays unpaid and the money is an **unidentified
  deposit**. It is not owed to any seller and must never become withdrawable.
- The daily reconciliation shows B holding more than the ledger accounts for; that is the alarm. Check with the
  bank who paid, refund to the paying account, and keep the record. A deposit nobody claims is a laundering
  warning sign for the lawyer or bank.
- A bank bill-payment QR with a reference per order (Phase 5) identifies the payer without a slip.

### 19.5 Delivery checks before money is released (code items)
Today a courier order cannot be shipped without a tracking number, but the number is only checked for format
([trackingUrl.ts](../src/lib/trackingUrl.ts)), and meet-up orders have no tracking at all.
1. Check with the courier that the number exists and shows a real parcel (courier access unverified).
2. Make money available only when the courier shows delivered **and** the buyer approves or the 48h auto-approve
   passes, so a parcel that never moved cannot be approved.
3. Compare the delivery area with the buyer's address (province or postcode) where the courier shows it.
4. Require tracking or restrict meet-up for higher-value orders.
These make a fake sale cost more and leave evidence, but a real near-empty parcel to an accomplice still passes.
So pair them with:
- an order-value cap for new sellers;
- a longer wait before a new seller's first withdrawals become available;
- the flags in 19.3.

### 19.6 Decisions still open
Whether verification is needed before listing or only before the first withdrawal; the order cap and wait for new
sellers; the new-buyer spending limit; whether meet-up is allowed at all above some value; how long money stays in B
(shorter lowers freeze exposure, longer protects buyers).

---

## 20. Not yet verified

- Every fee, price and threshold here is from public pages, comparison sites or memory.
- The slip-reader provider, its price and its fraud detection are not chosen.
- Whether the bank offers a customer-funds account, a zero-interest account and bulk payment to a new company.
- Whether direct collection of buyer money fits the law without a licence.
- Whether the Fastwork-style set-up is licensed was not established.

---

# Part B: fallback, the Omise route

Use this only if the lawyer says direct collection needs a licence, or slip fraud is too high. Part A's ledger,
accounts, tax and policy work all carry over; only the pay-in and the "paid" event change.

## 21. Omise route (earlier plan)

### Flow
```
 BUYER pays with PromptPay / TrueMoney (no cards)
   v
 OMISE (payment gateway) -- takes its pay-in fee --> money sits in the Omise balance
   | 7-day Omise hold, then "transferable"
   | batch transfer (daily/weekly, 20 THB + VAT per transfer)
   v
 ACCOUNT B  -> same ledger, withdrawals and B -> A moves as in Part A
```
Money-flow differences against section 2: at step 1 about 982 of the 1,000 is in the Omise balance after the
PromptPay fee; the money reaches B only after the 7-day hold in a batch transfer. Omise refunds come out of the
Omise balance, which may be empty after the transfer, so after the money has moved, refunds are done by hand
from a company account and written into the ledger.

### Fees (estimates)
Assumptions: PromptPay 1.65% and TrueMoney 2.65% pay-in, both plus 7% VAT; Omise transfer 20 THB + VAT;
withdrawal fee 1% charged to the seller; no cards. Per 1,000 THB order, before sharing the transfer and bank costs:

| | Commission | Omise pay-in fee | Withdrawal fee (1% of seller share) | Roughly kept |
|---|---|---|---|---|
| PromptPay, 5% | 50 | 17.66 | 9.50 | **41.84** |
| PromptPay, 10% | 100 | 17.66 | 9.00 | **91.34** |
| TrueMoney, 5% | 50 | 28.36 | 9.50 | **31.14** |
| TrueMoney, 10% | 100 | 28.36 | 9.00 | **80.64** |

- Under the old way (a 21.40 Omise transfer per seller payout) the same order kept only 10.94 (PromptPay 5%)
  or 0.24 (TrueMoney 5%).
- Make PromptPay the default at checkout; it is cheaper than TrueMoney.
- Rates are negotiable at volume. Ask Omise.

Moving money from Omise to account B costs 20 THB + 7% VAT = **21.40 THB per transfer**, not per order. Per order,
with the 1% withdrawal fee on the seller share, bank payout cost and VAT on our commission not included:

| Order | Orders in batch | 5% PromptPay | 5% TrueMoney | 8% PromptPay | 8% TrueMoney | 10% PromptPay | 10% TrueMoney |
|---|---|---|---|---|---|---|---|
| 100 | 1 | -17.22 | -18.29 | -14.25 | -15.32 | -12.27 | -13.34 |
| 100 | 10 | 2.04 | 0.97 | 5.01 | 3.94 | 6.99 | 5.92 |
| 100 | 50 | 3.75 | 2.68 | 6.73 | 5.66 | 8.71 | 7.64 |
| 200 | 1 | -13.03 | -15.17 | -7.09 | -9.23 | -3.13 | -5.27 |
| 200 | 10 | 6.23 | 4.09 | 12.17 | 10.03 | 16.13 | 13.99 |
| 200 | 50 | 7.94 | 5.80 | 13.88 | 11.74 | 17.84 | 15.70 |
| 1,000 | 1 | 20.44 | 9.74 | 50.15 | 39.45 | 69.95 | 59.25 |
| 1,000 | 10 | 39.70 | 29.00 | 69.41 | 58.71 | 89.21 | 78.51 |
| 1,000 | 50 | 41.41 | 30.71 | 71.12 | 60.42 | 90.92 | 80.22 |

Orders needed in one batch to break even:

| Order | 5% PP | 5% TM | 8% PP | 8% TM | 10% PP | 10% TM |
|---|---|---|---|---|---|---|
| 100 | 6 | 7 | 3 | 4 | 3 | 3 |
| 200 | 3 | 4 | 2 | 2 | 2 | 2 |
| 1,000 | 1 | 1 | 1 | 1 | 1 | 1 |

- Never transfer from Omise to B per order. Batch (daily/weekly, or when at least ~20 orders are waiting).
- The Omise fee is flat up to 2 million THB, so one big transfer costs the same 21.40.
- Cheap orders (under ~200 THB) are the weak spot; a minimum order price or small fixed fee would fix that.
- Pay-in fees are probably not returned on refunds (unconfirmed for Omise).

### Safe to move from B to A with Omise
10 orders of 1,000 THB by PromptPay, 10% commission, sellers not yet paid out:

| | Amount |
|---|---|
| Buyers paid | 10,000.00 |
| Omise pay-in fees (1.65% + VAT) | -176.55 |
| In the Omise balance | 9,823.45 |
| Omise transfer fee to B | -21.40 |
| **Arrives in B** | **9,802.05** |
| Owed to sellers (90%) | 9,000.00 |
| **Safe to move to A** | **802.05** |

The ledger shows 1,000 commission, but Omise's fees have already come out of what B received, so the safe amount
is still **B balance minus total owed to sellers**, minus a small buffer. Two transfers from Omise (one to A, one
to B) would cost another 21.40; one transfer to B plus a bank transfer to A is cheaper.

### Providers compared (pay-in PromptPay / payout)
Omise 1.65% / 20 THB; Stripe Connect 1.65% / 0.25% + 15 THB plus 60 THB per active seller per month (worse for
many small sellers); Xendit 0.80% + 7 THB / unknown; Beam 0% reported / no seller payouts found; Pay Solutions
1% / 12-20 THB to us only; 2C2P quote only. Decision at the time: stay with Omise; nothing else was clearly
cheaper or confirmed for holding funds. Xendit and Beam payout/marketplace details were not found.

### Questions to send to Omise (support@opn.ooo)
May we hold buyer money for 10-14 days; can a transfer use money under 7 days old; can we settle everything to a
separate company account (B); new-recipient activation and name check; our real rates (PromptPay, TrueMoney,
transfer fee, VAT); refund rules for PromptPay/TrueMoney and how long; any limits on transfers.

### Code and data differences
- Pay-in webhook `/api/omise/webhook` (or the charge sync on return to checkout) sets `PAID_HELD`; store the Omise
  charge id and the fee Omise reports per charge (do not calculate it ourselves).
- Add an `omise_batches` table: Omise transfer id, amount, fee, date, orders covered. Add the Omise -> B batch
  transfer to the cron job.
- Seller bank accounts need an Omise recipient only for the one transfer target B.
- Known risks in today's code, to check before real money: transfers draw on Omise's "transferable" balance only
  (7-day hold), and new recipients start disabled until verified and activated once.
- Not tested: live Omise payouts or recipient activation. Omise has not confirmed that we may hold or forward
  funds this way.
