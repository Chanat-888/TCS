import Link from "next/link";
import type { ReactNode } from "react";

export function BackHeader({
  href,
  title,
  subtitle,
  right,
}: {
  href: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background: "rgba(10, 12, 16, 0.78)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderBottom: "1px solid rgba(140, 147, 163, 0.1)",
      }}
    >
      <div className="wrap flex items-center gap-[14px] py-[14px]">
        <Link
          href={href}
          aria-label="ย้อนกลับ"
          className="flex flex-shrink-0 items-center justify-center rounded-[10px] no-underline"
          style={{
            width: 40,
            height: 40,
            background: "var(--panel)",
            border: "1px solid rgba(140,147,163,0.2)",
            color: "var(--steel)",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M12.5 4 L6 10 L12.5 16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <div className="min-w-0">
          <p
            className="overflow-hidden text-ellipsis whitespace-nowrap"
            style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: subtitle ? 14.5 : 15, color: subtitle ? "var(--white)" : undefined }}
          >
            {title}
          </p>
          {subtitle && (
            <p className="mono text-[11px]" style={{ color: "var(--steel-dim)" }}>
              {subtitle}
            </p>
          )}
        </div>
        {right}
      </div>
    </header>
  );
}
