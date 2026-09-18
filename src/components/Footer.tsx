import Link from "next/link";
import { BrandMark } from "./icons/BrandMark";

export function Footer({ note }: { note: string }) {
  return (
    <footer
      className="mt-8 py-8"
      style={{ borderTop: "1px solid rgba(140, 147, 163, 0.12)" }}
    >
      <div className="wrap flex flex-wrap items-center justify-between gap-[14px]">
        <Link href="/browse" className="flex items-center gap-2 no-underline">
          <BrandMark size={22} variant="compact" />
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 13, color: "var(--steel)" }}>
            TCS
          </span>
        </Link>
        <p className="text-[12.5px]" style={{ color: "var(--steel-dim)" }}>
          {note}
        </p>
      </div>
    </footer>
  );
}
