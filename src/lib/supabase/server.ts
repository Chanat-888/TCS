import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createAuthClient() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll(values) {
          try {
            values.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            // Server Components cannot write cookies; proxy handles refresh.
          }
        },
      },
    }
  );
}

// Service-role client for server actions / server components only. Bypasses
// RLS by design (see supabase/migrations/0001_init.sql) — application code
// is responsible for checking the verified session user against buyer_id /
// seller_id / is_admin before returning or mutating order/dispute/message rows.
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// Anon-key client for server components doing public reads only (listings,
// bids, profiles, reviews — see the "publicly readable" RLS policies).
export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}
