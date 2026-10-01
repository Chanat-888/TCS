import { createServiceClient } from "@/lib/supabase/server";
import { PayoutAccount } from "./PayoutAccount";

/** Private: render only after the verified session user is the profile owner. */
export async function OwnerPayoutAccount({ userId }: { userId: string }) {
  const { data, error } = await createServiceClient()
    .from("seller_payout_accounts")
    .select("bank_brand, account_last4, account_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    // Never let this take the whole profile page down (e.g. migration not applied yet).
    console.error("[profile] payout account unavailable", error.code);
    return null;
  }
  return <PayoutAccount saved={data} />;
}
