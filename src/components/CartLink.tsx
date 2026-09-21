"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { getCart, subscribeCart } from "@/lib/cart";

export function CartLink() {
  const count = useSyncExternalStore(subscribeCart, () => getCart().length, () => 0);

  return (
    <Link
      href="/cart"
      aria-label="ตะกร้าสินค้า"
      className="relative flex items-center justify-center rounded-full no-underline"
      style={{ width: 44, height: 44, background: "var(--panel)", border: "1px solid rgba(140, 147, 163, 0.2)", color: "var(--steel)" }}
    >
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path
          d="M3 5h2l1.6 9.4a1.6 1.6 0 001.58 1.35h6.1a1.6 1.6 0 001.57-1.3L17 8H6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="8.2" cy="17.3" r="1.25" fill="currentColor" />
        <circle cx="14.6" cy="17.3" r="1.25" fill="currentColor" />
      </svg>
      {count > 0 && (
        <span
          className="mono absolute flex items-center justify-center rounded-full"
          style={{
            top: -3,
            right: -3,
            minWidth: 17,
            height: 17,
            padding: "0 4px",
            fontSize: 10,
            background: "var(--blue)",
            color: "#071523",
            border: "1.5px solid var(--bg)",
          }}
        >
          {count}
        </span>
      )}
    </Link>
  );
}
