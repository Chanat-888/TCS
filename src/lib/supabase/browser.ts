import { createBrowserClient } from "@supabase/ssr";

// Anon-key client for the browser: public SELECTs (listings, bids, profiles,
// reviews) and Realtime subscriptions only. All mutations go through server
// actions using the service role client (see server.ts).
export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
