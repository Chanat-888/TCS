import { formatTHB } from "@/lib/format";
import { totalPrice } from "@/lib/spreadPost";
import type { ListingItem } from "@/lib/supabase/types";

/** The individual cards in an order made from a spread post (nothing for an ordinary order). */
export function OrderItemsList({ items }: { items: ListingItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mb-5 rounded-2xl p-4" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
      <h2 className="text-[14px] font-medium" style={{ color: "var(--steel)" }}>
        การ์ดในคำสั่งซื้อนี้ ({items.length} ใบ)
      </h2>
      <ul className="mt-3 flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3">
            <span className="mono w-9 flex-shrink-0 text-[13px]" style={{ color: "var(--cyan)" }}>#{item.position}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px]" style={{ color: "var(--white)" }}>{item.name}</span>
              <span className="block text-[12px]" style={{ color: "var(--steel)" }}>
                {item.rarity} · {item.condition}
              </span>
            </span>
            <span className="mono flex-shrink-0 text-[13.5px]" style={{ color: "var(--white)" }}>{formatTHB(item.price)}</span>
          </li>
        ))}
      </ul>
      <p className="mono mt-3 flex justify-between text-[14px]" style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 10, color: "var(--white)" }}>
        <span style={{ color: "var(--steel)" }}>รวม</span>
        {formatTHB(totalPrice(items))}
      </p>
    </section>
  );
}
