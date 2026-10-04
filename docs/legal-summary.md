# TCS payment system: summary for legal review

Prepared Oct 2026 for a law student reviewer. This is a plain description of what we plan to build and the legal
questions we cannot answer ourselves. It is **not** legal advice and nothing here has been checked by a lawyer.
Statute names, thresholds and fees below come from public pages, AI summaries and memory, and may be wrong.
Please correct anything that is wrong. Full technical plan: [payment-plan.md](payment-plan.md).

**Who should answer:** the licensing questions (group A) and the banking/AML questions (group G) should be answered
by a **licensed Thai lawyer (ทนายความ)**. A law student can research and prepare them, but we will not rely on a
student's answer for these.

## Read this first: the key question

Buyers will pay **TCS directly**, into TCS's own bank account, for goods that belong to other people (the
sellers). There is no licensed payment gateway in between. This is the riskiest legal choice in the plan: the
activity that licensing rules worry about (receiving payment on behalf of sellers) is done by TCS itself. A
licensed gateway doing the pay-in would shift much of that risk to the gateway, but costs about 1.65% to 2.65% per
order. The answer to question 1 below could change the whole design.

---

## 1. What TCS is

A Thai online marketplace where individual sellers list items (auctions and buy-now) and buyers pay. Login is by
Google only. TCS is meant to be a platform, not a seller: the goods belong to the sellers.

## 2. How money moves (the plan)

1. A buyer wins an auction or buys now. The site shows a **PromptPay QR with the exact amount**. The QR pays into
   a **company bank account B** (customer-funds account). No card payments, no payment gateway.
2. The buyer uploads the transfer slip. A third-party **slip-reader service** checks it against the bank. If it
   matches, the order is marked paid, and the money is **held**.
3. The seller ships; the buyer records an unboxing video on receipt. The buyer approves, or **48 hours pass and the
   order auto-approves**, or a dispute is decided by an admin.
4. When the order completes, the seller's share becomes **available** on the seller's **wallet**. The wallet is
   only a number in our database (a ledger). The real cash stays in account B.
5. The seller requests a withdrawal. TCS keeps a **commission** (5%, 8% or 10%, undecided) and a **1% withdrawal
   fee**. In the early phase an admin pays the seller **by hand** from the bank app.
6. TCS moves its own earnings (commission and fees) by hand from account B to **company account A**.

Refunds are made by hand from account B. Disputes are decided by TCS admins using the buyer's video evidence.

Example: a 1,000 THB order, 10% commission: seller is credited 900; on withdrawing 900, the seller receives 891
and TCS keeps 100 + 9.

## 3. Company set-up

- A Thai limited company with two bank accounts at the same bank: **A** (operating, our money) and **B** (holds
  seller money only, nothing else). Optionally the owner may put a buffer into B, recorded as capital or a loan.
- The wallet is a closed loop: balances can only be paid out to the seller's own verified bank account. No spending
  inside the site, no transfers between users, no top-ups.

## 4. The legal bet

We are **not** applying for a payment licence. Our position is: TCS is an **agent** collecting money on the
sellers' behalf, which is held in a separate account and released on conditions, and the wallet is a closed loop.
If that position is wrong, we may need a licence we cannot afford. Everything depends on the answers in section 6.

## 5. Safeguards we plan (the "how to make it legal" list)

| Area | Safeguard |
|---|---|
| Contract | Terms of service stating TCS is only the sellers' agent for collecting payment, that goods belong to sellers, when money is released, fees, refunds, unclaimed balances, interest. |
| Proof of consent | Clickwrap: users must tick the box to accept the terms (sellers at signup, buyers at checkout). Consent log in the database: user ID, timestamp, terms version, IP address. |
| Privacy | A privacy policy (PDPA). We will hold bank account numbers, delivery addresses and IP addresses, plus **transfer slip images**, which show the buyer's name and account number; limit who can see them and how long they are kept. |
| Bank relationship | Tell the bank in writing, when opening account B, that it holds customer funds for a marketplace and will take many small transfers and pay out to many sellers. Ask whether this use is allowed. |
| Payment checks | Never trust the slip image alone. Each slip reference is used once; the receiving account, amount and time (after the order was created) are checked; each payment is matched to a line on the real bank statement before the seller can withdraw; daily reconciliation. |
| Separation of funds | Account B holds only seller money; daily check that B's balance is at least what we owe sellers. |
| Books | Seller money booked as a liability (payable); only the commission and fees booked as revenue. |
| Ledger | Append-only record of every order, fee, refund and withdrawal, so each bank line traces to an order and a seller. |
| Tax documents | Receipts or tax invoices to sellers **only for our commission and fees**, never for the full sale price. |
| Seller checks | Sellers verify their ID card and face (eKYC). The bank account holder name, as shown by our own bank, must match the verified legal name before any payout. Buyers are not verified; refunds go only to the account the payment came from. |
| Registrations | Company registration, e-commerce registration with the DBD, platform notification to ETDA, possibly direct-sales registration with the consumer protection office. |
| Tax authority | Possibly ask the Revenue Department for a written ruling confirming the agent treatment. |
| Transparency | Publish only totals ("held for sellers"), not the bank transactions. Accountant's periodic letter confirming B covers what is owed. |

