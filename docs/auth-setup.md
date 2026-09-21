# Phone login setup

TCS now uses Supabase phone OTP and cookie-based SSR sessions. The old
`tcs_session=1` demo cookie no longer authenticates anyone.

## Configure the project

1. Apply the existing migrations, then `supabase/migrations/0006_auth_profiles.sql`
   to the same Supabase project as the app. Use your normal Supabase migration
   workflow, or run this new migration once in its SQL editor.
   It creates profiles for new Auth users and backfills existing Auth users.
   Seed/demo profiles are not reassigned to real people.
2. Set these environment variables locally in `.env.local` and in Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (existing marketplace server operations only;
     never put it in a NEXT_PUBLIC variable).
   The login endpoints themselves do not require the service-role key.
3. In Supabase Authentication, enable the Phone provider and configure an
   SMS provider that can deliver to Thai (+66) mobile numbers. Configure the
   provider credentials inside Supabase, not in the repository.
4. Keep the SMS OTP length at six digits to match this UI. Set expiry and
   SMS rate limits in Supabase. The UI shows a 60-second resend cooldown;
   Supabase enforces rate limits even when a caller bypasses the UI.
5. Restart local development or redeploy after updating environment variables.

Official setup reference: https://supabase.com/docs/guides/auth/phone-login

## Test without buying SMS first

Use Supabase's **test phone numbers / test OTP** configuration in a dedicated
development project (availability and dashboard location depend on your
Supabase configuration). This still exercises Supabase verification and
sessions; there is no hard-coded OTP or authentication bypass in TCS.

Use only development test numbers/codes and remove test overrides before
public launch. If your dashboard requires provider configuration before
enabling Phone, complete that setup first; the application cannot deliver
SMS by itself.

## Acceptance checks against the configured Supabase project

- New number: request OTP, reject an incorrect code, accept the real code.
- Confirm a matching public profile exists with the Auth user's UUID.
- Profile phone remains null: the real number lives only in auth.users.
- Confirm verified, bank_name_matched and is_admin remain false.
- Refresh the page and open a protected page in another tab.
- After access-token expiry, confirm the refresh cookie preserves login.
- Log out from the marketplace or your profile; protected pages must require login.
- Log in again with the same number: profile ID stays the same.
- Log in with another number: it receives a different profile and cannot access
  the first user's orders or edit their listings.
- Resend OTP, test expired OTP and provider rate-limit responses.
- Setting the old tcs_session cookie must not grant access.

Do not transfer ownership of seeded listings/orders or grant admin roles
automatically based on a phone number or signup metadata.

## Local automated checks

```sh
npm run test:auth
npm run lint
npm run build
```

The tests cover authentication boundaries with stubbed Supabase responses;
they do not prove actual SMS delivery, migration application, or production
session refresh. Complete the acceptance checks above after provider setup.

The current implementation uses Supabase's server-enforced OTP limits.
If enabling CAPTCHA in Supabase before public launch, add its matching client
widget and pass its token to signInWithOtp as part of that configuration.
Bank identity verification and payments remain separate, unfinished features.


## Google login and linking

1. In Google Cloud / Google Auth Platform, configure the TCS consent screen
   and a Web application OAuth client. During Testing, add your intended testers.
2. Copy the callback URL shown by **Supabase Authentication > Providers > Google**
   into Google's authorized redirect URIs. This is the Supabase callback, usually
   `https://<project-ref>.supabase.co/auth/v1/callback`, not the TCS callback.
3. Enable Google in Supabase and enter that OAuth client ID and client secret
   there. Never put the Google secret in client-side code or NEXT_PUBLIC variables.
4. Set `NEXT_PUBLIC_SITE_URL` to the exact origin where TCS runs:
   `http://localhost:3000` for normal local development, or your production
   HTTPS origin. Match the local port if you run on a different one.
5. In Supabase URL Configuration, allow that origin plus `/auth/callback`
   as a redirect URL, and set the project's Site URL appropriately. Register
   the app origin with the Google OAuth client as directed by its configuration.
   Separate preview deployments need matching origins and allowed callbacks;
   do not redirect a preview login to production because the PKCE verifier
   cookie belongs to the preview host.
6. Enable **manual identity linking** in Supabase Authentication settings for
   the profile's Link Google button. The login button itself does not require it.

Google-only accounts may browse. Buying, bidding, listing, and order mutations
check phone verification on the server. `/verify-phone` uses
`updateUser({ phone })` followed by OTP type `phone_change`; this keeps the
Google account's existing UUID instead of signing into a second account.

For a phone-first user, sign in with SMS and choose **Link Google** on that
user's profile before signing in separately with Google. Both methods then
use the same profile, listings, and order history.

Already-created separate Google and phone accounts are not automatically
merged. A phone or Google identity already attached to another account is
rejected; contact support for ownership-verified recovery. Do not reassign
orders or identities merely because someone supplies a matching number.

Google login works without an SMS provider for browsing. SMS setup remains
necessary to verify a phone and unlock trading. Phone verification does not
grant bank verification or administrator privileges.

### Additional acceptance checks

- Google consent success opens browse with a phone-verification notice.
- Cancelled consent or a stale callback shows a retry page.
- Unverified Google users are redirected to phone verification before bids,
  buy-now, checkout, and selling; direct listing API writes return 403.
- Verify a new phone while signed in with Google. Check the UUID is unchanged.
- Log out and sign in by that phone: confirm the same UUID and profile.
- On a phone-first account, link an unused Google identity from the profile;
  Google login must return to that same UUID.
- A phone/Google identity belonging to a different account must not merge data.
- Both methods retain login on refresh and clear the local session on logout.

References:
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/auth/auth-identity-linking

Automated tests stub provider responses. Real Google consent, live account
linking, SMS delivery, and hosted session behavior still need verification
after the external provider configuration is complete.

## Page speed: asymmetric JWT signing keys

`src/proxy.ts` refreshes sessions with `getClaims()`. On a Supabase project that
uses **asymmetric JWT signing keys** (Dashboard > Project Settings > JWT Keys),
this verifies the token locally and adds no Auth round trip to page loads.
On a project still using the legacy shared secret, `getClaims()` falls back to
a network call to Supabase Auth (same cost as before, never slower or less
safe). Pages and server actions still confirm identity with `getUser()`.
