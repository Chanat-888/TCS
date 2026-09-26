import Link from "next/link";
import { Brand } from "@/components/Brand";
import { CartLink } from "@/components/CartLink";
import { AccountMenu, MobileMenu } from "@/components/HeaderMenus";

type NavItem = {
  href: string;
  label: string;
  desc: string;
  icon: React.ReactNode;
};

const GridIcon = (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <rect x="2" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
    <rect x="11" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
    <rect x="2" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
    <rect x="11" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
  </svg>
);

const ClockIcon = (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.4" />
    <path d="M10 5.5V10L13 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const StarIcon = (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path
      d="M10 2 L12.2 7.4 L18 8 L13.6 11.8 L15 17.5 L10 14.2 L5 17.5 L6.4 11.8 L2 8 L7.8 7.4 Z"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  </svg>
);

const BoxIcon = (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M3 6.5 L10 3 L17 6.5 L10 10 Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M3 6.5 V14 L10 17.5 L17 14 V6.5" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M10 10 V17.5" stroke="currentColor" strokeWidth="1.3" />
  </svg>
);

const StackIcon = (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <rect x="5" y="2.5" width="10" height="13.5" rx="1.6" stroke="currentColor" strokeWidth="1.3" transform="rotate(-8 10 9)" />
    <rect x="5" y="4" width="10" height="13.5" rx="1.6" stroke="currentColor" strokeWidth="1.3" />
  </svg>
);

const GavelIcon = (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <rect x="7.3" y="1.5" width="6.2" height="2.2" rx="1.1" transform="rotate(48 10.4 2.6)" />
    <rect x="5.1" y="4.5" width="5.2" height="5.2" rx="0.5" transform="rotate(48 7.7 7.1)" />
    <rect x="2.6" y="7.5" width="6.2" height="2.2" rx="1.1" transform="rotate(48 5.7 8.6)" />
    <line x1="9.5" y1="9.2" x2="16.3" y2="16.2" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" />
    <rect x="1.7" y="15.4" width="8.2" height="1.5" rx="0.75" />
    <rect x="0.9" y="16.9" width="9.8" height="1.2" rx="0.5" />
  </svg>
);

