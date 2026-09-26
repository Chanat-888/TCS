# Server timers

Some rules must fire without anyone opening a page: auctions ending, unpaid orders,
late shipments, unanswered ship-date proposals, and auto-approval. The rules live in
[`src/lib/orderTimers.ts`](../src/lib/orderTimers.ts) (change the constants at the top to
change the policy). One protected endpoint, `POST /api/cron/timers`, runs every step, and
Supabase's built-in scheduler calls it once a minute. Every step is guarded, so repeated
or overlapping runs are harmless.

| Rule | Default |
|---|---|
| Auction ends | top bidder gets a pending-payment order; no bids = listing expires |
| Unpaid order | cancelled when its 24h payment deadline passes |
| No ship date agreed | seller has 3 days after payment, then the order is cancelled (buyer refunded) |
| Ship date agreed | 24h grace after the agreed date, then cancelled (buyer refunded) |
| Ship-date proposal unanswered | auto-accepted after 48h (a cancellation request just lapses) |
| Delivered, buyer silent | completes when the 48h auto-approve time passes |
| Shipped, buyer never confirms | completes 2 days after the expected delivery (5 days after shipping; meet-ups 2 days) |

## One-time setup

1. **Pick a secret** (a long random string) and add it as `CRON_SECRET` in Vercel
   (Project → Settings → Environment Variables, Production) and in `.env.local` if you
   want to test locally. Redeploy so the site picks it up. Until it is set the endpoint
   answers `503` and does nothing.
2. In Supabase: **Database → Extensions**, enable **pg_cron** and **pg_net**.
3. In the Supabase **SQL Editor**, run this once (replace both placeholders):

```sql
select cron.schedule(
  'tcs-timers',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://YOUR-SITE.vercel.app/api/cron/timers',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_CRON_SECRET'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

To stop the timers: `select cron.unschedule('tcs-timers');`

## Checking it works

- Supabase → Database → Cron Jobs shows the job and its recent runs.
- Test by hand (PowerShell): call the endpoint with the header
  `Authorization: Bearer YOUR_CRON_SECRET`. The reply lists how many rows each step
  processed; a wrong or missing secret gives `401`.

## Known limits

- There is no real courier or payment integration yet, so "refund" and "payout" here only
  change the order status. The money movement itself comes with the payment provider.
- A cancelled unpaid order or a late-shipment cancellation leaves the original listing
  marked sold; relisting is a separate decision.
- Strikes for non-paying winners and late sellers are not implemented yet.
