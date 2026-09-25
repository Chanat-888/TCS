"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/** Click/tap/Escape/outside-click disclosure, so menus work without a mouse. */
function useDisclosure() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return { open, setOpen, ref };
}

const panelClass = (open: boolean) =>
  `absolute top-full z-10 pt-3 transition-all duration-150 ${open ? "visible opacity-100" : "invisible opacity-0"}`;

const itemClass =
  "flex min-h-11 items-center gap-3 rounded-xl px-3 no-underline transition-colors hover:bg-[var(--line-soft)]";

const circleButtonStyle = { width: 44, height: 44, background: "var(--panel)", border: "1px solid var(--line)", color: "var(--steel)" };

export function AccountMenu({ userId }: { userId: string }) {
  const { open, setOpen, ref } = useDisclosure();
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="บัญชีของฉัน"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
        className="flex cursor-pointer items-center justify-center rounded-full"
        style={circleButtonStyle}
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="10" cy="6.8" r="3.3" stroke="currentColor" strokeWidth="1.5" />
          <path d="M3.5 17c0.9-3.6 4-5.3 6.5-5.3s5.6 1.7 6.5 5.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      <div className={`${panelClass(open)} right-0`}>
        <div
          className="flex w-[220px] flex-col gap-1 rounded-2xl p-2"
          style={{ background: "var(--panel)", border: "1px solid var(--line)", boxShadow: "0 24px 48px -16px rgba(0,0,0,0.5)" }}
        >
          <Link href={`/profile/${userId}`} className={itemClass} style={{ color: "var(--white)" }} onClick={() => setOpen(false)}>
            <span className="text-[13.5px] font-medium">บัญชีของฉัน</span>
          </Link>
          <Link href="/orders" className={itemClass} style={{ color: "var(--white)" }} onClick={() => setOpen(false)}>
            <span className="text-[13.5px] font-medium">คำสั่งซื้อของฉัน</span>
          </Link>
          <form action="/logout" method="post" style={{ borderTop: "1px solid var(--line-soft)" }} className="mt-1 pt-1">
            <button type="submit" className={`${itemClass} w-full cursor-pointer text-left text-[13.5px]`} style={{ color: "var(--steel)" }}>
              ออกจากระบบ
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

const SECTIONS = [
  { href: "/browse?type=auction", label: "Auction" },
  { href: "/browse?type=product", label: "Product" },
  { href: "/browse?type=wanted", label: "ประกาศหา" },
];

/** Replaces the desktop nav on narrow screens. */
export function MobileMenu() {
  const { open, setOpen, ref } = useDisclosure();
  return (
    <div ref={ref} className="relative min-[641px]:hidden">
      <button
        type="button"
        aria-label="เมนู"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex cursor-pointer items-center justify-center rounded-full"
        style={circleButtonStyle}
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M3.5 5.5h13M3.5 10h13M3.5 14.5h13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      <div className={`${panelClass(open)} right-0`}>
        <div
          className="flex w-[220px] flex-col gap-1 rounded-2xl p-2"
          style={{ background: "var(--panel)", border: "1px solid var(--line)", boxShadow: "0 24px 48px -16px rgba(0,0,0,0.5)" }}
        >
          {SECTIONS.map((s) => (
            <Link key={s.href} href={s.href} className={itemClass} style={{ color: "var(--white)" }} onClick={() => setOpen(false)}>
              <span className="text-[13.5px] font-medium">{s.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
