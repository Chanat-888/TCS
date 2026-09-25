import Link from "next/link";
import { BrandMark } from "./icons/BrandMark";

export function Footer({ note }: { note?: string }) {
  return (
    <footer
      className="mt-8 py-8"
      style={{ borderTop: "1px solid var(--line-soft)" }}
    >
      <div className="wrap flex flex-wrap items-center justify-between gap-[14px]">
        <Link href="/browse" className="flex items-center gap-2 no-underline">
          <BrandMark size={22} variant="compact" />
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 13, color: "var(--steel)" }}>
            TCS
          </span>
        </Link>
        {note && (
          <p className="text-[12.5px]" style={{ color: "var(--steel)" }}>
            {note}
          </p>
        )}
      </div>
    </footer>
  );
}
