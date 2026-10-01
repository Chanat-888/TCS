# Login setup

TCS signs in with LINE (primary) or Google (backup) and uses cookie-based SSR
sessions. The old `tcs_session=1` demo cookie no longer authenticates anyone.

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
3. Restart local development or redeploy after updating environment variables.

## Local automated checks

```sh
npm run test:auth
npm run lint
npm run build
```

The tests cover authentication boundaries with stubbed Supabase responses;
they do not prove migration application or production
session refresh. Complete the acceptance checks below after provider setup.

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

Accounts sign in with LINE or Google. Buying, bidding, listing, and order
mutations require a confirmed sign-in, enforced on the server. Already-created
separate LINE and Google accounts are not automatically merged; a Google
identity already attached to another account is rejected. Do not reassign
orders or identities merely because someone supplies matching details.

### Additional acceptance checks

- Cancelled consent or a stale callback shows a retry page.
- Signed-out users are blocked from bids, buy-now, checkout, and selling;
  direct listing API writes return 403.
- From a LINE account, link an unused Google identity from the profile;
  Google login must return to that same UUID.
- A Google identity belonging to a different account must not merge data.
- Both methods retain login on refresh and clear the local session on logout.

References:
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/auth/auth-identity-linking

Automated tests stub provider responses. Real Google consent, live account
linking and hosted session behavior still need verification
after the external provider configuration is complete.

## Page speed: asymmetric JWT signing keys

`src/proxy.ts` refreshes sessions with `getClaims()`. On a Supabase project that
uses **asymmetric JWT signing keys** (Dashboard > Project Settings > JWT Keys),
this verifies the token locally and adds no Auth round trip to page loads.
On a project still using the legacy shared secret, `getClaims()` falls back to
a network call to Supabase Auth (same cost as before, never slower or less
safe). Pages and server actions still confirm identity with `getUser()`.

## LINE login (primary) and Google (backup)

LINE is added to Supabase as a **custom OAuth2 provider** with identifier
`custom:line` (Authentication > custom providers). OIDC mode does not work for
LINE web login because its ID tokens use HS256 and Supabase custom OIDC accepts
ES256 only, so use **Manual configuration**:

- Authorization URL: `https://access.line.me/oauth2/v2.1/authorize`
- Token URL: `https://api.line.me/oauth2/v2.1/token`
- Userinfo URL: `https://api.line.me/oauth2/v2.1/userinfo`
- Client ID / secret: the LINE Login channel's Channel ID and Channel secret
  (enter the secret only in Supabase, never in the repo or chat)
- JWKS URI: blank. Turn on **Allow users without an email**.

In the LINE Developers Console, add the Supabase callback
(`https://<project-ref>.supabase.co/auth/v1/callback`) under the channel's
LINE Login tab. The channel must be **Published** before ordinary users can
sign in; while Developing, only accounts listed under Roles can.

TCS requests the `openid profile` scopes. LINE users may have no email, so
`getSessionUser` also accepts a `custom:line` identity (read from the Auth
server's identities, never from user-editable metadata). Any confirmed sign-in
(LINE or Google) can trade. Before real
users arrive, add a seller check (for example a bank-account name that matches
the profile) because this is the only gate on who can sell.

Google is only a backup for getting back into a LINE account. The login page
shows LINE as the one button plus a small Google link. Users link Google from
their profile while signed in with LINE. That needs **Allow manual linking**
turned on (Authentication > Sign In / Providers). Without it linking fails with
`manual_linking_disabled`.

The login page's Google button only ever signs into an *existing* account —
it can never create one, otherwise someone could skip LINE entirely and stand
up a second account. `src/app/auth/google/actions.ts` flags this specific flow
with a short-lived cookie, and `src/app/auth/callback/route.ts` checks whether
the row Supabase just signed into was created moments ago (Supabase's normal
sign-in flow provisions a new user the first time it sees an unrecognized
identity). If so, the session is signed out and that row is deleted via the
admin API, so a stranger trying this never gets an account and failed
attempts don't leave orphans behind. It does **not** require the account to
already have LINE linked — several real accounts (including the team's)
predate LINE and are Google-only by design, and there is currently no way for
them to add LINE to that same account themselves (linking only runs the other
direction: Google onto an existing LINE session).