const BagIcon = (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M5.5 6.5 L6.5 3.6 A2 2 0 0 1 8.4 2.2 H11.6 A2 2 0 0 1 13.5 3.6 L14.5 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="3.2" y="6.5" width="13.6" height="11.3" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
    <path d="M7 9.5 A3 3 0 0 0 13 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const SearchIcon = (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <circle cx="9" cy="9" r="6.2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M17 17 L13.6 13.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const AUCTION_ITEMS: NavItem[] = [
  { href: "/browse?type=auction", label: "ทั้งหมด", desc: "ดูประมูลทั้งหมดที่เปิดอยู่ตอนนี้", icon: GridIcon },
  { href: "/browse?type=auction&category=closing", label: "ใกล้ปิดประมูล", desc: "ประมูลที่กำลังจะปิดเร็ว ๆ นี้", icon: ClockIcon },
  { href: "/browse?type=auction&category=rare", label: "การ์ดแยกใบ", desc: "การ์ดเรตสูงที่หายากในตลาด", icon: StarIcon },
];

const PRODUCT_ITEMS: NavItem[] = [
  { href: "/browse?type=product", label: "ทั้งหมด", desc: "สินค้าซื้อทันทีทั้งหมด", icon: GridIcon },
  { href: "/browse?type=product&category=new", label: "บูสเตอร์ใหม่", desc: "กล่อง/ซองบูสเตอร์ชุดใหม่ล่าสุด", icon: BoxIcon },
  { href: "/browse?type=product&category=deck", label: "เด็คพร้อมเล่น", desc: "เด็คสำเร็จรูป พร้อมลงสนามทันที", icon: StackIcon },
];

const WANTED_ITEMS: NavItem[] = [
  { href: "/browse?type=wanted", label: "ทั้งหมด", desc: "ดูประกาศหาการ์ดทั้งหมด", icon: GridIcon },
  { href: "/browse?type=wanted&category=rare", label: "การ์ดแยกใบ", desc: "คนกำลังตามหาการ์ดหายาก", icon: StarIcon },
];

function NavDropdown({
  label,
  href,
  icon,
  items,
}: {
  label: string;
  href: string;
  icon: React.ReactNode;
  items: NavItem[];
}) {
  return (
    <div className="group relative">
      <Link
        href={href}
        className="flex items-center gap-[7px] rounded-lg px-3 py-2 text-[14.5px] font-medium no-underline transition-colors"
        style={{ color: "var(--white)" }}
      >
        <span className="flex items-center justify-center" style={{ color: "var(--cyan)" }}>
          {icon}
        </span>
        {label}
        <svg
          width="11"
          height="11"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
          className="transition-transform duration-200 group-hover:rotate-180"
          style={{ color: "var(--steel)" }}
        >
          <path d="M5 8 L10 13 L15 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>

      <div className="invisible absolute left-0 top-full z-10 pt-3 opacity-0 transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        <div
          className="flex w-[280px] flex-col gap-1 rounded-2xl p-2"
          style={{ background: "var(--panel)", border: "1px solid var(--line)", boxShadow: "0 24px 48px -16px rgba(0,0,0,0.5)" }}
        >
          {items.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-start gap-3 rounded-xl p-3 no-underline transition-colors hover:bg-[var(--line-soft)]"
            >
              <span
                className="flex flex-shrink-0 items-center justify-center rounded-[10px]"
                style={{ width: 34, height: 34, background: "var(--panel-2)", color: "var(--cyan)" }}
              >
                {item.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-medium" style={{ color: "var(--white)" }}>
                  {item.label}
                </span>
                <span className="block text-[12px] leading-snug" style={{ color: "var(--steel)" }}>
                  {item.desc}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SiteHeader({ userId }: { userId: string }) {
  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background: "var(--bg)",
        borderBottom: "1px solid var(--line-soft)",
      }}
    >
      <div className="wrap relative flex items-center gap-4 min-[860px]:gap-8" style={{ paddingTop: 18, paddingBottom: 18 }}>
        <Brand />
        <nav className="flex items-center gap-1 max-[640px]:hidden">
          <NavDropdown label="Auction" href="/browse?type=auction" icon={GavelIcon} items={AUCTION_ITEMS} />
          <NavDropdown label="Product" href="/browse?type=product" icon={BagIcon} items={PRODUCT_ITEMS} />
          <NavDropdown label="ประกาศหา" href="/browse?type=wanted" icon={SearchIcon} items={WANTED_ITEMS} />
        </nav>
        <div className="flex-1" />
        <div className="flex flex-shrink-0 items-center gap-[10px]">
          <form action="/search" method="get" role="search" className="hidden min-[860px]:block">
            <div className="relative">
              <span className="pointer-events-none absolute left-[13px] top-1/2 -translate-y-1/2" style={{ color: "var(--steel)" }}>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <circle cx="9" cy="9" r="6.2" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M17 17 L13.6 13.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
              <input
                name="q"
                aria-label="ค้นหาการ์ด"
                placeholder="ค้นหาการ์ด"
                className="h-11 rounded-full pl-[38px] pr-4 text-[13.5px] outline-none transition-colors focus:border-[var(--cyan)]"
                style={{ width: 200, background: "var(--panel)", border: "1px solid var(--line)", color: "var(--white)" }}
              />
            </div>
          </form>
          <Link
            href="/search"
            aria-label="ค้นหา"
            className="flex items-center justify-center rounded-full no-underline min-[860px]:hidden"
            style={{ width: 44, height: 44, background: "var(--panel)", border: "1px solid var(--line)", color: "var(--steel)" }}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <circle cx="9" cy="9" r="6.2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M17 17 L13.6 13.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </Link>
          <Link
            href="/listings/new"
            aria-label="ลงขายการ์ด"
            className="flex h-11 flex-shrink-0 items-center justify-center gap-[6px] rounded-full no-underline min-[860px]:px-[18px] max-[859px]:w-11"
            style={{ background: "var(--blue)", color: "#071523" }}
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className="text-[14px] font-semibold max-[859px]:hidden">ลงขาย</span>
          </Link>
          <CartLink />
          <AccountMenu userId={userId} />
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