## 6. Questions

**A. Licensing (the biggest question)**
1. **Does it matter that buyers pay us directly** into our own account rather than through a licensed gateway?
   Can TCS lawfully receive buyers' money for sellers' goods this way, with or without a licence? (An earlier
   plan used a licensed gateway for the pay-in; we are moving away from it to save fees.)
2. Does TCS need a licence under the **Payment Systems Act B.E. 2560** for receiving payment on behalf of sellers
   or for e-money? (We understand the first needs very large minimum capital and a Bank of Thailand licence.)
3. Does the **Escrow Act B.E. 2551** apply because we hold money until the buyer approves?
4. Is a closed-loop seller balance that can only be paid out to a bank account outside the e-money rules, or does
   it only need registration?
5. Is a separate "customer funds" account enough, or must the funds be held in a trust or by a licensed party?

**B. Consumer and e-commerce**
6. Which registrations are mandatory (DBD, ETDA, direct sales) and what are the penalties for skipping them?
7. Consumer protection rules for the 48-hour auto-approval and the buyer's right to refunds: do they conflict with
   our terms?
8. Is "TCS decides disputes" acceptable, and can we limit our liability?

**C. Contract and terms**
9. Wording of the agency clause, the hold and release conditions, fees, interest, and unclaimed balances. How
   long before an unclaimed balance can be treated differently?
10. Is a clickwrap plus consent log enough proof that a seller accepted?

**D. Data protection (PDPA)**
11. What do we need for collecting bank details and IP addresses (lawful basis, notices, retention, deletion on
    account closure)? We already support account deletion; what must we keep for tax records?
11a. **Transfer slips** show the buyer's name and bank account number, and we plan to store the slip image as
    evidence for the audit trail. What notice, access limits and retention period does this need?

**E. Tax (also for an accountant)**
12. Will the Revenue Department accept agent treatment, or treat the whole payment as TCS revenue?
13. VAT: registration above 1.8M THB revenue; VAT on commission and fees; invoice timing.
14. Do platforms have to report sellers' revenue to the Revenue Department (we heard 150 days after year end), and
    do company sellers withhold tax on our commission?
15. Interest earned on account B: who owns it, and how is it booked?
16. Bank e-payment reporting thresholds (we heard about 3,000 transactions or about 400 transactions with 2M THB
    per year): what is reported about account B and what must we be ready to show?

**F. Risk**
17. If TCS is later found to need a licence, what are the consequences (fines, criminal liability for directors)?
18. Fraud: fake or edited transfer slips; what is our exposure if a seller is paid on a forged slip?

11b. **Seller ID card and face scan** (eKYC): we keep only the provider's result and the verified name, not the
    images. Is explicit PDPA consent enough for biometric data, what notice do we need, and how long may we keep
    the result?

**G. Banking and anti-money-laundering (lawyer)**
19. Account B will receive many small transfers from unrelated buyers and pay out to many sellers. Banks may treat
    this as a "pass-through" account and freeze it. We plan to tell the bank the purpose in writing when opening
    it. Is that enough, and is there any bank product or approval we should use instead?
20. Does holding and moving customers' money make TCS subject to **anti-money-laundering** obligations (customer
    identification, transaction reporting, record keeping)? Which ones, and what do we need before launch?
21. If the bank freezes or closes account B while it holds sellers' money, what are our duties to buyers and
    sellers, and how should the terms deal with it?

## 7. What we need back

A short written answer per question (yes / no / depends and why), the statute or regulation sections it comes
from, and any steps or documents we must add. If the answer to A is "yes, a licence is needed", we will change the
model (for example, use a licensed provider that holds funds).
