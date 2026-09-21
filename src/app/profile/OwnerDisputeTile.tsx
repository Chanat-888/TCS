import { getOwnerDisputeCount } from "@/lib/orders";

export function DisputeTile({ count }: { count: number | null }) {
  return (
    <div className="px-5 py-[18px]" style={{ background: "var(--panel)" }}>
      <div className="mono text-[22px]" style={{ color: (count ?? 0) > 0 ? "var(--danger)" : "var(--white)" }}>
        {count ?? "…"}
      </div>
      <div className="mt-1 text-[12px]" style={{ color: "var(--steel)" }}>
        ข้อพิพาททั้งหมด
      </div>
    </div>
  );
}

/** Private stat: render only after the verified session user is the profile
 * owner. It streams in on its own so it never delays the rest of the page. */
export async function OwnerDisputeTile({ userId }: { userId: string }) {
  return <DisputeTile count={await getOwnerDisputeCount(userId)} />;
}
