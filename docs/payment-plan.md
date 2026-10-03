# TCS payment plan (draft, Oct 2026)

Status: **plan only, nothing below is built yet** except the Omise pay-in. Today the code pays sellers one by
one through Omise transfers ([src/lib/payout.ts](../src/lib/payout.ts)). This plan replaces that step.
Fee numbers come from public pages and comparison sites, not from our Omise contract. Treat them as estimates.
Not legal or accounting advice: every "confirm" item needs a lawyer, an accountant or Omise in writing.

Related decision: phone OTP is dropped on purpose (Google login only). See PRODUCT.md.

---

## 1. The idea in one picture

```
 BUYER
   | pays with PromptPay / TrueMoney (no cards)
   v
 OMISE (payment gateway)  -- takes its pay-in fee --> money sits in the Omise balance
   | 7-day Omise hold, then "transferable"
   | batch transfer (daily/weekly, 20 THB + VAT per transfer)
   v
 ACCOUNT B  (company bank account #2: holds SELLER money only)
   |  website shows each seller a "wallet" number (a ledger in our database, not real cash)
   |  seller asks to withdraw 1,000 THB  ->  seller gets 990 THB, 10 THB (1%) is our fee
   |  batch run (weekly to start) -> bank bulk payment / Corporate Cash Management
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
| 1 | Buyer pays 1,000 via Omise | Omise balance (about 982 after the PromptPay fee) | Order `PAID_HELD`. Seller sees 900 as **pending** |
| 2 | Seller ships, buyer receives, records unboxing video | still Omise | `SHIPPED` -> `DELIVERED` |
| 3 | Buyer approves, or 48h auto-approve, or a dispute is decided for the seller | still Omise | `COMPLETED`. 900 moves from **pending** to **available**. 100 commission recorded as ours |
| 4 | After Omise's 7-day hold, we move money from Omise to account B (batch) | Account B | no change |
| 5 | Seller requests a withdrawal of 1,000 (needs 1,000 available) | Account B | Ledger: available -1,000, payout 990 queued, our fee 10 |
| 6 | Batch run pays all queued withdrawals through the bank | Seller's bank | Request marked **paid** (or **failed** -> money returns to available) |
| 7 | We manually move commission + fees from B to A | Account A | Not a new income event, just our own money moving |

Refunds and disputes: a refund to a buyer is **done by hand from a company account** and is written into the
ledger so the seller's balance and the refund match. (Omise refunds come out of the Omise balance, which may
be empty after step 4, so we do not refund through Omise after the money has moved.)

---

## 3. What we need to set up

1. **Two company bank accounts.** A = operating (commission, fees, our costs). B = holding (seller money only).
2. **Policy and legal.** Terms of service, registrations, lawyer and accountant answers (section 7).
3. **Payment gateway: Omise** for pay-in only.
4. **Corporate Cash Management** from the bank (for example KBank K-Cash Connect Plus or SCB Business Net,
   names from a screenshot, unverified) for bulk payouts. Needs a corporate account and paperwork; start manual.
5. **Wallet ledger in the website:** the "fake wallet number".

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
  account holder name must match the verified name (see section 8).
- **Bank details are sensitive.** We will store sellers' account numbers ourselves (today Omise holds them):
  encrypt them and restrict access.
- **Withdrawal fee: 1%** (example: type 1,000, receive 990). Sellers manage their own withdrawals. A minimum
  withdrawal and one free withdrawal a week are options if sellers complain.
- **Failed payouts** return the money to the seller's available balance.
- **Unclaimed balances:** we need a rule for sellers who never withdraw (decide with the lawyer).

---

## 5. Fees and what we actually keep

Assumptions: PromptPay 1.65% and TrueMoney 2.65% pay-in, both plus 7% VAT; Omise transfer 20 THB + VAT;
withdrawal fee 1% charged to the seller; no cards. Per 1,000 THB order, before sharing the transfer and
bank costs (small when batched; the bank's bulk payout cost is unknown):

| | Commission | Omise pay-in fee | Withdrawal fee (1% of seller share) | Roughly kept |
|---|---|---|---|---|
| PromptPay, 5% | 50 | 17.66 | 9.50 | **41.84** |
| PromptPay, 10% | 100 | 17.66 | 9.00 | **91.34** |
| TrueMoney, 5% | 50 | 28.36 | 9.50 | **31.14** |
| TrueMoney, 10% | 100 | 28.36 | 9.00 | **80.64** |

Notes:
- Under the old way (a 21.40 Omise transfer per seller payout) the same order kept only 10.94 (PromptPay 5%)
  or 0.24 (TrueMoney 5%). Paying sellers from B through the bank removes that cost.
- The commission rate (5% or 10%) is still undecided. The setting is `COMMISSION_RATE` in
  [src/lib/commission.ts](../src/lib/commission.ts). Facebook groups charge nothing, so a high rate may push
  sellers away.
- Make **PromptPay the default** at checkout; it is cheaper than TrueMoney.
- Omise charges 20 THB per transfer, so move money to B in **batches** (daily/weekly), never per order.
- Rates are negotiable at volume. Ask Omise.

Providers we compared (pay-in PromptPay / payout): Omise 1.65% / 20 THB; Stripe Connect 1.65% / 0.25% + 15 THB
plus 60 THB per active seller per month (worse for many small sellers); Xendit 0.80% + 7 THB / unknown;
Beam 0% reported / no seller payouts found; Pay Solutions 1% / 12-20 THB to us only; 2C2P quote only.
Decision: **stay with Omise**; nothing else was clearly cheaper or confirmed for holding funds.

---

## 6. Tax (general, confirm with an accountant)

| Item | Treatment |
|---|---|
| Buyer's 1,000 | Not our revenue by itself; mostly held for the seller |
| Seller balances (and the matching cash in B) | A **liability**, no income tax |
| Commission | **Our revenue**, counted when the order completes |
| 1% withdrawal fee | **Our revenue**, counted when the withdrawal happens |
| Omise pay-in/transfer fees, bank fees | **Expenses** |
| Moving money from B to A | Just a transfer between our accounts |
| Interest on account B | Probably ours; ask the accountant |

- **Timing:** withdrawing from Omise to the bank, or moving money to A, never changes when income counts.
  Tax follows when income is earned, not when cash arrives.
- **Agent treatment:** only the commission is revenue if the terms of service say TCS collects money on the
  seller's behalf and the ledger shows it. If not, the tax office could treat the whole 1,000 as ours.
- **VAT:** registration is needed above 1.8 million THB revenue (confirm). Then VAT applies to commission and
  withdrawal fees; decide whether prices include VAT and issue tax invoices or receipts to sellers.
  VAT on Omise and bank fees may be recoverable.
- **Seller reporting:** one source says platforms report each seller's revenue to the Revenue Department
  within 150 days of year-end. Confirm whether this applies to us.
- **Withholding tax:** company sellers may need to withhold tax on our commission; confirm how that works when
  we deduct the commission ourselves.
- **Records:** monthly export of gross orders, commission, fees, refunds, withdrawals and closing seller balances.
- **Statements:** account B's balance looks like company cash but is mostly sellers'; show it as customer funds
  with a matching payable.

---

## 7. Legal and registrations (confirm)

- Holding customer money can be regulated. The Escrow Act B.E. 2551 limits who may act as an escrow agent
  (licensed banks and similar). The Payment Systems Act B.E. 2560 needs a Bank of Thailand licence for
  e-money and for "receiving payment on behalf of sellers" (minimum capital about 10 million THB for the latter,
  100 million for e-money; 6-9 months to get). Customer funds must be kept in separate accounts.
- Our approach copies the "marketplace holding" model: a licensed gateway for pay-in, our own logic and terms
  for holding, a closed-loop wallet. A closed-loop wallet may be exempt or only need registration at small
  size (a source mentioned a 50 million THB average float for multi-merchant e-money). **A lawyer must say
  whether TCS qualifies.** The screenshots about Fastwork are unverified AI summaries.
- Likely registrations (from the screenshots, unverified): DBD e-commerce registration, ETDA digital platform
  service notification, direct-sales/direct-marketing registration with the consumer protection office (สคบ.).
- Terms of service must say: TCS holds money on the seller's behalf and releases it on buyer approval or
  auto-approve; withdrawal fee; refunds by hand; unclaimed balances.
- Card holds (authorize now, capture later) were considered and rejected: cards only, holds expire around 7 days,
  and we do not take cards.
- A wallet balance open to the public, or one that can be spent outside TCS, would be e-money and is **out of
  scope**.

### Questions to send
- **Omise** (support@opn.ooo): may we hold buyer money for 10-14 days; can a transfer use money under 7 days
  old; can we settle everything to a separate company account (B); new-recipient activation and name check;
  our real rates (PromptPay, TrueMoney, transfer fee, VAT); refund rules for PromptPay/TrueMoney and how long;
  any limits on transfers. (A full draft email exists in the chat history; ask for it again if needed.)
- **Lawyer:** is a seller balance a permitted closed-loop wallet; any licence or registration needed; terms wording.
- **Accountant:** agent vs principal, VAT timing and invoices, seller reporting and withholding, interest on B,
  owner buffer, year-end treatment of money held for sellers.

---

## 8. Seller bank-name check (part of this plan)

- Goal: the bank account name must match the seller's verified legal name before any payout; matching earns the
  verified badge (the `verified` column exists but nothing sets it today).
- Flow: seller enters legal name -> adds bank account -> server compares normalised names (strip Thai titles,
  spaces, punctuation) -> match sets verified; near-misses go to an admin; changing name or account clears it.
- Weakness: a self-typed name only catches typos, not fraud. Ask Omise or the bank whether they check the
  account holder name; stronger options are KYC or ID.
- With bank payouts this check matters more, because the money goes straight to the account typed in.

---

## 9. What changes in the code

| Today | Under this plan |
|---|---|
| `payOutOrders` pays each completed order to a seller's Omise recipient (20 THB each) | Stops paying sellers. Completing an order only credits the ledger |
| Seller bank account saved as an Omise recipient | Saved by us (encrypted), name-checked; Omise recipient only needed for the one transfer target B |
| No seller balance | Ledger, pending/available balances, withdrawal requests, admin payout page |
| Cron runs timers + payouts | Timers stay; add batch transfer Omise -> B and the daily cover check |

Known risks in today's code, to check before real money: transfers draw on Omise's "transferable" balance only
(7-day hold), and new recipients start disabled until verified and activated once. The untracked migration
`supabase/migrations/0015_server_timers.sql` looks stale (superseded by `/api/cron/timers`, and clashes with
`0015_bid_increment.sql`); delete it after checking.

---

## 10. Build order

1. **Phase 1, no bank API needed.** Ledger tables; pending/available; withdrawal request screen; admin page with
   a CSV of requests and a "mark as paid" button; admin pays by hand from the bank app.
2. **Phase 2.** Daily reconciliation report (bank B balance vs total owed); monthly accountant export.
3. **Phase 3.** Replace Omise seller payouts: credit the ledger instead; batch transfer Omise -> B; PromptPay as
   the default checkout method.
4. **Phase 4.** Seller bank-name check and verified badge.
5. **Phase 5.** Bank bulk payment (corporate cash management) once the corporate account is open and the
   legal answers are in.

Open decisions: commission rate (5% or 10%), batch frequency, minimum withdrawal, how disputed orders affect
pending balances, unclaimed-balance rule, whether to keep a reserve in Omise for refunds.

---

## 11. Not yet verified

- Every provider fee here is from public pages or comparison sites.
- Omise has not confirmed that we may hold or forward funds this way.
- Xendit and Beam payout/marketplace details were not found.
- Whether the Fastwork-style set-up is licensed was not established.
- Not tested: live Omise payouts or recipient activation.

---

## 12. Fees with the Omise transfer fee included

Moving money from Omise to account B costs 20 THB + 7% VAT = **21.40 THB per transfer**, not per order. So the
number of orders in each batch matters. Figures below: per order, PromptPay or TrueMoney, 1% withdrawal fee
charged on the seller share, bank payout cost and VAT on our commission **not** included.

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

Rules that follow:
- Never transfer from Omise to B per order. Batch (daily/weekly, or when at least ~20 orders are waiting).
- The Omise fee is flat up to 2 million THB, so one big transfer costs the same 21.40.
- Cheap orders (under ~200 THB) are the weak spot; a minimum order price or small fixed fee would fix that.
- Pay-in fees are probably not returned on refunds (unconfirmed for Omise); each hand refund then costs us the pay-in fee.

---

## 13. How much is safe to move from account B to account A

Money from Omise lands in B as one pool (net of Omise's fees). We move our share to A by hand.

Example: 10 orders of 1,000 THB by PromptPay, 10% commission, sellers not yet paid out:

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
is **B balance minus total owed to sellers (pending + available)**, minus a small buffer.
- The admin page should show: expected B balance, total owed, safe to move. Do not guess from the bank balance.
- Move weekly or monthly, only the safe amount. Withdrawal fees stay in B until moved. Bank payout costs and hand
  refunds reduce the safe amount.
- Putting our own money into B as a buffer is fine: record it as capital or an owner's loan, not income, and only
  take out the excess above what we owe.
- Two transfers from Omise (one to A, one to B) would cost another 21.40; one transfer to B plus a bank transfer to A
  is cheaper.

---

## 14. Database records (design sketch)

Do not store a mutable `total_balance` as the source of truth: a seller's balance is the **sum of ledger entries**
(a cached copy is fine).

| Table | Purpose | Main columns |
|---|---|---|
| `orders` (exists) | One row per sale | code, seller, gross, Omise fee, seller share, commission, `commission_bps`, status, Omise charge id, paid/completed dates, refunded amount |
| `ledger_entries` (new, append-only) | Every change to a seller's money | seller, order or withdrawal link, type (order credited / order completed / withdrawal / withdrawal fee / refund / adjustment), bucket (pending/available), signed amount, date, note, unique key |
| `seller_bank_accounts` | Where to pay | seller, bank, encrypted number, account name, verified flag |
| `withdrawals` | Seller requests | seller, amount requested, fee (1%), amount paid, status (requested/batched/paid/failed), batch, dates, bank reference |
| `omise_batches` | Omise to B transfers | Omise transfer id, amount, fee, date, orders covered |
| `commission_moves` | B to A transfers | amount, date, bank reference, the safe-to-move figure at the time |
| `reconciliation_log` | Daily check | date, B bank balance, total owed, difference |

Rules:
- Amounts are **whole satang (integers)**, never decimals. Omise's API already uses satang.
- Never update or delete a ledger entry; a mistake gets a reversing entry.
- Pending and available balances are each the sum of that bucket's entries. Total owed = all sellers' pending + available.
- The existing `orders` table already has commission and payout columns, so most work is ledger, withdrawals and batches.

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
- Store the Omise fee Omise reports per charge; do not calculate it ourselves.

---

## 15. When each record is written, and where the data comes from

| When | Record | Source |
|---|---|---|
| Auction ends or buy-now | Order created: code, buyer, seller, gross, `commission_bps` | Our own listings/bids, in the timers job or buy-now action |
| Buyer pays | Order `PAID_HELD`; Omise charge id and fee; ledger: seller **pending** + seller share | **Omise** via the webhook (`/api/omise/webhook`) or the charge sync on return to checkout |
| Order completes (approve, 48h auto-approve, dispute for seller) | Ledger: pending -> **available**; commission recorded | Our status change, in the *same transaction* (a trigger already exists at `COMPLETED`) |
| Dispute for buyer / refund | Ledger: seller pending reversed; refund amount on the order | Admin decision; hand-refund amount entered by the admin |
| Omise -> B transfer | `omise_batches` row | Omise transfer response plus our batch job |
| Seller requests withdrawal | `withdrawals` row; ledger: available - amount | Seller's form, but the **server** checks the balance and works out the fee |
| Withdrawal paid | Marked paid, bank reference, date | Our admin (later the bank's bulk response) |
| Withdrawal fails | Marked failed; amount returns to available | Admin or bank response |
| Commission moved B -> A | `commission_moves` row | Our admin, after moving the money |
| Every day | `reconciliation_log` row | B balance typed in (later a bank feed); owed total from the ledger |

Rules for the writes:
- Nothing comes from the browser; amounts, fees and statuses are set by the server.
- Idempotent: give each entry a unique key (for example `order-<id>-paid`) so repeated webhooks/cron runs add nothing.
- A status change and its ledger entries are saved together or not at all.
- Manual entries record who made them and when. Corrections are reversing entries.
- Human-supplied weak points: bank-side payout confirmation, B's balance, hand refunds. Check them in the daily reconciliation.

---

## 16. Audit trail (what the tax office could see)

The tax office sees our filings and books, and may also see bank and payment data (a Thai e-payment reporting rule
exists for accounts with many transactions or large totals; thresholds unverified). Large inflows into B and from
Omise look like gross sales, so we must be able to show that most of it is seller money.

1. Terms of service stating TCS collects on the seller's behalf and keeps a commission.
2. The unchangeable ledger: gross, seller share, commission and fees for every order.
3. Account B used only for seller money (plus any recorded buffer).
4. Monthly reconciliation of B's balance against what we owe sellers, saved as a report.
5. Invoices or receipts for our fees to sellers once VAT registered.
6. An accountant booking it as agent: only commission and fees are revenue, seller money is a payable.
7. Matching amounts between the Omise export, account B and the ledger, so one order can be followed from payment to payout.

Risk if records are weak: the larger inflows could be treated as revenue and we would have to prove otherwise.

---

## 17. Is it possible with a small budget

Mostly yes, if we start small and manual.
- **Cheap:** Omise has no setup or monthly fee; a second company bank account is usually free; the ledger and
  withdrawal screens are our own development; manual payouts need no corporate bank service; registrations look
  low-cost (confirm fees).
- **Cannot price yet (get quotes):** a lawyer consult, an accountant (setup and monthly), the bank's corporate cash
  management service (fees, minimum balances, approval for a new company), Omise live-mode approval documents.
- **Big saving:** the 10 million THB payment licence is avoided only if the agent + licensed gateway + closed-loop
  wallet model is accepted. That is the whole bet; the lawyer answers it.
- **What could stop it:** the law (if TCS needs a licence, a small budget cannot cover it and we move to a provider
  that holds funds); Omise saying no to holding/forwarding funds; no cash for refunds and failed payouts (keep a few
  thousand baht buffer in B); low volume (fixed costs such as an accountant need a few hundred orders a month at 5%
  on 1,000 THB orders; an estimate).
- **Suggested order:** (1) send the Omise email and book one lawyer consult; (2) if fine, build Phase 1 (manual payouts)
  and launch with few sellers; (3) add the bank bulk payment and later phases when volume justifies them.

Commission rate: 5% works per order if transfers are batched, mostly on PromptPay (see section 12); 8% and 10% leave
more room. Sellers can still sell free on Facebook, so compare seller reaction at 5%, 8% and 10%.

---

## 18. Early-phase decision: direct PromptPay QR + slip reader, manual seller payouts

Status: **decided for the early phase, not built.** This replaces Omise as the pay-in for now. Sections 1 to 17
still describe the Omise route and stay as the fallback. Fee, price and bank API details here are from memory,
not quotes; get quotes before relying on them.

### What we do
1. **Pay-in:** the buyer pays by a **dynamic PromptPay QR** generated by us for each order (amount built in,
   cannot be changed by the buyer). It is paid straight into the company account. No gateway, no pay-in fee.
2. **Confirmation:** the buyer uploads the transfer slip; a **third-party slip-reader service** checks it
   against the bank and returns amount, sender and time. A match sets the order to `PAID_HELD`.
3. **Seller payout:** by hand. Sellers request a withdrawal, an admin pays from the bank app and marks it paid
   (Phase 1 in section 10). No bank bulk payment yet.

Where the money sits: buyers pay into account B (seller money only), as in section 1. We move our share to A by
hand using the safe-to-move figure in section 13. With no Omise, the Omise fees, the 7-day hold and the 21.40
transfer fee in sections 5 and 12 no longer apply to this route. Hand refunds now come from B's real cash.

### Rules for the slip check
- Server-side only: the browser never says an order is paid.
- Amount on the slip must equal the order amount exactly; also check receiving account, date and that the
  slip is not older than the order.
- **Each slip reference can be used once** (unique key), so a slip cannot pay two orders.
- Optional: add odd satang to the amount so each open order has its own amount and matching is easy.
- QR and order expire together; late, wrong or double payments go to an admin queue and are refunded by hand.
- Keep the slip image and the reader's response with the order as evidence for the audit trail (section 16).

### Slip reader vs bank API

| | Slip reader (chosen for now) | Bank API (Bill Payment QR, later) |
|---|---|---|
| Flow | Buyer uploads the slip, service verifies it | Bank calls us when the reference is paid |
| Setup | Easy: sign up, API key | Hard: corporate account, bank approval, paperwork |
| Cost | Small per-slip or monthly fee (unverified) | Bank-dependent (unverified) |
| Automatic | Mostly; buyer must upload | Fully |
| Fraud risk | Fake or edited slips, slip reuse; service checks the real bank record | Very low |
| Reliability | Depends on a third party | Bank-grade |

Move to the bank API once the corporate account is open and volume justifies it. The ledger (sections 14, 15)
does not change; only the source of the "paid" event does.

### Risks that come with this route
- **Legal:** with Omise, a licensed gateway took the pay-in. Here TCS receives buyers' money directly on behalf
  of sellers, which makes the Payment Systems Act and Escrow Act question (section 7) sharper. The lawyer must
  answer this before launch.
- No chargeback or KYC tooling from a gateway; a buyer's bank dispute is settled on our records alone.
- Buyers forgetting to upload the slip: show clear steps, a reminder, and an expiry.
- Third-party dependency: if the slip reader is down, orders wait for an admin check.
- Tax and audit: no gateway export to match against, so the ledger and kept slips carry the proof.

### Early-phase build order
1. Dynamic QR generation per order (company PromptPay ID).
2. Slip upload plus slip-reader check, unique slip reference, admin queue for mismatches.
3. Ledger tables, pending/available, withdrawal requests, admin page with CSV and "mark as paid" (section 10, Phase 1).
4. Daily reconciliation of B's balance against total owed (section 10, Phase 2).
5. Later: bank API for pay-in, bank bulk payment for payouts.

Open: which slip-reader service and its price; the company PromptPay ID (juristic person); whether the bank
charges fees on incoming transfers; lawyer's answer on holding buyer money directly.

---

## 19. Policy and legal checklist (what the site needs)

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
3. **The ledger (section 14).** The reconciliation must match every bank-statement line to an order ID and a
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
| 4 | Bookkeeping (B = liability, commission and fees = revenue) | Not code; see sections 6 and 16 | Give the accountant sections 6 and 16 |
| 5 | Ledger and reconciliation tied to order ID and seller code | Planned, not built (sections 10, 14, 15); `0024_seller_payouts.sql` is the old per-order payout | Build Phases 1 and 2; keep the slip image and reader response with each order (section 18) |
| 6 | Receipts / tax invoices for commission and fees only | Missing | Needed once VAT-registered; ask the accountant whether before |
| 7 | Privacy policy (PDPA: we will hold bank account numbers, delivery addresses, IP addresses) | Missing | Lawyer-approved privacy page, linked from signup and checkout |

### Build order for the policy work
1. Terms and privacy pages (draft, versioned) and the `terms_acceptances` migration.
2. Clickwrap checkboxes at seller signup and checkout; the server refuses to continue without a recorded
   acceptance of the current version, and asks again when the version changes.
3. Ledger and reconciliation (section 10) so item 5 can be shown.
4. Invoice/receipt generation after the VAT answer.

### Open questions for the lawyer and accountant
- Is the agency wording enough, and does the closed-loop wallet need registration (section 7)?
- Exact terms text, including unclaimed balances, refund timing and dispute authority.
- Do we need seller KYC beyond the bank-name check (section 8)?
- When must receipts or tax invoices start, and what VAT applies to commission and withdrawal fees?

---

## 20. Tax follow-ups: reporting, interest, agent ruling, public view of B

All from memory and chat, unverified. The accountant and lawyer confirm.

### E-payment reporting (open question from section 16)
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
   consent log (section 19).
2. Conduct that matches: separate account B, ledger showing the seller as owed, no spending of seller money.
3. Books and invoices that match: B booked as a payable; only commission and fees as revenue; invoices to sellers
   for commission and fees only.
4. A reconciliation trail from every bank-statement line to an order and a seller (sections 14 to 16).
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
