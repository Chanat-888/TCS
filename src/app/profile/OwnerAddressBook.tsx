import { listAddresses } from "@/lib/addressBook";
import type { SavedAddress } from "@/lib/addresses";
import { AddressManager } from "./AddressManager";

/** Private: render only after the verified session user is the profile owner. */
export async function OwnerAddressBook({ userId }: { userId: string }) {
  let addresses: SavedAddress[];
  try {
    addresses = await listAddresses(userId);
  } catch (e) {
    // Never let the address book take the whole profile page down.
    console.error("[profile] address book unavailable", (e as { code?: string }).code);
    return null;
  }
  return <AddressManager addresses={addresses} />;
}

export function AddressBookSkeleton() {
  return (
    <section className="wrap py-6" aria-busy="true">
      <div className="h-32 max-w-md rounded-2xl motion-safe:animate-pulse" style={{ background: "var(--panel)" }} />
    </section>
  );
}
