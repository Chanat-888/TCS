import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import type { SavedAddress } from "@/lib/addresses";

const COLUMNS = "id, label, recipient, phone, address, province, postcode, is_default";

// profile_addresses is private (RLS on, no policies): only the service role can
// touch it. Every function takes the userId from the VERIFIED session and filters
// by it, so one person can never read or change another person's addresses.

export async function listAddresses(userId: string): Promise<SavedAddress[]> {
  const { data, error } = await createServiceClient()
    .from("profile_addresses")
    .select(COLUMNS)
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SavedAddress[];
}

export async function getAddress(userId: string, id: string): Promise<SavedAddress | null> {
  const { data, error } = await createServiceClient()
    .from("profile_addresses")
    .select(COLUMNS)
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as SavedAddress | null) ?? null;
}
